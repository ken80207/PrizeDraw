package com.prizedraw.realtime.plugins

import com.prizedraw.realtime.connection.ConnectionManager
import com.prizedraw.realtime.connection.PlayerNotificationManager
import com.prizedraw.realtime.handlers.chatWebSocketHandler
import com.prizedraw.realtime.handlers.feedWebSocketHandler
import com.prizedraw.realtime.handlers.kujiWebSocketHandler
import com.prizedraw.realtime.handlers.playerNotificationHandler
import com.prizedraw.realtime.handlers.queueWebSocketHandler
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IDrawRepository
import com.prizedraw.realtime.ports.INotificationRepository
import com.prizedraw.realtime.ports.IQueueEntryRepository
import com.prizedraw.realtime.ports.IQueueRepository
import com.prizedraw.realtime.services.ChatService
import com.prizedraw.realtime.services.DrawSyncService
import com.prizedraw.realtime.services.RoomScalingService
import com.prizedraw.shared.auth.JwtVerifier
import io.ktor.server.application.Application
import io.ktor.server.routing.routing
import org.koin.ktor.ext.inject

/**
 * Registers all WebSocket routes for the realtime-gateway.
 *
 * Route inventory:
 * - `/ws/kuji/{campaignId}`                          — Kuji live draw board (legacy, auto-assigns shard)
 * - `/ws/kuji/{campaignId}/rooms/{roomInstanceId}`   — Kuji live draw board (sharded)
 * - `/ws/queue/{ticketBoxId}`                        — Draw queue status
 * - `/ws/chat/{roomId}`                              — Campaign chat
 * - `/ws/feed`                                       — Public live draw feed
 * - `/ws/notifications`                              — Per-player notification channel (JWT auth required)
 */
public fun Application.configureRouting() {
    val connectionManager: ConnectionManager by inject()
    val drawRepository: IDrawRepository by inject()
    val drawSyncService: DrawSyncService by inject()
    val roomScalingService: RoomScalingService by inject()
    val queueRepository: IQueueRepository by inject()
    val queueEntryRepository: IQueueEntryRepository by inject()
    val chatService: ChatService by inject()
    val playerNotificationManager: PlayerNotificationManager by inject()
    val notificationRepository: INotificationRepository by inject()
    val jwtVerifier: JwtVerifier by inject()
    val redisPubSub: RedisPubSub by inject()

    routing {
        // Kuji live draw board — legacy (auto-assigns shard) and sharded endpoints
        kujiWebSocketHandler(
            connectionManager,
            drawRepository,
            drawSyncService,
            roomScalingService,
        )

        // Draw queue status
        queueWebSocketHandler(connectionManager, queueRepository, queueEntryRepository)

        // Campaign chat
        chatWebSocketHandler(connectionManager, chatService)

        // Public live draw feed
        feedWebSocketHandler(redisPubSub, this@configureRouting)

        // Per-player notification channel (JWT auth via query param)
        playerNotificationHandler(playerNotificationManager, jwtVerifier, notificationRepository)
    }
}
