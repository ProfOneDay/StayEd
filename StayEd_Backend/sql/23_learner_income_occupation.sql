-- Adviser-requested new predictors for the dropout-risk model: monthly
-- household income, and occupation (the learner's own job, or a parent's/
-- guardian's if the learner isn't employed -- distinct from the existing
-- coarse employment_status field). Neither exists on the current intake
-- form, so real learners start out NULL here until a teacher fills them in;
-- the training dataset uses synthetic values to backfill until then. Safe
-- to re-run.

BEGIN;

ALTER TABLE learner
    ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);

COMMIT;
