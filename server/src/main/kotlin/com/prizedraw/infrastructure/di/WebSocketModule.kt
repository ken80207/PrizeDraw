package com.prizedraw.infrastructure.di

import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.infrastructure.websocket.ConnectionManager
import com.prizedraw.infrastructure.websocket.PlayerNotificationManager
import org.koin.dsl.module

/**
 * Koin module for WebSocket session management.
 *
 * Phase 4: Registers [ConnectionManager] which maintains the per-room session registry
 * and wires Redis pub/sub subscriptions for cross-instance fanout.
 */
public val webSocketModule =
    module {
        single<ConnectionManager> {
            ConnectionManager(redisPubSub = get<RedisPubSub>())
        }
        single<PlayerNotificationManager> {
            PlayerNotificationManager(redisPubSub = get<RedisPubSub>())
        }
    }
