-- Moves the "Student view link" switch from per-learner to per-class: one
-- toggle on the class now controls visibility for every enrolled learner,
-- who each still get their own token/report (resolved by LRN + birthdate
-- on the new public lookup page, see app/routes/learner_routes.py).
-- learner.portal_share_token is kept (repurposed: just "this learner's
-- view token", no longer gated by its own enabled flag) and
-- learner.portal_share_enabled is dropped since nothing reads it anymore.
BEGIN;

ALTER TABLE learning_class ADD COLUMN IF NOT EXISTS portal_share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE learner DROP COLUMN IF EXISTS portal_share_enabled;

COMMIT;
