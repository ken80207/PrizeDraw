@file:Suppress("MatchingDeclarationName")

package com.prizedraw.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.ratelimit.RateLimit
import io.ktor.server.plugins.ratelimit.RateLimitName
import kotlin.time.Duration.Companion.seconds

/**
 * Rate limit tier names used in route annotations.
 *
 * Routes should annotate with `rateLimit(RateLimitTier.DEFAULT)` etc.
 */
public object RateLimitTier {
    public val DEFAULT: RateLimitName = RateLimitName("default")
    public val AUTH: RateLimitName = RateLimitName("auth")
    public val DRAW: RateLimitName = RateLimitName("draw")
    public val FOLLOW: RateLimitName = RateLimitName("follow")
}

/**
 * Installs Ktor [RateLimit] with named tiers.
 *
 * - `default`: 100 requests per 10 seconds per IP.
 * - `auth`: 10 requests per 60 seconds per IP (brute-force protection for login/OTP).
 * - `draw`: 5 requests per second per IP (draw action rate limiting).
 * - `follow`: 30 requests per 60 seconds per user (follow/unfollow action rate limiting).
 */
public fun Application.configureRateLimit() {
    install(RateLimit) {
        register(RateLimitTier.DEFAULT) {
            rateLimiter(limit = 100, refillPeriod = 10.seconds)
        }
        register(RateLimitTier.AUTH) {
            rateLimiter(limit = 10, refillPeriod = 60.seconds)
        }
        register(RateLimitTier.DRAW) {
            rateLimiter(limit = 5, refillPeriod = 1.seconds)
        }
        register(RateLimitTier.FOLLOW) {
            rateLimiter(limit = 30, refillPeriod = 60.seconds)
        }
    }
}
