CREATE TABLE campaign_favorites (
    player_id     UUID NOT NULL REFERENCES players(id),
    campaign_type VARCHAR(16) NOT NULL,
    campaign_id   UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, campaign_type, campaign_id)
);

CREATE INDEX idx_favorites_campaign
    ON campaign_favorites(campaign_type, campaign_id);

-- Notification deduplication support
ALTER TABLE notifications ADD COLUMN dedup_key VARCHAR(256);
CREATE UNIQUE INDEX idx_notifications_dedup
    ON notifications(dedup_key) WHERE dedup_key IS NOT NULL;

-- Low-stock notification tracking
ALTER TABLE kuji_campaigns ADD COLUMN low_stock_notified_at TIMESTAMPTZ;
