package com.prizedraw.notification.ports

import kotlinx.coroutines.flow.Flow

/**
 * Output port for pub/sub messaging.
 *
 * Abstracts Redis pub/sub so that worker-layer services depend on this port
 * rather than the infrastructure adapter directly, enabling testing without Redis.
 */
public interface IPubSubService {
    /**
     * Publishes [message] to the given [channel].
     *
     * @param channel The channel name, e.g. `ws:player:uuid`.
     * @param message The message payload (typically a JSON string).
     */
    public suspend fun publish(
        channel: String,
        message: String,
    )

    /**
     * Returns a [Flow] that emits messages published to [channel].
     *
     * @param channel The channel to subscribe to.
     */
    public fun subscribe(channel: String): Flow<String>
}
