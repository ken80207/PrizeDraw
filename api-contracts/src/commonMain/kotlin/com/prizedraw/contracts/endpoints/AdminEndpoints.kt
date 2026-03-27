package com.prizedraw.contracts.endpoints

public object AdminEndpoints {
    public const val BASE: String = "/api/v1/admin"

    // Campaigns
    public const val CAMPAIGNS: String = "$BASE/campaigns"
    public const val CAMPAIGN_BY_ID: String = "$BASE/campaigns/{campaignId}"
    public const val CAMPAIGN_STATUS: String = "$BASE/campaigns/{campaignId}/status"

    // Players
    public const val PLAYERS: String = "$BASE/players"
    public const val PLAYER_BY_ID: String = "$BASE/players/{playerId}"
    public const val PLAYER_ADJUST_POINTS: String = "$BASE/players/{playerId}/adjust-points"

    // Staff
    public const val STAFF: String = "$BASE/staff"
    public const val STAFF_BY_ID: String = "$BASE/staff/{staffId}"

    // Shipping
    public const val SHIPPING_ORDERS: String = "$BASE/shipping/orders"
    public const val SHIPPING_ORDER_BY_ID: String = "$BASE/shipping/orders/{orderId}"

    // Withdrawals
    public const val WITHDRAWALS: String = "$BASE/withdrawals"
    public const val WITHDRAWAL_BY_ID: String = "$BASE/withdrawals/{withdrawalId}"
    public const val WITHDRAWAL_APPROVE: String = "$BASE/withdrawals/{withdrawalId}/approve"
    public const val WITHDRAWAL_REJECT: String = "$BASE/withdrawals/{withdrawalId}/reject"

    // Feature Flags
    public const val FEATURE_FLAGS: String = "$BASE/feature-flags"
    public const val FEATURE_FLAG_BY_ID: String = "$BASE/feature-flags/{flagId}"

    // Audit Logs
    public const val AUDIT_LOGS: String = "$BASE/audit-logs"

    // Campaign type-specific create
    public const val CAMPAIGNS_KUJI: String = "$BASE/campaigns/kuji"
    public const val CAMPAIGNS_UNLIMITED: String = "$BASE/campaigns/unlimited"

    // Pricing
    public const val PRICING_BUYBACK: String = "$BASE/pricing/buyback/{prizeDefinitionId}"
    public const val PRICING_TRADE_FEE: String = "$BASE/pricing/trade-fee"

    // Support
    public const val SUPPORT_TICKETS: String = "$BASE/support/tickets"
    public const val SUPPORT_TICKET_BY_ID: String = "$BASE/support/tickets/{ticketId}"
    public const val SUPPORT_REPLY: String = "$BASE/support/tickets/{ticketId}/reply"

    // Animation modes
    public const val ANIMATION_MODES: String = "$BASE/settings/animations"
    public const val ANIMATION_MODE_BY_KEY: String = "$BASE/settings/animations/{modeKey}"

    // Leaderboard configuration
    public const val LEADERBOARD_CONFIG: String = "$BASE/leaderboard/config"

    // Trade listings (admin view)
    public const val TRADE_LISTINGS: String = "$BASE/trade/listings"
    public const val TRADE_LISTING_DELIST: String = "$BASE/trade/listings/{listingId}/delist"

    // Prizes (prize definitions admin view)
    public const val PRIZES: String = "$BASE/prizes"
    public const val PRIZE_BY_ID: String = "$BASE/prizes/{prizeId}"

    // Spectator count
    public const val SPECTATOR_COUNT: String = "/api/v1/campaigns/kuji/{campaignId}/spectators"

    // Draw records (中獎紀錄)
    public const val CAMPAIGN_DRAW_RECORDS: String = "$BASE/campaigns/{campaignId}/draw-records"

    // Dashboard
    public const val DASHBOARD_STATS: String = "$BASE/dashboard/stats"
    public const val DASHBOARD_ACTIVITY: String = "$BASE/dashboard/activity"

    // Unlimited Prize Table
    public const val UNLIMITED_PRIZE_TABLE: String = "$BASE/campaigns/unlimited/{campaignId}/prize-table"

    // Campaign Approval
    public const val CAMPAIGN_APPROVE: String = "$BASE/campaigns/{campaignId}/approve"
    public const val CAMPAIGN_REJECT: String = "$BASE/campaigns/{campaignId}/reject"

    // Risk Settings
    public const val RISK_SETTINGS: String = "$BASE/settings/risk"
}
