package com.prizedraw.contracts.endpoints

public object CampaignEndpoints {
    public const val BASE: String = "/api/v1/campaigns"
    public const val LIST: String = BASE
    public const val BY_ID: String = "$BASE/{campaignId}"
    public const val TICKET_BOXES: String = "$BASE/{campaignId}/ticket-boxes"
    public const val TICKET_BOX_BY_ID: String = "$BASE/{campaignId}/ticket-boxes/{boxId}"
    public const val PRIZES: String = "$BASE/{campaignId}/prizes"
    public const val STATUS: String = "$BASE/{campaignId}/status"

    // Kuji-specific
    public const val KUJI_LIST: String = "$BASE/kuji"
    public const val KUJI_BY_ID: String = "$BASE/kuji/{campaignId}"
    public const val KUJI_TICKET_BOARD: String = "$BASE/kuji/{campaignId}/boxes/{boxId}/tickets"

    // Unlimited-specific
    public const val UNLIMITED_LIST: String = "$BASE/unlimited"
    public const val UNLIMITED_BY_ID: String = "$BASE/unlimited/{campaignId}"

    // Room scaling (Phase 21)
    public const val CAMPAIGN_ROOMS: String = "$BASE/kuji/{campaignId}/rooms"
    public const val CAMPAIGN_STATS: String = "$BASE/kuji/{campaignId}/stats"
}
