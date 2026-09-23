BEGIN;

CREATE TABLE IF NOT EXISTS als_assessment_scores (
    als_assessment_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL UNIQUE REFERENCES class_enrollment(enrollment_id) ON DELETE CASCADE,
    date_of_assessment DATE,
    scores JSONB NOT NULL DEFAULT '{}',
    portfolio JSONB NOT NULL DEFAULT '{}',
    final_score_percentage_grade NUMERIC(6,2),
    overall_final_assessment_rating NUMERIC(6,2),
    updated_by_teacher_id BIGINT REFERENCES teacher(teacher_id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
