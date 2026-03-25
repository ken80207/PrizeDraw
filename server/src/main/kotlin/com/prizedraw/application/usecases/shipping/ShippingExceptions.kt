package com.prizedraw.application.usecases.shipping

/** Thrown when a shipping order is not found. */
public class ShippingNotFoundException(
    message: String,
) : IllegalArgumentException(message)

/** Thrown when an operation is not permitted given the current order or prize state. */
public class CancellationNotAllowedException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the requested prize instance is not in the expected state for shipping. */
public class PrizeNotHoldingException(
    message: String,
) : IllegalStateException(message)
