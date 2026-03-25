package com.prizedraw.application.usecases.admin

import com.prizedraw.contracts.enums.CampaignStatus

/** Thrown when a campaign status transition is not permitted. */
public class InvalidCampaignTransitionException(
    current: CampaignStatus,
    requested: CampaignStatus,
) : IllegalStateException(
        "Cannot transition campaign from $current to $requested. " +
            "Allowed: DRAFT→ACTIVE, ACTIVE→SUSPENDED, SUSPENDED→ACTIVE.",
    )

/** Thrown when attempting to modify locked fields on an active kuji campaign. */
public class CampaignFieldLockedException(
    fieldName: String,
    campaignId: String,
) : IllegalStateException(
        "Field '$fieldName' is locked on active kuji campaign $campaignId.",
    )

/** Thrown when a prize definition is not found during admin operations. */
public class PrizeDefinitionNotFoundException(
    id: String,
) : IllegalArgumentException("PrizeDefinition $id not found.")

/** Thrown when a campaign is not found during admin operations. */
public class AdminCampaignNotFoundException(
    id: String,
) : IllegalArgumentException("Campaign $id not found.")

/** Thrown when a trade fee rate value is out of the permitted range [0, 10000]. */
public class InvalidTradeFeeRateException(
    rate: Int,
) : IllegalArgumentException(
        "Trade fee rate $rate bps is out of range. Must be between 0 and 10000.",
    )

/** Thrown when a buyback price is negative. */
public class InvalidBuybackPriceException(
    price: Int,
) : IllegalArgumentException("Buyback price $price must be >= 0.")

/** Key in feature_flags / platform config for the trade fee rate. */
public const val TRADE_FEE_RATE_CONFIG_KEY: String = "platform_config.trade_fee_rate_bps"
