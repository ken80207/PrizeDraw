package com.prizedraw.notification.infrastructure.external.redis

import com.prizedraw.notification.ports.IPubSubService
import io.lettuce.core.pubsub.RedisPubSubAdapter
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.future.await
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Redis pub/sub wrapper that publishes WebSocket fanout payloads across horizontally-scaled
 * notification-worker instances.
 *
 * Publishers use [publish] to broadcast messages. Subscribers use [subscribe] to receive
 * a [Flow] of messages on a channel. The implementation is backed by a dedicated
 * Lettuce pub/sub connection (separate from the command connection pool).
 *
 * @param redisClient The shared [RedisClient] connection pool.
 */
public class RedisPubSub(
    private val redisClient: RedisClient,
) : IPubSubService {
    private val log = LoggerFactory.getLogger(RedisPubSub::class.java)

    private val listeners = ConcurrentHashMap<String, MutableList<SendChannel<String>>>()

    /**
     * Publishes [message] to the given Redis [channel].
     *
     * @param channel The Redis channel name, e.g. `ws:player:uuid`.
     * @param message The message payload (typically a JSON string).
     */
    override suspend fun publish(
        channel: String,
        message: String,
    ) {
        redisClient.withConnection { commands ->
            commands.publish(channel, message).await()
        }
    }

    /**
     * Returns a [Flow] that emits messages published to [channel].
     *
     * The flow is backed by a [Channel] with a buffer of 64 messages. When the caller
     * cancels the flow, the channel is removed from the listener map.
     *
     * @param channel The Redis channel to subscribe to.
     */
    override fun subscribe(channelName: String): Flow<String> =
        callbackFlow {
            listeners.getOrPut(channelName) { mutableListOf() }.add(channel)

            awaitClose {
                unsubscribe(channelName, this@callbackFlow.channel)
            }
        }

    /**
     * Processes an inbound pub/sub message by routing it to all registered local listeners.
     *
     * Called by the Lettuce [RedisPubSubAdapter] listener registered at startup.
     *
     * @param channel The channel on which the message arrived.
     * @param message The received message payload.
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
     * @param listener The listener to remove.
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
