package com.prizedraw.application.ports.input.follow

import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import java.util.UUID

/**
 * Input port for finding a player by their unique player code.
 *
 * The result includes whether the requesting player already follows the found player.
 */
public interface ISearchPlayerByCodeUseCase {
    /**
     * Searches for a player by [code] (case-insensitive).
     *
     * @param requesterId The player performing the search; used to populate [FollowPlayerDto.isFollowing].
     * @param code The player code to look up (will be upper-cased before querying).
     * @return A [FollowPlayerDto] if a matching player exists, or null if not found.
     */
    public suspend fun execute(
        requesterId: UUID,
        code: String,
    ): FollowPlayerDto?
}
