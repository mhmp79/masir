# Masir PocketBase backend (recommended migration path)

This folder provides a **PocketBase-based backend** that keeps the existing app contract (`/api/auth/*`, `/api/me`, `/api/snapshot`, `/api/changes`, advisor/admin routes) through PocketBase JS hooks.

It is designed so the current frontend transport (`js/13-sql-api.js`, `js/12-sql-sync.js`) can point to PocketBase with minimal changes.

## What this includes

- `pb_migrations/*.js` - creates/updates collections and fields needed by Masir.
- `pb_hooks/main.pb.js` - implements the Masir API contract on top of PocketBase collections.
- Uses PocketBase as datastore/admin UI; keeps Masir sync semantics (owner_id/local_id, tombstones, LWW by `clientUpdated`, snapshot cursor).

## What you need to do on server

1. **Install PocketBase** (v0.22+ recommended; hooks written with JSVM `routerAdd`/`$app` style).
2. Copy this `pocketbase/` folder to your server.
3. Run PocketBase once with this directory so migrations apply:
   ```bash
   ./pocketbase serve --dir ./pocketbase/pb_data --hooksDir ./pocketbase/pb_hooks --migrationsDir ./pocketbase/pb_migrations --http=0.0.0.0:8090
   ```
4. Create the first admin in PocketBase Admin UI (`/_/`) if prompted.
5. Set env vars before running PocketBase:
   - `MASIR_JWT_SECRET` - **required in production**; JWT secret for app tokens.
   - `MASIR_OTP_DEV_PRINT=true` - dev only; prints OTP in PocketBase logs.
   - `MASIR_ADMIN_PHONES=0912...,` - optional admin phones.
   - `MASIR_WEB_ORIGIN=https://www.masir.ir` - CORS allow origin(s), comma-separated, or `*`.
6. Point the app to PocketBase URL:
   - set `window.MASIR_SQL_API_URL = "https://your-domain"` before app scripts, or save in app settings/localStorage key `konkur-sql-api-url-v1`.
   - The client calls `/api/...` on that base URL; PocketBase hooks serve these paths.

## Important compatibility notes

- **Realtime WS `/api/ws`**: PocketBase custom JS hooks cannot reliably expose the same raw WebSocket upgrade endpoint as the old Node server. The included hook returns a clear 501 for `/api/ws`. The app still works through snapshot/changes polling/auto-sync; for live push, use PocketBase realtime adaptation as a next step.
- **SMS OTP**: `request-otp` supports dev-print mode. Connect a real SMS provider by editing `sendSms` in `pb_hooks/main.pb.js`.
- **Auth tokens**: hooks issue Masir JWTs compatible with the existing client storage (`token` field). They are not PocketBase auth collection tokens.
- **Data model**: synced rows are stored in PocketBase collections with `owner`, `local_id`, typed columns, `data` JSON fallback, `updated`, `deleted`. This keeps sync semantics explicit.
- **Migration/import**: no destructive import is performed. Existing PocketBase data is untouched unless you call API endpoints. If you have old PocketBase data in previous schema, export it first and import through a controlled script/mapping.

## Collections created by migrations

- `masir_users` - app users (phone, password_hash, role, profile).
- `masir_otp_codes` - OTP hashes/purpose/expiry.
- `masir_advisor_links` - advisor-student links.
- `masir_changes` - change feed for snapshot/cursor.
- Synced data collections: `masir_subjects`, `masir_sessions`, `masir_activities`, `masir_classes`, `masir_sleeps`, `masir_phones`, `masir_exams`, `masir_questions`, `masir_app_meta`, `masir_tracker`, `masir_timer`.

## Security checklist before production

- Set strong `MASIR_JWT_SECRET`.
- Disable `MASIR_OTP_DEV_PRINT`.
- Configure real SMS sender.
- Restrict `MASIR_WEB_ORIGIN`.
- Put PocketBase behind HTTPS reverse proxy.
- Back up `pb_data` regularly.
