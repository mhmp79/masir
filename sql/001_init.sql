-- Masir Konkor — typed PostgreSQL schema (v0.9.4-beta)
-- Run this once before importing a PocketBase export:
--   psql "$DATABASE_URL" -f sql/001_init.sql
--
-- Design notes:
--   * Row identity for synced app data is (owner_id, local_id) for normal tables,
--     and owner_id alone for the singleton tracker/timer tables.
--   * RLS is intentionally NOT enabled. The application server enforces the
--     advisor/student permission model; see the column/table comments below.
--   * All statements are idempotent enough for repeat runs (IF NOT EXISTS /
--     DROP TRIGGER IF EXISTS + CREATE TRIGGER).
--
-- !!! This file never drops tables and never deletes application data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

/* ==========================================================================
   Identity and access
   ========================================================================== */

CREATE TABLE IF NOT EXISTS users (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               text        NOT NULL UNIQUE,
    role                text        NOT NULL DEFAULT 'student'
                                    CHECK (role IN ('student', 'advisor', 'admin')),
    display_name        text,
    password_hash       text,
    password_updated_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS
    'Phone-first identities. Ids from a legacy export are preserved when present by the one-time import tool.';
COMMENT ON COLUMN users.phone IS 'Normalized Iranian mobile number, always +989xxxxxxxxx.';
COMMENT ON COLUMN users.role IS 'Server-enforced: student sees own rows, advisor sees linked students, admin can assign advisor-student links.';

CREATE TABLE IF NOT EXISTS otp_codes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       text,
    purpose     text        NOT NULL DEFAULT 'signup'
                            CHECK (purpose IN ('signup', 'reset')),
    code_hash   text,
    expires_at  timestamptz,
    consumed_at timestamptz,
    attempts    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advisor_links (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id  uuid        NOT NULL REFERENCES users(id),
    student_id  uuid        NOT NULL REFERENCES users(id),
    permissions jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status      text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'revoked')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (advisor_id, student_id),
    CHECK (advisor_id <> student_id)
);

COMMENT ON TABLE advisor_links IS
    'Server-side permission source for advisor -> student access. RLS is off on purpose; queries must filter by approved links.';
COMMENT ON COLUMN advisor_links.permissions IS
    'Optional per-link scopes, e.g. {"view_sessions": true}. Empty object means default approved read+write access.';

/* ==========================================================================
   Typed application tables
   Every app table carries owner_id / updated / deleted plus a local_id
   (except the two singleton tables keyed directly by owner_id).
   ========================================================================== */

CREATE TABLE IF NOT EXISTS subjects (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       uuid        NOT NULL REFERENCES users(id),
    local_id       text        NOT NULL,
    name           text,
    color          text,
    type           text,
    field          text,
    config         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    sessions_count int         NOT NULL DEFAULT 0,
    local_order    int,
    updated        timestamptz NOT NULL DEFAULT now(),
    deleted        boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid        NOT NULL REFERENCES users(id),
    local_id    text        NOT NULL,
    subject     text,
    topic       text,
    dur_min     int,
    date        text,
    start_min   int,
    done        boolean,
    done_at     bigint,
    activity_id text,
    exam_id     text,
    ts          bigint,
    local_order int,
    updated     timestamptz NOT NULL DEFAULT now(),
    deleted     boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

COMMENT ON COLUMN sessions.exam_id IS 'Local exam id (exams.local_id), not the old PocketBase record id.';
COMMENT ON COLUMN sessions.start_min IS 'Minutes from midnight; NULL for imported legacy plan/reserved rows.';

CREATE TABLE IF NOT EXISTS activities (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id  uuid        NOT NULL REFERENCES users(id),
    local_id  text        NOT NULL,
    subject   text,
    topic     text,
    minutes   int,
    date      text,
    start_min int,
    end_min   int,
    note      text,
    local_order int,
    updated   timestamptz NOT NULL DEFAULT now(),
    deleted   boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS classes (
    id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid        NOT NULL REFERENCES users(id),
    local_id text        NOT NULL,
    subject  text,
    total    int,
    sessions jsonb       NOT NULL DEFAULT '{}'::jsonb,
    local_order int,
    updated  timestamptz NOT NULL DEFAULT now(),
    deleted  boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS sleeps (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id  uuid        NOT NULL REFERENCES users(id),
    local_id  text        NOT NULL,
    date      text,
    end_date  text,
    start_min int,
    end_min   int,
    nap       boolean,
    local_order int,
    updated   timestamptz NOT NULL DEFAULT now(),
    deleted   boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS phones (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id  uuid        NOT NULL REFERENCES users(id),
    local_id  text        NOT NULL,
    date      text,
    start_min int,
    end_min   int,
    subject   text,
    note      text,
    local_order int,
    updated   timestamptz NOT NULL DEFAULT now(),
    deleted   boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS exams (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        uuid        NOT NULL REFERENCES users(id),
    local_id        text        NOT NULL,
    name            text,
    date            text,
    has_results     boolean,
    total_taraz     numeric,
    subjects        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    questions_count int         NOT NULL DEFAULT 0,
    local_order     int,
    updated         timestamptz NOT NULL DEFAULT now(),
    deleted         boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS questions (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid        NOT NULL REFERENCES users(id),
    local_id      text        NOT NULL,
    exam_id       text,
    number        int,
    subject       text,
    topic         text,
    status        text,
    note          text,
    question_text text,
    answer_text   text,
    options       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    tags          jsonb       NOT NULL DEFAULT '[]'::jsonb,
    starred       boolean     NOT NULL DEFAULT false,
    figure_ref    text,
    note_hidden   boolean     NOT NULL DEFAULT false,
    ts            bigint,
    local_order   int,
    updated       timestamptz NOT NULL DEFAULT now(),
    deleted       boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

CREATE TABLE IF NOT EXISTS app_meta (
    id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid        NOT NULL REFERENCES users(id),
    local_id text        NOT NULL,
    value    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    local_order int,
    updated  timestamptz NOT NULL DEFAULT now(),
    deleted  boolean     NOT NULL DEFAULT false,
    UNIQUE (owner_id, local_id)
);

COMMENT ON COLUMN app_meta.local_id IS 'Use ''main'' for the profile/settings blob; ''tracker'' lives in the tracker table.';

-- Singletons: one row per owner, owner_id is the primary key (no local_id).
CREATE TABLE IF NOT EXISTS tracker (
    owner_id uuid        PRIMARY KEY REFERENCES users(id),
    correct  int         NOT NULL DEFAULT 0,
    wrong    int         NOT NULL DEFAULT 0,
    blank    int         NOT NULL DEFAULT 0,
    coef     numeric     NOT NULL DEFAULT (1::numeric / 3::numeric),
    updated  timestamptz NOT NULL DEFAULT now(),
    deleted  boolean     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS timer (
    owner_id   uuid        PRIMARY KEY REFERENCES users(id),
    running    boolean     NOT NULL DEFAULT false,
    started_at bigint,
    elapsed_ms bigint,
    mode       text,
    updated    timestamptz NOT NULL DEFAULT now(),
    deleted    boolean     NOT NULL DEFAULT false
);

/* ==========================================================================
   Change log (optional sync/audit feed; written by the server)
   ========================================================================== */

CREATE TABLE IF NOT EXISTS changes (
    id        bigserial   PRIMARY KEY,
    owner_id  uuid,
    table_name text,
    row_id    text,
    op        text,
    updated   timestamptz NOT NULL DEFAULT now(),
    data      jsonb,
    actor_id  uuid
);

/* ---- idempotent add-ons (also applied by server/sql/003_password_auth.sql)
   Old databases re-run this file, so every new column is added defensively. */
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'signup';

ALTER TABLE subjects    ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE sessions    ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE activities  ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE classes     ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE sleeps      ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE phones      ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE exams       ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE questions   ADD COLUMN IF NOT EXISTS local_order int;
ALTER TABLE app_meta    ADD COLUMN IF NOT EXISTS local_order int;

COMMENT ON COLUMN users.password_hash IS 'scrypt$salt$hash; never returned by the API.';
COMMENT ON COLUMN otp_codes.purpose IS 'OTP scope: signup or reset; hashed into code_hash.';
COMMENT ON COLUMN subjects.local_order IS 'Local index from the browser; typed as localOrder in the adapter.';

/* ==========================================================================
   Indexes
   ========================================================================== */

CREATE INDEX IF NOT EXISTS idx_subjects_owner   ON subjects (owner_id);
CREATE INDEX IF NOT EXISTS idx_subjects_updated ON subjects (updated);
CREATE INDEX IF NOT EXISTS idx_sessions_owner   ON sessions (owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions (updated);
CREATE INDEX IF NOT EXISTS idx_activities_owner   ON activities (owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_updated ON activities (updated);
CREATE INDEX IF NOT EXISTS idx_classes_owner   ON classes (owner_id);
CREATE INDEX IF NOT EXISTS idx_classes_updated ON classes (updated);
CREATE INDEX IF NOT EXISTS idx_sleeps_owner   ON sleeps (owner_id);
CREATE INDEX IF NOT EXISTS idx_sleeps_updated ON sleeps (updated);
CREATE INDEX IF NOT EXISTS idx_phones_owner   ON phones (owner_id);
CREATE INDEX IF NOT EXISTS idx_phones_updated ON phones (updated);
CREATE INDEX IF NOT EXISTS idx_exams_owner   ON exams (owner_id);
CREATE INDEX IF NOT EXISTS idx_exams_updated ON exams (updated);
CREATE INDEX IF NOT EXISTS idx_app_meta_owner   ON app_meta (owner_id);
CREATE INDEX IF NOT EXISTS idx_app_meta_updated ON app_meta (updated);
CREATE INDEX IF NOT EXISTS idx_tracker_owner   ON tracker (owner_id);
CREATE INDEX IF NOT EXISTS idx_tracker_updated ON tracker (updated);
CREATE INDEX IF NOT EXISTS idx_timer_owner   ON timer (owner_id);
CREATE INDEX IF NOT EXISTS idx_timer_updated ON timer (updated);
CREATE INDEX IF NOT EXISTS idx_questions_owner   ON questions (owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_updated ON questions (updated);
CREATE INDEX IF NOT EXISTS idx_questions_exam  ON questions (exam_id);
CREATE INDEX IF NOT EXISTS idx_advisor_links_student ON advisor_links (student_id);
CREATE INDEX IF NOT EXISTS idx_changes_owner_updated ON changes (owner_id, updated);

/* ==========================================================================
   updated is always server time on UPDATE (BEFORE UPDATE trigger)
   ========================================================================== */

CREATE OR REPLACE FUNCTION masir_touch_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS masir_touch_subjects   ON subjects;
CREATE TRIGGER masir_touch_subjects   BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_sessions   ON sessions;
CREATE TRIGGER masir_touch_sessions   BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_activities ON activities;
CREATE TRIGGER masir_touch_activities BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_classes    ON classes;
CREATE TRIGGER masir_touch_classes    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_sleeps     ON sleeps;
CREATE TRIGGER masir_touch_sleeps     BEFORE UPDATE ON sleeps
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_phones     ON phones;
CREATE TRIGGER masir_touch_phones     BEFORE UPDATE ON phones
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_exams      ON exams;
CREATE TRIGGER masir_touch_exams      BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_questions  ON questions;
CREATE TRIGGER masir_touch_questions  BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_app_meta   ON app_meta;
CREATE TRIGGER masir_touch_app_meta   BEFORE UPDATE ON app_meta
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_tracker    ON tracker;
CREATE TRIGGER masir_touch_tracker    BEFORE UPDATE ON tracker
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

DROP TRIGGER IF EXISTS masir_touch_timer      ON timer;
CREATE TRIGGER masir_touch_timer      BEFORE UPDATE ON timer
    FOR EACH ROW EXECUTE FUNCTION masir_touch_updated();

-- RLS stays disabled: the server must apply advisor_links/permissions before
-- returning rows. Kept as a comment so future migrations have a clear marker:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;  -- DO NOT enable without a policy.
