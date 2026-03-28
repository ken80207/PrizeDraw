package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.FeedEvent

/**
 * Output port for persisting and querying [FeedEvent] records.
 *
 * Both KUJI and UNLIMITED draw types write through this port immediately after a draw
 * completes, storing all display data in a single denormalised row. The REST live-feed
 * endpoint reads from here to avoid the N+1 query pattern.
 */
public interface IFeedEventRepository {
    /**
     * Persists a single [FeedEvent] row.
     *
     * @param event The denormalised draw result to store.
     */
    public suspend fun save(event: FeedEvent)

    /**
     * Returns the most recent draw events, ordered by [FeedEvent.drawnAt] descending.
     *
     * @param limit Maximum number of records to return.
     * @return Ordered list of [FeedEvent] entries, newest first.
     */
    public suspend fun findRecent(limit: Int): List<FeedEvent>
}
