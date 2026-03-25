-- =============================================================================
-- V004__create_prizes.sql
-- =============================================================================
-- Prize template definitions and concrete player-owned prize instances.
-- Also back-fills deferred FK constraints onto draw_tickets.
--
-- Enums:  prize_acquisition_method, prize_instance_state
-- Tables: prize_definitions, prize_instances, buyback_records
--
-- Deferred FKs applied here:
--   draw_tickets.prize_definition_id -> prize_definitions
--   draw_tickets.prize_instance_id   -> prize_instances
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: how a player obtained a prize instance
-- ---------------------------------------------------------------------------
CREATE TYPE prize_acquisition_method AS ENUM (
    'KUJI_DRAW',
    'UNLIMITED_DRAW',
    'TRADE_PURCHASE',
    'EXCHANGE'
);

-- ---------------------------------------------------------------------------
-- Enum: prize instance lifecycle state
-- ---------------------------------------------------------------------------
CREATE TYPE prize_instance_state AS ENUM (
    'HOLDING',          -- in the player's collection, not committed elsewhere
    'TRADING',          -- listed on the marketplace
    'EXCHANGING',       -- offered in an exchange request
    'PENDING_BUYBACK',  -- awaiting platform buyback processing
    'PENDING_SHIPMENT', -- shipping order placed, awaiting operator dispatch
    'SHIPPED',          -- dispatched by operator
    'DELIVERED',        -- confirmed delivered (terminal)
    'SOLD',             -- sold via marketplace (terminal)
    'RECYCLED'          -- consumed by exchange or buyback (terminal)
);

-- ---------------------------------------------------------------------------
-- Table: prize_definitions
-- ---------------------------------------------------------------------------
-- Prize template shared by multiple tickets (kuji) or referenced
-- probabilistically (unlimited).  Exactly one of kuji_campaign_id or
-- unlimited_campaign_id must be non-NULL (CHECK constraint).
-- ---------------------------------------------------------------------------
CREATE TABLE prize_definitions (
    id                    UUID    NOT NULL DEFAULT gen_random_uuid(),
    -- Exactly one of these two FKs must be non-NULL
    kuji_campaign_id      UUID,   -- FK -> kuji_campaigns
    unlimited_campaign_id UUID,   -- FK -> unlimited_campaigns
    -- Prize grade label: A賞, B賞, Last賞, etc.
    grade                 VARCHAR(32)  NOT NULL,
    -- Product / prize display name
    name                  VARCHAR(255) NOT NULL,
    -- Ordered array of CDN URLs: [{ "url": "...", "sort_order": 1 }, ...]
    photos                JSONB        NOT NULL DEFAULT '[]',
    -- Official buyback price in revenue points; 0 = buyback disabled
    buyback_price         INTEGER      NOT NULL DEFAULT 0 CHECK (buyback_price >= 0),
    -- Operator can disable buyback per prize grade
    buyback_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Probability in basis points of 0.0001% (1,000,000 = 100%).
    -- NULL for kuji prizes; NOT NULL for unlimited prizes.
    probability_bps       INTEGER      CHECK (probability_bps >= 0),
    -- Number of tickets in the box assigned to this definition.
    -- NULL for unlimited prizes; NOT NULL for kuji prizes.
    ticket_count          INTEGER      CHECK (ticket_count >= 0),
    -- Rendering order within a campaign's prize list
    display_order         INTEGER      NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_prize_definitions PRIMARY KEY (id),
    CONSTRAINT fk_prize_def_kuji
        FOREIGN KEY (kuji_campaign_id) REFERENCES kuji_campaigns (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_prize_def_unlimited
        FOREIGN KEY (unlimited_campaign_id) REFERENCES unlimited_campaigns (id)
        ON DELETE CASCADE,
    -- Exactly one campaign FK must be non-NULL
    CONSTRAINT chk_prize_def_campaign_exclusive
        CHECK (
            (kuji_campaign_id IS NULL) != (unlimited_campaign_id IS NULL)
        )
);

-- Indexes: prize_definitions
CREATE INDEX idx_prize_def_kuji
    ON prize_definitions (kuji_campaign_id)
    WHERE kuji_campaign_id IS NOT NULL;

CREATE INDEX idx_prize_def_unlimited
    ON prize_definitions (unlimited_campaign_id)
    WHERE unlimited_campaign_id IS NOT NULL;

CREATE INDEX idx_prize_def_grade
    ON prize_definitions (kuji_campaign_id, grade);

-- Trigger
CREATE TRIGGER trg_prize_definitions_updated_at
    BEFORE UPDATE ON prize_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: prize_instances
-- ---------------------------------------------------------------------------
-- A concrete prize owned by a player. Created when a ticket is drawn (kuji)
-- or when an unlimited draw resolves. The state field drives the central
-- state machine for a prize's lifecycle.
--
-- source_trade_order_id and source_exchange_request_id FKs are deferred to
-- V005 after trade_orders and exchange_requests exist.
-- ---------------------------------------------------------------------------
CREATE TABLE prize_instances (
    id                          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    prize_definition_id         UUID                    NOT NULL,
    -- Current owner
    owner_id                    UUID                    NOT NULL,
    acquisition_method          prize_acquisition_method NOT NULL,
    -- Set when acquired via KUJI_DRAW; UNIQUE across non-deleted rows (partial index)
    source_draw_ticket_id       UUID,
    -- Set when acquired via TRADE_PURCHASE; FK added in V005
    source_trade_order_id       UUID,
    -- Set when acquired via EXCHANGE; FK added in V005
    source_exchange_request_id  UUID,
    state                       prize_instance_state    NOT NULL DEFAULT 'HOLDING',
    -- When the player first received this prize
    acquired_at                 TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    -- Soft delete; set when prize reaches a terminal state
    deleted_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_prize_instances PRIMARY KEY (id),
    CONSTRAINT fk_prize_instance_definition
        FOREIGN KEY (prize_definition_id) REFERENCES prize_definitions (id),
    CONSTRAINT fk_prize_instance_owner
        FOREIGN KEY (owner_id) REFERENCES players (id),
    CONSTRAINT fk_prize_instance_draw_ticket
        FOREIGN KEY (source_draw_ticket_id) REFERENCES draw_tickets (id)
        ON DELETE SET NULL
);

-- Indexes: prize_instances
CREATE INDEX idx_prize_instance_owner
    ON prize_instances (owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_prize_instance_state
    ON prize_instances (state)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_prize_instance_owner_state
    ON prize_instances (owner_id, state)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_prize_instance_definition
    ON prize_instances (prize_definition_id);

-- A ticket can produce at most one prize instance
CREATE UNIQUE INDEX uq_prize_instance_ticket
    ON prize_instances (source_draw_ticket_id)
    WHERE source_draw_ticket_id IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_prize_instances_updated_at
    BEFORE UPDATE ON prize_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: buyback_records
-- ---------------------------------------------------------------------------
-- Immutable record of a prize being sold back to the platform. The buyback
-- price is snapshotted at submission time so retroactive price changes do not
-- affect already-submitted records.
-- ---------------------------------------------------------------------------
CREATE TABLE buyback_records (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    player_id           UUID        NOT NULL,
    -- 1-to-1 with the recycled prize
    prize_instance_id   UUID        NOT NULL,
    -- Snapshotted for analytics in case definition changes later
    prize_definition_id UUID        NOT NULL,
    -- Revenue points credited; snapshotted at submission
    buyback_price       INTEGER     NOT NULL CHECK (buyback_price >= 0),
    -- When points were credited and prize removed
    processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- No updated_at; this record is immutable after creation
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_buyback_records PRIMARY KEY (id),
    CONSTRAINT fk_buyback_player
        FOREIGN KEY (player_id) REFERENCES players (id),
    CONSTRAINT fk_buyback_prize_instance
        FOREIGN KEY (prize_instance_id) REFERENCES prize_instances (id),
    CONSTRAINT fk_buyback_prize_definition
        FOREIGN KEY (prize_definition_id) REFERENCES prize_definitions (id)
);

-- Indexes: buyback_records
CREATE UNIQUE INDEX uq_buyback_prize
    ON buyback_records (prize_instance_id);

CREATE INDEX idx_buyback_player
    ON buyback_records (player_id, processed_at DESC);

CREATE INDEX idx_buyback_prize_def
    ON buyback_records (prize_definition_id);

-- ---------------------------------------------------------------------------
-- Deferred FK back-fills onto draw_tickets (created in V003)
-- ---------------------------------------------------------------------------
ALTER TABLE draw_tickets
    ADD CONSTRAINT fk_draw_ticket_prize_definition
        FOREIGN KEY (prize_definition_id) REFERENCES prize_definitions (id);

ALTER TABLE draw_tickets
    ADD CONSTRAINT fk_draw_ticket_prize_instance
        FOREIGN KEY (prize_instance_id) REFERENCES prize_instances (id)
        ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Deferred FK on revenue_point_transactions.buyback_record_id (V002)
-- ---------------------------------------------------------------------------
ALTER TABLE revenue_point_transactions
    ADD CONSTRAINT fk_rev_tx_buyback_record
        FOREIGN KEY (buyback_record_id) REFERENCES buyback_records (id)
        ON DELETE SET NULL;
