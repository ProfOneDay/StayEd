-- Creates the learner_session_schedule table used by the "Set Schedule"
-- feature for Face-to-Face and Blended learners (session date/time,
-- attendance status, and an optional note per enrollment). One row per
-- enrollment_id -- saving again updates the existing row via ON CONFLICT.
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS learner_session_schedule (
    schedule_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL UNIQUE,
    session_date DATE NOT NULL,
    session_time TIME,
    schedule_status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    note VARCHAR(2000),
    recorded_by_teacher_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_learner_session_schedule_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_learner_session_schedule_teacher
        FOREIGN KEY (recorded_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT ck_learner_session_schedule_status
        CHECK (
            schedule_status IN (
                'SCHEDULED', 'ATTENDANCE_PENDING', 'ATTENDED', 'ABSENT', 'EXCUSED'
            )
        )
);

COMMIT;