package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.draw.DrawRecordDto
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.persistence.tables.DrawTicketsTable
import com.prizedraw.infrastructure.persistence.tables.PlayersTable
import com.prizedraw.infrastructure.persistence.tables.PrizeDefinitionsTable
import com.prizedraw.infrastructure.persistence.tables.TicketBoxesTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.innerJoin
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

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
                        (DrawTicketsTable.status eq DrawTicketStatus.AVAILABLE)
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
                it[status] = DrawTicketStatus.DRAWN
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
            // Resolve all ticket box IDs for the campaign first so the main query
            // uses a simple IN subexpression on the already-indexed ticket_box_id column.
            val boxIds =
                TicketBoxesTable
                    .selectAll()
                    .where { TicketBoxesTable.kujiCampaignId eq campaignId.value }
                    .map { it[TicketBoxesTable.id] }
                    .toSet()

            if (boxIds.isEmpty()) return@newSuspendedTransaction emptyList()

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
                        (DrawTicketsTable.status eq DrawTicketStatus.DRAWN)
                }.orderBy(DrawTicketsTable.drawnAt, SortOrder.DESC)
                .limit(limit)
                .map { row ->
                    val photosJson = row[PrizeDefinitionsTable.photos]
                    val firstPhoto =
                        runCatching {
                            val arr = json.parseToJsonElement(photosJson) as? JsonArray
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
            status = this[DrawTicketsTable.status],
            drawnByPlayerId = this[DrawTicketsTable.drawnByPlayerId]?.let { PlayerId(it) },
            drawnAt = this[DrawTicketsTable.drawnAt]?.toInstant()?.toKotlinInstant(),
            prizeInstanceId = this[DrawTicketsTable.prizeInstanceId]?.let { PrizeInstanceId(it) },
            createdAt = this[DrawTicketsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[DrawTicketsTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

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
                    (TicketBoxesTable.id eq id) and
                        (TicketBoxesTable.remainingTickets eq expectedRemaining)
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
                    it[status] = box.status
                    it[soldOutAt] =
                        box.soldOutAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
                    it[displayOrder] = box.displayOrder
                    it[createdAt] = OffsetDateTime.ofInstant(box.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(box.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                TicketBoxesTable.update({ TicketBoxesTable.id eq box.id }) {
                    it[name] = box.name
                    it[totalTickets] = box.totalTickets
                    it[remainingTickets] = box.remainingTickets
                    it[status] = box.status
                    it[soldOutAt] =
                        box.soldOutAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
                    it[displayOrder] = box.displayOrder
                    it[updatedAt] = OffsetDateTime.ofInstant(box.updatedAt.toJavaInstant(), ZoneOffset.UTC)
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
            status = this[TicketBoxesTable.status],
            soldOutAt = this[TicketBoxesTable.soldOutAt]?.toInstant()?.toKotlinInstant(),
            displayOrder = this[TicketBoxesTable.displayOrder],
            createdAt = this[TicketBoxesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[TicketBoxesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
