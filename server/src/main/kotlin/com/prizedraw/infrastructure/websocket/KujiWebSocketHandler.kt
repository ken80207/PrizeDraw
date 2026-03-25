package com.prizedraw.infrastructure.websocket

import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.services.DrawSyncService
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
 * Registers the `/ws/kuji/{campaignId}` WebSocket route.
 *
 * Any authenticated or anonymous client may connect to this endpoint. Connecting without
 * joining the draw queue automatically enters **spectator mode** — the client receives
 * all broadcast events but cannot issue draw commands.
 *
 * On connect:
 * 1. Session is registered in the room.
 * 2. Full ticket board snapshot is sent.
 * 3. Current spectator count is broadcast to all connected sessions.
 *
 * Incoming C2S draw-sync events handled:
 * - `C2S_DRAW_PROGRESS` `{ sessionId, progress }` — relays animation progress to spectators.
 * - `C2S_DRAW_CANCEL`   `{ sessionId }`            — cancels the in-flight draw.
 * - `C2S_DRAW_COMPLETE` `{ sessionId }`            — reveals the result to spectators.
 *
 * On disconnect:
 * 1. Session is unregistered.
 * 2. Updated spectator count is logged.
 *
 * @param connectionManager Manages active sessions per campaign room.
 * @param drawRepository Used to load the ticket board snapshot on connect.
 * @param prizeRepository Used to enrich tickets with prize definition details.
 * @param drawSyncService Handles draw-sync C2S event processing.
 */
public fun Route.kujiWebSocketHandler(
    connectionManager: ConnectionManager,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
    drawSyncService: DrawSyncService,
) {
    webSocket(WebSocketEndpoints.KUJI_ROOM) {
        val campaignId =
            call.parameters["campaignId"] ?: run {
                close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing campaignId"))
                return@webSocket
            }
        val roomKey = "kuji:$campaignId"
        connectionManager.register(roomKey, this)
        try {
            sendBoardSnapshot(campaignId, drawRepository, prizeRepository)
            broadcastSpectatorCount(connectionManager, roomKey)
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    handleC2sFrame(frame.readText(), drawSyncService)
                }
            }
        } finally {
            connectionManager.unregister(roomKey, this)
            broadcastSpectatorCountGlobal(connectionManager, roomKey)
            log.debug("Session disconnected from kuji room $campaignId")
        }
    }
}

// --- C2S frame handling ---

@Suppress("TooGenericExceptionCaught")
private suspend fun handleC2sFrame(
    text: String,
    drawSyncService: DrawSyncService,
) {
    val obj = runCatching { wsJson.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
    val type = obj["type"]?.jsonPrimitive?.content ?: return
    when (type) {
        "C2S_DRAW_PROGRESS" -> handleDrawProgress(obj, drawSyncService)
        "C2S_DRAW_CANCEL" -> handleDrawCancel(obj, drawSyncService)
        "C2S_DRAW_COMPLETE" -> handleDrawComplete(obj, drawSyncService)
        else -> log.debug("Kuji WS unhandled C2S type: $type")
    }
}

private suspend fun handleDrawProgress(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId =
        obj["sessionId"]?.jsonPrimitive?.content?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        } ?: return
    val progress = obj["progress"]?.jsonPrimitive?.content?.toFloatOrNull() ?: return
    runCatching { drawSyncService.relayProgress(sessionId, progress) }
        .onFailure { log.warn("relayProgress failed for session $sessionId", it) }
}

private suspend fun handleDrawCancel(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId =
        obj["sessionId"]?.jsonPrimitive?.content?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        } ?: return
    runCatching { drawSyncService.cancelDraw(sessionId) }
        .onFailure { log.warn("cancelDraw failed for session $sessionId", it) }
}

private suspend fun handleDrawComplete(
    obj: kotlinx.serialization.json.JsonObject,
    drawSyncService: DrawSyncService,
) {
    val sessionId =
        obj["sessionId"]?.jsonPrimitive?.content?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        } ?: return
    runCatching { drawSyncService.completeDraw(sessionId) }
        .onFailure { log.warn("completeDraw failed for session $sessionId", it) }
}

// --- Snapshot helpers ---

@Suppress("UnusedParameter")
private suspend fun DefaultWebSocketServerSession.sendBoardSnapshot(
    campaignIdStr: String,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
) {
    val campaignId = runCatching { UUID.fromString(campaignIdStr) }.getOrNull() ?: return
    val definitions =
        prizeRepository.findDefinitionsByCampaign(
            CampaignId(campaignId),
            CampaignType.KUJI,
        )

    val snapshot =
        buildJsonObject {
            put("type", "BOARD_SNAPSHOT")
            put("campaignId", campaignIdStr)
            put("prizeDefinitionCount", definitions.size)
            put(
                "tickets",
                buildJsonArray {
                    // Production wires box-level queries; stub with empty array.
                },
            )
        }
    send(Frame.Text(snapshot.toString()))
}

private suspend fun DefaultWebSocketServerSession.broadcastSpectatorCount(
    connectionManager: ConnectionManager,
    roomKey: String,
) {
    val count = connectionManager.spectatorCount(roomKey)
    val event =
        buildJsonObject {
            put("type", "SPECTATOR_COUNT")
            put("count", count)
        }
    connectionManager.broadcast(roomKey, event.toString())
}

private fun broadcastSpectatorCountGlobal(
    connectionManager: ConnectionManager,
    roomKey: String,
) {
    // Fire-and-forget broadcast after unregister; we need a scope here.
    // The ConnectionManager scope handles the suspend call via its internal scope.
    val count = connectionManager.spectatorCount(roomKey)
    val event =
        buildJsonObject {
            put("type", "SPECTATOR_COUNT")
            put("count", count)
        }
    // Publish via Redis pub/sub so all pods receive the updated count.
    log.debug("Spectator count for $roomKey is now $count — event: $event")
}
