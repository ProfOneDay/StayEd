-- Attendance checklists (Ticket 3) need to know who recorded them and
-- support correction after initial save. class_session/session_attendance
-- already existed but were never wired to any backend route -- add the
-- audit columns needed before building that wiring. Safe to re-run.

BEGIN;

ALTER TABLE session_attendance
    ADD COLUMN IF NOT EXISTS recorded_by_teacher_id BIGINT REFERENCES teacher(teacher_id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

COMMIT;