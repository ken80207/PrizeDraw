-- Player level/XP tracking
ALTER TABLE players ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE players ADD COLUMN tier VARCHAR(32) NOT NULL DEFAULT 'BRONZE';
CREATE INDEX idx_players_tier ON players (tier);
CREATE INDEX idx_players_level ON players (level DESC);

-- XP transaction log (tracks how XP was earned)
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id),
    amount INTEGER NOT NULL,  -- XP earned
    source_type VARCHAR(32) NOT NULL,  -- 'KUJI_DRAW', 'UNLIMITED_DRAW', 'TRADE_PURCHASE', 'DAILY_LOGIN', 'ACHIEVEMENT'
    source_id UUID,  -- related draw/trade/achievement ID
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_xp_tx_player ON xp_transactions (player_id, created_at DESC);

-- Tier configuration (admin-configurable)
CREATE TABLE tier_configs (
    tier VARCHAR(32) PRIMARY KEY,
    display_name VARCHAR(64) NOT NULL,
    min_xp INTEGER NOT NULL,
    icon VARCHAR(16) NOT NULL,
    color VARCHAR(16) NOT NULL,
    benefits JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Seed default tiers
INSERT INTO tier_configs (tier, display_name, min_xp, icon, color, benefits, sort_order) VALUES
('BRONZE',   '銅牌會員', 0,       '🥉', '#CD7F32', '{}', 1),
('SILVER',   '銀牌會員', 1000,    '🥈', '#C0C0C0', '{"trade_fee_discount_bps": 500}', 2),
('GOLD',     '金牌會員', 5000,    '🥇', '#FFD700', '{"trade_fee_discount_bps": 1000, "priority_queue": true}', 3),
('PLATINUM', '白金會員', 20000,   '💎', '#E5E4E2', '{"trade_fee_discount_bps": 1500, "priority_queue": true, "exclusive_campaigns": true}', 4),
('DIAMOND',  '鑽石會員', 50000,   '👑', '#B9F2FF', '{"trade_fee_discount_bps": 2000, "priority_queue": true, "exclusive_campaigns": true, "monthly_bonus_points": 100}', 5),
('LEGEND',   '傳說會員', 200000,  '🌟', '#FF6B6B', '{"trade_fee_discount_bps": 2500, "priority_queue": true, "exclusive_campaigns": true, "monthly_bonus_points": 500, "custom_avatar_frame": true}', 6);
