-- Supplemental migration for phone/password auth and persisted row order.
-- Safe to re-run on databases created by older versions of sql/001_init.sql.
-- Never drops columns or application data.

-- Password login for existing OTP-only accounts. A NULL hash means the account
-- has no password yet and may claim one via complete-signup or an admin reset.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;

-- OTP purpose is part of the stored hash: a signup code cannot reset a password.
-- Existing rows are backfilled with 'signup' by the column default.
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'signup';
UPDATE otp_codes SET purpose = 'signup' WHERE purpose IS NULL;

-- Local ordering must survive a snapshot-based first download.
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
COMMENT ON COLUMN users.password_updated_at IS 'Set whenever a password is created or changed.';
COMMENT ON COLUMN otp_codes.purpose IS 'OTP scope: signup or reset; hashed into code_hash.';
