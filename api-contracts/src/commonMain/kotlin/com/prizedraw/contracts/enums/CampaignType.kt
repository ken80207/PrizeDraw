package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class CampaignType {
    /** Ichiban Kuji: fixed ticket pool, queue-based draw. */
    KUJI,

    /** Unlimited draw: probability-based, no fixed ticket pool. */
    UNLIMITED,
}
