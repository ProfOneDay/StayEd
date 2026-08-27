-- Module release was entirely per-learner (module_record/module_release_batch
-- are both scoped to a single enrollment_id), forcing a teacher to retype the
-- same module names once per student to "release Module 1" to a whole class.
-- Adds a class-level module catalog (what modules exist, defined once) that
-- new bulk releases tag module_record rows with, while release/return
-- tracking itself stays exactly as it was (per learner, via the existing
-- module_record/module_release_batch tables -- no backfill of historical
-- rows, they simply keep class_module_id NULL). Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS class_module (
    class_module_id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    learning_strand_id BIGINT NOT NULL,
    module_name VARCHAR(250) NOT NULL,
    sequence_number INT,
    created_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_class_module_class
        FOREIGN KEY (class_id)
        REFERENCES learning_class(class_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_class_module_strand
        FOREIGN KEY (learning_strand_id)
        REFERENCES learning_strand(learning_strand_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_class_module_teacher
        FOREIGN KEY (created_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_class_module_class
    ON class_module(class_id);

ALTER TABLE module_record
    ADD COLUMN IF NOT EXISTS class_module_id BIGINT
    REFERENCES class_module(class_module_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_module_record_class_module
    ON module_record(class_module_id);

COMMIT;
