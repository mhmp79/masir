'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const {
  query,
  withTransaction,
  columnFor,
  requireColumn,
} = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_TTL_SECONDS = positiveInt(process.env.JWT_TTL_SECONDS, 7 * 24 * 3600);
const OTP_TTL_SECONDS = positiveInt(process.env.OTP_TTL_SECONDS, 300);
const OTP_MAX_ATTEMPTS = positiveInt(process.env.OTP_MAX_ATTEMPTS, 5);
const OTP_COOLDOWN_SECONDS = positiveInt(process.env.OTP_REQUEST_COOLDOWN_SECONDS, 30);
const OTP_DEV_PRINT = /^(1|true|yes|on)$/i.test(process.env.OTP_DEV_PRINT || 'false');
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

/** Accept the common Iranian spellings and return +98xxxxxxxxxx. */
function normalizePhone(input) {
  let phone = String(input == null ? '' : input).trim();
  phone = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+');
  if (/^98\d{10}$/.test(phone)) phone = `+${phone}`;
  if (/^0?9\d{9}$/.test(phone)) phone = `+98${phone.replace(/^0/, '')}`;
  return /^\+989\d{9}$/.test(phone) ? phone : null;
}

function hashCode(phone, code) {
  return crypto
    .createHash('sha256')
    .update(`${JWT_SECRET}:otp:${phone}:${code}`)
    .digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: String(user.id),
      role: user.role,
      iat: now,
      exp: now + JWT_TTL_SECONDS,
    }),
  );
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
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

async function userColumns() {
  return {
    id: await requireColumn('users', ['id'], 'id'),
    phone: await requireColumn('users', ['phone'], 'phone'),
    role: await requireColumn('users', ['role'], 'role'),
    displayName: await columnFor('users', ['display_name', 'displayName']),
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

async function getUserById(id) {
  if (!id) return null;
  const columns = await userColumns();
  const fields = [columns.id, columns.phone, columns.role];
  if (columns.displayName) fields.push(columns.displayName);
  const { rows } = await query(
    `SELECT ${fields.join(', ')} FROM users WHERE ${columns.id} = $1 LIMIT 1`,
    [String(id)],
  );
  return rows.length ? publicUser(rows[0], columns) : null;
}

async function upsertUser(client, phone, columns) {
  const role = ADMIN_PHONES.has(phone) ? 'admin' : 'student';
  const insertColumns = [columns.phone, columns.role];
  const placeholders = ['$1', '$2'];
  const params = [phone, role];
  if (columns.displayName) {
    insertColumns.push(columns.displayName);
    placeholders.push('$3');
    params.push('');
  }
  const fields = [columns.id, columns.phone, columns.role];
  if (columns.displayName) fields.push(columns.displayName);

  const { rows } = await client.query(
    `INSERT INTO users (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (${columns.phone}) DO UPDATE SET ${columns.phone} = EXCLUDED.${columns.phone}
     RETURNING ${fields.join(', ')}`,
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
  };
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
  if (!payload) {
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
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'invalid phone number' });
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
      const params = [phone, hashCode(phone, code), OTP_TTL_SECONDS];
      if (columns.maxAttempts) {
        insertColumns.push(columns.maxAttempts);
        values.push('$4');
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
      console.log(`[dev-otp] phone=${phone} code=${code} expiresIn=${OTP_TTL_SECONDS}s`);
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
    if (!phone || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'invalid phone or code' });
    }

    const columns = await otpColumns();
    const userFields = await userColumns();
    const orderColumn = columns.created || columns.id || columns.phone;

    const outcome = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM otp_codes
          WHERE ${columns.phone} = $1 AND ${columns.consumed} IS NULL
          ORDER BY ${orderColumn} DESC
          LIMIT 1
          FOR UPDATE`,
        [phone],
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

      if (hashCode(phone, code) !== record[columns.hash]) {
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
      const user = await upsertUser(client, phone, userFields);
      return { status: 200, body: { token: signToken(user), user } };
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
  verifyToken,
  signToken,
  getUserById,
  sendSms,
  setSmsSender,
  loadSmsProviderFromEnv,
  hashCode,
};
