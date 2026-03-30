package com.prizedraw.api.routes

import com.prizedraw.api.mappers.toDto
import com.prizedraw.api.plugins.StaffPrincipal
import com.prizedraw.api.plugins.satisfies
import com.prizedraw.application.ports.input.admin.IAddTicketBoxUseCase
import com.prizedraw.application.ports.input.admin.ICreateKujiCampaignUseCase
import com.prizedraw.application.ports.input.admin.IUpdateCampaignStatusUseCase
import com.prizedraw.application.ports.input.admin.IUpdateCampaignUseCase
import com.prizedraw.application.ports.output.ICampaignGradeRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.admin.AdminCampaignNotFoundException
import com.prizedraw.application.usecases.admin.ApproveCampaignUseCase
import com.prizedraw.application.usecases.admin.CreateUnlimitedCampaignUseCase
import com.prizedraw.application.usecases.admin.GetRiskSettingsUseCase
import com.prizedraw.application.usecases.admin.InvalidCampaignTransitionException
import com.prizedraw.application.usecases.admin.UpdateUnlimitedPrizeTableUseCase
import com.prizedraw.contracts.dto.admin.ChangeCampaignStatusRequest
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.dto.admin.CreateKujiCampaignAdminRequest
import com.prizedraw.contracts.dto.admin.CreateUnlimitedCampaignAdminRequest
import com.prizedraw.contracts.dto.admin.RiskSettingsUpdateRequest
import com.prizedraw.contracts.dto.admin.UpdateCampaignAdminRequest
import com.prizedraw.contracts.dto.admin.UpdatePrizeTableRequest
import com.prizedraw.contracts.dto.campaign.KujiCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.TicketBoxDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.grade.CampaignGradeDto
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.contracts.enums.TicketBoxStatus
import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.services.LowMarginException
import com.prizedraw.domain.valueobjects.CampaignId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import org.koin.ktor.ext.getKoin
import java.util.UUID

/**
 * Registers admin campaign management routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and
 * [StaffRole.OPERATOR] or above (enforced inline per handler).
 *
 * - POST   [AdminEndpoints.CAMPAIGNS_KUJI]      -- create kuji campaign
 * - POST   [AdminEndpoints.CAMPAIGNS_UNLIMITED] -- create unlimited campaign
 * - GET [AdminEndpoints.CAMPAIGNS]            -- list all campaigns (filterable)
 * - GET [AdminEndpoints.CAMPAIGN_BY_ID]       -- campaign detail
 * - PATCH  [AdminEndpoints.CAMPAIGN_BY_ID]       -- update name/description/coverImage
 * - PATCH  [AdminEndpoints.CAMPAIGN_STATUS]      -- change campaign status
 * - PATCH  [AdminEndpoints.UNLIMITED_PRIZE_TABLE] -- replace unlimited prize table
 * - POST   [AdminEndpoints.CAMPAIGN_APPROVE]      -- approve campaign (MANAGER)
 * - POST   [AdminEndpoints.CAMPAIGN_REJECT]       -- reject campaign (MANAGER)
 * - GET [AdminEndpoints.RISK_SETTINGS]         -- read risk settings (ADMIN)
 * - PATCH  [AdminEndpoints.RISK_SETTINGS]         -- update risk settings (ADMIN)
 */
public fun Route.adminCampaignRoutes() {
    adminCampaignCreateRoutes()
    adminCampaignQueryRoutes()
    adminCampaignMutationRoutes()
    adminCampaignBoxRoutes()
    adminCampaignPrizeAndRiskRoutes()
    adminPityRoutes()
}

// --- Create routes ---

private fun Route.adminCampaignCreateRoutes() {
    val createKuji: ICreateKujiCampaignUseCase by inject()
    val createUnlimitedImpl: CreateUnlimitedCampaignUseCase by inject()

    post(AdminEndpoints.CAMPAIGNS_KUJI) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@post
        val req = call.receive<CreateKujiCampaignAdminRequest>()
        val campaign =
            org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction {
                createKuji.execute(
                    staffId = staff.staffId,
                    title = req.title,
                    description = req.description,
                    coverImageUrl = req.coverImageUrl,
                    pricePerDraw = req.pricePerDraw,
                    drawSessionSeconds = req.drawSessionSeconds,
                    boxes = req.boxes,
                )
            }
        call.respond(HttpStatusCode.Created, campaign.toDto())
    }

    post(AdminEndpoints.CAMPAIGNS_UNLIMITED) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@post
        val req = call.receive<CreateUnlimitedCampaignAdminRequest>()
        val (campaign, marginResult) =
            org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction {
                createUnlimitedImpl.executeWithPrizeTable(
                    staffId = staff.staffId,
                    title = req.title,
                    description = req.description,
                    coverImageUrl = req.coverImageUrl,
                    pricePerDraw = req.pricePerDraw,
                    rateLimitPerSecond = req.rateLimitPerSecond,
                    prizeTable = req.prizeTable,
                )
            }
        val response =
            mapOf(
                "campaign" to campaign.toDto(),
                "marginResult" to marginResult?.toDto(),
            )
        call.respond(HttpStatusCode.Created, response)
    }
}

// --- Query routes ---

private fun Route.adminCampaignQueryRoutes() {
    val campaignRepository: ICampaignRepository by inject()
    val ticketBoxRepository: ITicketBoxRepository by inject()
    val prizeRepository: IPrizeRepository by inject()
    val drawRepository: IDrawRepository by inject()
    val campaignGradeRepository: ICampaignGradeRepository by inject()
    val pityRepository: com.prizedraw.application.ports.output.IPityRepository? =
        runCatching { application.getKoin().get<com.prizedraw.application.ports.output.IPityRepository>() }.getOrNull()

    get(AdminEndpoints.CAMPAIGNS) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@get
        val typeParam = call.request.queryParameters["type"]
        val statusParam = call.request.queryParameters["status"]
        val filterStatus =
            statusParam?.let {
                runCatching { CampaignStatus.valueOf(it) }.getOrNull()
            }
        val items = buildCampaignList(typeParam, filterStatus, campaignRepository)
        call.respond(HttpStatusCode.OK, items)
    }

    get(AdminEndpoints.CAMPAIGN_BY_ID) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@get
        val campaignId = call.parseCampaignId() ?: return@get
        val typeParam = call.request.queryParameters["type"] ?: "kuji"
        val response =
            buildCampaignDetail(
                typeParam,
                campaignId,
                campaignRepository,
                ticketBoxRepository,
                prizeRepository,
                campaignGradeRepository,
                pityRepository,
            )
        if (response == null) {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "Campaign not found"))
        } else {
            call.respond(HttpStatusCode.OK, response)
        }
    }

    get(AdminEndpoints.CAMPAIGN_DRAW_RECORDS) {
        call.requireStaff(StaffRole.OPERATOR) ?: return@get
        val campaignId = call.parseCampaignId() ?: return@get
        val limit =
            call.request.queryParameters["limit"]
                ?.toIntOrNull()
                ?.coerceIn(1, 200)
                ?: 50
        val records = drawRepository.findDrawnByCampaign(campaignId, limit)
        call.respond(HttpStatusCode.OK, records)
    }
}

// --- Mutation routes ---

private fun Route.adminCampaignMutationRoutes() {
    val updateStatus: IUpdateCampaignStatusUseCase by inject()
    val updateCampaign: IUpdateCampaignUseCase by inject()

    patch(AdminEndpoints.CAMPAIGN_BY_ID) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@patch
        val campaignId = call.parseCampaignId() ?: return@patch
        val typeParam = call.request.queryParameters["type"] ?: "kuji"
        val campaignType = parseCampaignType(typeParam)
        val req = call.receive<UpdateCampaignAdminRequest>()
        runCatching {
            updateCampaign.execute(
                staffId = staff.staffId,
                campaignId = campaignId,
                campaignType = campaignType,
                title = req.title,
                description = req.description,
                coverImageUrl = req.coverImageUrl,
                confirmProbabilityUpdate = req.confirmProbabilityUpdate,
            )
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { e -> call.respondError(e) },
        )
    }

    patch(AdminEndpoints.CAMPAIGN_STATUS) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@patch
        val campaignId = call.parseCampaignId() ?: return@patch
        val typeParam = call.request.queryParameters["type"] ?: "kuji"
        val campaignType = parseCampaignType(typeParam)
        val req = call.receive<ChangeCampaignStatusRequest>()
        runCatching {
            updateStatus.execute(
                staffId = staff.staffId,
                campaignId = campaignId,
                campaignType = campaignType,
                newStatus = req.status,
                confirmLowMargin = req.confirmLowMargin,
            )
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { e -> call.respondError(e) },
        )
    }
}

// --- Ticket box (restock) routes ---

private fun Route.adminCampaignBoxRoutes() {
    val addTicketBox: IAddTicketBoxUseCase by inject()

    post(AdminEndpoints.CAMPAIGN_BOXES) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@post
        val campaignId = call.parseCampaignId() ?: return@post
        val boxes = call.receive<List<CreateKujiBoxRequest>>()
        runCatching {
            addTicketBox.execute(
                staffId = staff.staffId,
                campaignId = campaignId,
                boxes = boxes,
            )
        }.fold(
            onSuccess = { created -> call.respond(HttpStatusCode.Created, created.map { it.toDto() }) },
            onFailure = { e -> call.respondError(e) },
        )
    }
}

// --- Prize table, approval, and risk settings routes ---

private fun Route.adminCampaignPrizeAndRiskRoutes() {
    val updatePrizeTable: UpdateUnlimitedPrizeTableUseCase by inject()
    val approveCampaign: ApproveCampaignUseCase by inject()
    val riskSettings: GetRiskSettingsUseCase by inject()

    // Prize table update (unlimited only, DRAFT status)
    patch(AdminEndpoints.UNLIMITED_PRIZE_TABLE) {
        val staff = call.requireStaff(StaffRole.OPERATOR) ?: return@patch
        val campaignId = call.parseCampaignId() ?: return@patch
        val req = call.receive<UpdatePrizeTableRequest>()
        runCatching {
            updatePrizeTable.execute(campaignId, req, staff.staffId)
        }.fold(
            onSuccess = { result -> call.respond(HttpStatusCode.OK, result.toDto()) },
            onFailure = { e -> call.respondError(e) },
        )
    }

    // Approval endpoints (pre-built, requires MANAGER role)
    post(AdminEndpoints.CAMPAIGN_APPROVE) {
        val staff = call.requireStaff(StaffRole.MANAGER) ?: return@post
        val campaignId = call.parseCampaignId() ?: return@post
        runCatching {
            approveCampaign.approve(campaignId, staff.staffId)
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.OK) },
            onFailure = { e -> call.respondError(e) },
        )
    }

    post(AdminEndpoints.CAMPAIGN_REJECT) {
        val staff = call.requireStaff(StaffRole.MANAGER) ?: return@post
        val campaignId = call.parseCampaignId() ?: return@post
        runCatching {
            approveCampaign.reject(campaignId, staff.staffId)
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.OK) },
            onFailure = { e -> call.respondError(e) },
        )
    }

    // Risk settings
    get(AdminEndpoints.RISK_SETTINGS) {
        call.requireStaff(StaffRole.ADMIN) ?: return@get
        val settings = riskSettings.get()
        call.respond(HttpStatusCode.OK, settings)
    }

    patch(AdminEndpoints.RISK_SETTINGS) {
        val staff = call.requireStaff(StaffRole.ADMIN) ?: return@patch
        val req = call.receive<RiskSettingsUpdateRequest>()
        runCatching {
            riskSettings.update(req, staff.staffId)
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.OK, riskSettings.get()) },
            onFailure = { e -> call.respondError(e) },
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

private suspend fun io.ktor.server.application.ApplicationCall.parseCampaignId(): CampaignId? {
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

private fun parseCampaignType(raw: String): CampaignType =
    when (raw.lowercase()) {
        "unlimited" -> CampaignType.UNLIMITED
        else -> CampaignType.KUJI
    }

private suspend fun io.ktor.server.application.ApplicationCall.respondError(e: Throwable) {
    when (e) {
        is InvalidCampaignTransitionException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
        is AdminCampaignNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        is LowMarginException ->
            respond(HttpStatusCode.UnprocessableEntity, e.marginResult.toDto())
        is IllegalStateException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
    }
}

private suspend fun buildCampaignList(
    typeParam: String?,
    filterStatus: CampaignStatus?,
    campaignRepository: ICampaignRepository,
): List<Map<String, Any?>> {
    val kujiItems =
        if (typeParam == null || typeParam.equals("kuji", ignoreCase = true)) {
            campaignRepository.findAllKuji(filterStatus).map { it.toAdminListItem() }
        } else {
            emptyList()
        }
    val unlimitedItems =
        if (typeParam == null || typeParam.equals("unlimited", ignoreCase = true)) {
            campaignRepository.findAllUnlimited(filterStatus).map { it.toAdminListItem() }
        } else {
            emptyList()
        }
    return kujiItems + unlimitedItems
}

@Suppress("LongParameterList")
private suspend fun buildCampaignDetail(
    typeParam: String,
    campaignId: CampaignId,
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
    prizeRepository: IPrizeRepository,
    campaignGradeRepository: ICampaignGradeRepository,
    pityRepository: com.prizedraw.application.ports.output.IPityRepository? = null,
): Any? =
    when (typeParam.lowercase()) {
        "unlimited" -> {
            val campaign = campaignRepository.findUnlimitedById(campaignId) ?: return null
            val prizes =
                prizeRepository.findDefinitionsByCampaign(
                    campaignId,
                    CampaignType.UNLIMITED,
                )
            val grades = campaignGradeRepository.findByCampaignId(campaignId)
            val gradeMap = grades.associateBy { it.id }
            val pityInfo =
                pityRepository?.let { repo ->
                    val rule = repo.findRuleByCampaignId(campaignId)
                    if (rule != null && rule.enabled) {
                        com.prizedraw.contracts.dto.pity.PityInfoDto(
                            enabled = true,
                            threshold = rule.threshold,
                            mode = rule.accumulationMode.name,
                            sessionTimeoutSeconds = rule.sessionTimeoutSeconds,
                        )
                    } else {
                        null
                    }
                }
            UnlimitedCampaignDetailDto(
                campaign = campaign.toDto(),
                prizes = prizes.map { it.toDto(gradeMap) },
                grades = grades.map { it.toDto() },
                pityInfo = pityInfo,
            )
        }
        else -> {
            val campaign = campaignRepository.findKujiById(campaignId) ?: return null
            val boxes = ticketBoxRepository.findByCampaignId(campaignId)
            val prizes =
                prizeRepository.findDefinitionsByCampaign(
                    campaignId,
                    CampaignType.KUJI,
                )
            val grades = campaignGradeRepository.findByCampaignId(campaignId)
            val gradeMap = grades.associateBy { it.id }
            KujiCampaignDetailDto(
                campaign = campaign.toDto(),
                boxes = boxes.map { it.toDto() },
                prizes = prizes.map { it.toDto(gradeMap) },
                grades = grades.map { it.toDto() },
            )
        }
    }

// --- Mapping helpers ---

private fun KujiCampaign.toDto(): KujiCampaignDto =
    KujiCampaignDto(
        id = id.value.toString(),
        title = title,
        description = description,
        coverImageUrl = coverImageUrl,
        pricePerDraw = pricePerDraw,
        drawSessionSeconds = drawSessionSeconds,
        status = status,
        activatedAt = activatedAt,
        soldOutAt = soldOutAt,
    )

private fun UnlimitedCampaign.toDto(): UnlimitedCampaignDto =
    UnlimitedCampaignDto(
        id = id.value.toString(),
        title = title,
        description = description,
        coverImageUrl = coverImageUrl,
        pricePerDraw = pricePerDraw,
        rateLimitPerSecond = rateLimitPerSecond,
        status = status,
        activatedAt = activatedAt,
    )

private fun TicketBox.toDto(): TicketBoxDto =
    TicketBoxDto(
        id = id.toString(),
        name = name,
        totalTickets = totalTickets,
        remainingTickets = remainingTickets,
        status = TicketBoxStatus.valueOf(status.name),
        displayOrder = displayOrder,
    )

private fun CampaignGrade.toDto(): CampaignGradeDto =
    CampaignGradeDto(
        id = id.value.toString(),
        name = name,
        displayOrder = displayOrder,
        colorCode = colorCode,
        bgColorCode = bgColorCode,
    )

private fun PrizeDefinition.toDto(
    gradeMap: Map<com.prizedraw.domain.valueobjects.CampaignGradeId, CampaignGrade> = emptyMap(),
): PrizeDefinitionDto {
    val grade = campaignGradeId?.let { gradeMap[it] }
    return PrizeDefinitionDto(
        id = id.value.toString(),
        grade = this.grade,
        name = name,
        photos = photos,
        prizeValue = prizeValue,
        buybackPrice = buybackPrice,
        buybackEnabled = buybackEnabled,
        probabilityBps = probabilityBps,
        ticketCount = ticketCount,
        displayOrder = displayOrder,
        campaignGradeId = campaignGradeId?.value?.toString(),
        campaignGrade = grade?.toDto(),
    )
}

private fun KujiCampaign.toAdminListItem(): Map<String, String> =
    mapOf(
        "id" to id.value.toString(),
        "title" to title,
        "type" to "KUJI",
        "status" to status.name,
        "pricePerDraw" to pricePerDraw.toString(),
        "createdAt" to createdAt.toString(),
    )

private fun UnlimitedCampaign.toAdminListItem(): Map<String, String> =
    mapOf(
        "id" to id.value.toString(),
        "title" to title,
        "type" to "UNLIMITED",
        "status" to status.name,
        "pricePerDraw" to pricePerDraw.toString(),
        "createdAt" to createdAt.toString(),
    )
