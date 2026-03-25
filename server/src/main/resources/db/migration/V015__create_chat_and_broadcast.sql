-- Chat messages (optional persistence — primary delivery via Redis pub/sub)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(128) NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id),
    message TEXT NOT NULL,
    is_reaction BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_room_time ON chat_messages (room_id, created_at DESC);
-- Auto-purge old messages (keep 7 days)
-- Application-level cleanup job

-- Broadcast sessions (unlimited draw live streaming)
CREATE TABLE broadcast_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    viewer_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX idx_broadcast_active ON broadcast_sessions (campaign_id, is_active) WHERE is_active = true;
CREATE INDEX idx_broadcast_player ON broadcast_sessions (player_id, is_active) WHERE is_active = true;

-- Draw sync state (tracks in-progress draws for spectator sync)
CREATE TABLE draw_sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE,  -- NULL for unlimited draws
    campaign_id UUID NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id),
    animation_mode VARCHAR(32) NOT NULL,
    -- Server pre-computed result (hidden until REVEALED)
    result_grade VARCHAR(16),
    result_prize_name VARCHAR(255),
    result_photo_url TEXT,
    result_prize_instance_id UUID,
    -- State
    progress REAL NOT NULL DEFAULT 0.0,
    is_revealed BOOLEAN NOT NULL DEFAULT false,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revealed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);
CREATE INDEX idx_draw_sync_campaign ON draw_sync_sessions (campaign_id, is_revealed, is_cancelled);
CREATE INDEX idx_draw_sync_player ON draw_sync_sessions (player_id, started_at DESC);
