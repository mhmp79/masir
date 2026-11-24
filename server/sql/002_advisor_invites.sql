-- Supplemental migration for pairing-code invites.
-- The root sql/001_init.sql models advisor_links as advisor->student grants;
-- invites need a code and a temporarily unknown student. Safe to re-run.

ALTER TABLE advisor_links ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE advisor_links ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE advisor_links
    ADD COLUMN IF NOT EXISTS updated timestamptz NOT NULL DEFAULT now();

-- Pending invites have no student yet; the grant is filled in on accept.
ALTER TABLE advisor_links ALTER COLUMN student_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisor_links_code ON advisor_links (code)
    WHERE code IS NOT NULL;
