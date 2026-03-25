package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.BroadcastSession
import java.util.UUID

/**
 * Persistence port for [BroadcastSession].
 */
public interface IBroadcastRepository {
    /**
     * Persists a new or updated [BroadcastSession].
     *
     * @param session The session to save.
     * @return The saved session.
     */
    public suspend fun save(session: BroadcastSession): BroadcastSession

    /**
     * Returns the active broadcast session for [playerId], or `null` if none exists.
     *
     * @param playerId The broadcasting player.
     * @return Active session or `null`.
     */
    public suspend fun findActiveByPlayer(playerId: UUID): BroadcastSession?

    /**
     * Returns all active broadcast sessions for a campaign.
     *
     * @param campaignId The campaign to query.
     * @return List of active sessions, possibly empty.
     */
    public suspend fun findActiveByCampaign(campaignId: UUID): List<BroadcastSession>

    /**
     * Marks a session as inactive and records the end time.
     *
     * @param sessionId The session to end.
     */
    public suspend fun endSession(sessionId: UUID)

    /**
     * Updates the viewer count for a session.
     *
     * @param sessionId The session to update.
     * @param count The new viewer count.
     */
    public suspend fun updateViewerCount(
        sessionId: UUID,
        count: Int,
    )
}
