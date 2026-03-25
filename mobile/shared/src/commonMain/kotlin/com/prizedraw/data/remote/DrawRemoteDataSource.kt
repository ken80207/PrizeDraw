package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.draw.DrawKujiRequest
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.JoinQueueRequest
import com.prizedraw.contracts.dto.draw.LeaveQueueRequest
import com.prizedraw.contracts.dto.draw.QueueEntryDto
import com.prizedraw.contracts.dto.draw.SwitchBoxRequest
import com.prizedraw.contracts.endpoints.DrawEndpoints

/**
 * Remote data source for kuji draw and queue operations.
 *
 * Wraps Ktor Client calls to the server [DrawEndpoints] API.
 *
 * TODO(T107): Replace stubs with actual Ktor Client implementation using Bearer auth.
 */
public class DrawRemoteDataSource {
    // TODO(T107): inject HttpClient and AuthTokenStore

    /**
     * Executes a kuji draw for the authenticated player.
     *
     * @param request Draw request containing the box ID, ticket IDs, and quantity.
     * @return [DrawResultDto] describing each drawn ticket and its prize.
     */
    public suspend fun drawKuji(request: DrawKujiRequest): DrawResultDto {
        TODO("T107: implement Ktor Client POST to ${DrawEndpoints.DRAW_KUJI}")
    }

    /**
     * Joins the draw queue for a ticket box.
     *
     * @param request Join request specifying the ticket box.
     * @return The created [QueueEntryDto] with position and status.
     */
    public suspend fun joinQueue(request: JoinQueueRequest): QueueEntryDto {
        TODO("T107: implement Ktor Client POST to ${DrawEndpoints.QUEUE_JOIN}")
    }

    /**
     * Leaves the draw queue for a ticket box.
     *
     * @param request Leave request specifying the ticket box.
     */
    public suspend fun leaveQueue(request: LeaveQueueRequest) {
        TODO("T107: implement Ktor Client DELETE to ${DrawEndpoints.QUEUE_LEAVE}")
    }

    /**
     * Atomically switches the player from one box queue to another.
     *
     * @param request Switch request with source and target box IDs.
     * @return The new [QueueEntryDto] in the target box queue.
     */
    public suspend fun switchBox(request: SwitchBoxRequest): QueueEntryDto {
        TODO("T107: implement Ktor Client POST to ${DrawEndpoints.QUEUE_SWITCH_BOX}")
    }
}
