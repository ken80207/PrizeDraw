package com.prizedraw.game.model

import com.prizedraw.game.coordinate.IsometricPoint
import kotlinx.serialization.Serializable

/**
 * The full, serialisable state of a single player's in-room character.
 *
 * @property playerId Stable player identifier (UUID string).
 * @property nickname Display name shown above the character.
 * @property avatarKey Key into the [com.prizedraw.game.model.SpriteSheetDef] registry.
 * @property position Current isometric position.
 * @property targetPosition Destination the character is walking toward, or `null` when stationary.
 * @property direction Cardinal/ordinal direction the character faces.
 * @property state Current behaviour state.
 * @property bubbleText Text currently displayed in the speech bubble, or `null` when hidden.
 * @property bubbleType Visual style of the speech bubble, or `null` when hidden.
 * @property bubbleExpiryMs Epoch-millisecond timestamp at which the bubble should disappear,
 *   or `null` when no bubble is active.
 */
@Serializable
public data class GameCharacter(
    val playerId: String,
    val nickname: String,
    val avatarKey: String,
    val position: IsometricPoint,
    val targetPosition: IsometricPoint? = null,
    val direction: Direction,
    val state: CharacterState,
    val bubbleText: String? = null,
    val bubbleType: BubbleType? = null,
    val bubbleExpiryMs: Long? = null,
)

/**
 * Eight-directional compass facing for a character sprite.
 *
 * Renderer implementations map each value to the appropriate sprite row/animation.
 */
@Serializable
public enum class Direction {
    NORTH,
    SOUTH,
    EAST,
    WEST,
    NORTH_EAST,
    NORTH_WEST,
    SOUTH_EAST,
    SOUTH_WEST,
}

/** High-level behavioural state that drives animation selection and game-logic branching. */
@Serializable
public enum class CharacterState {
    /** Standing still, default idle animation. */
    IDLE,

    /** Moving toward [GameCharacter.targetPosition]. */
    WALKING,

    /** Waiting in the draw queue. */
    QUEUING,

    /** Actively performing the draw interaction at the counter. */
    DRAWING,

    /** Playing a celebration animation after winning a notable prize. */
    CELEBRATING,
}

/** Visual style / semantic category of a character speech bubble. */
@Serializable
public enum class BubbleType {
    /** A chat message typed by the player. */
    CHAT,

    /** The revealed prize name/grade shown after a draw. */
    PRIZE_RESULT,

    /** A quick emoji reaction. */
    REACTION,
}
