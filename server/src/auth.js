'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const path = require('node:path');
const express = require('express');
const {
  query,
  withTransaction,
  columnFor,
  requireColumn,
} = require('./db');

const scrypt = promisify(crypto.scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_TTL_SECONDS = positiveInt(process.env.JWT_TTL_SECONDS, 7 * 24 * 3600);
const PURPOSE_TOKEN_TTL_SECONDS = positiveInt(process.env.PURPOSE_TOKEN_TTL_SECONDS, 10 * 60);
const OTP_TTL_SECONDS = positiveInt(process.env.OTP_TTL_SECONDS, 300);
const OTP_MAX_ATTEMPTS = positiveInt(process.env.OTP_MAX_ATTEMPTS, 5);
const OTP_COOLDOWN_SECONDS = positiveInt(process.env.OTP_REQUEST_COOLDOWN_SECONDS, 30);
const OTP_DEV_PRINT = /^(1|true|yes|on)$/i.test(process.env.OTP_DEV_PRINT || 'false');
const OTP_PURPOSES = Object.freeze(['signup', 'reset']);
const USER_ROLES = Object.freeze(['student', 'advisor', 'admin']);
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 1024;
const PURPOSE_TOKEN_TYPE = 'purpose';
const ADMIN_PHONES = new Set(
  String(process.env.ADMIN_PHONES || '')
    .split(',')
    .map((value) => normalizePhone(value.trim()))
    .filter(Boolean),
);

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Accept the common Iranian spellings and return +98xxxxxxxxxx. */
function normalizePhone(input) {
  let phone = String(input == null ? '' : input).trim();
  phone = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+');
  if (/^98\d{10}$/.test(phone)) phone = `+${phone}`;
  if (/^0?9\d{9}$/.test(phone)) phone = `+98${phone.replace(/^0/, '')}`;
  return /^\+989\d{9}$/.test(phone) ? phone : null;
}

/** OTP scope. Omitted values mean signup for backwards compatibility. */
function normalizePurpose(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback === undefined ? 'signup' : fallback;
  }
  const purpose = String(value).trim().toLowerCase();
  return OTP_PURPOSES.includes(purpose) ? purpose : null;
}

/** Include the purpose in the OTP digest so a signup code cannot reset a password. */
function hashCode(phone, code, purpose) {
  const scope = normalizePurpose(purpose, 'signup') || 'signup';
  return crypto
    .createHash('sha256')
    .update(`${JWT_SECRET}:otp:${scope}:${phone}:${code}`)
    .digest('hex');
}

/** Pre-purpose OTP hash retained so unredeemed legacy codes keep working for signup. */
function legacyHashCode(phone, code) {
  return crypto
    .createHash('sha256')
    .update(`${JWT_SECRET}:otp:${phone}:${code}`)
    .digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/* ---- password hashing ----------------------------------------------------- */
function isValidPassword(value) {
  return typeof value === 'string'
    && value.length >= PASSWORD_MIN_LENGTH
    && value.length <= PASSWORD_MAX_LENGTH
    && !value.includes('\0');
}

/** Throws a 400 error when the password does not satisfy the policy. */
function validatePassword(value) {
  if (!isValidPassword(value)) {
    throw httpError(400, `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters long.`);
  }
  return value;
}

async function hashPassword(password) {
  const value = validatePassword(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

/** Timing-safe verification of the `scrypt$salt$hash` storage format. */
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !/^[0-9a-f]+$/i.test(digest || '')) return false;
  const expected = Buffer.from(digest, 'hex');
  if (!expected.length) return false;
  let actual;
  try {
    actual = await scrypt(typeof password === 'string' ? password : '', salt, expected.length);
  } catch (_) {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* A cached, valid hash used when the phone is unknown or has no password, so
   login work is comparable for real and fake accounts. */
let dummyHashPromise = null;
function dummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomBytes(32).toString('hex'));
  }
  return dummyHashPromise;
}

function safeDisplayName(value, fallback) {
  if (typeof value !== 'string') return fallback || '';
  return value.trim().slice(0, 120);
}

/* ---- JWT ------------------------------------------------------------------ */
function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signClaims(claims) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return signClaims({
    sub: String(user.id),
    role: user.role,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  });
}

/** Short-lived, purpose-bound token returned by verify-otp (not a login token). */
function signPurposeToken(phone, purpose, ttlSeconds) {
  const scope = normalizePurpose(purpose, null);
  if (!scope) throw new TypeError('purpose must be signup or reset');
  const numericTtl = Number(ttlSeconds);
  const ttl = Number.isFinite(numericTtl) && numericTtl !== 0
    ? Math.trunc(numericTtl)
    : PURPOSE_TOKEN_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  return signClaims({
    sub: String(phone),
    phone: String(phone),
    purpose: scope,
    typ: PURPOSE_TOKEN_TYPE,
    /* jti is recorded for auditability; one-use is enforced by account state
       (a password now exists for signup, or was changed for reset). */
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttl,
  });
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;

  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    if (!payload.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/** Verifies signature, expiry, token type and the requested OTP purpose. */
function verifyPurposeToken(token, expectedPurpose) {
  const payload = verifyToken(token);
  if (!payload) return null;
  if (payload.typ !== PURPOSE_TOKEN_TYPE || !OTP_PURPOSES.includes(payload.purpose)) return null;
  if (expectedPurpose && payload.purpose !== expectedPurpose) return null;
  if (!payload.phone || !payload.jti) return null;
  return payload;
}

/* ---- user lookup ---------------------------------------------------------- */
async function userColumns() {
  return {
    id: await requireColumn('users', ['id'], 'id'),
    phone: await requireColumn('users', ['phone'], 'phone'),
    role: await requireColumn('users', ['role'], 'role'),
    displayName: await columnFor('users', ['display_name', 'displayName']),
    passwordHash: await columnFor('users', ['password_hash']),
    passwordUpdatedAt: await columnFor('users', ['password_updated_at']),
  };
}

function publicUser(row, columns) {
  return {
    id: String(row[columns.id]),
    phone: row[columns.phone],
    role: row[columns.role],
    displayName: (columns.displayName && row[columns.displayName]) || '',
  };
}

function assertPasswordColumn(columns) {
  if (!columns.passwordHash) {
    throw httpError(500, 'Database is missing users.password_hash; run the password-auth migration');
  }
}

function userFieldsFor(columns) {
  const fields = [columns.id, columns.phone, columns.role];
  if (columns.displayName) fields.push(columns.displayName);
  if (columns.passwordHash) fields.push(columns.passwordHash);
  if (columns.passwordUpdatedAt) fields.push(columns.passwordUpdatedAt);
  return fields;
}

async function findUser(columnName, value, columns, client, forUpdate) {
  const runner = client || { query };
  const { rows } = await runner.query(
    `SELECT ${userFieldsFor(columns).join(', ')} FROM users
      WHERE ${columnName} = $1 LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [value],
  );
  return rows[0] || null;
}

async function getUserById(id) {
  if (!id) return null;
  const columns = await userColumns();
  const row = await findUser(columns.id, String(id), columns);
  return row ? publicUser(row, columns) : null;
}

async function setUserPassword(client, columns, id, passwordHash) {
  if (!columns.passwordHash) assertPasswordColumn(columns);
  const assignments = [`${columns.passwordHash} = $1`];
  const params = [passwordHash];
  if (columns.passwordUpdatedAt) {
    assignments.push(`${columns.passwordUpdatedAt} = now()`);
  }
  await client.query(
    `UPDATE users SET ${assignments.join(', ')} WHERE ${columns.id} = $${params.length + 1}`,
    [...params, String(id)],
  );
}

/** Creates OTP-only users without ever overwriting an existing password hash. */
async function upsertUser(client, phone, columns, options) {
  const opts = options || {};
  const role = opts.role || (ADMIN_PHONES.has(phone) ? 'admin' : 'student');
  const insertColumns = [];
  const placeholders = [];
  const params = [];
  const addValue = (column, value) => {
    insertColumns.push(column);
    params.push(value);
    placeholders.push(`$${params.length}`);
  };
  const addLiteral = (column, literal) => {
    insertColumns.push(column);
    placeholders.push(literal);
  };

  addValue(columns.phone, phone);
  addValue(columns.role, role);
  if (columns.displayName) addValue(columns.displayName, safeDisplayName(opts.displayName));
  if (columns.passwordHash && opts.passwordHash) addValue(columns.passwordHash, opts.passwordHash);
  if (columns.passwordUpdatedAt && opts.passwordHash) addLiteral(columns.passwordUpdatedAt, 'now()');

  const { rows } = await client.query(
    `INSERT INTO users (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (${columns.phone}) DO UPDATE SET ${columns.phone} = EXCLUDED.${columns.phone}
     RETURNING ${userFieldsFor(columns).join(', ')}`,
    params,
  );
  return publicUser(rows[0], columns);
}

async function otpColumns() {
  return {
    id: await columnFor('otp_codes', ['id']),
    phone: await requireColumn('otp_codes', ['phone', 'phone_number'], 'phone'),
    hash: await requireColumn('otp_codes', ['code_hash', 'hash'], 'code hash'),
    expires: await requireColumn('otp_codes', ['expires_at', 'expires'], 'expiry'),
    attempts: await requireColumn('otp_codes', ['attempts'], 'attempts'),
    maxAttempts: await columnFor('otp_codes', ['max_attempts']),
    consumed: await requireColumn('otp_codes', ['consumed_at', 'used_at'], 'consumed timestamp'),
    created: await columnFor('otp_codes', ['created_at']),
    purpose: await columnFor('otp_codes', ['purpose']),
  };
}

function otpHashMatches(record, columns, phone, code, purpose) {
  if (hashCode(phone, code, purpose) === record[columns.hash]) return true;
  if (purpose !== 'signup') return false;
  const storedPurpose = columns.purpose ? record[columns.purpose] : null;
  if (storedPurpose && String(storedPurpose).toLowerCase() !== 'signup') return false;
  /* Old databases hashed codes without a purpose; honour those for signup only. */
  return legacyHashCode(phone, code) === record[columns.hash];
}

/* ---- injectable SMS sender ---------------------------------------------- */
let smsSender = null;

function sendSms(phone, code) {
  if (!smsSender) return Promise.resolve();
  return Promise.resolve().then(() => smsSender(phone, code));
}

function setSmsSender(fn) {
  if (fn != null && typeof fn !== 'function') {
    throw new TypeError('sendSms must be a function (phone, code) => Promise|void');
  }
  smsSender = fn;
}

function loadSmsProviderFromEnv() {
  const modulePath = String(process.env.SMS_PROVIDER_MODULE || '').trim();
  if (!modulePath) return false;
  const resolved = path.isAbsolute(modulePath)
    ? modulePath
    : path.resolve(__dirname, '..', modulePath);
  const provider = require(resolved);
  const sender = typeof provider === 'function' ? provider : provider.sendSms || provider.send;
  if (typeof sender !== 'function') {
    throw new Error(`SMS provider ${resolved} must export a sendSms(phone, code) function`);
  }
  setSmsSender(sender.bind(provider));
  console.log('[auth] SMS provider loaded:', resolved);
  return true;
}

/* ---- middleware ---------------------------------------------------------- */
async function authenticate(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  const payload = verifyToken(match[1].trim());
  if (!payload || payload.typ === PURPOSE_TOKEN_TYPE || payload.purpose) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
  try {
    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'account not found' });
    }
    req.user = user;
    req.token = payload;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'insufficient role' });
    }
    return next();
  };
}

/* ---- routes -------------------------------------------------------------- */
const router = express.Router();

router.post('/api/auth/request-otp', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body && req.body.phone);
    const purpose = normalizePurpose(req.body && req.body.purpose, 'signup');
    if (!phone || !purpose) {
      return res.status(400).json({ ok: false, error: 'invalid phone number or purpose' });
    }

    const columns = await otpColumns();
    if (columns.created && OTP_COOLDOWN_SECONDS > 0) {
      const { rows } = await query(
        `SELECT ${columns.created} AS created_at
           FROM otp_codes
          WHERE ${columns.phone} = $1
          ORDER BY ${columns.created} DESC
          LIMIT 1`,
        [phone],
      );
      if (rows.length && rows[0].created_at) {
        const ageSeconds = (Date.now() - new Date(rows[0].created_at).getTime()) / 1000;
        if (Number.isFinite(ageSeconds) && ageSeconds < OTP_COOLDOWN_SECONDS) {
          return res.status(429).json({
            ok: false,
            error: 'too many requests',
            retryAfter: Math.ceil(OTP_COOLDOWN_SECONDS - ageSeconds),
          });
        }
      }
    }

    const code = generateCode();
    await withTransaction(async (client) => {
      /* Supersede old codes without deleting audit/history rows. */
      await client.query(
        `UPDATE otp_codes SET ${columns.consumed} = now()
          WHERE ${columns.phone} = $1 AND ${columns.consumed} IS NULL`,
        [phone],
      );

      const insertColumns = [columns.phone, columns.hash, columns.expires, columns.attempts];
      const values = ['$1', '$2', `now() + ($3::int * interval '1 second')`, '0'];
      const params = [phone, hashCode(phone, code, purpose), OTP_TTL_SECONDS];
      if (columns.purpose) {
        insertColumns.push(columns.purpose);
        values.push(`$${params.length + 1}`);
        params.push(purpose);
      }
      if (columns.maxAttempts) {
        insertColumns.push(columns.maxAttempts);
        values.push(`$${params.length + 1}`);
        params.push(OTP_MAX_ATTEMPTS);
      }
      if (columns.created) {
        insertColumns.push(columns.created);
        values.push('now()');
      }
      await client.query(
        `INSERT INTO otp_codes (${insertColumns.join(', ')})
         VALUES (${values.join(', ')})`,
        params,
      );
    });

    if (OTP_DEV_PRINT) {
      console.log(`[dev-otp] phone=${phone} purpose=${purpose} code=${code} expiresIn=${OTP_TTL_SECONDS}s`);
    }
    try {
      await sendSms(phone, code);
    } catch (error) {
      console.error('[auth] SMS send failed:', error.message);
    }

    return res.json({ ok: true, expiresIn: OTP_TTL_SECONDS });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/verify-otp', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body && req.body.phone);
    const code = String((req.body && req.body.code) || '').trim();
    const purpose = normalizePurpose(req.body && req.body.purpose, 'signup');
    if (!phone || !/^\d{6}$/.test(code) || !purpose) {
      return res.status(400).json({ ok: false, error: 'invalid phone, code or purpose' });
    }

    const columns = await otpColumns();
    const userFields = await userColumns();
    const orderColumn = columns.created || columns.id || columns.phone;

    const outcome = await withTransaction(async (client) => {
      const params = [phone];
      let sql = `SELECT * FROM otp_codes
                  WHERE ${columns.phone} = $1 AND ${columns.consumed} IS NULL`;
      if (columns.purpose) {
        params.push(purpose);
        /* NULL purpose marks a legacy signup code created before the migration. */
        sql += purpose === 'signup'
          ? ` AND (${columns.purpose} IS NULL OR ${columns.purpose} = $2)`
          : ` AND ${columns.purpose} = $2`;
      }
      const { rows } = await client.query(
        `${sql} ORDER BY ${orderColumn} DESC LIMIT 1 FOR UPDATE`,
        params,
      );
      const record = rows[0];
      if (!record) {
        return { status: 400, body: { ok: false, error: 'invalid or expired code' } };
      }

      const expiresAt = new Date(record[columns.expires]).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return { status: 400, body: { ok: false, error: 'invalid or expired code' } };
      }

      const attempts = Number.parseInt(record[columns.attempts], 10) || 0;
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return { status: 429, body: { ok: false, error: 'too many attempts' } };
      }

      const where = columns.id
        ? { sql: `${columns.id} = $1`, params: [record[columns.id]] }
        : { sql: `${columns.phone} = $1`, params: [phone] };

      if (!otpHashMatches(record, columns, phone, code, purpose)) {
        await client.query(
          `UPDATE otp_codes SET ${columns.attempts} = ${columns.attempts} + 1 WHERE ${where.sql}`,
          where.params,
        );
        return {
          status: 400,
          body: {
            ok: false,
            error: 'invalid code',
            remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts - 1),
          },
        };
      }

      await client.query(
        `UPDATE otp_codes
            SET ${columns.consumed} = now(), ${columns.attempts} = ${columns.attempts} + 1
          WHERE ${where.sql}`,
        where.params,
      );
      /* No user is created here and this is not a login token: the caller must
         exchange the purpose-bound token through complete-signup/reset-password. */
      const userRow = await findUser(columns.phone, phone, userFields, client);
      return {
        status: 200,
        body: {
          ok: true,
          token: signPurposeToken(phone, purpose),
          purpose,
          expiresIn: PURPOSE_TOKEN_TTL_SECONDS,
          user: userRow ? publicUser(userRow, userFields) : null,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/complete-signup', async (req, res, next) => {
  try {
    const payload = verifyPurposeToken(req.body && req.body.token, 'signup');
    if (!payload) {
      return res.status(400).json({ ok: false, error: 'invalid or expired signup token' });
    }
    const phone = normalizePhone(payload.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'invalid signup token' });
    }
    const passwordHash = await hashPassword(req.body && req.body.password);
    const displayName = safeDisplayName(req.body && req.body.displayName);
    const columns = await userColumns();
    assertPasswordColumn(columns);

    const outcome = await withTransaction(async (client) => {
      const existing = await findUser(columns.phone, phone, columns, client, true);
      if (existing && existing[columns.passwordHash]) {
        return { status: 409, body: { ok: false, error: 'an account with this phone already exists' } };
      }
      let user;
      if (existing) {
        await setUserPassword(client, columns, existing[columns.id], passwordHash);
        user = publicUser(existing, columns);
      } else {
        user = await upsertUser(client, phone, columns, { displayName, passwordHash });
      }
      return { status: 200, body: { token: signToken(user), user } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'an account with this phone already exists' });
    }
    return next(error);
  }
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body && req.body.phone);
    const password = req.body && req.body.password;
    const columns = await userColumns();
    assertPasswordColumn(columns);
    const row = phone ? await findUser(columns.phone, phone, columns) : null;
    const storedHash = row && row[columns.passwordHash]
      ? row[columns.passwordHash]
      : await dummyPasswordHash();
    const valid = await verifyPassword(password, storedHash);
    if (!phone || !row || !row[columns.passwordHash] || !valid) {
      return res.status(401).json({ ok: false, error: 'invalid credentials' });
    }
    const user = publicUser(row, columns);
    return res.json({ token: signToken(user), user });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const payload = verifyPurposeToken(req.body && req.body.token, 'reset');
    if (!payload) {
      return res.status(400).json({ ok: false, error: 'invalid or expired reset token' });
    }
    const phone = normalizePhone(payload.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'invalid reset token' });
    }
    const passwordHash = await hashPassword(req.body && req.body.password);
    const columns = await userColumns();
    assertPasswordColumn(columns);

    const outcome = await withTransaction(async (client) => {
      const row = await findUser(columns.phone, phone, columns, client, true);
      if (!row) {
        return { status: 400, body: { ok: false, error: 'invalid or expired reset token' } };
      }
      if (columns.passwordUpdatedAt && row[columns.passwordUpdatedAt]) {
        const changedAt = Math.floor(new Date(row[columns.passwordUpdatedAt]).getTime() / 1000);
        if (Number.isFinite(changedAt) && changedAt > payload.iat) {
          return { status: 400, body: { ok: false, error: 'invalid or expired reset token' } };
        }
      }
      await setUserPassword(client, columns, row[columns.id], passwordHash);
      const user = publicUser(row, columns);
      return { status: 200, body: { token: signToken(user), user } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    return next(error);
  }
});

router.post('/api/auth/change-password', authenticate, async (req, res, next) => {
  try {
    const body = req.body || {};
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const columns = await userColumns();
    assertPasswordColumn(columns);
    const row = await findUser(columns.id, String(req.user.id), columns);
    const storedHash = row && row[columns.passwordHash]
      ? row[columns.passwordHash]
      : await dummyPasswordHash();
    if (!row || !row[columns.passwordHash] || !(await verifyPassword(currentPassword, storedHash))) {
      return res.status(400).json({ ok: false, error: 'current password is incorrect' });
    }
    const passwordHash = await hashPassword(body.newPassword);

    await withTransaction(async (client) => {
      const fresh = await findUser(columns.id, String(req.user.id), columns, client, true);
      const freshHash = fresh && fresh[columns.passwordHash]
        ? fresh[columns.passwordHash]
        : await dummyPasswordHash();
      if (!fresh || !fresh[columns.passwordHash] || !(await verifyPassword(currentPassword, freshHash))) {
        throw httpError(400, 'current password is incorrect');
      }
      await setUserPassword(client, columns, fresh[columns.id], passwordHash);
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/admin/users', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'invalid phone number' });
    }
    const role = body.role === undefined || body.role === null || body.role === ''
      ? (ADMIN_PHONES.has(phone) ? 'admin' : 'student')
      : String(body.role).trim().toLowerCase();
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ ok: false, error: 'role must be student, advisor or admin' });
    }
    const passwordHash = await hashPassword(body.password);
    const displayName = safeDisplayName(body.displayName);
    const columns = await userColumns();
    assertPasswordColumn(columns);

    const user = await withTransaction(async (client) => {
      const existing = await findUser(columns.phone, phone, columns, client, true);
      if (existing) throw httpError(409, 'a user with this phone already exists');
      return upsertUser(client, phone, columns, { role, displayName, passwordHash });
    });
    return res.json({ user });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'a user with this phone already exists' });
    }
    return next(error);
  }
});

router.post('/api/admin/users/reset-password', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'invalid phone number' });
    }
    const passwordHash = await hashPassword(body.password);
    const columns = await userColumns();
    assertPasswordColumn(columns);

    const outcome = await withTransaction(async (client) => {
      const row = await findUser(columns.phone, phone, columns, client, true);
      if (!row) {
        return { status: 404, body: { ok: false, error: 'user not found' } };
      }
      await setUserPassword(client, columns, row[columns.id], passwordHash);
      return { status: 200, body: { ok: true } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    return next(error);
  }
});

router.get('/api/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    expiresAt: req.token && req.token.exp ? new Date(req.token.exp * 1000).toISOString() : null,
  });
});

module.exports = {
  router,
  authenticate,
  requireRole,
  normalizePhone,
  normalizePurpose,
  verifyToken,
  signToken,
  signPurposeToken,
  verifyPurposeToken,
  getUserById,
  publicUser,
  userColumns,
  findUser,
  upsertUser,
  setUserPassword,
  sendSms,
  setSmsSender,
  loadSmsProviderFromEnv,
  hashCode,
  legacyHashCode,
  isValidPassword,
  validatePassword,
  hashPassword,
  verifyPassword,
  OTP_PURPOSES,
  PURPOSE_TOKEN_TTL_SECONDS,
};
