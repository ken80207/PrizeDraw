@file:Suppress("MagicNumber")

package com.prizedraw.notification.infrastructure.di

import com.prizedraw.notification.infrastructure.external.push.FirebaseNotificationService
import com.prizedraw.notification.infrastructure.external.redis.RedisClient
import com.prizedraw.notification.infrastructure.external.redis.RedisPubSub
import com.prizedraw.notification.infrastructure.persistence.CampaignFavoriteRepositoryImpl
import com.prizedraw.notification.infrastructure.persistence.CampaignRepositoryImpl
import com.prizedraw.notification.infrastructure.persistence.FollowRepositoryImpl
import com.prizedraw.notification.infrastructure.persistence.NotificationRepositoryImpl
import com.prizedraw.notification.infrastructure.persistence.OutboxRepositoryImpl
import com.prizedraw.notification.infrastructure.persistence.PlayerDeviceRepositoryImpl
import com.prizedraw.notification.ports.ICampaignFavoriteRepository
import com.prizedraw.notification.ports.ICampaignRepository
import com.prizedraw.notification.ports.IFollowRepository
import com.prizedraw.notification.ports.INotificationRepository
import com.prizedraw.notification.ports.INotificationService
import com.prizedraw.notification.ports.IOutboxRepository
import com.prizedraw.notification.ports.IPlayerDeviceRepository
import com.prizedraw.notification.ports.IPubSubService
import com.prizedraw.notification.worker.LowStockNotificationJob
import com.prizedraw.notification.worker.OutboxWorker
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.sql.Database
import org.koin.dsl.module
import javax.sql.DataSource

/**
 * Koin DI module for the notification-worker service.
 *
 * Wires the database connection (HikariCP + Exposed, no Flyway — Core API owns migrations),
 * Redis client and pub/sub, all repository implementations, the Firebase push service,
 * and the two worker instances.
 *
 * Configuration is read from environment variables. Defaults target the local dev stack.
 */
public val notificationModule: org.koin.core.module.Module =
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
                    poolName = "NotificationWorkerPool"
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
                    maxPoolSize = System.getenv("REDIS_POOL_SIZE")?.toIntOrNull() ?: 10,
                ),
            )
        }

        single<RedisPubSub> { RedisPubSub(get<RedisClient>()) }
        single<IPubSubService> { get<RedisPubSub>() }

        // ── Repositories ──────────────────────────────────────────────────────────

        single<IOutboxRepository> { OutboxRepositoryImpl() }
        single<INotificationRepository> { NotificationRepositoryImpl() }
        single<IFollowRepository> { FollowRepositoryImpl() }
        single<ICampaignRepository> { CampaignRepositoryImpl() }
        single<ICampaignFavoriteRepository> { CampaignFavoriteRepositoryImpl() }
        single<IPlayerDeviceRepository> { PlayerDeviceRepositoryImpl() }

        // ── External services ─────────────────────────────────────────────────────

        single<INotificationService> {
            FirebaseNotificationService(
                config =
                    FirebaseNotificationService.FirebaseConfig(
                        serviceAccountPath =
                            System.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
                                ?: "/etc/prizedraw/firebase-service-account.json",
                        projectId = System.getenv("FIREBASE_PROJECT_ID") ?: "prizedraw",
                    ),
                playerDeviceRepository = get<IPlayerDeviceRepository>(),
            )
        }

        // ── Workers ───────────────────────────────────────────────────────────────

        single<OutboxWorker> {
            OutboxWorker(
                outboxRepository = get<IOutboxRepository>(),
                notificationService = get<INotificationService>(),
                pubSub = get<IPubSubService>(),
                notificationRepository = get<INotificationRepository>(),
                followRepository = get<IFollowRepository>(),
            )
        }

        single<LowStockNotificationJob> {
            LowStockNotificationJob(
                campaignRepo = get<ICampaignRepository>(),
                favoriteRepo = get<ICampaignFavoriteRepository>(),
                notificationRepo = get<INotificationRepository>(),
                outboxRepo = get<IOutboxRepository>(),
            )
        }
    }
