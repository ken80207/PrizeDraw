package com.prizedraw.infrastructure.websocket

import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.services.DrawSyncService
import com.prizedraw.application.services.RoomScalingService
import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import io.ktor.server.routing.Route
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID

private val log = LoggerFactory.getLogger("KujiWebSocketHandler")
private val wsJson = Json { ignoreUnknownKeys = true }

/**
 * Registers the `/ws/kuji/{campaignId}` and `/ws/kuji/{campaignId}/rooms/{roomInstanceId}`
 * WebSocket routes.
 *
 * ## Legacy endpoint — `/ws/kuji/{campaignId}`
 *
 * Maintains full backwards compatibility. On connect the handler auto-assigns a shard
 * via [RoomScalingService.assignRoom] and sends `S2C_ROOM_ASSIGNED` so the client can
 * reconnect to the sharded endpoint if desired.
 *
 * ## Sharded endpoint — `/ws/kuji/{campaignId}/rooms/{roomInstanceId}`
 *
 * The client supplies an explicit shard UUID (from a prior `S2C_ROOM_ASSIGNED` event or
 * from `GET /api/v1/campaigns/kuji/{campaignId}/rooms`).
 *
 * ## Room key conventions
 * | Room type        | Key pattern                   | Scope                   |
 * |------------------|-------------------------------|-------------------------|
 * | Shard room       | `room:{roomInstanceId}`       | Chat, spectator count   |
 * | Campaign-global  | `kuji:{campaignId}`           | Draw sync events        |
 * | Room lifecycle   | `campaign:{campaignId}:rooms` | Shard creation notices  |
 *
 * Draw events broadcast to `kuji:{campaignId}` reach **all shards**; chat messages
 * published to `room:{roomInstanceId}` stay within a single shard.
 *
 * ## S2C events added by Phase 21
 * - `S2C_ROOM_ASSIGNED` — shard metadata sent immediately after connect.
 * - `S2C_ROOM_STATS`    — global viewer count broadcast at connect and after every join/leave.
 * - `S2C_ROOM_FULL`     — redirect hint when the requested shard is at capacity.
 *
 * ## C2S events added by Phase 21
 * - `C2S_SWITCH_ROOM { targetRoomInstanceId }` — client requests a shard transfer.
 *
 * @param connectionManager Session registry per room key.
 * @param drawRepository Loads the ticket board snapshot on connect.
 * @param prizeRepository Enriches tickets with prize definition details.
 * @param drawSyncService Handles C2S draw-sync event processing.
 * @param roomScalingService Assigns players to shards and maintains shard lifecycle.
 */
public fun Route.kujiWebSocketHandler(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
) {
    webSocket(WebSocketEndpoints.KUJI_ROOM) {
        handleLegacyKujiRoom(connectionManager, drawRepository, prizeRepository, drawSyncService, roomScalingService)
    }
    webSocket(WebSocketEndpoints.KUJI_ROOM_SHARDED) {
        handleShardedKujiRoom(connectionManager, drawRepository, prizeRepository, drawSyncService, roomScalingService)
    }
}

// --- Legacy room handler ---

private suspend fun DefaultWebSocketServerSession.handleLegacyKujiRoom(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
    drawSyncService: DrawSyncService,
    roomScalingService: RoomScalingService,
) {
    val campaignIdStr = call.parameters["campaignId"] ?: run {
        close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing campaignId"))
        return
    }
    val campaignId = runCatching { UUID.fromString(campaignIdStr) }.getOrElse {
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
        sendBoardSnapshot(campaignIdStr, drawRepository, prizeRepository)
        broadcastRoomStats(campaignId, roomScalingService, connectionManager, campaignRoomKey)
        processIncomingFrames(
            campaignId, roomKey, campaignRoomKey, drawSyncService, roomScalingService, connectionManager,
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
    prizeRepository: IPrizeRepository,
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
        sendBoardSnapshot(campaignIdStr, drawRepository, prizeRepository)
        broadcastRoomStats(campaignId, roomScalingService, connectionManager, campaignRoomKey)
        processIncomingFrames(
            campaignId, roomKey, campaignRoomKey, drawSyncService, roomScalingService, connectionManager,
        )
    } finally {
        connectionManager.unregister(roomKey, this)
        connectionManager.unregister(campaignRoomKey, this)
        roomScalingService.leaveRoom(shard.id)
        log.debug("Session disconnected from shard {} (campaign {})", shard.id, campaignIdStr)
    }
}

/**
 * Validates and resolves path parameters for the sharded endpoint.
 *
 * Returns a triple of (campaignIdStr, campaignId, shard) on success, or `null`
 * after sending the appropriate close reason if validation fails.
 *
 * The multiple early returns are intentional: each guard closes the WebSocket before
 * returning, making a cascade of nested `if/else` blocks significantly harder to read.
 */
@Suppress("ReturnCount")
private suspend fun DefaultWebSocketServerSession.resolveShardedParams(
    roomScalingService: RoomScalingService,
): Triple<String, UUID, com.prizedraw.domain.entities.RoomInstance>? {
    val campaignIdStr = call.parameters["campaignId"] ?: run {
        close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing campaignId"))
        return null
    }
    val roomInstanceIdStr = call.parameters["roomInstanceId"] ?: run {
        close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing roomInstanceId"))
        return null
    }
    val campaignId = runCatching { UUID.fromString(campaignIdStr) }.getOrElse {
        close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid campaignId"))
        return null
    }
    val roomInstanceId = runCatching { UUID.fromString(roomInstanceIdStr) }.getOrElse {
        close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid roomInstanceId"))
        return null
    }
    val shard = roomScalingService.findShard(roomInstanceId) ?: run {
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
        "C2S_DRAW_PROGRESS" -> handleDrawProgress(obj, drawSyncService)
        "C2S_DRAW_CANCEL" -> handleDrawCancel(obj, drawSyncService)
        "C2S_DRAW_COMPLETE" -> handleDrawComplete(obj, drawSyncService)
        "C2S_SWITCH_ROOM" -> handleSwitchRoom(
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

private suspend fun handleDrawProgress(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId = obj["sessionId"]?.jsonPrimitive?.content
        ?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
    val progress = obj["progress"]?.jsonPrimitive?.content?.toFloatOrNull() ?: return
    runCatching { drawSyncService.relayProgress(sessionId, progress) }
        .onFailure { log.warn("relayProgress failed for session {}", sessionId, it) }
}

private suspend fun handleDrawCancel(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId = obj["sessionId"]?.jsonPrimitive?.content
        ?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
    runCatching { drawSyncService.cancelDraw(sessionId) }
        .onFailure { log.warn("cancelDraw failed for session {}", sessionId, it) }
}

private suspend fun handleDrawComplete(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId = obj["sessionId"]?.jsonPrimitive?.content
        ?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
    runCatching { drawSyncService.completeDraw(sessionId) }
        .onFailure { log.warn("completeDraw failed for session {}", sessionId, it) }
}

/**
 * Handles `C2S_SWITCH_ROOM { targetRoomInstanceId }`.
 *
 * Moves the session from its current shard room key to the target shard's room key
 * within the same [ConnectionManager]. The campaign-global key is unchanged.
 * Sends `S2C_ROOM_ASSIGNED` on success, or `S2C_ROOM_FULL` if the target is at capacity.
 */
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

    val oldShardId = currentRoomKey.removePrefix("room:")
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

@Suppress("UnusedParameter")
private suspend fun DefaultWebSocketServerSession.sendBoardSnapshot(
    campaignIdStr: String,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
) {
    val campaignId = runCatching { UUID.fromString(campaignIdStr) }.getOrNull() ?: return
    val definitions = prizeRepository.findDefinitionsByCampaign(
        CampaignId(campaignId),
        CampaignType.KUJI,
    )
    val snapshot = buildJsonObject {
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
    val event = buildJsonObject {
        put("type", "S2C_ROOM_ASSIGNED")
        put("roomInstanceId", roomInstanceId.toString())
        put("instanceNumber", instanceNumber)
        put("playerCount", playerCount)
        put("maxPlayers", maxPlayers)
    }
    send(Frame.Text(event.toString()))
}

private suspend fun DefaultWebSocketServerSession.sendRoomFull(suggestedRoomInstanceId: UUID) {
    val event = buildJsonObject {
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
    val event = buildJsonObject {
        put("type", "S2C_ROOM_STATS")
        put("totalViewers", stats.totalViewers)
        put("activeRooms", stats.activeRooms)
    }
    connectionManager.broadcast(campaignRoomKey, event.toString())
}
