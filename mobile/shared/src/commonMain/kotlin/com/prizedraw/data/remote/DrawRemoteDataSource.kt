package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.draw.DrawKujiRequest
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.DrawUnlimitedRequest
import com.prizedraw.contracts.dto.draw.JoinQueueRequest
import com.prizedraw.contracts.dto.draw.LeaveQueueRequest
import com.prizedraw.contracts.dto.draw.QueueEntryDto
import com.prizedraw.contracts.dto.draw.SwitchBoxRequest
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.contracts.endpoints.DrawEndpoints
import com.prizedraw.data.local.AuthTokenStore
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType

/**
 * Remote data source for draw and queue operations.
 *
 * Wraps Ktor Client calls to the Draw Service [DrawEndpoints] API. All endpoints
 * require authentication; the Bearer token is read from [authTokenStore] before
 * each request. When no token is present the request is sent without an
 * Authorization header and the server will respond with HTTP 401 — callers
 * should propagate this as an error state rather than crashing.
 *
 * @param httpClient The shared Ktor [HttpClient] instance pre-configured with
 *   base URL (Draw Service, port 9093) and JSON content negotiation.
 * @param authTokenStore Store from which the current access token is read.
 */
public class DrawRemoteDataSource(
    private val httpClient: HttpClient,
    private val authTokenStore: AuthTokenStore,
) {
    /**
     * Executes a kuji draw for the authenticated player.
     *
     * POSTs to [DrawEndpoints.DRAW_KUJI]. The server allocates and returns the
     * drawn ticket(s) and their associated prize instances.
     *
     * @param campaignId UUID of the kuji campaign (passed via [DrawKujiRequest.ticketBoxId]
     *   is not sufficient on its own — the campaign is resolved server-side from the box).
     * @param boxId UUID of the ticket box to draw from.
     * @param ticketIds Explicit ticket IDs to draw. Pass an empty list for random selection.
     * @param quantity Number of tickets to draw when [ticketIds] is empty.
     * @return [DrawResultDto] describing each drawn ticket and its awarded prize.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses
     *   (including 401 Unauthorized when unauthenticated).
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun drawKuji(
        campaignId: String,
        boxId: String,
        ticketIds: List<String> = emptyList(),
        quantity: Int = 1,
    ): DrawResultDto {
        val token = authTokenStore.getAccessToken()
        return httpClient
            .post(DrawEndpoints.DRAW_KUJI) {
                contentType(ContentType.Application.Json)
                token?.let { bearerAuth(it) }
                setBody(
                    DrawKujiRequest(
                        ticketBoxId = boxId,
                        ticketIds = ticketIds,
                        quantity = quantity,
                    ),
                )
            }.body()
    }

    /**
     * Executes an unlimited draw for the authenticated player.
     *
     * POSTs to [DrawEndpoints.DRAW_UNLIMITED]. Each call consumes draw points and
     * returns a single prize result. Call multiple times (or pass [count] > 1) for
     * rapid-fire mode.
     *
     * @param campaignId UUID of the unlimited campaign.
     * @param count Number of draws to perform in this request.
     * @param playerCouponId Optional coupon UUID to apply a draw discount.
     * @return [UnlimitedDrawResultDto] for the draw.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses
     *   (including 401 Unauthorized when unauthenticated).
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun drawUnlimited(
        campaignId: String,
        count: Int = 1,
        playerCouponId: String? = null,
    ): UnlimitedDrawResultDto {
        val token = authTokenStore.getAccessToken()
        return httpClient
            .post(DrawEndpoints.DRAW_UNLIMITED) {
                contentType(ContentType.Application.Json)
                token?.let { bearerAuth(it) }
                setBody(
                    DrawUnlimitedRequest(
                        campaignId = campaignId,
                        quantity = count,
                        playerCouponId = playerCouponId,
                    ),
                )
            }.body()
    }

    /**
     * Joins the draw queue for a ticket box.
     *
     * POSTs to [DrawEndpoints.QUEUE_JOIN]. The player is placed at the end of
     * the box queue and a [QueueEntryDto] with the assigned position is returned.
     *
     * @param request Join request specifying the ticket box.
     * @return The created [QueueEntryDto] with position and status.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun joinQueue(request: JoinQueueRequest): QueueEntryDto {
        val token = authTokenStore.getAccessToken()
        return httpClient
            .post(DrawEndpoints.QUEUE_JOIN) {
                contentType(ContentType.Application.Json)
                token?.let { bearerAuth(it) }
                setBody(request)
            }.body()
    }

    /**
     * Leaves the draw queue for a ticket box.
     *
     * POSTs to [DrawEndpoints.QUEUE_LEAVE]. The player's queue entry is removed
     * and subsequent players advance.
     *
     * @param request Leave request specifying the ticket box.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun leaveQueue(request: LeaveQueueRequest) {
        val token = authTokenStore.getAccessToken()
        httpClient
            .post(DrawEndpoints.QUEUE_LEAVE) {
                contentType(ContentType.Application.Json)
                token?.let { bearerAuth(it) }
                setBody(request)
            }
    }

    /**
     * Atomically switches the player from one box queue to another.
     *
     * POSTs to [DrawEndpoints.QUEUE_SWITCH_BOX]. The server removes the player
     * from the source queue and enqueues them at the end of the target queue in
     * a single transaction.
     *
     * @param request Switch request with source and target box IDs.
     * @return The new [QueueEntryDto] in the target box queue.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun switchBox(request: SwitchBoxRequest): QueueEntryDto {
        val token = authTokenStore.getAccessToken()
        return httpClient
            .post(DrawEndpoints.QUEUE_SWITCH_BOX) {
                contentType(ContentType.Application.Json)
                token?.let { bearerAuth(it) }
                setBody(request)
            }.body()
    }
}
