-- =============================================================================
-- V013__add_refresh_token_expiry.sql
-- =============================================================================
-- Adds expiry tracking and multi-actor support to refresh_token_families.
--
-- New columns:
--   expires_at  — hard expiry for the family (default 30 days from row creation)
--   actor_type  — distinguishes PLAYER vs STAFF sessions
--   staff_id    — FK to staff table for staff-actor families
--
-- The partial index on expires_at enables efficient pruning of expired sessions
-- without scanning already-revoked rows.
-- =============================================================================

ALTER TABLE refresh_token_families
    ADD COLUMN expires_at  TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    ADD COLUMN actor_type  VARCHAR(16)  NOT NULL DEFAULT 'PLAYER',
    ADD COLUMN staff_id    UUID         REFERENCES staff(id) ON DELETE SET NULL;

CREATE INDEX idx_rtf_expires_at
    ON refresh_token_families (expires_at)
    WHERE revoked = false;
