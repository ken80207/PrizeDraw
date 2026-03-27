-- =============================================================================
-- V019__add_prize_value.sql
-- =============================================================================
-- Adds a prize_value column to prize_definitions to track the actual
-- cost/market value of each prize, separate from the buyback_price.
-- =============================================================================

ALTER TABLE prize_definitions
    ADD COLUMN prize_value INTEGER NOT NULL DEFAULT 0 CHECK (prize_value >= 0);

COMMENT ON COLUMN prize_definitions.prize_value IS
    'Actual cost/market value of the prize in points. Used for profit margin calculations.';
