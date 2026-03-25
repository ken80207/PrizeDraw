-- =============================================================================
-- V005__create_trade_and_exchange.sql
-- =============================================================================
-- Player-to-player prize marketplace (trade) and multi-item swap (exchange).
--
-- Enums:  trade_order_status, exchange_request_status, exchange_item_side
-- Tables: trade_orders, exchange_requests, exchange_request_items
--
-- Deferred FKs applied here:
--   prize_instances.source_trade_order_id    -> trade_orders
--   prize_instances.source_exchange_request_id -> exchange_requests
--   draw_point_transactions.trade_order_id   -> trade_orders
--   revenue_point_transactions.trade_order_id -> trade_orders
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: trade order lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE trade_order_status AS ENUM (
    'LISTED',
    'COMPLETED',
    'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Enum: exchange request lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE exchange_request_status AS ENUM (
    'PENDING',
    'COUNTER_PROPOSED',
    'ACCEPTED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Enum: which side of an exchange a prize item belongs to
-- ---------------------------------------------------------------------------
CREATE TYPE exchange_item_side AS ENUM (
    'INITIATOR',
    'RECIPIENT'
);

-- ---------------------------------------------------------------------------
-- Table: trade_orders
-- ---------------------------------------------------------------------------
-- Records a player-to-player prize sale via the marketplace.  The seller
-- lists the prize at a draw-point price; a buyer purchases it.  A platform
-- fee is deducted from the seller's revenue points credit.
-- ---------------------------------------------------------------------------
CREATE TABLE trade_orders (
    id               UUID               NOT NULL DEFAULT gen_random_uuid(),
    seller_id        UUID               NOT NULL,
    -- NULL until purchased
    buyer_id         UUID,
    prize_instance_id UUID              NOT NULL,
    -- Asking price in draw points; must be positive
    list_price       INTEGER            NOT NULL CHECK (list_price > 0),
    -- Platform fee rate at listing time in basis points (e.g. 500 = 5.00%)
    fee_rate_bps     INTEGER            NOT NULL CHECK (fee_rate_bps >= 0),
    -- Computed fee in points = ROUND(list_price * fee_rate_bps / 10000)
    -- NULL until purchase completes
    fee_amount       INTEGER            CHECK (fee_amount >= 0),
    -- list_price - fee_amount; credited to seller as revenue points
    -- NULL until purchase completes
    seller_proceeds  INTEGER            CHECK (seller_proceeds >= 0),
    status           trade_order_status NOT NULL DEFAULT 'LISTED',
    -- When the item was listed
    listed_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    -- Soft delete
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_trade_orders PRIMARY KEY (id),
    CONSTRAINT fk_trade_seller
        FOREIGN KEY (seller_id) REFERENCES players (id),
    CONSTRAINT fk_trade_buyer
        FOREIGN KEY (buyer_id) REFERENCES players (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_trade_prize_instance
        FOREIGN KEY (prize_instance_id) REFERENCES prize_instances (id)
);

-- Indexes: trade_orders
CREATE INDEX idx_trade_order_seller
    ON trade_orders (seller_id, status);

CREATE INDEX idx_trade_order_buyer
    ON trade_orders (buyer_id)
    WHERE buyer_id IS NOT NULL;

-- At most one active listing per prize
CREATE UNIQUE INDEX uq_trade_order_listed
    ON trade_orders (prize_instance_id)
    WHERE status = 'LISTED';

-- Active marketplace feed (excludes soft-deleted)
CREATE INDEX idx_trade_order_status
    ON trade_orders (status, listed_at DESC)
    WHERE deleted_at IS NULL;

-- Fast open-listings query
CREATE INDEX idx_trade_order_listed_at
    ON trade_orders (listed_at DESC)
    WHERE status = 'LISTED';

-- Trigger
CREATE TRIGGER trg_trade_orders_updated_at
    BEFORE UPDATE ON trade_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: exchange_requests
-- ---------------------------------------------------------------------------
-- Multi-to-multi prize swap proposal between two players.  No points are
-- involved.  Either party can counter-propose before acceptance.
-- Self-referential parent_request_id supports counter-proposal chains.
-- ---------------------------------------------------------------------------
CREATE TABLE exchange_requests (
    id                UUID                   NOT NULL DEFAULT gen_random_uuid(),
    initiator_id      UUID                   NOT NULL,
    recipient_id      UUID                   NOT NULL,
    -- Points to the request this is a counter-proposal of; NULL for root
    parent_request_id UUID,
    status            exchange_request_status NOT NULL DEFAULT 'PENDING',
    -- Optional note from initiator
    message           TEXT,
    responded_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_exchange_requests PRIMARY KEY (id),
    CONSTRAINT fk_exchange_initiator
        FOREIGN KEY (initiator_id) REFERENCES players (id),
    CONSTRAINT fk_exchange_recipient
        FOREIGN KEY (recipient_id) REFERENCES players (id),
    -- Self-referential FK for counter-proposals
    CONSTRAINT fk_exchange_parent
        FOREIGN KEY (parent_request_id) REFERENCES exchange_requests (id)
        ON DELETE SET NULL,
    -- Players cannot exchange with themselves
    CONSTRAINT chk_exchange_different_players
        CHECK (initiator_id != recipient_id)
);

-- Indexes: exchange_requests
CREATE INDEX idx_exchange_initiator
    ON exchange_requests (initiator_id, status);

CREATE INDEX idx_exchange_recipient
    ON exchange_requests (recipient_id, status);

CREATE INDEX idx_exchange_parent
    ON exchange_requests (parent_request_id)
    WHERE parent_request_id IS NOT NULL;

-- Active (unresolved) exchange lookup
CREATE INDEX idx_exchange_status
    ON exchange_requests (status)
    WHERE status IN ('PENDING', 'COUNTER_PROPOSED');

-- Trigger
CREATE TRIGGER trg_exchange_requests_updated_at
    BEFORE UPDATE ON exchange_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: exchange_request_items
-- ---------------------------------------------------------------------------
-- Junction table recording which PrizeInstances each party offers in a swap.
-- No updated_at because items are not mutable after insertion.
-- ---------------------------------------------------------------------------
CREATE TABLE exchange_request_items (
    id                  UUID               NOT NULL DEFAULT gen_random_uuid(),
    exchange_request_id UUID               NOT NULL,
    prize_instance_id   UUID               NOT NULL,
    -- INITIATOR or RECIPIENT
    side                exchange_item_side NOT NULL,
    -- No updated_at; append-only
    created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_exchange_request_items PRIMARY KEY (id),
    CONSTRAINT fk_exchange_item_request
        FOREIGN KEY (exchange_request_id) REFERENCES exchange_requests (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_exchange_item_prize
        FOREIGN KEY (prize_instance_id) REFERENCES prize_instances (id)
);

-- Indexes: exchange_request_items
-- A prize instance may only appear once per request
CREATE UNIQUE INDEX uq_exchange_item
    ON exchange_request_items (exchange_request_id, prize_instance_id);

CREATE INDEX idx_exchange_item_prize
    ON exchange_request_items (prize_instance_id);

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto prize_instances (created in V004)
-- ---------------------------------------------------------------------------
ALTER TABLE prize_instances
    ADD CONSTRAINT fk_prize_instance_trade_order
        FOREIGN KEY (source_trade_order_id) REFERENCES trade_orders (id)
        ON DELETE SET NULL;

ALTER TABLE prize_instances
    ADD CONSTRAINT fk_prize_instance_exchange_request
        FOREIGN KEY (source_exchange_request_id) REFERENCES exchange_requests (id)
        ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto point transaction tables (created in V002)
-- ---------------------------------------------------------------------------
ALTER TABLE draw_point_transactions
    ADD CONSTRAINT fk_draw_tx_trade_order
        FOREIGN KEY (trade_order_id) REFERENCES trade_orders (id)
        ON DELETE SET NULL;

ALTER TABLE revenue_point_transactions
    ADD CONSTRAINT fk_rev_tx_trade_order
        FOREIGN KEY (trade_order_id) REFERENCES trade_orders (id)
        ON DELETE SET NULL;
