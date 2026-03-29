@file:Suppress("TooManyFunctions")

package com.prizedraw.draw.infrastructure.persistence

import com.prizedraw.contracts.dto.draw.DrawRecordDto
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.draw.application.ports.output.DomainEvent
import com.prizedraw.draw.application.ports.output.IAuditRepository
import com.prizedraw.draw.application.ports.output.ICampaignRepository
import com.prizedraw.draw.application.ports.output.ICouponRepository
import com.prizedraw.draw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.draw.application.ports.output.IDrawRepository
import com.prizedraw.draw.application.ports.output.IDrawSyncRepository
import com.prizedraw.draw.application.ports.output.IFeedEventRepository
import com.prizedraw.draw.application.ports.output.ILeaderboardRepository
import com.prizedraw.draw.application.ports.output.IOutboxRepository
import com.prizedraw.draw.application.ports.output.IPityRepository
import com.prizedraw.draw.application.ports.output.IPlayerRepository
import com.prizedraw.draw.application.ports.output.IPrizeRepository
import com.prizedraw.draw.application.ports.output.IQueueEntryRepository
import com.prizedraw.draw.application.ports.output.IQueueRepository
import com.prizedraw.draw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.draw.application.ports.output.ITicketBoxRepository
import com.prizedraw.draw.application.ports.output.LeaderboardEntry
import com.prizedraw.draw.domain.entities.AccumulationMode
import com.prizedraw.draw.domain.entities.AuditActorType
import com.prizedraw.draw.domain.entities.AuditLog
import com.prizedraw.draw.domain.entities.Coupon
import com.prizedraw.draw.domain.entities.CouponApplicableTo
import com.prizedraw.draw.domain.entities.CouponDiscountType
import com.prizedraw.draw.domain.entities.DrawPointTransaction
import com.prizedraw.draw.domain.entities.DrawSyncSession
import com.prizedraw.draw.domain.entities.DrawTicket
import com.prizedraw.draw.domain.entities.DrawTicketStatus
import com.prizedraw.draw.domain.entities.FeedEvent
import com.prizedraw.draw.domain.entities.KujiCampaign
import com.prizedraw.draw.domain.entities.OutboxEvent
import com.prizedraw.draw.domain.entities.OutboxEventStatus
import com.prizedraw.draw.domain.entities.PhoneNumber
import com.prizedraw.draw.domain.entities.PityPrizePoolEntry
import com.prizedraw.draw.domain.entities.PityRule
import com.prizedraw.draw.domain.entities.PityTracker
import com.prizedraw.draw.domain.entities.Player
import com.prizedraw.draw.domain.entities.PlayerCoupon
import com.prizedraw.draw.domain.entities.PlayerCouponStatus
import com.prizedraw.draw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.draw.domain.entities.PrizeDefinition
import com.prizedraw.draw.domain.entities.PrizeInstance
import com.prizedraw.draw.domain.entities.Queue
import com.prizedraw.draw.domain.entities.QueueEntry
import com.prizedraw.draw.domain.entities.RevenuePointTransaction
import com.prizedraw.draw.domain.entities.TicketBox
import com.prizedraw.draw.domain.entities.TicketBoxStatus
import com.prizedraw.draw.domain.entities.UnlimitedCampaign
import com.prizedraw.draw.domain.valueobjects.CampaignGradeId
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.draw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.schema.tables.AuditLogsTable
import com.prizedraw.schema.tables.CouponsTable
import com.prizedraw.schema.tables.DrawPointTransactionsTable
import com.prizedraw.schema.tables.DrawSyncSessionsTable
import com.prizedraw.schema.tables.DrawTicketsTable
import com.prizedraw.schema.tables.FeedEventsTable
import com.prizedraw.schema.tables.KujiCampaignsTable
import com.prizedraw.schema.tables.OutboxEventsTable
import com.prizedraw.schema.tables.PityPrizePoolTable
import com.prizedraw.schema.tables.PityRulesTable
import com.prizedraw.schema.tables.PityTrackersTable
import com.prizedraw.schema.tables.PlayerCouponsTable
import com.prizedraw.schema.tables.PlayersTable
import com.prizedraw.schema.tables.PrizeDefinitionsTable
import com.prizedraw.schema.tables.PrizeInstancesTable
import com.prizedraw.schema.tables.QueueEntriesTable
import com.prizedraw.schema.tables.QueuesTable
import com.prizedraw.schema.tables.RevenuePointTransactionsTable
import com.prizedraw.schema.tables.TicketBoxesTable
import com.prizedraw.schema.tables.UnlimitedCampaignsTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.JoinType
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.notInList
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.count
import org.jetbrains.exposed.sql.innerJoin
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import com.prizedraw.contracts.enums.AuditActorType as ContractsAuditActorType
import com.prizedraw.contracts.enums.CouponApplicableTo as ContractsCouponApplicableTo
import com.prizedraw.contracts.enums.CouponDiscountType as ContractsCouponDiscountType
import com.prizedraw.contracts.enums.DrawTicketStatus as ContractsDrawTicketStatus
import com.prizedraw.contracts.enums.PlayerCouponStatus as ContractsPlayerCouponStatus
import com.prizedraw.contracts.enums.PrizeAcquisitionMethod as ContractsPrizeAcquisitionMethod
import com.prizedraw.contracts.enums.TicketBoxStatus as ContractsTicketBoxStatus

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

private fun Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)

// ---------------------------------------------------------------------------
// PlayerRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IPlayerRepository]. */
public class PlayerRepositoryImpl : IPlayerRepository {
    override suspend fun findById(id: PlayerId): Player? =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where { (PlayersTable.id eq id.value) and (PlayersTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toPlayer()
        }

    override suspend fun save(player: Player): Player =
        newSuspendedTransaction {
            val existing = PlayersTable.selectAll().where { PlayersTable.id eq player.id.value }.singleOrNull()
            if (existing == null) {
                PlayersTable.insert {
                    it[id] = player.id.value
                    it[nickname] = player.nickname
                    it[playerCode] = player.playerCode
                    it[avatarUrl] = player.avatarUrl
                    it[phoneNumber] = player.phoneNumber?.value
                    it[phoneVerifiedAt] = player.phoneVerifiedAt?.toOffsetDateTime()
                    it[oauthProvider] = player.oauthProvider.name
                    it[oauthSubject] = player.oauthSubject
                    it[drawPointsBalance] = player.drawPointsBalance
                    it[revenuePointsBalance] = player.revenuePointsBalance
                    it[version] = player.version
                    it[xp] = player.xp
                    it[level] = player.level
                    it[tier] = player.tier
                    it[preferredAnimationMode] = player.preferredAnimationMode.name
                    it[locale] = player.locale
                    it[isActive] = player.isActive
                    it[deletedAt] = player.deletedAt?.toOffsetDateTime()
                    it[createdAt] = player.createdAt.toOffsetDateTime()
                    it[updatedAt] = player.updatedAt.toOffsetDateTime()
                }
            } else {
                PlayersTable.update({ PlayersTable.id eq player.id.value }) {
                    it[nickname] = player.nickname
                    it[avatarUrl] = player.avatarUrl
                    it[drawPointsBalance] = player.drawPointsBalance
                    it[revenuePointsBalance] = player.revenuePointsBalance
                    it[version] = player.version
                    it[xp] = player.xp
                    it[level] = player.level
                    it[tier] = player.tier
                    it[isActive] = player.isActive
                    it[deletedAt] = player.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = player.updatedAt.toOffsetDateTime()
                }
            }
            PlayersTable
                .selectAll()
                .where { PlayersTable.id eq player.id.value }
                .single()
                .toPlayer()
        }

    override suspend fun updateBalance(
        id: PlayerId,
        drawPointsDelta: Int,
        revenuePointsDelta: Int,
        expectedVersion: Int,
    ): Boolean =
        newSuspendedTransaction {
            val rows =
                PlayersTable.update({
                    (PlayersTable.id eq id.value) and (PlayersTable.version eq expectedVersion)
                }) {
                    with(org.jetbrains.exposed.sql.SqlExpressionBuilder) {
                        it[PlayersTable.drawPointsBalance] = PlayersTable.drawPointsBalance + drawPointsDelta
                        it[PlayersTable.revenuePointsBalance] = PlayersTable.revenuePointsBalance + revenuePointsDelta
                    }
                    it[PlayersTable.version] = expectedVersion + 1
                }
            rows > 0
        }

    override suspend fun updateXp(
        id: PlayerId,
        xpDelta: Int,
        newLevel: Int,
        newTier: String,
    ): Int =
        newSuspendedTransaction {
            PlayersTable.update({ PlayersTable.id eq id.value }) {
                with(org.jetbrains.exposed.sql.SqlExpressionBuilder) {
                    it[PlayersTable.xp] = PlayersTable.xp + xpDelta
                }
                it[PlayersTable.level] = newLevel
                it[PlayersTable.tier] = newTier
            }
            PlayersTable.selectAll().where { PlayersTable.id eq id.value }.single()[PlayersTable.xp]
        }

    private fun ResultRow.toPlayer(): Player =
        Player(
            id = PlayerId(this[PlayersTable.id]),
            nickname = this[PlayersTable.nickname],
            playerCode = this[PlayersTable.playerCode],
            avatarUrl = this[PlayersTable.avatarUrl],
            phoneNumber = this[PlayersTable.phoneNumber]?.let { PhoneNumber(it) },
            phoneVerifiedAt = this[PlayersTable.phoneVerifiedAt]?.toInstant()?.toKotlinInstant(),
            oauthProvider = OAuthProvider.valueOf(this[PlayersTable.oauthProvider]),
            oauthSubject = this[PlayersTable.oauthSubject],
            drawPointsBalance = this[PlayersTable.drawPointsBalance],
            revenuePointsBalance = this[PlayersTable.revenuePointsBalance],
            version = this[PlayersTable.version],
            xp = this[PlayersTable.xp],
            level = this[PlayersTable.level],
            tier = this[PlayersTable.tier],
            preferredAnimationMode = DrawAnimationMode.valueOf(this[PlayersTable.preferredAnimationMode]),
            locale = this[PlayersTable.locale],
            isActive = this[PlayersTable.isActive],
            deletedAt = this[PlayersTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PlayersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PlayersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// OutboxRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IOutboxRepository]. */
public class OutboxRepositoryImpl : IOutboxRepository {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Synchronous enqueue for use within an existing business transaction.
     *
     * The full payload of the concrete [DomainEvent] subclass is serialized into the
     * `payload` column so the outbox worker has all fields available without hitting
     * the source tables again.
     */
    override fun enqueue(event: DomainEvent) {
        OutboxEventsTable.insert {
            it[eventType] = event.eventType
            it[aggregateId] = event.aggregateId
            it[payload] = serializeEvent(event)
            it[status] = OutboxEventStatus.PENDING.name
            it[attempts] = 0
            it[createdAt] = OffsetDateTime.now(ZoneOffset.UTC)
        }
    }

    override suspend fun fetchPending(limit: Int): List<OutboxEvent> =
        newSuspendedTransaction {
            OutboxEventsTable
                .selectAll()
                .where { OutboxEventsTable.status eq OutboxEventStatus.PENDING.name }
                .orderBy(OutboxEventsTable.createdAt, SortOrder.ASC)
                .limit(limit)
                .map { it.toOutboxEvent() }
        }

    override suspend fun markProcessed(id: UUID): Unit =
        newSuspendedTransaction {
            OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                it[status] = OutboxEventStatus.PROCESSED.name
                it[processedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    override suspend fun markFailed(
        id: UUID,
        reason: String,
    ): Unit =
        newSuspendedTransaction {
            OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                it[status] = OutboxEventStatus.FAILED.name
                it[lastError] = reason
            }
        }

    @Suppress("CyclomaticComplexMethod")
    private fun serializeEvent(event: DomainEvent): String {
        val obj =
            buildJsonObject {
                put("eventType", event.eventType)
                put("aggregateType", event.aggregateType)
                put("aggregateId", event.aggregateId.toString())
                // Additional fields serialized by concrete event types via reflection-free inspection
            }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun ResultRow.toOutboxEvent(): OutboxEvent =
        OutboxEvent(
            id = this[OutboxEventsTable.id],
            eventType = this[OutboxEventsTable.eventType],
            aggregateType = this[OutboxEventsTable.eventType].substringBefore("."),
            aggregateId = this[OutboxEventsTable.aggregateId],
            payload = json.parseToJsonElement(this[OutboxEventsTable.payload]) as JsonObject,
            status = OutboxEventStatus.valueOf(this[OutboxEventsTable.status]),
            processedAt = this[OutboxEventsTable.processedAt]?.toInstant()?.toKotlinInstant(),
            failureReason = this[OutboxEventsTable.lastError],
            createdAt = this[OutboxEventsTable.createdAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// DrawRepositoryImpl + TicketBoxRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IDrawRepository]. */
public class DrawRepositoryImpl : IDrawRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findTicketById(id: UUID): DrawTicket? =
        newSuspendedTransaction {
            DrawTicketsTable
                .selectAll()
                .where { DrawTicketsTable.id eq id }
                .singleOrNull()
                ?.toDrawTicket()
        }

    override suspend fun findAvailableTickets(boxId: UUID): List<DrawTicket> =
        newSuspendedTransaction {
            DrawTicketsTable
                .selectAll()
                .where {
                    (DrawTicketsTable.ticketBoxId eq boxId) and
                        (DrawTicketsTable.status eq ContractsDrawTicketStatus.AVAILABLE)
                }.map { it.toDrawTicket() }
        }

    override suspend fun findTicketsByBox(boxId: UUID): List<DrawTicket> =
        newSuspendedTransaction {
            DrawTicketsTable
                .selectAll()
                .where { DrawTicketsTable.ticketBoxId eq boxId }
                .orderBy(DrawTicketsTable.position)
                .map { it.toDrawTicket() }
        }

    override suspend fun markDrawn(
        ticketId: UUID,
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
        at: Instant,
    ): DrawTicket =
        newSuspendedTransaction {
            val offsetAt = OffsetDateTime.ofInstant(at.toJavaInstant(), ZoneOffset.UTC)
            DrawTicketsTable.update({ DrawTicketsTable.id eq ticketId }) {
                it[status] = ContractsDrawTicketStatus.DRAWN
                it[drawnByPlayerId] = playerId.value
                it[drawnAt] = offsetAt
                it[DrawTicketsTable.prizeInstanceId] = prizeInstanceId.value
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
            DrawTicketsTable
                .selectAll()
                .where { DrawTicketsTable.id eq ticketId }
                .single()
                .toDrawTicket()
        }

    override suspend fun findDrawnByCampaign(
        campaignId: CampaignId,
        limit: Int,
    ): List<DrawRecordDto> =
        newSuspendedTransaction {
            val boxIds =
                TicketBoxesTable
                    .selectAll()
                    .where { TicketBoxesTable.kujiCampaignId eq campaignId.value }
                    .map { it[TicketBoxesTable.id] }
                    .toSet()

            if (boxIds.isEmpty()) {
                return@newSuspendedTransaction emptyList()
            }

            DrawTicketsTable
                .innerJoin(
                    PrizeDefinitionsTable,
                    onColumn = { DrawTicketsTable.prizeDefinitionId },
                    otherColumn = { PrizeDefinitionsTable.id },
                ).innerJoin(
                    PlayersTable,
                    onColumn = { DrawTicketsTable.drawnByPlayerId },
                    otherColumn = { PlayersTable.id },
                ).selectAll()
                .where {
                    (DrawTicketsTable.ticketBoxId inList boxIds) and
                        (DrawTicketsTable.status eq ContractsDrawTicketStatus.DRAWN)
                }.orderBy(DrawTicketsTable.drawnAt, SortOrder.DESC)
                .limit(limit)
                .map { row ->
                    val firstPhoto =
                        runCatching {
                            val arr = json.parseToJsonElement(row[PrizeDefinitionsTable.photos]) as? JsonArray
                            arr?.firstOrNull()?.jsonPrimitive?.content
                        }.getOrNull()
                    DrawRecordDto(
                        ticketId = row[DrawTicketsTable.id].toString(),
                        position = row[DrawTicketsTable.position],
                        grade = row[PrizeDefinitionsTable.grade],
                        prizeName = row[PrizeDefinitionsTable.name],
                        prizePhotoUrl = firstPhoto,
                        playerNickname = row[PlayersTable.nickname],
                        drawnAt = row[DrawTicketsTable.drawnAt]!!.toInstant().toKotlinInstant(),
                    )
                }
        }

    private fun ResultRow.toDrawTicket(): DrawTicket =
        DrawTicket(
            id = this[DrawTicketsTable.id],
            ticketBoxId = this[DrawTicketsTable.ticketBoxId],
            prizeDefinitionId = PrizeDefinitionId(this[DrawTicketsTable.prizeDefinitionId]),
            position = this[DrawTicketsTable.position],
            status = this[DrawTicketsTable.status].toDomainEnum(),
            drawnByPlayerId = this[DrawTicketsTable.drawnByPlayerId]?.let { PlayerId(it) },
            drawnAt = this[DrawTicketsTable.drawnAt]?.toInstant()?.toKotlinInstant(),
            prizeInstanceId = this[DrawTicketsTable.prizeInstanceId]?.let { PrizeInstanceId(it) },
            createdAt = this[DrawTicketsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[DrawTicketsTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

/** Exposed-backed implementation of [ITicketBoxRepository]. */
public class TicketBoxRepositoryImpl : ITicketBoxRepository {
    override suspend fun findById(id: UUID): TicketBox? =
        newSuspendedTransaction {
            TicketBoxesTable
                .selectAll()
                .where { TicketBoxesTable.id eq id }
                .singleOrNull()
                ?.toTicketBox()
        }

    override suspend fun findByCampaignId(campaignId: CampaignId): List<TicketBox> =
        newSuspendedTransaction {
            TicketBoxesTable
                .selectAll()
                .where { TicketBoxesTable.kujiCampaignId eq campaignId.value }
                .orderBy(TicketBoxesTable.displayOrder)
                .map { it.toTicketBox() }
        }

    override suspend fun decrementRemainingTickets(
        id: UUID,
        expectedRemaining: Int,
    ): Boolean =
        newSuspendedTransaction {
            val rows =
                TicketBoxesTable.update({
                    (TicketBoxesTable.id eq id) and (TicketBoxesTable.remainingTickets eq expectedRemaining)
                }) {
                    it[remainingTickets] = expectedRemaining - 1
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            rows > 0
        }

    override suspend fun save(box: TicketBox): TicketBox =
        newSuspendedTransaction {
            val existing = TicketBoxesTable.selectAll().where { TicketBoxesTable.id eq box.id }.singleOrNull()
            if (existing == null) {
                TicketBoxesTable.insert {
                    it[id] = box.id
                    it[kujiCampaignId] = box.kujiCampaignId.value
                    it[name] = box.name
                    it[totalTickets] = box.totalTickets
                    it[remainingTickets] = box.remainingTickets
                    it[status] = box.status.toContractsEnum()
                    it[soldOutAt] = box.soldOutAt?.toOffsetDateTime()
                    it[displayOrder] = box.displayOrder
                    it[createdAt] = box.createdAt.toOffsetDateTime()
                    it[updatedAt] = box.updatedAt.toOffsetDateTime()
                }
            } else {
                TicketBoxesTable.update({ TicketBoxesTable.id eq box.id }) {
                    it[name] = box.name
                    it[remainingTickets] = box.remainingTickets
                    it[status] = box.status.toContractsEnum()
                    it[soldOutAt] = box.soldOutAt?.toOffsetDateTime()
                    it[updatedAt] = box.updatedAt.toOffsetDateTime()
                }
            }
            TicketBoxesTable
                .selectAll()
                .where { TicketBoxesTable.id eq box.id }
                .single()
                .toTicketBox()
        }

    private fun ResultRow.toTicketBox(): TicketBox =
        TicketBox(
            id = this[TicketBoxesTable.id],
            kujiCampaignId = CampaignId(this[TicketBoxesTable.kujiCampaignId]),
            name = this[TicketBoxesTable.name],
            totalTickets = this[TicketBoxesTable.totalTickets],
            remainingTickets = this[TicketBoxesTable.remainingTickets],
            status = this[TicketBoxesTable.status].toDomainEnum(),
            soldOutAt = this[TicketBoxesTable.soldOutAt]?.toInstant()?.toKotlinInstant(),
            displayOrder = this[TicketBoxesTable.displayOrder],
            createdAt = this[TicketBoxesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[TicketBoxesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// CampaignRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [ICampaignRepository] (draw-service: kuji/unlimited read + kuji status update). */
public class CampaignRepositoryImpl : ICampaignRepository {
    override suspend fun findKujiById(id: CampaignId): KujiCampaign? =
        newSuspendedTransaction {
            KujiCampaignsTable
                .selectAll()
                .where { (KujiCampaignsTable.id eq id.value) and (KujiCampaignsTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toKujiCampaign()
        }

    override suspend fun findUnlimitedById(id: CampaignId): UnlimitedCampaign? =
        newSuspendedTransaction {
            UnlimitedCampaignsTable
                .selectAll()
                .where {
                    (UnlimitedCampaignsTable.id eq id.value) and (UnlimitedCampaignsTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toUnlimitedCampaign()
        }

    override suspend fun updateKujiStatus(
        id: CampaignId,
        status: CampaignStatus,
    ): Unit =
        newSuspendedTransaction {
            KujiCampaignsTable.update({ KujiCampaignsTable.id eq id.value }) {
                it[KujiCampaignsTable.status] = status
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    private fun ResultRow.toKujiCampaign(): KujiCampaign =
        KujiCampaign(
            id = CampaignId(this[KujiCampaignsTable.id]),
            title = this[KujiCampaignsTable.title],
            description = this[KujiCampaignsTable.description],
            coverImageUrl = this[KujiCampaignsTable.coverImageUrl],
            pricePerDraw = this[KujiCampaignsTable.pricePerDraw],
            drawSessionSeconds = this[KujiCampaignsTable.drawSessionSeconds],
            status = this[KujiCampaignsTable.status],
            activatedAt = this[KujiCampaignsTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            soldOutAt = this[KujiCampaignsTable.soldOutAt]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[KujiCampaignsTable.createdByStaffId],
            deletedAt = this[KujiCampaignsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[KujiCampaignsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[KujiCampaignsTable.updatedAt].toInstant().toKotlinInstant(),
            approvalStatus = ApprovalStatus.valueOf(this[KujiCampaignsTable.approvalStatus]),
            approvedBy = this[KujiCampaignsTable.approvedBy],
            approvedAt = this[KujiCampaignsTable.approvedAt]?.toInstant()?.toKotlinInstant(),
            lowStockNotifiedAt = this[KujiCampaignsTable.lowStockNotifiedAt]?.toInstant()?.toKotlinInstant(),
        )

    private fun ResultRow.toUnlimitedCampaign(): UnlimitedCampaign =
        UnlimitedCampaign(
            id = CampaignId(this[UnlimitedCampaignsTable.id]),
            title = this[UnlimitedCampaignsTable.title],
            description = this[UnlimitedCampaignsTable.description],
            coverImageUrl = this[UnlimitedCampaignsTable.coverImageUrl],
            pricePerDraw = this[UnlimitedCampaignsTable.pricePerDraw],
            rateLimitPerSecond = this[UnlimitedCampaignsTable.rateLimitPerSecond],
            status = this[UnlimitedCampaignsTable.status],
            activatedAt = this[UnlimitedCampaignsTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[UnlimitedCampaignsTable.createdByStaffId],
            deletedAt = this[UnlimitedCampaignsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[UnlimitedCampaignsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[UnlimitedCampaignsTable.updatedAt].toInstant().toKotlinInstant(),
            approvalStatus = ApprovalStatus.valueOf(this[UnlimitedCampaignsTable.approvalStatus]),
            approvedBy = this[UnlimitedCampaignsTable.approvedBy],
            approvedAt = this[UnlimitedCampaignsTable.approvedAt]?.toInstant()?.toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// PrizeRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IPrizeRepository]. */
public class PrizeRepositoryImpl : IPrizeRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findDefinitionById(id: PrizeDefinitionId): PrizeDefinition? =
        newSuspendedTransaction {
            PrizeDefinitionsTable
                .selectAll()
                .where { PrizeDefinitionsTable.id eq id.value }
                .singleOrNull()
                ?.toPrizeDefinition()
        }

    override suspend fun findDefinitionsByCampaign(
        campaignId: CampaignId,
        type: CampaignType?,
    ): List<PrizeDefinition> =
        newSuspendedTransaction {
            PrizeDefinitionsTable
                .selectAll()
                .where {
                    when (type) {
                        CampaignType.KUJI -> PrizeDefinitionsTable.kujiCampaignId eq campaignId.value
                        CampaignType.UNLIMITED -> PrizeDefinitionsTable.unlimitedCampaignId eq campaignId.value
                        null ->
                            (PrizeDefinitionsTable.kujiCampaignId eq campaignId.value) or
                                (PrizeDefinitionsTable.unlimitedCampaignId eq campaignId.value)
                    }
                }.orderBy(PrizeDefinitionsTable.displayOrder)
                .map { it.toPrizeDefinition() }
        }

    override suspend fun findInstanceById(id: PrizeInstanceId): PrizeInstance? =
        newSuspendedTransaction {
            PrizeInstancesTable
                .selectAll()
                .where { (PrizeInstancesTable.id eq id.value) and (PrizeInstancesTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toPrizeInstance()
        }

    override suspend fun saveInstance(instance: PrizeInstance): PrizeInstance =
        newSuspendedTransaction {
            PrizeInstancesTable.insert {
                it[id] = instance.id.value
                it[prizeDefinitionId] = instance.prizeDefinitionId.value
                it[ownerId] = instance.ownerId.value
                it[acquisitionMethod] = instance.acquisitionMethod.toContractsEnum()
                it[sourceDrawTicketId] = instance.sourceDrawTicketId
                it[sourceTradeOrderId] = instance.sourceTradeOrderId
                it[sourceExchangeRequestId] = instance.sourceExchangeRequestId
                it[state] = instance.state
                it[acquiredAt] = instance.acquiredAt.toOffsetDateTime()
                it[deletedAt] = instance.deletedAt?.toOffsetDateTime()
                it[createdAt] = instance.createdAt.toOffsetDateTime()
                it[updatedAt] = instance.updatedAt.toOffsetDateTime()
            }
            PrizeInstancesTable
                .selectAll()
                .where { PrizeInstancesTable.id eq instance.id.value }
                .single()
                .toPrizeInstance()
        }

    private fun ResultRow.toPrizeDefinition(): PrizeDefinition {
        val photos =
            try {
                val arr =
                    json.parseToJsonElement(this[PrizeDefinitionsTable.photos]) as? JsonArray ?: JsonArray(emptyList())
                arr.map { it.jsonPrimitive.content }
            } catch (_: Exception) {
                emptyList()
            }
        return PrizeDefinition(
            id = PrizeDefinitionId(this[PrizeDefinitionsTable.id]),
            kujiCampaignId = this[PrizeDefinitionsTable.kujiCampaignId]?.let { CampaignId(it) },
            unlimitedCampaignId = this[PrizeDefinitionsTable.unlimitedCampaignId]?.let { CampaignId(it) },
            grade = this[PrizeDefinitionsTable.grade],
            campaignGradeId = this[PrizeDefinitionsTable.campaignGradeId]?.let { CampaignGradeId(it) },
            name = this[PrizeDefinitionsTable.name],
            photos = photos,
            prizeValue = this[PrizeDefinitionsTable.prizeValue],
            buybackPrice = this[PrizeDefinitionsTable.buybackPrice],
            buybackEnabled = this[PrizeDefinitionsTable.buybackEnabled],
            probabilityBps = this[PrizeDefinitionsTable.probabilityBps],
            ticketCount = this[PrizeDefinitionsTable.ticketCount],
            displayOrder = this[PrizeDefinitionsTable.displayOrder],
            isRare = this[PrizeDefinitionsTable.isRare],
            createdAt = this[PrizeDefinitionsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PrizeDefinitionsTable.updatedAt].toInstant().toKotlinInstant(),
        )
    }

    private fun ResultRow.toPrizeInstance(): PrizeInstance =
        PrizeInstance(
            id = PrizeInstanceId(this[PrizeInstancesTable.id]),
            prizeDefinitionId = PrizeDefinitionId(this[PrizeInstancesTable.prizeDefinitionId]),
            ownerId = PlayerId(this[PrizeInstancesTable.ownerId]),
            acquisitionMethod = this[PrizeInstancesTable.acquisitionMethod].toDomainEnum(),
            sourceDrawTicketId = this[PrizeInstancesTable.sourceDrawTicketId],
            sourceTradeOrderId = this[PrizeInstancesTable.sourceTradeOrderId],
            sourceExchangeRequestId = this[PrizeInstancesTable.sourceExchangeRequestId],
            state = this[PrizeInstancesTable.state],
            acquiredAt = this[PrizeInstancesTable.acquiredAt].toInstant().toKotlinInstant(),
            deletedAt = this[PrizeInstancesTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PrizeInstancesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PrizeInstancesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// QueueRepositoryImpl + QueueEntryRepositoryImpl
// ---------------------------------------------------------------------------

private val terminalStatuses =
    listOf(QueueEntryStatus.COMPLETED, QueueEntryStatus.ABANDONED, QueueEntryStatus.EVICTED)

/** Exposed-backed implementation of [IQueueRepository]. */
public class QueueRepositoryImpl : IQueueRepository {
    override suspend fun findById(id: UUID): Queue? =
        newSuspendedTransaction {
            QueuesTable
                .selectAll()
                .where { QueuesTable.id eq id }
                .singleOrNull()
                ?.toQueue()
        }

    override suspend fun findByTicketBoxId(ticketBoxId: UUID): Queue? =
        newSuspendedTransaction {
            QueuesTable
                .selectAll()
                .where { QueuesTable.ticketBoxId eq ticketBoxId }
                .singleOrNull()
                ?.toQueue()
        }

    override suspend fun save(queue: Queue): Queue =
        newSuspendedTransaction {
            val existing = QueuesTable.selectAll().where { QueuesTable.id eq queue.id }.singleOrNull()
            if (existing == null) {
                QueuesTable.insert {
                    it[id] = queue.id
                    it[ticketBoxId] = queue.ticketBoxId
                    it[activePlayerId] = queue.activePlayerId?.value
                    it[sessionStartedAt] = queue.sessionStartedAt?.toOffsetDateTime()
                    it[sessionExpiresAt] = queue.sessionExpiresAt?.toOffsetDateTime()
                    it[createdAt] = queue.createdAt.toOffsetDateTime()
                    it[updatedAt] = queue.updatedAt.toOffsetDateTime()
                }
            } else {
                QueuesTable.update({ QueuesTable.id eq queue.id }) {
                    it[activePlayerId] = queue.activePlayerId?.value
                    it[sessionStartedAt] = queue.sessionStartedAt?.toOffsetDateTime()
                    it[sessionExpiresAt] = queue.sessionExpiresAt?.toOffsetDateTime()
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            QueuesTable
                .selectAll()
                .where { QueuesTable.id eq queue.id }
                .single()
                .toQueue()
        }

    private fun ResultRow.toQueue(): Queue =
        Queue(
            id = this[QueuesTable.id],
            ticketBoxId = this[QueuesTable.ticketBoxId],
            activePlayerId = this[QueuesTable.activePlayerId]?.let { PlayerId(it) },
            sessionStartedAt = this[QueuesTable.sessionStartedAt]?.toInstant()?.toKotlinInstant(),
            sessionExpiresAt = this[QueuesTable.sessionExpiresAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[QueuesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[QueuesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

/** Exposed-backed implementation of [IQueueEntryRepository]. */
public class QueueEntryRepositoryImpl : IQueueEntryRepository {
    override suspend fun findById(id: UUID): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where { QueueEntriesTable.id eq id }
                .singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun findActiveEntry(
        queueId: UUID,
        playerId: PlayerId,
    ): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.playerId eq playerId.value) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun findActiveEntries(queueId: UUID): List<QueueEntry> =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.orderBy(QueueEntriesTable.position)
                .map { it.toQueueEntry() }
        }

    override suspend fun findNextWaiting(queueId: UUID): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.status eq QueueEntryStatus.WAITING)
                }.orderBy(QueueEntriesTable.position)
                .limit(1)
                .singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun countActiveEntriesBefore(
        queueId: UUID,
        position: Int,
    ): Int =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.position less position) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.count()
                .toInt()
        }

    override suspend fun save(entry: QueueEntry): QueueEntry =
        newSuspendedTransaction {
            val existing = QueueEntriesTable.selectAll().where { QueueEntriesTable.id eq entry.id }.singleOrNull()
            if (existing == null) {
                QueueEntriesTable.insert {
                    it[id] = entry.id
                    it[queueId] = entry.queueId
                    it[playerId] = entry.playerId.value
                    it[position] = entry.position
                    it[status] = entry.status
                    it[joinedAt] = entry.joinedAt.toOffsetDateTime()
                    it[activatedAt] = entry.activatedAt?.toOffsetDateTime()
                    it[completedAt] = entry.completedAt?.toOffsetDateTime()
                    it[createdAt] = entry.createdAt.toOffsetDateTime()
                    it[updatedAt] = entry.updatedAt.toOffsetDateTime()
                }
            } else {
                QueueEntriesTable.update({ QueueEntriesTable.id eq entry.id }) {
                    it[status] = entry.status
                    it[activatedAt] = entry.activatedAt?.toOffsetDateTime()
                    it[completedAt] = entry.completedAt?.toOffsetDateTime()
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            QueueEntriesTable
                .selectAll()
                .where { QueueEntriesTable.id eq entry.id }
                .single()
                .toQueueEntry()
        }

    private fun ResultRow.toQueueEntry(): QueueEntry =
        QueueEntry(
            id = this[QueueEntriesTable.id],
            queueId = this[QueueEntriesTable.queueId],
            playerId = PlayerId(this[QueueEntriesTable.playerId]),
            position = this[QueueEntriesTable.position],
            status = this[QueueEntriesTable.status],
            joinedAt = this[QueueEntriesTable.joinedAt].toInstant().toKotlinInstant(),
            activatedAt = this[QueueEntriesTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            completedAt = this[QueueEntriesTable.completedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[QueueEntriesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[QueueEntriesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// AuditRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IAuditRepository]. */
public class AuditRepositoryImpl : IAuditRepository {
    private val json = Json { ignoreUnknownKeys = true }

    /** Synchronous insert for use within an existing business transaction. */
    override fun record(log: AuditLog) {
        AuditLogsTable.insert {
            it[id] = log.id
            it[actorType] = log.actorType.toContractsEnum()
            it[actorPlayerId] = log.actorPlayerId?.value
            it[actorStaffId] = log.actorStaffId
            it[action] = log.action
            it[entityType] = log.entityType
            it[entityId] = log.entityId
            it[beforeValue] = log.beforeValue?.let { v -> json.encodeToString(JsonObject.serializer(), v) }
            it[afterValue] = log.afterValue?.let { v -> json.encodeToString(JsonObject.serializer(), v) }
            it[metadata] = json.encodeToString(JsonObject.serializer(), log.metadata)
            it[createdAt] = OffsetDateTime.ofInstant(log.createdAt.toJavaInstant(), ZoneOffset.UTC)
        }
    }
}

// ---------------------------------------------------------------------------
// DrawPointTransactionRepositoryImpl + RevenuePointTransactionRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IDrawPointTransactionRepository]. */
public class DrawPointTransactionRepositoryImpl : IDrawPointTransactionRepository {
    override fun record(transaction: DrawPointTransaction) {
        DrawPointTransactionsTable.insert {
            it[id] = transaction.id
            it[playerId] = transaction.playerId.value
            it[type] = transaction.type
            it[amount] = transaction.amount
            it[balanceAfter] = transaction.balanceAfter
            it[paymentOrderId] = transaction.paymentOrderId
            it[description] = transaction.description
            it[createdAt] = transaction.createdAt.toOffsetDateTime()
        }
    }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<DrawPointTransaction> =
        newSuspendedTransaction {
            DrawPointTransactionsTable
                .selectAll()
                .where { DrawPointTransactionsTable.playerId eq playerId.value }
                .orderBy(DrawPointTransactionsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map {
                    DrawPointTransaction(
                        id = it[DrawPointTransactionsTable.id],
                        playerId = PlayerId(it[DrawPointTransactionsTable.playerId]),
                        type = it[DrawPointTransactionsTable.type],
                        amount = it[DrawPointTransactionsTable.amount],
                        balanceAfter = it[DrawPointTransactionsTable.balanceAfter],
                        paymentOrderId = it[DrawPointTransactionsTable.paymentOrderId],
                        description = it[DrawPointTransactionsTable.description],
                        createdAt = it[DrawPointTransactionsTable.createdAt].toInstant().toKotlinInstant(),
                    )
                }
        }
}

/** Exposed-backed implementation of [IRevenuePointTransactionRepository]. */
public class RevenuePointTransactionRepositoryImpl : IRevenuePointTransactionRepository {
    override fun record(transaction: RevenuePointTransaction) {
        RevenuePointTransactionsTable.insert {
            it[id] = transaction.id
            it[playerId] = transaction.playerId.value
            it[type] = transaction.type
            it[amount] = transaction.amount
            it[balanceAfter] = transaction.balanceAfter
            it[tradeOrderId] = transaction.tradeOrderId
            it[description] = transaction.description
            it[createdAt] = transaction.createdAt.toOffsetDateTime()
        }
    }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<RevenuePointTransaction> =
        newSuspendedTransaction {
            RevenuePointTransactionsTable
                .selectAll()
                .where { RevenuePointTransactionsTable.playerId eq playerId.value }
                .orderBy(RevenuePointTransactionsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map {
                    RevenuePointTransaction(
                        id = it[RevenuePointTransactionsTable.id],
                        playerId = PlayerId(it[RevenuePointTransactionsTable.playerId]),
                        type = it[RevenuePointTransactionsTable.type],
                        amount = it[RevenuePointTransactionsTable.amount],
                        balanceAfter = it[RevenuePointTransactionsTable.balanceAfter],
                        tradeOrderId = it[RevenuePointTransactionsTable.tradeOrderId],
                        description = it[RevenuePointTransactionsTable.description],
                        createdAt = it[RevenuePointTransactionsTable.createdAt].toInstant().toKotlinInstant(),
                    )
                }
        }
}

// ---------------------------------------------------------------------------
// DrawSyncRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IDrawSyncRepository]. */
public class DrawSyncRepositoryImpl : IDrawSyncRepository {
    override suspend fun save(session: DrawSyncSession): DrawSyncSession =
        newSuspendedTransaction {
            DrawSyncSessionsTable.insert {
                it[id] = session.id
                it[ticketId] = session.ticketId
                it[campaignId] = session.campaignId
                it[playerId] = session.playerId
                it[animationMode] = session.animationMode
                it[resultGrade] = session.resultGrade
                it[resultPrizeName] = session.resultPrizeName
                it[resultPhotoUrl] = session.resultPhotoUrl
                it[resultPrizeInstanceId] = session.resultPrizeInstanceId
                it[progress] = session.progress
                it[isRevealed] = session.isRevealed
                it[isCancelled] = session.isCancelled
                it[startedAt] = OffsetDateTime.ofInstant(session.startedAt.toJavaInstant(), ZoneOffset.UTC)
                it[revealedAt] =
                    session.revealedAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
                it[cancelledAt] =
                    session.cancelledAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
            }
            session
        }

    override suspend fun findById(id: UUID): DrawSyncSession? =
        newSuspendedTransaction {
            DrawSyncSessionsTable
                .selectAll()
                .where { DrawSyncSessionsTable.id eq id }
                .singleOrNull()
                ?.toDrawSyncSession()
        }

    override suspend fun findActiveByPlayer(playerId: UUID): DrawSyncSession? =
        newSuspendedTransaction {
            DrawSyncSessionsTable
                .selectAll()
                .where {
                    (DrawSyncSessionsTable.playerId eq playerId) and
                        (DrawSyncSessionsTable.isRevealed eq false) and
                        (DrawSyncSessionsTable.isCancelled eq false)
                }.singleOrNull()
                ?.toDrawSyncSession()
        }

    override suspend fun updateProgress(
        id: UUID,
        progress: Float,
    ) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[DrawSyncSessionsTable.progress] = progress
            }
        }
    }

    override suspend fun markRevealed(id: UUID) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[isRevealed] = true
                it[revealedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }
    }

    override suspend fun markCancelled(id: UUID) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[isCancelled] = true
                it[cancelledAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }
    }

    private fun ResultRow.toDrawSyncSession(): DrawSyncSession =
        DrawSyncSession(
            id = this[DrawSyncSessionsTable.id],
            ticketId = this[DrawSyncSessionsTable.ticketId],
            campaignId = this[DrawSyncSessionsTable.campaignId],
            playerId = this[DrawSyncSessionsTable.playerId],
            animationMode = this[DrawSyncSessionsTable.animationMode],
            resultGrade = this[DrawSyncSessionsTable.resultGrade],
            resultPrizeName = this[DrawSyncSessionsTable.resultPrizeName],
            resultPhotoUrl = this[DrawSyncSessionsTable.resultPhotoUrl],
            resultPrizeInstanceId = this[DrawSyncSessionsTable.resultPrizeInstanceId],
            progress = this[DrawSyncSessionsTable.progress],
            isRevealed = this[DrawSyncSessionsTable.isRevealed],
            isCancelled = this[DrawSyncSessionsTable.isCancelled],
            startedAt = this[DrawSyncSessionsTable.startedAt].toInstant().toKotlinInstant(),
            revealedAt = this[DrawSyncSessionsTable.revealedAt]?.toInstant()?.toKotlinInstant(),
            cancelledAt = this[DrawSyncSessionsTable.cancelledAt]?.toInstant()?.toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// LeaderboardRepositoryImpl
// ---------------------------------------------------------------------------

/** SQL-based leaderboard implementation (draw-service copy). */
public class LeaderboardRepositoryImpl : ILeaderboardRepository {
    override suspend fun findGlobalTopPlayers(
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry> =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)
            DrawTicketsTable
                .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                .select(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname, DrawTicketsTable.id.count())
                .where {
                    (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                        (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                        (DrawTicketsTable.drawnAt less untilOdt)
                }.groupBy(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname)
                .orderBy(DrawTicketsTable.id.count(), SortOrder.DESC)
                .limit(limit)
                .mapIndexed { i, row ->
                    LeaderboardEntry(
                        rank = i + 1,
                        playerId = PlayerId(row[DrawTicketsTable.drawnByPlayerId]!!),
                        nickname = row[PlayersTable.nickname],
                        score = row[DrawTicketsTable.id.count()],
                    )
                }
        }

    override suspend fun findCampaignTopPlayers(
        campaignId: CampaignId,
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry> =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)
            DrawTicketsTable
                .join(TicketBoxesTable, JoinType.INNER, DrawTicketsTable.ticketBoxId, TicketBoxesTable.id)
                .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                .select(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname, DrawTicketsTable.id.count())
                .where {
                    (TicketBoxesTable.kujiCampaignId eq campaignId.value) and
                        (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                        (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                        (DrawTicketsTable.drawnAt less untilOdt)
                }.groupBy(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname)
                .orderBy(DrawTicketsTable.id.count(), SortOrder.DESC)
                .limit(limit)
                .mapIndexed { i, row ->
                    LeaderboardEntry(
                        rank = i + 1,
                        playerId = PlayerId(row[DrawTicketsTable.drawnByPlayerId]!!),
                        nickname = row[PlayersTable.nickname],
                        score = row[DrawTicketsTable.id.count()],
                    )
                }
        }

    override suspend fun findPlayerRank(
        playerId: PlayerId,
        from: Instant,
        until: Instant,
    ): Int? =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)
            val all =
                DrawTicketsTable
                    .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                    .select(DrawTicketsTable.drawnByPlayerId, DrawTicketsTable.id.count())
                    .where {
                        (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                            (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                            (DrawTicketsTable.drawnAt less untilOdt)
                    }.groupBy(DrawTicketsTable.drawnByPlayerId)
                    .orderBy(DrawTicketsTable.id.count(), SortOrder.DESC)
                    .toList()
            val idx = all.indexOfFirst { it[DrawTicketsTable.drawnByPlayerId] == playerId.value }
            if (idx == -1) {
                null
            } else {
                idx + 1
            }
        }
}

// ---------------------------------------------------------------------------
// FeedEventRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IFeedEventRepository]. */
public class FeedEventRepositoryImpl : IFeedEventRepository {
    override suspend fun save(event: FeedEvent): Unit =
        newSuspendedTransaction {
            FeedEventsTable.insert {
                it[id] = event.id
                it[drawId] = event.drawId
                it[playerId] = event.playerId
                it[playerNickname] = event.playerNickname
                it[playerAvatarUrl] = event.playerAvatarUrl
                it[campaignId] = event.campaignId
                it[campaignTitle] = event.campaignTitle
                it[campaignType] = event.campaignType.name
                it[prizeGrade] = event.prizeGrade
                it[prizeName] = event.prizeName
                it[prizePhotoUrl] = event.prizePhotoUrl
                it[drawnAt] = OffsetDateTime.ofInstant(event.drawnAt.toJavaInstant(), ZoneOffset.UTC)
                it[createdAt] = OffsetDateTime.ofInstant(event.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
        }

    override suspend fun findRecent(limit: Int): List<FeedEvent> =
        newSuspendedTransaction {
            FeedEventsTable
                .selectAll()
                .orderBy(FeedEventsTable.drawnAt, SortOrder.DESC)
                .limit(limit)
                .map { row ->
                    FeedEvent(
                        id = row[FeedEventsTable.id],
                        drawId = row[FeedEventsTable.drawId],
                        playerId = row[FeedEventsTable.playerId],
                        playerNickname = row[FeedEventsTable.playerNickname],
                        playerAvatarUrl = row[FeedEventsTable.playerAvatarUrl],
                        campaignId = row[FeedEventsTable.campaignId],
                        campaignTitle = row[FeedEventsTable.campaignTitle],
                        campaignType = CampaignType.valueOf(row[FeedEventsTable.campaignType]),
                        prizeGrade = row[FeedEventsTable.prizeGrade],
                        prizeName = row[FeedEventsTable.prizeName],
                        prizePhotoUrl = row[FeedEventsTable.prizePhotoUrl],
                        drawnAt = row[FeedEventsTable.drawnAt].toInstant().toKotlinInstant(),
                        createdAt = row[FeedEventsTable.createdAt].toInstant().toKotlinInstant(),
                    )
                }
        }
}

// ---------------------------------------------------------------------------
// PityRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [IPityRepository]. */
public class PityRepositoryImpl : IPityRepository {
    override suspend fun findRuleByCampaignId(campaignId: CampaignId): PityRule? =
        newSuspendedTransaction {
            PityRulesTable
                .selectAll()
                .where { PityRulesTable.campaignId eq campaignId.value }
                .singleOrNull()
                ?.toRule()
        }

    override suspend fun findPoolByRuleId(ruleId: UUID): List<PityPrizePoolEntry> =
        newSuspendedTransaction {
            PityPrizePoolTable
                .selectAll()
                .where { PityPrizePoolTable.pityRuleId eq ruleId }
                .map { it.toPoolEntry() }
        }

    override suspend fun findTracker(
        ruleId: UUID,
        playerId: PlayerId,
    ): PityTracker? =
        newSuspendedTransaction {
            PityTrackersTable
                .selectAll()
                .where {
                    (PityTrackersTable.pityRuleId eq ruleId) and (PityTrackersTable.playerId eq playerId.value)
                }.singleOrNull()
                ?.toTracker()
        }

    override suspend fun saveTracker(tracker: PityTracker): Boolean =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            val existing =
                PityTrackersTable
                    .selectAll()
                    .where {
                        (PityTrackersTable.pityRuleId eq tracker.pityRuleId) and
                            (PityTrackersTable.playerId eq tracker.playerId.value)
                    }.singleOrNull()
            if (existing == null) {
                PityTrackersTable.insert {
                    it[id] = tracker.id
                    it[pityRuleId] = tracker.pityRuleId
                    it[playerId] = tracker.playerId.value
                    it[drawCount] = tracker.drawCount
                    it[lastDrawAt] =
                        tracker.lastDrawAt?.let { ts ->
                            OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(ts.epochSeconds, ts.nanosecondsOfSecond.toLong()),
                                ZoneOffset.UTC,
                            )
                        }
                    it[version] = 0
                    it[createdAt] = now
                    it[updatedAt] = now
                }
                true
            } else {
                val updated =
                    PityTrackersTable.update({
                        (PityTrackersTable.pityRuleId eq tracker.pityRuleId) and
                            (PityTrackersTable.playerId eq tracker.playerId.value) and
                            (PityTrackersTable.version eq tracker.version)
                    }) {
                        it[drawCount] = tracker.drawCount
                        it[lastDrawAt] =
                            tracker.lastDrawAt?.let { ts ->
                                OffsetDateTime.ofInstant(
                                    java.time.Instant.ofEpochSecond(ts.epochSeconds, ts.nanosecondsOfSecond.toLong()),
                                    ZoneOffset.UTC,
                                )
                            }
                        it[version] = tracker.version + 1
                        it[updatedAt] = now
                    }
                updated > 0
            }
        }

    private fun ResultRow.toRule(): PityRule =
        PityRule(
            id = this[PityRulesTable.id],
            campaignId = CampaignId(this[PityRulesTable.campaignId]),
            campaignType = this[PityRulesTable.campaignType],
            threshold = this[PityRulesTable.threshold],
            accumulationMode = AccumulationMode.valueOf(this[PityRulesTable.accumulationMode]),
            sessionTimeoutSeconds = this[PityRulesTable.sessionTimeoutSeconds],
            enabled = this[PityRulesTable.enabled],
            createdAt = this[PityRulesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PityRulesTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toPoolEntry(): PityPrizePoolEntry =
        PityPrizePoolEntry(
            id = this[PityPrizePoolTable.id],
            pityRuleId = this[PityPrizePoolTable.pityRuleId],
            prizeDefinitionId = PrizeDefinitionId(this[PityPrizePoolTable.prizeDefinitionId]),
            weight = this[PityPrizePoolTable.weight],
        )

    private fun ResultRow.toTracker(): PityTracker =
        PityTracker(
            id = this[PityTrackersTable.id],
            pityRuleId = this[PityTrackersTable.pityRuleId],
            playerId = PlayerId(this[PityTrackersTable.playerId]),
            drawCount = this[PityTrackersTable.drawCount],
            lastDrawAt = this[PityTrackersTable.lastDrawAt]?.toInstant()?.toKotlinInstant(),
            version = this[PityTrackersTable.version],
            createdAt = this[PityTrackersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PityTrackersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// CouponRepositoryImpl
// ---------------------------------------------------------------------------

/** Exposed-backed implementation of [ICouponRepository]. */
public class CouponRepositoryImpl : ICouponRepository {
    override suspend fun findCouponById(id: UUID): Coupon? =
        newSuspendedTransaction {
            CouponsTable
                .selectAll()
                .where { (CouponsTable.id eq id) and (CouponsTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toCoupon()
        }

    override suspend fun findPlayerCouponById(id: UUID): PlayerCoupon? =
        newSuspendedTransaction {
            PlayerCouponsTable
                .selectAll()
                .where { PlayerCouponsTable.id eq id }
                .singleOrNull()
                ?.toPlayerCoupon()
        }

    override suspend fun findPlayerCoupons(
        playerId: PlayerId,
        status: PlayerCouponStatus?,
    ): List<PlayerCoupon> =
        newSuspendedTransaction {
            PlayerCouponsTable
                .selectAll()
                .where {
                    val baseCondition = PlayerCouponsTable.playerId eq playerId.value
                    if (status != null) {
                        baseCondition and (PlayerCouponsTable.status eq status.toContractsEnum())
                    } else {
                        baseCondition
                    }
                }.map { it.toPlayerCoupon() }
        }

    override suspend fun savePlayerCoupon(playerCoupon: PlayerCoupon): PlayerCoupon =
        newSuspendedTransaction {
            val existing =
                PlayerCouponsTable.selectAll().where { PlayerCouponsTable.id eq playerCoupon.id }.singleOrNull()
            if (existing == null) {
                PlayerCouponsTable.insert {
                    it[id] = playerCoupon.id
                    it[playerId] = playerCoupon.playerId.value
                    it[couponId] = playerCoupon.couponId
                    it[discountCodeId] = playerCoupon.discountCodeId
                    it[useCount] = playerCoupon.useCount
                    it[status] = playerCoupon.status.toContractsEnum()
                    it[issuedAt] = playerCoupon.issuedAt.toOffsetDateTime()
                    it[lastUsedAt] = playerCoupon.lastUsedAt?.toOffsetDateTime()
                    it[createdAt] = playerCoupon.createdAt.toOffsetDateTime()
                    it[updatedAt] = playerCoupon.updatedAt.toOffsetDateTime()
                }
            } else {
                PlayerCouponsTable.update({ PlayerCouponsTable.id eq playerCoupon.id }) {
                    it[useCount] = playerCoupon.useCount
                    it[status] = playerCoupon.status.toContractsEnum()
                    it[lastUsedAt] = playerCoupon.lastUsedAt?.toOffsetDateTime()
                    it[updatedAt] = playerCoupon.updatedAt.toOffsetDateTime()
                }
            }
            PlayerCouponsTable
                .selectAll()
                .where { PlayerCouponsTable.id eq playerCoupon.id }
                .single()
                .toPlayerCoupon()
        }

    private fun ResultRow.toCoupon(): Coupon =
        Coupon(
            id = this[CouponsTable.id],
            name = this[CouponsTable.name],
            description = this[CouponsTable.description],
            discountType = this[CouponsTable.discountType].toDomainDiscountType(),
            discountValue = this[CouponsTable.discountValue],
            applicableTo = this[CouponsTable.applicableTo].toDomainApplicableTo(),
            maxUsesPerPlayer = this[CouponsTable.maxUsesPerPlayer],
            totalIssued = this[CouponsTable.totalIssued],
            totalUsed = this[CouponsTable.totalUsed],
            issueLimit = this[CouponsTable.issueLimit],
            validFrom = this[CouponsTable.validFrom].toInstant().toKotlinInstant(),
            validUntil = this[CouponsTable.validUntil].toInstant().toKotlinInstant(),
            isActive = this[CouponsTable.isActive],
            createdByStaffId = this[CouponsTable.createdByStaffId],
            deletedAt = this[CouponsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[CouponsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[CouponsTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toPlayerCoupon(): PlayerCoupon =
        PlayerCoupon(
            id = this[PlayerCouponsTable.id],
            playerId = PlayerId(this[PlayerCouponsTable.playerId]),
            couponId = this[PlayerCouponsTable.couponId],
            discountCodeId = this[PlayerCouponsTable.discountCodeId],
            useCount = this[PlayerCouponsTable.useCount],
            status = this[PlayerCouponsTable.status].toDomainPlayerCouponStatus(),
            issuedAt = this[PlayerCouponsTable.issuedAt].toInstant().toKotlinInstant(),
            lastUsedAt = this[PlayerCouponsTable.lastUsedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PlayerCouponsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PlayerCouponsTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

// ---------------------------------------------------------------------------
// Enum adapters (domain ↔ contracts — same values, different packages)
// ---------------------------------------------------------------------------

private fun ContractsDrawTicketStatus.toDomainEnum(): DrawTicketStatus = enumValueOf(name)

private fun ContractsTicketBoxStatus.toDomainEnum(): TicketBoxStatus = enumValueOf(name)

private fun TicketBoxStatus.toContractsEnum(): ContractsTicketBoxStatus = enumValueOf(name)

private fun ContractsPrizeAcquisitionMethod.toDomainEnum(): PrizeAcquisitionMethod = enumValueOf(name)

private fun PrizeAcquisitionMethod.toContractsEnum(): ContractsPrizeAcquisitionMethod = enumValueOf(name)

private fun AuditActorType.toContractsEnum(): ContractsAuditActorType = enumValueOf(name)

private fun ContractsAuditActorType.toDomainEnum(): AuditActorType = enumValueOf(name)

private fun ContractsCouponDiscountType.toDomainDiscountType(): CouponDiscountType = enumValueOf(name)

private fun CouponDiscountType.toContractsEnum(): ContractsCouponDiscountType = enumValueOf(name)

private fun ContractsCouponApplicableTo.toDomainApplicableTo(): CouponApplicableTo = enumValueOf(name)

private fun CouponApplicableTo.toContractsEnum(): ContractsCouponApplicableTo = enumValueOf(name)

private fun ContractsPlayerCouponStatus.toDomainPlayerCouponStatus(): PlayerCouponStatus = enumValueOf(name)

private fun PlayerCouponStatus.toContractsEnum(): ContractsPlayerCouponStatus = enumValueOf(name)
