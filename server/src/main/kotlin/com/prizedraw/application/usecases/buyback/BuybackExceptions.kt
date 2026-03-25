package com.prizedraw.application.usecases.buyback

/** Thrown when buyback is not enabled for the prize definition. */
public class BuybackDisabledException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the prize is not in HOLDING state for buyback. */
public class PrizeNotAvailableForBuybackException(
    message: String,
) : IllegalStateException(message)
