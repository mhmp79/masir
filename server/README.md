# Masir sync backend

Node.js + Express + PostgreSQL + WebSocket backend for the Persian-calendar student app.
It implements phone/password login, purpose-bound OTP signup/reset, incremental sync,
advisor links and live change broadcasts. The browser uses `js/13-sql-api.js` as its
single transport; legacy export tooling is migration-only.

> فایل migration مربوطه در مسیر `sql/001_init.sql` (ریشهٔ مخزن) قرار میگیرد و هنگام شروع اجرا میشود.
> هنگام توسعهٔ محلی، کد OTP در کنسول چاپ میشود (`OTP_DEV_PRINT=true`).

## Install & run

```bash
cd server
npm install
cp .env.example .env      # then edit JWT_SECRET and ADMIN_PHONES
npm run migrate           # optional; start() runs migrations too
npm start                 # or: npm run dev
```

Requirements: Node.js 18+, PostgreSQL database named `masir` (see `DATABASE_URL`).
`npm start` reads `server/.env`, then falls back to a repository-root `.env`.
Safe local defaults are used when variables are missing (`PORT=4000`,
`postgres://postgres:postgres@localhost:5432/masir`), but **always set a real `JWT_SECRET`
outside local development**.

`npm run migrate` executes `../sql/001_init.sql` through `pg`, followed by the idempotent add-ons
`server/sql/002_advisor_invites.sql` (pairing invites) and `server/sql/003_password_auth.sql`
(password columns, OTP purpose and `local_order`). Checksums are recorded in `app_migrations`,
so re-running is safe. If a migration file changes, it runs again. No columns or data are dropped.

## API summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness + database check |
| POST | `/api/auth/request-otp` | none | `{phone, purpose?}` → `{ok, expiresIn}`; purpose defaults to `signup` |
| POST | `/api/auth/verify-otp` | none | `{phone, code, purpose?}` → `{ok, token, purpose, expiresIn, user?}`; consumes the code and returns a 10-minute purpose-bound token (not a login token) |
| POST | `/api/auth/complete-signup` | signup token | `{token, password, displayName?}` → `{token, user}`; 409 if the phone already has a password |
| POST | `/api/auth/login` | none | `{phone, password}` → `{token, user}`; generic invalid-credentials error |
| POST | `/api/auth/reset-password` | reset token | `{token, password}` → `{token, user}` |
| POST | `/api/auth/change-password` | bearer | `{currentPassword, newPassword}` → `{ok:true}` |
| GET | `/api/me` | bearer | Current user + token expiry |
| GET | `/api/snapshot` | bearer | `since`, `limit`, `cursor` → `{serverTime, changes, nextCursor?}` |
| POST | `/api/changes` | bearer | `{changes:[{table,id,op,data}]}` → `{applied, conflicts}` |
| POST | `/api/advisors/invite` | advisor/admin | Creates a 24-hour pairing code |
| POST | `/api/advisors/accept` | student | `{code}` approves a pending link |
| GET | `/api/advisors/links` | any | Links visible to the caller (all for admin) |
| POST | `/api/admin/advisor-links` | admin | `{advisorPhone, studentPhone}` (or `*Id`) assigns directly |
| POST | `/api/admin/users` | admin | `{phone, password, role?, displayName?}` → `{user}`; role defaults to `student` |
| POST | `/api/admin/users/reset-password` | admin | `{phone, password}` → `{ok:true}`; existing users only |
| WS | `/api/ws?token=<bearer>` | bearer | Live events `{type:'change', table, id, op, updated, data}` |

`op` accepts `upsert` (also `put`/`update`/`restore`) or `delete` (also `remove`/`soft_delete`).
Deletes are soft (`deleted = true`). When `data.updated` (or `change.expectedUpdated`) is supplied,
a mismatch with the stored timestamp yields a conflict instead of an overwrite. Page size is
capped at 1000 rows; `nextCursor` is opaque base64url.

Phones are normalized to Iranian E.164 (`+989xxxxxxxxxx`). Admins come from the comma-separated
`ADMIN_PHONES` list; they are created with the `admin` role on first successful login.

## WebSocket notes

The connection authenticates with the same signed token during the HTTP upgrade. A `ready`
message is sent on connect; clients may send `{type:'ping'}` or `{type:'subscribe'}`.
The server pings every 30 seconds and terminates unresponsive sockets. Broadcasts go to the row
owner and every advisor with an approved link to that student, so reconnecting clients can simply
resume from their last `since`/cursor.

## Expected SQL schema contract

`server/src/db.js` uses PostgreSQL introspection (`information_schema.columns`) so code only
touches columns that actually exist; identifiers are never interpolated from user input.
The migration should provide:

- `users`: `id` PK, `phone` UNIQUE, `role`, `display_name`, `password_hash`
  (`scrypt$salt$hash`, nullable for legacy OTP-only accounts), `password_updated_at`.
- `otp_codes`: `id`, `phone`, `purpose` (`signup`/`reset`, default `signup`), `code_hash`,
  `expires_at`, `attempts`, `consumed_at`, `created_at`
  (`max_attempts` is optional; the server uses `OTP_MAX_ATTEMPTS` when it is absent).
- `advisor_links`: `id`, `advisor_id`, `student_id`, `status`, `permissions`, `created_at` from
  the root migration; `server/sql/002_advisor_invites.sql` adds `code`, `approved_at`, `updated`
  and makes `student_id` nullable while an invite is pending. UNIQUE (`advisor_id`, `student_id`).
- Typed tables `subjects`, `sessions`, `activities`, `classes`, `sleeps`, `phones`, `exams`,
  `questions`, `app_meta`, `tracker`, `timer`: each with `owner_id`, `local_id` (except
  `tracker`/`timer`, keyed by `owner_id`), `updated timestamptz`, `deleted boolean`, typed columns,
  UNIQUE (`owner_id`, `local_id`) for non-singleton tables. The nine non-singleton tables also
  carry `local_order int` (browser `order` → `localOrder` → `local_order`), so a first snapshot
  preserves the user's ordering. Notable typed columns:
  - `questions`: `exam_id`, `number`, `subject`, `topic`, `status`, `note`, `question_text`,
    `answer_text`, `options jsonb`, `tags jsonb`, `starred`, `figure_ref`, `note_hidden`, `ts`.
  - `exams`: `name`, `date`, `has_results`, `total_taraz`, `subjects jsonb`.
  - `sessions`: `subject`, `topic`, `dur_min`, `date`, `start_min`, `done`, `done_at`,
    `activity_id`, `exam_id`, `ts`.
- `changes`: `table_name`, `row_id`, `op`, `owner_id`, `updated`, `data jsonb`.
- `app_migrations`: created automatically by `db.migrate()`.

`to_jsonb(t)` is used for snapshot payloads, so any extra typed columns are returned as-is.
Incoming camelCase keys (`questionText`, `hasResults`, `durMin`, …) are mapped to snake_case and
silently ignored if the column is not in the table.

## OTP / SMS

`OTP_TTL_SECONDS` (default 300), `OTP_MAX_ATTEMPTS` (5) and a 30-second request cooldown limit
abuse. Failed verifications increment `attempts`; a successful verification consumes the code.
The stored value is `SHA-256(JWT_SECRET:otp:<purpose>:phone:code)`, never the raw code. Signup and
reset purposes are separate scopes, so a signup code cannot reset a password (and vice versa).
Legacy purpose-less hashes are still accepted for signup only. `verify-otp` consumes the code and
returns a purpose-bound JWT (`purpose`, `phone`, `jti`, 10-minute `exp`) that cannot call `/api/me`
or any other authenticated endpoint.

With `OTP_DEV_PRINT=true` the code is printed to the console and **no SMS is sent**. Inject a real
provider in code with `setSmsSender(async (phone, code) => { ... })` from `src/auth.js`, or set
`SMS_PROVIDER_MODULE` to a module path (relative to `server/`) exporting `sendSms(phone, code)`.
The `SMTP_*` values in `.env.example` are placeholders for that provider; Express itself does not
send mail. SMS failures are logged and do not leak whether a phone is registered.

## Phone / password auth

- Passwords are at least 8 characters, hashed with salted `scrypt` as
  `scrypt$salt$hash` and verified with `crypto.timingSafeEqual`. A missing user
  still runs a dummy hash check so login timing is uniform.
- `POST /api/auth/login` is the normal sign-in. OTP is only for signup and reset;
  `verify-otp` never creates a user or returns a login token.
- `complete-signup` converts a signup token into a login token, creating the user
  or claiming a legacy OTP-only account (NULL `password_hash`). If a password
  already exists it returns 409 and never overwrites it.
- `reset-password` accepts a reset token, updates the hash and returns a fresh
  login token. `change-password` checks `currentPassword` before applying the new
  one. `password_updated_at` also invalidates older reset tokens (one-use by
  account state; the JWT `jti` is audit-only).
- Admin-only `POST /api/admin/users` creates users (roles `student`, `advisor`,
  `admin`; duplicates return 409) and `POST /api/admin/users/reset-password`
  updates an existing user. `ADMIN_PHONES` still grants admin on creation/first
  login. `publicUser` and `/api/me` never expose `password_hash`.

## Security notes

- Change `JWT_SECRET`. Login tokens are HMAC-SHA256 signed (`sub`, `role`, `iat`, `exp`) and
  verified with a timing-safe comparison; `JWT_TTL_SECONDS` defaults to 7 days. Purpose tokens
  carry `typ: 'purpose'` and are rejected by `authenticate`; `PURPOSE_TOKEN_TTL_SECONDS` defaults
  to 600 seconds.
- Set `WEB_ORIGIN` to your real origin(s), comma-separated. `*` is development-only.
- Table names come from a static allow-list, column names from introspected schema, and every
  value is passed as a bound parameter.
- Authorization is enforced per row: the owner or an advisor with an **approved** link may
  read/write. Unknown or forbidden rows become conflicts, not errors.
- Use TLS (`DB_SSL=true`) and a reverse proxy with HTTPS in production; rate limiting, audit log
  retention and SMS provider credentials should be hardened before going live.
