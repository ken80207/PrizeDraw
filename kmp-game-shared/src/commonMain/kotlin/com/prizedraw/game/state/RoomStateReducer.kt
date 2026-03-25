package com.prizedraw.game.state

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.BubbleType
import com.prizedraw.game.model.CharacterState
import com.prizedraw.game.model.Direction
import com.prizedraw.game.model.GameCharacter
import com.prizedraw.game.model.GameEffect
import com.prizedraw.game.model.GameRoomState
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/**
 * All events that can mutate a [GameRoomState].
 *
 * Every subclass is immutable and carries only the data required for its transition.
 * The sealed hierarchy is serialisable so events can be transported over WebSocket.
 *
 * The discriminator key is `"kind"` (not the default `"type"`) to avoid collisions with
 * data-class properties like [BubbleShown.type] that carry domain semantics.
 */
@OptIn(ExperimentalSerializationApi::class)
@JsonClassDiscriminator("kind")
@Serializable
public sealed class GameRoomEvent {
    /** A new player entered the room. */
    @Serializable
    public data class PlayerJoined(
        val character: GameCharacter,
    ) : GameRoomEvent()

    /** A player disconnected or left the room voluntarily. */
    @Serializable
    public data class PlayerLeft(
        val playerId: String,
    ) : GameRoomEvent()

    /** A player's character moved to a new isometric position. */
    @Serializable
    public data class PlayerMoved(
        val playerId: String,
        val to: IsometricPoint,
        val direction: Direction,
    ) : GameRoomEvent()

    /** A player's character transitioned to a new behavioural state. */
    @Serializable
    public data class PlayerStateChanged(
        val playerId: String,
        val newState: CharacterState,
    ) : GameRoomEvent()

    /** The draw queue order or active drawer changed. */
    @Serializable
    public data class QueueUpdated(
        val queueOrder: List<String>,
        val activeDrawerId: String?,
    ) : GameRoomEvent()

    /** A player started their draw interaction. */
    @Serializable
    public data class DrawStarted(
        val playerId: String,
        val animationMode: String,
    ) : GameRoomEvent()

    /** The draw result was revealed; a prize bubble should appear above the character. */
    @Serializable
    public data class DrawRevealed(
        val playerId: String,
        val grade: String,
        val prizeName: String,
    ) : GameRoomEvent()

    /** A speech or reaction bubble should be displayed above a character. */
    @Serializable
    public data class BubbleShown(
        val playerId: String,
        val text: String,
        val type: BubbleType,
        val durationMs: Int,
    ) : GameRoomEvent()

    /** A new room-wide effect was triggered. */
    @Serializable
    public data class EffectTriggered(
        val effect: GameEffect,
    ) : GameRoomEvent()

    /** An effect's lifetime has elapsed and it should be removed. */
    @Serializable
    public data class EffectExpired(
        val effectId: String,
    ) : GameRoomEvent()

    /** The count of non-character spectators changed. */
    @Serializable
    public data class SpectatorCountChanged(
        val count: Int,
    ) : GameRoomEvent()
}

/**
 * Pure reducer that derives the next [GameRoomState] from a current state and a single event.
 *
 * All methods are free of side effects and safe to call from any thread or coroutine context.
 */
public object RoomStateReducer {
    /** Bubble duration for prize reveals in milliseconds. */
    private const val PRIZE_BUBBLE_DURATION_MS = 5_000

    /**
     * Applies [event] to [state] and returns the resulting [GameRoomState].
     *
     * Unknown player IDs in mutation events are silently ignored — the original [state]
     * is returned unchanged in those cases to avoid partially-inconsistent state.
     *
     * @param state The current room state.
     * @param event The event to apply.
     * @return The next [GameRoomState].
     */
    public fun reduce(
        state: GameRoomState,
        event: GameRoomEvent,
    ): GameRoomState =
        when (event) {
            is GameRoomEvent.PlayerJoined -> handlePlayerJoined(state, event)
            is GameRoomEvent.PlayerLeft -> handlePlayerLeft(state, event)
            is GameRoomEvent.PlayerMoved -> handlePlayerMoved(state, event)
            is GameRoomEvent.PlayerStateChanged -> handlePlayerStateChanged(state, event)
            is GameRoomEvent.QueueUpdated -> handleQueueUpdated(state, event)
            is GameRoomEvent.DrawStarted -> handleDrawStarted(state, event)
            is GameRoomEvent.DrawRevealed -> handleDrawRevealed(state, event)
            is GameRoomEvent.BubbleShown -> handleBubbleShown(state, event)
            is GameRoomEvent.EffectTriggered -> handleEffectTriggered(state, event)
            is GameRoomEvent.EffectExpired -> handleEffectExpired(state, event)
            is GameRoomEvent.SpectatorCountChanged -> state.copy(spectatorCount = event.count)
        }

    private fun handlePlayerJoined(
        state: GameRoomState,
        event: GameRoomEvent.PlayerJoined,
    ): GameRoomState {
        val updated = state.characters + (event.character.playerId to event.character)
        return state.copy(characters = updated)
    }

    private fun handlePlayerLeft(
        state: GameRoomState,
        event: GameRoomEvent.PlayerLeft,
    ): GameRoomState {
        val updated = state.characters - event.playerId
        val updatedQueue = state.queueOrder - event.playerId
        val updatedDrawer =
            if (state.activeDrawerId == event.playerId) {
                null
            } else {
                state.activeDrawerId
            }
        return state.copy(
            characters = updated,
            queueOrder = updatedQueue,
            activeDrawerId = updatedDrawer,
        )
    }

    private fun handlePlayerMoved(
        state: GameRoomState,
        event: GameRoomEvent.PlayerMoved,
    ): GameRoomState {
        val character = state.characters[event.playerId] ?: return state
        val updated = character.copy(position = event.to, direction = event.direction)
        return state.copy(characters = state.characters + (event.playerId to updated))
    }

    private fun handlePlayerStateChanged(
        state: GameRoomState,
        event: GameRoomEvent.PlayerStateChanged,
    ): GameRoomState {
        val character = state.characters[event.playerId] ?: return state
        val transitioned = CharacterStateMachine.transition(character, event.newState)
        return state.copy(characters = state.characters + (event.playerId to transitioned))
    }

    private fun handleQueueUpdated(
        state: GameRoomState,
        event: GameRoomEvent.QueueUpdated,
    ): GameRoomState = state.copy(queueOrder = event.queueOrder, activeDrawerId = event.activeDrawerId)

    private fun handleDrawStarted(
        state: GameRoomState,
        event: GameRoomEvent.DrawStarted,
    ): GameRoomState {
        val character = state.characters[event.playerId] ?: return state
        val updated = CharacterStateMachine.transition(character, com.prizedraw.game.model.CharacterState.DRAWING)
        return state.copy(
            characters = state.characters + (event.playerId to updated),
            activeDrawerId = event.playerId,
        )
    }

    private fun handleDrawRevealed(
        state: GameRoomState,
        event: GameRoomEvent.DrawRevealed,
    ): GameRoomState {
        val character = state.characters[event.playerId] ?: return state
        val bubbleText = "${event.grade} - ${event.prizeName}"
        val updated =
            character.copy(
                bubbleText = bubbleText,
                bubbleType = BubbleType.PRIZE_RESULT,
                bubbleExpiryMs = currentTimeMs() + PRIZE_BUBBLE_DURATION_MS,
            )
        return state.copy(characters = state.characters + (event.playerId to updated))
    }

    private fun handleBubbleShown(
        state: GameRoomState,
        event: GameRoomEvent.BubbleShown,
    ): GameRoomState {
        val character = state.characters[event.playerId] ?: return state
        val updated =
            character.copy(
                bubbleText = event.text,
                bubbleType = event.type,
                bubbleExpiryMs = currentTimeMs() + event.durationMs,
            )
        return state.copy(characters = state.characters + (event.playerId to updated))
    }

    private fun handleEffectTriggered(
        state: GameRoomState,
        event: GameRoomEvent.EffectTriggered,
    ): GameRoomState = state.copy(effects = state.effects + event.effect)

    private fun handleEffectExpired(
        state: GameRoomState,
        event: GameRoomEvent.EffectExpired,
    ): GameRoomState = state.copy(effects = state.effects.filter { it.id != event.effectId })
}

/**
 * Returns the current epoch time in milliseconds.
 *
 * Extracted as a top-level `expect`-free helper so that the reducer remains fully
 * testable — tests override bubble expiry by inspecting relative values.
 */
internal expect fun currentTimeMs(): Long
