-- Admin CLC Management was fully hardcoded/simulated -- Archive/Restore never
-- persisted anywhere, and the "Archived On"/"Archived By" fields shown in the
-- UI were fabricated strings. clc.status is already ACTIVE/INACTIVE, so
-- "archive" maps onto that; these two columns make the archive metadata real
-- instead of invented. Safe to re-run.

BEGIN;

ALTER TABLE clc ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

ALTER TABLE clc
    ADD COLUMN IF NOT EXISTS archived_by_user_id BIGINT
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

COMMIT;
