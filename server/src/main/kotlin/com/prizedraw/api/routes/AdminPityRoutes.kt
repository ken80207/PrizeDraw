package com.prizedraw.api.routes

import com.prizedraw.application.usecases.admin.DeletePityRuleUseCase
import com.prizedraw.application.usecases.admin.GetPityRuleUseCase
import com.prizedraw.application.usecases.admin.UpsertPityRuleUseCase
import com.prizedraw.contracts.dto.pity.UpsertPityRuleRequest
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import org.koin.ktor.ext.inject
import java.util.UUID

/** Admin routes for managing pity rules on campaigns. */
public fun Route.adminPityRoutes() {
    val getPityRule: GetPityRuleUseCase by inject()
    val upsertPityRule: UpsertPityRuleUseCase by inject()
    val deletePityRule: DeletePityRuleUseCase by inject()

    get("/api/v1/admin/campaigns/{id}/pity-rule") {
        val campaignId = UUID.fromString(call.parameters["id"])
        val rule = getPityRule.execute(campaignId)
        if (rule != null) {
            call.respond(HttpStatusCode.OK, rule)
        } else {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "No pity rule configured"))
        }
    }

    put("/api/v1/admin/campaigns/{id}/pity-rule") {
        val campaignId = UUID.fromString(call.parameters["id"])
        val request = call.receive<UpsertPityRuleRequest>()
        val result = upsertPityRule.execute(campaignId, request)
        call.respond(HttpStatusCode.OK, result)
    }

    delete("/api/v1/admin/campaigns/{id}/pity-rule") {
        val campaignId = UUID.fromString(call.parameters["id"])
        deletePityRule.execute(campaignId)
        call.respond(HttpStatusCode.NoContent)
    }
}
