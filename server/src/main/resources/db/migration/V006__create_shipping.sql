-- =============================================================================
-- V006__create_shipping.sql
-- =============================================================================
-- Physical prize shipment tracking.  One-to-one relationship with the
-- PrizeInstance being shipped.  Operators fulfill and track shipment.
--
-- Enums:  shipping_order_status
-- Tables: shipping_orders
--
-- NOTE: fulfilled_by_staff_id FK is added in V012 after the staff table exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: shipping order lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE shipping_order_status AS ENUM (
    'PENDING_SHIPMENT',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Table: shipping_orders
-- ---------------------------------------------------------------------------
-- Records a player's request to have a physical prize mailed to them.
-- prize_instance_id is UNIQUE — a prize can only have one shipping order.
-- ---------------------------------------------------------------------------
CREATE TABLE shipping_orders (
    id                   UUID                  NOT NULL DEFAULT gen_random_uuid(),
    player_id            UUID                  NOT NULL,
    -- 1-to-1 with the prize being shipped
    prize_instance_id    UUID                  NOT NULL,
    -- Recipient contact details (may differ from the player's account info)
    recipient_name       VARCHAR(128)          NOT NULL,
    -- E.164 format
    recipient_phone      VARCHAR(20)           NOT NULL,
    -- Delivery address
    address_line1        VARCHAR(255)          NOT NULL,
    address_line2        VARCHAR(255),
    city                 VARCHAR(128)          NOT NULL,
    postal_code          VARCHAR(20)           NOT NULL,
    -- ISO 3166-1 alpha-2; default Taiwan
    country_code         CHAR(2)               NOT NULL DEFAULT 'TW',
    -- Set by operator on shipment
    tracking_number      VARCHAR(128),
    -- Carrier name, e.g. 黑貓宅急便, 郵局
    carrier              VARCHAR(64),
    status               shipping_order_status NOT NULL DEFAULT 'PENDING_SHIPMENT',
    -- Set by operator when marking SHIPPED
    shipped_at           TIMESTAMPTZ,
    -- Set on player confirmation or auto-confirm after timeout
    delivered_at         TIMESTAMPTZ,
    cancelled_at         TIMESTAMPTZ,
    -- Operator who fulfilled the shipment; FK added in V012
    fulfilled_by_staff_id UUID,
    created_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_shipping_orders PRIMARY KEY (id),
    CONSTRAINT fk_shipping_player
        FOREIGN KEY (player_id) REFERENCES players (id),
    CONSTRAINT fk_shipping_prize_instance
        FOREIGN KEY (prize_instance_id) REFERENCES prize_instances (id)
);

-- Indexes: shipping_orders
-- A prize can only have one shipping order at a time
CREATE UNIQUE INDEX uq_shipping_order_prize
    ON shipping_orders (prize_instance_id);

CREATE INDEX idx_shipping_order_player
    ON shipping_orders (player_id);

CREATE INDEX idx_shipping_order_status
    ON shipping_orders (status);

CREATE INDEX idx_shipping_order_staff
    ON shipping_orders (fulfilled_by_staff_id)
    WHERE fulfilled_by_staff_id IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_shipping_orders_updated_at
    BEFORE UPDATE ON shipping_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
