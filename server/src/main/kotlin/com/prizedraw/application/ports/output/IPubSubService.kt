package com.prizedraw.application.ports.output

import kotlinx.coroutines.flow.Flow

/**
 * Output port for Redis pub/sub message publishing and subscription.
 *
 * Abstracts the underlying pub/sub transport so that application-layer services
 * (e.g. [com.prizedraw.application.services.FeedService]) can be tested without
 * a real Redis connection.
 */
public interface IPubSubService {
    /**
     * Publishes [message] to the given [channel].
     *
     * @param channel The pub/sub channel name, e.g. `feed:draws`.
     * @param message The message payload (typically a JSON string).
     */
    public suspend fun publish(
        channel: String,
        message: String,
    )

    /**
     * Returns a [Flow] that emits messages published to [channel].
     *
     * The flow is cold and backed by a buffered channel. Cancelling the flow
     * collector (e.g. when a WebSocket disconnects) releases the underlying
     * listener from the pub/sub bus.
     *
     * @param channel The pub/sub channel to subscribe to, e.g. `feed:draws`.
     * @return A [Flow] of message payloads received on the channel.
     */
    public fun subscribe(channel: String): Flow<String>
}
