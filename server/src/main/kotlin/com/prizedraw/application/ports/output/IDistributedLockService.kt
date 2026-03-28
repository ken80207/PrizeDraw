package com.prizedraw.application.ports.output

/**
 * Output port for distributed locking.
 *
 * Abstracts the Redis SET NX EX distributed lock so that application-layer services
 * depend on this port rather than the infrastructure adapter directly.
 */
public interface IDistributedLockService {
    /**
     * Executes [block] while holding a distributed lock on [key].
     *
     * @param key The lock key (unique per resource being locked).
     * @param ttlSeconds Lock TTL in seconds.
     * @param block The code to execute while holding the lock.
     * @return The result of [block], or null if the lock could not be acquired.
     */
    public suspend fun <T> withLock(
        key: String,
        ttlSeconds: Long = 30,
        block: suspend () -> T,
    ): T?
}
