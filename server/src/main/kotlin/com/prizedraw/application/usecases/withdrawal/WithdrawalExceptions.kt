package com.prizedraw.application.usecases.withdrawal

/** Thrown when a withdrawal request is not found. */
public class WithdrawalNotFoundException(
    message: String,
) : IllegalArgumentException(message)

/** Thrown when an operation is performed on a withdrawal in the wrong state. */
public class WithdrawalStateException(
    message: String,
) : IllegalStateException(message)

/** Thrown when a bank transfer fails. */
public class TransferFailedException(
    message: String,
) : IllegalStateException(message)
