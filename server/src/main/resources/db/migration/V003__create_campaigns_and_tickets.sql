-- =============================================================================
-- V003__create_campaigns_and_tickets.sql
-- =============================================================================
-- Campaign and ticket structures for both the finite queue-based kuji model
-- and the unlimited probability-based draw model.
--
-- Enums:  kuji_campaign_status, unlimited_campaign_status,
--         ticket_box_status, draw_ticket_status
-- Tables: kuji_campaigns, ticket_boxes, unlimited_campaigns, draw_tickets
--
-- NOTE: kuji_campaigns and unlimited_campaigns reference the staff table which
--       is created in V012.  The FK constraints on created_by_staff_id are
--       added via ALTER TABLE at the bottom of V012 to respect creation order.
--       draw_tickets references prize_definitions created in V004; that FK is
--       also added in V004.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: kuji campaign lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE kuji_campaign_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'SUSPENDED',
    'SOLD_OUT'
);

-- ---------------------------------------------------------------------------
-- Enum: unlimited campaign lifecycle states (no SOLD_OUT — no ceiling)
-- ---------------------------------------------------------------------------
CREATE TYPE unlimited_campaign_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'SUSPENDED'
);

-- ---------------------------------------------------------------------------
-- Enum: ticket box availability
-- ---------------------------------------------------------------------------
CREATE TYPE ticket_box_status AS ENUM (
    'AVAILABLE',
    'SOLD_OUT'
);

-- ---------------------------------------------------------------------------
-- Enum: individual ticket draw state
-- ---------------------------------------------------------------------------
CREATE TYPE draw_ticket_status AS ENUM (
    'AVAILABLE',
    'DRAWN'
);

-- ---------------------------------------------------------------------------
-- Table: kuji_campaigns
-- ---------------------------------------------------------------------------
-- Finite, queue-based draw event. Owns one or more TicketBoxes.
-- Ticket layout is immutable after the campaign reaches ACTIVE status.
-- ---------------------------------------------------------------------------
CREATE TABLE kuji_campaigns (
    id                   UUID                 NOT NULL DEFAULT gen_random_uuid(),
    title                VARCHAR(255)         NOT NULL,
    description          TEXT,
    cover_image_url      TEXT,
    -- Draw points cost per single draw; must be positive
    price_per_draw       INTEGER              NOT NULL CHECK (price_per_draw > 0),
    -- Exclusive draw session duration in seconds (default 5 minutes)
    draw_session_seconds INTEGER              NOT NULL DEFAULT 300
                                              CHECK (draw_session_seconds > 0),
    status               kuji_campaign_status NOT NULL DEFAULT 'DRAFT',
    -- Timestamp of first ACTIVE transition
    activated_at         TIMESTAMPTZ,
    -- Set automatically when all boxes are SOLD_OUT
    sold_out_at          TIMESTAMPTZ,
    -- Operator who created the campaign; FK added in V012 after staff table exists
    created_by_staff_id  UUID                 NOT NULL,
    -- Soft delete
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_kuji_campaigns PRIMARY KEY (id)
);

-- Indexes: kuji_campaigns
CREATE INDEX idx_kuji_campaign_status
    ON kuji_campaigns (status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_kuji_campaign_created_at
    ON kuji_campaigns (created_at DESC);

CREATE INDEX idx_kuji_campaign_created_by
    ON kuji_campaigns (created_by_staff_id);

-- Trigger
CREATE TRIGGER trg_kuji_campaigns_updated_at
    BEFORE UPDATE ON kuji_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: ticket_boxes
-- ---------------------------------------------------------------------------
-- A draw pool inside a KujiCampaign. Each box has a fixed set of DrawTickets
-- and an independent queue.
-- ---------------------------------------------------------------------------
CREATE TABLE ticket_boxes (
    id                UUID              NOT NULL DEFAULT gen_random_uuid(),
    kuji_campaign_id  UUID              NOT NULL,
    name              VARCHAR(64)       NOT NULL,
    -- Total fixed ticket count; immutable after campaign ACTIVE
    total_tickets     INTEGER           NOT NULL CHECK (total_tickets > 0),
    -- Decremented atomically on each draw; CHECK prevents negative values
    remaining_tickets INTEGER           NOT NULL CHECK (remaining_tickets >= 0),
    status            ticket_box_status NOT NULL DEFAULT 'AVAILABLE',
    -- Set when remaining_tickets reaches 0
    sold_out_at       TIMESTAMPTZ,
    -- Rendering order within the campaign; unique per campaign (partial unique index)
    display_order     INTEGER           NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_ticket_boxes PRIMARY KEY (id),
    CONSTRAINT fk_ticket_box_campaign
        FOREIGN KEY (kuji_campaign_id) REFERENCES kuji_campaigns (id)
        ON DELETE CASCADE
);

-- Indexes: ticket_boxes
CREATE INDEX idx_ticket_box_campaign
    ON ticket_boxes (kuji_campaign_id);

CREATE INDEX idx_ticket_box_status
    ON ticket_boxes (kuji_campaign_id, status);

-- display_order must be unique within a campaign
CREATE UNIQUE INDEX uq_ticket_box_order
    ON ticket_boxes (kuji_campaign_id, display_order);

-- Trigger
CREATE TRIGGER trg_ticket_boxes_updated_at
    BEFORE UPDATE ON ticket_boxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: unlimited_campaigns
-- ---------------------------------------------------------------------------
-- Probability-based draw with no fixed ticket pool. Players draw independently
-- and simultaneously with no queuing. Probability sum must equal 1,000,000 bps
-- (100%) before the campaign can be activated.
-- ---------------------------------------------------------------------------
CREATE TABLE unlimited_campaigns (
    id                   UUID                      NOT NULL DEFAULT gen_random_uuid(),
    title                VARCHAR(255)              NOT NULL,
    description          TEXT,
    cover_image_url      TEXT,
    -- Draw points cost per single draw; must be positive
    price_per_draw       INTEGER                   NOT NULL CHECK (price_per_draw > 0),
    -- Max draws per second per player; minimum 1
    rate_limit_per_second INTEGER                  NOT NULL DEFAULT 1
                                                   CHECK (rate_limit_per_second > 0),
    status               unlimited_campaign_status NOT NULL DEFAULT 'DRAFT',
    -- Timestamp of first ACTIVE transition
    activated_at         TIMESTAMPTZ,
    -- Operator who created the campaign; FK added in V012 after staff table exists
    created_by_staff_id  UUID                      NOT NULL,
    -- Soft delete
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_unlimited_campaigns PRIMARY KEY (id)
);

-- Indexes: unlimited_campaigns
CREATE INDEX idx_unlimited_campaign_status
    ON unlimited_campaigns (status)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_unlimited_campaign_created_at
    ON unlimited_campaigns (created_at DESC);

-- Trigger
CREATE TRIGGER trg_unlimited_campaigns_updated_at
    BEFORE UPDATE ON unlimited_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: draw_tickets
-- ---------------------------------------------------------------------------
-- One physical ticket slot inside a TicketBox.  Every ticket has a fixed
-- PrizeDefinition assigned at campaign creation time.  Once DRAWN the record
-- is immutable.
--
-- NOTE: prize_definition_id FK is added in V004 after prize_definitions exists.
--       prize_instance_id FK is added in V004 after prize_instances exists.
-- ---------------------------------------------------------------------------
CREATE TABLE draw_tickets (
    id                   UUID              NOT NULL DEFAULT gen_random_uuid(),
    ticket_box_id        UUID              NOT NULL,
    -- FK to prize_definitions added in V004
    prize_definition_id  UUID              NOT NULL,
    -- 1-based slot number shown on the ticket board; positive
    position             INTEGER           NOT NULL CHECK (position > 0),
    status               draw_ticket_status NOT NULL DEFAULT 'AVAILABLE',
    -- Set atomically when drawn
    drawn_by_player_id   UUID,
    drawn_at             TIMESTAMPTZ,
    -- FK to prize_instances added in V004; NULL until drawn
    prize_instance_id    UUID              UNIQUE,
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_draw_tickets PRIMARY KEY (id),
    CONSTRAINT fk_draw_ticket_box
        FOREIGN KEY (ticket_box_id) REFERENCES ticket_boxes (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_draw_ticket_drawn_by
        FOREIGN KEY (drawn_by_player_id) REFERENCES players (id)
        ON DELETE SET NULL
);

-- Indexes: draw_tickets
-- position must be unique within a box
CREATE UNIQUE INDEX uq_draw_ticket_position
    ON draw_tickets (ticket_box_id, position);

CREATE INDEX idx_draw_ticket_box_status
    ON draw_tickets (ticket_box_id, status);

CREATE INDEX idx_draw_ticket_drawn_by
    ON draw_tickets (drawn_by_player_id)
    WHERE drawn_by_player_id IS NOT NULL;

CREATE INDEX idx_draw_ticket_prize_def
    ON draw_tickets (prize_definition_id);

-- Trigger
CREATE TRIGGER trg_draw_tickets_updated_at
    BEFORE UPDATE ON draw_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
