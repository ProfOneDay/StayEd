-- Super admin + scoped admin permissions.
--
-- Every admin keeps baseline dashboard access; these two flags are
-- additive "can also edit this area" permissions on top of that baseline.
-- is_super_admin bypasses both flags entirely (always full access) and is
-- the only one who can assign admin_title/the two flags/other admins'
-- super-admin status (see admin_routes.py's new /admin/admins endpoints).
--
-- Existing admin accounts predate this system and were already trusted
-- with full access, so they're backfilled once to keep exactly that --
-- both flags on, and promoted to super_admin so at least one person can
-- use the new assignment screen the moment this migration runs. Any admin
-- created after this point defaults to no permissions until a super admin
-- assigns some, which is the safe-by-default direction for a new account.
--
-- This backfill must run exactly once, not on every restart like the rest
-- of this file's IF NOT EXISTS additions -- otherwise a super admin
-- deliberately demoting someone (removing a flag, or the super_admin bit
-- itself) would get silently undone the next time the backend restarts.
-- data_seed_log (from 31_seed_division_ii_clcs.sql) already exists for
-- marking one-time backfills like this as done.
BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_manage_clcs BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS admin_title VARCHAR(100);

CREATE TABLE IF NOT EXISTS data_seed_log (
    seed_key VARCHAR(150) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH claimed_seed AS (
    INSERT INTO data_seed_log (seed_key)
    VALUES ('existing_admins_full_permissions_backfill')
    ON CONFLICT (seed_key) DO NOTHING
    RETURNING seed_key
)
UPDATE users
SET is_super_admin = TRUE,
    can_manage_clcs = TRUE,
    can_manage_users = TRUE,
    admin_title = COALESCE(admin_title, 'Supervisor')
WHERE role = 'ADMIN'
  AND EXISTS (SELECT 1 FROM claimed_seed);

COMMIT;
