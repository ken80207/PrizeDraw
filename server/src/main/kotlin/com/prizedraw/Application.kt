package com.prizedraw

import com.prizedraw.api.plugins.configureCORS
import com.prizedraw.api.plugins.configureMonitoring
import com.prizedraw.api.plugins.configureRateLimit
import com.prizedraw.api.plugins.configureRequestValidation
import com.prizedraw.api.plugins.configureRouting
import com.prizedraw.api.plugins.configureSecurity
import com.prizedraw.api.plugins.configureSerialization
import com.prizedraw.api.plugins.configureStatusPages
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.infrastructure.di.databaseModule
import com.prizedraw.infrastructure.di.externalModule
import com.prizedraw.infrastructure.di.repositoryModule
import com.prizedraw.infrastructure.di.serviceModule
import com.prizedraw.infrastructure.di.useCaseModule
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationStopped
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import kotlinx.coroutines.launch
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

fun main(args: Array<String>) {
    EngineMain.main(args)
}

/**
 * Application module entry point.
 *
 * Installs all Koin DI modules, configures all Ktor plugins, and starts the outbox worker.
 * Called by Ktor's engine via `application.modules` in `application.conf`.
 *
 * WebSocket handling has been extracted to the `realtime-gateway` microservice.
 * This module no longer serves WebSocket routes.
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
    configureMonitoring()
    configureSecurity()
    configureRouting()

    // --- Feature Flag Cache Warm-Up (W-4) ---
    val featureFlagRepository: IFeatureFlagRepository by inject()
    launch {
        featureFlagRepository.warmCache()
    }

    val redisPubSub: RedisPubSub by inject()
    val redisClient: RedisClient by inject()

    environment.monitor.subscribe(ApplicationStopped) {
        // Close the pub/sub connection before shutting down the Lettuce client so that
        // all in-flight UNSUBSCRIBE commands can complete before the TCP connection is torn down.
        redisPubSub.close()
        redisClient.close()
    }
}
