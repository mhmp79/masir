-- User profile fields tied to the account/phone.
-- Additive only: no drops, no data loss.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS field      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade      text;

COMMENT ON COLUMN users.first_name IS 'User first name, synced from profile settings.';
COMMENT ON COLUMN users.last_name  IS 'User last name, synced from profile settings.';
COMMENT ON COLUMN users.field      IS 'Study field (رشته), synced from profile settings.';
COMMENT ON COLUMN users.grade      IS 'Study grade (پایه), synced from profile settings.';
