BEGIN;
CREATE TABLE IF NOT EXISTS follow_up_photo (
    photo_id BIGSERIAL PRIMARY KEY,
    follow_up_id BIGINT NOT NULL REFERENCES follow_up(follow_up_id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    image_data TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;