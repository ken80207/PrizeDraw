-- =============================================================================
-- V001__create_players.sql
-- =============================================================================
-- Creates the shared trigger helper function (used by all subsequent migrations)
-- and the players table with its two associated enum types.
--
-- Enums:  player_oauth_provider, draw_animation_mode
-- Tables: players
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger function: auto-stamp updated_at on every row mutation.
-- Installed once here; referenced by triggers in every later migration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ---------------------------------------------------------------------------
-- Enum: OAuth provider options
-- ---------------------------------------------------------------------------
CREATE TYPE player_oauth_provider AS ENUM (
    'GOOGLE',
    'APPLE',
    'LINE'
);

-- ---------------------------------------------------------------------------
-- Enum: draw reveal animation mode
-- ---------------------------------------------------------------------------
CREATE TYPE draw_animation_mode AS ENUM (
    'TEAR',
    'SCRATCH',
    'FLIP',
    'INSTANT'
);

-- ---------------------------------------------------------------------------
-- Table: players
-- ---------------------------------------------------------------------------
-- Central user entity. Authentication is exclusively via third-party OAuth2;
-- a phone number binding is mandatory before core platform features are
-- unlocked. Dual point balances are stored directly on this row and protected
-- by optimistic locking via the version column.
-- ---------------------------------------------------------------------------
CREATE TABLE players (
    id                       UUID                  NOT NULL DEFAULT gen_random_uuid(),
    nickname                 VARCHAR(64)           NOT NULL,
    avatar_url               TEXT,
    -- E.164 format; NULL until phone binding is completed
    phone_number             VARCHAR(20),
    phone_verified_at        TIMESTAMPTZ,
    oauth_provider           player_oauth_provider NOT NULL,
    -- Provider-issued user identifier (sub claim)
    oauth_subject            VARCHAR(255)          NOT NULL,
    -- Spendable draw points (消費點數); CHECK ensures balance never goes negative
    draw_points_balance      INTEGER               NOT NULL DEFAULT 0
                                                   CHECK (draw_points_balance >= 0),
    -- Withdrawable revenue points (收益點數)
    revenue_points_balance   INTEGER               NOT NULL DEFAULT 0
                                                   CHECK (revenue_points_balance >= 0),
    -- Optimistic lock version; incremented on every balance mutation
    version                  INTEGER               NOT NULL DEFAULT 0,
    preferred_animation_mode draw_animation_mode   NOT NULL DEFAULT 'TEAR',
    -- BCP-47 locale code for i18n
    locale                   VARCHAR(10)           NOT NULL DEFAULT 'zh-TW',
    -- FALSE when account is frozen / suspended
    is_active                BOOLEAN               NOT NULL DEFAULT TRUE,
    -- Soft delete timestamp; non-NULL means deleted
    deleted_at               TIMESTAMPTZ,
    created_at               TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_players PRIMARY KEY (id)
    -- phone_number uniqueness is enforced by the partial unique index uq_player_phone below,
    -- which correctly excludes NULL rows. The inline UNIQUE constraint was removed (W-2).
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Prevent the same external account from creating two players
CREATE UNIQUE INDEX uq_player_oauth
    ON players (oauth_provider, oauth_subject);

-- Unique phone numbers, but only among non-NULL rows
CREATE UNIQUE INDEX uq_player_phone
    ON players (phone_number)
    WHERE phone_number IS NOT NULL;

-- Fast lookup of active (non-deleted) players by is_active flag
CREATE INDEX idx_player_is_active
    ON players (is_active)
    WHERE deleted_at IS NULL;

-- Chronological listing for admin dashboards
CREATE INDEX idx_player_created_at
    ON players (created_at DESC);

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current on every row mutation
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
