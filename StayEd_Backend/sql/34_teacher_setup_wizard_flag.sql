-- The setup wizard (pages/setup/setup-wizard-1..5.html) was only ever
-- shown to a teacher based on whether they had an ACTIVE teacher_clc row
-- (GET /clcs/current returning 200 vs 404). Normal admin approval already
-- creates that row when the admin picks a municipality/CLC on the review
-- screen, so a newly-approved teacher's first login skipped the wizard
-- entirely. This adds an explicit flag instead, set only when the teacher
-- actually finishes (or skips past) the wizard -- see
-- POST /users/setup/complete in user_routes.py.
BEGIN;

ALTER TABLE teacher ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Grandfather in every teacher who was already active before this flag
-- existed -- they already use the app day to day and must not be routed
-- back into the setup wizard on their next login.
UPDATE teacher SET setup_completed = TRUE WHERE status = 'ACTIVE' AND setup_completed = FALSE;

COMMIT;
