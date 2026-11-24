# PocketBase → PostgreSQL import (Masir Konkor)

`import_pocketbase.py` converts a legacy PocketBase JSON export into typed,
idempotent PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` statements for the
schema in [`../sql/001_init.sql`](../sql/001_init.sql).

* Python 3 standard library only — no `pip install` needed.
* It never connects to a database, never drops tables, and never deletes rows.
* Re-running the generated SQL is safe: rows are matched by their conflict key.

## 1. Export the data from PocketBase admin

1. Sign in to the admin UI at `https://YOUR-SERVER/_/` with a **superuser**
   (panel admin) account.
2. Go to **Settings → Export data** (in newer builds: **Settings → Export →
   Collections/Data → JSON**) and download the JSON export.
3. Unpack the download into a local directory, for example `./pb_export`.
   The importer accepts:
   * a directory of `<collection>.json` files (one array of records per file),
   * a `pb_data.json` / `pb_export.json` file with `{"collections": {...}}`
     or a plain `{"subjects": [...], "exams": [...], ...}` object,
   * a single JSON file passed directly to `--input`.
4. Keep schema-only files such as `pb_collections.json` and
   `pb_collections_panel.json` in the same directory if you want — they are
   recognized as collection definitions and ignored (they contain no records).

If your PocketBase version has no JSON data export in the panel, fetch each
collection with a superuser token and save the `items` arrays as
`<collection>.json`:

```bash
TOKEN=$(curl -s -X POST "$URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d '{"identity":"ADMIN_EMAIL","password":"ADMIN_PASSWORD"}' | jq -r .token)

for C in settings subjects activities classes sessions sleeps phones exams questions plan reserved; do
  curl -s -H "Authorization: $TOKEN" "$URL/api/collections/$C/records?perPage=500" \
    > "pb_export/$C.json"
done
```

(PocketBase paginates at 500 records; use `page=2`, `page=3`, … and combine the
`items` arrays if a collection is larger.)

## 2. Install the PostgreSQL schema

```bash
psql "$DATABASE_URL" -f sql/001_init.sql
```

This creates `pgcrypto`, the identity tables, the typed app tables, indexes,
and the `masir_touch_updated()` triggers. RLS is deliberately **not** enabled:
the app server enforces advisor permissions using `advisor_links`.

## 3. Run the importer

```bash
python scripts/import_pocketbase.py --input ./pb_export \
  --phone 09123456789 \
  --advisor-phone 09129998888 \
  --name "Student Name" \
  --output import.sql

psql "$DATABASE_URL" -f import.sql
```

Without `--output`, SQL is written to stdout (UTF-8), so it can be piped:

```bash
python scripts/import_pocketbase.py --input ./pb_export --phone 09123456789 \
  | psql "$DATABASE_URL"
```

### Options

| Option | Meaning |
| --- | --- |
| `--input DIR` | Required. Export directory or a single JSON file. |
| `--phone PHONE` | Required. Student phone: `09123456789`, `989123456789`, or `+989123456789`. Normalized to `+989...`. |
| `--advisor-phone PHONE` | Optional. Creates an advisor user and an **approved** `advisor_links` row. |
| `--email EMAIL` | Optional identity seed for the student `users.id`. Without it the normalized phone is used. |
| `--name NAME` | Optional student display name (otherwise read from exported settings/profile). |
| `--advisor-name NAME` | Optional advisor display name. |
| `--output FILE` | Optional. Write SQL to a file instead of stdout. |

Invalid phone numbers fail immediately with a clear error message.

## 4. How records are mapped

| PocketBase collection | PostgreSQL table | Notes |
| --- | --- | --- |
| `settings` | `app_meta` | Written as `local_id = 'main'`. |
| `settings` record `localId = 'tracker'` | `tracker` | `value.counts` → correct/wrong/blank, `value.coef` → coef. |
| `timer` (if present) | `timer` | One row per owner. |
| `subjects`, `activities`, `classes`, `sessions`, `sleeps`, `phones` | same names | `record.value` fields are mapped to typed columns; unknown fields stay in `config`/`sessions` JSON where applicable. |
| `exams` | `exams` | Embedded `value.questions` are stripped out; `questions_count` is set from them. |
| `questions` | `questions` | `examId` is resolved to `exams.local_id`; local ids like `e1::q1` become `q1`. |
| `plan`, `reserved` | `sessions` | Legacy rows get a `plan:` / `reserved:` local-id prefix and `start_min = NULL`. |

Identifiers:

```
users.id = uuid5(3f8d1c62-92a4-4d17-b3e0-7c1a6f5b9e42,
                 'masir:student:' + (--email or normalized --phone))
```

The same seed always yields the same UUID, so an existing student can be
updated instead of duplicated. PocketBase `owner` ids are intentionally not
used; all imported rows belong to the student identified by `--phone`.

`updated` timestamps are carried over from PocketBase when parseable; on every
later `UPDATE` the `masir_touch_updated()` trigger replaces them with server
time.

## Troubleshooting

* **"no .json files found"** — point `--input` at the unpacked export folder,
  not the ZIP file.
* **"cannot read ..."** — the JSON file is truncated or not valid UTF-8;
  re-download the export.
* **"invalid --phone"** — use an Iranian mobile number; the importer accepts
  leading `0`, `98`, `+98`, or `0098` but requires exactly 10 mobile digits.
* **A row disappears after re-import** — check the header "Row counts" comment
  in the generated SQL; rows with the same `(owner_id, local_id)` are
  deduplicated, with later export records winning.
