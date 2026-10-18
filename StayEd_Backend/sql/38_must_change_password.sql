-- Accounts holding an admin-issued temporary password (created directly by
-- an admin, or after an admin "Reset password") must pick their own
-- password before they can use StayEd. Set TRUE by admin_routes when it
-- generates a temporary password; cleared by any successful password
-- change/reset (auth_routes). While TRUE, the JWT carries
-- must_change_password and every API call except setting a new password
-- is refused (see app/__init__.py).
BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
