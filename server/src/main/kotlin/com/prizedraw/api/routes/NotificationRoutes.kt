package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.contracts.endpoints.NotificationEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import org.koin.ktor.ext.inject

private const val DEFAULT_LIMIT = 20
private const val MAX_LIMIT = 50
private const val MIN_LIMIT = 1

@Serializable
private data class NotificationListResponse(
    val notifications: List<NotificationItemDto>,
    val hasMore: Boolean,
)

@Serializable
private data class NotificationItemDto(
    val id: String,
    val eventType: String,
    val title: String,
    val body: String,
    val data: Map<String, String>,
    val isRead: Boolean,
    val createdAt: String,
)

/**
 * REST routes for notification history and read-status management.
 *
 * Protected endpoints (JWT required):
 * - GET  [NotificationEndpoints.LIST]          — Paginated notification history
 * - GET  [NotificationEndpoints.UNREAD_COUNT]  — Count of unread notifications
 * - POST [NotificationEndpoints.MARK_READ]     — Mark a single notification as read
 * - POST [NotificationEndpoints.MARK_ALL_READ] — Mark all notifications as read
 */
public fun Route.notificationRoutes() {
    val notificationRepository: INotificationRepository by inject()

    authenticate("player") {
        get(NotificationEndpoints.LIST) {
            val playerId = call.principal<PlayerPrincipal>()!!.playerId
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_LIMIT
            val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
            val clamped = limit.coerceIn(MIN_LIMIT, MAX_LIMIT)

            val notifications = notificationRepository.findByPlayerId(playerId.value, clamped + 1, offset)
            val hasMore = notifications.size > clamped
            val items =
                notifications.take(clamped).map { n ->
                    NotificationItemDto(
                        id = n.id.toString(),
                        eventType = n.eventType,
                        title = n.title,
                        body = n.body,
                        data = n.data,
                        isRead = n.isRead,
                        createdAt = n.createdAt.toString(),
                    )
                }
            call.respond(HttpStatusCode.OK, NotificationListResponse(items, hasMore))
        }

        get(NotificationEndpoints.UNREAD_COUNT) {
            val playerId = call.principal<PlayerPrincipal>()!!.playerId
            val count = notificationRepository.countUnread(playerId.value)
            call.respond(HttpStatusCode.OK, mapOf("unreadCount" to count))
        }

        post(NotificationEndpoints.MARK_READ) {
            val playerId = call.principal<PlayerPrincipal>()!!.playerId
            val id =
                call.parameters["id"] ?: run {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing id"))
                    return@post
                }
            val uuid =
                try {
                    java.util.UUID.fromString(id)
                } catch (_: IllegalArgumentException) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid id"))
                    return@post
                }
            notificationRepository.markRead(uuid, playerId.value)
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        post(NotificationEndpoints.MARK_ALL_READ) {
            val playerId = call.principal<PlayerPrincipal>()!!.playerId
            val count = notificationRepository.markAllRead(playerId.value)
            call.respond(HttpStatusCode.OK, mapOf("markedRead" to count))
        }
    }
}
