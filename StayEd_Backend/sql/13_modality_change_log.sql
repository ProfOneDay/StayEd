-- Learner Profile needs an audit trail of modality changes (e.g. Face-to-Face
-- -> Modular) so Monitoring History can show when and why a switch happened,
-- without cluttering the main profile with a running list. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS modality_change_log (
    modality_change_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    old_modality VARCHAR(30),
    new_modality VARCHAR(30) NOT NULL,
    change_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    changed_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_modality_change_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_modality_change_teacher
        FOREIGN KEY (changed_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_modality_change_new_modality
        CHECK (new_modality IN ('FACE_TO_FACE', 'MODULAR', 'BLENDED'))
);

CREATE INDEX IF NOT EXISTS idx_modality_change_enrollment
    ON modality_change_log(enrollment_id);

COMMIT;
