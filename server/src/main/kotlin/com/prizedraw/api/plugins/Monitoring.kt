package com.prizedraw.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.request.path
import io.micrometer.core.instrument.binder.jvm.ClassLoaderMetrics
import io.micrometer.core.instrument.binder.jvm.JvmGcMetrics
import io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics
import io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics
import io.micrometer.core.instrument.binder.system.ProcessorMetrics
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.slf4j.event.Level

/**
 * Installs request logging and Micrometer metrics collection.
 *
 * A [PrometheusMeterRegistry] is created and made available via Koin for injection
 * into route handlers that expose the `/metrics` endpoint.
 *
 * JVM instrumentation is bound automatically: GC, memory, threads, CPU.
 */
public fun Application.configureMonitoring() {
    install(CallLogging) {
        level = Level.INFO
        filter { call -> call.request.path().startsWith("/api") }
        format { call ->
            val status = call.response.status()
            val method = call.request.local.method.value
            val path = call.request.path()
            "$method $path -> $status"
        }
    }
}

/**
 * Creates and configures the application-wide Prometheus [PrometheusMeterRegistry].
 *
 * Binds standard JVM and process metrics. The returned registry should be registered
 * in the Koin [ServiceModule] and used for custom metrics throughout the application.
 */
public fun createMeterRegistry(): PrometheusMeterRegistry {
    val registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
    ClassLoaderMetrics().bindTo(registry)
    JvmGcMetrics().bindTo(registry)
    JvmMemoryMetrics().bindTo(registry)
    JvmThreadMetrics().bindTo(registry)
    ProcessorMetrics().bindTo(registry)
    return registry
}
