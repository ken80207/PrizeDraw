package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.CampaignId
import java.util.UUID

/**
 * Output port for persisting and querying [TicketBox] entities.
 *
 * [TicketBox.remainingTickets] is a hot column updated on every draw. The [decrementRemainingTickets]
 * operation uses an optimistic-concurrency check ([expectedRemaining]) to prevent lost updates
 * when multiple draws race on the same box.
 */
public interface ITicketBoxRepository {
    /**
     * Finds a [TicketBox] by its surrogate primary key.
     *
     * @param id The ticket box identifier.
     * @return The matching [TicketBox], or null if not found.
     */
    public suspend fun findById(id: UUID): TicketBox?

    /**
     * Returns all [TicketBox]es belonging to the given campaign.
     *
     * Results are ordered by [TicketBox.displayOrder] ascending.
     *
     * @param campaignId The parent campaign identifier.
     * @return Ordered list of ticket boxes for the campaign.
     */
    public suspend fun findByCampaignId(campaignId: CampaignId): List<TicketBox>

    /**
     * Atomically decrements [TicketBox.remainingTickets] by 1.
     *
     * The UPDATE is conditional on `remaining_tickets = expectedRemaining` to detect
     * concurrent draws. Returns false when the condition fails (another draw won the race
     * or the box is already sold out).
     *
     * @param id The ticket box to decrement.
     * @param expectedRemaining The [TicketBox.remainingTickets] value the caller observed.
     * @return True if the decrement was applied, false if the check failed.
     */
    public suspend fun decrementRemainingTickets(
        id: UUID,
        expectedRemaining: Int,
    ): Boolean

    /**
     * Persists a [TicketBox] entity (insert or update).
     *
     * @param box The ticket box to persist.
     * @return The persisted ticket box.
     */
    public suspend fun save(box: TicketBox): TicketBox
}
