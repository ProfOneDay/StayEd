-- Non-teacher accounts (admin, coordinator) have no `teacher` row, so they had
-- nowhere to store a name, phone number, etc. Adds those fields directly to
-- `users` for accounts that aren't backed by a `teacher` record. Safe to re-run.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(30);

COMMIT;