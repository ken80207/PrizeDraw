package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.MessageAttachment
import com.prizedraw.domain.entities.MessageChannel
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.domain.entities.SupportTicketPriority
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.schema.tables.SupportTicketMessagesTable
import com.prizedraw.schema.tables.SupportTicketsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
import com.prizedraw.contracts.enums.MessageChannel as ContractsMessageChannel
import com.prizedraw.contracts.enums.SupportTicketPriority as ContractsSupportTicketPriority

public class SupportRepositoryImpl : ISupportRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findTicketById(id: UUID): SupportTicket? =
        newSuspendedTransaction {
            SupportTicketsTable
                .selectAll()
                .where { SupportTicketsTable.id eq id }
                .singleOrNull()
                ?.toSupportTicket()
        }

    override suspend fun findTicketsByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<SupportTicket> =
        newSuspendedTransaction {
            SupportTicketsTable
                .selectAll()
                .where { SupportTicketsTable.playerId eq playerId.value }
                .orderBy(SupportTicketsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toSupportTicket() }
        }

    override suspend fun findTicketsForQueue(
        status: SupportTicketStatus?,
        priority: SupportTicketPriority?,
        assignedToStaffId: UUID?,
        offset: Int,
        limit: Int,
    ): List<SupportTicket> =
        newSuspendedTransaction {
            SupportTicketsTable
                .selectAll()
                .where {
                    var condition: org.jetbrains.exposed.sql.Op<Boolean> = org.jetbrains.exposed.sql.Op.TRUE
                    if (status != null) {
                        condition = condition and (SupportTicketsTable.status eq status)
                    }
                    if (priority != null) {
                        condition = condition and (SupportTicketsTable.priority eq priority.toContractsEnum())
                    }
                    if (assignedToStaffId != null) {
                        condition = condition and (SupportTicketsTable.assignedToStaffId eq assignedToStaffId)
                    }
                    condition
                }.orderBy(SupportTicketsTable.priority)
                .orderBy(SupportTicketsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.ASC)
                .limit(limit, offset.toLong())
                .map { it.toSupportTicket() }
        }

    override suspend fun saveTicket(ticket: SupportTicket): SupportTicket =
        newSuspendedTransaction {
            val existing =
                SupportTicketsTable
                    .selectAll()
                    .where { SupportTicketsTable.id eq ticket.id }
                    .singleOrNull()

            if (existing == null) {
                SupportTicketsTable.insert {
                    it[id] = ticket.id
                    it[playerId] = ticket.playerId.value
                    it[assignedToStaffId] = ticket.assignedToStaffId
                    it[category] = ticket.category
                    it[subject] = ticket.subject
                    it[status] = ticket.status
                    it[priority] = ticket.priority.toContractsEnum()
                    it[satisfactionScore] = ticket.satisfactionScore
                    it[lineThreadId] = ticket.lineThreadId
                    it[contextTradeOrderId] = ticket.contextTradeOrderId
                    it[contextPaymentOrderId] = ticket.contextPaymentOrderId
                    it[contextShippingOrderId] = ticket.contextShippingOrderId
                    it[contextWithdrawalId] = ticket.contextWithdrawalId
                    it[resolvedAt] = ticket.resolvedAt?.toOffsetDateTime()
                    it[closedAt] = ticket.closedAt?.toOffsetDateTime()
                    it[createdAt] = ticket.createdAt.toOffsetDateTime()
                    it[updatedAt] = ticket.updatedAt.toOffsetDateTime()
                }
            } else {
                SupportTicketsTable.update({ SupportTicketsTable.id eq ticket.id }) {
                    it[assignedToStaffId] = ticket.assignedToStaffId
                    it[status] = ticket.status
                    it[priority] = ticket.priority.toContractsEnum()
                    it[satisfactionScore] = ticket.satisfactionScore
                    it[resolvedAt] = ticket.resolvedAt?.toOffsetDateTime()
                    it[closedAt] = ticket.closedAt?.toOffsetDateTime()
                    it[updatedAt] = ticket.updatedAt.toOffsetDateTime()
                }
            }

            SupportTicketsTable
                .selectAll()
                .where { SupportTicketsTable.id eq ticket.id }
                .single()
                .toSupportTicket()
        }

    override suspend fun findMessagesByTicket(ticketId: UUID): List<SupportTicketMessage> =
        newSuspendedTransaction {
            SupportTicketMessagesTable
                .selectAll()
                .where { SupportTicketMessagesTable.supportTicketId eq ticketId }
                .orderBy(SupportTicketMessagesTable.createdAt, org.jetbrains.exposed.sql.SortOrder.ASC)
                .map { it.toSupportTicketMessage() }
        }

    override suspend fun saveMessage(message: SupportTicketMessage): SupportTicketMessage =
        newSuspendedTransaction {
            SupportTicketMessagesTable.insert {
                it[id] = message.id
                it[supportTicketId] = message.supportTicketId
                it[authorPlayerId] = message.authorPlayerId?.value
                it[authorStaffId] = message.authorStaffId
                it[body] = message.body
                it[attachments] =
                    json.encodeToString(
                        kotlinx.serialization.json.JsonArray
                            .serializer(),
                        JsonArray(
                            message.attachments.map { att ->
                                kotlinx.serialization.json.buildJsonObject {
                                    put("url", kotlinx.serialization.json.JsonPrimitive(att.url))
                                    put("mime_type", kotlinx.serialization.json.JsonPrimitive(att.mimeType))
                                }
                            }
                        ),
                    )
                it[channel] = message.channel.toContractsEnum()
                it[lineMessageId] = message.lineMessageId
                it[createdAt] = OffsetDateTime.ofInstant(message.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
            SupportTicketMessagesTable
                .selectAll()
                .where { SupportTicketMessagesTable.id eq message.id }
                .single()
                .toSupportTicketMessage()
        }

    private fun ResultRow.toSupportTicket(): SupportTicket =
        SupportTicket(
            id = this[SupportTicketsTable.id],
            playerId = PlayerId(this[SupportTicketsTable.playerId]),
            assignedToStaffId = this[SupportTicketsTable.assignedToStaffId],
            category = this[SupportTicketsTable.category],
            subject = this[SupportTicketsTable.subject],
            status = this[SupportTicketsTable.status],
            priority = this[SupportTicketsTable.priority].toDomainEnum(),
            satisfactionScore = this[SupportTicketsTable.satisfactionScore],
            lineThreadId = this[SupportTicketsTable.lineThreadId],
            contextTradeOrderId = this[SupportTicketsTable.contextTradeOrderId],
            contextPaymentOrderId = this[SupportTicketsTable.contextPaymentOrderId],
            contextShippingOrderId = this[SupportTicketsTable.contextShippingOrderId],
            contextWithdrawalId = this[SupportTicketsTable.contextWithdrawalId],
            resolvedAt = this[SupportTicketsTable.resolvedAt]?.toInstant()?.toKotlinInstant(),
            closedAt = this[SupportTicketsTable.closedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[SupportTicketsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[SupportTicketsTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toSupportTicketMessage(): SupportTicketMessage {
        val rawAttachments = this[SupportTicketMessagesTable.attachments]
        val attachments =
            try {
                val arr = json.parseToJsonElement(rawAttachments) as? JsonArray ?: JsonArray(emptyList())
                arr.map { element ->
                    val obj = element.jsonObject
                    MessageAttachment(
                        url = obj["url"]?.jsonPrimitive?.content ?: "",
                        mimeType = obj["mime_type"]?.jsonPrimitive?.content ?: "",
                    )
                }
            } catch (_: Exception) {
                emptyList()
            }
        return SupportTicketMessage(
            id = this[SupportTicketMessagesTable.id],
            supportTicketId = this[SupportTicketMessagesTable.supportTicketId],
            authorPlayerId = this[SupportTicketMessagesTable.authorPlayerId]?.let { PlayerId(it) },
            authorStaffId = this[SupportTicketMessagesTable.authorStaffId],
            body = this[SupportTicketMessagesTable.body],
            attachments = attachments,
            channel = this[SupportTicketMessagesTable.channel].toDomainEnum(),
            lineMessageId = this[SupportTicketMessagesTable.lineMessageId],
            createdAt = this[SupportTicketMessagesTable.createdAt].toInstant().toKotlinInstant(),
        )
    }
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)

// Enum adapters between domain layer and contracts layer (same values, different packages).

private fun SupportTicketPriority.toContractsEnum(): ContractsSupportTicketPriority = enumValueOf(name)

private fun ContractsSupportTicketPriority.toDomainEnum(): SupportTicketPriority = enumValueOf(name)

private fun MessageChannel.toContractsEnum(): ContractsMessageChannel = enumValueOf(name)

private fun ContractsMessageChannel.toDomainEnum(): MessageChannel = enumValueOf(name)
