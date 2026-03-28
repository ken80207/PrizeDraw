-- V031__create_pity_system.sql
-- Pity system: guaranteed prize after N draws for unlimited campaigns

CREATE TYPE accumulation_mode AS ENUM ('PERSISTENT', 'SESSION');

CREATE TABLE pity_rules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID NOT NULL,
    campaign_type           VARCHAR(32) NOT NULL DEFAULT 'UNLIMITED',
    threshold               INTEGER NOT NULL CHECK (threshold >= 2),
    accumulation_mode       accumulation_mode NOT NULL DEFAULT 'PERSISTENT',
    session_timeout_seconds INTEGER CHECK (session_timeout_seconds > 0),
    enabled                 BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pity_rules_campaign UNIQUE (campaign_id)
);

CREATE INDEX idx_pity_rules_campaign_enabled
    ON pity_rules (campaign_id)
    WHERE enabled = true;

CREATE TRIGGER trg_pity_rules_updated_at
    BEFORE UPDATE ON pity_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE pity_prize_pool (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pity_rule_id        UUID NOT NULL REFERENCES pity_rules(id) ON DELETE CASCADE,
    prize_definition_id UUID NOT NULL REFERENCES prize_definitions(id) ON DELETE RESTRICT,
    weight              INTEGER NOT NULL CHECK (weight > 0),

    CONSTRAINT uq_pity_pool_rule_prize UNIQUE (pity_rule_id, prize_definition_id)
);

CREATE INDEX idx_pity_prize_pool_rule
    ON pity_prize_pool (pity_rule_id);

CREATE TABLE pity_trackers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pity_rule_id    UUID NOT NULL REFERENCES pity_rules(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    draw_count      INTEGER NOT NULL DEFAULT 0 CHECK (draw_count >= 0),
    last_draw_at    TIMESTAMPTZ,
    version         INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pity_tracker_rule_player UNIQUE (pity_rule_id, player_id)
);

CREATE INDEX idx_pity_trackers_player
    ON pity_trackers (player_id);

CREATE TRIGGER trg_pity_trackers_updated_at
    BEFORE UPDATE ON pity_trackers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
