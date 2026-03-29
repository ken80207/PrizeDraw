package com.prizedraw.draw.application.ports.output

import com.prizedraw.contracts.dto.draw.DrawRecordDto
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.draw.domain.entities.AuditLog
import com.prizedraw.draw.domain.entities.Coupon
import com.prizedraw.draw.domain.entities.DrawPointTransaction
import com.prizedraw.draw.domain.entities.DrawSyncSession
import com.prizedraw.draw.domain.entities.DrawTicket
import com.prizedraw.draw.domain.entities.FeedEvent
import com.prizedraw.draw.domain.entities.KujiCampaign
import com.prizedraw.draw.domain.entities.OutboxEvent
import com.prizedraw.draw.domain.entities.PityPrizePoolEntry
import com.prizedraw.draw.domain.entities.PityRule
import com.prizedraw.draw.domain.entities.PityTracker
import com.prizedraw.draw.domain.entities.Player
import com.prizedraw.draw.domain.entities.PlayerCoupon
import com.prizedraw.draw.domain.entities.PlayerCouponStatus
import com.prizedraw.draw.domain.entities.PrizeDefinition
import com.prizedraw.draw.domain.entities.PrizeInstance
import com.prizedraw.draw.domain.entities.Queue
import com.prizedraw.draw.domain.entities.QueueEntry
import com.prizedraw.draw.domain.entities.RevenuePointTransaction
import com.prizedraw.draw.domain.entities.TicketBox
import com.prizedraw.draw.domain.entities.UnlimitedCampaign
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.draw.domain.valueobjects.PrizeInstanceId
import kotlinx.coroutines.flow.Flow
import kotlinx.datetime.Instant
import java.util.UUID

// ---------------------------------------------------------------------------
// DomainEvent marker interface
// ---------------------------------------------------------------------------

/**
 * Marker interface for domain events that can be enqueued into the outbox
 * (draw-service copy).
 */
public interface DomainEvent {
    /** Dot-namespaced event type key, e.g. `draw.completed`. */
    public val eventType: String

    /** The aggregate root type name, e.g. `DrawTicket`. */
    public val aggregateType: String

    /** The primary key of the aggregate root instance. */
    public val aggregateId: UUID
}

// ---------------------------------------------------------------------------
// IOutboxRepository
// ---------------------------------------------------------------------------

/**
 * Output port for the transactional outbox pattern (draw-service copy).
 *
 * Events are enqueued within the same database transaction as the business operation.
 */
public interface IOutboxRepository {
    /** Persists a [DomainEvent] as a PENDING [OutboxEvent] within the current transaction. */
    public fun enqueue(event: DomainEvent)

    /** Returns up to [limit] PENDING [OutboxEvent]s ordered by creation time ascending. */
    public suspend fun fetchPending(limit: Int): List<OutboxEvent>

    /** Marks the outbox event with the given [id] as PROCESSED. */
    public suspend fun markProcessed(id: UUID)

    /** Marks the outbox event with the given [id] as FAILED. */
    public suspend fun markFailed(
        id: UUID,
        reason: String,
    )
}

// ---------------------------------------------------------------------------
// IPlayerRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [Player] entities (draw-service copy).
 */
@Suppress("TooManyFunctions")
public interface IPlayerRepository {
    /** Finds a [Player] by their surrogate primary key. Excludes soft-deleted players. */
    public suspend fun findById(id: PlayerId): Player?

    /** Atomically updates both point balances using optimistic locking on [Player.version]. */
    public suspend fun updateBalance(
        id: PlayerId,
        drawPointsDelta: Int,
        revenuePointsDelta: Int,
        expectedVersion: Int,
    ): Boolean

    /** Atomically increments XP and recalculates [level] and [tier]. */
    public suspend fun updateXp(
        id: PlayerId,
        xpDelta: Int,
        newLevel: Int,
        newTier: String,
    ): Int

    /** Persists a [Player] entity (insert or update). */
    public suspend fun save(player: Player): Player
}

// ---------------------------------------------------------------------------
// IPrizeRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [PrizeDefinition] and [PrizeInstance]
 * entities (draw-service copy).
 */
public interface IPrizeRepository {
    /** Finds a [PrizeDefinition] by its surrogate primary key. */
    public suspend fun findDefinitionById(id: PrizeDefinitionId): PrizeDefinition?

    /** Returns all [PrizeDefinition]s for the given campaign, optionally filtered by type. */
    public suspend fun findDefinitionsByCampaign(
        campaignId: CampaignId,
        type: CampaignType? = null,
    ): List<PrizeDefinition>

    /** Finds a [PrizeInstance] by its surrogate primary key. Excludes soft-deleted instances. */
    public suspend fun findInstanceById(id: PrizeInstanceId): PrizeInstance?

    /** Persists a new [PrizeInstance] entity. */
    public suspend fun saveInstance(instance: PrizeInstance): PrizeInstance
}

// ---------------------------------------------------------------------------
// IDrawRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [DrawTicket] entities (draw-service copy).
 */
public interface IDrawRepository {
    /** Finds a [DrawTicket] by its surrogate primary key. */
    public suspend fun findTicketById(id: UUID): DrawTicket?

    /** Returns all AVAILABLE [DrawTicket]s in the given box. */
    public suspend fun findAvailableTickets(boxId: UUID): List<DrawTicket>

    /** Returns all [DrawTicket]s belonging to the given ticket box. */
    public suspend fun findTicketsByBox(boxId: UUID): List<DrawTicket>

    /**
     * Atomically marks a ticket as drawn and records the outcome.
     *
     * Must be executed inside the kuji draw transaction.
     */
    public suspend fun markDrawn(
        ticketId: UUID,
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
        at: Instant,
    ): DrawTicket

    /** Returns drawn ticket records for a campaign joined with prize and player data. */
    public suspend fun findDrawnByCampaign(
        campaignId: CampaignId,
        limit: Int = 50,
    ): List<DrawRecordDto>
}

// ---------------------------------------------------------------------------
// ITicketBoxRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [TicketBox] entities (draw-service copy).
 */
public interface ITicketBoxRepository {
    /** Finds a [TicketBox] by its surrogate primary key. */
    public suspend fun findById(id: UUID): TicketBox?

    /** Returns all [TicketBox]es belonging to the given campaign, ordered by displayOrder. */
    public suspend fun findByCampaignId(campaignId: CampaignId): List<TicketBox>

    /**
     * Atomically decrements [TicketBox.remainingTickets] by 1.
     *
     * Returns false when [expectedRemaining] does not match the current value.
     */
    public suspend fun decrementRemainingTickets(
        id: UUID,
        expectedRemaining: Int,
    ): Boolean

    /** Persists a [TicketBox] entity (insert or update). */
    public suspend fun save(box: TicketBox): TicketBox
}

// ---------------------------------------------------------------------------
// IQueueRepository / IQueueEntryRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [Queue] entities (draw-service copy).
 */
public interface IQueueRepository {
    /** Finds a [Queue] by its surrogate primary key. */
    public suspend fun findById(id: UUID): Queue?

    /** Finds the [Queue] associated with the given ticket box. */
    public suspend fun findByTicketBoxId(ticketBoxId: UUID): Queue?

    /** Persists a [Queue] entity (insert or update). */
    public suspend fun save(queue: Queue): Queue
}

/**
 * Output port for persisting and querying [QueueEntry] entities (draw-service copy).
 */
public interface IQueueEntryRepository {
    /** Finds a [QueueEntry] by its surrogate primary key. */
    public suspend fun findById(id: UUID): QueueEntry?

    /** Finds the active or waiting entry for a player in the given queue, if any. */
    public suspend fun findActiveEntry(
        queueId: UUID,
        playerId: PlayerId,
    ): QueueEntry?

    /** Returns all non-terminal entries for the queue ordered by position ascending. */
    public suspend fun findActiveEntries(queueId: UUID): List<QueueEntry>

    /** Returns the next WAITING entry by position in the given queue. */
    public suspend fun findNextWaiting(queueId: UUID): QueueEntry?

    /** Counts the non-terminal entries at or before the given position. */
    public suspend fun countActiveEntriesBefore(
        queueId: UUID,
        position: Int,
    ): Int

    /** Persists a [QueueEntry] entity (insert or update). */
    public suspend fun save(entry: QueueEntry): QueueEntry
}

// ---------------------------------------------------------------------------
// ICampaignRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying campaign entities (draw-service copy).
 */
@Suppress("TooManyFunctions")
public interface ICampaignRepository {
    /** Finds a [KujiCampaign] by its surrogate primary key. Excludes soft-deleted campaigns. */
    public suspend fun findKujiById(id: CampaignId): KujiCampaign?

    /** Finds an [UnlimitedCampaign] by its surrogate primary key. Excludes soft-deleted. */
    public suspend fun findUnlimitedById(id: CampaignId): UnlimitedCampaign?

    /** Atomically updates the [CampaignStatus] of a kuji campaign (e.g. SOLD_OUT). */
    public suspend fun updateKujiStatus(
        id: CampaignId,
        status: CampaignStatus,
    )
}

// ---------------------------------------------------------------------------
// ICouponRepository
// ---------------------------------------------------------------------------

/**
 * Output port for coupon entities needed by draw use cases (draw-service copy).
 */
public interface ICouponRepository {
    /** Finds a [PlayerCoupon] by its surrogate primary key. */
    public suspend fun findPlayerCouponById(id: UUID): PlayerCoupon?

    /** Returns all [PlayerCoupon]s in a player's wallet, optionally filtered by status. */
    public suspend fun findPlayerCoupons(
        playerId: PlayerId,
        status: PlayerCouponStatus? = null,
    ): List<PlayerCoupon>

    /** Persists a [PlayerCoupon] entity (insert or update). */
    public suspend fun savePlayerCoupon(playerCoupon: PlayerCoupon): PlayerCoupon

    /** Finds a [Coupon] by its surrogate primary key. */
    public suspend fun findCouponById(id: UUID): Coupon?
}

// ---------------------------------------------------------------------------
// IPityRepository
// ---------------------------------------------------------------------------

/**
 * Output port for pity system persistence operations (draw-service copy).
 */
public interface IPityRepository {
    /** Finds the pity rule for a campaign, or null if none configured. */
    public suspend fun findRuleByCampaignId(campaignId: CampaignId): PityRule?

    /** Finds all prize pool entries for a pity rule. */
    public suspend fun findPoolByRuleId(ruleId: UUID): List<PityPrizePoolEntry>

    /** Finds the player's tracker for a pity rule, or null if none exists. */
    public suspend fun findTracker(
        ruleId: UUID,
        playerId: PlayerId,
    ): PityTracker?

    /** Saves (insert or update) a pity tracker with optimistic locking. Returns false on conflict. */
    public suspend fun saveTracker(tracker: PityTracker): Boolean
}

// ---------------------------------------------------------------------------
// IDrawPointTransactionRepository / IRevenuePointTransactionRepository
// ---------------------------------------------------------------------------

/**
 * Output port for the draw-point transaction ledger (draw-service copy).
 */
public interface IDrawPointTransactionRepository {
    /** Inserts a new [DrawPointTransaction] ledger entry within the current transaction. */
    public fun record(transaction: DrawPointTransaction)

    /** Returns paginated draw-point transaction history for a player, ordered by time desc. */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<DrawPointTransaction>
}

/**
 * Output port for the revenue-point transaction ledger (draw-service copy).
 */
public interface IRevenuePointTransactionRepository {
    /** Inserts a new [RevenuePointTransaction] ledger entry within the current transaction. */
    public fun record(transaction: RevenuePointTransaction)

    /** Returns paginated revenue-point transaction history for a player, ordered by time desc. */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<RevenuePointTransaction>
}

// ---------------------------------------------------------------------------
// IAuditRepository
// ---------------------------------------------------------------------------

/**
 * Output port for recording [AuditLog] entries (draw-service copy).
 *
 * Append-only.
 */
public interface IAuditRepository {
    /** Inserts a new [AuditLog] entry within the current transaction. */
    public fun record(log: AuditLog)
}

// ---------------------------------------------------------------------------
// IDrawSyncRepository
// ---------------------------------------------------------------------------

/**
 * Persistence port for [DrawSyncSession] (draw-service copy).
 */
public interface IDrawSyncRepository {
    /** Persists a new draw sync session. */
    public suspend fun save(session: DrawSyncSession): DrawSyncSession

    /** Returns the draw sync session with the given [id], or null if not found. */
    public suspend fun findById(id: UUID): DrawSyncSession?

    /** Returns the active draw sync session for [playerId], or null if none in flight. */
    public suspend fun findActiveByPlayer(playerId: UUID): DrawSyncSession?

    /** Persists the latest animation progress for a session. */
    public suspend fun updateProgress(
        id: UUID,
        progress: Float,
    )

    /** Marks the session as revealed. */
    public suspend fun markRevealed(id: UUID)

    /** Marks the session as cancelled. */
    public suspend fun markCancelled(id: UUID)
}

// ---------------------------------------------------------------------------
// ILeaderboardRepository
// ---------------------------------------------------------------------------

/**
 * A single entry in a leaderboard ranking (draw-service copy).
 */
public data class LeaderboardEntry(
    val rank: Int,
    val playerId: PlayerId,
    val nickname: String,
    val score: Long,
)

/**
 * Output port for reading leaderboard data (draw-service copy).
 */
public interface ILeaderboardRepository {
    /** Returns the top-N players by total draw count in the given time window. */
    public suspend fun findGlobalTopPlayers(
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry>

    /** Returns the top-N players by draw count for a specific campaign. */
    public suspend fun findCampaignTopPlayers(
        campaignId: CampaignId,
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry>

    /** Returns the rank of a specific player in the global leaderboard for the given window. */
    public suspend fun findPlayerRank(
        playerId: PlayerId,
        from: Instant,
        until: Instant,
    ): Int?
}

// ---------------------------------------------------------------------------
// IFeedEventRepository
// ---------------------------------------------------------------------------

/**
 * Output port for persisting and querying [FeedEvent] records (draw-service copy).
 */
public interface IFeedEventRepository {
    /** Persists a single [FeedEvent] row. */
    public suspend fun save(event: FeedEvent): Unit

    /** Returns the most recent draw events, ordered by drawnAt descending. */
    public suspend fun findRecent(limit: Int): List<FeedEvent>
}

// ---------------------------------------------------------------------------
// IPubSubService
// ---------------------------------------------------------------------------

/**
 * Output port for pub/sub messaging (draw-service copy).
 */
public interface IPubSubService {
    /** Publishes [message] to the given [channel]. */
    public suspend fun publish(
        channel: String,
        message: String,
    )

    /** Returns a [Flow] that emits messages published to [channel]. */
    public fun subscribe(channel: String): Flow<String>
}

// ---------------------------------------------------------------------------
// IDistributedLockService
// ---------------------------------------------------------------------------

/**
 * Output port for distributed locking (draw-service copy).
 */
public interface IDistributedLockService {
    /**
     * Executes [block] while holding a distributed lock on [key].
     *
     * @param key The lock key (unique per resource being locked).
     * @param ttlSeconds Lock TTL in seconds.
     * @param block The code to execute while holding the lock.
     * @return The result of [block], or null if the lock could not be acquired.
     */
    public suspend fun <T> withLock(
        key: String,
        ttlSeconds: Long = 30,
        block: suspend () -> T,
    ): T?
}
