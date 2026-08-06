-- Generic key-value store for global, admin-controlled settings. First use:
-- active_school_year, previously hardcoded as "2026-2027" in four separate
-- request handlers (clc_routes.py x2, admin_routes.py x2) and a free-text
-- input in the teacher "Add New Class" modal. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS system_setting (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id BIGINT REFERENCES users(user_id)
);

INSERT INTO system_setting (setting_key, setting_value)
VALUES ('active_school_year', '2026-2027')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
