-- =============================================================================
-- V008__create_coupons.sql
-- =============================================================================
-- Discount coupon system: operator-created templates, redeemable codes, and
-- per-player coupon wallet entries.
--
-- Enums:  coupon_discount_type, coupon_applicable_to, player_coupon_status
-- Tables: coupons, discount_codes, player_coupons
--
-- Deferred FKs applied here:
--   draw_point_transactions.player_coupon_id -> player_coupons
--   draw_point_transactions.unlimited_campaign_id -> unlimited_campaigns
--   draw_point_transactions.draw_ticket_id -> draw_tickets
--
-- NOTE: coupons.created_by_staff_id FK added in V012 after staff table exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: discount calculation method
-- ---------------------------------------------------------------------------
CREATE TYPE coupon_discount_type AS ENUM (
    'PERCENTAGE',     -- e.g. 20 = 20% off
    'FIXED_POINTS'    -- e.g. 100 points off the draw price
);

-- ---------------------------------------------------------------------------
-- Enum: which campaign types the coupon applies to
-- ---------------------------------------------------------------------------
CREATE TYPE coupon_applicable_to AS ENUM (
    'ALL',
    'KUJI_ONLY',
    'UNLIMITED_ONLY'
);

-- ---------------------------------------------------------------------------
-- Enum: per-player coupon instance status
-- ---------------------------------------------------------------------------
CREATE TYPE player_coupon_status AS ENUM (
    'ACTIVE',
    'EXHAUSTED',  -- use_count >= coupon.max_uses_per_player
    'EXPIRED'     -- current time > coupon.valid_until
);

-- ---------------------------------------------------------------------------
-- Table: coupons
-- ---------------------------------------------------------------------------
-- A discount template created by operators.  Multiple players can hold
-- instances of the same coupon (via PlayerCoupon).
-- ---------------------------------------------------------------------------
CREATE TABLE coupons (
    id                  UUID                 NOT NULL DEFAULT gen_random_uuid(),
    name                VARCHAR(128)         NOT NULL,
    -- Player-facing description
    description         TEXT,
    discount_type       coupon_discount_type NOT NULL,
    -- Percentage (1-99) or fixed points depending on discount_type; must be positive
    discount_value      INTEGER              NOT NULL CHECK (discount_value > 0),
    applicable_to       coupon_applicable_to NOT NULL DEFAULT 'ALL',
    -- Maximum times a single player may use this coupon; at least 1
    max_uses_per_player INTEGER              NOT NULL DEFAULT 1
                                             CHECK (max_uses_per_player > 0),
    -- Total PlayerCoupon rows created from this coupon
    total_issued        INTEGER              NOT NULL DEFAULT 0
                                             CHECK (total_issued >= 0),
    -- Total times coupon was applied to a draw
    total_used          INTEGER              NOT NULL DEFAULT 0
                                             CHECK (total_used >= 0),
    -- Max total issues; NULL = unlimited
    issue_limit         INTEGER              CHECK (issue_limit > 0),
    valid_from          TIMESTAMPTZ          NOT NULL,
    valid_until         TIMESTAMPTZ          NOT NULL,
    is_active           BOOLEAN              NOT NULL DEFAULT TRUE,
    -- Operator who created the coupon; FK added in V012
    created_by_staff_id UUID                 NOT NULL,
    -- Soft delete
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_coupons PRIMARY KEY (id)
);

-- Indexes: coupons
CREATE INDEX idx_coupon_active
    ON coupons (is_active, valid_from, valid_until)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_coupon_created_by
    ON coupons (created_by_staff_id);

-- Trigger
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: discount_codes
-- ---------------------------------------------------------------------------
-- A redeemable code string that, when entered by a player, issues them a
-- PlayerCoupon from the associated Coupon template.
-- Codes are stored uppercase for case-insensitive lookup.
-- ---------------------------------------------------------------------------
CREATE TABLE discount_codes (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    coupon_id        UUID        NOT NULL,
    -- Case-insensitive redemption code; stored and indexed uppercase
    code             VARCHAR(64) NOT NULL,
    -- Total redemptions allowed; NULL = unlimited
    redemption_limit INTEGER     CHECK (redemption_limit > 0),
    -- Current redemption count
    redemption_count INTEGER     NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Soft delete
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_discount_codes PRIMARY KEY (id),
    CONSTRAINT fk_discount_code_coupon
        FOREIGN KEY (coupon_id) REFERENCES coupons (id)
        ON DELETE CASCADE
);

-- Indexes: discount_codes
-- Case-insensitive unique code lookup
CREATE UNIQUE INDEX uq_discount_code
    ON discount_codes (UPPER(code));

CREATE INDEX idx_discount_code_coupon
    ON discount_codes (coupon_id);

-- Trigger
CREATE TRIGGER trg_discount_codes_updated_at
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: player_coupons
-- ---------------------------------------------------------------------------
-- A specific coupon instance in a player's wallet.
-- Tracks per-instance usage count and status lifecycle.
-- ---------------------------------------------------------------------------
CREATE TABLE player_coupons (
    id               UUID                NOT NULL DEFAULT gen_random_uuid(),
    player_id        UUID                NOT NULL,
    coupon_id        UUID                NOT NULL,
    -- Source discount code if this coupon was redeemed via a code; NULLABLE
    discount_code_id UUID,
    -- How many times this instance has been applied
    use_count        INTEGER             NOT NULL DEFAULT 0 CHECK (use_count >= 0),
    status           player_coupon_status NOT NULL DEFAULT 'ACTIVE',
    -- When this coupon was added to the player's wallet
    issued_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    -- Last draw time this coupon was applied
    last_used_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_player_coupons PRIMARY KEY (id),
    CONSTRAINT fk_player_coupon_player
        FOREIGN KEY (player_id) REFERENCES players (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_player_coupon_coupon
        FOREIGN KEY (coupon_id) REFERENCES coupons (id),
    CONSTRAINT fk_player_coupon_discount_code
        FOREIGN KEY (discount_code_id) REFERENCES discount_codes (id)
        ON DELETE SET NULL
);

-- Indexes: player_coupons
-- A player can only have one wallet entry per coupon template
CREATE UNIQUE INDEX uq_player_coupon
    ON player_coupons (player_id, coupon_id);

-- A player can only redeem a specific discount code once
CREATE UNIQUE INDEX uq_player_discount_code
    ON player_coupons (player_id, discount_code_id)
    WHERE discount_code_id IS NOT NULL;

-- Fast active-coupon lookup for a player
CREATE INDEX idx_player_coupon_status
    ON player_coupons (player_id, status);

-- Trigger
CREATE TRIGGER trg_player_coupons_updated_at
    BEFORE UPDATE ON player_coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto draw_point_transactions (V002)
-- ---------------------------------------------------------------------------
ALTER TABLE draw_point_transactions
    ADD CONSTRAINT fk_draw_tx_player_coupon
        FOREIGN KEY (player_coupon_id) REFERENCES player_coupons (id)
        ON DELETE SET NULL;

ALTER TABLE draw_point_transactions
    ADD CONSTRAINT fk_draw_tx_unlimited_campaign
        FOREIGN KEY (unlimited_campaign_id) REFERENCES unlimited_campaigns (id)
        ON DELETE SET NULL;

ALTER TABLE draw_point_transactions
    ADD CONSTRAINT fk_draw_tx_draw_ticket
        FOREIGN KEY (draw_ticket_id) REFERENCES draw_tickets (id)
        ON DELETE SET NULL;
