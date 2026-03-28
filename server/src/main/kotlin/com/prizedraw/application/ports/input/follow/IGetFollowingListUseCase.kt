package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowListResponse
import java.util.UUID

/**
 * Input port for retrieving the paginated list of players that a given player follows.
 */
public interface IGetFollowingListUseCase {
    /**
     * Returns the paginated following list for [playerId].
     *
     * @param playerId The player whose following list is requested.
     * @param limit Maximum number of items to return.
     * @param offset Zero-based record offset for pagination.
     * @return A [FollowListResponse] containing the matching player summaries.
     */
    public suspend fun execute(
        playerId: UUID,
        limit: Int,
        offset: Int,
    ): FollowListResponse
}
