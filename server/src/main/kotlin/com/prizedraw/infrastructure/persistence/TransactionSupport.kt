package com.prizedraw.infrastructure.persistence

import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Thin wrapper around [newSuspendedTransaction] for coroutine-safe database access.
 *
 * Provides a shorter call-site alias used throughout the persistence layer.
 */
public suspend fun <T> inTransaction(block: suspend () -> T): T = newSuspendedTransaction { block() }
