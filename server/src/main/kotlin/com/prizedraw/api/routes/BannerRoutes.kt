package com.prizedraw.api.routes

import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.contracts.dto.banner.BannerDto
import com.prizedraw.contracts.endpoints.BannerEndpoints
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.external.redis.CacheService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private const val CACHE_KEY = "banners:active"
private const val CACHE_TTL_SECONDS = 60L

/**
 * Registers the public banner listing endpoint.
 *
 * Returns active banners with Redis caching and HTTP cache headers.
 * No authentication required.
 */
public fun Route.bannerRoutes() {
    val bannerRepository: IBannerRepository by inject()
    val cacheService: CacheService by inject()
    val json = Json { ignoreUnknownKeys = true }

    get(BannerEndpoints.BANNERS) {
        val banners: List<BannerDto> =
            try {
                val cached = cacheService.get(CACHE_KEY)
                if (cached != null) {
                    json.decodeFromString(cached)
                } else {
                    val active = bannerRepository.findAllActive().map { it.toPublicDto() }
                    cacheService.set(CACHE_KEY, json.encodeToString(active), CACHE_TTL_SECONDS)
                    active
                }
            } catch (
                @Suppress("TooGenericExceptionCaught") e: Exception,
            ) {
                org.slf4j.LoggerFactory
                    .getLogger("BannerRoutes")
                    .warn("Failed to load banners, returning empty list: {}", e.message)
                emptyList()
            }
        call.response.header("Cache-Control", "public, max-age=60")
        call.respond(HttpStatusCode.OK, banners)
    }
}

private fun Banner.toPublicDto(): BannerDto =
    BannerDto(
        id = id.toString(),
        imageUrl = imageUrl,
        linkType = linkType,
        linkUrl = linkUrl,
        sortOrder = sortOrder,
        isActive = isActive,
        scheduledStart = scheduledStart,
        scheduledEnd = scheduledEnd,
    )
