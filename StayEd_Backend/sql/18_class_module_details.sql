-- Module Management Ticket 1 follow-up: class_module needs Topic/Description
-- fields for the Add Module form, an is_archived flag so a module's
-- *definition* status (Active/Archived) can be tracked separately from its
-- *class release* status (Not Released/Released, which stays derived from
-- module_record rather than stored, so it can never drift out of sync), and
-- a DB-level guarantee against duplicate learner+module transactions (the
-- bulk release endpoint already skips already-released learners in
-- application code; this backs that with a real constraint). Safe to re-run.

BEGIN;

ALTER TABLE class_module
    ADD COLUMN IF NOT EXISTS topic VARCHAR(200),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_record_enrollment_class_module
    ON module_record (enrollment_id, class_module_id)
    WHERE class_module_id IS NOT NULL;

COMMIT;
