package com.prizedraw.api.routes

import com.prizedraw.application.services.FeedService
import com.prizedraw.contracts.dto.feed.FeedRecentResponse
import com.prizedraw.contracts.endpoints.FeedEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject

private const val MAX_FEED_LIMIT = 100
private const val DEFAULT_FEED_LIMIT = 50

/**
 * Public REST endpoint for the live draw feed.
 *
 * `GET /api/v1/feed/recent` returns the most recently drawn events as
 * [com.prizedraw.contracts.dto.feed.DrawFeedEventDto] items read from the denormalised
 * `feed_events` table. Both KUJI and UNLIMITED draw types are included.
 *
 * The `limit` query parameter controls result count (default 50, max 100).
 * No authentication is required.
 */
public fun Route.feedRoutes() {
    val feedService: FeedService by inject()

    get(FeedEndpoints.RECENT) {
        val limit =
            (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_FEED_LIMIT)
                .coerceIn(1, MAX_FEED_LIMIT)

        val items = feedService.getRecentEvents(limit)
        call.respond(HttpStatusCode.OK, FeedRecentResponse(items = items))
    }
}
