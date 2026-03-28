package com.prizedraw.infrastructure.di

import com.prizedraw.api.plugins.createMeterRegistry
import com.prizedraw.application.ports.output.IBroadcastRepository
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.application.ports.output.IChatRepository
import com.prizedraw.application.ports.output.IDrawSyncRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.application.ports.output.IRoomInstanceRepository
import com.prizedraw.application.ports.output.ITierConfigRepository
import com.prizedraw.application.ports.output.IXpTransactionRepository
import com.prizedraw.application.services.BroadcastService
import com.prizedraw.application.services.ChatService
import com.prizedraw.application.services.DrawSyncService
import com.prizedraw.application.services.FeedService
import com.prizedraw.application.services.LevelService
import com.prizedraw.application.services.RoomScalingService
import com.prizedraw.application.services.StaffTokenService
import com.prizedraw.application.services.TokenService
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.infrastructure.persistence.repositories.RefreshTokenFamilyRepositoryImpl
import com.prizedraw.infrastructure.websocket.ConnectionManager
import io.ktor.server.config.ApplicationConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.koin.dsl.module

/**
 * Koin module providing application-layer services.
 *
 * - [TokenService] — JWT creation, verification, and refresh token rotation.
 * - [PrometheusMeterRegistry] — Micrometer metrics registry for Prometheus scraping.
 * - [LevelService] — Player XP/level/tier management (Phase 22).
 */
@Suppress("LongMethod")
public fun serviceModule(config: ApplicationConfig) =
    module {
        includes(levelServiceModule)
        single<PrometheusMeterRegistry> { createMeterRegistry() }
        single<MarginRiskService> { MarginRiskService() }

        single<TokenService.RefreshTokenFamilyStore> { RefreshTokenFamilyRepositoryImpl() }

        single<TokenService> {
            val tokenConfig =
                TokenService.TokenConfig(
                    jwtSecret = config.property("jwt.secret").getString(),
                    // Support both camelCase and dotted sub-keys from application.conf
                    accessTokenTtlSeconds =
                        config
                            .propertyOrNull("jwt.accessTokenTtlSeconds")
                            ?.getString()
                            ?.toLong()
                            ?: config.propertyOrNull("jwt.accessTokenExpirySeconds")?.getString()?.toLong()
                            ?: (15 * 60L),
                    refreshTokenFamilyTtlDays =
                        config
                            .propertyOrNull("jwt.refreshFamilyTtlDays")
                            ?.getString()
                            ?.toLong()
                            ?: config.propertyOrNull("jwt.refreshTokenExpiryDays")?.getString()?.toLong()
                            ?: 30L,
                    issuer = config.propertyOrNull("jwt.issuer")?.getString() ?: "prizedraw",
                )
            TokenService(tokenConfig, get())
        }

        single<StaffTokenService> {
            StaffTokenService(
                jwtSecret = config.property("jwt.secret").getString(),
                issuer = config.propertyOrNull("jwt.issuer")?.getString() ?: "prizedraw",
            )
        }

        // Gameification services (Phase 19+)
        single<DrawSyncService> {
            DrawSyncService(
                drawSyncRepository = get<IDrawSyncRepository>(),
                redisPubSub = get<RedisPubSub>(),
            )
        }

        single<ChatService> {
            ChatService(
                chatRepository = get<IChatRepository>(),
                redisPubSub = get<RedisPubSub>(),
                redisClient = get<RedisClient>(),
            )
        }

        single<BroadcastService> {
            BroadcastService(
                broadcastRepository = get<IBroadcastRepository>(),
                redisPubSub = get<RedisPubSub>(),
                connectionManager = get<ConnectionManager>(),
            )
        }

        // Phase 21: Room Scaling
        single<RoomScalingService> {
            RoomScalingService(
                roomInstanceRepository = get<IRoomInstanceRepository>(),
                redisClient = get<RedisClient>(),
                redisPubSub = get<RedisPubSub>(),
            )
        }

        // Live draw feed (broadcasts draw events to /ws/feed clients)
        single<FeedService> {
            FeedService(
                pubSub = get<IPubSubService>(),
            )
        }
    }

/**
 * Koin sub-module for Phase 22 player level/tier services.
 *
 * Declared as a top-level val so it can be included in [serviceModule] without
 * inflating its line count past the detekt [LongMethod] threshold.
 */
internal val levelServiceModule =
    module {
        single<LevelService> {
            LevelService(
                playerRepository = get<IPlayerRepository>(),
                xpTransactionRepository = get<IXpTransactionRepository>(),
                tierConfigRepository = get<ITierConfigRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }
    }
