@file:Suppress("MagicNumber")

package com.prizedraw.realtime.infrastructure.di

import com.prizedraw.realtime.connection.ConnectionManager
import com.prizedraw.realtime.connection.PlayerNotificationManager
import com.prizedraw.realtime.infrastructure.client.CoreApiClient
import com.prizedraw.realtime.infrastructure.client.DrawServiceClient
import com.prizedraw.realtime.infrastructure.persistence.ChatRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.DrawRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.DrawSyncRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.FeedEventRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.NotificationRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.QueueEntryRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.QueueRepositoryImpl
import com.prizedraw.realtime.infrastructure.persistence.RoomInstanceRepositoryImpl
import com.prizedraw.realtime.infrastructure.redis.RedisClient
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IChatRepository
import com.prizedraw.realtime.ports.IDrawRepository
import com.prizedraw.realtime.ports.IDrawSyncRepository
import com.prizedraw.realtime.ports.IFeedEventRepository
import com.prizedraw.realtime.ports.INotificationRepository
import com.prizedraw.realtime.ports.IQueueEntryRepository
import com.prizedraw.realtime.ports.IQueueRepository
import com.prizedraw.realtime.ports.IRoomInstanceRepository
import com.prizedraw.realtime.services.ChatService
import com.prizedraw.realtime.services.DrawSyncService
import com.prizedraw.realtime.services.FeedService
import com.prizedraw.realtime.services.LiveDrawService
import com.prizedraw.realtime.services.RoomScalingService
import com.prizedraw.shared.auth.JwtVerifier
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import org.jetbrains.exposed.sql.Database
import org.koin.dsl.module
import javax.sql.DataSource

/**
 * Koin DI module for the realtime-gateway service.
 *
 * Wires the database connection (HikariCP + Exposed, no Flyway — Core API owns migrations),
 * Redis client and pub/sub, all repository implementations, services, connection managers,
 * HTTP clients for downstream service calls, and the shared [JwtVerifier].
 *
 * Configuration is read from environment variables. Defaults target the local dev stack.
 */
public val realtimeModule: org.koin.core.module.Module =
    module {
        // ── Database ──────────────────────────────────────────────────────────────

        single<DataSource> {
            val jdbcUrl = System.getenv("DATABASE_URL") ?: "jdbc:postgresql://localhost:5434/prizedraw"
            val username = System.getenv("DATABASE_USER") ?: "prizedraw"
            val password = System.getenv("DATABASE_PASSWORD") ?: "prizedraw"
            val poolSize = System.getenv("DATABASE_POOL_SIZE")?.toIntOrNull() ?: 10

            val hikariConfig =
                HikariConfig().apply {
                    this.jdbcUrl = jdbcUrl
                    this.username = username
                    this.password = password
                    driverClassName = "org.postgresql.Driver"
                    maximumPoolSize = poolSize
                    minimumIdle = 2
                    idleTimeout = 30_000
                    connectionTimeout = 10_000
                    maxLifetime = 1_800_000
                    isAutoCommit = false
                    transactionIsolation = "TRANSACTION_READ_COMMITTED"
                    poolName = "RealtimeGatewayPool"
                }
            HikariDataSource(hikariConfig)
        }

        single<Database> {
            // No Flyway — Core API owns schema migrations.
            Database.connect(get<DataSource>())
        }

        // ── Redis ─────────────────────────────────────────────────────────────────

        single<RedisClient> {
            RedisClient(
                RedisClient.RedisConfig(
                    host = System.getenv("REDIS_HOST") ?: "localhost",
                    port = System.getenv("REDIS_PORT")?.toIntOrNull() ?: 6380,
                    password = System.getenv("REDIS_PASSWORD"),
                    database = System.getenv("REDIS_DATABASE")?.toIntOrNull() ?: 0,
                    maxPoolSize = System.getenv("REDIS_POOL_SIZE")?.toIntOrNull() ?: 20,
                ),
            )
        }

        single<RedisPubSub> { RedisPubSub(get<RedisClient>()) }

        // ── JWT Verifier (LOCAL — no HTTP calls) ──────────────────────────────────

        single<JwtVerifier> {
            val jwtSecret =
                System.getenv("JWT_SECRET")
                    ?: error("JWT_SECRET environment variable is required")
            val jwtIssuer = System.getenv("JWT_ISSUER") ?: "prizedraw"
            JwtVerifier(
                jwtSecret = jwtSecret,
                expectedIssuer = jwtIssuer,
            )
        }

        // ── HTTP Client (for downstream service calls) ────────────────────────────

        single<HttpClient> {
            HttpClient(CIO) {
                install(ContentNegotiation) { json() }
            }
        }

        single<CoreApiClient> {
            CoreApiClient(
                httpClient = get<HttpClient>(),
                baseUrl = System.getenv("CORE_API_BASE_URL") ?: "http://localhost:9092",
            )
        }

        single<DrawServiceClient> {
            DrawServiceClient(
                httpClient = get<HttpClient>(),
                baseUrl = System.getenv("DRAW_SERVICE_BASE_URL") ?: "http://localhost:9093",
            )
        }

        // ── Repositories ──────────────────────────────────────────────────────────

        single<IChatRepository> { ChatRepositoryImpl() }
        single<IFeedEventRepository> { FeedEventRepositoryImpl() }
        single<IRoomInstanceRepository> { RoomInstanceRepositoryImpl() }
        single<IDrawSyncRepository> { DrawSyncRepositoryImpl() }
        single<IQueueRepository> { QueueRepositoryImpl() }
        single<IQueueEntryRepository> { QueueEntryRepositoryImpl() }
        single<INotificationRepository> { NotificationRepositoryImpl() }
        single<IDrawRepository> { DrawRepositoryImpl() }

        // ── Services ──────────────────────────────────────────────────────────────

        single<ChatService> {
            ChatService(
                chatRepository = get<IChatRepository>(),
                redisPubSub = get<RedisPubSub>(),
                redisClient = get<RedisClient>(),
            )
        }

        single<FeedService> {
            FeedService(
                pubSub = get<RedisPubSub>(),
                feedEventRepository = get<IFeedEventRepository>(),
            )
        }

        single<LiveDrawService> {
            LiveDrawService(pubSub = get<RedisPubSub>())
        }

        single<DrawSyncService> {
            DrawSyncService(
                drawSyncRepository = get<IDrawSyncRepository>(),
                redisPubSub = get<RedisPubSub>(),
            )
        }

        single<RoomScalingService> {
            RoomScalingService(
                roomInstanceRepository = get<IRoomInstanceRepository>(),
                redisClient = get<RedisClient>(),
                redisPubSub = get<RedisPubSub>(),
            )
        }

        // ── Connection Managers ───────────────────────────────────────────────────

        single<ConnectionManager> {
            ConnectionManager(redisPubSub = get<RedisPubSub>())
        }

        single<PlayerNotificationManager> {
            PlayerNotificationManager(redisPubSub = get<RedisPubSub>())
        }
    }
