# SQL Migration Plan (typed PostgreSQL backend)

> **Status: groundwork only.** `js/13-sql-api.js` and `tests/sql-api.test.js` are
> preparation for the migration. The live app still uses PocketBase, `index.html`
> does not load the new script, and no running behaviour has been rewired. No
> cutover step below has been performed yet.

## Confirmed decisions

| Area | Decision |
| --- | --- |
| Storage | Typed PostgreSQL tables, one per normalized store. No generic JSON collection. |
| Login | Phone number + SMS OTP. Verify returns a bearer token; the adapter never writes it to browser storage. |
| Advisor access | Advisor can read **and** write a linked student's data after the student approves the link, or after an admin assigns the student. |
| Change feed | WebSocket `/api/ws` pushes row-level hints. Hints are not the source of truth; a full snapshot is the fallback. |
| Sync UI | No visible sync buttons, progress toggle or manual "sync now" control after cutover. Reconnect repairs automatically. |
| Data import | Export PocketBase collections, transform into typed rows, import into PostgreSQL, verify legacy id mapping. |
| Tracker + timer | Move out of legacy globals into the `tracker` and `timer` IndexedDB stores. The penalty coefficient stays fixed at `1/3`. |
| Offline-first | Preserved: local IndexedDB remains authoritative for editing; the server is a sync target, not a runtime dependency. |
| Release hygiene | Rebuild the browser bundle and bump the service-worker cache key on **every** source change. |

## Typed tables and local stores

`SQL_TABLES` in `js/13-sql-api.js` is the contract. Conversion is field-by-field;
unknown legacy fields are dropped.

| PostgreSQL table | Local IndexedDB store | Typed fields |
| --- | --- | --- |
| `subjects` | `subjects` | `name, color, type, field, config` |
| `sessions` | `sessions` | `subject, topic, dur_min, date, start_min, done, done_at, activity_id, exam_id, ts` |
| `activities` | `activities` | `subject, topic, minutes, date, start_min, end_min, note` |
| `classes` | `classes` | `subject, total, sessions` |
| `sleeps` | `sleeps` | `date, end_date, start_min, end_min, nap` |
| `phones` | `phones` | `date, start_min, end_min, subject, note` |
| `exams` | `exams` | `name, date, has_results, total_taraz, subjects, questions_count` |
| `questions` | `questions` | `exam_id, number, subject, topic, status, note, question_text, answer_text, options, tags, starred, figure_ref, note_hidden, ts` |
| `app_meta` | `app-meta` | `value` |
| `tracker` | `tracker` | `correct, wrong, blank, coef` (coef forced to `1/3`) |
| `timer` | `timer` | `running, started_at, elapsed_ms, mode` |

`localStoreForTable()` / `tableForLocalStore()` are the only mapping functions to
use. `toTypedRow(store, record)` and `fromTypedRow(table, row)` handle camelCase
↔ snake_case, questions' `note` / `questionText` / `answerText`, and the fixed
tracker coefficient. Envelope fields `id` and `updated` pass through both ways.

## API contract

Base URL is configured by the caller; the adapter appends these paths. Every
request carries `Content-Type: application/json`, `Accept: application/json`
and `Authorization: Bearer <token from getToken()>` (OTP endpoints may carry an
empty bearer before login). Requests have an `AbortController` timeout (15 s by
default) and plain English, locale-safe error messages such as
`Not signed in (HTTP 401). Sign in again to continue.`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `requestOtp(phone)` | `POST /api/auth/request-otp` | Send SMS code |
| `verifyOtp(phone, code)` | `POST /api/auth/verify-otp` | Exchange code for token (returned to caller, never stored here) |
| `me()` | `GET /api/me` | Current account, role and link status |
| `snapshot({since, limit})` | `GET /api/snapshot?since=…&limit=…` | Full or incremental pull |
| `sendChanges(changes)` | `POST /api/changes` | Batched upserts/deletes with optimistic `updated` |
| `inviteAdvisor()` | `POST /api/advisors/invite` | Create an invite code |
| `acceptAdvisor(code)` | `POST /api/advisors/accept` | Student approves an advisor link |
| `advisorLinks()` | `GET /api/advisors/links` | List links pending/approved |
| `assignStudent(phone)` | `POST /api/admin/advisor-links` | Admin assignment (bypasses student approval) |
| *(transport)* | `WS /api/ws?token=…` | Row change hints: `{table, id, op, updated, data}` |
| *(diagnostic)* | `GET /api/health` | Deployment liveness/readiness check |

Change envelope sent to `/api/changes`:

```json
{ "changes": [
  { "table": "questions", "id": "e1::q1", "op": "upsert",
    "updated": "2026-01-02T10:00:00.000Z", "data": { "note": "نکته", "question_text": "…" } }
] }
```

`op` is `upsert` or `delete`. `updated` is supplied by the client (optimistic
concurrency): the server rejects a stale write so the pending queue keeps it for
a retry. `MasirSqlClient.connect()` emits normalized events through `onEvent`;
`disconnect()` stops all reconnect attempts. Reconnect uses exponential backoff
(500 ms → 30 s cap).

## Sync algorithm (target design after cutover)

1. **Local source of truth.** All study data lives in IndexedDB normalized
   stores; every local edit also appends a pending mutation to a durable queue.
2. **Upload first (steady state).** Send queued changes with their optimistic
   `updated` timestamps. Acknowledge only successful mutations; keep failed ones
   queued. Field-level changes merge onto the server row so another device's
   edits are not overwritten.
3. **Pull after upload.** GET `/api/snapshot?since=<cursor>&limit=<page>`. Apply
   rows in `updated` order, advance the cursor only after a batch is committed,
   and page until the server reports no more changes (including tombstones).
4. **Pending-edit guards.** Never overwrite a local record whose fields are
   still pending in the queue; remember the server version and re-apply the
   local edit on top. Question `note`, `questionText` and `answerText` must
   survive a store rebuild. Remote tracker `coef` is ignored in favour of `1/3`.
5. **First sync is always download-first.** A fresh device or a new account must
   never seed the server from empty or previous-account local data. Download the
   account, then upload only what the user edits afterwards.
6. **Account switch resets to clean defaults.** When `me()` reports a different
   account, replace tracked state with clean defaults, clear the pending queue
   and cursor, then download first. Never carry the old account's data over.
7. **WebSocket hints are hints.** On an event, fetch/apply just that table+id if
   it is not in the pending queue; on any doubt (unknown row, version gap,
   dropped socket, conflict, or repeated failure) fall back to a full snapshot.
8. **Automatic repair, no UI.** There will be no sync button or toggle. Startup,
   tab focus, `online` and WebSocket reconnection trigger the same background
   repair loop. Transient errors stay silent; persistent errors surface as a
   short toast with a plain-English explanation.

## Cutover plan

1. Freeze the server schema and generate migrations for the typed tables;
   deploy `/api/health` and verify it from the deployment URL.
2. Configure SMS provider, JWT secret and admin phone allowlist; test OTP,
   advisor approval and admin assignment end to end.
3. Export all PocketBase collections (including `questions`, `settings`,
   `plan`, `reserved`) to a versioned backup before any import.
4. Run the export/import transform with `toTypedRow()` field rules; record a
   legacy `localId → typed id` map and verify it against real records, especially
   `e1::qN` question ids and `app-meta` canonical ids.
5. Move tracker and timer state into their IndexedDB stores; verify the fixed
   `1/3` coefficient and that old persisted custom coefficients are ignored.
6. Wire the adapter behind a single integration module: auth, snapshot, pending
   queue, WebSocket hints and first-sync download-first. Keep PocketBase code
   untouched until this step is verified.
7. Remove manual sync controls/toggles and enable automatic reconnect repair.
   Preserve offline-first behaviour and backup/restore flows.
8. Rebuild the browser bundle, bump the service-worker cache key and app version
   together, and run the full test suite (`node tests/sql-api.test.js` and the
   existing tests).
9. Roll out to one account first: compare a full snapshot against the exported
   PocketBase data, check advisor access, then expand.
10. Only after a clean verification window, stop PocketBase writes and archive
    the instance. Keep the export for rollback.

## Risks / open items

- **SMS provider** — not selected; delivery, rate limits and OTP expiry are unconfirmed.
- **Deployment URL** — final HTTPS origin not fixed; must be configured before bundle build.
- **JWT secret** — rotation/expiry policy and token lifetime need an owner.
- **Admin phone list** — source of truth for `assignStudent()` is not defined yet.
- **Legacy id mapping** — PocketBase `localId` values, question composite ids and
  `app-meta` canonical ids need a checked migration map; a mismatch can duplicate or drop rows.
- **Backup restore across backends** — old PocketBase backups cannot be restored into
  PostgreSQL directly; the import transform must be part of the restore procedure.
- **Version/cache bump** — service-worker cache key and app version must be bumped
  with every source change, or returning users will keep the PocketBase bundle.

## Test

```bash
node tests/sql-api.test.js   # prints ALL PASSED / FAILED
```

The suite checks mapping completeness/uniqueness, converter fidelity (question
note/text and fixed `1/3` coef), absence of browser storage calls, Bearer/OTP/
snapshot/changes requests, and WebSocket reconnect/backoff code.
