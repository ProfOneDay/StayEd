-- StayEd Flask API support tables.
-- Run this AFTER 00_core_schema.sql inside stayed_db.

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_token (
    reset_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_token(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(30) NOT NULL DEFAULT 'INFO',
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_notification_type CHECK (
        notification_type IN ('INFO', 'RISK', 'INTERVENTION', 'SYSTEM', 'SUCCESS', 'WARNING')
    )
);
CREATE INDEX IF NOT EXISTS idx_notification_user_date ON notification(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notification(user_id, is_read);

CREATE TABLE IF NOT EXISTS learner_import_summary (
    import_summary_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    summary JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_import_summary_user_date ON learner_import_summary(user_id, created_at DESC);

COMMIT;
