package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.ServerAnnouncement
import java.util.UUID

/**
 * Output port for reading and persisting [ServerAnnouncement] entities.
 *
 * Implementations are responsible for filtering by platform and schedule when
 * surfacing announcements for the public status endpoint.
 */
public interface IServerAnnouncementRepository {
    /**
     * Returns all currently active announcements whose scheduled window includes [now].
     *
     * An announcement is considered active when:
     * - [ServerAnnouncement.isActive] is `true`.
     * - [ServerAnnouncement.scheduledStart] is null or in the past.
     * - [ServerAnnouncement.scheduledEnd] is null or in the future.
     *
     * Results are ordered by creation date descending (newest first).
     *
     * @return List of active [ServerAnnouncement] records.
     */
    public suspend fun findAllActive(): List<ServerAnnouncement>

    /**
     * Returns every announcement (active and inactive) for the admin management view.
     *
     * @return All [ServerAnnouncement] records, newest first.
     */
    public suspend fun findAll(): List<ServerAnnouncement>

    /**
     * Finds a single announcement by its primary key.
     *
     * @param id The UUID of the announcement to look up.
     * @return The matching [ServerAnnouncement], or null if not found.
     */
    public suspend fun findById(id: UUID): ServerAnnouncement?

    /**
     * Persists an announcement (insert or update).
     *
     * @param announcement The entity to persist.
     * @return The saved [ServerAnnouncement] as read back from the database.
     */
    public suspend fun save(announcement: ServerAnnouncement): ServerAnnouncement

    /**
     * Marks an announcement as inactive (soft-delete equivalent).
     *
     * @param id The UUID of the announcement to deactivate.
     * @return The updated [ServerAnnouncement], or null if not found.
     */
    public suspend fun deactivate(id: UUID): ServerAnnouncement?
}
