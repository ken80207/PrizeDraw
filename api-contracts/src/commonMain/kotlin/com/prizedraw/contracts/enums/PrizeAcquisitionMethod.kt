package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** How a player obtained a particular prize instance. */
@Serializable
public enum class PrizeAcquisitionMethod {
    KUJI_DRAW,
    UNLIMITED_DRAW,
    TRADE_PURCHASE,
    EXCHANGE,
}
