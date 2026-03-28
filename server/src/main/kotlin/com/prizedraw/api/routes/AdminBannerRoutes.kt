package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.CreateBannerCommand
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.contracts.dto.banner.BannerDto
import com.prizedraw.contracts.dto.banner.CreateBannerRequest
import com.prizedraw.contracts.dto.banner.UpdateBannerRequest
import com.prizedraw.contracts.endpoints.BannerEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.external.redis.CacheService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import java.util.UUID

private const val BANNERS_CACHE_KEY = "banners:active"

/**
 * Registers admin banner management routes.
 *
 * All routes require `authenticate("staff")` in the parent scope (enforced in Routing.kt)
 * and [StaffRole.OPERATOR] or above (enforced per handler).
 *
 * - GET    [BannerEndpoints.ADMIN_BANNERS]       — list all banners
 * - POST   [BannerEndpoints.ADMIN_BANNERS]       — create new banner
 * - PATCH  [BannerEndpoints.ADMIN_BANNER_BY_ID]  — partial update
 * - DELETE [BannerEndpoints.ADMIN_BANNER_BY_ID]  — deactivate
 */
public fun Route.adminBannerRoutes() {
    listAllBannersRoute()
    createBannerRoute()
    updateBannerRoute()
    deactivateBannerRoute()
}

private fun Route.listAllBannersRoute() {
    val bannerRepository: IBannerRepository by inject()
    get(BannerEndpoints.ADMIN_BANNERS) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        val banners = bannerRepository.findAll()
        call.respond(HttpStatusCode.OK, banners.map { it.toDto() })
    }
}

private fun Route.createBannerRoute() {
    val createBanner: ICreateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    post(BannerEndpoints.ADMIN_BANNERS) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@post
        val request = call.receive<CreateBannerRequest>()
        runCatching {
            createBanner.execute(
                CreateBannerCommand(
                    actorStaffId = actor.staffId,
                    imageUrl = request.imageUrl,
                    linkType = request.linkType,
                    linkUrl = request.linkUrl,
                    sortOrder = request.sortOrder,
                    scheduledStart = request.scheduledStart,
                    scheduledEnd = request.scheduledEnd,
                ),
            )
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.Created, it.toDto())
            },
            onFailure = { e ->
                call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to (e.message ?: "Failed to create banner")),
                )
            },
        )
    }
}

private fun Route.updateBannerRoute() {
    val updateBanner: IUpdateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    patch(BannerEndpoints.ADMIN_BANNER_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@patch
        val id =
            call.parameters["id"]
                ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                ?: return@patch call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid banner ID"),
                )

        val request = call.receive<UpdateBannerRequest>()
        runCatching {
            updateBanner.execute(
                actorStaffId = actor.staffId,
                id = id,
                imageUrl = request.imageUrl,
                linkType = request.linkType,
                linkUrl = request.linkUrl,
                sortOrder = request.sortOrder,
                isActive = request.isActive,
                scheduledStart = request.scheduledStart,
                scheduledEnd = request.scheduledEnd,
            )
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.OK, it.toDto())
            },
            onFailure = { e ->
                when (e) {
                    is BannerNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Banner not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.BadRequest,
                            mapOf("error" to (e.message ?: "Failed to update banner")),
                        )
                }
            },
        )
    }
}

private fun Route.deactivateBannerRoute() {
    val deactivateBanner: IDeactivateBannerUseCase by inject()
    val cacheService: CacheService by inject()
    delete(BannerEndpoints.ADMIN_BANNER_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@delete
        val id =
            call.parameters["id"]
                ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                ?: return@delete call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid banner ID"),
                )

        runCatching {
            deactivateBanner.execute(
                actorStaffId = actor.staffId,
                id = id,
            )
        }.fold(
            onSuccess = {
                cacheService.invalidate(BANNERS_CACHE_KEY)
                call.respond(HttpStatusCode.NoContent)
            },
            onFailure = { e ->
                when (e) {
                    is BannerNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Banner not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.InternalServerError,
                            mapOf("error" to (e.message ?: "Failed to deactivate banner")),
                        )
                }
            },
        )
    }
}

private fun Banner.toDto(): BannerDto =
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
