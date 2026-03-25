package com.prizedraw.game.protocol

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.BubbleType
import com.prizedraw.game.model.CharacterState
import com.prizedraw.game.model.Direction
import com.prizedraw.game.model.EffectType
import com.prizedraw.game.model.GameCharacter
import com.prizedraw.game.model.GameEffect
import com.prizedraw.game.model.GameRoomState
import com.prizedraw.game.state.GameRoomEvent
import kotlinx.serialization.SerializationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

class GameRoomCodecTest {
    // -----------------------------------------------------------------------
    // C2S round-trip tests
    // -----------------------------------------------------------------------

    @Test
    fun c2s_move_roundTrip() {
        val original = ClientToServerMessage.Move(targetIsoX = 3.5f, targetIsoY = 7.0f)
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.Move>(decoded)
        assertEquals(original, decoded)
    }

    @Test
    fun c2s_joinQueue_roundTrip() {
        val original = ClientToServerMessage.JoinQueue(ticketBoxId = "box-42")
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.JoinQueue>(decoded)
        assertEquals(original, decoded)
    }

    @Test
    fun c2s_leaveQueue_roundTrip() {
        val original = ClientToServerMessage.LeaveQueue()
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.LeaveQueue>(decoded)
    }

    @Test
    fun c2s_chat_roundTrip() {
        val original = ClientToServerMessage.Chat(message = "Hello 大家好！")
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.Chat>(decoded)
        assertEquals(original.message, (decoded as ClientToServerMessage.Chat).message)
    }

    @Test
    fun c2s_react_roundTrip() {
        val original = ClientToServerMessage.React(emoji = "🎉")
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.React>(decoded)
        assertEquals(original.emoji, (decoded as ClientToServerMessage.React).emoji)
    }

    @Test
    fun c2s_requestState_roundTrip() {
        val original = ClientToServerMessage.RequestState()
        val decoded = GameRoomCodec.decodeC2S(GameRoomCodec.encodeC2S(original))
        assertIs<ClientToServerMessage.RequestState>(decoded)
    }

    // -----------------------------------------------------------------------
    // S2C round-trip tests
    // -----------------------------------------------------------------------

    @Test
    fun s2c_error_roundTrip() {
        val original = ServerToClientMessage.Error(code = "QUEUE_FULL", message = "Queue is full")
        val decoded = GameRoomCodec.decodeS2C(GameRoomCodec.encodeS2C(original))
        assertIs<ServerToClientMessage.Error>(decoded)
        assertEquals(original.code, (decoded as ServerToClientMessage.Error).code)
        assertEquals(original.message, decoded.message)
    }

    @Test
    fun s2c_roomSnapshot_roundTrip() {
        val state =
            GameRoomState(
                campaignId = "campaign-1",
                mapId = "shop_v1",
                characters =
                    mapOf(
                        "p1" to
                            GameCharacter(
                                playerId = "p1",
                                nickname = "Tester",
                                avatarKey = "default",
                                position = IsometricPoint(2f, 3f),
                                direction = Direction.SOUTH,
                                state = CharacterState.IDLE,
                            ),
                    ),
                queueOrder = listOf("p1"),
                activeDrawerId = null,
                spectatorCount = 5,
            )
        val original = ServerToClientMessage.RoomSnapshot(state)
        val decoded = GameRoomCodec.decodeS2C(GameRoomCodec.encodeS2C(original))
        assertIs<ServerToClientMessage.RoomSnapshot>(decoded)
        assertEquals(state.campaignId, (decoded as ServerToClientMessage.RoomSnapshot).state.campaignId)
        assertEquals(1, decoded.state.characters.size)
    }

    @Test
    fun s2c_event_playerJoined_roundTrip() {
        val character =
            GameCharacter(
                playerId = "p2",
                nickname = "Newbie",
                avatarKey = "default",
                position = IsometricPoint(0f, 0f),
                direction = Direction.NORTH,
                state = CharacterState.WALKING,
            )
        val original = ServerToClientMessage.Event(GameRoomEvent.PlayerJoined(character))
        val decoded = GameRoomCodec.decodeS2C(GameRoomCodec.encodeS2C(original))
        assertIs<ServerToClientMessage.Event>(decoded)
        val innerEvent = (decoded as ServerToClientMessage.Event).event
        assertIs<GameRoomEvent.PlayerJoined>(innerEvent)
        assertEquals("p2", innerEvent.character.playerId)
    }

    @Test
    fun s2c_event_effectTriggered_roundTrip() {
        val effect =
            GameEffect(
                id = "fx1",
                type = EffectType.FIREWORKS,
                position = IsometricPoint(5f, 5f),
                startedAtMs = 999L,
                durationMs = 2000,
            )
        val original = ServerToClientMessage.Event(GameRoomEvent.EffectTriggered(effect))
        val decoded = GameRoomCodec.decodeS2C(GameRoomCodec.encodeS2C(original))
        assertIs<ServerToClientMessage.Event>(decoded)
        val innerEvent = (decoded as ServerToClientMessage.Event).event
        assertIs<GameRoomEvent.EffectTriggered>(innerEvent)
        assertEquals("fx1", innerEvent.effect.id)
        assertEquals(EffectType.FIREWORKS, innerEvent.effect.type)
    }

    @Test
    fun s2c_event_bubbleShown_roundTrip() {
        val original =
            ServerToClientMessage.Event(
                GameRoomEvent.BubbleShown("p1", "A賞！", BubbleType.PRIZE_RESULT, 5000),
            )
        val decoded = GameRoomCodec.decodeS2C(GameRoomCodec.encodeS2C(original))
        assertIs<ServerToClientMessage.Event>(decoded)
        val innerEvent = (decoded as ServerToClientMessage.Event).event
        assertIs<GameRoomEvent.BubbleShown>(innerEvent)
        assertEquals("A賞！", innerEvent.text)
        assertEquals(BubbleType.PRIZE_RESULT, innerEvent.type)
    }

    // -----------------------------------------------------------------------
    // Malformed JSON
    // -----------------------------------------------------------------------

    @Test
    fun decodeC2S_malformedJson_throwsSerializationException() {
        assertFailsWith<SerializationException> {
            GameRoomCodec.decodeC2S("{ not valid json }")
        }
    }

    @Test
    fun decodeS2C_malformedJson_throwsSerializationException() {
        assertFailsWith<SerializationException> {
            GameRoomCodec.decodeS2C("{ not valid json }")
        }
    }

    @Test
    fun decodeC2S_missingTypeDiscriminator_throwsSerializationException() {
        assertFailsWith<SerializationException> {
            GameRoomCodec.decodeC2S("""{"targetIsoX":1.0,"targetIsoY":2.0}""")
        }
    }
}
