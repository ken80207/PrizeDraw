@file:Suppress("MagicNumber")

package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.input.coupon.CreateCouponParams
import com.prizedraw.application.ports.input.coupon.ICreateCouponUseCase
import com.prizedraw.application.ports.input.coupon.IDeactivateCouponUseCase
import com.prizedraw.application.ports.input.coupon.IRedeemDiscountCodeUseCase
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.usecases.coupon.CouponNotAvailableException
import com.prizedraw.application.usecases.coupon.CouponNotFoundException
import com.prizedraw.application.usecases.coupon.CouponSupplyExhaustedException
import com.prizedraw.application.usecases.coupon.DiscountCodeNotFoundException
import com.prizedraw.application.usecases.coupon.InvalidCouponValidityException
import com.prizedraw.application.usecases.coupon.InvalidDiscountValueException
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.PlayerCoupon
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.koin.ktor.ext.inject
import java.util.UUID

@Serializable
private data class RedeemCodeRequest(
    val code: String,
)

@Serializable
private data class CreateCouponRequest(
    val name: String,
    val description: String? = null,
    val discountType: String,
    val discountValue: Int,
    val applicableTo: String,
    val maxUsesPerPlayer: Int,
    val issueLimit: Int? = null,
    val validFrom: String,
    val validUntil: String,
    val discountCode: String? = null,
    val codeRedemptionLimit: Int? = null,
)

private val couponJson =
    Json {
        isLenient = true
        ignoreUnknownKeys = true
    }

/**
 * Registers player-facing and admin coupon routes.
 *
 * Player routes (authenticated as player):
 * - GET    /api/v1/players/me/coupons     — list player's coupons
 * - POST   /api/v1/coupons/redeem         — redeem a discount code
 *
 * Admin routes (authenticated as staff, requires OPERATOR or above):
 * - GET    /api/v1/admin/coupons          — list all coupons
 * - POST   /api/v1/admin/coupons          — create coupon + optional discount code
 * - PATCH  /api/v1/admin/coupons/{id}/deactivate — deactivate coupon
 */
public fun Route.couponRoutes() {
    playerCouponRoutes()
    adminCouponRoutes()
}

private fun Route.playerCouponRoutes() {
    val couponRepository: ICouponRepository by inject()
    val redeemDiscountCode: IRedeemDiscountCodeUseCase by inject()

    authenticate("player") {
        get("/api/v1/players/me/coupons") {
            val playerId =
                call.principal<PlayerPrincipal>()?.playerId
                    ?: return@get call.respond(HttpStatusCode.Unauthorized)
            val coupons = couponRepository.findPlayerCoupons(playerId)
            call.respond(HttpStatusCode.OK, coupons.map { it.toResponseMap() })
        }

        post("/api/v1/coupons/redeem") {
            val playerId =
                call.principal<PlayerPrincipal>()?.playerId
                    ?: return@post call.respond(HttpStatusCode.Unauthorized)
            val req = couponJson.decodeFromString<RedeemCodeRequest>(call.receiveText())
            runCatching {
                redeemDiscountCode.execute(playerId, req.code)
            }.fold(
                onSuccess = { call.respond(HttpStatusCode.Created, it.toResponseMap()) },
                onFailure = { e -> call.respondCouponError(e) },
            )
        }
    }
}

private fun Route.adminCouponRoutes() {
    val createCoupon: ICreateCouponUseCase by inject()
    val deactivateCoupon: IDeactivateCouponUseCase by inject()
    val couponRepository: ICouponRepository by inject()

    authenticate("staff") {
        route("/api/v1/admin/coupons") {
            get { handleAdminListCoupons(couponRepository) }
            post { handleAdminCreateCoupon(createCoupon) }
            patch("{id}/deactivate") { handleAdminDeactivateCoupon(deactivateCoupon) }
        }
    }
}

private suspend fun RoutingContext.handleAdminListCoupons(couponRepository: ICouponRepository) {
    call.requireStaffWithRole(StaffRole.OPERATOR) ?: return
    val coupons = couponRepository.findActiveCoupons()
    call.respond(HttpStatusCode.OK, coupons.map { it.toResponseMap() })
}

private suspend fun RoutingContext.handleAdminCreateCoupon(createCoupon: ICreateCouponUseCase) {
    val staff = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return
    val req = couponJson.decodeFromString<CreateCouponRequest>(call.receiveText())
    val discountType =
        runCatching { CouponDiscountType.valueOf(req.discountType) }.getOrElse {
            return call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Invalid discountType: ${req.discountType}"),
            )
        }
    val applicableTo =
        runCatching { CouponApplicableTo.valueOf(req.applicableTo) }.getOrElse {
            return call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Invalid applicableTo: ${req.applicableTo}"),
            )
        }
    val validFrom =
        runCatching { Instant.parse(req.validFrom) }.getOrElse {
            return call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid validFrom"))
        }
    val validUntil =
        runCatching { Instant.parse(req.validUntil) }.getOrElse {
            return call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid validUntil"))
        }
    runCatching {
        createCoupon.execute(
            CreateCouponParams(
                actorStaffId = staff.staffId,
                name = req.name,
                description = req.description,
                discountType = discountType,
                discountValue = req.discountValue,
                applicableTo = applicableTo,
                maxUsesPerPlayer = req.maxUsesPerPlayer,
                issueLimit = req.issueLimit,
                validFrom = validFrom,
                validUntil = validUntil,
                discountCode = req.discountCode,
                codeRedemptionLimit = req.codeRedemptionLimit,
            ),
        )
    }.fold(
        onSuccess = { result ->
            call.respond(
                HttpStatusCode.Created,
                mapOf(
                    "coupon" to result.coupon.toResponseMap(),
                    "discountCode" to result.discountCode?.code,
                ),
            )
        },
        onFailure = { e -> call.respondCouponError(e) },
    )
}

private suspend fun RoutingContext.handleAdminDeactivateCoupon(deactivateCoupon: IDeactivateCouponUseCase) {
    val staff = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return
    val couponId =
        call.parameters["id"]?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        } ?: return call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid coupon id"))
    runCatching {
        deactivateCoupon.execute(staff.staffId, couponId)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.OK, it.toResponseMap()) },
        onFailure = { e -> call.respondCouponError(e) },
    )
}

// --- Helpers ---

private suspend fun ApplicationCall.respondCouponError(e: Throwable) {
    when (e) {
        is DiscountCodeNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is CouponNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is CouponSupplyExhaustedException ->
            respond(HttpStatusCode.Gone, mapOf("error" to e.message))
        is CouponNotAvailableException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
        is InvalidCouponValidityException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        is InvalidDiscountValueException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
    }
}

private fun Coupon.toResponseMap(): Map<String, Any?> =
    mapOf(
        "id" to id.toString(),
        "name" to name,
        "description" to description,
        "discountType" to discountType.name,
        "discountValue" to discountValue,
        "applicableTo" to applicableTo.name,
        "maxUsesPerPlayer" to maxUsesPerPlayer,
        "totalIssued" to totalIssued,
        "totalUsed" to totalUsed,
        "issueLimit" to issueLimit,
        "validFrom" to validFrom.toString(),
        "validUntil" to validUntil.toString(),
        "isActive" to isActive,
        "createdAt" to createdAt.toString(),
    )

private fun PlayerCoupon.toResponseMap(): Map<String, Any?> =
    mapOf(
        "id" to id.toString(),
        "playerId" to playerId.value.toString(),
        "couponId" to couponId.toString(),
        "discountCodeId" to discountCodeId?.toString(),
        "useCount" to useCount,
        "status" to status.name,
        "issuedAt" to issuedAt.toString(),
        "lastUsedAt" to lastUsedAt?.toString(),
    )
