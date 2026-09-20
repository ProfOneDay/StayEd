BEGIN;

ALTER TABLE module_record
    ADD COLUMN IF NOT EXISTS pretest_score NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS pretest_total NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS posttest_score NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS posttest_total NUMERIC(6,2);

CREATE TABLE IF NOT EXISTS als_assessment (
    als_assessment_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL REFERENCES class_enrollment(enrollment_id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL CHECK (level IN ('ELEMENTARY','SECONDARY')),
    test_date DATE NOT NULL,
    score NUMERIC(6,2),
    total_score NUMERIC(6,2),
    result VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PASSED','FAILED','PENDING')),
    remarks TEXT,
    recorded_by_teacher_id BIGINT REFERENCES teacher(teacher_id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_als_assessment_enrollment ON als_assessment(enrollment_id);

COMMIT;
