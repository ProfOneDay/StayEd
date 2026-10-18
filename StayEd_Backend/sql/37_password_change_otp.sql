-- One-time codes emailed to a logged-in user to confirm a password change
-- (POST /auth/change-password/request-code, then /auth/change-password).
-- Only a hash of the 6-digit code is stored. A code dies after 10 minutes,
-- after 5 wrong tries, once used, or when a newer code is requested.
BEGIN;

CREATE TABLE IF NOT EXISTS password_change_otp (
    otp_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_change_otp_user
    ON password_change_otp(user_id, created_at DESC);

COMMIT;
