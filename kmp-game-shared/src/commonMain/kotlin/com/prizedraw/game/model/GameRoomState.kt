package com.prizedraw.game.model

import com.prizedraw.game.coordinate.IsometricPoint
import kotlinx.serialization.Serializable

/**
 * A complete, serialisable snapshot of a single campaign's game room.
 *
 * This is the canonical truth that every connected client reconstructs its view from.
 *
 * @property campaignId The campaign this room belongs to.
 * @property mapId Which [GameMap] to render.
 * @property characters All characters currently present, keyed by `playerId`.
 * @property queueOrder Ordered list of `playerId` values waiting to draw.
 * @property activeDrawerId `playerId` of the player currently at the counter, or `null`.
 * @property spectatorCount Number of spectators not represented as characters.
 * @property effects Transient visual effects currently playing in the room.
 */
@Serializable
public data class GameRoomState(
    val campaignId: String,
    val mapId: String,
    val characters: Map<String, GameCharacter>,
    val queueOrder: List<String>,
    val activeDrawerId: String?,
    val spectatorCount: Int,
    val effects: List<GameEffect> = emptyList(),
)

/**
 * A transient, position-anchored visual effect inside a room.
 *
 * Effects are purely presentational — they carry no game-logic consequence.
 *
 * @property id Unique identifier so clients can track expiry independently.
 * @property type Category that determines which renderer animation to play.
 * @property position Isometric anchor for the effect.
 * @property data Engine-agnostic key-value payload (e.g. grade, prizeName).
 * @property startedAtMs Epoch milliseconds when the effect started.
 * @property durationMs How long the effect should play before being removed.
 */
@Serializable
public data class GameEffect(
    val id: String,
    val type: EffectType,
    val position: IsometricPoint,
    val data: Map<String, String> = emptyMap(),
    val startedAtMs: Long,
    val durationMs: Int,
)

/** Categories of room-wide visual effects. */
@Serializable
public enum class EffectType {
    /** Prize-grade bubble floating above a character. */
    PRIZE_BUBBLE,

    /** Fireworks burst for high-tier prizes. */
    FIREWORKS,

    /** Confetti shower across the whole room. */
    CONFETTI,

    /** Spotlight that highlights the active drawer. */
    SPOTLIGHT,

    /** Visual indicator that the queue has advanced. */
    QUEUE_ADVANCE,
}
