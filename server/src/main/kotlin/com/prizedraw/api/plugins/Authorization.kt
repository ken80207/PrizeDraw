package com.prizedraw.api.plugins

import com.prizedraw.contracts.enums.StaffRole
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route

/*
 * Ktor helper defining RBAC role guards for admin routes.
 *
 * Role hierarchy (ascending ordinal, matching [StaffRole] enum declaration):
 * CUSTOMER_SERVICE < OPERATOR < ADMIN < OWNER
 *
 * Usage inside an `authenticate("staff") { }` block:
 * ```
 * authenticate("staff") {
 *     requireRole(StaffRole.ADMIN) {
 *         get("/api/v1/admin/staff") { ... }
 *     }
 * }
 * ```
 */

/**
 * Wraps [build] inside a route subtree that requires the caller to hold at least [minimumRole].
 *
 * Every handler inside the block must verify the principal via [requireStaffWithRole].
 * The wrapper creates a [StaffRoleSelector] child route to document the requirement.
 *
 * @param minimumRole The minimum [StaffRole] required to access routes in this block.
 * @param build The route builder lambda.
 */
public fun Route.requireRole(
    minimumRole: StaffRole,
    build: Route.() -> Unit,
): Route = withMinimumRole(minimumRole, build)

/**
 * Extracts the authenticated [StaffPrincipal] from the call and validates that the
 * principal's role satisfies [minimumRole].
 *
 * Returns null and responds with the appropriate HTTP status if validation fails,
 * allowing callers to use `?: return@handler` for early exit.
 *
 * @param minimumRole The minimum [StaffRole] required.
 * @return The [StaffPrincipal] when authorized, or null when the call was rejected.
 */
public suspend fun ApplicationCall.requireStaffWithRole(minimumRole: StaffRole): StaffPrincipal? {
    val staff = principal<StaffPrincipal>()
    if (staff == null) {
        respond(HttpStatusCode.Unauthorized, mapOf("error" to "Authentication required"))
        return null
    }
    if (!staff.role.satisfies(minimumRole)) {
        respond(
            HttpStatusCode.Forbidden,
            mapOf("error" to "Insufficient role: requires $minimumRole or above"),
        )
        return null
    }
    return staff
}
