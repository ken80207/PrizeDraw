@file:Suppress("DEPRECATION")

package com.prizedraw.api.plugins

import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.valueobjects.StaffId
import io.ktor.server.routing.Route
import io.ktor.server.routing.RouteSelector
import io.ktor.server.routing.RouteSelectorEvaluation
import io.ktor.server.routing.RoutingResolveContext

/**
 * Authenticated staff principal carrying [staffId] and [role] from a valid staff JWT.
 *
 * Produced by the `"staff"` bearer authentication scheme registered in [configureSecurity].
 * Implements [io.ktor.server.auth.Principal] — the interface is deprecated at the declaration
 * level in Ktor 3 but is still required as the marker type for `call.principal<T>()` lookup.
 *
 * @property staffId The staff member's unique identifier.
 * @property role The staff member's permission level at token issuance.
 */
public data class StaffPrincipal(
    val staffId: StaffId,
    val role: StaffRole,
) : io.ktor.server.auth.Principal

/**
 * Role hierarchy predicate.
 *
 * A staff member satisfies a required role if their role ordinal is equal or higher.
 * Hierarchy (ascending ordinal): CUSTOMER_SERVICE < OPERATOR < ADMIN < OWNER.
 *
 * @param required Minimum acceptable role.
 * @return True when this role has at least the [required] permission level.
 */
public fun StaffRole.satisfies(required: StaffRole): Boolean = ordinal >= required.ordinal

/**
 * A transparent [RouteSelector] used to attach the staff role minimum to a route subtree.
 *
 * The role guard itself is implemented in route handlers via an explicit principal check
 * at the start of each handler, keeping it testable without relying on pipeline interceptors.
 */
public class StaffRoleSelector(
    public val minimumRole: StaffRole,
) : RouteSelector() {
    override suspend fun evaluate(
        context: RoutingResolveContext,
        segmentIndex: Int,
    ): RouteSelectorEvaluation = RouteSelectorEvaluation.Transparent

    override fun toString(): String = "StaffRole(minimum=$minimumRole)"
}

/**
 * Wraps [build] in a route subtree that documents the staff role requirement.
 *
 * Must be invoked inside an `authenticate("staff") { }` block. The actual enforcement
 * is performed inline by each handler via `call.principal<StaffPrincipal>()`.
 */
public fun Route.withMinimumRole(
    minimumRole: StaffRole,
    build: Route.() -> Unit,
): Route = createChild(StaffRoleSelector(minimumRole)).apply(build)
