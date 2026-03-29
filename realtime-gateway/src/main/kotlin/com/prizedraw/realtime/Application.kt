package com.prizedraw.realtime

import com.prizedraw.realtime.infrastructure.di.realtimeModule
import com.prizedraw.realtime.infrastructure.redis.RedisClient
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.plugins.configureRouting
import com.prizedraw.realtime.services.RoomScalingService
import com.prizedraw.shared.plugins.configureHealthCheck
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.server.websocket.timeout
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import org.slf4j.LoggerFactory
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

private val log = LoggerFactory.getLogger("com.prizedraw.realtime.Application")
private val roomCleanupInterval = 2.minutes

/**
 * Entry point for the realtime-gateway microservice.
 *
 * Starts an embedded Ktor CIO server on port 9094 (overridable via the `PORT`
 * environment variable) that serves all WebSocket routes for the PrizeDraw platform.
 *
 * The server connects to the shared PostgreSQL database (read/write for chat, feed, and room
 * sharding state) and the shared Redis cluster (pub/sub for cross-pod fanout).
 *
 * JWT tokens are verified **locally** using [com.prizedraw.shared.auth.JwtVerifier] — no
 * HTTP call to the Core API is made for authentication.
 */
public fun main() {
    log.info("realtime-gateway starting on port {}", System.getenv("PORT") ?: DEFAULT_PORT)
    embeddedServer(CIO, port = System.getenv("PORT")?.toIntOrNull() ?: DEFAULT_PORT) {
        module()
    }.start(wait = true)
}

/**
 * Ktor application module for the realtime-gateway.
 *
 * Installs Koin DI, configures the WebSocket plugin, registers the health-check endpoint
 * from the `:shared` module, registers all WebSocket routes, and starts the periodic
 * room cleanup job.
 */
public fun Application.module() {
    // --- Dependency Injection ---
    install(Koin) {
        slf4jLogger()
        modules(realtimeModule)
    }

    // --- Eagerly initialize Database ---
    val database: org.jetbrains.exposed.sql.Database by inject()

    @Suppress("UNUSED_VARIABLE")
    val dbReady = database // force lazy init

    // --- WebSocket Plugin ---
    install(WebSockets) {
        pingPeriod = 15.seconds
        timeout = 60.seconds
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }

    // --- Shared health/readiness endpoints ---
    configureHealthCheck()

    // --- WebSocket Routes ---
    configureRouting()

    // --- Room Cleanup Job ---
    // Deactivates empty room shards every 2 minutes, preserving at least 1 shard per campaign.
    val roomScalingService: RoomScalingService by inject()
    launch {
        while (isActive) {
            delay(roomCleanupInterval)
            @Suppress("TooGenericExceptionCaught")
            try {
                roomScalingService.cleanupEmptyRooms()
            } catch (e: Exception) {
                log.warn("Room cleanup cycle failed: {}", e.message, e)
            }
        }
    }

    // --- Graceful Shutdown ---
    val redisPubSub: RedisPubSub by inject()
    val redisClient: RedisClient by inject()

    environment.monitor.subscribe(ApplicationStopped) {
        // Close the pub/sub connection before shutting down the Lettuce client so that
        // all in-flight UNSUBSCRIBE commands can complete before the TCP connection is torn down.
        redisPubSub.close()
        redisClient.close()
        log.info("realtime-gateway shutdown complete")
    }
}

private const val DEFAULT_PORT = 9094
