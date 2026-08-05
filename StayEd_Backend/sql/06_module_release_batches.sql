-- Modules are released to a learner as a batch (multiple modules across one or
-- more learning strands, released together in one transaction), but module_record
-- had no column grouping rows released together. Add module_release_batch and a
-- release_batch_id FK on module_record so the Module Release Logbook can show and
-- return modules batch-by-batch instead of one row at a time. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS module_release_batch (
    release_batch_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    release_date DATE NOT NULL,
    recorded_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_release_batch_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_module_release_batch_teacher
        FOREIGN KEY (recorded_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_module_release_batch_enrollment
    ON module_release_batch(enrollment_id);

ALTER TABLE module_record
    ADD COLUMN IF NOT EXISTS release_batch_id BIGINT
    REFERENCES module_release_batch(release_batch_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

-- Backfill: group any pre-existing module_record rows (released before this
-- feature existed) into synthetic batches by (enrollment_id, date_released) so
-- release history isn't lost.
INSERT INTO module_release_batch (enrollment_id, release_date, recorded_by_teacher_id, created_at)
SELECT enrollment_id, date_released, MIN(recorded_by_teacher_id), MIN(created_at)
FROM module_record
WHERE release_batch_id IS NULL
GROUP BY enrollment_id, date_released;

UPDATE module_record mr
SET release_batch_id = b.release_batch_id
FROM module_release_batch b
WHERE mr.release_batch_id IS NULL
  AND mr.enrollment_id = b.enrollment_id
  AND mr.date_released = b.release_date;

ALTER TABLE module_record
    ALTER COLUMN release_batch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_record_release_batch
    ON module_record(release_batch_id);

COMMIT;
