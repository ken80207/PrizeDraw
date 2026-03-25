-- =============================================================================
-- V010__create_audit_and_outbox.sql
-- =============================================================================
-- Compliance and observability infrastructure:
--   audit_logs   — append-only record of all significant system events
--   outbox_events — transactional outbox for reliable domain event publishing
--
-- Enums:  audit_actor_type
-- Tables: audit_logs, outbox_events
--
-- NOTE: actor_staff_id FK on audit_logs is added in V012 after staff exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: who performed the audited action
-- ---------------------------------------------------------------------------
CREATE TYPE audit_actor_type AS ENUM (
    'PLAYER',
    'STAFF',
    'SYSTEM'
);

-- ---------------------------------------------------------------------------
-- Table: audit_logs
-- ---------------------------------------------------------------------------
-- Append-only log of all significant system events.
-- Records are INSERT-only; UPDATE and DELETE must never occur.
-- Retained indefinitely for compliance.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              UUID             NOT NULL DEFAULT gen_random_uuid(),
    actor_type      audit_actor_type NOT NULL,
    -- Set when actor_type = PLAYER
    actor_player_id UUID,
    -- Set when actor_type = STAFF; FK added in V012
    actor_staff_id  UUID,
    -- Dot-namespaced action key, e.g. campaign.kuji.activated, prize_instance.sold
    action          VARCHAR(128)     NOT NULL,
    -- Target entity name, e.g. KujiCampaign, Player, FeatureFlag
    entity_type     VARCHAR(64)      NOT NULL,
    -- Target entity PK; NULL for collection-level actions
    entity_id       UUID,
    -- Entity state snapshot before the mutation
    before_value    JSONB,
    -- Entity state snapshot after the mutation
    after_value     JSONB,
    -- Additional context: IP address, user agent, session ID, request ID
    metadata        JSONB            NOT NULL DEFAULT '{}',
    -- Immutable; no updated_at
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_player
        FOREIGN KEY (actor_player_id) REFERENCES players (id)
        ON DELETE SET NULL
);

-- Indexes: audit_logs
CREATE INDEX idx_audit_actor_player
    ON audit_logs (actor_player_id, created_at DESC)
    WHERE actor_player_id IS NOT NULL;

-- Staff audit trail; partial index populated after V012 FK is in place
CREATE INDEX idx_audit_actor_staff
    ON audit_logs (actor_staff_id, created_at DESC)
    WHERE actor_staff_id IS NOT NULL;

-- Entity-level history lookup
CREATE INDEX idx_audit_entity
    ON audit_logs (entity_type, entity_id, created_at DESC);

-- Action-type drill-down
CREATE INDEX idx_audit_action
    ON audit_logs (action, created_at DESC);

-- Global chronological feed
CREATE INDEX idx_audit_created_at
    ON audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Table: outbox_events
-- ---------------------------------------------------------------------------
-- Transactional outbox pattern: domain events are written inside the same
-- database transaction as the business operation, then delivered to the
-- message broker by a background worker.  Ensures at-least-once delivery
-- without a two-phase commit.
-- ---------------------------------------------------------------------------
CREATE TABLE outbox_events (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    -- Dot-namespaced event type, e.g. player.phone_verified, trade.completed
    event_type    VARCHAR(128) NOT NULL,
    -- Primary key of the aggregate that produced this event
    aggregate_id  UUID         NOT NULL,
    -- Full event payload (serialised domain event)
    payload       JSONB        NOT NULL,
    -- PENDING until picked up and published by the outbox worker
    status        VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    -- Delivery attempt counter; incremented by the outbox worker on each try
    attempts      INTEGER      NOT NULL DEFAULT 0,
    -- Last error message from a failed delivery attempt
    last_error    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Set by the outbox worker on successful delivery
    processed_at  TIMESTAMPTZ,

    CONSTRAINT pk_outbox_events PRIMARY KEY (id)
);

-- Indexes: outbox_events
-- Outbox worker query: pending events ordered by creation time
CREATE INDEX idx_outbox_pending
    ON outbox_events (status, created_at)
    WHERE status = 'PENDING';
