package com.prizedraw.domain.services

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.services.LevelService
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.application.events.DrawCompleted
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.entities.XpSourceType
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.security.SecureRandom
import java.util.UUID

// ─────────────────────────────────────────────────────────────────────────────
// Data structures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 機率池的一個條目。遊戲層組好後傳給 DrawCore。
 * Core 不知道也不需要知道 grade、name 等顯示資訊。
 */
public data class PrizePoolEntry(
    val prizeDefinitionId: UUID,
    val weight: Int,
    val metadata: Map<String, String> = emptyMap(),
)

/**
 * DrawCore 的抽獎結果。不包含顯示資訊，只有 ID。
 * 遊戲層拿到 prizeDefinitionId 後自己去查 grade/name/photos。
 */
public data class DrawOutcome(
    val prizeDefinitionId: UUID,
    val prizeInstanceId: PrizeInstanceId,
    val pointsCharged: Int,
    val metadata: Map<String, String>,
)

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

public data class DrawCoreDeps(
    val playerRepository: IPlayerRepository,
    val prizeRepository: IPrizeRepository,
    val drawPointTxRepository: IDrawPointTransactionRepository,
    val outboxRepository: IOutboxRepository,
    val levelService: LevelService? = null,
)

// ─────────────────────────────────────────────────────────────────────────────
// DrawCore
// ─────────────────────────────────────────────────────────────────────────────

private const val MAX_BALANCE_RETRIES = 3
private const val XP_PER_DRAW_POINT = 1

/**
 * 抽獎核心引擎。所有遊戲類型共用此入口。
 *
 * 職責：加權隨機選取 → 扣款 → 建 PrizeInstance → 記帳 → 發事件 → 獎勵 XP
 * 不負責：排隊、頻率限制、庫存管理、顯示資訊
 */
public class DrawCore(private val deps: DrawCoreDeps) {

    private val log = LoggerFactory.getLogger(DrawCore::class.java)
    private val secureRandom = SecureRandom()

    /**
     * 執行抽獎。
     *
     * @param playerId 誰在抽
     * @param pool 機率池（遊戲層組好的，Core 不修改）
     * @param quantity 抽幾次（每次從同一份 pool，即放回）
     * @param pricePerDraw 每抽單價
     * @param discountAmount 優惠券折扣總額
     * @param gameType 遊戲類型標記（記帳用）
     * @param preSelected 預選結果（kuji 等已確定結果的遊戲類型使用），若非 null 則跳過隨機選取
     */
    public suspend fun draw(
        playerId: PlayerId,
        pool: List<PrizePoolEntry>,
        quantity: Int,
        pricePerDraw: Int,
        discountAmount: Int = 0,
        gameType: String = "UNKNOWN",
        preSelected: List<PrizePoolEntry>? = null,
    ): List<DrawOutcome> {
        require(pool.isNotEmpty()) { "Prize pool must not be empty" }
        require(quantity > 0) { "Quantity must be positive" }

        val totalCost = (pricePerDraw * quantity - discountAmount).coerceAtLeast(0)
        val now = Clock.System.now()

        // 注意：呼叫端需要在 newSuspendedTransaction 內呼叫此方法
        // ① 加權隨機選 quantity 次（kuji 等遊戲類型已預選，直接使用）
        val selected = preSelected ?: (1..quantity).map { spinOnce(pool) }

        // ② 扣款
        debitBalance(playerId, totalCost, now)

        // ③ 為每個結果建 PrizeInstance + 記帳 + 發事件
        return selected.map { entry ->
                val instanceId = PrizeInstanceId(UUID.randomUUID())
                val perCost = if (quantity == 1) totalCost else pricePerDraw

                // 建 PrizeInstance
                deps.prizeRepository.saveInstance(
                    PrizeInstance(
                        id = instanceId,
                        prizeDefinitionId = PrizeDefinitionId(entry.prizeDefinitionId),
                        ownerId = playerId,
                        acquisitionMethod = PrizeAcquisitionMethod.KUJI_DRAW,
                        sourceDrawTicketId = entry.metadata["ticketId"]?.let { UUID.fromString(it) },
                        sourceTradeOrderId = null,
                        sourceExchangeRequestId = null,
                        state = PrizeState.HOLDING,
                        acquiredAt = now,
                        deletedAt = null,
                        createdAt = now,
                        updatedAt = now,
                    ),
                )

                // 記帳
                deps.drawPointTxRepository.record(
                    DrawPointTransaction(
                        id = UUID.randomUUID(),
                        playerId = playerId,
                        type = DrawPointTxType.KUJI_DRAW_DEBIT,
                        amount = -perCost,
                        balanceAfter = 0, // repository 實作會自己算
                        paymentOrderId = null,
                        description = "$gameType draw",
                        createdAt = now,
                    ),
                )

                // 發事件
                deps.outboxRepository.enqueue(
                    DrawCompleted(
                        ticketId = entry.metadata["ticketId"]?.let { UUID.fromString(it) } ?: UUID.randomUUID(),
                        playerId = playerId.value,
                        prizeInstanceId = instanceId.value,
                        campaignId = UUID.randomUUID(), // 遊戲層在 afterDraw 裡可以補充
                    ),
                )

                DrawOutcome(
                    prizeDefinitionId = entry.prizeDefinitionId,
                    prizeInstanceId = instanceId,
                    pointsCharged = perCost,
                    metadata = entry.metadata,
                )
        }.also {
            awardXp(playerId, pricePerDraw * quantity)
        }
    }

    // ── 加權隨機（CDF + SecureRandom）────────────────────────────────────────

    private fun spinOnce(pool: List<PrizePoolEntry>): PrizePoolEntry {
        val totalWeight = pool.sumOf { it.weight }
        require(totalWeight > 0) { "Total weight must be positive" }
        val roll = secureRandom.nextInt(totalWeight)
        var cumulative = 0
        for (entry in pool) {
            cumulative += entry.weight
            if (roll < cumulative) return entry
        }
        return pool.last()
    }

    // ── 扣款（optimistic lock + retry）──────────────────────────────────────

    private suspend fun debitBalance(playerId: PlayerId, totalCost: Int, now: Instant) {
        if (totalCost <= 0) return
        repeat(MAX_BALANCE_RETRIES) {
            val player = deps.playerRepository.findById(playerId)
                ?: error("Player ${playerId.value} not found")
            if (player.drawPointsBalance < totalCost) {
                error("Insufficient balance: has ${player.drawPointsBalance}, needs $totalCost")
            }
            val ok = deps.playerRepository.updateBalance(
                id = playerId,
                drawPointsDelta = -totalCost,
                revenuePointsDelta = 0,
                expectedVersion = player.version,
            )
            if (ok) return
        }
        error("Failed to debit balance after $MAX_BALANCE_RETRIES retries")
    }

    // ── XP ──────────────────────────────────────────────────────────────────

    private suspend fun awardXp(playerId: PlayerId, totalSpent: Int) {
        val svc = deps.levelService ?: return
        try {
            svc.awardXp(playerId, totalSpent * XP_PER_DRAW_POINT, XpSourceType.KUJI_DRAW)
        } catch (ex: Exception) {
            log.warn("Failed to award XP for ${playerId.value}: ${ex.message}")
        }
    }
}
