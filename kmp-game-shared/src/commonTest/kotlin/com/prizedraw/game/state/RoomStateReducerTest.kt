package com.prizedraw.game.state

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.BubbleType
import com.prizedraw.game.model.CharacterState
import com.prizedraw.game.model.Direction
import com.prizedraw.game.model.EffectType
import com.prizedraw.game.model.GameCharacter
import com.prizedraw.game.model.GameEffect
import com.prizedraw.game.model.GameRoomState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RoomStateReducerTest {
    // -----------------------------------------------------------------------
    // Fixtures
    // -----------------------------------------------------------------------

    private fun emptyRoom(campaignId: String = "c1") =
        GameRoomState(
            campaignId = campaignId,
            mapId = "default",
            characters = emptyMap(),
            queueOrder = emptyList(),
            activeDrawerId = null,
            spectatorCount = 0,
        )

    private fun makeCharacter(
        playerId: String,
        state: CharacterState = CharacterState.IDLE,
        position: IsometricPoint = IsometricPoint(0f, 0f),
    ) = GameCharacter(
        playerId = playerId,
        nickname = "Player $playerId",
        avatarKey = "default",
        position = position,
        direction = Direction.SOUTH,
        state = state,
    )

    private fun roomWithCharacters(vararg players: GameCharacter): GameRoomState =
        emptyRoom().copy(characters = players.associateBy { it.playerId })

    private fun makeEffect(id: String) =
        GameEffect(
            id = id,
            type = EffectType.CONFETTI,
            position = IsometricPoint(5f, 5f),
            startedAtMs = 1000L,
            durationMs = 3000,
        )

    // -----------------------------------------------------------------------
    // PlayerJoined
    // -----------------------------------------------------------------------

    @Test
    fun playerJoined_addsCharacterToMap() {
        val character = makeCharacter("p1")
        val event = GameRoomEvent.PlayerJoined(character)
        val result = RoomStateReducer.reduce(emptyRoom(), event)
        assertEquals(1, result.characters.size)
        assertEquals(character, result.characters["p1"])
    }

    @Test
    fun playerJoined_multiplePlayersAccumulate() {
        var state = emptyRoom()
        state = RoomStateReducer.reduce(state, GameRoomEvent.PlayerJoined(makeCharacter("p1")))
        state = RoomStateReducer.reduce(state, GameRoomEvent.PlayerJoined(makeCharacter("p2")))
        assertEquals(2, state.characters.size)
    }

    // -----------------------------------------------------------------------
    // PlayerLeft
    // -----------------------------------------------------------------------

    @Test
    fun playerLeft_removesFromCharactersMap() {
        val state = roomWithCharacters(makeCharacter("p1"), makeCharacter("p2"))
        val result = RoomStateReducer.reduce(state, GameRoomEvent.PlayerLeft("p1"))
        assertFalse(result.characters.containsKey("p1"))
        assertTrue(result.characters.containsKey("p2"))
    }

    @Test
    fun playerLeft_removesFromQueueOrder() {
        val state =
            roomWithCharacters(makeCharacter("p1"), makeCharacter("p2"))
                .copy(queueOrder = listOf("p1", "p2"))
        val result = RoomStateReducer.reduce(state, GameRoomEvent.PlayerLeft("p1"))
        assertFalse(result.queueOrder.contains("p1"))
        assertTrue(result.queueOrder.contains("p2"))
    }

    @Test
    fun playerLeft_clearsActiveDrawer_whenThatPlayerLeaves() {
        val state = roomWithCharacters(makeCharacter("p1")).copy(activeDrawerId = "p1")
        val result = RoomStateReducer.reduce(state, GameRoomEvent.PlayerLeft("p1"))
        assertNull(result.activeDrawerId)
    }

    @Test
    fun playerLeft_preservesActiveDrawer_whenOtherPlayerLeaves() {
        val state =
            roomWithCharacters(makeCharacter("p1"), makeCharacter("p2"))
                .copy(activeDrawerId = "p2")
        val result = RoomStateReducer.reduce(state, GameRoomEvent.PlayerLeft("p1"))
        assertEquals("p2", result.activeDrawerId)
    }

    // -----------------------------------------------------------------------
    // PlayerMoved
    // -----------------------------------------------------------------------

    @Test
    fun playerMoved_updatesPositionAndDirection() {
        val state = roomWithCharacters(makeCharacter("p1"))
        val newPos = IsometricPoint(3f, 5f)
        val event = GameRoomEvent.PlayerMoved("p1", newPos, Direction.NORTH_EAST)
        val result = RoomStateReducer.reduce(state, event)
        val character = result.characters["p1"]
        assertNotNull(character)
        assertEquals(newPos, character.position)
        assertEquals(Direction.NORTH_EAST, character.direction)
    }

    @Test
    fun playerMoved_unknownPlayer_noChange() {
        val state = roomWithCharacters(makeCharacter("p1"))
        val result =
            RoomStateReducer.reduce(
                state,
                GameRoomEvent.PlayerMoved("unknown", IsometricPoint(1f, 1f), Direction.EAST)
            )
        assertEquals(state, result)
    }

    // -----------------------------------------------------------------------
    // QueueUpdated
    // -----------------------------------------------------------------------

    @Test
    fun queueUpdated_replacesQueueOrder() {
        val state = emptyRoom().copy(queueOrder = listOf("p1", "p2"))
        val newQueue = listOf("p3", "p1")
        val result = RoomStateReducer.reduce(state, GameRoomEvent.QueueUpdated(newQueue, activeDrawerId = "p3"))
        assertEquals(newQueue, result.queueOrder)
        assertEquals("p3", result.activeDrawerId)
    }

    @Test
    fun queueUpdated_clearsActiveDrawer_whenNull() {
        val state = emptyRoom().copy(activeDrawerId = "p1")
        val result = RoomStateReducer.reduce(state, GameRoomEvent.QueueUpdated(emptyList(), activeDrawerId = null))
        assertNull(result.activeDrawerId)
    }

    // -----------------------------------------------------------------------
    // DrawRevealed
    // -----------------------------------------------------------------------

    @Test
    fun drawRevealed_setsPrizeBubbleOnCharacter() {
        val state = roomWithCharacters(makeCharacter("p1"))
        val event = GameRoomEvent.DrawRevealed("p1", "A賞", "超人力霸王")
        val result = RoomStateReducer.reduce(state, event)
        val character = result.characters["p1"]
        assertNotNull(character)
        assertEquals(BubbleType.PRIZE_RESULT, character.bubbleType)
        assertNotNull(character.bubbleText)
        assertTrue(character.bubbleText!!.contains("A賞"))
        assertTrue(character.bubbleText.contains("超人力霸王"))
        assertNotNull(character.bubbleExpiryMs)
    }

    // -----------------------------------------------------------------------
    // EffectTriggered / EffectExpired
    // -----------------------------------------------------------------------

    @Test
    fun effectTriggered_addsToEffectsList() {
        val state = emptyRoom()
        val effect = makeEffect("e1")
        val result = RoomStateReducer.reduce(state, GameRoomEvent.EffectTriggered(effect))
        assertEquals(1, result.effects.size)
        assertEquals(effect, result.effects[0])
    }

    @Test
    fun effectExpired_removesFromEffectsList() {
        val state = emptyRoom().copy(effects = listOf(makeEffect("e1"), makeEffect("e2")))
        val result = RoomStateReducer.reduce(state, GameRoomEvent.EffectExpired("e1"))
        assertEquals(1, result.effects.size)
        assertEquals("e2", result.effects[0].id)
    }

    @Test
    fun effectExpired_unknownId_noChange() {
        val state = emptyRoom().copy(effects = listOf(makeEffect("e1")))
        val result = RoomStateReducer.reduce(state, GameRoomEvent.EffectExpired("unknown"))
        assertEquals(1, result.effects.size)
    }

    // -----------------------------------------------------------------------
    // SpectatorCountChanged
    // -----------------------------------------------------------------------

    @Test
    fun spectatorCountChanged_updatesCount() {
        val state = emptyRoom().copy(spectatorCount = 3)
        val result = RoomStateReducer.reduce(state, GameRoomEvent.SpectatorCountChanged(42))
        assertEquals(42, result.spectatorCount)
    }
}
