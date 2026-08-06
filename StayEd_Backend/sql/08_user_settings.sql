-- Settings pages (teacher System Settings, teacher Profile Settings, Admin
-- Settings) were fully mock/cosmetic -- toggles and the avatar preview never
-- persisted anywhere. This adds real, generic storage: a JSONB bag for
-- arbitrary preference toggles (shared across all three settings pages) and
-- a base64 avatar column (no disk/static-serving infrastructure needed at
-- this project's scale). Safe to re-run.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar TEXT;

COMMIT;
