package com.prizedraw.api.routes

import com.prizedraw.application.services.LiveDrawService
import com.prizedraw.contracts.dto.livedraw.LiveDrawsResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** Registers the live draw marquee API route (public, no auth). */
public fun Route.liveDrawRoutes() {
    val liveDrawService: LiveDrawService by inject()

    get("/api/v1/live-draws") {
        val items = liveDrawService.getActiveSessions()
        call.respond(HttpStatusCode.OK, LiveDrawsResponse(items = items))
    }
}
