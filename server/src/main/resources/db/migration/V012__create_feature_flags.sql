-- =============================================================================
-- V012__create_feature_flags.sql
-- =============================================================================
-- Remaining tables and all deferred FK constraints that reference staff.
--
-- Enums:  staff_role, queue_entry_status, feature_flag_target_type
-- Tables: staff, feature_flags, queues, queue_entries
--
-- Deferred FKs resolved here (all tables that reference staff):
--   kuji_campaigns.created_by_staff_id          -> staff
--   unlimited_campaigns.created_by_staff_id      -> staff
--   shipping_orders.fulfilled_by_staff_id        -> staff
--   withdrawal_requests.reviewed_by_staff_id     -> staff
--   support_tickets.assigned_to_staff_id         -> staff
--   support_ticket_messages.author_staff_id      -> staff
--   coupons.created_by_staff_id                  -> staff
--   audit_logs.actor_staff_id                    -> staff
--   feature_flags.updated_by_staff_id            -> staff
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: staff permission roles
-- ---------------------------------------------------------------------------
CREATE TYPE staff_role AS ENUM (
    'CUSTOMER_SERVICE',
    'OPERATOR',
    'ADMIN',
    'OWNER'
);

-- ---------------------------------------------------------------------------
-- Enum: queue entry lifecycle states
-- ---------------------------------------------------------------------------
CREATE TYPE queue_entry_status AS ENUM (
    'WAITING',
    'ACTIVE',
    'COMPLETED',
    'ABANDONED',
    'EVICTED'
);

-- ---------------------------------------------------------------------------
-- Enum: feature flag targeting dimension
-- ---------------------------------------------------------------------------
CREATE TYPE feature_flag_target_type AS ENUM (
    'GLOBAL',
    'PLAYER_GROUP',
    'PLATFORM',
    'PERCENTAGE'
);

-- ---------------------------------------------------------------------------
-- Table: staff
-- ---------------------------------------------------------------------------
-- Platform employees with back-office access.
-- Staff authenticate via email + password (bcrypt, min cost 12).
-- Distinct from the players table; no OAuth used.
-- ---------------------------------------------------------------------------
CREATE TABLE staff (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    name                VARCHAR(128) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    -- Bcrypt hash (min cost 12)
    hashed_password     VARCHAR(255) NOT NULL,
    role                staff_role   NOT NULL,
    -- FALSE revokes access without deletion
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMPTZ,
    -- Admin who created this account; self-referential
    created_by_staff_id UUID,
    -- Soft delete
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_staff PRIMARY KEY (id),
    -- Self-referential: can only reference already-existing staff rows
    CONSTRAINT fk_staff_created_by
        FOREIGN KEY (created_by_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL
);

-- Indexes: staff
-- Email must be unique among non-deleted accounts
CREATE UNIQUE INDEX uq_staff_email
    ON staff (email)
    WHERE deleted_at IS NULL;

-- Role-filtered list for permission checks
CREATE INDEX idx_staff_role
    ON staff (role)
    WHERE is_active = TRUE AND deleted_at IS NULL;

-- Trigger
CREATE TRIGGER trg_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: feature_flags
-- ---------------------------------------------------------------------------
-- Runtime toggles managed by administrators.  Every change must produce an
-- AuditLog entry (enforced at the application layer).
-- The rules JSONB column holds structured targeting rules evaluated when
-- enabled = TRUE.
-- ---------------------------------------------------------------------------
CREATE TABLE feature_flags (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- Stable machine-readable key, e.g. exchange_feature, leaderboard
    -- Follows ^[a-z][a-z0-9_]*$ (validated at application layer); immutable after creation
    name                VARCHAR(128) NOT NULL,
    -- Human-readable label for the admin UI
    display_name        VARCHAR(255) NOT NULL,
    -- Intent and impact description
    description         TEXT,
    -- Global master switch; FALSE = feature OFF for all regardless of rules
    enabled             BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Structured targeting rules: { global, platforms, groups, percentage }
    rules               JSONB        NOT NULL DEFAULT '{}',
    -- Last modifier; NULL when set by initial seed
    updated_by_staff_id UUID,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_feature_flags PRIMARY KEY (id),
    CONSTRAINT fk_feature_flag_staff
        FOREIGN KEY (updated_by_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL
);

-- Indexes: feature_flags
CREATE UNIQUE INDEX uq_feature_flag_name
    ON feature_flags (name);

-- Trigger
CREATE TRIGGER trg_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: queues
-- ---------------------------------------------------------------------------
-- One persistent queue per TicketBox.  Tracks the active draw session holder
-- and the ordered waiting list.  The queue is the concurrency control
-- boundary for kuji draws.
-- ---------------------------------------------------------------------------
CREATE TABLE queues (
    id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    -- Each box has exactly one queue
    ticket_box_id      UUID        NOT NULL,
    -- The player currently holding the draw session; NULL when idle
    active_player_id   UUID,
    -- Both must be NULL (idle) or both NOT NULL (active session)
    session_started_at TIMESTAMPTZ,
    session_expires_at TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_queues PRIMARY KEY (id),
    CONSTRAINT fk_queue_ticket_box
        FOREIGN KEY (ticket_box_id) REFERENCES ticket_boxes (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_queue_active_player
        FOREIGN KEY (active_player_id) REFERENCES players (id)
        ON DELETE SET NULL
);

-- Indexes: queues
CREATE UNIQUE INDEX uq_queue_box
    ON queues (ticket_box_id);

CREATE INDEX idx_queue_active_player
    ON queues (active_player_id)
    WHERE active_player_id IS NOT NULL;

-- Session expiry monitor: background timer finds sessions past their deadline
CREATE INDEX idx_queue_session_expires
    ON queues (session_expires_at)
    WHERE session_expires_at IS NOT NULL;

-- Trigger
CREATE TRIGGER trg_queues_updated_at
    BEFORE UPDATE ON queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: queue_entries
-- ---------------------------------------------------------------------------
-- A single player's presence in a TicketBox queue.  Ordered by position.
-- Exactly one entry per queue may be ACTIVE at a time.
-- ---------------------------------------------------------------------------
CREATE TABLE queue_entries (
    id           UUID               NOT NULL DEFAULT gen_random_uuid(),
    queue_id     UUID               NOT NULL,
    player_id    UUID               NOT NULL,
    -- 1-based position; must be positive
    position     INTEGER            NOT NULL CHECK (position > 0),
    status       queue_entry_status NOT NULL DEFAULT 'WAITING',
    -- When the player joined the queue
    joined_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    -- When this entry's session started
    activated_at TIMESTAMPTZ,
    -- When the player voluntarily ended or the session expired
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_queue_entries PRIMARY KEY (id),
    CONSTRAINT fk_queue_entry_queue
        FOREIGN KEY (queue_id) REFERENCES queues (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_queue_entry_player
        FOREIGN KEY (player_id) REFERENCES players (id)
        ON DELETE CASCADE
);

-- Indexes: queue_entries
-- Active queue state per queue
CREATE INDEX idx_queue_entry_queue
    ON queue_entries (queue_id, status);

-- Active-session lookup for a player (used in session validation)
CREATE INDEX idx_queue_entry_player
    ON queue_entries (player_id)
    WHERE status IN ('WAITING', 'ACTIVE');

-- A player may only have one non-terminal entry per queue at a time
CREATE UNIQUE INDEX uq_queue_entry_active
    ON queue_entries (queue_id, player_id)
    WHERE status IN ('WAITING', 'ACTIVE');

-- Position ordering within an active queue
CREATE INDEX idx_queue_entry_position
    ON queue_entries (queue_id, position)
    WHERE status IN ('WAITING', 'ACTIVE');

-- Trigger
CREATE TRIGGER trg_queue_entries_updated_at
    BEFORE UPDATE ON queue_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Deferred FK back-fills: all tables that reference staff
-- =============================================================================

ALTER TABLE kuji_campaigns
    ADD CONSTRAINT fk_kuji_campaign_staff
        FOREIGN KEY (created_by_staff_id) REFERENCES staff (id);

ALTER TABLE unlimited_campaigns
    ADD CONSTRAINT fk_unlimited_campaign_staff
        FOREIGN KEY (created_by_staff_id) REFERENCES staff (id);

ALTER TABLE shipping_orders
    ADD CONSTRAINT fk_shipping_fulfilled_by_staff
        FOREIGN KEY (fulfilled_by_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL;

ALTER TABLE withdrawal_requests
    ADD CONSTRAINT fk_withdrawal_reviewed_by_staff
        FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL;

ALTER TABLE support_tickets
    ADD CONSTRAINT fk_support_ticket_assigned_staff
        FOREIGN KEY (assigned_to_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL;

ALTER TABLE support_ticket_messages
    ADD CONSTRAINT fk_ticket_message_staff
        FOREIGN KEY (author_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL;

ALTER TABLE coupons
    ADD CONSTRAINT fk_coupon_created_by_staff
        FOREIGN KEY (created_by_staff_id) REFERENCES staff (id);

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_staff
        FOREIGN KEY (actor_staff_id) REFERENCES staff (id)
        ON DELETE SET NULL;

-- =============================================================================
-- Seed: default feature flags
-- =============================================================================
-- Inserted with no updated_by_staff_id (system seed).
-- The name column is immutable after creation (application layer enforces this).
-- =============================================================================
INSERT INTO feature_flags (name, display_name, description, enabled, rules)
VALUES
    (
        'exchange_feature',
        'Player Prize Exchange',
        'Enables player-to-player prize exchange requests.',
        FALSE,
        '{}'
    ),
    (
        'leaderboard',
        'Public Leaderboards',
        'Shows draw-count, prize-grade, and trade-volume leaderboards to players.',
        TRUE,
        '{}'
    ),
    (
        'coupon_system',
        'Coupon & Discount Codes',
        'Allows players to use coupons and redemption codes during draws.',
        TRUE,
        '{}'
    ),
    (
        'animation_options',
        'Animation Mode Selection',
        'Lets players choose their preferred draw reveal animation.',
        TRUE,
        '{}'
    ),
    (
        'spectator_mode',
        'Live Kuji Spectating',
        'Allows non-queued players to watch kuji draws in real-time.',
        TRUE,
        '{}'
    ),
    (
        'line_cs_channel',
        'LINE Official Account CS Integration',
        'Syncs support ticket messages with the platform LINE Official Account.',
        FALSE,
        '{}'
    );
