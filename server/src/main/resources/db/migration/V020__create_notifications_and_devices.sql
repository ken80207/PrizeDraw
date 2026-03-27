-- V020__create_notifications_and_devices.sql
-- Player notification history + FCM device token registry

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES players(id),
    event_type      VARCHAR(128) NOT NULL,
    title           VARCHAR(256) NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_player_unread
    ON notifications (player_id, is_read, created_at DESC)
    WHERE is_read = FALSE;

CREATE INDEX idx_notifications_player_created
    ON notifications (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES players(id),
    fcm_token       VARCHAR(512) NOT NULL,
    device_name     VARCHAR(128),
    platform        VARCHAR(32) NOT NULL,  -- 'ANDROID', 'IOS', 'WEB'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_player_devices_token UNIQUE (fcm_token)
);

CREATE INDEX idx_player_devices_player
    ON player_devices (player_id);
