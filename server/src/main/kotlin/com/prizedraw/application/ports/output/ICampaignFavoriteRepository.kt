package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.CampaignFavorite
import com.prizedraw.domain.valueobjects.CampaignId
import java.util.UUID

/**
 * Output port for persisting and querying player campaign favorites (wishlist).
 *
 * Favorites use a composite primary key (player_id, campaign_type, campaign_id), so all
 * write operations are naturally idempotent. Reads support paginated listing and efficient
 * batch-lookup for decorating campaign list responses with favorited state.
 */
public interface ICampaignFavoriteRepository {
    /**
     * Persists a [CampaignFavorite].
     *
     * Uses INSERT IGNORE (or equivalent) semantics so calling this method when the
     * favorite already exists is a no-op rather than an error.
     *
     * @param favorite The favorite entry to persist.
     */
    public suspend fun save(favorite: CampaignFavorite)

    /**
     * Removes a favorite entry identified by its composite key.
     *
     * Does nothing if the entry does not exist.
     *
     * @param playerId The player's UUID.
     * @param campaignType The campaign variant discriminator.
     * @param campaignId The campaign's UUID.
     */
    public suspend fun delete(
        playerId: UUID,
        campaignType: CampaignType,
        campaignId: UUID,
    )

    /**
     * Returns a paginated list of favorites for a player, ordered by [CampaignFavorite.createdAt] descending.
     *
     * @param playerId The player's UUID.
     * @param campaignType When non-null, restricts results to this campaign type.
     * @param limit Maximum number of entries to return.
     * @param offset Number of entries to skip.
     * @return List of matching [CampaignFavorite] entries.
     */
    public suspend fun findByPlayerId(
        playerId: UUID,
        campaignType: CampaignType? = null,
        limit: Int = 20,
        offset: Int = 0,
    ): List<CampaignFavorite>

    /**
     * Returns the total count of favorites for a player.
     *
     * @param playerId The player's UUID.
     * @param campaignType When non-null, restricts count to this campaign type.
     * @return Total number of matching favorite entries.
     */
    public suspend fun countByPlayerId(
        playerId: UUID,
        campaignType: CampaignType? = null,
    ): Int

    /**
     * Returns the player UUIDs who have favorited a specific campaign.
     *
     * Used to fan out low-stock push notifications to interested players.
     *
     * @param campaignType The campaign variant discriminator.
     * @param campaignId The campaign's strongly-typed identifier.
     * @return List of player UUIDs.
     */
    public suspend fun findPlayerIdsByCampaign(
        campaignType: CampaignType,
        campaignId: CampaignId,
    ): List<UUID>

    /**
     * Returns whether a specific campaign is in a player's favorites.
     *
     * @param playerId The player's UUID.
     * @param campaignType The campaign variant discriminator.
     * @param campaignId The campaign's UUID.
     * @return `true` if the favorite entry exists, `false` otherwise.
     */
    public suspend fun isFavorited(
        playerId: UUID,
        campaignType: CampaignType,
        campaignId: UUID,
    ): Boolean

    /**
     * Batch-checks which campaign UUIDs from [campaignIds] are in the player's favorites.
     *
     * Used to decorate campaign list responses with per-item favorited state efficiently
     * in a single query rather than N individual lookups.
     *
     * @param playerId The player's UUID.
     * @param campaignType The campaign variant discriminator.
     * @param campaignIds The candidate campaign UUIDs to check.
     * @return The subset of [campaignIds] that are favorited by the player.
     */
    public suspend fun findFavoritedCampaignIds(
        playerId: UUID,
        campaignType: CampaignType,
        campaignIds: List<UUID>,
    ): Set<UUID>
}
