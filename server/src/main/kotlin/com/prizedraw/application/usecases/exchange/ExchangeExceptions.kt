package com.prizedraw.application.usecases.exchange

/** Thrown when the `exchange_feature` flag is disabled. */
public class FeatureDisabledException(
    message: String,
) : IllegalStateException(message)

/** Thrown when an exchange request is not found. */
public class ExchangeRequestNotFoundException(
    message: String,
) : IllegalArgumentException(message)

/** Thrown when the caller is not the expected party for the operation. */
public class ExchangeUnauthorizedException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the exchange request is not in a mutable state. */
public class ExchangeNotPendingException(
    message: String,
) : IllegalStateException(message)

/** Thrown when a prize is not in HOLDING state for an exchange operation. */
public class PrizeNotAvailableForExchangeException(
    message: String,
) : IllegalStateException(message)
