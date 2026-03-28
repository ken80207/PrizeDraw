package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IBatchFollowStatusUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

/**
 * Resolves follow status for a list of target players in a single repository call.
 *
 * Designed for screens that render follow buttons for multiple players simultaneously,
 * avoiding N+1 queries.
 */
public class BatchFollowStatusUseCase(
    private val followRepository: IFollowRepository,
) : IBatchFollowStatusUseCase {
    override suspend fun execute(
        followerId: UUID,
        targetPlayerIds: List<UUID>,
    ): Map<UUID, Boolean> {
        val followedSet = followRepository.existsBatch(followerId, targetPlayerIds)
        return targetPlayerIds.associateWith { it in followedSet }
    }
}
