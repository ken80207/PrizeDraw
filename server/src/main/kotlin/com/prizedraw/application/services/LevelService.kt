package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.ITierConfigRepository
import com.prizedraw.application.ports.output.IXpTransactionRepository
import com.prizedraw.domain.entities.TierConfig
import com.prizedraw.domain.entities.XpRules
import com.prizedraw.domain.entities.XpSourceType
import com.prizedraw.domain.entities.XpTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Application service responsible for all player XP and levelling operations.
 *
 * Key responsibilities:
 * - Award XP for draw and trade actions.
 * - Recalculate the player's [level][com.prizedraw.domain.entities.Player.level] and
 *   [tier][com.prizedraw.domain.entities.Player.tier] after every XP award.
 * - Enqueue level-up and tier-change outbox events so the notification worker can
 *   dispatch push messages to the player's device.
 * - Serve XP history and tier reference data for the API layer.
 */
public class LevelService(
    private val playerRepository: IPlayerRepository,
    private val xpTransactionRepository: IXpTransactionRepository,
    private val tierConfigRepository: ITierConfigRepository,
    private val outboxRepository: IOutboxRepository,
) {
    private val log = LoggerFactory.getLogger(LevelService::class.java)

    /**
     * Awards [amount] XP to [playerId] for a given action, then recalculates the
     * player's level and tier.
     *
     * All writes (XP transaction record, player XP/level/tier update) are performed
     * inside a single suspended DB transaction to maintain consistency. Outbox events
     * for level-up and tier-change notifications are enqueued within the same transaction.
     *
     * @param playerId Recipient player.
     * @param amount XP amount to credit (must be positive).
     * @param sourceType Category of the action that triggered the award.
     * @param sourceId Optional reference entity (draw ticket, trade order, etc.).
     * @param description Human-readable label shown in the XP history feed.
     * @return [LevelUpResult] summarising before/after state and whether milestones were crossed.
     */
    public suspend fun awardXp(
        playerId: PlayerId,
        amount: Int,
        sourceType: XpSourceType,
        sourceId: UUID? = null,
        description: String? = null,
    ): LevelUpResult =
        newSuspendedTransaction {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")

            val previousXp = player.xp
            val previousLevel = player.level
            val previousTier = player.tier

            // 1. Record the XP transaction
            val xpTx =
                XpTransaction(
                    id = UUID.randomUUID(),
                    playerId = playerId.value,
                    amount = amount,
                    sourceType = sourceType,
                    sourceId = sourceId,
                    description = description,
                    createdAt = Clock.System.now(),
                )
            xpTransactionRepository.save(xpTx)

            // 2. Compute new state
            val newXp = previousXp + amount
            val newLevel = XpRules.levelFromXp(newXp)
            val newTier = resolveTier(newXp)

            // 3. Persist updated XP, level, tier
            playerRepository.updateXp(playerId, amount, newLevel, newTier)

            val leveledUp = newLevel > previousLevel
            val tierChanged = newTier != previousTier

            // 4. Enqueue outbox events if milestones crossed
            if (leveledUp || tierChanged) {
                outboxRepository.enqueue(
                    PlayerLevelUpEvent(
                        playerId = playerId.value,
                        newLevel = newLevel,
                        newTier = newTier.takeIf { tierChanged },
                        xpEarned = amount,
                    ),
                )
                val tierMsg =
                    if (tierChanged) {
                        " and advanced to tier $newTier"
                    } else {
                        ""
                    }
                log.info("Player ${playerId.value} levelled up to Lv.$newLevel$tierMsg")
            }

            LevelUpResult(
                newXp = newXp,
                newLevel = newLevel,
                newTier = newTier,
                previousLevel = previousLevel,
                previousTier = previousTier,
                leveledUp = leveledUp,
                tierChanged = tierChanged,
                xpToNextLevel = XpRules.xpToNextLevel(newXp),
            )
        }

    /**
     * Returns the current level info for [playerId], including the active [TierConfig]
     * and progress towards the next level.
     *
     * @param playerId The player to query.
     * @return [PlayerLevelInfo] snapshot.
     */
    public suspend fun getPlayerLevel(playerId: PlayerId): PlayerLevelInfo {
        val player =
            playerRepository.findById(playerId)
                ?: error("Player ${playerId.value} not found")
        val tierConfig =
            tierConfigRepository.findByTier(player.tier)
                ?: tierConfigRepository.findAll().first()
        return PlayerLevelInfo(
            xp = player.xp,
            level = player.level,
            tier = player.tier,
            tierConfig = tierConfig,
            xpToNextLevel = XpRules.xpToNextLevel(player.xp),
            xpProgress = XpRules.xpProgress(player.xp),
        )
    }

    /**
     * Returns all tier configurations ordered by [TierConfig.sortOrder] ascending.
     *
     * @return Full ordered tier list.
     */
    public suspend fun getTierConfigs(): List<TierConfig> = tierConfigRepository.findAll()

    /**
     * Returns the XP leaderboard — top players ordered by cumulative XP descending.
     *
     * @param limit Maximum number of entries to return (default 50).
     * @return Ranked leaderboard entries.
     */
    public suspend fun getXpLeaderboard(limit: Int = DEFAULT_LEADERBOARD_LIMIT): List<XpLeaderboardEntry> {
        val players = playerRepository.findTopByXp(limit)
        return players.mapIndexed { index, player ->
            XpLeaderboardEntry(
                rank = index + 1,
                playerId = player.id.value,
                nickname = player.nickname,
                avatarUrl = player.avatarUrl,
                xp = player.xp,
                level = player.level,
                tier = player.tier,
            )
        }
    }

    /**
     * Resolves the appropriate tier key for [xp] by scanning all tier configs.
     *
     * Selects the highest tier whose [TierConfig.minXp] is <= [xp].
     * Falls back to `BRONZE` if no tiers are configured.
     */
    private suspend fun resolveTier(xp: Int): String {
        val tiers = tierConfigRepository.findAll()
        return tiers
            .filter { it.minXp <= xp }
            .maxByOrNull { it.minXp }
            ?.tier
            ?: "BRONZE"
    }

    private companion object {
        const val DEFAULT_LEADERBOARD_LIMIT = 50
    }
}

// ---------------------------------------------------------------------------
// Result and info types
// ---------------------------------------------------------------------------

/**
 * Returned by [LevelService.awardXp] to communicate XP changes and milestone crossings.
 *
 * @property newXp Updated cumulative XP.
 * @property newLevel Level after this XP award.
 * @property newTier Tier after this XP award.
 * @property previousLevel Level before this XP award.
 * @property previousTier Tier before this XP award.
 * @property leveledUp True if [newLevel] > [previousLevel].
 * @property tierChanged True if [newTier] != [previousTier].
 * @property xpToNextLevel XP remaining until the next level boundary.
 */
public data class LevelUpResult(
    val newXp: Int,
    val newLevel: Int,
    val newTier: String,
    val previousLevel: Int,
    val previousTier: String,
    val leveledUp: Boolean,
    val tierChanged: Boolean,
    val xpToNextLevel: Int,
)

/**
 * A snapshot of the player's current levelling state, ready for serialisation.
 *
 * @property xp Cumulative XP.
 * @property level Current level.
 * @property tier Current tier key.
 * @property tierConfig Full [TierConfig] for the current tier.
 * @property xpToNextLevel XP gap to the next level.
 * @property xpProgress Fraction through the current level band [0.0, 1.0].
 */
public data class PlayerLevelInfo(
    val xp: Int,
    val level: Int,
    val tier: String,
    val tierConfig: TierConfig,
    val xpToNextLevel: Int,
    val xpProgress: Float,
)

/**
 * A single entry in the XP leaderboard.
 *
 * @property rank 1-based rank position.
 * @property playerId Player UUID.
 * @property nickname Display name.
 * @property avatarUrl Optional profile image URL.
 * @property xp Cumulative XP.
 * @property level Current level.
 * @property tier Current tier key.
 */
public data class XpLeaderboardEntry(
    val rank: Int,
    val playerId: UUID,
    val nickname: String,
    val avatarUrl: String?,
    val xp: Int,
    val level: Int,
    val tier: String,
)

// ---------------------------------------------------------------------------
// Outbox event
// ---------------------------------------------------------------------------

/**
 * Domain event enqueued when a player crosses a level or tier boundary.
 *
 * The outbox worker dispatches this as a push notification to the player's device.
 *
 * @property newTier Non-null only if the tier also changed in this XP award.
 */
internal class PlayerLevelUpEvent(
    val playerId: UUID,
    val newLevel: Int,
    val newTier: String?,
    val xpEarned: Int,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "player.level_up"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}
