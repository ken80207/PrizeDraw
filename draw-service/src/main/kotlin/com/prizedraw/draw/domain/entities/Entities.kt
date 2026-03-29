package com.prizedraw.draw.domain.entities

import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.draw.domain.valueobjects.CampaignGradeId
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.draw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID
import kotlin.math.sqrt

// ---------------------------------------------------------------------------
// Value Objects (draw-service local copies)
// ---------------------------------------------------------------------------

/**
 * A validated E.164-format phone number (draw-service copy).
 */
@JvmInline
public value class PhoneNumber(
    public val value: String,
) {
    init {
        require(E164_REGEX.matches(value)) {
            "Phone number must be in E.164 format (e.g. +886912345678), was: '$value'"
        }
    }

    override fun toString(): String = value

    public companion object {
        private val E164_REGEX = Regex("""^\+[1-9]\d{6,14}$""")

        /** Attempts to parse [raw] as an E.164 phone number; returns null if invalid. */
        public fun tryParse(raw: String): PhoneNumber? = runCatching { PhoneNumber(raw) }.getOrNull()
    }
}

// ---------------------------------------------------------------------------
// Enums (draw-service local copies)
// ---------------------------------------------------------------------------

/** How pity draw count accumulates: persisted across sessions or reset on session timeout. */
public enum class AccumulationMode {
    /** Draw count persists indefinitely across sessions. */
    PERSISTENT,

    /** Draw count resets if the player does not draw within [PityRule.sessionTimeoutSeconds]. */
    SESSION,
}

/** How a player originally acquired a [PrizeInstance]. */
public enum class PrizeAcquisitionMethod {
    /** Acquired by drawing a ticket from a [KujiCampaign]. */
    KUJI_DRAW,

    /** Acquired from an [UnlimitedCampaign] draw. */
    UNLIMITED_DRAW,

    /** Acquired by purchasing from another player's trade listing. */
    TRADE_PURCHASE,

    /** Acquired via a completed player-to-player exchange. */
    EXCHANGE,
}

/** Status of a [DrawTicket] slot. */
public enum class DrawTicketStatus {
    /** The ticket has not yet been drawn. */
    AVAILABLE,

    /** The ticket has been drawn by a player. Terminal state. */
    DRAWN,
}

/** Status of a [TicketBox] draw pool. */
public enum class TicketBoxStatus {
    /** Tickets are still available for drawing. */
    AVAILABLE,

    /** All tickets have been drawn; this box is closed. Terminal state. */
    SOLD_OUT,
}

/** Processing state of an [OutboxEvent]. */
public enum class OutboxEventStatus {
    /** Event has been persisted but not yet published. */
    PENDING,

    /** Event has been successfully published to the message bus. */
    PROCESSED,

    /** Event failed to publish after maximum retry attempts. */
    FAILED,
}

/** Actor classification for an [AuditLog] entry. */
public enum class AuditActorType {
    /** Action initiated by a player. */
    PLAYER,

    /** Action initiated by a staff member. */
    STAFF,

    /** Action initiated by an automated system process. */
    SYSTEM,
}

/** Discount type applied by a [Coupon]. */
public enum class CouponDiscountType {
    /** A percentage discount. */
    PERCENTAGE,

    /** A fixed number of draw points deducted from the price. */
    FIXED_POINTS,
}

/** Campaign types a [Coupon] can be applied to. */
public enum class CouponApplicableTo {
    ALL,
    KUJI_ONLY,
    UNLIMITED_ONLY,
}

/** Status of a [PlayerCoupon] instance in a player's wallet. */
public enum class PlayerCouponStatus {
    ACTIVE,
    EXHAUSTED,
    EXPIRED,
}

// ---------------------------------------------------------------------------
// Domain Entities
// ---------------------------------------------------------------------------

/**
 * Central user entity representing a registered player (draw-service copy).
 *
 * Dual point balances ([drawPointsBalance] and [revenuePointsBalance]) are maintained
 * directly on this entity and protected by optimistic locking via [version].
 *
 * @property id Surrogate primary key.
 * @property version Optimistic lock counter; incremented on every balance mutation.
 */
public data class Player(
    val id: PlayerId,
    val nickname: String,
    val playerCode: String,
    val avatarUrl: String?,
    val phoneNumber: PhoneNumber?,
    val phoneVerifiedAt: Instant?,
    val oauthProvider: OAuthProvider,
    val oauthSubject: String,
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
    val version: Int,
    val xp: Int = 0,
    val level: Int = 1,
    val tier: String = "BRONZE",
    val preferredAnimationMode: DrawAnimationMode,
    val locale: String,
    val isActive: Boolean,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if the player has completed phone number binding and OTP verification. */
    public fun isVerified(): Boolean = phoneNumber != null && phoneVerifiedAt != null

    /** Returns true if this player may perform write operations on the platform. */
    public fun canUsePlatform(): Boolean = isVerified() && isActive && deletedAt == null
}

/**
 * A finite, queue-based draw event (一番賞活動) — draw-service copy.
 *
 * @property id Surrogate primary key.
 * @property drawSessionSeconds Exclusive draw session duration in seconds.
 */
public data class KujiCampaign(
    val id: CampaignId,
    val title: String,
    val description: String?,
    val coverImageUrl: String?,
    val pricePerDraw: Int,
    val drawSessionSeconds: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val soldOutAt: Instant?,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val approvalStatus: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
    val approvedBy: UUID? = null,
    val approvedAt: Instant? = null,
    val lowStockNotifiedAt: Instant? = null,
)

/**
 * A probability-based draw with no fixed ticket pool (無限賞活動) — draw-service copy.
 *
 * @property rateLimitPerSecond Maximum draws per second per player.
 */
public data class UnlimitedCampaign(
    val id: CampaignId,
    val title: String,
    val description: String?,
    val coverImageUrl: String?,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val approvalStatus: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
    val approvedBy: UUID? = null,
    val approvedAt: Instant? = null,
)

/**
 * One physical ticket slot inside a [TicketBox] (draw-service copy).
 *
 * @property id Surrogate primary key.
 * @property position 1-based slot number. Unique within a box.
 */
public data class DrawTicket(
    val id: UUID,
    val ticketBoxId: UUID,
    val prizeDefinitionId: PrizeDefinitionId,
    val position: Int,
    val status: DrawTicketStatus,
    val drawnByPlayerId: PlayerId?,
    val drawnAt: Instant?,
    val prizeInstanceId: PrizeInstanceId?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A draw pool inside a [KujiCampaign] (draw-service copy).
 *
 * @property remainingTickets Current count of available tickets. Decremented atomically on draw.
 */
public data class TicketBox(
    val id: UUID,
    val kujiCampaignId: CampaignId,
    val name: String,
    val totalTickets: Int,
    val remainingTickets: Int,
    val status: TicketBoxStatus,
    val soldOutAt: Instant?,
    val displayOrder: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * One persistent queue per [TicketBox] (draw-service copy).
 *
 * @property activePlayerId FK to the player currently holding the draw session. Null when idle.
 */
public data class Queue(
    val id: UUID,
    val ticketBoxId: UUID,
    val activePlayerId: PlayerId?,
    val sessionStartedAt: Instant?,
    val sessionExpiresAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if a draw session is currently in progress. */
    public fun hasActiveSession(): Boolean =
        activePlayerId != null && sessionStartedAt != null && sessionExpiresAt != null

    /** Returns true if the queue is idle (no active draw session). */
    public fun isIdle(): Boolean = !hasActiveSession()
}

/**
 * A single player's presence in a [Queue] (draw-service copy).
 *
 * @property position 1-based position in queue. 1 = currently drawing or first in line.
 */
public data class QueueEntry(
    val id: UUID,
    val queueId: UUID,
    val playerId: PlayerId,
    val position: Int,
    val status: QueueEntryStatus,
    val joinedAt: Instant,
    val activatedAt: Instant?,
    val completedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if this entry is in a terminal state. */
    public fun isTerminal(): Boolean =
        status == QueueEntryStatus.COMPLETED ||
            status == QueueEntryStatus.ABANDONED ||
            status == QueueEntryStatus.EVICTED
}

/**
 * A prize template shared by multiple tickets (kuji) or referenced probabilistically (unlimited) —
 * draw-service copy.
 *
 * @property probabilityBps Draw probability in basis points. Null for kuji prizes.
 * @property ticketCount Number of tickets assigned to this definition. Null for unlimited prizes.
 */
public data class PrizeDefinition(
    val id: PrizeDefinitionId,
    val kujiCampaignId: CampaignId?,
    val unlimitedCampaignId: CampaignId?,
    val grade: String,
    val campaignGradeId: CampaignGradeId? = null,
    val name: String,
    val photos: List<String>,
    val prizeValue: Int,
    val buybackPrice: Int,
    val buybackEnabled: Boolean,
    val probabilityBps: Int?,
    val ticketCount: Int?,
    val displayOrder: Int,
    val isRare: Boolean = false,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    init {
        require((kujiCampaignId == null) != (unlimitedCampaignId == null)) {
            "Exactly one of kujiCampaignId or unlimitedCampaignId must be non-null"
        }
    }

    /** Returns true if this definition belongs to a [KujiCampaign]. */
    public fun isKuji(): Boolean = kujiCampaignId != null

    /** Returns true if this definition belongs to an [UnlimitedCampaign]. */
    public fun isUnlimited(): Boolean = unlimitedCampaignId != null
}

/**
 * A concrete prize owned by a player (draw-service copy).
 *
 * @property acquisitionMethod How the player originally received this prize.
 * @property state Current lifecycle state.
 */
public data class PrizeInstance(
    val id: PrizeInstanceId,
    val prizeDefinitionId: PrizeDefinitionId,
    val ownerId: PlayerId,
    val acquisitionMethod: PrizeAcquisitionMethod,
    val sourceDrawTicketId: UUID?,
    val sourceTradeOrderId: UUID?,
    val sourceExchangeRequestId: UUID?,
    val state: PrizeState,
    val acquiredAt: Instant,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if this prize is in a terminal state. */
    public fun isTerminal(): Boolean =
        state == PrizeState.SOLD || state == PrizeState.RECYCLED || state == PrizeState.DELIVERED

    /** Returns true if this prize is actively available in the player's inventory. */
    public fun isInInventory(): Boolean = state == PrizeState.HOLDING && deletedAt == null
}

/**
 * Configuration for the guaranteed-drop (pity) mechanic on a campaign (draw-service copy).
 */
public data class PityRule(
    val id: UUID,
    val campaignId: CampaignId,
    val campaignType: String,
    val threshold: Int,
    val accumulationMode: AccumulationMode,
    val sessionTimeoutSeconds: Int?,
    val enabled: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** A single entry in the pity prize pool with its selection weight. */
public data class PityPrizePoolEntry(
    val id: UUID,
    val pityRuleId: UUID,
    val prizeDefinitionId: PrizeDefinitionId,
    val weight: Int,
)

/** Per-player draw counter tracking progress toward the pity guarantee (draw-service copy). */
public data class PityTracker(
    val id: UUID,
    val pityRuleId: UUID,
    val playerId: PlayerId,
    val drawCount: Int,
    val lastDrawAt: Instant?,
    val version: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * Server-side state for a single in-flight draw animation (draw-service copy).
 *
 * Result fields are pre-computed and stored before animation begins. They are never
 * broadcast to spectators until [DrawSyncService.completeDraw] is called.
 */
public data class DrawSyncSession(
    val id: UUID,
    val ticketId: UUID?,
    val campaignId: UUID,
    val playerId: UUID,
    val animationMode: String,
    val resultGrade: String?,
    val resultPrizeName: String?,
    val resultPhotoUrl: String?,
    val resultPrizeInstanceId: UUID?,
    val progress: Float,
    val isRevealed: Boolean,
    val isCancelled: Boolean,
    val startedAt: Instant,
    val revealedAt: Instant?,
    val cancelledAt: Instant?,
)

/**
 * An immutable ledger entry for a player's draw-point balance (draw-service copy).
 *
 * Records are INSERT-only. Each entry captures the signed point change and the resulting balance.
 */
public data class DrawPointTransaction(
    val id: UUID,
    val playerId: PlayerId,
    val type: DrawPointTxType,
    val amount: Int,
    val balanceAfter: Int,
    val paymentOrderId: UUID?,
    val description: String?,
    val createdAt: Instant,
)

/**
 * An immutable ledger entry for a player's revenue-point balance (draw-service copy).
 *
 * Records are INSERT-only.
 */
public data class RevenuePointTransaction(
    val id: UUID,
    val playerId: PlayerId,
    val type: RevenuePointTxType,
    val amount: Int,
    val balanceAfter: Int,
    val tradeOrderId: UUID?,
    val description: String?,
    val createdAt: Instant,
)

/**
 * A domain event persisted to the outbox table for reliable async delivery (draw-service copy).
 *
 * Written atomically with the business transaction that produces the event.
 */
public data class OutboxEvent(
    val id: UUID,
    val eventType: String,
    val aggregateType: String,
    val aggregateId: UUID,
    val payload: JsonObject,
    val status: OutboxEventStatus,
    val processedAt: Instant?,
    val failureReason: String?,
    val createdAt: Instant,
)

/**
 * Append-only log of all significant system events (draw-service copy).
 *
 * Records are INSERT-only; no UPDATE or DELETE operations are permitted.
 */
public data class AuditLog(
    val id: UUID,
    val actorType: AuditActorType,
    val actorPlayerId: PlayerId?,
    val actorStaffId: UUID?,
    val action: String,
    val entityType: String,
    val entityId: UUID?,
    val beforeValue: JsonObject?,
    val afterValue: JsonObject?,
    val metadata: JsonObject,
    val createdAt: Instant,
)

/**
 * Denormalised record of a single draw result written to the feed_events table (draw-service copy).
 */
public data class FeedEvent(
    val id: UUID,
    val drawId: String,
    val playerId: UUID,
    val playerNickname: String,
    val playerAvatarUrl: String?,
    val campaignId: UUID,
    val campaignTitle: String,
    val campaignType: CampaignType,
    val prizeGrade: String,
    val prizeName: String,
    val prizePhotoUrl: String?,
    val drawnAt: Instant,
    val createdAt: Instant,
)

/**
 * A discount template created by operators (draw-service copy).
 */
public data class Coupon(
    val id: UUID,
    val name: String,
    val description: String?,
    val discountType: CouponDiscountType,
    val discountValue: Int,
    val applicableTo: CouponApplicableTo,
    val maxUsesPerPlayer: Int,
    val totalIssued: Int,
    val totalUsed: Int,
    val issueLimit: Int?,
    val validFrom: Instant,
    val validUntil: Instant,
    val isActive: Boolean,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A specific coupon instance in a player's wallet (draw-service copy).
 */
public data class PlayerCoupon(
    val id: UUID,
    val playerId: PlayerId,
    val couponId: UUID,
    val discountCodeId: UUID?,
    val useCount: Int,
    val status: PlayerCouponStatus,
    val issuedAt: Instant,
    val lastUsedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

// ---------------------------------------------------------------------------
// XP / Level rules (draw-service copy)
// ---------------------------------------------------------------------------

/**
 * Stateless XP and levelling formula definitions (draw-service copy).
 */
public object XpRules {
    private const val XP_PER_LEVEL_DIVISOR = 100

    /** XP earned per draw point spent. */
    public const val XP_PER_DRAW_POINT: Int = 1

    /** Bonus XP awarded on the first draw of the calendar day. */
    public const val DAILY_FIRST_DRAW_BONUS: Int = 50

    /** XP rate for trade purchases (buyer side): 50% of trade price. */
    public const val TRADE_PURCHASE_XP_RATE: Double = 0.5

    /** Derives the player's level from their cumulative [xp]. */
    public fun levelFromXp(xp: Int): Int = 1 + sqrt(xp.toDouble() / XP_PER_LEVEL_DIVISOR).toInt()

    /** Returns the total cumulative XP required to reach [level]. */
    public fun xpForLevel(level: Int): Int = (level - 1) * (level - 1) * XP_PER_LEVEL_DIVISOR
}
