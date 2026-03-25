package com.prizedraw.application.usecases.trade

/** Thrown when a trade listing is not found. */
public class TradeListingNotFoundException(
    message: String,
) : IllegalArgumentException(message)

/** Thrown when a player attempts to purchase their own listing. */
public class SelfPurchaseException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the listing is not in LISTED state. */
public class ListingNotAvailableException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the buyer has insufficient draw points. */
public class InsufficientDrawPointsException(
    required: Int,
    available: Int,
) : IllegalStateException("Insufficient draw points: need $required, have $available")

/** Thrown when the prize is not in HOLDING state for listing. */
public class PrizeNotAvailableForTradeException(
    message: String,
) : IllegalStateException(message)
