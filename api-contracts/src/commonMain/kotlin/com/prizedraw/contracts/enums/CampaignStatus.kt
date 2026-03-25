package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class CampaignStatus {
    DRAFT,
    ACTIVE,
    SUSPENDED,
    SOLD_OUT,
}
