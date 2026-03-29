package com.prizedraw.notification.infrastructure.external.redis

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
 * is returned.
 *
 * The pool is created lazily at first use and must be closed on shutdown via [close].
 * Connections are borrowed via [withConnection] and automatically returned to the pool.
 *
 * @param config Redis connection configuration.
 */
public class RedisClient(
    private val config: RedisConfig,
) {
    /**
     * Redis connection configuration.
     *
     * @property host Redis hostname.
     * @property port Redis port.
     * @property password Optional Redis password.
     * @property database Redis logical database index.
     * @property maxPoolSize Maximum number of pooled connections.
     * @property minIdle Minimum number of idle connections pre-created at startup.
     */
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

    private suspend fun borrowConnection(): StatefulRedisConnection<String, String> {
        pool.tryReceive().getOrNull()?.let { return it }

        if (totalConnections.get() < config.maxPoolSize) {
            val acquired = totalConnections.incrementAndGet()
            if (acquired <= config.maxPoolSize) {
                return lettuceClient.connect()
            }
            totalConnections.decrementAndGet()
        }

        return pool.receive()
    }

    private fun returnConnection(connection: StatefulRedisConnection<String, String>) {
        if (!pool.trySend(connection).isSuccess) {
            totalConnections.decrementAndGet()
            connection.close()
        }
    }

    /**
     * Executes [block] with a pooled Redis async commands instance.
     *
     * @param block Suspending function receiving the async commands interface.
     * @return The result of [block].
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
