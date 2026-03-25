package com.prizedraw.application.usecases.payment

/** Thrown when the requested points package does not exist or is inactive. */
public class PackageNotFoundException(
    message: String,
) : Exception(message)

/** Thrown when payment webhook verification fails. */
public class WebhookVerificationException(
    message: String,
) : Exception(message)
