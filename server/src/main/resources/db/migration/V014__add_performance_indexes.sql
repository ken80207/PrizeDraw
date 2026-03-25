-- =============================================================================
-- V014: Performance Indexes for Common Query Patterns
--
-- Adds composite indexes covering the most frequent query patterns observed in:
--   - Pagination with filters (campaign lists, trade listings, player prizes)
--   - Leaderboard aggregation (draw_point_transactions by type and time)
--   - Queue management (queue_entries by position and status)
--   - Admin operations (support tickets, withdrawal review, audit trails)
--
-- Run EXPLAIN ANALYZE on staging before applying to production to validate
-- index selection. All indexes use IF NOT EXISTS to be idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- draw_point_transactions: leaderboard aggregation + player wallet pagination
-- ---------------------------------------------------------------------------

-- Supports: leaderboard queries counting draws per player per period
--   WHERE type = 'KUJI_DRAW_DEBIT' AND created_at >= $1
-- Also supports: player wallet history with type filter + time-ordered pagination
CREATE INDEX IF NOT EXISTS idx_draw_point_tx_player_type_created
    ON draw_point_transactions (player_id, type, created_at DESC);

-- Supports: admin aggregate reports grouped by type across all players
CREATE INDEX IF NOT EXISTS idx_draw_point_tx_type_created
    ON draw_point_transactions (type, created_at DESC);

-- ---------------------------------------------------------------------------
-- revenue_point_transactions: withdrawal audit + player revenue history
-- ---------------------------------------------------------------------------

-- Supports: player revenue wallet history with type filter
CREATE INDEX IF NOT EXISTS idx_revenue_point_tx_player_type_created
    ON revenue_point_transactions (player_id, type, created_at DESC);

-- ---------------------------------------------------------------------------
-- prize_instances: player collection browsing (state filter + soft-delete aware)
-- ---------------------------------------------------------------------------

-- Supports: GET /players/me/prizes?state=HOLDING (most common inventory query)
--   WHERE owner_id = $1 AND state = $2 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_prize_instances_owner_state_active
    ON prize_instances (owner_id, state, deleted_at)
    WHERE deleted_at IS NULL;

-- Supports: admin prize lookup by state for bulk operations
CREATE INDEX IF NOT EXISTS idx_prize_instances_state_created
    ON prize_instances (state, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- trade_orders: marketplace listing pagination with sorting
-- ---------------------------------------------------------------------------

-- Supports: GET /trade/listings?status=LISTED&sort=created_at (marketplace browse)
--   WHERE status = 'LISTED' ORDER BY created_at DESC LIMIT $1 OFFSET $2
CREATE INDEX IF NOT EXISTS idx_trade_orders_status_created
    ON trade_orders (status, created_at DESC)
    WHERE deleted_at IS NULL;

-- Supports: seller's listing history
--   WHERE seller_id = $1 AND status = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_trade_orders_seller_status_created
    ON trade_orders (seller_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- queue_entries: queue position management (hot path during kuji draws)
-- ---------------------------------------------------------------------------

-- Supports: finding the active entry for a queue + ordered waiting list
--   WHERE queue_id = $1 AND status = 'WAITING' ORDER BY position ASC
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue_status_position
    ON queue_entries (queue_id, status, position ASC);

-- Supports: finding a specific player's entry in a queue
--   WHERE queue_id = $1 AND player_id = $2
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue_player
    ON queue_entries (queue_id, player_id);

-- ---------------------------------------------------------------------------
-- kuji_campaigns: active campaign list (cached but index needed for cache miss)
-- ---------------------------------------------------------------------------

-- Supports: GET /campaigns/kuji?status=ACTIVE with sort
--   WHERE status = 'ACTIVE' ORDER BY activated_at DESC
CREATE INDEX IF NOT EXISTS idx_kuji_campaigns_status_activated
    ON kuji_campaigns (status, activated_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- unlimited_campaigns: active unlimited campaign list
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_unlimited_campaigns_status_activated
    ON unlimited_campaigns (status, activated_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- draw_tickets: box ticket browsing + available ticket selection for draw
-- ---------------------------------------------------------------------------

-- Supports: count available tickets per box (used in queue session validation)
--   WHERE ticket_box_id = $1 AND status = 'AVAILABLE'
CREATE INDEX IF NOT EXISTS idx_draw_tickets_box_status
    ON draw_tickets (ticket_box_id, status);

-- Supports: spectator mode — fetching drawn tickets with prize info
--   WHERE ticket_box_id = $1 AND status = 'DRAWN' ORDER BY drawn_at DESC
CREATE INDEX IF NOT EXISTS idx_draw_tickets_box_drawn_at
    ON draw_tickets (ticket_box_id, drawn_at DESC)
    WHERE status = 'DRAWN';

-- ---------------------------------------------------------------------------
-- support_tickets: staff dashboard filtering by category + status + assigned
-- ---------------------------------------------------------------------------

-- Supports: staff dashboard listing tickets by category and status
--   WHERE category = $1 AND status IN ('OPEN','IN_PROGRESS') ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_support_tickets_category_status_created
    ON support_tickets (category, status, created_at ASC);

-- ---------------------------------------------------------------------------
-- payment_orders: payment status queries for webhook processing
-- ---------------------------------------------------------------------------

-- Supports: webhook processor finding orders by gateway transaction ID and status
--   WHERE gateway = $1 AND gateway_transaction_id = $2
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway_txn
    ON payment_orders (gateway, gateway_transaction_id)
    WHERE gateway_transaction_id IS NOT NULL;

-- Supports: admin payment history with status filter
CREATE INDEX IF NOT EXISTS idx_payment_orders_player_status_created
    ON payment_orders (player_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- withdrawal_requests: admin review queue sorted by creation time
-- ---------------------------------------------------------------------------

-- Supports: admin dashboard showing pending withdrawals FIFO
--   WHERE status = 'PENDING_REVIEW' ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created
    ON withdrawal_requests (status, created_at ASC);

-- ---------------------------------------------------------------------------
-- outbox_events: worker polling for pending events (critical hot path)
-- ---------------------------------------------------------------------------

-- Replaces the partial index from V010 with a more selective composite index
-- Supports: outbox worker polling
--   WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1
-- Note: V010 already has idx_outbox_events_pending — this adds attempt count for retry backoff
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending_attempts
    ON outbox_events (status, attempts, created_at ASC)
    WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- audit_logs: admin audit trail browsing (time-descending + entity filter)
-- ---------------------------------------------------------------------------

-- Supports: admin filtering audit log by action type within a time range
--   WHERE action = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
    ON audit_logs (action, created_at DESC);

-- ---------------------------------------------------------------------------
-- player_coupons: coupon eligibility check during draw (hot path)
-- ---------------------------------------------------------------------------

-- Supports: finding available coupons for a player for a specific campaign type
--   WHERE player_id = $1 AND is_used = false ORDER BY acquired_at ASC
CREATE INDEX IF NOT EXISTS idx_player_coupons_player_unused
    ON player_coupons (player_id, is_used, acquired_at ASC)
    WHERE is_used = false;

-- ---------------------------------------------------------------------------
-- exchange_requests: player exchange inbox/outbox
-- ---------------------------------------------------------------------------

-- Supports: listing pending exchange offers for a player (recipient inbox)
--   WHERE recipient_id = $1 AND status = 'PENDING'
CREATE INDEX IF NOT EXISTS idx_exchange_requests_recipient_status
    ON exchange_requests (recipient_id, status, created_at DESC);

-- Supports: listing sent exchange offers (initiator outbox)
CREATE INDEX IF NOT EXISTS idx_exchange_requests_initiator_status
    ON exchange_requests (initiator_id, status, created_at DESC);
