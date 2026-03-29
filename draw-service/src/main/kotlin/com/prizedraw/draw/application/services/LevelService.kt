package com.prizedraw.draw.application.services

import com.prizedraw.draw.application.ports.output.IPlayerRepository
import com.prizedraw.draw.domain.entities.XpRules
import com.prizedraw.draw.domain.valueobjects.PlayerId
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory

/**
 * Lightweight XP-award service used by [DrawCore] to credit XP after draws
 * (draw-service copy — stripped to the subset needed by draw flows).
 *
 * Must be called within an active `newSuspendedTransaction` or will start its own.
 */
public class LevelService(
    private val playerRepository: IPlayerRepository,
) {
    private val log = LoggerFactory.getLogger(LevelService::class.java)

    /**
     * Awards [amount] XP to [playerId] and recalculates the player's level.
     *
     * @param playerId Recipient player.
     * @param amount XP amount to credit (must be positive).
     */
    public suspend fun awardXp(
        playerId: PlayerId,
        amount: Int,
    ) {
        if (amount <= 0) {
            return
        }
        newSuspendedTransaction {
            val player =
                playerRepository.findById(playerId)
                    ?: run {
                        log.warn("LevelService: player ${playerId.value} not found, skipping XP award")
                        return@newSuspendedTransaction
                    }
            val newXp = player.xp + amount
            val newLevel = XpRules.levelFromXp(newXp)
            playerRepository.updateXp(playerId, amount, newLevel, player.tier)
        }
    }
}
