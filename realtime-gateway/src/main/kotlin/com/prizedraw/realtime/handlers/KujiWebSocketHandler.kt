package com.prizedraw.realtime.handlers

import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.RoomInstance
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.realtime.connection.ConnectionManager
import com.prizedraw.realtime.ports.IDrawRepository
import com.prizedraw.realtime.services.DrawSyncService
import com.prizedraw.realtime.services.RoomScalingService
import io.ktor.server.routing.Route
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private val log = LoggerFactory.getLogger("KujiWebSocketHandler")
private val wsJson = Json { ignoreUnknownKeys = true }

/** Minimum inter-frame interval in milliseconds — enforces the ~60 fps ceiling (1000/60 ≈ 16 ms). */
private const val MIN_FRAME_INTERVAL_MS = 16L

/**
 * Tracks the most-recent relay timestamp (epoch ms) for each draw session.
 *
 * Used by [shouldRelayFrame] to enforce the 60 fps ceiling on `C2S_DRAW_INPUT` messages.
 * Entries are removed when a session reaches a terminal state via [purgeFpsEntry].
 */
private val lastFrameTimeMs = ConcurrentHashMap<String, Long>()

/**
 * Returns `true` and advances the session timestamp when the frame should be relayed;
 * returns `false` when the inter-frame interval is below [MIN_FRAME_INTERVAL_MS] ms (~60 fps ceiling).
 *
 * @param sessionId The draw session identifier used as the map key.
 */
private fun shouldRelayFrame(sessionId: String): Boolean {
    val now = System.currentTimeMillis()
    var relay = false
    lastFrameTimeMs.compute(sessionId) { _, last ->
        if (last == null || now - last >= MIN_FRAME_INTERVAL_MS) {
            relay = true
            now
        } else {
            last
        }
    }
    return relay
}

/**
 * Removes the frame-rate limiter entry for [sessionId] when the session terminates.
 *
 * @param sessionId The draw session that has ended.
 */
private fun purgeFpsEntry(sessionId: String) {
    lastFrameTimeMs.remove(sessionId)
}

/**
 * Registers the `/ws/kuji/{campaignId}` and `/ws/kuji/{campaignId}/rooms/{roomInstanceId}`
 * WebSocket routes.
 *
 * @param connectionManager Session registry per room key.
 * @param drawRepository Loads prize definitions for the board snapshot on connect.
 * @param drawSyncService Handles C2S draw-sync event processing.
 * @param roomScalingService Assigns players to shards and maintains shard lifecycle.
 */
public fun Route.kujiWebSocketHandler(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
) {
    webSocket(WebSocketEndpoints.KUJI_ROOM) {
        handleLegacyKujiRoom(connectionManager, drawRepository, drawSyncService, roomScalingService)
    }
    webSocket(WebSocketEndpoints.KUJI_ROOM_SHARDED) {
        handleShardedKujiRoom(connectionManager, drawRepository, drawSyncService, roomScalingService)
    }
}

// --- Legacy room handler ---

private suspend fun DefaultWebSocketServerSession.handleLegacyKujiRoom(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
) {
    val campaignIdStr =
        call.parameters["campaignId"] ?: run {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing campaignId"))
            return
        }
    val campaignId =
        runCatching { UUID.fromString(campaignIdStr) }.getOrElse {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid campaignId"))
            return
        }
    val shard = roomScalingService.assignRoom(campaignId, UUID.randomUUID())
    val roomKey = "room:${shard.id}"
    val campaignRoomKey = "kuji:$campaignIdStr"

    connectionManager.register(roomKey, this)
    connectionManager.register(campaignRoomKey, this)
    try {
        sendRoomAssigned(shard.id, shard.instanceNumber, shard.playerCount, shard.maxPlayers)
        sendBoardSnapshot(campaignIdStr, drawRepository)
        broadcastRoomStats(campaignId, roomScalingService, connectionManager, campaignRoomKey)
        processIncomingFrames(
            campaignId,
            roomKey,
            campaignRoomKey,
            drawSyncService,
            roomScalingService,
            connectionManager,
        )
    } finally {
        connectionManager.unregister(roomKey, this)
        connectionManager.unregister(campaignRoomKey, this)
        roomScalingService.leaveRoom(shard.id)
        log.debug("Session disconnected from shard {} (campaign {})", shard.id, campaignIdStr)
    }
}

// --- Sharded room handler ---

@Suppress("ReturnCount")
private suspend fun DefaultWebSocketServerSession.handleShardedKujiRoom(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
) {
    val params = resolveShardedParams(roomScalingService) ?: return
    val (campaignIdStr, campaignId, shard) = params
    val roomKey = "room:${shard.id}"
    val campaignRoomKey = "kuji:$campaignIdStr"

    connectionManager.register(roomKey, this)
    connectionManager.register(campaignRoomKey, this)
    try {
        roomScalingService.incrementShardCount(shard.id)
        sendRoomAssigned(shard.id, shard.instanceNumber, shard.playerCount + 1, shard.maxPlayers)
        sendBoardSnapshot(campaignIdStr, drawRepository)
        broadcastRoomStats(campaignId, roomScalingService, connectionManager, campaignRoomKey)
        processIncomingFrames(
            campaignId,
            roomKey,
            campaignRoomKey,
            drawSyncService,
            roomScalingService,
            connectionManager,
        )
    } finally {
        connectionManager.unregister(roomKey, this)
        connectionManager.unregister(campaignRoomKey, this)
        roomScalingService.leaveRoom(shard.id)
        log.debug("Session disconnected from shard {} (campaign {})", shard.id, campaignIdStr)
    }
}

@Suppress("ReturnCount")
private suspend fun DefaultWebSocketServerSession.resolveShardedParams(
    roomScalingService: RoomScalingService,
): Triple<String, UUID, RoomInstance>? {
    val campaignIdStr =
        call.parameters["campaignId"] ?: run {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing campaignId"))
            return null
        }
    val roomInstanceIdStr =
        call.parameters["roomInstanceId"] ?: run {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing roomInstanceId"))
            return null
        }
    val campaignId =
        runCatching { UUID.fromString(campaignIdStr) }.getOrElse {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid campaignId"))
            return null
        }
    val roomInstanceId =
        runCatching { UUID.fromString(roomInstanceIdStr) }.getOrElse {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid roomInstanceId"))
            return null
        }
    val shard =
        roomScalingService.findShard(roomInstanceId) ?: run {
            close(CloseReason(CloseReason.Codes.NORMAL, "Room instance not found"))
            return null
        }
    if (shard.playerCount >= shard.maxPlayers) {
        val alternative = roomScalingService.assignRoom(campaignId, UUID.randomUUID())
        sendRoomFull(suggestedRoomInstanceId = alternative.id)
        close(CloseReason(CloseReason.Codes.TRY_AGAIN_LATER, "Room full"))
        return null
    }
    return Triple(campaignIdStr, campaignId, shard)
}

// --- Frame loop ---

@Suppress("LongParameterList")
private suspend fun DefaultWebSocketServerSession.processIncomingFrames(
    campaignId: UUID,
    currentRoomKey: String,
    campaignRoomKey: String,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
    connectionManager: ConnectionManager,
) {
    for (frame in incoming) {
        if (frame is Frame.Text) {
            handleC2sFrame(
                text = frame.readText(),
                campaignId = campaignId,
                currentRoomKey = currentRoomKey,
                campaignRoomKey = campaignRoomKey,
                drawSyncService = drawSyncService,
                roomScalingService = roomScalingService,
                connectionManager = connectionManager,
                session = this,
            )
        }
    }
}

// --- C2S frame dispatch ---

@Suppress("TooGenericExceptionCaught", "LongParameterList")
private suspend fun handleC2sFrame(
    text: String,
    campaignId: UUID,
    currentRoomKey: String,
    campaignRoomKey: String,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
    connectionManager: ConnectionManager,
    session: DefaultWebSocketServerSession,
) {
    val obj = runCatching { wsJson.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
    when (val type = obj["type"]?.jsonPrimitive?.content ?: return) {
        "C2S_DRAW_INPUT" -> handleDrawInput(obj, campaignId, drawSyncService)
        "C2S_DRAW_PROGRESS" -> handleDrawProgress(obj, drawSyncService)
        "C2S_DRAW_CANCEL" -> handleDrawCancel(obj, drawSyncService)
        "C2S_DRAW_COMPLETE" -> handleDrawComplete(obj, drawSyncService)
        "C2S_SWITCH_ROOM" ->
            handleSwitchRoom(
                obj = obj,
                campaignId = campaignId,
                currentRoomKey = currentRoomKey,
                campaignRoomKey = campaignRoomKey,
                roomScalingService = roomScalingService,
                connectionManager = connectionManager,
                session = session,
            )
        else -> log.debug("Kuji WS unhandled C2S type: {}", type)
    }
}

/**
 * Handles a `C2S_DRAW_INPUT` frame from the drawing player.
 *
 * Frames are rate-limited to ~60 fps per session via [shouldRelayFrame].
 */
private suspend fun handleDrawInput(
    obj: kotlinx.serialization.json.JsonObject,
    campaignId: UUID,
    drawSyncService: DrawSyncService,
) {
    val sessionIdStr = obj["sessionId"]?.jsonPrimitive?.contentOrNull ?: return
    val sessionId = runCatching { UUID.fromString(sessionIdStr) }.getOrNull() ?: return
    val x = obj["x"]?.jsonPrimitive?.floatOrNull ?: return
    val y = obj["y"]?.jsonPrimitive?.floatOrNull ?: return
    val isDown = obj["isDown"]?.jsonPrimitive?.booleanOrNull ?: return
    val timestamp = obj["timestamp"]?.jsonPrimitive?.longOrNull ?: return

    if (!shouldRelayFrame(sessionIdStr)) {
        return
    }

    runCatching {
        drawSyncService.relayTouchInput(
            sessionId = sessionId,
            campaignId = campaignId,
            x = x,
            y = y,
            isDown = isDown,
            timestamp = timestamp,
        )
    }.onFailure { log.warn("relayTouchInput failed for session {}", sessionId, it) }
}

private suspend fun handleDrawProgress(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId =
        obj["sessionId"]
            ?.jsonPrimitive
            ?.content
            ?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
    val progress = obj["progress"]?.jsonPrimitive?.content?.toFloatOrNull() ?: return
    runCatching { drawSyncService.relayProgress(sessionId, progress) }
        .onFailure { log.warn("relayProgress failed for session {}", sessionId, it) }
}

private suspend fun handleDrawCancel(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionIdStr = obj["sessionId"]?.jsonPrimitive?.content ?: return
    val sessionId = runCatching { UUID.fromString(sessionIdStr) }.getOrNull() ?: return
    runCatching { drawSyncService.cancelDraw(sessionId) }
        .onFailure { log.warn("cancelDraw failed for session {}", sessionId, it) }
    purgeFpsEntry(sessionIdStr)
}

private suspend fun handleDrawComplete(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionIdStr = obj["sessionId"]?.jsonPrimitive?.content ?: return
    val sessionId = runCatching { UUID.fromString(sessionIdStr) }.getOrNull() ?: return
    runCatching { drawSyncService.completeDraw(sessionId) }
        .onFailure { log.warn("completeDraw failed for session {}", sessionId, it) }
    purgeFpsEntry(sessionIdStr)
}

@Suppress("LongParameterList")
private suspend fun handleSwitchRoom(
    obj: kotlinx.serialization.json.JsonObject,
    @Suppress("UnusedParameter") campaignId: UUID,
    currentRoomKey: String,
    @Suppress("UnusedParameter") campaignRoomKey: String,
    roomScalingService: RoomScalingService,
    connectionManager: ConnectionManager,
    session: DefaultWebSocketServerSession,
) {
    val targetIdStr = obj["targetRoomInstanceId"]?.jsonPrimitive?.content ?: return
    val targetId = runCatching { UUID.fromString(targetIdStr) }.getOrNull() ?: return
    val target = roomScalingService.findShard(targetId) ?: return

    if (target.playerCount >= target.maxPlayers) {
        session.sendRoomFull(suggestedRoomInstanceId = target.id)
        return
    }

    val oldShardId =
        currentRoomKey
            .removePrefix("room:")
            .let { runCatching { UUID.fromString(it) }.getOrNull() }
    if (oldShardId != null) {
        roomScalingService.leaveRoom(oldShardId)
        connectionManager.unregister(currentRoomKey, session)
    }

    roomScalingService.incrementShardCount(target.id)
    val newRoomKey = "room:${target.id}"
    connectionManager.register(newRoomKey, session)
    session.sendRoomAssigned(
        roomInstanceId = target.id,
        instanceNumber = target.instanceNumber,
        playerCount = target.playerCount + 1,
        maxPlayers = target.maxPlayers,
    )
    log.debug("Session switched from shard {} to shard {}", currentRoomKey, newRoomKey)
}

// --- Snapshot and event helpers ---

private suspend fun DefaultWebSocketServerSession.sendBoardSnapshot(
    campaignIdStr: String,
    drawRepository: IDrawRepository,
) {
    val campaignId = runCatching { UUID.fromString(campaignIdStr) }.getOrNull() ?: return
    val definitions =
        drawRepository.findDefinitionsByCampaign(
            CampaignId(campaignId),
            CampaignType.KUJI,
        )
    val snapshot =
        buildJsonObject {
            put("type", "BOARD_SNAPSHOT")
            put("campaignId", campaignIdStr)
            put("prizeDefinitionCount", definitions.size)
            put("tickets", buildJsonArray { })
        }
    send(Frame.Text(snapshot.toString()))
}

private suspend fun DefaultWebSocketServerSession.sendRoomAssigned(
    roomInstanceId: UUID,
    instanceNumber: Int,
    playerCount: Int,
    maxPlayers: Int,
) {
    val event =
        buildJsonObject {
            put("type", "S2C_ROOM_ASSIGNED")
            put("roomInstanceId", roomInstanceId.toString())
            put("instanceNumber", instanceNumber)
            put("playerCount", playerCount)
            put("maxPlayers", maxPlayers)
        }
    send(Frame.Text(event.toString()))
}

private suspend fun DefaultWebSocketServerSession.sendRoomFull(suggestedRoomInstanceId: UUID) {
    val event =
        buildJsonObject {
            put("type", "S2C_ROOM_FULL")
            put("suggestedRoomInstanceId", suggestedRoomInstanceId.toString())
        }
    send(Frame.Text(event.toString()))
}

private suspend fun broadcastRoomStats(
    campaignId: UUID,
    roomScalingService: RoomScalingService,
    connectionManager: ConnectionManager,
    campaignRoomKey: String,
) {
    val stats = roomScalingService.getCampaignStats(campaignId)
    val event =
        buildJsonObject {
            put("type", "S2C_ROOM_STATS")
            put("totalViewers", stats.totalViewers)
            put("activeRooms", stats.activeRooms)
        }
    connectionManager.broadcast(campaignRoomKey, event.toString())
}
