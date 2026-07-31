BEGIN;

-- ============================================================================
-- 1. CLEANUP
-- ============================================================================

DROP VIEW IF EXISTS vw_learner_monitoring_summary CASCADE;
DROP VIEW IF EXISTS vw_risk_assessment_display CASCADE;
DROP VIEW IF EXISTS vw_contact_summary CASCADE;
DROP VIEW IF EXISTS vw_session_attendance_summary CASCADE;
DROP VIEW IF EXISTS vw_module_progress CASCADE;
DROP VIEW IF EXISTS vw_learner_enrollment_profile CASCADE;

-- Old assessment views from the previous schema
DROP VIEW IF EXISTS vw_blp_assessment_summary CASCADE;
DROP VIEW IF EXISTS vw_score_improvement CASCADE;
DROP VIEW IF EXISTS vw_learning_strand_performance CASCADE;
DROP VIEW IF EXISTS vw_assessment_progress CASCADE;

DROP TABLE IF EXISTS follow_up CASCADE;
DROP TABLE IF EXISTS intervention CASCADE;
DROP TABLE IF EXISTS risk_factors CASCADE;
DROP TABLE IF EXISTS risk_assessment CASCADE;
DROP TABLE IF EXISTS model_metrics CASCADE;
DROP TABLE IF EXISTS model_info CASCADE;

-- Old assessment tables removed in this version
DROP TABLE IF EXISTS blp_assessment_result CASCADE;
DROP TABLE IF EXISTS blp_assessment_area CASCADE;
DROP TABLE IF EXISTS assessment_result CASCADE;
DROP TABLE IF EXISTS assessment CASCADE;
DROP TABLE IF EXISTS assessment_component CASCADE;

DROP TABLE IF EXISTS contact_log CASCADE;
DROP TABLE IF EXISTS session_attendance CASCADE;
DROP TABLE IF EXISTS class_session CASCADE;
DROP TABLE IF EXISTS module_record CASCADE;
DROP TABLE IF EXISTS learning_strand CASCADE;
DROP TABLE IF EXISTS class_enrollment CASCADE;
DROP TABLE IF EXISTS learner CASCADE;
DROP TABLE IF EXISTS learning_class CASCADE;
DROP TABLE IF EXISTS teacher_clc CASCADE;
DROP TABLE IF EXISTS clc CASCADE;
DROP TABLE IF EXISTS teacher CASCADE;
DROP TABLE IF EXISTS user_activity_log CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS assign_module_status() CASCADE;
DROP FUNCTION IF EXISTS assign_risk_level() CASCADE;

-- ============================================================================
-- 2. USER AND ORGANIZATIONAL TABLES
-- ============================================================================

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email VARCHAR(150) UNIQUE,
    role VARCHAR(20) NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_users_role
        CHECK (role IN ('ADMIN', 'COORDINATOR', 'TEACHER')),

    CONSTRAINT ck_users_account_status
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),

    CONSTRAINT ck_users_username_not_blank
        CHECK (BTRIM(username) <> ''),

    CONSTRAINT ck_users_email_not_blank
        CHECK (email IS NULL OR BTRIM(email) <> '')
);

CREATE TABLE teacher (
    teacher_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(30),
    municipality VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_teacher_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_teacher_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT ck_teacher_employee_id_not_blank
        CHECK (BTRIM(employee_id) <> ''),

    CONSTRAINT ck_teacher_name_not_blank
        CHECK (BTRIM(first_name) <> '' AND BTRIM(last_name) <> '')
);

CREATE TABLE clc (
    clc_id BIGSERIAL PRIMARY KEY,
    clc_name VARCHAR(200) NOT NULL,
    municipality VARCHAR(150) NOT NULL,
    barangay VARCHAR(150),
    address TEXT,
    cluster_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_clc_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT ck_clc_name_not_blank
        CHECK (BTRIM(clc_name) <> ''),

    CONSTRAINT ck_clc_municipality_not_blank
        CHECK (BTRIM(municipality) <> '')
);

CREATE UNIQUE INDEX uq_clc_location
    ON clc (
        LOWER(clc_name),
        LOWER(municipality),
        LOWER(COALESCE(barangay, ''))
    );

CREATE TABLE teacher_clc (
    teacher_clc_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    clc_id BIGINT NOT NULL,
    school_year VARCHAR(9) NOT NULL,
    assignment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT fk_teacher_clc_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_teacher_clc_clc
        FOREIGN KEY (clc_id)
        REFERENCES clc(clc_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_teacher_clc_assignment
        UNIQUE (teacher_id, clc_id, school_year),

    CONSTRAINT ck_teacher_clc_school_year
        CHECK (school_year ~ '^[0-9]{4}-[0-9]{4}$'),

    CONSTRAINT ck_teacher_clc_assignment_status
        CHECK (assignment_status IN ('ACTIVE', 'INACTIVE', 'COMPLETED'))
);

-- ============================================================================
-- 3. CLASS AND LEARNER ENROLLMENT TABLES
-- ============================================================================

CREATE TABLE learning_class (
    class_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    clc_id BIGINT NOT NULL,
    school_year VARCHAR(9) NOT NULL,
    semester VARCHAR(20) NOT NULL,
    learning_level VARCHAR(30) NOT NULL,
    class_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_learning_class_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_learning_class_clc
        FOREIGN KEY (clc_id)
        REFERENCES clc(clc_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_learning_class_school_year
        CHECK (school_year ~ '^[0-9]{4}-[0-9]{4}$'),

    CONSTRAINT ck_learning_class_semester
        CHECK (semester IN ('FIRST', 'SECOND', 'SUMMER', 'WHOLE_YEAR')),

    CONSTRAINT ck_learning_class_level
        CHECK (
            learning_level IN (
                'BLP',
                'ELEMENTARY',
                'JUNIOR_HIGH_SCHOOL',
                'SENIOR_HIGH_SCHOOL'
            )
        ),

    CONSTRAINT ck_learning_class_status
        CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX uq_learning_class_identity
    ON learning_class (
        teacher_id,
        clc_id,
        school_year,
        semester,
        learning_level,
        LOWER(COALESCE(class_name, ''))
    );

CREATE TABLE learner (
    learner_id BIGSERIAL PRIMARY KEY,
    lrn VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    sex VARCHAR(20) NOT NULL,
    date_of_birth DATE NOT NULL,
    employment_status VARCHAR(50),
    civil_status VARCHAR(30),
    contact_number VARCHAR(30),
    guardian_contact_number VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_learner_lrn
        CHECK (lrn ~ '^[0-9]{12}$'),

    CONSTRAINT ck_learner_sex
        CHECK (sex IN ('MALE', 'FEMALE')),

    CONSTRAINT ck_learner_date_of_birth
        CHECK (date_of_birth >= DATE '1900-01-01'),

    CONSTRAINT ck_learner_name_not_blank
        CHECK (BTRIM(first_name) <> '' AND BTRIM(last_name) <> '')
);

CREATE TABLE class_enrollment (
    enrollment_id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    learning_modality VARCHAR(30) NOT NULL,
    is_re_enrollee BOOLEAN,
    distance_from_clc_km NUMERIC(6,2),
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_class_enrollment_class
        FOREIGN KEY (class_id)
        REFERENCES learning_class(class_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_class_enrollment_learner
        FOREIGN KEY (learner_id)
        REFERENCES learner(learner_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_class_enrollment
        UNIQUE (class_id, learner_id),

    CONSTRAINT ck_class_enrollment_modality
        CHECK (
            learning_modality IN ('FACE_TO_FACE', 'MODULAR', 'BLENDED')
        ),

    CONSTRAINT ck_class_enrollment_distance
        CHECK (
            distance_from_clc_km IS NULL
            OR distance_from_clc_km >= 0
        ),

    CONSTRAINT ck_class_enrollment_status
        CHECK (
            enrollment_status IN (
                'ENROLLED',
                'COMPLETED',
                'DROPPED',
                'WITHDRAWN'
            )
        )
);

-- ============================================================================
-- 4. MODULE, ATTENDANCE, AND CONTACT MONITORING TABLES
-- ============================================================================

CREATE TABLE learning_strand (
    learning_strand_id BIGSERIAL PRIMARY KEY,
    strand_code VARCHAR(10) NOT NULL UNIQUE,
    strand_name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT ck_learning_strand_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT ck_learning_strand_code_not_blank
        CHECK (BTRIM(strand_code) <> ''),

    CONSTRAINT ck_learning_strand_name_not_blank
        CHECK (BTRIM(strand_name) <> '')
);

CREATE TABLE module_record (
    module_record_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    learning_strand_id BIGINT NOT NULL,
    module_name VARCHAR(250) NOT NULL,
    date_released DATE NOT NULL,
    date_returned DATE,
    module_status VARCHAR(20) NOT NULL DEFAULT 'RELEASED',
    recorded_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_module_record_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_module_record_strand
        FOREIGN KEY (learning_strand_id)
        REFERENCES learning_strand(learning_strand_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_module_record_teacher
        FOREIGN KEY (recorded_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_module_record_status
        CHECK (module_status IN ('RELEASED', 'RETURNED')),

    CONSTRAINT ck_module_record_dates
        CHECK (
            date_returned IS NULL
            OR date_returned >= date_released
        ),

    CONSTRAINT ck_module_record_name_not_blank
        CHECK (BTRIM(module_name) <> '')
);

CREATE UNIQUE INDEX uq_module_record
    ON module_record (
        enrollment_id,
        learning_strand_id,
        LOWER(module_name),
        date_released
    );

CREATE TABLE class_session (
    session_id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    session_date DATE NOT NULL,
    session_topic VARCHAR(250),
    session_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    created_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_class_session_class
        FOREIGN KEY (class_id)
        REFERENCES learning_class(class_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_class_session_teacher
        FOREIGN KEY (created_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_class_session_status
        CHECK (session_status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED'))
);

CREATE TABLE session_attendance (
    attendance_id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    attendance_status VARCHAR(20) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_session_attendance_session
        FOREIGN KEY (session_id)
        REFERENCES class_session(session_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_session_attendance_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_session_attendance
        UNIQUE (session_id, enrollment_id),

    CONSTRAINT ck_session_attendance_status
        CHECK (attendance_status IN ('PRESENT', 'ABSENT', 'EXCUSED'))
);

CREATE TABLE contact_log (
    contact_log_id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    contact_date DATE NOT NULL,
    contact_method VARCHAR(30) NOT NULL,
    contact_result VARCHAR(20) NOT NULL,
    notes TEXT,
    recorded_by_teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_contact_log_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_contact_log_teacher
        FOREIGN KEY (recorded_by_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_contact_log_method
        CHECK (
            contact_method IN ('CALL', 'SMS', 'CHAT', 'HOME_VISIT', 'OTHER')
        ),

    CONSTRAINT ck_contact_log_result
        CHECK (contact_result IN ('SUCCESSFUL', 'UNSUCCESSFUL'))
);

-- ============================================================================
-- 5. MODEL, RISK, INTERVENTION, AND AUDIT TABLES
-- ============================================================================

CREATE TABLE model_info (
    model_id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(150) NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL UNIQUE,
    training_date DATE NOT NULL,
    model_status VARCHAR(20) NOT NULL DEFAULT 'TRAINING',
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_model_info_status
        CHECK (
            model_status IN ('TRAINING', 'ACTIVE', 'INACTIVE', 'ARCHIVED')
        ),

    CONSTRAINT ck_model_info_not_blank
        CHECK (
            BTRIM(model_name) <> ''
            AND BTRIM(algorithm) <> ''
            AND BTRIM(model_version) <> ''
        )
);

CREATE TABLE model_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    model_id BIGINT NOT NULL,
    metric_name VARCHAR(30) NOT NULL,
    metric_value NUMERIC(8,6) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_model_metrics_model
        FOREIGN KEY (model_id)
        REFERENCES model_info(model_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_model_metric
        UNIQUE (model_id, metric_name),

    CONSTRAINT ck_model_metric_name
        CHECK (
            metric_name IN (
                'ACCURACY',
                'PRECISION',
                'RECALL',
                'F1_SCORE',
                'ROC_AUC'
            )
        ),

    CONSTRAINT ck_model_metric_value
        CHECK (metric_value BETWEEN 0 AND 1)
);

CREATE TABLE risk_assessment (
    risk_assessment_id BIGSERIAL PRIMARY KEY,
    model_id BIGINT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    monitoring_start_date DATE NOT NULL,
    monitoring_end_date DATE NOT NULL,
    data_sufficiency_status VARCHAR(30) NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    risk_probability NUMERIC(6,5),
    risk_level VARCHAR(20),
    assessment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_risk_assessment_model
        FOREIGN KEY (model_id)
        REFERENCES model_info(model_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_risk_assessment_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES class_enrollment(enrollment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_risk_assessment_user
        FOREIGN KEY (generated_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT uq_risk_assessment_period
        UNIQUE (
            model_id,
            enrollment_id,
            monitoring_start_date,
            monitoring_end_date
        ),

    CONSTRAINT ck_risk_monitoring_dates
        CHECK (monitoring_end_date >= monitoring_start_date),

    CONSTRAINT ck_risk_data_sufficiency
        CHECK (
            data_sufficiency_status IN (
                'INSUFFICIENT_DATA',
                'ELIGIBLE',
                'PREDICTION_GENERATED'
            )
        ),

    CONSTRAINT ck_risk_probability
        CHECK (
            risk_probability IS NULL
            OR risk_probability BETWEEN 0 AND 1
        ),

    CONSTRAINT ck_risk_level
        CHECK (
            risk_level IS NULL
            OR risk_level IN ('LOW', 'MODERATE', 'HIGH')
        )
);

CREATE TABLE risk_factors (
    risk_factor_id BIGSERIAL PRIMARY KEY,
    risk_assessment_id BIGINT NOT NULL,
    factor_name VARCHAR(150) NOT NULL,
    factor_value NUMERIC(12,4),
    importance_score NUMERIC(8,6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_risk_factors_assessment
        FOREIGN KEY (risk_assessment_id)
        REFERENCES risk_assessment(risk_assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_risk_factor_name
        UNIQUE (risk_assessment_id, factor_name),

    CONSTRAINT ck_risk_factor_name_not_blank
        CHECK (BTRIM(factor_name) <> ''),

    CONSTRAINT ck_risk_factor_importance
        CHECK (
            importance_score IS NULL
            OR importance_score BETWEEN 0 AND 1
        )
);

CREATE TABLE intervention (
    intervention_id BIGSERIAL PRIMARY KEY,
    risk_assessment_id BIGINT NOT NULL,
    assigned_to_teacher_id BIGINT NOT NULL,
    intervention_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    date_assigned DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE,
    date_completed DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_intervention_risk
        FOREIGN KEY (risk_assessment_id)
        REFERENCES risk_assessment(risk_assessment_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_intervention_teacher
        FOREIGN KEY (assigned_to_teacher_id)
        REFERENCES teacher(teacher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_intervention_status
        CHECK (
            status IN ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED')
        ),

    CONSTRAINT ck_intervention_dates
        CHECK (
            (target_date IS NULL OR target_date >= date_assigned)
            AND
            (date_completed IS NULL OR date_completed >= date_assigned)
        ),

    CONSTRAINT ck_intervention_not_blank
        CHECK (
            BTRIM(intervention_type) <> ''
            AND BTRIM(description) <> ''
        )
);

CREATE TABLE follow_up (
    follow_up_id BIGSERIAL PRIMARY KEY,
    intervention_id BIGINT NOT NULL,
    follow_up_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    outcome VARCHAR(100),
    created_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_follow_up_intervention
        FOREIGN KEY (intervention_id)
        REFERENCES intervention(intervention_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_follow_up_user
        FOREIGN KEY (created_by_user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE user_activity_log (
    activity_log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(150) NOT NULL,
    table_name VARCHAR(100),
    record_id BIGINT,
    description TEXT,
    ip_address INET,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_activity_log_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_user_activity_action_not_blank
        CHECK (BTRIM(action) <> '')
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX idx_teacher_clc_teacher
    ON teacher_clc(teacher_id);

CREATE INDEX idx_teacher_clc_clc
    ON teacher_clc(clc_id);

CREATE INDEX idx_learning_class_teacher
    ON learning_class(teacher_id);

CREATE INDEX idx_learning_class_clc
    ON learning_class(clc_id);

CREATE INDEX idx_learning_class_period
    ON learning_class(school_year, semester, learning_level);

CREATE INDEX idx_class_enrollment_class
    ON class_enrollment(class_id);

CREATE INDEX idx_class_enrollment_learner
    ON class_enrollment(learner_id);

CREATE INDEX idx_class_enrollment_status
    ON class_enrollment(enrollment_status);

CREATE INDEX idx_module_record_enrollment
    ON module_record(enrollment_id);

CREATE INDEX idx_module_record_strand
    ON module_record(learning_strand_id);

CREATE INDEX idx_module_record_release_date
    ON module_record(date_released);

CREATE INDEX idx_module_record_return_date
    ON module_record(date_returned);

CREATE INDEX idx_class_session_class_date
    ON class_session(class_id, session_date);

CREATE INDEX idx_session_attendance_enrollment
    ON session_attendance(enrollment_id);

CREATE INDEX idx_contact_log_enrollment_date
    ON contact_log(enrollment_id, contact_date);

CREATE INDEX idx_model_metrics_model
    ON model_metrics(model_id);

CREATE INDEX idx_risk_assessment_enrollment_date
    ON risk_assessment(enrollment_id, assessment_date);

CREATE INDEX idx_risk_assessment_level
    ON risk_assessment(risk_level);

CREATE INDEX idx_risk_factors_assessment
    ON risk_factors(risk_assessment_id);

CREATE INDEX idx_intervention_risk
    ON intervention(risk_assessment_id);

CREATE INDEX idx_intervention_teacher_status
    ON intervention(assigned_to_teacher_id, status);

CREATE INDEX idx_follow_up_intervention
    ON follow_up(intervention_id);

CREATE INDEX idx_activity_log_user_date
    ON user_activity_log(user_id, created_at);

-- ============================================================================
-- 7. AUTOMATIC UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teacher_updated_at
BEFORE UPDATE ON teacher
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_clc_updated_at
BEFORE UPDATE ON clc
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_learning_class_updated_at
BEFORE UPDATE ON learning_class
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_learner_updated_at
BEFORE UPDATE ON learner
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_enrollment_updated_at
BEFORE UPDATE ON class_enrollment
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_module_record_updated_at
BEFORE UPDATE ON module_record
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_intervention_updated_at
BEFORE UPDATE ON intervention
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 8. AUTOMATIC MODULE STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_module_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_returned IS NULL THEN
        NEW.module_status := 'RELEASED';
    ELSE
        NEW.module_status := 'RETURNED';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_module_status
BEFORE INSERT OR UPDATE OF date_returned
ON module_record
FOR EACH ROW
EXECUTE FUNCTION assign_module_status();

-- ============================================================================
-- 9. AUTOMATIC RISK LEVEL
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_risk_level()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.data_sufficiency_status = 'PREDICTION_GENERATED' THEN

        IF NEW.risk_probability IS NULL THEN
            RAISE EXCEPTION
                'risk_probability is required when prediction is generated';
        END IF;

        IF NEW.risk_probability < 0.40 THEN
            NEW.risk_level := 'LOW';
        ELSIF NEW.risk_probability < 0.70 THEN
            NEW.risk_level := 'MODERATE';
        ELSE
            NEW.risk_level := 'HIGH';
        END IF;

    ELSE

        IF NEW.risk_probability IS NOT NULL
           OR NEW.risk_level IS NOT NULL THEN
            RAISE EXCEPTION
                'Risk probability and risk level must remain NULL until prediction is generated';
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_risk_level
BEFORE INSERT OR UPDATE OF data_sufficiency_status, risk_probability
ON risk_assessment
FOR EACH ROW
EXECUTE FUNCTION assign_risk_level();

-- ============================================================================
-- 10. PREDEFINED LEARNING STRANDS
-- ============================================================================

INSERT INTO learning_strand (strand_code, strand_name)
VALUES
    ('LS1', 'Communication Skills'),
    ('LS2', 'Scientific Literacy and Critical Thinking'),
    ('LS3', 'Mathematical and Problem-Solving Skills'),
    ('LS4', 'Life and Career Skills'),
    ('LS5', 'Understanding the Self and Society'),
    ('LS6', 'Digital Citizenship');

-- ============================================================================
-- 11. COMPUTED VIEWS
-- ============================================================================

-- Learner profile with age computed from date of birth.
CREATE VIEW vw_learner_enrollment_profile AS
SELECT
    ce.enrollment_id,
    l.learner_id,
    l.lrn,
    l.last_name,
    l.first_name,
    l.middle_name,
    l.sex,
    l.date_of_birth,
    DATE_PART(
        'year',
        AGE(CURRENT_DATE, l.date_of_birth)
    )::INT AS current_age,
    DATE_PART(
        'year',
        AGE(ce.enrollment_date, l.date_of_birth)
    )::INT AS age_at_enrollment,
    l.employment_status,
    l.civil_status,
    l.contact_number,
    l.guardian_contact_number,
    ce.learning_modality,
    ce.is_re_enrollee,
    ce.distance_from_clc_km,
    ce.enrollment_date,
    ce.enrollment_status,
    lc.class_id,
    lc.school_year,
    lc.semester,
    lc.learning_level,
    lc.class_name,
    c.clc_id,
    c.clc_name,
    c.municipality,
    c.barangay,
    t.teacher_id,
    CONCAT_WS(
        ' ',
        t.first_name,
        t.middle_name,
        t.last_name
    ) AS teacher_name
FROM class_enrollment ce
JOIN learner l
    ON l.learner_id = ce.learner_id
JOIN learning_class lc
    ON lc.class_id = ce.class_id
JOIN clc c
    ON c.clc_id = lc.clc_id
JOIN teacher t
    ON t.teacher_id = lc.teacher_id;

-- Module release/return totals and completion progress.
CREATE VIEW vw_module_progress AS
SELECT
    ce.enrollment_id,

    COUNT(mr.module_record_id)
        AS total_modules_released,

    COUNT(mr.module_record_id) FILTER (
        WHERE mr.date_returned IS NOT NULL
    ) AS total_modules_returned,

    COUNT(mr.module_record_id) FILTER (
        WHERE mr.date_returned IS NULL
    ) AS modules_not_yet_returned,

    ROUND(
        100.0 *
        COUNT(mr.module_record_id) FILTER (
            WHERE mr.date_returned IS NOT NULL
        )
        /
        NULLIF(COUNT(mr.module_record_id), 0),
        2
    ) AS module_completion_progress_percent,

    MAX(mr.date_released)
        AS latest_module_release_date,

    MAX(mr.date_returned)
        AS latest_module_return_date

FROM class_enrollment ce
LEFT JOIN module_record mr
    ON mr.enrollment_id = ce.enrollment_id
GROUP BY ce.enrollment_id;

-- Face-to-face and blended attendance summary.
CREATE VIEW vw_session_attendance_summary AS
SELECT
    ce.enrollment_id,

    COUNT(cs.session_id) FILTER (
        WHERE cs.session_status <> 'CANCELLED'
    ) AS total_scheduled_sessions,

    COUNT(sa.attendance_id) FILTER (
        WHERE sa.attendance_status = 'PRESENT'
    ) AS total_sessions_attended,

    COUNT(sa.attendance_id) FILTER (
        WHERE sa.attendance_status = 'ABSENT'
    ) AS total_sessions_missed,

    ROUND(
        100.0 *
        COUNT(sa.attendance_id) FILTER (
            WHERE sa.attendance_status = 'PRESENT'
        )
        /
        NULLIF(
            COUNT(cs.session_id) FILTER (
                WHERE cs.session_status <> 'CANCELLED'
            ),
            0
        ),
        2
    ) AS session_attendance_rate_percent

FROM class_enrollment ce
LEFT JOIN class_session cs
    ON cs.class_id = ce.class_id
LEFT JOIN session_attendance sa
    ON sa.session_id = cs.session_id
   AND sa.enrollment_id = ce.enrollment_id
GROUP BY ce.enrollment_id;

-- Modular contact summary.
CREATE VIEW vw_contact_summary AS
SELECT
    ce.enrollment_id,

    COUNT(cl.contact_log_id) FILTER (
        WHERE cl.contact_result = 'SUCCESSFUL'
    ) AS total_successful_contacts,

    COUNT(cl.contact_log_id) FILTER (
        WHERE cl.contact_result = 'UNSUCCESSFUL'
    ) AS total_unsuccessful_contacts,

    MAX(cl.contact_date)
        AS last_contact_date

FROM class_enrollment ce
LEFT JOIN contact_log cl
    ON cl.enrollment_id = ce.enrollment_id
GROUP BY ce.enrollment_id;

-- Risk probability displayed as a percentage.
CREATE VIEW vw_risk_assessment_display AS
SELECT
    ra.risk_assessment_id,
    ra.enrollment_id,
    ra.model_id,
    ra.monitoring_start_date,
    ra.monitoring_end_date,
    ra.data_sufficiency_status,
    ra.risk_probability,
    ROUND(
        ra.risk_probability * 100,
        2
    ) AS risk_probability_percent,
    ra.risk_level,
    ra.assessment_date,
    ra.generated_by_user_id
FROM risk_assessment ra;

-- Combined monitoring summary for the dashboard and prediction workflow.
CREATE VIEW vw_learner_monitoring_summary AS
SELECT
    lep.enrollment_id,
    lep.learner_id,
    lep.lrn,
    lep.last_name,
    lep.first_name,
    lep.middle_name,
    lep.sex,
    lep.current_age,
    lep.age_at_enrollment,
    lep.learning_modality,
    lep.school_year,
    lep.semester,
    lep.learning_level,
    lep.class_name,
    lep.clc_name,
    lep.municipality,
    lep.teacher_id,
    lep.teacher_name,

    COALESCE(mp.total_modules_released, 0)
        AS total_modules_released,

    COALESCE(mp.total_modules_returned, 0)
        AS total_modules_returned,

    COALESCE(mp.modules_not_yet_returned, 0)
        AS modules_not_yet_returned,

    mp.module_completion_progress_percent,

    COALESCE(sas.total_scheduled_sessions, 0)
        AS total_scheduled_sessions,

    COALESCE(sas.total_sessions_attended, 0)
        AS total_sessions_attended,

    COALESCE(sas.total_sessions_missed, 0)
        AS total_sessions_missed,

    sas.session_attendance_rate_percent,

    COALESCE(cs.total_successful_contacts, 0)
        AS total_successful_contacts,

    COALESCE(cs.total_unsuccessful_contacts, 0)
        AS total_unsuccessful_contacts,

    cs.last_contact_date

FROM vw_learner_enrollment_profile lep
LEFT JOIN vw_module_progress mp
    ON mp.enrollment_id = lep.enrollment_id
LEFT JOIN vw_session_attendance_summary sas
    ON sas.enrollment_id = lep.enrollment_id
LEFT JOIN vw_contact_summary cs
    ON cs.enrollment_id = lep.enrollment_id;

COMMIT;

-- ============================================================================
-- 12. OPTIONAL QUICK CHECKS
-- ============================================================================

-- Show all StayEd tables:
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- Show all StayEd views:
-- SELECT table_name
-- FROM information_schema.views
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- Check predefined learning strands:
-- SELECT * FROM learning_strand ORDER BY strand_code;

-- End of updated StayEd schema.