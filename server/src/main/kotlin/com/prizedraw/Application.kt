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
import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.infrastructure.di.databaseModule
import com.prizedraw.infrastructure.di.externalModule
import com.prizedraw.infrastructure.di.repositoryModule
import com.prizedraw.infrastructure.di.serviceModule
import com.prizedraw.infrastructure.di.useCaseModule
import com.prizedraw.infrastructure.di.webSocketModule
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

    // --- Feature Flag Cache Warm-Up (W-4) ---
    val featureFlagRepository: IFeatureFlagRepository by inject()
    launch {
        featureFlagRepository.warmCache()
    }

    environment.monitor.subscribe(ApplicationStopped) {
        outboxWorker.stop()
    }
}
