-- Teachers need a free-text note per module record (e.g. why a module wasn't
-- returned on time). The mockup UI already had a remarks field; the schema
-- never had a column for it. Safe to re-run.

BEGIN;

ALTER TABLE module_record
    ADD COLUMN IF NOT EXISTS remarks TEXT;

COMMIT;