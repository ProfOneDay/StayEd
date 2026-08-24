-- Ticket 4: modules currently only show an actual release date, with no
-- expected/target return date, so there's no visible way to tell a module is
-- overdue. Adds a per-release planned_return_date (nullable -- populated at
-- release time, auto-calculated or teacher-overridden) plus a
-- system-configurable default duration used to pre-fill it. Safe to re-run.

BEGIN;

ALTER TABLE module_record
    ADD COLUMN IF NOT EXISTS planned_return_date DATE;

INSERT INTO system_setting (setting_key, setting_value)
VALUES ('default_module_duration_days', '21')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;