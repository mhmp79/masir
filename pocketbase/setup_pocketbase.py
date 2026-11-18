#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Provision PocketBase collections for the Konkur app (safe, non-destructive).

Works on PocketBase 0.23+ including 0.40.x.
- Creates the 11 app collections if they are missing.
- Keeps all existing collections and records untouched (nothing is deleted).
- Adds missing fields (order, examId, ...) and fixes the owner relation.
- Applies the per-user access rules and the unique (localId, owner) index.

Usage:
    python setup_pocketbase.py --url https://masir-69623a.dockhold.app --email admin@example.com
    (the password is asked interactively)

    python setup_pocketbase.py --url ... --email ... --password ...   # non-interactive
    python setup_pocketbase.py --url ... --email ... --dry-run        # only show changes

Only the Python standard library is used.
"""

import argparse
import getpass
import json
import random
import string
import sys
import urllib.error
import urllib.request

# ----------------------------------------------------------------------------
# Schema definition (keep in sync with pb_collections.json / js/12-pocketbase.js)
# ----------------------------------------------------------------------------

COLLECTIONS = [
    ("settings", ["owner", "localId", "value"]),
    ("subjects", ["owner", "localId", "value", "order"]),
    ("activities", ["owner", "localId", "value", "order"]),
    ("classes", ["owner", "localId", "value", "order"]),
    ("sessions", ["owner", "localId", "value", "order"]),
    ("sleeps", ["owner", "localId", "value", "order"]),
    ("phones", ["owner", "localId", "value", "order"]),
    ("exams", ["owner", "localId", "value", "order"]),
    ("questions", ["owner", "localId", "value", "order", "examId"]),
    ("plan", ["owner", "localId", "value", "order"]),
    ("reserved", ["owner", "localId", "value", "order"]),
]

# This field pair drives incremental sync (server change timestamps).
TIMESTAMP_FIELDS = ["created", "updated"]

RULES = {
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id",
    "createRule": '@request.auth.id != "" && owner = @request.auth.id',
    "updateRule": "owner = @request.auth.id",
    "deleteRule": "owner = @request.auth.id",
}


# ----------------------------------------------------------------------------
# HTTP helpers
# ----------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, status, payload):
        self.status = status
        self.payload = payload
        super().__init__(describe_error(payload))


def describe_error(payload):
    if isinstance(payload, dict):
        message = payload.get("message") or "unknown error"
        data = payload.get("data")
        if isinstance(data, dict) and data:
            details = []
            for key, value in data.items():
                if isinstance(value, dict) and value.get("message"):
                    details.append(f"{key}: {value['message']}")
                elif isinstance(value, str):
                    details.append(f"{key}: {value}")
            if details:
                message += " (" + "; ".join(details) + ")"
        return message
    return str(payload)


def api(method, base_url, path, token=None, data=None, timeout=30):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(base_url + path, data=body, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            payload = json.loads(raw)
        except ValueError:
            payload = raw
        raise ApiError(error.code, payload)
    except urllib.error.URLError as error:
        raise ApiError(0, f"cannot reach server: {error.reason}")


# ----------------------------------------------------------------------------
# Field helpers
# ----------------------------------------------------------------------------

def new_field_id(prefix, used):
    while True:
        candidate = prefix + "".join(random.choice(string.digits) for _ in range(10))
        if candidate not in used:
            used.add(candidate)
            return candidate


def expected_field_type(name):
    if name in TIMESTAMP_FIELDS:
        return "autodate"
    if name == "owner":
        return "relation"
    if name == "value":
        return "json"
    if name == "order":
        return "number"
    return "text"


def make_field(name, users_id, used):
    if name in TIMESTAMP_FIELDS:
        return {
            "id": new_field_id("autodate", used),
            "name": name,
            "type": "autodate",
            "system": False,
            "presentable": False,
            "hidden": False,
            "onCreate": True,
            "onUpdate": name == "updated",
        }
    field = {
        "id": new_field_id(expected_field_type(name)[:4] if name != "owner" else "relation", used),
        "name": name,
        "type": expected_field_type(name),
        "system": False,
        "presentable": False,
        "hidden": False,
        "required": False,
        "help": "",
    }
    if name == "owner":
        field.update({
            "collectionId": users_id,
            "cascadeDelete": False,
            "minSelect": 0,
            "maxSelect": 1,
        })
    elif name == "value":
        field["maxSize"] = 0
    return field


def ensure_fields(collection, names, users_id):
    """Return (fields, changed) with every required field present and owner fixed."""
    fields = [dict(field) for field in collection.get("fields", [])]
    used = {field.get("id") for field in fields if field.get("id")}
    changed = False
    for name in names:
        existing = next((field for field in fields if field.get("name") == name), None)
        expected = expected_field_type(name)
        if existing is None:
            fields.append(make_field(name, users_id, used))
            changed = True
            continue
        if existing.get("type") != expected:
            raise SystemExit(
                f'Collection "{collection["name"]}" already has field "{name}" '
                f'with type "{existing.get("type")}" but "{expected}" is required. '
                "Rename or remove that field in the PocketBase admin and run the script again."
            )
        if name == "owner" and existing.get("collectionId") != users_id:
            existing["collectionId"] = users_id
            changed = True
    return fields, changed


def ensure_indexes(collection, name):
    """Unique index on (localId, owner); returns (indexes, changed)."""
    indexes = list(collection.get("indexes") or [])
    has_unique = any(
        "unique" in entry.lower()
        and "localid" in entry.lower()
        and "owner" in entry.lower()
        for entry in indexes
    )
    if has_unique:
        return indexes, False
    indexes.append(
        f"CREATE UNIQUE INDEX `idx_{name}_local_owner` ON `{name}` (`localId`, `owner`)"
    )
    return indexes, True


# ----------------------------------------------------------------------------
# Provisioning
# ----------------------------------------------------------------------------

def fetch_collections(base_url, token):
    collections = []
    page = 1
    while True:
        result = api(
            "GET",
            base_url,
            f"/api/collections?page={page}&perPage=100",
            token=token,
        )
        collections.extend(result.get("items") or [])
        total_pages = result.get("totalPages") or 1
        if page >= total_pages:
            break
        page += 1
    return collections


def find_users_id(collections):
    users = next((item for item in collections if item.get("name") == "users"), None)
    if users and users.get("id"):
        return users["id"]
    for item in collections:
        if item.get("type") == "auth":
            return item["id"]
    return "_pb_users_auth_"


def provision(base_url, email, password, dry_run=False):
    token_response = api(
        "POST",
        base_url,
        "/api/collections/_superusers/auth-with-password",
        data={"identity": email, "password": password},
    )
    token = (token_response or {}).get("token")
    if not token:
        raise SystemExit("Login failed: no token returned (check email/password).")

    collections = fetch_collections(base_url, token)
    users_id = find_users_id(collections)
    by_name = {item.get("name"): item for item in collections}

    created = updated = unchanged = 0
    warnings = []

    for name, field_names in COLLECTIONS:
        existing = by_name.get(name)
        if existing is None:
            fields = []
            used = set()
            for field_name in field_names + TIMESTAMP_FIELDS:
                fields.append(make_field(field_name, users_id, used))
            payload = {
                "name": name,
                "type": "base",
                "fields": fields,
                "indexes": [
                    f"CREATE UNIQUE INDEX `idx_{name}_local_owner` "
                    f"ON `{name}` (`localId`, `owner`)"
                ],
                "options": {},
                **RULES,
            }
            if dry_run:
                print(f"[dry-run] create {name}")
                created += 1
                continue
            try:
                api("POST", base_url, "/api/collections", token=token, data=payload)
                print(f"created  {name}")
                created += 1
            except ApiError as error:
                if error.status == 400 and "index" in str(error.payload).lower():
                    payload["indexes"] = []
                    api("POST", base_url, "/api/collections", token=token, data=payload)
                    print(f"created  {name} (index skipped)")
                    warnings.append(f"{name}: unique index could not be created")
                    created += 1
                else:
                    raise
            continue

        if existing.get("type") != "base":
            raise SystemExit(
                f'Collection "{name}" exists but is of type "{existing.get("type")}", '
                'not "base". Rename it in the PocketBase admin and run the script again.'
            )

        fields, fields_changed = ensure_fields(existing, field_names + TIMESTAMP_FIELDS, users_id)
        indexes, index_changed = ensure_indexes(existing, name)
        rule_changes = {
            rule: value for rule, value in RULES.items()
            if (existing.get(rule) or "") != value
        }

        if not (fields_changed or index_changed or rule_changes):
            print(f"ok       {name}")
            unchanged += 1
            continue

        payload = {}
        if fields_changed:
            payload["fields"] = fields
        if index_changed:
            payload["indexes"] = indexes
        payload.update(rule_changes)

        if dry_run:
            print(f"[dry-run] update {name}: {', '.join(sorted(payload))}")
            updated += 1
            continue

        try:
            api(
                "PATCH",
                base_url,
                f"/api/collections/{existing['id']}",
                token=token,
                data=payload,
            )
            print(f"updated  {name}: {', '.join(sorted(payload))}")
            updated += 1
        except ApiError as error:
            if "indexes" in payload and "index" in str(error.payload).lower():
                payload.pop("indexes")
                if not payload:
                    print(f"ok       {name} (index skipped)")
                    warnings.append(
                        f"{name}: unique index skipped (duplicate localId/owner records exist)"
                    )
                    unchanged += 1
                    continue
                api(
                    "PATCH",
                    base_url,
                    f"/api/collections/{existing['id']}",
                    token=token,
                    data=payload,
                )
                print(f"updated  {name} (index skipped)")
                warnings.append(
                    f"{name}: unique index skipped (duplicate localId/owner records exist)"
                )
                updated += 1
            else:
                raise

    if dry_run:
        print(f"\n[dry-run] create={created} update={updated} unchanged={unchanged}")
        return

    final_collections = {item.get("name"): item for item in fetch_collections(base_url, token)}
    missing = [name for name, _ in COLLECTIONS if name not in final_collections]
    if missing:
        raise SystemExit("Provisioning finished but these collections are missing: " + ", ".join(missing))

    print(f"\nDone: created={created} updated={updated} unchanged={unchanged}")
    for warning in warnings:
        print("warning: " + warning)
    print("Now create the app users in PocketBase (Collections -> users -> New record).")


def main():
    parser = argparse.ArgumentParser(
        description="Create/update the Konkur PocketBase collections without deleting anything."
    )
    parser.add_argument("--url", required=True, help="Base URL, e.g. https://masir-69623a.dockhold.app")
    parser.add_argument("--email", required=True, help="PocketBase superuser email")
    parser.add_argument("--password", help="Superuser password (asked interactively when omitted)")
    parser.add_argument("--dry-run", action="store_true", help="Show planned changes only")
    args = parser.parse_args()

    base_url = args.url.strip().rstrip("/")
    if not base_url.lower().startswith(("http://", "https://")):
        raise SystemExit("--url must start with http:// or https://")

    password = args.password or getpass.getpass("PocketBase superuser password: ")
    provision(base_url, args.email.strip(), password, dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except ApiError as error:
        print(f"\nPocketBase API error ({error.status}): {error}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
