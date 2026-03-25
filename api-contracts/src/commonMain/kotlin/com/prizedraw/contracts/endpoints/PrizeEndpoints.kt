package com.prizedraw.contracts.endpoints

/**
 * API endpoint constants for prize-instance operations accessible to players.
 *
 * - [BUYBACK_PRICE] — Preview the buyback price for a specific prize instance.
 * - [BUYBACK]       — Execute the buyback for a specific prize instance.
 */
public object PrizeEndpoints {
    public const val BUYBACK_PRICE: String = "/api/v1/prizes/buyback-price/{prizeInstanceId}"
    public const val BUYBACK: String = "/api/v1/prizes/{prizeInstanceId}/buyback"
}
