package com.prizedraw.draw.api.routes

import com.prizedraw.contracts.dto.livedraw.LiveDrawsResponse
import com.prizedraw.draw.application.services.LiveDrawService
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject

/** Registers the live draw marquee API route (public, no auth). */
public fun Route.liveDrawRoutes() {
    val liveDrawService: LiveDrawService by inject()

    get("/api/v1/live-draws") {
        val items = liveDrawService.getActiveSessions()
        call.respond(HttpStatusCode.OK, LiveDrawsResponse(items = items))
    }
}
