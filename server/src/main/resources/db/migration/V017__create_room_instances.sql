-- V017: Room sharding infrastructure for campaigns with 100+ concurrent players.
--
-- `room_instances` tracks individual WebSocket room shards per campaign.
-- When one room approaches capacity (85% of max_players), a new instance is
-- created automatically by RoomScalingService.
--
-- `campaign_viewer_stats` stores the aggregated viewer count across all shards
-- for efficient global display without summing room_instances on every read.

CREATE TABLE room_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    instance_number INTEGER NOT NULL,
    player_count INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, instance_number)
);

CREATE TRIGGER update_room_instances_updated_at
    BEFORE UPDATE ON room_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Primary query: find available rooms for a campaign at connect time.
CREATE INDEX idx_room_instances_campaign ON room_instances (campaign_id, is_active);

-- Global viewer count per campaign (aggregated across all room shards).
-- Upserted by RoomScalingService whenever players join or leave.
CREATE TABLE campaign_viewer_stats (
    campaign_id UUID PRIMARY KEY,
    total_viewers INTEGER NOT NULL DEFAULT 0,
    total_in_queue INTEGER NOT NULL DEFAULT 0,
    last_draw_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
