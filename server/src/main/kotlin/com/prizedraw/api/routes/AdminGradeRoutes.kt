package com.prizedraw.api.routes

import com.prizedraw.api.plugins.StaffPrincipal
import com.prizedraw.api.plugins.satisfies
import com.prizedraw.application.usecases.admin.CampaignGradeUseCases
import com.prizedraw.application.usecases.admin.GradeTemplateUseCases
import com.prizedraw.contracts.dto.grade.ApplyGradeTemplateRequest
import com.prizedraw.contracts.dto.grade.BatchUpdateCampaignGradesRequest
import com.prizedraw.contracts.dto.grade.CampaignGradeDto
import com.prizedraw.contracts.dto.grade.CreateGradeTemplateRequest
import com.prizedraw.contracts.dto.grade.GradeTemplateDto
import com.prizedraw.contracts.dto.grade.GradeTemplateItemDto
import com.prizedraw.contracts.dto.grade.UpdateGradeTemplateRequest
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.entities.GradeTemplate
import com.prizedraw.domain.valueobjects.CampaignId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import java.util.UUID

/**
 * Registers admin grade template and campaign grade routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and
 * [StaffRole.OPERATOR] or above (enforced inline per handler).
 *
 * Grade Template routes:
 * - GET [AdminEndpoints.GRADE_TEMPLATES]        -- list all templates
 * - POST   [AdminEndpoints.GRADE_TEMPLATES]        -- create template
 * - PUT [AdminEndpoints.GRADE_TEMPLATE_BY_ID]   -- update template
 * - DELETE [AdminEndpoints.GRADE_TEMPLATE_BY_ID]   -- delete template
 *
 * Campaign Grade routes:
 * - GET [AdminEndpoints.CAMPAIGN_GRADES]        -- list campaign grades
 * - POST   [AdminEndpoints.CAMPAIGN_GRADES_APPLY]  -- apply template to campaign
 * - PUT [AdminEndpoints.CAMPAIGN_GRADES]        -- batch update campaign grades
 */
public fun Route.adminGradeRoutes() {
    adminGradeTemplateRoutes()
    adminGradeTemplateUpdateRoutes()
    adminCampaignGradeRoutes()
    adminCampaignGradeBatchUpdateRoute()
}

// --- Grade Template routes ---

private fun Route.adminGradeTemplateRoutes() {
    val gradeTemplateUseCases: GradeTemplateUseCases by inject()

    get(AdminEndpoints.GRADE_TEMPLATES) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@get
        val templates = gradeTemplateUseCases.listTemplates()
        call.respond(HttpStatusCode.OK, templates.map { it.toDto() })
    }

    post(AdminEndpoints.GRADE_TEMPLATES) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@post
        val req = call.receive<CreateGradeTemplateRequest>()
        runCatching {
            gradeTemplateUseCases.createTemplate(
                staffId = staff.staffId.value,
                name = req.name,
                items =
                    req.items.map { item ->
                        GradeTemplateUseCases.ItemInput(
                            name = item.name,
                            displayOrder = item.displayOrder,
                            colorCode = item.colorCode,
                            bgColorCode = item.bgColorCode,
                        )
                    },
            )
        }.fold(
            onSuccess = { template -> call.respond(HttpStatusCode.Created, template.toDto()) },
            onFailure = { e ->
                when (e) {
                    is IllegalArgumentException ->
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    else ->
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
                }
            },
        )
    }

    delete(AdminEndpoints.GRADE_TEMPLATE_BY_ID) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@delete
        val templateId = call.parseTemplateId() ?: return@delete
        gradeTemplateUseCases.deleteTemplate(templateId)
        call.respond(HttpStatusCode.NoContent)
    }
}

// --- Grade Template update route ---

private fun Route.adminGradeTemplateUpdateRoutes() {
    val gradeTemplateUseCases: GradeTemplateUseCases by inject()

    put(AdminEndpoints.GRADE_TEMPLATE_BY_ID) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@put
        val templateId = call.parseTemplateId() ?: return@put
        val req = call.receive<UpdateGradeTemplateRequest>()
        runCatching {
            gradeTemplateUseCases.updateTemplate(
                id = templateId,
                name = req.name,
                items =
                    req.items.map { item ->
                        GradeTemplateUseCases.ItemInput(
                            name = item.name,
                            displayOrder = item.displayOrder,
                            colorCode = item.colorCode,
                            bgColorCode = item.bgColorCode,
                        )
                    },
            )
        }.fold(
            onSuccess = { template ->
                if (template == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Grade template not found"))
                } else {
                    call.respond(HttpStatusCode.OK, template.toDto())
                }
            },
            onFailure = { e ->
                when (e) {
                    is IllegalArgumentException ->
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    else ->
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
                }
            },
        )
    }
}

// --- Campaign Grade routes ---

private fun Route.adminCampaignGradeRoutes() {
    val campaignGradeUseCases: CampaignGradeUseCases by inject()

    get(AdminEndpoints.CAMPAIGN_GRADES) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@get
        val campaignId = call.parseCampaignIdForGrades() ?: return@get
        val grades = campaignGradeUseCases.listGrades(campaignId)
        call.respond(HttpStatusCode.OK, grades.map { it.toDto() })
    }

    post(AdminEndpoints.CAMPAIGN_GRADES_APPLY) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@post
        val campaignId = call.parseCampaignIdForGrades() ?: return@post
        val req = call.receive<ApplyGradeTemplateRequest>()
        runCatching {
            val templateId = UUID.fromString(req.templateId)
            campaignGradeUseCases.applyTemplate(
                campaignId = campaignId,
                templateId = templateId,
                mode = req.mode,
            )
        }.fold(
            onSuccess = { grades -> call.respond(HttpStatusCode.OK, grades.map { it.toDto() }) },
            onFailure = { e ->
                when (e) {
                    is IllegalStateException ->
                        call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
                    is IllegalArgumentException ->
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    else ->
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
                }
            },
        )
    }
}

// --- Campaign Grade batch update route ---

private fun Route.adminCampaignGradeBatchUpdateRoute() {
    val campaignGradeUseCases: CampaignGradeUseCases by inject()

    put(AdminEndpoints.CAMPAIGN_GRADES) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@put
        val campaignId = call.parseCampaignIdForGrades() ?: return@put
        val req = call.receive<BatchUpdateCampaignGradesRequest>()
        runCatching {
            campaignGradeUseCases.batchUpdate(
                campaignId = campaignId,
                grades =
                    req.grades.map { g ->
                        CampaignGradeUseCases.GradeInput(
                            id = g.id,
                            name = g.name,
                            displayOrder = g.displayOrder,
                            colorCode = g.colorCode,
                            bgColorCode = g.bgColorCode,
                        )
                    },
            )
        }.fold(
            onSuccess = { grades -> call.respond(HttpStatusCode.OK, grades.map { it.toDto() }) },
            onFailure = { e ->
                when (e) {
                    is IllegalStateException ->
                        call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
                    is IllegalArgumentException ->
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    else ->
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
                }
            },
        )
    }
}

// --- Helpers ---

private suspend fun io.ktor.server.application.ApplicationCall.requireStaff(minimumRole: StaffRole): StaffPrincipal? {
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

private suspend fun io.ktor.server.application.ApplicationCall.parseTemplateId(): UUID? {
    val raw =
        parameters["templateId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing templateId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid templateId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parseCampaignIdForGrades(): CampaignId? {
    val raw =
        parameters["campaignId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignId"))
            return null
        }
    return runCatching { CampaignId(UUID.fromString(raw)) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
        null
    }
}

// --- Mapping helpers ---

private fun GradeTemplate.toDto(): GradeTemplateDto =
    GradeTemplateDto(
        id = id.toString(),
        name = name,
        items =
            items.map { item ->
                GradeTemplateItemDto(
                    id = item.id.toString(),
                    name = item.name,
                    displayOrder = item.displayOrder,
                    colorCode = item.colorCode,
                    bgColorCode = item.bgColorCode,
                )
            },
    )

private fun CampaignGrade.toDto(): CampaignGradeDto =
    CampaignGradeDto(
        id = id.value.toString(),
        name = name,
        displayOrder = displayOrder,
        colorCode = colorCode,
        bgColorCode = bgColorCode,
    )
