-- =============================================================================
-- V007__create_payments_and_withdrawals.sql
-- =============================================================================
-- Fiat currency purchase of draw points (payment_orders) and revenue-point
-- withdrawals via bank transfer (withdrawal_requests).
--
-- Enums:  payment_gateway, payment_order_status, withdrawal_status
-- Tables: payment_orders, withdrawal_requests
--
-- Deferred FKs applied here:
--   draw_point_transactions.payment_order_id    -> payment_orders
--   revenue_point_transactions.withdrawal_request_id -> withdrawal_requests
--
-- NOTE: withdrawal_requests.reviewed_by_staff_id FK added in V012.
--       support_tickets context FKs referencing these tables added in V009.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: supported payment gateways
-- ---------------------------------------------------------------------------
CREATE TYPE payment_gateway AS ENUM (
    'ECPAY',
    'NEWEBPAY',
    'STRIPE',
    'APPLEPAY',
    'GOOGLEPAY'
);

-- ---------------------------------------------------------------------------
-- Enum: payment order lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE payment_order_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);

-- ---------------------------------------------------------------------------
-- Enum: withdrawal request lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE withdrawal_status AS ENUM (
    'PENDING_REVIEW',
    'APPROVED',
    'TRANSFERRED',
    'REJECTED'
);

-- ---------------------------------------------------------------------------
-- Table: payment_orders
-- ---------------------------------------------------------------------------
-- Records a player's fiat-currency purchase of draw points via a third-party
-- payment gateway.  Points are only credited once the gateway confirms payment
-- via webhook callback.
-- The id UUID is also used as the merchant order ID sent to the gateway.
-- ---------------------------------------------------------------------------
CREATE TABLE payment_orders (
    id                     UUID                 NOT NULL DEFAULT gen_random_uuid(),
    player_id              UUID                 NOT NULL,
    -- Charge amount in smallest currency unit (e.g. TWD has no sub-units so 1 = 1 TWD)
    fiat_amount            INTEGER              NOT NULL CHECK (fiat_amount > 0),
    -- ISO 4217 currency code
    currency_code          CHAR(3)              NOT NULL DEFAULT 'TWD',
    -- Draw points to be credited on successful payment
    draw_points_granted    INTEGER              NOT NULL CHECK (draw_points_granted > 0),
    gateway                payment_gateway      NOT NULL,
    -- Third-party transaction reference; UNIQUE when non-NULL (partial unique index)
    gateway_transaction_id VARCHAR(255),
    -- e.g. credit_card, atm, cvs_code, apple_pay
    payment_method         VARCHAR(64),
    -- Raw gateway response data for debugging / reconciliation
    gateway_metadata       JSONB                NOT NULL DEFAULT '{}',
    status                 payment_order_status NOT NULL DEFAULT 'PENDING',
    -- Timestamps set by gateway callbacks
    paid_at                TIMESTAMPTZ,
    failed_at              TIMESTAMPTZ,
    refunded_at            TIMESTAMPTZ,
    -- Payment window expiry (e.g. CVS code expires in 3 days)
    expires_at             TIMESTAMPTZ,
    created_at             TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_payment_orders PRIMARY KEY (id),
    CONSTRAINT fk_payment_player
        FOREIGN KEY (player_id) REFERENCES players (id)
);

-- Indexes: payment_orders
CREATE INDEX idx_payment_order_player
    ON payment_orders (player_id, created_at DESC);

CREATE INDEX idx_payment_order_status
    ON payment_orders (status, created_at DESC);

-- Prevent duplicate gateway transaction references
CREATE UNIQUE INDEX uq_payment_gateway_tx
    ON payment_orders (gateway, gateway_transaction_id)
    WHERE gateway_transaction_id IS NOT NULL;

-- Scheduled job target: find pending orders whose payment window expired
CREATE INDEX idx_payment_order_expires
    ON payment_orders (expires_at)
    WHERE status = 'PENDING' AND expires_at IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_payment_orders_updated_at
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: withdrawal_requests
-- ---------------------------------------------------------------------------
-- A player's request to convert revenue points to fiat currency via bank
-- transfer.  Requires manual staff approval.  Revenue points are debited
-- (reserved) atomically at submission time; refunded if rejected.
-- account_number is stored encrypted at the application layer before insert.
-- ---------------------------------------------------------------------------
CREATE TABLE withdrawal_requests (
    id                   UUID              NOT NULL DEFAULT gen_random_uuid(),
    player_id            UUID              NOT NULL,
    -- Revenue points to withdraw; must be positive
    points_amount        INTEGER           NOT NULL CHECK (points_amount > 0),
    -- Equivalent fiat in smallest currency unit; snapshotted at request time
    fiat_amount          INTEGER           NOT NULL CHECK (fiat_amount > 0),
    -- ISO 4217
    currency_code        CHAR(3)           NOT NULL DEFAULT 'TWD',
    bank_name            VARCHAR(128)      NOT NULL,
    bank_code            VARCHAR(16)       NOT NULL,
    account_holder_name  VARCHAR(128)      NOT NULL,
    -- Stored encrypted at rest (application-layer encryption before insert)
    account_number       VARCHAR(64)       NOT NULL,
    status               withdrawal_status NOT NULL DEFAULT 'PENDING_REVIEW',
    -- Staff who approved or rejected; FK added in V012
    reviewed_by_staff_id UUID,
    reviewed_at          TIMESTAMPTZ,
    -- Set when bank transfer is executed
    transferred_at       TIMESTAMPTZ,
    -- Staff's reason for rejection
    rejection_reason     TEXT,
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_withdrawal_requests PRIMARY KEY (id),
    CONSTRAINT fk_withdrawal_player
        FOREIGN KEY (player_id) REFERENCES players (id)
);

-- Indexes: withdrawal_requests
CREATE INDEX idx_withdrawal_player
    ON withdrawal_requests (player_id, created_at DESC);

-- Admin queue: oldest PENDING_REVIEW items first
CREATE INDEX idx_withdrawal_status
    ON withdrawal_requests (status, created_at ASC);

CREATE INDEX idx_withdrawal_reviewer
    ON withdrawal_requests (reviewed_by_staff_id)
    WHERE reviewed_by_staff_id IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_withdrawal_requests_updated_at
    BEFORE UPDATE ON withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto draw_point_transactions (V002)
-- ---------------------------------------------------------------------------
ALTER TABLE draw_point_transactions
    ADD CONSTRAINT fk_draw_tx_payment_order
        FOREIGN KEY (payment_order_id) REFERENCES payment_orders (id)
        ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto revenue_point_transactions (V002)
-- ---------------------------------------------------------------------------
ALTER TABLE revenue_point_transactions
    ADD CONSTRAINT fk_rev_tx_withdrawal_request
        FOREIGN KEY (withdrawal_request_id) REFERENCES withdrawal_requests (id)
        ON DELETE SET NULL;
