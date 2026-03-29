package com.prizedraw.draw.infrastructure.redis

import com.prizedraw.draw.application.ports.output.IDistributedLockService
import io.lettuce.core.ScriptOutputType
import io.lettuce.core.SetArgs
import kotlinx.coroutines.future.await
import java.util.UUID

/**
 * Redis-backed distributed lock using the SET NX EX pattern.
 *
 * Acquiring the lock uses `SET key token NX EX ttl`, which atomically sets the key
 * only if it does not already exist. The [lockToken] is a random UUID tied to the
 * current holder; only the holder can release via the Lua unlock script, preventing
 * accidental release of another holder's lock.
 *
 * The Lua unlock script performs an atomic compare-and-delete:
 * ```lua
 * if redis.call("get", KEYS[1]) == ARGV[1] then
 *     return redis.call("del", KEYS[1])
 * else
 *     return 0
 * end
 * ```
 */
public class DistributedLock(
    private val redisClient: RedisClient,
) : IDistributedLockService {
    /**
     * Attempts to acquire the lock identified by [key].
     *
     * @param key The Redis key to use as the lock identifier.
     * @param ttlSeconds How long the lock is held if not explicitly released.
     * @return A [LockHandle] if the lock was acquired, null otherwise.
     */
    public suspend fun tryAcquire(
        key: String,
        ttlSeconds: Long = 30,
    ): LockHandle? {
        val token = UUID.randomUUID().toString()
        val acquired =
            redisClient.withConnection { commands ->
                val args = SetArgs.Builder.nx().ex(ttlSeconds)
                commands.set(key, token, args).await()
            }
        return if (acquired == "OK") {
            LockHandle(key, token)
        } else {
            null
        }
    }

    /**
     * Releases the lock held by [handle] using the atomic Lua unlock script.
     *
     * No-op if the lock was already released or expired.
     */
    public suspend fun release(handle: LockHandle) {
        redisClient.withConnection { commands ->
            commands
                .eval<Long>(
                    UNLOCK_SCRIPT,
                    ScriptOutputType.INTEGER,
                    arrayOf(handle.key),
                    handle.token,
                ).await()
        }
    }

    /**
     * Executes [block] while holding the distributed lock on [key].
     *
     * @param key The lock key.
     * @param ttlSeconds Lock TTL in seconds.
     * @param block The code to execute while holding the lock.
     * @return The result of [block], or null if the lock could not be acquired.
     */
    public override suspend fun <T> withLock(
        key: String,
        ttlSeconds: Long,
        block: suspend () -> T,
    ): T? {
        val handle = tryAcquire(key, ttlSeconds) ?: return null
        return try {
            block()
        } finally {
            release(handle)
        }
    }

    /** An opaque handle to a held distributed lock. */
    public data class LockHandle(
        val key: String,
        val token: String,
    )

    private companion object {
        const val UNLOCK_SCRIPT = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        """
    }
}
