-- The Learner Profile's Background Information / Edit Learner UI shows whether
-- a learner is a 4Ps (Pantawid Pamilyang Pilipino Program) beneficiary, but the
-- schema never had a column for it. Safe to re-run.

BEGIN;

ALTER TABLE learner
    ADD COLUMN IF NOT EXISTS is_4ps_beneficiary BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
