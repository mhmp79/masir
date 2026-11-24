# Masir sync backend (scaffold)

Node.js + Express + PostgreSQL + WebSocket backend for the Persian-calendar student app.
This is groundwork: it implements phone/OTP login, incremental sync, advisor links and live
change broadcasts. No browser code is touched.

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

`npm run migrate` executes `../sql/001_init.sql` (the root migration created separately) through
`pg`, followed by the idempotent `server/sql/002_advisor_invites.sql` add-on that makes pairing-code
invites possible. Checksums are recorded in `app_migrations`, so re-running is safe. If a migration
file changes, it runs again.

## API summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness + database check |
| POST | `/api/auth/request-otp` | none | `{phone}` → `{ok, expiresIn}`; stores SHA-256 hash of a 6-digit code |
| POST | `/api/auth/verify-otp` | none | `{phone, code}` → `{token, user}` |
| GET | `/api/me` | bearer | Current user + token expiry |
| GET | `/api/snapshot` | bearer | `since`, `limit`, `cursor` → `{serverTime, changes, nextCursor?}` |
| POST | `/api/changes` | bearer | `{changes:[{table,id,op,data}]}` → `{applied, conflicts}` |
| POST | `/api/advisors/invite` | advisor/admin | Creates a 24-hour pairing code |
| POST | `/api/advisors/accept` | student | `{code}` approves a pending link |
| GET | `/api/advisors/links` | any | Links visible to the caller (all for admin) |
| POST | `/api/admin/advisor-links` | admin | `{advisorPhone, studentPhone}` (or `*Id`) assigns directly |
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

- `users`: `id` PK, `phone` UNIQUE, `role`, `display_name`.
- `otp_codes`: `id`, `phone`, `code_hash`, `expires_at`, `attempts`, `consumed_at`, `created_at`
  (`max_attempts` is optional; the server uses `OTP_MAX_ATTEMPTS` when it is absent).
- `advisor_links`: `id`, `advisor_id`, `student_id`, `status`, `permissions`, `created_at` from
  the root migration; `server/sql/002_advisor_invites.sql` adds `code`, `approved_at`, `updated`
  and makes `student_id` nullable while an invite is pending. UNIQUE (`advisor_id`, `student_id`).
- Typed tables `subjects`, `sessions`, `activities`, `classes`, `sleeps`, `phones`, `exams`,
  `questions`, `app_meta`, `tracker`, `timer`: each with `owner_id`, `local_id` (except
  `tracker`/`timer`, keyed by `owner_id`), `updated timestamptz`, `deleted boolean`, typed columns,
  UNIQUE (`owner_id`, `local_id`) for non-singleton tables. Notable typed columns:
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
The stored value is `SHA-256(JWT_SECRET:otp:phone:code)`, never the raw code.

With `OTP_DEV_PRINT=true` the code is printed to the console and **no SMS is sent**. Inject a real
provider in code with `setSmsSender(async (phone, code) => { ... })` from `src/auth.js`, or set
`SMS_PROVIDER_MODULE` to a module path (relative to `server/`) exporting `sendSms(phone, code)`.
The `SMTP_*` values in `.env.example` are placeholders for that provider; Express itself does not
send mail. SMS failures are logged and do not leak whether a phone is registered.

## Security notes

- Change `JWT_SECRET`. Tokens are HMAC-SHA256 signed (`sub`, `role`, `iat`, `exp`), verified with
  a timing-safe comparison; `JWT_TTL_SECONDS` defaults to 7 days.
- Set `WEB_ORIGIN` to your real origin(s), comma-separated. `*` is development-only.
- Table names come from a static allow-list, column names from introspected schema, and every
  value is passed as a bound parameter.
- Authorization is enforced per row: the owner or an advisor with an **approved** link may
  read/write. Unknown or forbidden rows become conflicts, not errors.
- Use TLS (`DB_SSL=true`) and a reverse proxy with HTTPS in production; rate limiting, audit log
  retention and SMS provider credentials should be hardened before going live.
