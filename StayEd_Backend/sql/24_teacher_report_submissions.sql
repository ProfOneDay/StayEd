-- Lets a teacher send a generated report (At-Risk Learners List, Intervention
-- Tracking, or an individual learner's Progress report) to admins for
-- division-level review, instead of only exporting it locally. The
-- submission stores the exact rendered snapshot (title/meta/sections) shown
-- to the teacher at send time, so what the admin reviews later can't drift
-- from what was sent even if the underlying learner data changes afterward.

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_report_submission (
    submission_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES teacher(teacher_id) ON DELETE CASCADE,
    report_type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(200),
    snapshot JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNREVIEWED',
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by_user_id BIGINT REFERENCES users(user_id),

    CONSTRAINT ck_report_submission_type CHECK (
        report_type IN ('AT_RISK', 'INTERVENTION', 'LEARNER_PROGRESS', 'CLASS_LIST', 'ATTENDANCE')
    ),
    CONSTRAINT ck_report_submission_status CHECK (
        status IN ('UNREVIEWED', 'REVIEWED')
    )
);

-- Re-applied on every startup (db_bootstrap.py) -- if the table already
-- existed from before CLASS_LIST/ATTENDANCE were added as sendable report
-- types, CREATE TABLE IF NOT EXISTS above is a no-op, so the constraint
-- needs its own explicit, idempotent widen.
ALTER TABLE teacher_report_submission DROP CONSTRAINT IF EXISTS ck_report_submission_type;
ALTER TABLE teacher_report_submission ADD CONSTRAINT ck_report_submission_type CHECK (
    report_type IN ('AT_RISK', 'INTERVENTION', 'LEARNER_PROGRESS', 'CLASS_LIST', 'ATTENDANCE')
);

CREATE INDEX IF NOT EXISTS idx_report_submission_status ON teacher_report_submission(status);
CREATE INDEX IF NOT EXISTS idx_report_submission_teacher ON teacher_report_submission(teacher_id);

-- New notification type so a submission can page every admin the same way
-- risk/intervention alerts already page teachers.
ALTER TABLE notification DROP CONSTRAINT IF EXISTS ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (
    notification_type IN ('INFO', 'RISK', 'INTERVENTION', 'SYSTEM', 'SUCCESS', 'WARNING', 'REPORT')
);

COMMIT;
