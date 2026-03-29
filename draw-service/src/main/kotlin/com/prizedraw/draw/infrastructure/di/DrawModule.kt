@file:Suppress("MagicNumber", "LongMethod")

package com.prizedraw.draw.infrastructure.di

import com.prizedraw.draw.application.services.DrawSyncService
import com.prizedraw.draw.application.services.FeedService
import com.prizedraw.draw.application.services.KujiQueueService
import com.prizedraw.draw.application.services.LevelService
import com.prizedraw.draw.application.services.LiveDrawService
import com.prizedraw.draw.application.services.PointsLedgerService
import com.prizedraw.draw.application.usecases.DrawKujiDeps
import com.prizedraw.draw.application.usecases.DrawKujiUseCase
import com.prizedraw.draw.application.usecases.DrawUnlimitedDeps
import com.prizedraw.draw.application.usecases.DrawUnlimitedUseCase
import com.prizedraw.draw.application.usecases.GetLeaderboardUseCase
import com.prizedraw.draw.application.usecases.LeaderboardAggregationJob
import com.prizedraw.draw.domain.services.DrawCore
import com.prizedraw.draw.domain.services.DrawCoreDeps
import com.prizedraw.draw.domain.services.KujiDrawDomainService
import com.prizedraw.draw.domain.services.PityDomainService
import com.prizedraw.draw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.draw.infrastructure.persistence.AuditRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.CampaignRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.CouponRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.DrawPointTransactionRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.DrawRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.DrawSyncRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.FeedEventRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.LeaderboardRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.OutboxRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.PityRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.PlayerRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.PrizeRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.QueueEntryRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.QueueRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.RevenuePointTransactionRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.TicketBoxRepositoryImpl
import com.prizedraw.draw.infrastructure.redis.DistributedLock
import com.prizedraw.draw.infrastructure.redis.RedisClient
import com.prizedraw.draw.infrastructure.redis.RedisPubSub
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.config.ApplicationConfig
import org.jetbrains.exposed.sql.Database
import org.koin.dsl.module
import javax.sql.DataSource

/**
 * Koin module providing all draw-service dependencies.
 *
 * Wires: HikariCP + Exposed, Redis, domain services, repositories, application services,
 * use cases, and background jobs.
 *
 * No Flyway — the Core API (`:server`) owns all migrations.
 */
public fun drawModule(config: ApplicationConfig): org.koin.core.module.Module =
    module {
        // ------------------------------------------------------------------
        // Database
        // ------------------------------------------------------------------
        single<DataSource> {
            val url = config.property("database.url").getString()
            val username =
                config.propertyOrNull("database.username")?.getString()
                    ?: config.property("database.user").getString()
            val password = config.property("database.password").getString()
            val poolSize = config.propertyOrNull("database.poolSize")?.getString()?.toInt() ?: 10

            val hikariConfig =
                HikariConfig().apply {
                    jdbcUrl = url
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
                    poolName = "DrawServicePool"
                }
            HikariDataSource(hikariConfig)
        }

        single<Database> {
            Database.connect(get<DataSource>())
        }

        // ------------------------------------------------------------------
        // Redis
        // ------------------------------------------------------------------
        single {
            val host = config.propertyOrNull("redis.host")?.getString() ?: "localhost"
            val port = config.propertyOrNull("redis.port")?.getString()?.toInt() ?: 6379
            val password = config.propertyOrNull("redis.password")?.getString()
            val db = config.propertyOrNull("redis.database")?.getString()?.toInt() ?: 0
            val maxPool = config.propertyOrNull("redis.maxPoolSize")?.getString()?.toInt() ?: 20
            RedisClient(
                RedisClient.RedisConfig(
                    host = host,
                    port = port,
                    password = password,
                    database = db,
                    maxPoolSize = maxPool,
                ),
            )
        }

        single { RedisPubSub(get()) }
        single { DistributedLock(get()) }

        // ------------------------------------------------------------------
        // Repositories
        // ------------------------------------------------------------------
        single { PlayerRepositoryImpl() }
        single { OutboxRepositoryImpl() }
        single { DrawRepositoryImpl() }
        single { TicketBoxRepositoryImpl() }
        single { CampaignRepositoryImpl() }
        single { PrizeRepositoryImpl() }
        single { QueueRepositoryImpl() }
        single { QueueEntryRepositoryImpl() }
        single { AuditRepositoryImpl() }
        single { DrawPointTransactionRepositoryImpl() }
        single { RevenuePointTransactionRepositoryImpl() }
        single { DrawSyncRepositoryImpl() }
        single { LeaderboardRepositoryImpl() }
        single { FeedEventRepositoryImpl() }
        single { PityRepositoryImpl() }
        single { CouponRepositoryImpl() }

        // ------------------------------------------------------------------
        // Domain services
        // ------------------------------------------------------------------
        single { KujiDrawDomainService() }
        single { UnlimitedDrawDomainService() }
        single { PityDomainService() }

        // ------------------------------------------------------------------
        // Application services
        // ------------------------------------------------------------------
        single {
            PointsLedgerService(
                playerRepository = get<PlayerRepositoryImpl>(),
                drawPointTxRepository = get<DrawPointTransactionRepositoryImpl>(),
                revenuePointTxRepository = get<RevenuePointTransactionRepositoryImpl>(),
            )
        }

        single {
            LevelService(
                playerRepository = get<PlayerRepositoryImpl>(),
            )
        }

        single {
            FeedService(
                pubSub = get<RedisPubSub>(),
                feedEventRepository = get<FeedEventRepositoryImpl>(),
            )
        }

        single {
            DrawSyncService(
                drawSyncRepository = get<DrawSyncRepositoryImpl>(),
                redisPubSub = get(),
            )
        }

        single {
            KujiQueueService(
                distributedLock = get<DistributedLock>(),
                queueRepository = get<QueueRepositoryImpl>(),
                queueEntryRepository = get<QueueEntryRepositoryImpl>(),
                pubSub = get<RedisPubSub>(),
            )
        }

        single { LiveDrawService(pubSub = get<RedisPubSub>()) }

        // ------------------------------------------------------------------
        // DrawCore
        // ------------------------------------------------------------------
        single {
            DrawCore(
                DrawCoreDeps(
                    prizeRepository = get<PrizeRepositoryImpl>(),
                    playerRepository = get<PlayerRepositoryImpl>(),
                    outboxRepository = get<OutboxRepositoryImpl>(),
                    levelService = get<LevelService>(),
                    drawPointTxRepository = get<DrawPointTransactionRepositoryImpl>(),
                ),
            )
        }

        // ------------------------------------------------------------------
        // Use cases
        // ------------------------------------------------------------------
        single {
            DrawKujiUseCase(
                DrawKujiDeps(
                    campaignRepository = get<CampaignRepositoryImpl>(),
                    ticketBoxRepository = get<TicketBoxRepositoryImpl>(),
                    drawRepository = get<DrawRepositoryImpl>(),
                    prizeRepository = get<PrizeRepositoryImpl>(),
                    outboxRepository = get<OutboxRepositoryImpl>(),
                    auditRepository = get<AuditRepositoryImpl>(),
                    queueRepository = get<QueueRepositoryImpl>(),
                    domainService = get<KujiDrawDomainService>(),
                    drawCore = get<DrawCore>(),
                    redisPubSub = get<RedisPubSub>(),
                    couponRepository = get<CouponRepositoryImpl>(),
                    feedService = get<FeedService>(),
                    liveDrawService = get<LiveDrawService>(),
                    playerRepository = get<PlayerRepositoryImpl>(),
                ),
            )
        }

        single {
            DrawUnlimitedUseCase(
                DrawUnlimitedDeps(
                    campaignRepository = get<CampaignRepositoryImpl>(),
                    prizeRepository = get<PrizeRepositoryImpl>(),
                    outboxRepository = get<OutboxRepositoryImpl>(),
                    auditRepository = get<AuditRepositoryImpl>(),
                    domainService = get<UnlimitedDrawDomainService>(),
                    redisClient = get<RedisClient>(),
                    drawCore = get<DrawCore>(),
                    couponRepository = get<CouponRepositoryImpl>(),
                    feedService = get<FeedService>(),
                    playerRepository = get<PlayerRepositoryImpl>(),
                    pityRepository = get<PityRepositoryImpl>(),
                    pityDomainService = get<PityDomainService>(),
                ),
            )
        }

        single {
            GetLeaderboardUseCase(
                leaderboardRepository = get<LeaderboardRepositoryImpl>(),
            )
        }

        // ------------------------------------------------------------------
        // Background jobs
        // ------------------------------------------------------------------
        single { LeaderboardAggregationJob(leaderboardRepository = get<LeaderboardRepositoryImpl>()) }
    }
