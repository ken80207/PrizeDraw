-- =============================================================================
-- V009__create_support.sql
-- =============================================================================
-- Customer support ticket system with multi-message conversation threads.
-- Optionally synced with LINE Official Account (Taiwan market).
--
-- Enums:  support_ticket_status, support_ticket_priority,
--         support_ticket_category, message_channel
-- Tables: support_tickets, support_ticket_messages
--
-- NOTE: assigned_to_staff_id and author_staff_id FKs are added in V012
--       after the staff table exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: support ticket lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE support_ticket_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);

-- ---------------------------------------------------------------------------
-- Enum: support ticket priority levels
-- ---------------------------------------------------------------------------
CREATE TYPE support_ticket_priority AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);

-- ---------------------------------------------------------------------------
-- Enum: support ticket subject categories
-- ---------------------------------------------------------------------------
CREATE TYPE support_ticket_category AS ENUM (
    'DRAW_DISPUTE',
    'TRADE_DISPUTE',
    'PAYMENT_ISSUE',
    'ACCOUNT_ISSUE',
    'SHIPPING_ISSUE',
    'OTHER'
);

-- ---------------------------------------------------------------------------
-- Enum: message communication channel
-- ---------------------------------------------------------------------------
CREATE TYPE message_channel AS ENUM (
    'PLATFORM',
    'LINE'
);

-- ---------------------------------------------------------------------------
-- Table: support_tickets
-- ---------------------------------------------------------------------------
-- A player-submitted issue report.  Supports multi-message conversation
-- between player and customer service staff.  Optional context entity links
-- (trade, payment, shipping, withdrawal) help agents resolve faster.
-- ---------------------------------------------------------------------------
CREATE TABLE support_tickets (
    id                       UUID                    NOT NULL DEFAULT gen_random_uuid(),
    player_id                UUID                    NOT NULL,
    -- Assigned CS agent; FK added in V012
    assigned_to_staff_id     UUID,
    category                 support_ticket_category NOT NULL,
    subject                  VARCHAR(255)            NOT NULL,
    status                   support_ticket_status   NOT NULL DEFAULT 'OPEN',
    priority                 support_ticket_priority NOT NULL DEFAULT 'NORMAL',
    -- Player satisfaction rating on close; 1 (worst) to 5 (best)
    satisfaction_score       SMALLINT
                             CHECK (satisfaction_score BETWEEN 1 AND 5),
    -- LINE conversation thread ID for LINE CS integration
    line_thread_id           VARCHAR(255),
    -- Optional context references for agent convenience
    context_trade_order_id   UUID,
    context_payment_order_id UUID,
    context_shipping_order_id UUID,
    context_withdrawal_id    UUID,
    resolved_at              TIMESTAMPTZ,
    closed_at                TIMESTAMPTZ,
    created_at               TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_support_tickets PRIMARY KEY (id),
    CONSTRAINT fk_support_ticket_player
        FOREIGN KEY (player_id) REFERENCES players (id),
    -- Context FKs (all optional)
    CONSTRAINT fk_support_context_trade
        FOREIGN KEY (context_trade_order_id) REFERENCES trade_orders (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_context_payment
        FOREIGN KEY (context_payment_order_id) REFERENCES payment_orders (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_context_shipping
        FOREIGN KEY (context_shipping_order_id) REFERENCES shipping_orders (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_context_withdrawal
        FOREIGN KEY (context_withdrawal_id) REFERENCES withdrawal_requests (id)
        ON DELETE SET NULL
);

-- Indexes: support_tickets
CREATE INDEX idx_support_ticket_player
    ON support_tickets (player_id, created_at DESC);

-- Agent queue: open and in-progress tickets sorted by priority and age
CREATE INDEX idx_support_ticket_status
    ON support_tickets (status, priority, created_at ASC)
    WHERE status IN ('OPEN', 'IN_PROGRESS');

-- Agent workload view
CREATE INDEX idx_support_ticket_assigned
    ON support_tickets (assigned_to_staff_id)
    WHERE assigned_to_staff_id IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: support_ticket_messages
-- ---------------------------------------------------------------------------
-- A single message in a SupportTicket conversation thread.
-- Authored by either a player or a staff member (exactly one, enforced by CHECK).
-- LINE-sourced messages carry a line_message_id for deduplication.
-- Records are append-only; no UPDATE or DELETE.
-- ---------------------------------------------------------------------------
CREATE TABLE support_ticket_messages (
    id                 UUID            NOT NULL DEFAULT gen_random_uuid(),
    support_ticket_id  UUID            NOT NULL,
    -- Exactly one of author_player_id or author_staff_id must be non-NULL
    author_player_id   UUID,
    -- FK to staff added in V012
    author_staff_id    UUID,
    body               TEXT            NOT NULL,
    -- Array of { "url": "...", "mime_type": "..." }
    attachments        JSONB           NOT NULL DEFAULT '[]',
    channel            message_channel NOT NULL DEFAULT 'PLATFORM',
    -- LINE message ID for deduplication of webhook deliveries
    line_message_id    VARCHAR(255)    UNIQUE,
    -- No updated_at; messages are append-only
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_support_ticket_messages PRIMARY KEY (id),
    CONSTRAINT fk_ticket_message_ticket
        FOREIGN KEY (support_ticket_id) REFERENCES support_tickets (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ticket_message_player
        FOREIGN KEY (author_player_id) REFERENCES players (id)
        ON DELETE SET NULL,
    -- Exactly one author must be set
    CONSTRAINT chk_ticket_message_author
        CHECK (
            (author_player_id IS NULL) != (author_staff_id IS NULL)
        )
);

-- Indexes: support_ticket_messages
-- Conversation thread in chronological order
CREATE INDEX idx_ticket_message_ticket
    ON support_ticket_messages (support_ticket_id, created_at ASC);

-- Prevent duplicate LINE message deliveries
CREATE UNIQUE INDEX uq_ticket_message_line
    ON support_ticket_messages (line_message_id)
    WHERE line_message_id IS NOT NULL;
