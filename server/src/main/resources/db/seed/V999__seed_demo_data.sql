-- ============================================================
-- DEMO SEED DATA — for development and E2E testing
-- ============================================================
-- This migration is intentionally versioned at V999 so it runs last and
-- never conflicts with schema migrations.  It is safe to run on a freshly
-- migrated database; all INSERT statements are idempotent (ON CONFLICT DO NOTHING).
-- ============================================================

-- ============================================================
-- Admin staff account
-- ============================================================
-- The staff table uses `hashed_password` (see V012).
-- bcrypt hash of "Admin1234!" (cost 10)
INSERT INTO staff (id, name, email, hashed_password, role, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000901',
    '管理員',
    'admin@prizedraw.tw',
    '$2a$10$dG5xH1fR4K2pQ8vN3mJ7Lu9oY0wI5bA6hC3kE8jS2nM4qP7tX1yZ',
    'ADMIN',
    true,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Test players  (3 players for multi-user E2E testing)
-- ============================================================
-- xp / level / tier columns are added by V018.
INSERT INTO players (id, nickname, avatar_url, phone_number, phone_verified_at,
                     oauth_provider, oauth_subject,
                     draw_points_balance, revenue_points_balance, version,
                     preferred_animation_mode, locale, is_active,
                     xp, level, tier,
                     created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '玩家小明', null,
     '+886912000001', NOW(),
     'GOOGLE', 'google-player-001',
     10000, 0, 0,
     'SCRATCH', 'zh-TW', true,
     0, 1, 'BRONZE',
     NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000002',
     '玩家小花', null,
     '+886912000002', NOW(),
     'GOOGLE', 'google-player-002',
     10000, 0, 0,
     'TEAR', 'zh-TW', true,
     0, 1, 'BRONZE',
     NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000003',
     '觀戰者小王', null,
     '+886912000003', NOW(),
     'GOOGLE', 'google-player-003',
     5000, 0, 0,
     'FLIP', 'zh-TW', true,
     0, 1, 'BRONZE',
     NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- KUJI CAMPAIGN 1: Re:Zero 一番賞
-- ============================================================

INSERT INTO kuji_campaigns (id, title, description, cover_image_url,
                             price_per_draw, draw_session_seconds, status,
                             activated_at, created_by_staff_id, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000101',
    'Re:Zero 一番賞 第三彈',
    '人氣動畫 Re:Zero 限定一番賞！A賞為限定版雷姆公仔。',
    null,
    100, 300,
    'ACTIVE',
    NOW(),
    '00000000-0000-0000-0000-000000000901',
    NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- Ticket Box A: 10 tickets
INSERT INTO ticket_boxes (id, kuji_campaign_id, name,
                          total_tickets, remaining_tickets, status,
                          display_order, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    '籤盒 A',
    10, 10,
    'AVAILABLE',
    1, NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- Prize definitions for Re:Zero campaign  (ticket_count matters for kuji; probability_bps NULL)
INSERT INTO prize_definitions (id, kuji_campaign_id, unlimited_campaign_id,
                                grade, name, photos,
                                buyback_price, buyback_enabled,
                                probability_bps, ticket_count,
                                display_order, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000301',
     '00000000-0000-0000-0000-000000000101', null,
     'A賞', '限定版 雷姆公仔', '[]',
     500, true, null, 1, 1, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000302',
     '00000000-0000-0000-0000-000000000101', null,
     'B賞', '精緻 拉姆模型', '[]',
     200, true, null, 2, 2, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000303',
     '00000000-0000-0000-0000-000000000101', null,
     'C賞', '艾蜜莉亞吊飾', '[]',
     80, true, null, 3, 3, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000304',
     '00000000-0000-0000-0000-000000000101', null,
     'D賞', '角色貼紙包', '[]',
     20, true, null, 4, 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 10 Draw tickets: A×1, B×2, C×3, D×4 — positions 1-10
INSERT INTO draw_tickets (id, ticket_box_id, prize_definition_id,
                          position, status,
                          drawn_by_player_id, drawn_at,
                          created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000401',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301',
     1, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000402',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302',
     2, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000403',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302',
     3, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000404',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000303',
     4, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000405',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000303',
     5, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000406',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000303',
     6, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000407',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304',
     7, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000408',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304',
     8, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000409',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304',
     9, 'AVAILABLE', null, null, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000410',
     '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304',
     10, 'AVAILABLE', null, null, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Queue for box A  (idle on startup: active_player_id / session timestamps are NULL)
INSERT INTO queues (id, ticket_box_id,
                   active_player_id, session_started_at, session_expires_at,
                   created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000201',
    null, null, null,
    NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- UNLIMITED CAMPAIGN 1: SPY×FAMILY 無限賞
-- ============================================================

INSERT INTO unlimited_campaigns (id, title, description, cover_image_url,
                                  price_per_draw, rate_limit_per_second, status,
                                  activated_at, created_by_staff_id, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000102',
    'SPY×FAMILY 無限賞',
    '安妮亞超可愛無限賞！機率挑戰大獎！',
    null,
    50, 2,
    'ACTIVE',
    NOW(),
    '00000000-0000-0000-0000-000000000901',
    NOW(), NOW()
)
ON CONFLICT DO NOTHING;

-- Prize definitions for SPY×FAMILY campaign  (probability_bps set; ticket_count NULL)
-- Sum = 5000 + 30000 + 165000 + 800000 = 1,000,000 bps  (valid for an ACTIVE unlimited campaign)
INSERT INTO prize_definitions (id, kuji_campaign_id, unlimited_campaign_id,
                                grade, name, photos,
                                buyback_price, buyback_enabled,
                                probability_bps, ticket_count,
                                display_order, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000311',
     null, '00000000-0000-0000-0000-000000000102',
     'A賞', '安妮亞 超大公仔', '[]',
     400, true, 5000, null, 1, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000312',
     null, '00000000-0000-0000-0000-000000000102',
     'B賞', '洛伊德 模型', '[]',
     150, true, 30000, null, 2, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000313',
     null, '00000000-0000-0000-0000-000000000102',
     'C賞', '約兒 吊飾', '[]',
     60, true, 165000, null, 3, NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000314',
     null, '00000000-0000-0000-0000-000000000102',
     'D賞', '邦德 貼紙', '[]',
     10, true, 800000, null, 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- Default feature flags  (supplement the flags seeded in V012)
-- ============================================================
-- V012 already seeds: exchange_feature, leaderboard, coupon_system,
--                     animation_options, spectator_mode, line_cs_channel.
-- The animation-mode flags below are demo-specific extras.
-- display_name is required (NOT NULL) per V012 schema.
INSERT INTO feature_flags (id, name, display_name, description, enabled, rules, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000f01',
     'animation_mode_tear',      '撕籤動畫',   '撕籤揭曉動畫', true, '{}', NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000f02',
     'animation_mode_scratch',   '刮刮樂動畫', '刮刮樂揭曉動畫', true, '{}', NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000f03',
     'animation_mode_flip',      '翻牌動畫',   '翻牌揭曉動畫', true, '{}', NOW(), NOW()),

    ('00000000-0000-0000-0000-000000000f04',
     'animation_mode_instant',   '快速揭曉',   '即時揭曉動畫', true, '{}', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
