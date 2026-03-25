package com.prizedraw.infrastructure.external.redis

import io.lettuce.core.SetArgs
import kotlinx.coroutines.future.await
import org.slf4j.LoggerFactory

/**
 * Generic Redis-backed caching service for hot read paths.
 *
 * Wraps the shared [RedisClient] pool and provides:
 * - [getOrSet]: Cache-aside pattern with configurable TTL and a suspending loader.
 * - [invalidate]: Point invalidation by exact key.
 * - [invalidatePattern]: Bulk invalidation by glob pattern (uses SCAN to avoid KEYS).
 *
 * All serialisation is the caller's responsibility — store JSON strings or simple
 * primitives. Callers should use `kotlinx.serialization.json.Json` to encode/decode
 * before passing values to this service.
 *
 * Cached domains (suggested TTLs):
 * - Active kuji campaigns list: 30 seconds
 * - Active unlimited campaigns list: 30 seconds
 * - Prize definitions per campaign: 60 seconds
 * - Feature flags: 30 seconds
 * - Leaderboard snapshots: 5 minutes (300 seconds)
 *
 * Cache key naming convention: `{domain}:{qualifier}`, e.g.:
 * - `campaigns:kuji:active`
 * - `campaigns:unlimited:active`
 * - `prize_defs:{campaignId}`
 * - `feature_flags:all`
 * - `leaderboard:{type}:{period}`
 */
public class CacheService(
    private val redisClient: RedisClient,
) {
    private val log = LoggerFactory.getLogger(CacheService::class.java)

    /**
     * Returns the cached value for [key] if present; otherwise invokes [loader],
     * stores the result with the given [ttlSeconds] TTL, and returns it.
     *
     * A `null` return from [loader] is not cached, allowing the caller to distinguish
     * between "empty result" and "not found".
     *
     * @param key        Redis key, e.g. `"campaigns:kuji:active"`.
     * @param ttlSeconds Time-to-live in seconds. Must be > 0.
     * @param loader     Suspending function that produces the value on a cache miss.
     * @return The cached or freshly computed string value, or `null` if
     *                   [loader] returned `null`.
     */
    public suspend fun getOrSet(
        key: String,
        ttlSeconds: Long,
        loader: suspend () -> String?,
    ): String? {
        require(ttlSeconds > 0) { "TTL must be positive" }

        // Fast path: try cache first
        val cached = get(key)
        if (cached != null) {
            log.debug("Cache hit: {}", key)
            return cached
        }

        log.debug("Cache miss: {}", key)
        val value = loader() ?: return null

        set(key, value, ttlSeconds)
        return value
    }

    /**
     * Retrieves the value stored at [key], or `null` if absent or expired.
     */
    public suspend fun get(key: String): String? =
        runCatching {
            redisClient.withConnection { commands ->
                commands.get(key).await()
            }
        }.getOrElse { ex ->
            log.warn("Redis GET failed for key '{}': {}", key, ex.message)
            null
        }

    /**
     * Stores [value] at [key] with an expiry of [ttlSeconds] seconds.
     */
    public suspend fun set(
        key: String,
        value: String,
        ttlSeconds: Long,
    ) {
        runCatching {
            redisClient.withConnection { commands ->
                val args = SetArgs().ex(ttlSeconds)
                commands.set(key, value, args).await()
            }
        }.onFailure { ex ->
            log.warn("Redis SET failed for key '{}': {}", key, ex.message)
        }
    }

    /**
     * Removes the cache entry for the given exact [key].
     *
     * Safe to call even when the key does not exist (no-op).
     */
    public suspend fun invalidate(key: String) {
        runCatching {
            redisClient.withConnection { commands ->
                commands.del(key).await()
            }
            log.debug("Cache invalidated: {}", key)
        }.onFailure { ex ->
            log.warn("Redis DEL failed for key '{}': {}", key, ex.message)
        }
    }

    /**
     * Removes all cache entries whose keys match the Redis glob [pattern].
     *
     * Uses an iterative SCAN cursor rather than KEYS to avoid blocking Redis.
     * The scan batch size is 100; large key spaces may require multiple round trips.
     *
     * Example patterns:
     * - `"campaigns:*"` — invalidate all campaign caches
     * - `"leaderboard:DRAW_COUNT:*"` — invalidate all periods of a leaderboard type
     * - `"feature_flags:*"` — invalidate all feature flag caches
     *
     * @param pattern Redis glob pattern, e.g. `"campaigns:kuji:*"`.
     */
    public suspend fun invalidatePattern(pattern: String) {
        runCatching {
            var cursor = "0"
            var totalDeleted = 0L

            do {
                val scanResult =
                    redisClient.withConnection { commands ->
                        val scanArgs =
                            io.lettuce.core.ScanArgs
                                .Builder
                                .matches(pattern)
                                .limit(SCAN_BATCH_SIZE)
                        commands
                            .scan(
                                io.lettuce.core.ScanCursor
                                    .of(cursor),
                                scanArgs
                            ).await()
                    }

                cursor = scanResult.cursor
                val keys = scanResult.keys

                if (keys.isNotEmpty()) {
                    @Suppress("SpreadOperator")
                    val deleted =
                        redisClient.withConnection { commands ->
                            // Lettuce DEL only accepts vararg — spread is unavoidable here
                            commands.del(*keys.toTypedArray()).await()
                        }
                    totalDeleted += deleted
                }
            } while (!scanResult.isFinished)

            log.debug("Cache invalidated {} keys matching pattern '{}'", totalDeleted, pattern)
        }.onFailure { ex ->
            log.warn("Redis SCAN/DEL failed for pattern '{}': {}", pattern, ex.message)
        }
    }

    /**
     * Increments a counter at [key] and sets an expiry if the key did not exist.
     *
     * Used for rate-limiting counters that must expire automatically.
     *
     * @param key        Redis key.
     * @param ttlSeconds TTL to apply only when creating the key (SETNX semantics).
     * @return The new counter value after increment.
     */
    public suspend fun incrementWithExpiry(
        key: String,
        ttlSeconds: Long,
    ): Long =
        runCatching {
            redisClient.withConnection { commands ->
                val count = commands.incr(key).await()
                // Only set TTL on first creation to avoid resetting the window
                if (count == 1L) {
                    commands.expire(key, ttlSeconds).await()
                }
                count
            }
        }.getOrElse { ex ->
            log.warn("Redis INCR failed for key '{}': {}", key, ex.message)
            0L
        }

    /**
     * Stores a member+score in a Redis sorted set (used for leaderboard snapshots).
     *
     * @param key    The sorted set key.
     * @param member Member identifier (e.g. player ID).
     * @param score  Numeric score (e.g. draw count).
     */
    public suspend fun zAdd(
        key: String,
        member: String,
        score: Double,
    ) {
        runCatching {
            redisClient.withConnection { commands ->
                commands.zadd(key, score, member).await()
            }
        }.onFailure { ex ->
            log.warn("Redis ZADD failed for key '{}': {}", key, ex.message)
        }
    }

    /**
     * Retrieves the top [limit] members from a sorted set in descending score order.
     *
     * @param key   The sorted set key.
     * @param limit Maximum number of entries to return.
     * @return List of (member, score) pairs, highest score first.
     */
    public suspend fun zTopN(
        key: String,
        limit: Long,
    ): List<Pair<String, Double>> =
        runCatching {
            redisClient.withConnection { commands ->
                commands
                    .zrevrangeWithScores(key, 0, limit - 1)
                    .await()
                    .map { it.value to it.score }
            }
        }.getOrElse { ex ->
            log.warn("Redis ZREVRANGE failed for key '{}': {}", key, ex.message)
            emptyList()
        }

    /**
     * Returns the rank of [member] in the sorted set at [key] (0-indexed, descending).
     *
     * @return The 0-based rank, or `null` if the member is not in the set.
     */
    public suspend fun zRankDescending(
        key: String,
        member: String,
    ): Long? =
        runCatching {
            redisClient.withConnection { commands ->
                commands.zrevrank(key, member).await()
            }
        }.getOrElse { ex ->
            log.warn("Redis ZREVRANK failed for key '{}': {}", key, ex.message)
            null
        }

    private companion object {
        const val SCAN_BATCH_SIZE = 100L
    }
}
