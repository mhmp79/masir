'use strict';

const crypto = require('node:crypto');
const express = require('express');
const {
  query,
  withTransaction,
  getColumnInfo,
  columnFor,
  requireColumn,
} = require('./db');
const {
  authenticate,
  requireRole,
  normalizePhone,
  getUserById,
} = require('./auth');
const {
  APPROVED,
  visibleOwnerIds,
  canWriteOwner,
} = require('./permissions');
const { publish, refreshAllSubscriptions } = require('./realtime');

/* ---- typed table allow-list --------------------------------------------- */
const TABLE_CONFIG = Object.freeze({
  subjects: { singleton: false },
  sessions: { singleton: false },
  activities: { singleton: false },
  classes: { singleton: false },
  sleeps: { singleton: false },
  phones: { singleton: false },
  exams: { singleton: false },
  questions: { singleton: false },
  app_meta: { singleton: false },
  tracker: { singleton: true },
  timer: { singleton: true },
});
const ALLOWED_TABLES = Object.keys(TABLE_CONFIG);
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 1000;
const MAX_CHANGES_PER_REQUEST = 500;
const META_COLUMNS = new Set([
  'id', 'owner_id', 'local_id', 'updated', 'created', 'created_at',
  'deleted', 'ownerid', 'localid', 'table',
]);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function toSnakeCase(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function normalizeValue(value, dataType) {
  if (value === null) return null;
  const type = String(dataType || '').toLowerCase();
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
  if (type.startsWith('timestamp') || type === 'date') {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('invalid timestamp value');
    return date;
  }
  if (['smallint', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision'].includes(type)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('invalid numeric value');
    return number;
  }
  if (type === 'boolean') {
    if (typeof value === 'string') return /^(1|true|yes|on)$/i.test(value);
    return Boolean(value);
  }
  return value;
}

/** Only columns that exist in the migrated table, converted from camelCase data keys. */
async function dataColumns(table, data) {
  const info = await getColumnInfo(table);
  const result = {};
  for (const [key, rawValue] of Object.entries(data || {})) {
    if (rawValue === undefined) continue;
    const column = toSnakeCase(key);
    if (META_COLUMNS.has(column) || !info.has(column)) continue;
    result[column] = normalizeValue(rawValue, info.get(column));
  }
  return result;
}

async function changeRecordColumns() {
  const info = await getColumnInfo('changes');
  return {
    table: (await columnFor('changes', ['table_name', 'table']))
      || (await requireColumn('changes', ['table_name'], 'table name')),
    row: await requireColumn('changes', ['row_id', 'local_id'], 'row id'),
    op: await requireColumn('changes', ['op', 'operation'], 'op'),
    owner: await columnFor('changes', ['owner_id']),
    actor: await columnFor('changes', ['actor_id']),
    data: await requireColumn('changes', ['data', 'payload'], 'data'),
    updated: await requireColumn('changes', ['updated', 'updated_at'], 'updated'),
  };
}

async function insertChangeRecord(client, event) {
  const columns = await changeRecordColumns();
  const names = [columns.table, columns.row, columns.op, columns.updated, columns.data];
  const values = [
    event.table,
    String(event.id),
    event.op,
    event.updated,
    JSON.stringify(event.data || {}),
  ];
  if (columns.owner) {
    names.push(columns.owner);
    values.push(String(event.ownerId));
  }
  if (columns.actor && event.actorId) {
    names.push(columns.actor);
    values.push(String(event.actorId));
  }
  const placeholders = names.map((_, index) => `$${index + 1}`);
  await client.query(
    `INSERT INTO changes (${names.map(quoteIdent).join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  );
}

/* ---- snapshot cursor ----------------------------------------------------- */
function encodeCursor(row) {
  return Buffer.from(
    JSON.stringify({
      updated: row.updated instanceof Date ? row.updated.toISOString() : String(row.updated),
      table: row.table_name,
      id: row.row_id,
    }),
  ).toString('base64url');
}

function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (!cursor.updated || !cursor.table || !cursor.id) throw new Error('incomplete cursor');
    if (!ALLOWED_TABLES.includes(cursor.table)) throw new Error('unknown table in cursor');
    return cursor;
  } catch (error) {
    const invalid = new Error(`invalid cursor: ${error.message}`);
    invalid.status = 400;
    throw invalid;
  }
}

/* ---- change application -------------------------------------------------- */
async function applyChange(change, user) {
  if (!change || typeof change !== 'object') throw new Error('invalid change');
  const table = firstDefined(change.table, change.data && change.data.table);
  if (!ALLOWED_TABLES.includes(table)) throw new Error('unknown table');
  const singleton = TABLE_CONFIG[table].singleton;
  const data = change.data && typeof change.data === 'object' ? change.data : {};
  const rawOp = String(change.op || (data.deleted ? 'delete' : 'upsert')).toLowerCase();
  const isDelete = ['delete', 'remove', 'soft_delete', 'soft-delete'].includes(rawOp);
  if (!isDelete && !['upsert', 'put', 'update', 'restore'].includes(rawOp)) {
    throw new Error('unknown operation');
  }

  const id = firstDefined(change.id, data.id, data.localId, data.local_id);
  if (!singleton && (id === undefined || id === '')) throw new Error('missing row id');

  const requestedOwner = firstDefined(
    change.ownerId, change.owner_id, data.ownerId, data.owner_id,
    data.studentId, data.student_id,
  );
  const expectedUpdated = firstDefined(
    change.expectedUpdated, data.expectedUpdated, data.updatedAt, data.updated,
  );
  const payload = isDelete ? {} : await dataColumns(table, data);
  const visibleOwners = await visibleOwnerIds(user);
  const owners = requestedOwner && visibleOwners.includes(String(requestedOwner))
    ? [String(requestedOwner)]
    : visibleOwners;

  const outcome = await withTransaction(async (client) => {
    const findParams = singleton ? [owners] : [String(id), owners];
    const findWhere = singleton
      ? 'owner_id = ANY($1)'
      : 'local_id = $1 AND owner_id = ANY($2)';
    const found = await client.query(
      `SELECT * FROM ${table} WHERE ${findWhere} ORDER BY updated DESC LIMIT 1 FOR UPDATE`,
      findParams,
    );
    const existing = found.rows[0] || null;
    const owner = existing
      ? String(existing.owner_id)
      : String(requestedOwner || user.id);

    if (!(await canWriteOwner(user, owner))) {
      return { conflict: true };
    }

    if (existing && expectedUpdated != null) {
      const expected = new Date(expectedUpdated).getTime();
      const actual = new Date(existing.updated).getTime();
      if (!Number.isFinite(expected) || Math.abs(expected - actual) > 1) {
        return { conflict: true };
      }
    }

    if (isDelete) {
      if (!existing) return { applied: true, noop: true };
      const params = singleton ? [owner] : [owner, String(id)];
      await client.query(
        `UPDATE ${table} SET deleted = true, updated = now()
          WHERE ${singleton ? 'owner_id = $1' : 'owner_id = $1 AND local_id = $2'}`,
        params,
      );
    } else {
      const names = [];
      const values = [];
      const params = [];
      const addValue = (column, value) => {
        names.push(column);
        values.push(`$${params.length + 1}`);
        params.push(value);
      };
      const addLiteral = (column, literal) => {
        names.push(column);
        values.push(literal);
      };

      addValue('owner_id', owner);
      if (!singleton) addValue('local_id', String(id));
      addLiteral('updated', 'now()');
      addLiteral('deleted', 'false');
      for (const [column, value] of Object.entries(payload)) addValue(column, value);

      const updates = [
        'updated = EXCLUDED.updated',
        'deleted = EXCLUDED.deleted',
        ...Object.keys(payload).map(
          (column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`,
        ),
      ];
      const conflictTarget = singleton ? '(owner_id)' : '(owner_id, local_id)';
      await client.query(
        `INSERT INTO ${table} (${names.map(quoteIdent).join(', ')})
         VALUES (${values.join(', ')})
         ON CONFLICT ${conflictTarget} DO UPDATE SET ${updates.join(', ')}`,
        params,
      );
    }

    const readParams = singleton ? [owner] : [owner, String(id)];
    const after = await client.query(
      `SELECT to_jsonb(t) AS data, t.updated
         FROM ${table} t
        WHERE ${singleton ? 't.owner_id = $1' : 't.owner_id = $1 AND t.local_id = $2'}
        LIMIT 1`,
      readParams,
    );
    if (!after.rows.length) return { conflict: true };

    const row = after.rows[0];
    const event = {
      table,
      id: singleton ? table : String(id),
      op: isDelete ? 'delete' : 'upsert',
      updated: row.updated instanceof Date ? row.updated.toISOString() : String(row.updated),
      data: row.data,
      ownerId: owner,
      actorId: String(user.id),
    };
    await insertChangeRecord(client, event);
    return { event };
  });

  if (outcome.event) {
    try {
      await publish(outcome.event);
    } catch (error) {
      console.error('[ws] broadcast failed:', error.message);
    }
  }
  return outcome;
}

/* ---- advisor link column helpers ---------------------------------------- */
async function linkColumns() {
  return {
    id: await columnFor('advisor_links', ['id']),
    advisor: await requireColumn('advisor_links', ['advisor_id'], 'advisor id'),
    student: await requireColumn('advisor_links', ['student_id'], 'student id'),
    status: await requireColumn('advisor_links', ['status'], 'status'),
    code: await requireColumn('advisor_links', ['code'], 'pairing code'),
    created: await requireColumn('advisor_links', ['created_at'], 'created timestamp'),
    approved: await columnFor('advisor_links', ['approved_at']),
    updated: await columnFor('advisor_links', ['updated']),
  };
}

function compactUser(user) {
  if (!user) return null;
  return { id: user.id, phone: user.phone, role: user.role, displayName: user.displayName };
}

async function resolveUser(body, prefix) {
  const userColumns = await requireColumn('users', ['id'], 'id');
  const id = firstDefined(body[`${prefix}Id`], body[`${prefix}_id`]);
  if (id) return getUserById(id);
  const phone = normalizePhone(firstDefined(body[`${prefix}Phone`], body[`${prefix}_phone`]));
  if (!phone) return null;
  const { rows } = await query(`SELECT ${userColumns} AS id FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  return rows.length ? getUserById(rows[0].id) : null;
}

/* ---- router -------------------------------------------------------------- */
const router = express.Router();

router.get('/api/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString(), db: 'ok' });
  } catch (error) {
    next(error);
  }
});

router.get('/api/snapshot', authenticate, async (req, res, next) => {
  try {
    const sinceRaw = firstDefined(req.query.since, req.query.after);
    let since = null;
    if (sinceRaw) {
      since = new Date(sinceRaw);
      if (Number.isNaN(since.getTime())) {
        return res.status(400).json({ error: 'invalid since timestamp' });
      }
    }
    const cursor = decodeCursor(req.query.cursor);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_PAGE_SIZE),
    );

    const owners = await visibleOwnerIds(req.user);
    if (owners.length === 0) {
      return res.json({ serverTime: new Date().toISOString(), changes: [] });
    }

    const union = ALLOWED_TABLES.map((table) => {
      const idExpression = TABLE_CONFIG[table].singleton
        ? `'${table}'::text`
        : 't.local_id::text';
      // `table` comes from the static allow-list above, never from user input.
      return `SELECT '${table}'::text AS table_name,
                     ${idExpression} AS row_id,
                     t.updated,
                     to_jsonb(t) AS data
                FROM ${table} t
               WHERE t.owner_id = ANY($1) AND t.updated > $2`;
    }).join(' UNION ALL ');

    const { rows } = await query(
      `SELECT table_name, row_id, updated, data
         FROM (${union}) AS all_rows
        WHERE ($3::timestamptz IS NULL
               OR (updated, table_name, row_id) > ($3::timestamptz, $4::text, $5::text))
        ORDER BY updated, table_name, row_id
        LIMIT $6`,
      [
        owners,
        (since || new Date(0)).toISOString(),
        cursor ? cursor.updated : null,
        cursor ? cursor.table : null,
        cursor ? cursor.id : null,
        limit,
      ],
    );

    const changes = rows.map((row) => ({
      table: row.table_name,
      id: row.row_id,
      op: row.data && row.data.deleted ? 'delete' : 'upsert',
      updated: row.updated instanceof Date ? row.updated.toISOString() : String(row.updated),
      data: row.data,
    }));
    const response = {
      serverTime: new Date().toISOString(),
      changes,
    };
    if (changes.length === limit) {
      response.nextCursor = encodeCursor(rows[rows.length - 1]);
    }
    return res.json(response);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

router.post('/api/changes', authenticate, async (req, res, next) => {
  try {
    const changes = req.body && req.body.changes;
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes must be an array' });
    }
    if (changes.length > MAX_CHANGES_PER_REQUEST) {
      return res.status(413).json({ error: 'too many changes in one request' });
    }

    const applied = [];
    const conflicts = [];
    for (const change of changes) {
      const changeId = String(
        firstDefined(
          change && change.id,
          change && change.data && change.data.id,
          change && change.data && change.data.localId,
          '',
        ),
      );
      try {
        const result = await applyChange(change, req.user);
        if (result.conflict) conflicts.push(changeId);
        else applied.push(changeId);
      } catch (error) {
        console.error('[changes] rejected:', error.message);
        conflicts.push(changeId);
      }
    }
    return res.json({ applied, conflicts });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/advisors/invite', authenticate, requireRole('advisor', 'admin'), async (req, res, next) => {
  try {
    const columns = await linkColumns();
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    await withTransaction(async (client) => {
      /* Revoke superseded invites instead of deleting them; pairing history
         must remain auditable and no stored row is ever destroyed. */
      const revokeSql = columns.updated
        ? `UPDATE advisor_links
              SET ${columns.status} = 'revoked', ${columns.updated} = now()
            WHERE ${columns.advisor} = $1 AND ${columns.status} = 'pending'`
        : `UPDATE advisor_links
              SET ${columns.status} = 'revoked'
            WHERE ${columns.advisor} = $1 AND ${columns.status} = 'pending'`;
      await client.query(revokeSql, [req.user.id]);
      const names = [columns.advisor, columns.status, columns.code, columns.created];
      const values = ['$1', `'pending'`, '$2', 'now()'];
      const params = [req.user.id, code];
      if (columns.updated) {
        names.push(columns.updated);
        values.push('now()');
      }
      await client.query(
        `INSERT INTO advisor_links (${names.join(', ')}) VALUES (${values.join(', ')})`,
        params,
      );
    });
    return res.json({ ok: true, code, expiresIn: 24 * 3600 });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/advisors/accept', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const code = String((req.body && req.body.code) || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code is required' });

    const columns = await linkColumns();
    const assignments = [
      `${columns.student} = $1`,
      `${columns.status} = '${APPROVED}'`,
    ];
    const params = [String(req.user.id)];
    params.push(code); // $2 is the pairing code used in the WHERE clause
    if (columns.approved) assignments.push(`${columns.approved} = now()`);
    if (columns.updated) assignments.push(`${columns.updated} = now()`);

    const result = await query(
      `UPDATE advisor_links
          SET ${assignments.join(', ')}
        WHERE ${columns.code} = $2
          AND ${columns.status} = 'pending'
          AND ${columns.advisor} <> $1
          AND (${columns.student} IS NULL OR ${columns.student} = $1)
          AND ${columns.created} > now() - interval '24 hours'
        RETURNING ${columns.advisor} AS advisor_id`,
      params,
    );
    if (!result.rows.length) {
      return res.status(400).json({ ok: false, error: 'invalid or expired code' });
    }
    const advisor = await getUserById(result.rows[0].advisor_id);
    await refreshAllSubscriptions().catch((error) => {
      console.error('[ws] subscription refresh failed:', error.message);
    });
    return res.json({ ok: true, advisor: compactUser(advisor) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'link already exists' });
    }
    return next(error);
  }
});

router.get('/api/advisors/links', authenticate, async (req, res, next) => {
  try {
    const columns = await linkColumns();
    const isAdmin = req.user.role === 'admin';
    const params = isAdmin ? [] : [String(req.user.id)];
    const where = isAdmin
      ? ''
      : `WHERE ${columns.advisor} = $1 OR ${columns.student} = $1`;
    const { rows } = await query(
      `SELECT * FROM advisor_links ${where} ORDER BY ${columns.created} DESC LIMIT 200`,
      params,
    );

    const links = [];
    for (const row of rows) {
      const advisor = await getUserById(row[columns.advisor]);
      const student = row[columns.student] ? await getUserById(row[columns.student]) : null;
      links.push({
        id: columns.id && row[columns.id] ? String(row[columns.id]) : '',
        code: row[columns.code] || null,
        status: row[columns.status],
        createdAt: row[columns.created],
        approvedAt: columns.approved ? row[columns.approved] : null,
        advisor: compactUser(advisor),
        student: compactUser(student),
      });
    }
    return res.json({ links });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/admin/advisor-links', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const advisor = await resolveUser(body, 'advisor');
    const student = await resolveUser(body, 'student');
    if (!advisor || !student) {
      return res.status(404).json({ error: 'advisor or student not found' });
    }
    if (advisor.role !== 'advisor') {
      return res.status(400).json({ error: 'selected user is not an advisor' });
    }
    if (student.role !== 'student') {
      return res.status(400).json({ error: 'selected user is not a student' });
    }

    const columns = await linkColumns();
    const names = [columns.advisor, columns.student, columns.status, columns.created];
    const values = ['$1', '$2', `'${APPROVED}'`, 'now()'];
    const params = [advisor.id, student.id];
    if (columns.approved) {
      names.push(columns.approved);
      values.push('now()');
    }
    if (columns.updated) {
      names.push(columns.updated);
      values.push('now()');
    }
    const updates = [`${columns.status} = EXCLUDED.${columns.status}`];
    if (columns.approved) updates.push(`${columns.approved} = now()`);
    if (columns.updated) updates.push(`${columns.updated} = now()`);
    updates.push(`${columns.code} = NULL`);

    const { rows } = await query(
      `INSERT INTO advisor_links (${names.join(', ')})
       VALUES (${values.join(', ')})
       ON CONFLICT (${columns.advisor}, ${columns.student}) DO UPDATE
         SET ${updates.join(', ')}
       RETURNING *`,
      params,
    );
    await refreshAllSubscriptions().catch((error) => {
      console.error('[ws] subscription refresh failed:', error.message);
    });
    return res.json({
      ok: true,
      link: {
        id: columns.id && rows[0][columns.id] ? String(rows[0][columns.id]) : '',
        advisor: compactUser(advisor),
        student: compactUser(student),
        status: rows[0][columns.status],
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = {
  router,
  TABLE_CONFIG,
  ALLOWED_TABLES,
  applyChange,
};
