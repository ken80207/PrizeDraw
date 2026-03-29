package com.prizedraw.shared.resilience

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import java.time.Duration

private const val DEFAULT_WINDOW_SIZE = 10
private const val DEFAULT_FAILURE_RATE_THRESHOLD = 50.0f
private const val DEFAULT_WAIT_DURATION_SECONDS = 30L
private const val DEFAULT_HALF_OPEN_CALLS = 5

private const val PAYMENT_WINDOW_SIZE = 5
private const val PAYMENT_FAILURE_RATE_THRESHOLD = 40.0f
private const val PAYMENT_WAIT_DURATION_SECONDS = 10L
private const val PAYMENT_HALF_OPEN_CALLS = 2

private const val NOTIFICATION_WINDOW_SIZE = 20
private const val NOTIFICATION_FAILURE_RATE_THRESHOLD = 60.0f
private const val NOTIFICATION_WAIT_DURATION_SECONDS = 60L
private const val NOTIFICATION_HALF_OPEN_CALLS = 3

/**
 * Named circuit-breaker presets.
 *
 * Add a new entry here when a downstream service requires a circuit breaker with
 * non-default thresholds. The [CircuitBreakers] factory resolves the config by name.
 */
public enum class CircuitBreakerPreset {
    /** Conservative defaults — suitable for most internal service calls. */
    DEFAULT,

    /** Tighter thresholds for payment-gateway calls where fast failure is preferred. */
    PAYMENT_GATEWAY,

    /** Lenient thresholds for non-critical external notification services (Firebase, LINE). */
    NOTIFICATION_SERVICE,
}

/**
 * Factory that creates and caches [CircuitBreaker] instances backed by a shared
 * [CircuitBreakerRegistry].
 *
 * Instances are identified by a string name and are created lazily on first access.
 * The same [CircuitBreaker] instance is returned for repeated calls with the same name,
 * so metrics from the [registry] accumulate correctly across the application lifetime.
 *
 * Usage:
 * ```kotlin
 * val cb = CircuitBreakers.get("payment-gateway", CircuitBreakerPreset.PAYMENT_GATEWAY)
 * val result = cb.executeSuspendFunction { paymentGateway.charge(order) }
 * ```
 */
public object CircuitBreakers {
    /** The shared registry used for metrics and lifecycle management. */
    public val registry: CircuitBreakerRegistry = CircuitBreakerRegistry.ofDefaults()

    /**
     * Returns the [CircuitBreaker] registered under [name], creating it with the
     * configuration associated with [preset] if it does not yet exist.
     *
     * @param name Unique identifier for this circuit breaker (e.g. `"firebase-fcm"`).
     * @param preset Configuration preset to apply on first creation.
     */
    public fun get(
        name: String,
        preset: CircuitBreakerPreset = CircuitBreakerPreset.DEFAULT,
    ): CircuitBreaker = registry.circuitBreaker(name, configFor(preset))

    private fun configFor(preset: CircuitBreakerPreset): CircuitBreakerConfig =
        when (preset) {
            CircuitBreakerPreset.DEFAULT -> defaultConfig()
            CircuitBreakerPreset.PAYMENT_GATEWAY -> paymentGatewayConfig()
            CircuitBreakerPreset.NOTIFICATION_SERVICE -> notificationServiceConfig()
        }

    /**
     * Conservative defaults: opens after 50% failure rate over 10 calls,
     * waits 30 s in OPEN state, and uses a 5-call half-open window.
     */
    private fun defaultConfig(): CircuitBreakerConfig =
        CircuitBreakerConfig
            .custom()
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(DEFAULT_WINDOW_SIZE)
            .failureRateThreshold(DEFAULT_FAILURE_RATE_THRESHOLD)
            .waitDurationInOpenState(Duration.ofSeconds(DEFAULT_WAIT_DURATION_SECONDS))
            .permittedNumberOfCallsInHalfOpenState(DEFAULT_HALF_OPEN_CALLS)
            .build()

    /**
     * Payment gateway: opens quickly after 40% failures over 5 calls.
     * Waits only 10 s before attempting recovery — fast failure is preferred
     * so callers can surface payment errors promptly.
     */
    private fun paymentGatewayConfig(): CircuitBreakerConfig =
        CircuitBreakerConfig
            .custom()
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(PAYMENT_WINDOW_SIZE)
            .failureRateThreshold(PAYMENT_FAILURE_RATE_THRESHOLD)
            .waitDurationInOpenState(Duration.ofSeconds(PAYMENT_WAIT_DURATION_SECONDS))
            .permittedNumberOfCallsInHalfOpenState(PAYMENT_HALF_OPEN_CALLS)
            .build()

    /**
     * Notification service: tolerates higher failure rates (60% over 20 calls).
     * Long wait (60 s) avoids hammering external services (Firebase, LINE) when they
     * are degraded. Non-delivery of push notifications is non-critical.
     */
    private fun notificationServiceConfig(): CircuitBreakerConfig =
        CircuitBreakerConfig
            .custom()
            .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
            .slidingWindowSize(NOTIFICATION_WINDOW_SIZE)
            .failureRateThreshold(NOTIFICATION_FAILURE_RATE_THRESHOLD)
            .waitDurationInOpenState(Duration.ofSeconds(NOTIFICATION_WAIT_DURATION_SECONDS))
            .permittedNumberOfCallsInHalfOpenState(NOTIFICATION_HALF_OPEN_CALLS)
            .build()
}
