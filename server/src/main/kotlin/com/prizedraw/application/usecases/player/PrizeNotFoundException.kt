package com.prizedraw.application.usecases.player

/** Thrown when a prize instance is not found or not owned by the requesting player. */
public class PrizeNotFoundException(
    message: String,
) : IllegalArgumentException(message)
