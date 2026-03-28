package com.prizedraw

import com.prizedraw.api.plugins.configureCORS
import com.prizedraw.api.plugins.configureMonitoring
import com.prizedraw.api.plugins.configureRateLimit
import com.prizedraw.api.plugins.configureRequestValidation
import com.prizedraw.api.plugins.configureRouting
import com.prizedraw.api.plugins.configureSecurity
import com.prizedraw.api.plugins.configureSerialization
import com.prizedraw.api.plugins.configureStatusPages
import com.prizedraw.api.plugins.configureWebSockets
import com.prizedraw.application.events.LowStockNotificationJob
import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.services.RoomScalingService
import com.prizedraw.infrastructure.di.databaseModule
import com.prizedraw.infrastructure.di.externalModule
import com.prizedraw.infrastructure.di.repositoryModule
import com.prizedraw.infrastructure.di.serviceModule
import com.prizedraw.infrastructure.di.useCaseModule
import com.prizedraw.infrastructure.di.webSocketModule
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import kotlin.time.Duration.Companion.minutes

private val roomCleanupInterval = 2.minutes

fun main(args: Array<String>) {
    EngineMain.main(args)
}

/**
 * Application module entry point.
 *
 * Installs all Koin DI modules, configures all Ktor plugins, and starts the outbox worker.
 * Called by Ktor's engine via `application.modules` in `application.conf`.
 */
fun Application.module() {
    val appConfig = environment.config

    // --- Dependency Injection ---
    install(Koin) {
        slf4jLogger()
        modules(
            databaseModule(appConfig),
            repositoryModule,
            useCaseModule,
            serviceModule(appConfig),
            externalModule(appConfig),
            webSocketModule,
        )
    }

    // --- Eagerly initialize Database (triggers Flyway + Exposed connect) ---
    val database: org.jetbrains.exposed.sql.Database by inject()

    @Suppress("UNUSED_VARIABLE")
    val dbReady = database // force lazy init

    // --- Ktor Plugins ---
    configureSerialization()
    configureCORS()
    configureRateLimit()
    configureRequestValidation()
    configureStatusPages()
    configureWebSockets()
    configureMonitoring()
    configureSecurity()
    configureRouting()

    // --- Outbox Worker ---
    val outboxWorker: OutboxWorker by inject()
    outboxWorker.start()

    // --- Low-Stock Notification Job ---
    val lowStockJob: LowStockNotificationJob by inject()
    lowStockJob.start()

    // --- Feature Flag Cache Warm-Up (W-4) ---
    val featureFlagRepository: IFeatureFlagRepository by inject()
    launch {
        featureFlagRepository.warmCache()
    }

    // --- Phase 21: Room Cleanup Job ---
    // Deactivates empty room shards every 2 minutes, preserving at least 1 shard per campaign.
    val roomScalingService: RoomScalingService by inject()
    launch {
        while (isActive) {
            delay(roomCleanupInterval)
            @Suppress("TooGenericExceptionCaught")
            try {
                roomScalingService.cleanupEmptyRooms()
            } catch (e: Exception) {
                // Log and continue — cleanup failures must never crash the application.
                org.slf4j.LoggerFactory
                    .getLogger("RoomCleanup")
                    .warn("Room cleanup cycle failed: {}", e.message, e)
            }
        }
    }

    val redisPubSub: RedisPubSub by inject()
    val redisClient: RedisClient by inject()

    environment.monitor.subscribe(ApplicationStopped) {
        outboxWorker.stop()
        lowStockJob.stop()
        // Close the pub/sub connection before shutting down the Lettuce client so that
        // all in-flight UNSUBSCRIBE commands can complete before the TCP connection is torn down.
        redisPubSub.close()
        redisClient.close()
    }
}
