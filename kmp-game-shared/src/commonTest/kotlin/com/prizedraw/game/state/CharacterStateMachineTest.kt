package com.prizedraw.game.state

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.CharacterState
import com.prizedraw.game.model.Direction
import com.prizedraw.game.model.GameCharacter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CharacterStateMachineTest {
    // -----------------------------------------------------------------------
    // Fixtures
    // -----------------------------------------------------------------------

    private fun makeCharacter(state: CharacterState) =
        GameCharacter(
            playerId = "p1",
            nickname = "Tester",
            avatarKey = "default",
            position = IsometricPoint(0f, 0f),
            direction = Direction.SOUTH,
            state = state,
        )

    // -----------------------------------------------------------------------
    // Valid transitions
    // -----------------------------------------------------------------------

    @Test
    fun idle_canTransitionTo_walking() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.IDLE, CharacterState.WALKING))
    }

    @Test
    fun idle_canTransitionTo_queuing() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.IDLE, CharacterState.QUEUING))
    }

    @Test
    fun walking_canTransitionTo_idle() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.WALKING, CharacterState.IDLE))
    }

    @Test
    fun walking_canTransitionTo_queuing() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.WALKING, CharacterState.QUEUING))
    }

    @Test
    fun walking_canTransitionTo_drawing() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.WALKING, CharacterState.DRAWING))
    }

    @Test
    fun queuing_canTransitionTo_idle() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.QUEUING, CharacterState.IDLE))
    }

    @Test
    fun queuing_canTransitionTo_drawing() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.QUEUING, CharacterState.DRAWING))
    }

    @Test
    fun drawing_canTransitionTo_idle() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.DRAWING, CharacterState.IDLE))
    }

    @Test
    fun drawing_canTransitionTo_celebrating() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.DRAWING, CharacterState.CELEBRATING))
    }

    @Test
    fun celebrating_canTransitionTo_idle() {
        assertTrue(CharacterStateMachine.canTransition(CharacterState.CELEBRATING, CharacterState.IDLE))
    }

    // -----------------------------------------------------------------------
    // Invalid transitions
    // -----------------------------------------------------------------------

    @Test
    fun idle_cannotTransitionTo_celebrating() {
        assertFalse(CharacterStateMachine.canTransition(CharacterState.IDLE, CharacterState.CELEBRATING))
    }

    @Test
    fun idle_cannotTransitionTo_drawing() {
        assertFalse(CharacterStateMachine.canTransition(CharacterState.IDLE, CharacterState.DRAWING))
    }

    @Test
    fun celebrating_cannotTransitionTo_walking() {
        assertFalse(CharacterStateMachine.canTransition(CharacterState.CELEBRATING, CharacterState.WALKING))
    }

    @Test
    fun celebrating_cannotTransitionTo_drawing() {
        assertFalse(CharacterStateMachine.canTransition(CharacterState.CELEBRATING, CharacterState.DRAWING))
    }

    @Test
    fun drawing_cannotTransitionTo_walking() {
        assertFalse(CharacterStateMachine.canTransition(CharacterState.DRAWING, CharacterState.WALKING))
    }

    @Test
    fun sameState_isInvalidTransition() {
        for (state in CharacterState.entries) {
            assertFalse(
                CharacterStateMachine.canTransition(state, state),
                "Self-transition $state → $state should be invalid",
            )
        }
    }

    // -----------------------------------------------------------------------
    // transition()
    // -----------------------------------------------------------------------

    @Test
    fun transition_validState_updatesCharacter() {
        val character = makeCharacter(CharacterState.IDLE)
        val result = CharacterStateMachine.transition(character, CharacterState.WALKING)
        assertEquals(CharacterState.WALKING, result.state)
    }

    @Test
    fun transition_invalidState_returnsUnchanged() {
        val character = makeCharacter(CharacterState.IDLE)
        val result = CharacterStateMachine.transition(character, CharacterState.CELEBRATING)
        assertEquals(character, result)
    }

    // -----------------------------------------------------------------------
    // directionFromMovement — 8 directions
    // -----------------------------------------------------------------------

    @Test
    fun direction_movingEast() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(5f, 0f),
            )
        assertEquals(Direction.EAST, dir)
    }

    @Test
    fun direction_movingWest() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(5f, 0f),
                IsometricPoint(0f, 0f),
            )
        assertEquals(Direction.WEST, dir)
    }

    @Test
    fun direction_movingSouth() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(0f, 5f),
            )
        assertEquals(Direction.SOUTH, dir)
    }

    @Test
    fun direction_movingNorth() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 5f),
                IsometricPoint(0f, 0f),
            )
        assertEquals(Direction.NORTH, dir)
    }

    @Test
    fun direction_movingNorthEast() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(3f, -3f),
            )
        assertEquals(Direction.NORTH_EAST, dir)
    }

    @Test
    fun direction_movingNorthWest() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(-3f, -3f),
            )
        assertEquals(Direction.NORTH_WEST, dir)
    }

    @Test
    fun direction_movingSouthEast() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(3f, 3f),
            )
        assertEquals(Direction.SOUTH_EAST, dir)
    }

    @Test
    fun direction_movingSouthWest() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(0f, 0f),
                IsometricPoint(-3f, 3f),
            )
        assertEquals(Direction.SOUTH_WEST, dir)
    }

    @Test
    fun direction_samePoint_returnsSouthDefault() {
        val dir =
            CharacterStateMachine.directionFromMovement(
                IsometricPoint(3f, 3f),
                IsometricPoint(3f, 3f),
            )
        assertEquals(Direction.SOUTH, dir)
    }
}
