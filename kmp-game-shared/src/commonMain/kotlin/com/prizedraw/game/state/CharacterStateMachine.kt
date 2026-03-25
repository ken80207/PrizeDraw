package com.prizedraw.game.state

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.CharacterState
import com.prizedraw.game.model.Direction
import com.prizedraw.game.model.GameCharacter

/**
 * Pure, stateless state machine for [GameCharacter] lifecycle transitions.
 *
 * Valid transition table:
 * ```
 * IDLE        → WALKING, QUEUING
 * WALKING     → IDLE, QUEUING, DRAWING
 * QUEUING     → IDLE, DRAWING
 * DRAWING     → IDLE, CELEBRATING
 * CELEBRATING → IDLE
 * ```
 *
 * All functions are deterministic and produce no side effects.
 */
public object CharacterStateMachine {
    /**
     * Allowlist of permitted state transitions.
     *
     * Keys are (from, to) pairs that are explicitly valid.
     */
    private val validTransitions: Set<Pair<CharacterState, CharacterState>> =
        setOf(
            CharacterState.IDLE to CharacterState.WALKING,
            CharacterState.IDLE to CharacterState.QUEUING,
            CharacterState.WALKING to CharacterState.IDLE,
            CharacterState.WALKING to CharacterState.QUEUING,
            CharacterState.WALKING to CharacterState.DRAWING,
            CharacterState.QUEUING to CharacterState.IDLE,
            CharacterState.QUEUING to CharacterState.DRAWING,
            CharacterState.DRAWING to CharacterState.IDLE,
            CharacterState.DRAWING to CharacterState.CELEBRATING,
            CharacterState.CELEBRATING to CharacterState.IDLE,
        )

    /**
     * Returns `true` if the transition from [from] to [to] is permitted.
     *
     * Transitioning from a state to itself is always considered invalid —
     * callers should not request a no-op transition.
     *
     * @param from Current character state.
     * @param to Desired next state.
     */
    public fun canTransition(
        from: CharacterState,
        to: CharacterState,
    ): Boolean = (from to to) in validTransitions

    /**
     * Applies [newState] to [character] and returns the updated character.
     *
     * If [newState] is not reachable from the character's current state the original
     * [character] is returned unchanged — callers must not assume a transition occurred.
     *
     * @param character The character whose state should change.
     * @param newState The desired next state.
     * @return Updated [GameCharacter] if the transition is valid, otherwise [character] unmodified.
     */
    public fun transition(
        character: GameCharacter,
        newState: CharacterState,
    ): GameCharacter {
        if (!canTransition(character.state, newState)) {
            return character
        }
        return character.copy(state = newState)
    }

    /**
     * Derives the [Direction] a character should face based on a movement vector.
     *
     * The 8-directional sector thresholds use 22.5° half-angle bands so that purely
     * axial movement maps to a cardinal direction and diagonal movement maps to an
     * ordinal direction.
     *
     * If [from] and [to] are the same point, [Direction.SOUTH] is returned as a default.
     *
     * @param from Starting isometric position.
     * @param to Destination isometric position.
     * @return The [Direction] that best describes the movement vector.
     */
    public fun directionFromMovement(
        from: IsometricPoint,
        to: IsometricPoint,
    ): Direction {
        val dx = to.isoX - from.isoX
        val dy = to.isoY - from.isoY
        if (dx == 0f && dy == 0f) {
            return Direction.SOUTH
        }

        val absDx =
            if (dx < 0f) {
                -dx
            } else {
                dx
            }
        val absDy =
            if (dy < 0f) {
                -dy
            } else {
                dy
            }

        return if (isDiagonal(absDx, absDy)) {
            diagonalDirection(dx, dy)
        } else {
            cardinalDirection(dx, dy, absDx, absDy)
        }
    }

    /**
     * Returns `true` when neither axis dominates by more than 2:1 — indicating a diagonal.
     */
    private fun isDiagonal(
        absDx: Float,
        absDy: Float,
    ): Boolean = absDx > absDy / 2f && absDy > absDx / 2f

    /**
     * Resolves the ordinal [Direction] for a diagonal movement vector.
     *
     * Precondition: the caller must have verified [isDiagonal] is true.
     */
    private fun diagonalDirection(
        dx: Float,
        dy: Float,
    ): Direction =
        when {
            dx > 0f && dy > 0f -> Direction.SOUTH_EAST
            dx > 0f -> Direction.NORTH_EAST
            dy > 0f -> Direction.SOUTH_WEST
            else -> Direction.NORTH_WEST
        }

    /**
     * Resolves the cardinal [Direction] for an axis-dominant movement vector.
     *
     * Precondition: the caller must have verified [isDiagonal] is false.
     */
    private fun cardinalDirection(
        dx: Float,
        dy: Float,
        absDx: Float,
        absDy: Float,
    ): Direction =
        when {
            absDx >= absDy && dx > 0f -> Direction.EAST
            absDx >= absDy -> Direction.WEST
            dy > 0f -> Direction.SOUTH
            else -> Direction.NORTH
        }
}
