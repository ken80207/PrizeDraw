package com.prizedraw.testutil

import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.jetbrains.exposed.sql.Transaction
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Shared helper for mocking [newSuspendedTransaction] in unit tests that exercise use cases
 * containing DB transaction blocks, without a real database.
 *
 * Usage:
 * ```kotlin
 * beforeSpec { TransactionTestHelper.mockTransactions() }
 * afterSpec { TransactionTestHelper.unmockTransactions() }
 * beforeEach { TransactionTestHelper.stubTransaction() }
 * afterEach { clearAllMocks() }
 * ```
 *
 * Or when mocking fresh per test:
 * ```kotlin
 * beforeEach { TransactionTestHelper.mockTransactions() }
 * afterEach { clearAllMocks(); TransactionTestHelper.unmockTransactions() }
 * ```
 */
public object TransactionTestHelper {
    private const val SUSPENDED_KT = "org.jetbrains.exposed.sql.transactions.experimental.SuspendedKt"

    /**
     * Calls [mockkStatic] for the Exposed SuspendedKt class and installs the stub.
     * Call once per spec (in [beforeSpec]) or once per test (in [beforeEach]).
     */
    public fun mockTransactions() {
        mockkStatic(SUSPENDED_KT)
        stubTransaction()
    }

    /**
     * (Re-)installs the [newSuspendedTransaction] stub without re-registering the static mock.
     *
     * Use in [beforeEach] after [clearAllMocks] when the static mock was registered in [beforeSpec].
     */
    public fun stubTransaction() {
        coEvery { newSuspendedTransaction<Any?>(any(), any(), any(), any(), any()) } coAnswers {
            // args[4] is the `statement: suspend Transaction.() -> T` lambda.
            // args.last() would return the Continuation appended by the Kotlin compiler,
            // causing ClassCastException when invoked with a mock Transaction receiver.
            @Suppress("UNCHECKED_CAST")
            val block = args[4] as suspend Transaction.() -> Any?
            block.invoke(mockk<Transaction>(relaxed = true))
        }
    }

    /**
     * Removes the static mock for [newSuspendedTransaction].
     */
    public fun unmockTransactions() {
        unmockkStatic(SUSPENDED_KT)
    }
}
