package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.BuybackRecord
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import java.util.UUID

/**
 * Output port for persisting and querying [BuybackRecord] entities.
 *
 * [BuybackRecord] is INSERT-only; no update or delete operations are exposed.
 */
public interface IBuybackRepository {
    /**
     * Finds a [BuybackRecord] by its surrogate primary key.
     *
     * @param id The buyback record identifier.
     * @return The matching [BuybackRecord], or null if not found.
     */
    public suspend fun findById(id: UUID): BuybackRecord?

    /**
     * Finds the buyback record for a specific prize instance, if one exists.
     *
     * A prize instance can only be bought back once (unique constraint on [prizeInstanceId]).
     *
     * @param prizeInstanceId The prize instance to query.
     * @return The buyback record, or null if this prize has not been bought back.
     */
    public suspend fun findByPrizeInstance(prizeInstanceId: PrizeInstanceId): BuybackRecord?

    /**
     * Returns all buyback records for the given player, ordered by [BuybackRecord.processedAt] descending.
     *
     * @param playerId The player's identifier.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of buyback records for this player.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<BuybackRecord>

    /**
     * Returns all buyback records for the given prize definition (for analytics).
     *
     * @param definitionId The prize definition identifier.
     * @return All buyback records for this definition.
     */
    public suspend fun findByDefinition(definitionId: PrizeDefinitionId): List<BuybackRecord>

    /**
     * Inserts a new [BuybackRecord]. This operation is INSERT-only.
     *
     * @param record The buyback record to insert.
     * @return The inserted record.
     */
    public suspend fun save(record: BuybackRecord): BuybackRecord
}
