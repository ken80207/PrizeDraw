package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.persistence.tables.DrawTicketsTable
import com.prizedraw.infrastructure.persistence.tables.TicketBoxesTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class DrawRepositoryImpl : IDrawRepository {
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
                        (DrawTicketsTable.status eq DrawTicketStatus.AVAILABLE.name)
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
                it[status] = DrawTicketStatus.DRAWN.name
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

    private fun ResultRow.toDrawTicket(): DrawTicket =
        DrawTicket(
            id = this[DrawTicketsTable.id],
            ticketBoxId = this[DrawTicketsTable.ticketBoxId],
            prizeDefinitionId = PrizeDefinitionId(this[DrawTicketsTable.prizeDefinitionId]),
            position = this[DrawTicketsTable.position],
            status = DrawTicketStatus.valueOf(this[DrawTicketsTable.status]),
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
                    it[status] = box.status.name
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
                    it[status] = box.status.name
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
            status = TicketBoxStatus.valueOf(this[TicketBoxesTable.status]),
            soldOutAt = this[TicketBoxesTable.soldOutAt]?.toInstant()?.toKotlinInstant(),
            displayOrder = this[TicketBoxesTable.displayOrder],
            createdAt = this[TicketBoxesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[TicketBoxesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
