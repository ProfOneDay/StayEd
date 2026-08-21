-- Adds the CLC profile fields collected by the "Add New CLC" form
-- (StayEd_Frontend/pages/teacher/clc-details.html) that the original core
-- schema had no columns for. Written to be safe to re-run: every statement
-- is guarded so applying this against a database that already has these
-- columns is a no-op, unlike 00_core_schema.sql which is destructive.

BEGIN;

ALTER TABLE clc
    ADD COLUMN IF NOT EXISTS learning_level VARCHAR(30),
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS province VARCHAR(150),
    ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS coordinator_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS coordinator_email VARCHAR(150);

ALTER TABLE clc
    DROP CONSTRAINT IF EXISTS ck_clc_learning_level;

ALTER TABLE clc
    ADD CONSTRAINT ck_clc_learning_level
    CHECK (
        learning_level IS NULL
        OR learning_level IN (
            'BLP',
            'ELEMENTARY',
            'JUNIOR_HIGH_SCHOOL',
            'SENIOR_HIGH_SCHOOL'
        )
    );

COMMIT;