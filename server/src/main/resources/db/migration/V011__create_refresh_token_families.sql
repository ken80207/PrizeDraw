-- =============================================================================
-- V011__create_refresh_token_families.sql
-- =============================================================================
-- Refresh token rotation with family-level revocation.
-- Detects token reuse attacks: if a revoked token from a family is presented,
-- the entire family is revoked immediately.
--
-- Tables: refresh_token_families
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: refresh_token_families
-- ---------------------------------------------------------------------------
-- One row per "family" of refresh tokens for a player session.
-- family_token is a stable opaque identifier shared across all rotations
-- within one login session.  current_token_hash stores the bcrypt/SHA-256
-- hash of the currently valid refresh token; older tokens in the family
-- are implicitly invalidated by rotation.
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_token_families (
    id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    player_id           UUID         NOT NULL,
    -- Stable opaque identifier for the token family (sent in the refresh token JWT)
    family_token        VARCHAR(64)  NOT NULL,
    -- Hash of the currently valid refresh token (SHA-256 hex or bcrypt)
    current_token_hash  VARCHAR(128) NOT NULL,
    -- TRUE when the entire family has been revoked (reuse detected or logout)
    revoked             BOOLEAN      NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_refresh_token_families PRIMARY KEY (id),
    CONSTRAINT uq_refresh_family_token UNIQUE (family_token),
    CONSTRAINT fk_refresh_token_player
        FOREIGN KEY (player_id) REFERENCES players (id)
        ON DELETE CASCADE
);

-- Indexes: refresh_token_families
-- Fast active-session lookup for a player (e.g. to count or revoke all sessions)
CREATE INDEX idx_refresh_token_player
    ON refresh_token_families (player_id, revoked);

-- Lookup by family_token during token refresh (covered by unique constraint,
-- but an explicit index ensures the planner uses an index-only scan)
CREATE INDEX idx_refresh_token_family
    ON refresh_token_families (family_token);

-- Trigger
CREATE TRIGGER trg_refresh_token_families_updated_at
    BEFORE UPDATE ON refresh_token_families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
