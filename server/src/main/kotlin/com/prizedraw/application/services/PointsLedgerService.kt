package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Centralised atomic debit/credit service for both draw-point and revenue-point wallets.
 *
 * All operations use optimistic locking with up to [MAX_RETRIES] exponential-backoff
 * retries on the [Player.version] column. Throws [InsufficientBalanceException] when a
 * debit would drive the balance negative.
 *
 * Must be called **within** an active Exposed `newSuspendedTransaction` block so that
 * the balance mutation and ledger insert are committed atomically.
 */
public class PointsLedgerService(
    private val playerRepository: IPlayerRepository,
    private val drawPointTxRepository: IDrawPointTransactionRepository,
    private val revenuePointTxRepository: IRevenuePointTransactionRepository,
) {
    private val log = LoggerFactory.getLogger(PointsLedgerService::class.java)

    /**
     * Debits draw points from the player's wallet.
     *
     * @param playerId    The player to debit.
     * @param amount      Positive amount to debit.
     * @param txType      The draw-point transaction type.
     * @param referenceId Optional reference identifier (e.g. payment order UUID).
     * @param description Human-readable description.
     * @return The inserted [DrawPointTransaction].
     */
    public suspend fun debitDrawPoints(
        playerId: PlayerId,
        amount: Int,
        txType: DrawPointTxType,
        referenceId: UUID? = null,
        description: String? = null,
    ): DrawPointTransaction {
        require(amount > 0) { "Debit amount must be positive" }
        return retryBalance("debit draw points") {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            if (player.drawPointsBalance < amount) {
                throw InsufficientBalanceException(
                    "Insufficient draw points: need $amount, have ${player.drawPointsBalance}",
                )
            }
            val now = Clock.System.now()
            val updated = playerRepository.updateBalance(playerId, -amount, 0, player.version)
            if (!updated) {
                return@retryBalance null
            }
            val tx =
                DrawPointTransaction(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    type = txType,
                    amount = -amount,
                    balanceAfter = player.drawPointsBalance - amount,
                    paymentOrderId = referenceId,
                    description = description,
                    createdAt = now,
                )
            drawPointTxRepository.record(tx)
            tx
        }
    }

    /**
     * Credits draw points to the player's wallet.
     *
     * @param playerId    The player to credit.
     * @param amount      Positive amount to credit.
     * @param txType      The draw-point transaction type.
     * @param referenceId Optional reference identifier.
     * @param description Human-readable description.
     * @return The inserted [DrawPointTransaction].
     */
    public suspend fun creditDrawPoints(
        playerId: PlayerId,
        amount: Int,
        txType: DrawPointTxType,
        referenceId: UUID? = null,
        description: String? = null,
    ): DrawPointTransaction {
        require(amount > 0) { "Credit amount must be positive" }
        return retryBalance("credit draw points") {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            val now = Clock.System.now()
            val updated = playerRepository.updateBalance(playerId, amount, 0, player.version)
            if (!updated) {
                return@retryBalance null
            }
            val tx =
                DrawPointTransaction(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    type = txType,
                    amount = amount,
                    balanceAfter = player.drawPointsBalance + amount,
                    paymentOrderId = referenceId,
                    description = description,
                    createdAt = now,
                )
            drawPointTxRepository.record(tx)
            tx
        }
    }

    /**
     * Debits revenue points from the player's wallet.
     *
     * @param playerId    The player to debit.
     * @param amount      Positive amount to debit.
     * @param txType      The revenue-point transaction type.
     * @param referenceId Optional reference identifier.
     * @param description Human-readable description.
     * @return The inserted [RevenuePointTransaction].
     */
    public suspend fun debitRevenuePoints(
        playerId: PlayerId,
        amount: Int,
        txType: RevenuePointTxType,
        referenceId: UUID? = null,
        description: String? = null,
    ): RevenuePointTransaction {
        require(amount > 0) { "Debit amount must be positive" }
        return retryBalance("debit revenue points") {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            if (player.revenuePointsBalance < amount) {
                throw InsufficientBalanceException(
                    "Insufficient revenue points: need $amount, have ${player.revenuePointsBalance}",
                )
            }
            val now = Clock.System.now()
            val updated = playerRepository.updateBalance(playerId, 0, -amount, player.version)
            if (!updated) {
                return@retryBalance null
            }
            val tx =
                RevenuePointTransaction(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    type = txType,
                    amount = -amount,
                    balanceAfter = player.revenuePointsBalance - amount,
                    tradeOrderId = referenceId,
                    description = description,
                    createdAt = now,
                )
            revenuePointTxRepository.record(tx)
            tx
        }
    }

    /**
     * Credits revenue points to the player's wallet.
     *
     * @param playerId    The player to credit.
     * @param amount      Positive amount to credit.
     * @param txType      The revenue-point transaction type.
     * @param referenceId Optional reference identifier.
     * @param description Human-readable description.
     * @return The inserted [RevenuePointTransaction].
     */
    public suspend fun creditRevenuePoints(
        playerId: PlayerId,
        amount: Int,
        txType: RevenuePointTxType,
        referenceId: UUID? = null,
        description: String? = null,
    ): RevenuePointTransaction {
        require(amount > 0) { "Credit amount must be positive" }
        return retryBalance("credit revenue points") {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            val now = Clock.System.now()
            val updated = playerRepository.updateBalance(playerId, 0, amount, player.version)
            if (!updated) {
                return@retryBalance null
            }
            val tx =
                RevenuePointTransaction(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    type = txType,
                    amount = amount,
                    balanceAfter = player.revenuePointsBalance + amount,
                    tradeOrderId = referenceId,
                    description = description,
                    createdAt = now,
                )
            revenuePointTxRepository.record(tx)
            tx
        }
    }

    private suspend fun <T : Any> retryBalance(
        operation: String,
        block: suspend () -> T?,
    ): T {
        repeat(MAX_RETRIES) { attempt ->
            val result = block()
            if (result != null) {
                return result
            }
            log.warn("Optimistic lock failed for '$operation', attempt ${attempt + 1}/$MAX_RETRIES")
            kotlinx.coroutines.delay(BACKOFF_BASE_MS * (1L shl attempt))
        }
        error("Failed to complete '$operation' after $MAX_RETRIES attempts")
    }

    private companion object {
        const val MAX_RETRIES = 5
        const val BACKOFF_BASE_MS = 20L
    }
}

/** Thrown when a debit operation would make a balance negative. */
public class InsufficientBalanceException(
    message: String,
) : IllegalStateException(message)
