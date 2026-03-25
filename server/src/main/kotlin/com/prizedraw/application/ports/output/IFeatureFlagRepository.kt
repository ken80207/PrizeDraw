package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.FeatureFlag

/**
 * Evaluation context provided to [IFeatureFlagRepository.isEnabled] for targeting rules.
 *
 * @property playerId The player identifier for percentage rollout and group targeting.
 * @property platform The client platform requesting the flag value (`android`, `ios`, `web`).
 * @property groups The player's segment group memberships (e.g. `vip`, `tester`).
 */
public data class FeatureFlagContext(
    val playerId: String? = null,
    val platform: String? = null,
    val groups: Set<String> = emptySet(),
)

/**
 * Output port for reading and persisting [FeatureFlag] entities.
 *
 * The [isEnabled] query is synchronous because it is on the hot path of every request
 * and must be backed by an in-memory cache (e.g. Redis or local JVM cache). Cache
 * invalidation on flag changes is the implementation's responsibility.
 */
public interface IFeatureFlagRepository {
    /**
     * Evaluates whether the named feature is enabled for the given [context].
     *
     * Evaluation follows the priority order:
     * 1. Global master switch ([FeatureFlag.enabled]).
     * 2. Platform targeting rules.
     * 3. Group targeting rules.
     * 4. Percentage rollout (stable hash on [FeatureFlagContext.playerId]).
     *
     * @param key The [FeatureFlag.name] to evaluate.
     * @param context Targeting context for the current request.
     * @return True if the feature is enabled for this context, false otherwise.
     */
    public fun isEnabled(
        key: String,
        context: FeatureFlagContext = FeatureFlagContext(),
    ): Boolean

    /**
     * Finds a [FeatureFlag] by its stable name key.
     *
     * @param name The [FeatureFlag.name] to look up.
     * @return The matching [FeatureFlag], or null if not found.
     */
    public suspend fun findByName(name: String): FeatureFlag?

    /**
     * Returns all feature flags.
     *
     * @return List of all feature flags in the system.
     */
    public suspend fun findAll(): List<FeatureFlag>

    /**
     * Persists a [FeatureFlag] entity (insert or update).
     *
     * @param flag The feature flag to persist.
     * @return The persisted flag.
     */
    public suspend fun save(flag: FeatureFlag): FeatureFlag

    /**
     * Pre-warms the in-memory flag cache by loading all flags from the database.
     *
     * Should be called once at application startup (W-4). Until this completes, any flag
     * not yet in the cache falls through to the DB on the first [isEnabled] call.
     */
    public suspend fun warmCache()
}
