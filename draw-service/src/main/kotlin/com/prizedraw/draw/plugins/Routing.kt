package com.prizedraw.draw.plugins

import com.prizedraw.draw.api.routes.drawRoutes
import com.prizedraw.draw.api.routes.leaderboardRoutes
import com.prizedraw.draw.api.routes.liveDrawRoutes
import io.ktor.server.application.Application
import io.ktor.server.routing.routing

/**
 * Installs all draw-service HTTP routes.
 *
 * Routes registered:
 * - Draw (kuji + unlimited + queue management + draw sync)
 * - Leaderboard (global + campaign-specific)
 * - Live draws (marquee / active sessions)
 */
public fun Application.configureDrawRouting() {
    routing {
        drawRoutes()
        leaderboardRoutes()
        liveDrawRoutes()
    }
}
