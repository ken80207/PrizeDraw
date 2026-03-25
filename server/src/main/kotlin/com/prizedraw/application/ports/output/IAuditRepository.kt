package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Output port for recording and querying [AuditLog] entries.
 *
 * [AuditLog] is append-only; no update or delete operations are exposed.
 * The [record] operation is synchronous to ensure the log entry is written within
 * the same transaction as the action it describes.
 */
public interface IAuditRepository {
    /**
     * Inserts a new [AuditLog] entry.
     *
     * Must be called within the same database transaction as the business operation
     * being audited where consistency is required. Implementations must not throw on
     * idempotent duplicate inserts.
     *
     * @param log The audit log entry to record.
     */
    public fun record(log: AuditLog)

    /**
     * Returns audit log entries for a specific actor (player), ordered by time descending.
     *
     * @param actorPlayerId The player's identifier.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of audit log entries for this player.
     */
    public suspend fun findByActorPlayer(
        actorPlayerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<AuditLog>

    /**
     * Returns audit log entries for a specific target entity, ordered by time descending.
     *
     * @param entityType The entity type name, e.g. `KujiCampaign`.
     * @param entityId The entity's primary key.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of audit log entries targeting this entity.
     */
    public suspend fun findByEntity(
        entityType: String,
        entityId: UUID,
        offset: Int,
        limit: Int,
    ): List<AuditLog>

    /**
     * Returns audit log entries matching the given optional filters, ordered by time descending.
     *
     * All parameters are optional — passing null skips that filter.
     *
     * @param actorStaffId When non-null, restricts to entries by this staff actor.
     * @param actorPlayerId When non-null, restricts to entries by this player actor.
     * @param entityType When non-null, restricts to entries targeting this entity type.
     * @param action When non-null, restricts to entries with this action string (prefix match).
     * @param from When non-null, restricts to entries at or after this instant.
     * @param until When non-null, restricts to entries at or before this instant.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A filtered, paginated list of audit log entries.
     */
    public suspend fun findFiltered(
        actorStaffId: UUID? = null,
        actorPlayerId: UUID? = null,
        entityType: String? = null,
        action: String? = null,
        from: Instant? = null,
        until: Instant? = null,
        offset: Int = 0,
        limit: Int = 50,
    ): List<AuditLog>
}
