package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.services.ChatService
import com.prizedraw.application.services.RateLimitExceededException
import com.prizedraw.contracts.dto.chat.ChatHistoryResponse
import com.prizedraw.contracts.dto.chat.ChatMessageDto
import com.prizedraw.contracts.dto.chat.SendMessageRequest
import com.prizedraw.contracts.dto.chat.SendReactionRequest
import com.prizedraw.contracts.endpoints.ChatEndpoints
import com.prizedraw.domain.entities.ChatMessage
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post

/**
 * Registers REST routes for the chat subsystem.
 *
 * - POST [ChatEndpoints.SEND_MESSAGE]  — send a text message (authenticated).
 * - POST [ChatEndpoints.SEND_REACTION] — send a reaction emoji (authenticated).
 * - GET  [ChatEndpoints.HISTORY]       — retrieve recent history (public).
 */
public fun Route.chatRoutes() {
    val chatService: ChatService by inject()
    val playerRepository: IPlayerRepository by inject()

    get(ChatEndpoints.HISTORY) {
        val roomId =
            call.parameters["roomId"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing roomId"))
                return@get
            }
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: ChatService.DEFAULT_HISTORY_LIMIT
        val messages = chatService.getHistory(roomId, limit)
        call.respond(HttpStatusCode.OK, ChatHistoryResponse(roomId = roomId, messages = messages.map { it.toDto() }))
    }

    authenticate("player") {
        post(ChatEndpoints.SEND_MESSAGE) {
            handleSendMessage(call, chatService, playerRepository)
        }
        post(ChatEndpoints.SEND_REACTION) {
            handleSendReaction(call, chatService, playerRepository)
        }
    }
}

private suspend fun handleSendMessage(
    call: io.ktor.server.application.ApplicationCall,
    chatService: ChatService,
    playerRepository: IPlayerRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val roomId =
        call.parameters["roomId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing roomId"))
            return
        }
    val request = call.receive<SendMessageRequest>()
    val nickname = playerRepository.findById(principal.playerId)?.nickname ?: principal.playerId.value.toString()
    runCatching { chatService.sendMessage(roomId, principal.playerId.value, nickname, request.message) }
        .fold(onSuccess = { call.respond(HttpStatusCode.NoContent) }, onFailure = { call.handleChatError(it) })
}

private suspend fun handleSendReaction(
    call: io.ktor.server.application.ApplicationCall,
    chatService: ChatService,
    playerRepository: IPlayerRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val roomId =
        call.parameters["roomId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing roomId"))
            return
        }
    val request = call.receive<SendReactionRequest>()
    val nickname = playerRepository.findById(principal.playerId)?.nickname ?: principal.playerId.value.toString()
    runCatching { chatService.sendReaction(roomId, principal.playerId.value, nickname, request.emoji) }
        .fold(onSuccess = { call.respond(HttpStatusCode.NoContent) }, onFailure = { call.handleChatError(it) })
}

private suspend fun io.ktor.server.application.ApplicationCall.handleChatError(ex: Throwable) {
    when (ex) {
        is RateLimitExceededException ->
            respond(HttpStatusCode.TooManyRequests, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private fun ChatMessage.toDto(): ChatMessageDto =
    ChatMessageDto(
        id = id.toString(),
        playerId = playerId.toString(),
        playerNickname = playerNickname,
        message = message,
        isReaction = isReaction,
        createdAt = createdAt,
    )
