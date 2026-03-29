package com.prizedraw.draw

import com.prizedraw.draw.infrastructure.di.drawModule
import com.prizedraw.draw.infrastructure.redis.RedisClient
import com.prizedraw.draw.infrastructure.redis.RedisPubSub
import com.prizedraw.draw.plugins.configureDrawRouting
import com.prizedraw.draw.plugins.configureSecurity
import com.prizedraw.shared.plugins.ReadinessCheck
import com.prizedraw.shared.plugins.configureHealthCheck
import com.prizedraw.shared.plugins.configureMetrics
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger
import org.slf4j.LoggerFactory
import org.slf4j.event.Level

private val log = LoggerFactory.getLogger("com.prizedraw.draw.Application")
private const val DEFAULT_PORT = 9093

/**
 * Entry point for the draw-service microservice.
 *
 * Starts an embedded Ktor CIO server on port 9093 (overridable via the `PORT`
 * environment variable). Handles all draw-related HTTP endpoints: kuji draw,
 * unlimited draw, queue management, draw sync, leaderboard, and live-draw marquee.
 *
 * Connects directly to the shared PostgreSQL database (same as Core API).
 * Draw + point deduction + outbox event writing happen in a single [newSuspendedTransaction].
 *
 * JWT tokens are verified **locally** using [com.prizedraw.shared.auth.JwtVerifier] —
 * no HTTP call to the Core API is made for authentication.
 */
public fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: DEFAULT_PORT
    log.info("draw-service starting on port {}", port)
    val env =
        io.ktor.server.engine.applicationEnvironment {
            config =
                io.ktor.server.config.HoconApplicationConfig(
                    com.typesafe.config.ConfigFactory
                        .load(),
                )
            log = LoggerFactory.getLogger("ktor.application")
        }
    embeddedServer(CIO, env, configure = {
        connector { this.port = port }
    })
        .start(wait = true)
}

/**
 * Ktor application module for the draw-service.
 *
 * Installs Koin DI, configures JWT auth, content negotiation, status pages,
 * health-check endpoints, draw routes, and the leaderboard aggregation background job.
 */
public fun Application.module() {
    // --- Dependency Injection ---
    install(Koin) {
        slf4jLogger()
        modules(drawModule(environment.config))
    }

    // --- Eagerly initialize Database ---
    val database: org.jetbrains.exposed.sql.Database by inject()

    @Suppress("UNUSED_VARIABLE")
    val dbReady = database // force lazy init

    // --- Content Negotiation ---
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                encodeDefaults = true
            },
        )
    }

    // --- Call Logging ---
    install(CallLogging) {
        level = Level.INFO
    }

    // --- Status Pages ---
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            log.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                mapOf("error" to (cause.message ?: "Internal server error")),
            )
        }
    }

    // --- JWT Authentication ---
    configureSecurity()

    // --- Shared health/readiness endpoints ---
    // Readiness probes verify DB and Redis connectivity before the pod accepts traffic.
    configureHealthCheck(
        ReadinessCheck {
            newSuspendedTransaction { exec("SELECT 1") { rs -> rs.next() } }
            val redis: RedisClient by inject()
            redis.ping()
        },
    )

    // --- Prometheus metrics endpoint ---
    configureMetrics()

    // --- Draw Routes ---
    configureDrawRouting()

    // --- Graceful Shutdown ---
    val redisPubSub: RedisPubSub by inject()
    val redisClient: RedisClient by inject()

    environment.monitor.subscribe(ApplicationStopped) {
        redisPubSub.close()
        redisClient.close()
        log.info("draw-service shutdown complete")
    }
}
