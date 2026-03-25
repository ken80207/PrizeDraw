-- =============================================================================
-- V002__create_wallets_and_points.sql
-- =============================================================================
-- Immutable double-entry ledger tables for both point systems.
-- Records are INSERT-only; the application layer must never UPDATE or DELETE.
--
-- Enums:  draw_point_tx_type, revenue_point_tx_type
-- Tables: draw_point_transactions, revenue_point_transactions
--
-- NOTE: Foreign keys to payment_orders, trade_orders, draw_tickets,
--       unlimited_campaigns, and player_coupons are added as nullable
--       references. Those tables are created in later migrations; the FKs
--       are therefore deferred to those migrations via ALTER TABLE statements
--       appended at the end of each relevant migration.  Here we store the
--       column values but add only the FKs to tables that already exist
--       (players) at this point.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: draw-point transaction types
-- ---------------------------------------------------------------------------
CREATE TYPE draw_point_tx_type AS ENUM (
    'PURCHASE_CREDIT',        -- fiat purchase credited
    'KUJI_DRAW_DEBIT',        -- kuji draw charged
    'UNLIMITED_DRAW_DEBIT',   -- unlimited draw charged
    'TRADE_PURCHASE_DEBIT',   -- marketplace purchase charged
    'COUPON_DISCOUNT_CREDIT', -- coupon discount applied
    'REFUND_CREDIT',          -- refund credited
    'ADMIN_ADJUSTMENT'        -- manual staff adjustment
);

-- ---------------------------------------------------------------------------
-- Enum: revenue-point transaction types
-- ---------------------------------------------------------------------------
CREATE TYPE revenue_point_tx_type AS ENUM (
    'TRADE_SALE_CREDIT',   -- seller's proceeds after marketplace sale
    'BUYBACK_CREDIT',      -- official platform buyback credit
    'WITHDRAWAL_DEBIT',    -- points reserved for bank withdrawal
    'ADMIN_ADJUSTMENT'     -- manual staff adjustment
);

-- ---------------------------------------------------------------------------
-- Table: draw_point_transactions
-- ---------------------------------------------------------------------------
-- Immutable ledger for every mutation to a player's draw_points_balance.
-- Positive amount = credit; negative amount = debit.  amount != 0 enforced.
-- ---------------------------------------------------------------------------
CREATE TABLE draw_point_transactions (
    id                   UUID              NOT NULL DEFAULT gen_random_uuid(),
    player_id            UUID              NOT NULL,
    type                 draw_point_tx_type NOT NULL,
    -- Positive = credit, negative = debit; zero is never valid
    amount               INTEGER           NOT NULL CHECK (amount != 0),
    -- Player's draw_points_balance immediately after this transaction
    balance_after        INTEGER           NOT NULL CHECK (balance_after >= 0),
    -- Nullable references to linked business entities
    payment_order_id     UUID,   -- PURCHASE_CREDIT / REFUND_CREDIT
    trade_order_id       UUID,   -- TRADE_PURCHASE_DEBIT
    draw_ticket_id       UUID,   -- KUJI_DRAW_DEBIT
    unlimited_campaign_id UUID,  -- UNLIMITED_DRAW_DEBIT
    player_coupon_id     UUID,   -- coupon discount applied
    -- Pre-discount amount for coupon-discounted draws
    original_amount      INTEGER,
    -- Points saved by coupon; original_amount - ABS(amount)
    discount_amount      INTEGER CHECK (discount_amount >= 0),
    -- Human-readable note (admin adjustments)
    description          TEXT,
    -- Immutable; no updated_at because records are INSERT-only
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_draw_point_transactions PRIMARY KEY (id),
    CONSTRAINT fk_draw_tx_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Indexes: draw_point_transactions
-- ---------------------------------------------------------------------------
CREATE INDEX idx_draw_tx_player
    ON draw_point_transactions (player_id, created_at DESC);

CREATE INDEX idx_draw_tx_payment
    ON draw_point_transactions (payment_order_id)
    WHERE payment_order_id IS NOT NULL;

CREATE INDEX idx_draw_tx_trade
    ON draw_point_transactions (trade_order_id)
    WHERE trade_order_id IS NOT NULL;

CREATE INDEX idx_draw_tx_type
    ON draw_point_transactions (type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Table: revenue_point_transactions
-- ---------------------------------------------------------------------------
-- Immutable ledger for every mutation to a player's revenue_points_balance.
-- Mirrors draw_point_transactions structure but for the revenue ledger.
-- ---------------------------------------------------------------------------
CREATE TABLE revenue_point_transactions (
    id                    UUID               NOT NULL DEFAULT gen_random_uuid(),
    player_id             UUID               NOT NULL,
    type                  revenue_point_tx_type NOT NULL,
    -- Positive = credit, negative = debit; zero is never valid
    amount                INTEGER            NOT NULL CHECK (amount != 0),
    -- Player's revenue_points_balance immediately after this transaction
    balance_after         INTEGER            NOT NULL CHECK (balance_after >= 0),
    -- Nullable references to linked business entities
    trade_order_id        UUID,   -- TRADE_SALE_CREDIT
    buyback_record_id     UUID,   -- BUYBACK_CREDIT (table created in V004)
    withdrawal_request_id UUID,   -- WITHDRAWAL_DEBIT (table created in V007)
    -- Human-readable note
    description           TEXT,
    -- Immutable; no updated_at because records are INSERT-only
    created_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_revenue_point_transactions PRIMARY KEY (id),
    CONSTRAINT fk_rev_tx_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Indexes: revenue_point_transactions
-- ---------------------------------------------------------------------------
CREATE INDEX idx_rev_tx_player
    ON revenue_point_transactions (player_id, created_at DESC);

CREATE INDEX idx_rev_tx_trade
    ON revenue_point_transactions (trade_order_id)
    WHERE trade_order_id IS NOT NULL;

CREATE INDEX idx_rev_tx_buyback
    ON revenue_point_transactions (buyback_record_id)
    WHERE buyback_record_id IS NOT NULL;

CREATE INDEX idx_rev_tx_withdrawal
    ON revenue_point_transactions (withdrawal_request_id)
    WHERE withdrawal_request_id IS NOT NULL;
