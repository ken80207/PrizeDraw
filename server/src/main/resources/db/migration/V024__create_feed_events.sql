CREATE TABLE IF NOT EXISTS feed_events (
    id              UUID PRIMARY KEY,
    draw_id         VARCHAR(255) NOT NULL,
    player_id       UUID NOT NULL,
    player_nickname VARCHAR(255) NOT NULL,
    player_avatar_url TEXT,
    campaign_id     UUID NOT NULL,
    campaign_title  VARCHAR(255) NOT NULL,
    campaign_type   VARCHAR(20) NOT NULL,
    prize_grade     VARCHAR(50) NOT NULL,
    prize_name      VARCHAR(255) NOT NULL,
    prize_photo_url TEXT,
    drawn_at        TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_events_drawn_at ON feed_events (drawn_at DESC);
