-- The Learner Enroll wizard collects email, address, guardian name/relationship,
-- and last grade completed, but none of these had a column to persist to --
-- they were shown back to the teacher in the Review step and then silently
-- dropped on submit. Safe to re-run.

BEGIN;

ALTER TABLE learner ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE learner ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE learner ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(200);
ALTER TABLE learner ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50);
ALTER TABLE learner ADD COLUMN IF NOT EXISTS last_grade_completed VARCHAR(100);

COMMIT;
