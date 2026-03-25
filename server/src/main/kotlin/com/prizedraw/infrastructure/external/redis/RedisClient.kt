package com.prizedraw.infrastructure.external.redis

import io.lettuce.core.RedisURI
import io.lettuce.core.api.StatefulRedisConnection
import io.lettuce.core.api.async.RedisAsyncCommands
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicInteger
import io.lettuce.core.RedisClient as LettuceRedisClient

/**
 * Lettuce-based Redis connection pool configured from [RedisConfig].
 *
 * Uses a [Channel] as a bounded pool of [StatefulRedisConnection] instances.
 * An [AtomicInteger] tracks total live connections (pooled + borrowed). When the total
 * reaches [RedisConfig.maxPoolSize] no new connections are opened — the caller instead
 * receives a connection from the pool via [Channel.receive], which suspends until one
 * is returned (W-5 fix).
 *
 * The pool is created lazily at first use and must be closed on shutdown via [close].
 * Connections are borrowed via [withConnection] and automatically returned to the pool.
 */
public class RedisClient(
    private val config: RedisConfig,
) {
    public data class RedisConfig(
        val host: String = "localhost",
        val port: Int = 6379,
        val password: String? = null,
        val database: Int = 0,
        val maxPoolSize: Int = 20,
        val minIdle: Int = 2,
    )

    private val lettuceClient: LettuceRedisClient by lazy {
        val uriBuilder =
            RedisURI
                .builder()
                .withHost(config.host)
                .withPort(config.port)
                .withDatabase(config.database)
        if (!config.password.isNullOrBlank()) {
            uriBuilder.withPassword(config.password.toCharArray())
        }
        LettuceRedisClient.create(uriBuilder.build())
    }

    /** Tracks the total number of live connections (in the pool + currently borrowed). */
    private val totalConnections = AtomicInteger(0)

    private val pool: Channel<StatefulRedisConnection<String, String>> by lazy {
        val channel = Channel<StatefulRedisConnection<String, String>>(config.maxPoolSize)
        repeat(config.minIdle) {
            val conn = lettuceClient.connect()
            totalConnections.incrementAndGet()
            runBlocking { channel.send(conn) }
        }
        channel
    }

    /**
     * Borrows a connection from the pool.
     *
     * If the pool has an idle connection it is returned immediately. Otherwise, if the
     * total connection count is below [RedisConfig.maxPoolSize], a new connection is
     * opened. If the cap has already been reached the call suspends until a connection
     * is returned by a concurrent [withConnection] call.
     */
    private suspend fun borrowConnection(): StatefulRedisConnection<String, String> {
        // Fast path: try to grab an idle connection without suspending
        pool.tryReceive().getOrNull()?.let { return it }

        // Open a new connection if we have not yet reached the cap
        if (totalConnections.get() < config.maxPoolSize) {
            val acquired = totalConnections.incrementAndGet()
            if (acquired <= config.maxPoolSize) {
                return lettuceClient.connect()
            }
            // Race condition — another coroutine beat us to the last slot; roll back and wait
            totalConnections.decrementAndGet()
        }

        // Pool is at capacity — suspend until a connection is returned
        return pool.receive()
    }

    private fun returnConnection(connection: StatefulRedisConnection<String, String>) {
        if (!pool.trySend(connection).isSuccess) {
            // Pool channel is full (should not happen under normal use); close the connection
            totalConnections.decrementAndGet()
            connection.close()
        }
    }

    /**
     * Executes [block] with a pooled Redis async commands instance.
     */
    public suspend fun <T> withConnection(block: suspend (RedisAsyncCommands<String, String>) -> T): T {
        val connection = borrowConnection()
        return try {
            block(connection.async())
        } finally {
            returnConnection(connection)
        }
    }

    /** Closes all pooled connections and shuts down the underlying Lettuce client. */
    public fun close() {
        pool.close()
        var conn = pool.tryReceive().getOrNull()
        while (conn != null) {
            conn.close()
            conn = pool.tryReceive().getOrNull()
        }
        lettuceClient.shutdown()
    }
}
