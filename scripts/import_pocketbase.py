#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Import a PocketBase JSON export as typed PostgreSQL INSERT statements.

The script never connects to a database and never emits DROP TABLE or DELETE.
It reads a PocketBase export directory (or a single JSON file), converts every
collection into rows of the typed schema in sql/001_init.sql, and writes
idempotent INSERT ... ON CONFLICT DO UPDATE statements to stdout or --output.

Only the Python 3 standard library is used.

Typical use:
    python scripts/import_pocketbase.py --input ./pb_export \\
        --phone 09123456789 --advisor-phone 09129998888 \\
        --output import.sql
    psql "$DATABASE_URL" -f sql/001_init.sql
    psql "$DATABASE_URL" -f import.sql
"""

import argparse
import json
import math
import os
import re
import sys
import uuid
from datetime import datetime, timezone

# Fixed namespace: the same phone/email always produces the same users.id.
UUID_NAMESPACE = uuid.UUID("3f8d1c62-92a4-4d17-b3e0-7c1a6f5b9e42")

COLLECTION_ALIASES = {
    "settings": "app_meta",
    "app-meta": "app_meta",
    "app_meta": "app_meta",
    "appmeta": "app_meta",
    "subjects": "subjects",
    "activities": "activities",
    "classes": "classes",
    "sessions": "sessions",
    "sleeps": "sleeps",
    "phones": "phones",
    "exams": "exams",
    "questions": "questions",
    "plan": "sessions",
    "reserved": "sessions",
    "timer": "timer",
}

# Column order makes the generated SQL stable and easy to review.
TABLE_COLUMNS = {
    "users": ["id", "phone", "role", "display_name"],
    "advisor_links": ["id", "advisor_id", "student_id", "permissions", "status"],
    "app_meta": ["id", "owner_id", "local_id", "value", "updated"],
    "tracker": ["owner_id", "correct", "wrong", "blank", "coef", "updated"],
    "timer": ["owner_id", "running", "started_at", "elapsed_ms", "mode", "updated"],
    "subjects": ["id", "owner_id", "local_id", "name", "color", "type", "field",
                 "config", "sessions_count", "updated"],
    "sessions": ["id", "owner_id", "local_id", "subject", "topic", "dur_min", "date",
                 "start_min", "done", "done_at", "activity_id", "exam_id", "ts", "updated"],
    "activities": ["id", "owner_id", "local_id", "subject", "topic", "minutes", "date",
                   "start_min", "end_min", "note", "updated"],
    "classes": ["id", "owner_id", "local_id", "subject", "total", "sessions", "updated"],
    "sleeps": ["id", "owner_id", "local_id", "date", "end_date", "start_min", "end_min",
               "nap", "updated"],
    "phones": ["id", "owner_id", "local_id", "date", "start_min", "end_min", "subject",
               "note", "updated"],
    "exams": ["id", "owner_id", "local_id", "name", "date", "has_results", "total_taraz",
              "subjects", "questions_count", "updated"],
    "questions": ["id", "owner_id", "local_id", "exam_id", "number", "subject", "topic",
                  "status", "note", "question_text", "answer_text", "options", "tags",
                  "starred", "figure_ref", "note_hidden", "ts", "updated"],
}

CONFLICT_RULES = {
    "users": ("(phone)", ["role", "display_name"]),
    "advisor_links": ("(advisor_id, student_id)", ["permissions", "status"]),
    "app_meta": ("(owner_id, local_id)", ["value"]),
    "tracker": ("(owner_id)", ["correct", "wrong", "blank", "coef"]),
    "timer": ("(owner_id)", ["running", "started_at", "elapsed_ms", "mode"]),
}

TABLE_ORDER = ["users", "advisor_links", "app_meta", "tracker", "timer", "subjects",
               "activities", "classes", "sessions", "sleeps", "phones", "exams", "questions"]

RECORD_META_KEYS = {
    "id", "owner", "ownerId", "localId", "local_id", "order", "created", "updated",
    "createdAt", "updatedAt", "examId", "exam_id", "collection", "collectionName",
    "@collection", "collectionId",
}

PHONE_STRIP_RE = re.compile(r"[\s\-().]")
PHONE_VALID_RE = re.compile(r"^\+989\d{9}$")


# ---------------------------------------------------------------------------
# Validation and small helpers
# ---------------------------------------------------------------------------

def die(message, code=2):
    print("error: %s" % message, file=sys.stderr)
    raise SystemExit(code)


def normalize_phone(value, label="phone"):
    """Normalize an Iranian mobile number to +989xxxxxxxxx or raise ValueError."""
    raw = PHONE_STRIP_RE.sub("", str(value if value is not None else "")).strip()
    if raw.startswith("0098"):
        raw = "+" + raw[2:]
    elif raw.startswith("+98"):
        pass
    elif raw.startswith("98") and len(raw) > 10:
        raw = "+" + raw
    elif raw.startswith("09"):
        raw = "+98" + raw[1:]
    elif raw.startswith("9"):
        raw = "+98" + raw
    if not PHONE_VALID_RE.fullmatch(raw):
        raise ValueError(
            "invalid %s %r - expected an Iranian mobile number such as "
            "09123456789, 989123456789 or +989123456789" % (label, value)
        )
    return raw


def obj(value):
    return value if isinstance(value, dict) else {}


def arr(value):
    return value if isinstance(value, list) else []


def pick(source, *paths):
    """First non-None value; paths may use dots, e.g. 'profile.name'."""
    for path in paths:
        current = source
        found = True
        for part in path.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                found = False
                break
        if found and current is not None:
            return current
    return None


def scope_local(value):
    """'e1::q1' -> 'q1' (the local id is the part after the last '::')."""
    text = str(value if value is not None else "")
    return text.rsplit("::", 1)[-1] if "::" in text else text


def fallback_local_id(record):
    canonical = json.dumps(record, ensure_ascii=False, sort_keys=True, default=str)
    return "row-" + uuid.uuid5(UUID_NAMESPACE, "fallback:" + canonical).hex[:12]


def record_local_id(record):
    raw = pick(record, "localId", "local_id", "id")
    text = scope_local(raw) if raw is not None else ""
    return text or fallback_local_id(record)


def record_value(record):
    """PocketBase stores all app fields inside the JSON 'value' field."""
    if not isinstance(record, dict):
        return {}
    if "value" in record:
        return obj(record["value"])
    return {key: val for key, val in record.items() if key not in RECORD_META_KEYS}


def raw_value(record):
    if isinstance(record, dict) and "value" in record:
        return record["value"]
    return record_value(record)


def value_rows(value):
    """Flatten a record value which may hold one row or a nested list of rows."""
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("rows", "items", "sessions", "records"):
            nested = value.get(key)
            if isinstance(nested, list):
                return nested
    return [value]


def parse_timestamp(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if not math.isfinite(number):
            return None
        if abs(number) > 1e11:  # milliseconds since epoch
            number /= 1000.0
        try:
            return datetime.fromtimestamp(number, tz=timezone.utc)
        except (ValueError, OverflowError, OSError):
            return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = None
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def comment_safe(value):
    return re.sub(r"\s+", " ", str(value if value is not None else "")).replace("--", "- - ").strip()


# ---------------------------------------------------------------------------
# SQL literal helpers — every value is escaped and explicitly cast
# ---------------------------------------------------------------------------

def sql_string(value):
    if value is None:
        return "NULL"
    text = str(value).replace("\x00", "")
    text = (text.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t"))
    return "E'" + text + "'"


def lit_text(value):
    return sql_string(value)


def lit_uuid(value):
    return "NULL" if value is None else sql_string(value) + "::uuid"


def to_int(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if math.isfinite(value) else None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except (ValueError, OverflowError):
        return None


def to_float(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return float(int(value))
    if isinstance(value, (int, float)):
        number = float(value)
        return number if math.isfinite(number) else None
    try:
        number = float(str(value).strip())
    except (ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def lit_int(value, cast="int", default=None):
    number = to_int(value)
    if number is None:
        number = default
    return "NULL" if number is None else "%d::%s" % (number, cast)


def lit_bigint(value):
    return lit_int(value, cast="bigint")


def lit_numeric(value):
    number = to_float(value)
    return "NULL" if number is None else "%.12g::numeric" % number


def lit_bool(value, default=None):
    if value is None:
        return "NULL" if default is None else ("TRUE" if default else "FALSE")
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes", "on"):
            return "TRUE"
        if lowered in ("false", "0", "no", "off", ""):
            return "FALSE"
        return "NULL"
    return "TRUE" if bool(value) else "FALSE"


def lit_jsonb(value, default=None):
    payload = value if value is not None else default
    if payload is None:
        return "NULL"
    try:
        dumped = json.dumps(payload, ensure_ascii=False, sort_keys=True,
                            separators=(",", ":"), default=str)
    except (TypeError, ValueError):
        dumped = json.dumps(str(payload), ensure_ascii=False)
    return sql_string(dumped) + "::jsonb"


def lit_timestamptz(value):
    moment = parse_timestamp(value)
    if moment is None:
        return "NULL"
    return sql_string(moment.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")) + "::timestamptz"


# ---------------------------------------------------------------------------
# Export reading (tolerates several PocketBase export layouts)
# ---------------------------------------------------------------------------

def collection_hint(node):
    """Best-effort collection name from an export wrapper object."""
    raw = pick(node, "name", "collection", "collectionName", "@collection")
    if isinstance(raw, dict):
        raw = pick(raw, "name", "id")
    return str(raw) if raw else None


def is_collection_definition(item):
    """pb_collections.json holds schema definitions, not records — skip them."""
    return (isinstance(item, dict) and "name" in item and "fields" in item
            and not any(key in item for key in ("value", "localId", "local_id", "owner")))


def gather_collections(node, default_name=None, out=None, depth=0):
    if out is None:
        out = {}
    if depth > 8:
        return out

    if isinstance(node, list):
        items = [x for x in node if isinstance(x, dict) and not is_collection_definition(x)]
        if not items:
            return out
        descriptors = [x for x in items if "name" in x and ("records" in x or "items" in x)]
        if descriptors:
            for descriptor in descriptors:
                gather_collections(descriptor.get("records", descriptor.get("items")),
                                   str(descriptor["name"]), out, depth + 1)
            return out
        hints = set()
        for item in items:
            hint = pick(item, "collection", "collectionName", "@collection")
            if hint:
                hints.add(str(hint))
        name = default_name or (next(iter(hints)) if len(hints) == 1 else None) or "__records__"
        out.setdefault(name, []).extend(items)
        return out

    if isinstance(node, dict):
        if isinstance(node.get("collections"), (list, dict)):
            gather_collections(node["collections"], None, out, depth + 1)
            return out
        for key in ("records", "items", "data"):
            if isinstance(node.get(key), (list, dict)):
                gather_collections(node[key], default_name or collection_hint(node),
                                   out, depth + 1)
                return out
        if any(key in node for key in ("localId", "local_id")) or (
                "value" in node and ("id" in node or "owner" in node)):
            name = default_name or str(pick(node, "collection", "collectionName",
                                            "@collection") or "__records__")
            out.setdefault(name, []).append(node)
            return out
        for key, value in node.items():
            if isinstance(value, (list, dict)) and not str(key).startswith("@"):
                gather_collections(value, key, out, depth + 1)
        return out

    return out


def load_export(input_path):
    if os.path.isdir(input_path):
        paths = [os.path.join(input_path, name)
                 for name in sorted(os.listdir(input_path))
                 if name.lower().endswith(".json")]
    elif os.path.isfile(input_path):
        paths = [input_path]
    else:
        raise ValueError("input path does not exist: %s" % input_path)
    if not paths:
        raise ValueError("no .json files found in %s" % input_path)

    collections = {}
    skip_names = {"pb_collections", "pb_collections_panel", "pb_data", "data"}
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8-sig") as handle:
                document = json.load(handle)
        except (OSError, ValueError) as exc:
            raise ValueError("cannot read %s: %s" % (path, exc))
        base = os.path.splitext(os.path.basename(path))[0]
        hint = None if base in skip_names else base
        for name, records in gather_collections(document, hint).items():
            collections.setdefault(name, []).extend(records)
    return collections


def canonical_table(collection_name):
    key = str(collection_name).strip().lower().replace(" ", "-")
    return COLLECTION_ALIASES.get(key)


# ---------------------------------------------------------------------------
# Row conversion
# ---------------------------------------------------------------------------

class RowSet(object):
    """Deduplicates rows by their conflict key (later rows win)."""

    def __init__(self):
        self._rows = {}

    def add(self, table, key, values):
        self._rows[(table, tuple(str(part) for part in key))] = dict(values)

    def grouped(self):
        grouped = {}
        for (table, _key), values in self._rows.items():
            grouped.setdefault(table, []).append(values)
        ordered = [(table, grouped[table]) for table in TABLE_ORDER if table in grouped]
        ordered.extend((table, values) for table, values in grouped.items()
                       if table not in TABLE_ORDER)
        return ordered

    def counts(self):
        counts = {}
        for (table, _key) in self._rows:
            counts[table] = counts.get(table, 0) + 1
        return counts


def base_row(owner_id, local_id=None, record=None):
    values = {"owner_id": lit_uuid(owner_id)}
    if local_id is not None:
        values["local_id"] = lit_text(local_id)
    if record is not None:
        stamp = lit_timestamptz(pick(record, "updated", "updatedAt", "created"))
        values["updated"] = stamp
    return values


def exam_id_for(value, record, exam_map):
    """Resolve a question's exam to exams.local_id when possible."""
    raw = pick(value, "examId", "exam_id", "exam") if isinstance(value, dict) else None
    if raw is None:
        raw = pick(record, "examId", "exam_id")
    if raw is None:
        return None
    text = str(raw)
    if "::" in text:
        return text.split("::", 1)[0]
    return exam_map.get(text, text)


def map_subject(owner, local, value, record):
    values = base_row(owner, local, record)
    config = pick(value, "config", "settings")
    values.update({
        "name": lit_text(pick(value, "name")),
        "color": lit_text(pick(value, "color")),
        "type": lit_text(pick(value, "type")),
        "field": lit_text(pick(value, "field", "fieldName")),
        "config": lit_jsonb(config if config is not None else value, default={}),
        "sessions_count": lit_int(pick(value, "sessions", "sessionsCount", "sessions_count"),
                                  default=0),
    })
    return values


def map_activity(owner, local, value, record):
    values = base_row(owner, local, record)
    values.update({
        "subject": lit_text(pick(value, "subject")),
        "topic": lit_text(pick(value, "topic")),
        "minutes": lit_int(pick(value, "minutes", "duration")),
        "date": lit_text(pick(value, "date")),
        "start_min": lit_int(pick(value, "startMin", "start_min")),
        "end_min": lit_int(pick(value, "endMin", "end_min")),
        "note": lit_text(pick(value, "note")),
    })
    return values


def map_session(owner, local, value, record, exam_map, legacy=False):
    values = base_row(owner, local, record)
    # Legacy plan/reserved rows were never scheduled on a timeline.
    start_min = None if legacy else pick(value, "startMin", "start_min")
    values.update({
        "subject": lit_text(pick(value, "subject")),
        "topic": lit_text(pick(value, "topic")),
        "dur_min": lit_int(pick(value, "durMin", "dur_min", "minutes")),
        "date": lit_text(pick(value, "date")),
        "start_min": lit_int(start_min),
        "done": lit_bool(pick(value, "done")),
        "done_at": lit_bigint(pick(value, "doneAt", "done_at")),
        "activity_id": lit_text(pick(value, "activityId", "activity_id")),
        "exam_id": lit_text(exam_id_for(value, record, exam_map)),
        "ts": lit_bigint(pick(value, "ts")),
    })
    return values


def map_class(owner, local, value, record):
    values = base_row(owner, local, record)
    values.update({
        "subject": lit_text(pick(value, "subject")),
        "total": lit_int(pick(value, "total")),
        "sessions": lit_jsonb(pick(value, "sessions"), default={}),
    })
    return values


def map_sleep(owner, local, value, record):
    values = base_row(owner, local, record)
    values.update({
        "date": lit_text(pick(value, "date")),
        "end_date": lit_text(pick(value, "endDate", "end_date")),
        "start_min": lit_int(pick(value, "startMin", "start_min")),
        "end_min": lit_int(pick(value, "endMin", "end_min")),
        "nap": lit_bool(pick(value, "nap", "isNap")),
    })
    return values


def map_phone(owner, local, value, record):
    values = base_row(owner, local, record)
    values.update({
        "date": lit_text(pick(value, "date")),
        "start_min": lit_int(pick(value, "startMin", "start_min")),
        "end_min": lit_int(pick(value, "endMin", "end_min")),
        "subject": lit_text(pick(value, "subject")),
        "note": lit_text(pick(value, "note")),
    })
    return values


def map_exam(owner, local, value, record):
    values = base_row(owner, local, record)
    embedded = arr(value.get("questions")) if isinstance(value, dict) else []
    count = pick(value, "questionsCount", "questions_count")
    values.update({
        "name": lit_text(pick(value, "name")),
        "date": lit_text(pick(value, "date")),
        "has_results": lit_bool(pick(value, "hasResults", "has_results")),
        "total_taraz": lit_numeric(pick(value, "totalTaraz", "total_taraz")),
        "subjects": lit_jsonb(pick(value, "subjects", "results"), default={}),
        "questions_count": lit_int(count if count is not None else len(embedded), default=0),
    })
    return values


def map_question(owner, local, exam_id, value, record=None):
    values = base_row(owner, local, record)
    number = pick(value, "number", "n", "id")
    values.update({
        "exam_id": lit_text(exam_id),
        "number": lit_int(number),
        "subject": lit_text(pick(value, "subject")),
        "topic": lit_text(pick(value, "topic")),
        "status": lit_text(pick(value, "status")),
        "note": lit_text(pick(value, "note")),
        "question_text": lit_text(pick(value, "questionText", "question_text", "text",
                                       "question")),
        "answer_text": lit_text(pick(value, "answerText", "answer_text", "answer")),
        "options": lit_jsonb(pick(value, "options"), default={}),
        "tags": lit_jsonb(pick(value, "tags"), default=[]),
        "starred": lit_bool(pick(value, "starred"), default=False),
        "figure_ref": lit_text(pick(value, "figureRef", "figure_ref")),
        "note_hidden": lit_bool(pick(value, "noteHidden", "note_hidden"), default=False),
        "ts": lit_bigint(pick(value, "ts")),
    })
    return values


def map_tracker(value, owner, record=None):
    value = obj(value)
    counts = obj(value.get("counts"))
    coef = pick(value, "coef")
    return {
        "owner_id": lit_uuid(owner),
        "correct": lit_int(pick(counts, "correct") if counts else
                           pick(value, "correct"), default=0),
        "wrong": lit_int(pick(counts, "wrong") if counts else
                         pick(value, "wrong"), default=0),
        "blank": lit_int(pick(counts, "blank") if counts else
                         pick(value, "blank"), default=0),
        "coef": lit_numeric(coef if coef is not None else 1.0 / 3.0),
        "updated": lit_timestamptz(pick(record, "updated", "updatedAt", "created")
                                   if record else None),
    }


def map_timer(value, owner, record=None):
    values = {
        "owner_id": lit_uuid(owner),
        "running": lit_bool(pick(value, "running"), default=False),
        "started_at": lit_bigint(pick(value, "startedAt", "started_at")),
        "elapsed_ms": lit_bigint(pick(value, "elapsedMs", "elapsed_ms")),
        "mode": lit_text(pick(value, "mode")),
        "updated": lit_timestamptz(pick(record, "updated", "updatedAt", "created")
                                   if record else None),
    }
    return values


# ---------------------------------------------------------------------------
# SQL emission
# ---------------------------------------------------------------------------

def ordered_columns(table, values):
    preferred = TABLE_COLUMNS.get(table, [])
    columns = [column for column in preferred if column in values]
    columns.extend(sorted(column for column in values if column not in preferred))
    return columns


def upsert_sql(table, values):
    columns = ordered_columns(table, values)
    conflict, update_columns = CONFLICT_RULES.get(table, ("(owner_id, local_id)", []))
    if not update_columns:
        update_columns = [column for column in columns
                          if column not in ("id", "owner_id", "local_id", "updated")]
    assignments = ["%s = EXCLUDED.%s" % (column, column)
                   for column in update_columns if column in values]
    head = "INSERT INTO %s (%s)" % (table, ", ".join(columns))
    tail = ("ON CONFLICT %s DO UPDATE SET %s;" % (conflict, ", ".join(assignments))
            if assignments else "ON CONFLICT %s DO NOTHING;" % conflict)
    return "%s\n    VALUES (%s)\n    %s" % (head, ", ".join(values[c] for c in columns), tail)


def build_sql(input_path, rowset, student_phone, advisor_phone, student_id, seed, generated):
    counts = rowset.counts()
    lines = [
        "-- Masir Konkor — PocketBase -> typed PostgreSQL import",
        "-- Generated (UTC): %s" % comment_safe(generated),
        "-- Source: %s" % comment_safe(input_path),
        "-- Student phone: %s" % student_phone,
        "-- Student id: %s (uuid5 namespace %s)" % (student_id, UUID_NAMESPACE),
        "-- Identity seed: %s" % comment_safe(seed),
        "-- Advisor phone: %s" % (advisor_phone or "none"),
        "-- Apply sql/001_init.sql first. Safe to re-run: INSERT ... ON CONFLICT DO UPDATE.",
        "-- Only INSERT statements are emitted; no destructive SQL is generated.",
        "-- Row counts:",
    ]
    if not counts:
        lines.append("--   (no records found in the export)")
    for table in TABLE_ORDER:
        if table in counts:
            lines.append("--   %-14s %d" % (table, counts[table]))
    for table in sorted(counts):
        if table not in TABLE_ORDER:
            lines.append("--   %-14s %d" % (table, counts[table]))

    for table, rows in rowset.grouped():
        lines.append("")
        lines.append("-- %s (%d rows)" % (table, len(rows)))
        for values in rows:
            lines.append(upsert_sql(table, values))
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main conversion
# ---------------------------------------------------------------------------

def convert(collections, student_phone, advisor_phone, student_id, advisor_id,
            display_name, advisor_name):
    rows = RowSet()

    rows.add("users", ("student", student_phone), {
        "id": lit_uuid(student_id),
        "phone": lit_text(student_phone),
        "role": lit_text("student"),
        "display_name": lit_text(display_name),
    })
    if advisor_phone:
        rows.add("users", ("advisor", advisor_phone), {
            "id": lit_uuid(advisor_id),
            "phone": lit_text(advisor_phone),
            "role": lit_text("advisor"),
            "display_name": lit_text(advisor_name),
        })
        rows.add("advisor_links", (advisor_id, student_id), {
            "advisor_id": lit_uuid(advisor_id),
            "student_id": lit_uuid(student_id),
            "permissions": lit_jsonb({}),
            "status": lit_text("approved"),
        })

    # PocketBase exam record id -> local exam id, used by questions.examId.
    exam_map = {}
    for record in arr(collections.get("exams")):
        exam_map[str(pick(record, "id", "localId", "local_id") or "")] = record_local_id(record)

    for name, records in collections.items():
        table = canonical_table(name)
        if not table:
            continue
        legacy = str(name).strip().lower() in ("plan", "reserved")
        prefix = "%s:" % str(name).strip().lower() if legacy else ""

        for record in arr(records):
            if not isinstance(record, dict):
                continue
            value = raw_value(record)
            record_local = record_local_id(record)

            if table == "app_meta" and record_local == "tracker":
                rows.add("tracker", (student_id,), map_tracker(value, student_id, record))
                continue
            if table == "timer":
                rows.add("timer", (student_id,), map_timer(value, student_id, record))
                continue

            for index, row_value in enumerate(value_rows(value)):
                row_value = obj(row_value)
                local = prefix + scope_local(pick(row_value, "id", "localId", "local_id")
                                             or record_local)
                if legacy and len(value_rows(value)) > 1:
                    local = "%s%d" % (local, index + 1)
                if not local:
                    local = fallback_local_id(record) + str(index + 1)

                if table == "app_meta":
                    # All settings/profile blobs are merged into the 'main' row.
                    rows.add("app_meta", (student_id, "main"),
                             dict(base_row(student_id, "main", record),
                                  **{"value": lit_jsonb(value, default={})}))
                    if isinstance(value, dict) and "counts" in value:
                        rows.add("tracker", (student_id,),
                                 map_tracker(value, student_id, record))
                elif table == "subjects":
                    rows.add("subjects", (student_id, local),
                             map_subject(student_id, local, row_value, record))
                elif table == "activities":
                    rows.add("activities", (student_id, local),
                             map_activity(student_id, local, row_value, record))
                elif table == "sessions":
                    rows.add("sessions", (student_id, local),
                             map_session(student_id, local, row_value, record,
                                         exam_map, legacy=legacy))
                elif table == "sleeps":
                    rows.add("sleeps", (student_id, local),
                             map_sleep(student_id, local, row_value, record))
                elif table == "phones":
                    rows.add("phones", (student_id, local),
                             map_phone(student_id, local, row_value, record))
                elif table == "classes":
                    rows.add("classes", (student_id, local),
                             map_class(student_id, local, row_value, record))
                elif table == "exams":
                    rows.add("exams", (student_id, local),
                             map_exam(student_id, local, row_value, record))
                    # Embedded questions are stripped into their own typed table.
                    for question in arr(row_value.get("questions")):
                        question = obj(question)
                        question_local = scope_local(pick(question, "id", "localId",
                                                          "local_id") or fallback_local_id(question))
                        rows.add("questions", (student_id, question_local),
                                 map_question(student_id, question_local, local,
                                              question, record))
                elif table == "questions":
                    exam_id = exam_id_for(row_value, record, exam_map)
                    rows.add("questions", (student_id, local),
                             map_question(student_id, local, exam_id, row_value, record))
    return rows


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="import_pocketbase.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Convert a PocketBase JSON export into typed PostgreSQL INSERT statements.",
        epilog="""examples:
  python scripts/import_pocketbase.py --input ./pb_export --phone 09123456789
  python scripts/import_pocketbase.py --input ./pb_export --phone +989123456789 \\
      --advisor-phone 09129998888 --name "Student Name" --output import.sql
  psql "$DATABASE_URL" -f sql/001_init.sql
  psql "$DATABASE_URL" -f import.sql

The export directory may contain <collection>.json files, a pb_data.json file,
or a JSON object keyed by collection name. Schema-only files such as
pb_collections.json are recognized and skipped. Every generated statement is
an INSERT ... ON CONFLICT DO UPDATE; nothing is dropped or deleted.
""")
    parser.add_argument("--input", required=True, metavar="DIR",
                        help="export directory (or a single JSON file) to read")
    parser.add_argument("--phone", required=True, metavar="PHONE",
                        help="student phone, Iranian format (e.g. 09123456789 or +989123456789)")
    parser.add_argument("--advisor-phone", metavar="PHONE",
                        help="optional advisor phone; creates an advisor user and an approved link")
    parser.add_argument("--email", metavar="EMAIL",
                        help="optional identity seed/email for the student id (id = uuid5(namespace, "
                             "'masir:student:' + email or phone))")
    parser.add_argument("--name", metavar="NAME",
                        help="student display name (default: name from exported settings)")
    parser.add_argument("--advisor-name", metavar="NAME", help="advisor display name")
    parser.add_argument("--output", metavar="FILE",
                        help="write SQL to FILE instead of stdout")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        student_phone = normalize_phone(args.phone, "--phone")
        advisor_phone = normalize_phone(args.advisor_phone, "--advisor-phone") \
            if args.advisor_phone else None
        collections = load_export(args.input)
    except ValueError as exc:
        die(exc)

    seed = (args.email.strip().lower() if args.email and args.email.strip()
            else student_phone)
    student_id = uuid.uuid5(UUID_NAMESPACE, "masir:student:" + seed)
    advisor_id = uuid.uuid5(UUID_NAMESPACE, "masir:advisor:" + advisor_phone) \
        if advisor_phone else None

    # Prefer an explicit --name, then the name from the exported settings blob.
    display_name = args.name
    if not display_name:
        for record in arr(collections.get("settings")):
            if record_local_id(record) == "tracker":
                continue
            profile = pick(record_value(record), "profile")
            display_name = pick(profile, "name", "displayName", "fullName")
            if display_name:
                break

    rowset = convert(collections, student_phone, advisor_phone, student_id, advisor_id,
                     display_name, args.advisor_name)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sql = build_sql(args.input, rowset, student_phone, advisor_phone, student_id,
                    seed, generated)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(sql)
        except OSError as exc:
            die("cannot write %s: %s" % (args.output, exc))
        total = sum(rowset.counts().values())
        print("Wrote %d row(s) to %s" % (total, args.output), file=sys.stderr)
    else:
        # JSON exports often contain Persian text; keep stdout UTF-8 even on a
        # Windows console whose default code page is not UTF-8.
        try:
            sys.stdout.buffer.write(sql.encode("utf-8"))
            sys.stdout.buffer.flush()
        except AttributeError:
            sys.stdout.write(sql)
    return 0


if __name__ == "__main__":
    sys.exit(main())
