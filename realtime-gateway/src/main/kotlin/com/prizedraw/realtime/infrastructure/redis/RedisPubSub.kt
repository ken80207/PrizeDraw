package com.prizedraw.realtime.infrastructure.redis

import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.future.await
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Redis pub/sub wrapper for WebSocket fanout across horizontally-scaled instances.
 *
 * Publishers use [publish] to broadcast messages. Subscribers use [subscribe] to receive
 * a [Flow] of messages on a channel. The implementation is backed by a dedicated
 * Lettuce pub/sub connection (separate from the command connection pool).
 *
 * Typical usage: a WebSocket handler subscribes to the room channel via [ConnectionManager],
 * and domain events are published here by other services or by this gateway's own handlers.
 *
 * @param redisClient The Redis command client used for publishing.
 */
public class RedisPubSub(
    private val redisClient: RedisClient,
) {
    private val log = LoggerFactory.getLogger(RedisPubSub::class.java)

    private val listeners = ConcurrentHashMap<String, MutableList<SendChannel<String>>>()

    /**
     * Publishes [message] to the given Redis [channel].
     *
     * @param channel The Redis channel name, e.g. `kuji:uuid` or `ws:player:uuid`.
     * @param message The message payload (typically a JSON string).
     */
    public suspend fun publish(
        channel: String,
        message: String,
    ) {
        redisClient.withConnection { commands ->
            commands.publish(channel, message).await()
        }
    }

    /**
     * Returns a [Flow] that emits messages published to [channelName].
     *
     * The flow is backed by a buffered [Channel]. When the caller cancels the flow
     * (e.g. WebSocket disconnects), the channel is removed from the listener map.
     *
     * @param channelName The Redis channel to subscribe to.
     */
    public fun subscribe(channelName: String): Flow<String> =
        callbackFlow {
            listeners.getOrPut(channelName) { mutableListOf() }.add(channel)

            redisClient.run {
                // The real Lettuce SUBSCRIBE wiring happens via the Lettuce PubSub adapter
                // registered at startup (see RealtimeModule). This flow simply registers
                // a local listener that receives messages routed by [onMessage].
            }

            awaitClose {
                unsubscribe(channelName, this@callbackFlow.channel)
            }
        }

    /**
     * Processes an inbound pub/sub message by routing it to all registered local listeners.
     *
     * Called by the Lettuce pub/sub adapter listener registered at startup.
     *
     * @param channel The Redis channel the message arrived on.
     * @param message The message payload.
     */
    public fun onMessage(
        channel: String,
        message: String,
    ) {
        val channels = listeners[channel] ?: return
        channels.removeIf { ch ->
            val sent = ch.trySend(message)
            if (sent.isFailure) {
                log.warn("PubSub channel $channel listener buffer full; dropping message")
            }
            ch.isClosedForSend
        }
    }

    /**
     * Removes a closed listener channel from the subscription map.
     *
     * @param channel The Redis channel name.
     * @param listener The coroutine channel to remove.
     */
    public fun unsubscribe(
        channel: String,
        listener: SendChannel<String>,
    ) {
        listeners[channel]?.remove(listener)
        if (listeners[channel]?.isEmpty() == true) {
            listeners.remove(channel)
        }
    }

    /** Closes all listener channels and clears the subscription map. */
    public fun close() {
        listeners.values.forEach { channels -> channels.forEach { it.close() } }
        listeners.clear()
    }
}
