package com.prizedraw.api.plugins

import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.server.websocket.timeout
import kotlin.time.Duration.Companion.seconds

/**
 * Installs the Ktor [WebSockets] plugin with keepalive ping/pong.
 *
 * WebSocket routes are registered in the routing configuration.
 * The 15-second ping period keeps connections alive through idle timeouts
 * on load balancers and reverse proxies.
 */
public fun Application.configureWebSockets() {
    install(WebSockets) {
        pingPeriod = 15.seconds
        timeout = 60.seconds
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }
}
