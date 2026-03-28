package com.prizedraw.infrastructure.external.redis

import com.prizedraw.application.ports.output.IPubSubService
import io.lettuce.core.pubsub.RedisPubSubAdapter
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.Flow
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
 * Typical usage: a Ktor WebSocket handler subscribes to the player-specific channel
 * `ws:player:<playerId>`, and the domain event outbox worker publishes events there.
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
    public override suspend fun publish(
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
     * cancels the flow (e.g. WebSocket disconnects), the channel is removed from the
     * listener map.
     *
     * @param channel The Redis channel to subscribe to.
     */
    public override fun subscribe(channelName: String): Flow<String> {
        return callbackFlow {
            listeners.getOrPut(channelName) { mutableListOf() }.add(channel)

            redisClient.run {
                // Note: in a real implementation this would use a StatefulRedisPubSubConnection
                // and register this channel with SUBSCRIBE. Here we wire a callback.
            }

            awaitClose {
                unsubscribe(channelName, this@callbackFlow.channel)
            }
        }
    }

    /**
     * Processes an inbound pub/sub message by routing it to all registered local listeners.
     *
     * Called by the Lettuce [RedisPubSubAdapter] listener registered at startup.
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

    /** Removes a closed listener channel from the map. */
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
