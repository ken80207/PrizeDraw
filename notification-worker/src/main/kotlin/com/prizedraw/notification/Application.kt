package com.prizedraw.notification

import com.prizedraw.notification.infrastructure.di.notificationModule
import com.prizedraw.notification.infrastructure.external.redis.RedisClient
import com.prizedraw.notification.infrastructure.external.redis.RedisPubSub
import com.prizedraw.notification.worker.LowStockNotificationJob
import com.prizedraw.notification.worker.OutboxWorker
import com.prizedraw.shared.plugins.configureHealthCheck
import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import org.koin.core.context.startKoin
import org.koin.core.context.stopKoin
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("com.prizedraw.notification.Application")

/**
 * Entry point for the notification-worker microservice.
 *
 * Starts Koin DI, launches the [OutboxWorker] and [LowStockNotificationJob] coroutine
 * workers, then starts a minimal Ktor CIO server on port 9095 (overridable via `PORT`
 * environment variable) that exposes only the `/health` and `/ready` endpoints for
 * Kubernetes liveness/readiness probes.
 *
 * A JVM shutdown hook ensures both workers stop gracefully and all Redis connections
 * are closed before the process exits.
 */
public fun main() {
    log.info("notification-worker starting")

    val koinApp = startKoin { modules(notificationModule) }
    val koin = koinApp.koin

    // Eagerly initialize the DB connection so any configuration errors surface at startup.
    @Suppress("UNUSED_VARIABLE")
    val database = koin.get<org.jetbrains.exposed.sql.Database>()

    val outboxWorker = koin.get<OutboxWorker>()
    val lowStockJob = koin.get<LowStockNotificationJob>()

    outboxWorker.start()
    lowStockJob.start()

    log.info("OutboxWorker and LowStockNotificationJob started")

    val redisPubSub = koin.get<RedisPubSub>()
    val redisClient = koin.get<RedisClient>()

    // Graceful shutdown hook — runs before the JVM exits.
    Runtime.getRuntime().addShutdownHook(
        Thread {
            log.info("notification-worker shutting down")
            outboxWorker.stop()
            lowStockJob.stop()
            redisPubSub.close()
            redisClient.close()
            stopKoin()
            log.info("notification-worker shutdown complete")
        },
    )

    // Minimal HTTP server for health/metrics probes — no business logic served here.
    val port = System.getenv("PORT")?.toIntOrNull() ?: DEFAULT_PORT
    log.info("Starting health-check server on port {}", port)
    embeddedServer(CIO, port = port) {
        configureHealthCheck()
    }.start(wait = true)
}

private const val DEFAULT_PORT = 9095
