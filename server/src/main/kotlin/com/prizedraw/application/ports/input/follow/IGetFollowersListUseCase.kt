package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowListResponse
import java.util.UUID

/**
 * Input port for retrieving the paginated list of players that follow a given player.
 */
public interface IGetFollowersListUseCase {
    /**
     * Returns the paginated followers list for [playerId].
     *
     * Each item's [com.prizedraw.contracts.dto.follow.FollowPlayerDto.isFollowing] flag indicates
     * whether [playerId] follows that follower back.
     *
     * @param playerId The player whose followers are requested.
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
