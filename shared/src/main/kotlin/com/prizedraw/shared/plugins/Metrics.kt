package com.prizedraw.shared.plugins

import io.ktor.http.ContentType
import io.ktor.server.application.Application
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.micrometer.core.instrument.binder.jvm.ClassLoaderMetrics
import io.micrometer.core.instrument.binder.jvm.JvmGcMetrics
import io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics
import io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics
import io.micrometer.core.instrument.binder.system.ProcessorMetrics
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry

/**
 * Shared Prometheus metrics registry.
 *
 * All services use this single registry so that custom metrics registered anywhere in the
 * codebase are automatically scraped alongside the default JVM and process metrics.
 *
 * Standard JVM instrumentation is bound at initialisation time:
 * class-loader, GC, heap/non-heap memory, thread counts, and CPU usage.
 */
public val appMeterRegistry: PrometheusMeterRegistry =
    PrometheusMeterRegistry(PrometheusConfig.DEFAULT).also { registry ->
        ClassLoaderMetrics().bindTo(registry)
        JvmGcMetrics().bindTo(registry)
        JvmMemoryMetrics().bindTo(registry)
        JvmThreadMetrics().bindTo(registry)
        ProcessorMetrics().bindTo(registry)
    }

/**
 * Installs a `GET /metrics` endpoint that exposes Prometheus-format metrics.
 *
 * The response content type is `text/plain; version=0.0.4; charset=utf-8`, which is
 * the standard Prometheus exposition format consumed by Prometheus scrapers and the
 * K8s `prometheus.io/scrape` annotation.
 *
 * Call this function once in each service's Ktor application module, after
 * [configureHealthCheck], so that all services expose a consistent `/metrics` path.
 */
public fun Application.configureMetrics() {
    routing {
        get("/metrics") {
            call.respondText(
                text = appMeterRegistry.scrape(),
                contentType = ContentType.parse("text/plain; version=0.0.4; charset=utf-8"),
            )
        }
    }
}
