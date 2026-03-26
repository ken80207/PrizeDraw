package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.TierConfig

/**
 * Output port for reading [TierConfig] records from persistent storage.
 *
 * Tier configs are treated as quasi-static reference data (admin-configurable but rarely
 * mutated in production). Implementations may apply a short-lived cache layer.
 */
public interface ITierConfigRepository {
    /**
     * Returns all tier configurations ordered by [TierConfig.sortOrder] ascending.
     *
     * @return The full ordered list of tiers.
     */
    public suspend fun findAll(): List<TierConfig>

    /**
     * Finds a single tier configuration by its unique [tier] identifier.
     *
     * @param tier The tier key, e.g. `BRONZE`, `GOLD`.
     * @return The matching [TierConfig], or null if no such tier exists.
     */
    public suspend fun findByTier(tier: String): TierConfig?
}
