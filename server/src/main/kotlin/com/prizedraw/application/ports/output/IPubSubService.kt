package com.prizedraw.application.ports.output

/**
 * Output port for Redis pub/sub message publishing.
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
}
