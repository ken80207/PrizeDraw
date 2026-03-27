@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.TicketBoxStatus
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for campaign and ticket structures.
 *
 * Covers `kuji_campaigns`, `unlimited_campaigns`, `ticket_boxes`, and `draw_tickets`.
 * PostgreSQL enum columns are mapped via [pgEnum] so the `=` operator resolves
 * against the correct PG enum type and avoids
 * `operator does not exist: <type> = character varying` errors.
 */
public object KujiCampaignsTable : Table("kuji_campaigns") {
    public val id = uuid("id").autoGenerate()
    public val title = varchar("title", 255)
    public val description = text("description").nullable()
    public val coverImageUrl = text("cover_image_url").nullable()
    public val pricePerDraw = integer("price_per_draw")
    public val drawSessionSeconds = integer("draw_session_seconds").default(300)
    public val status = pgEnum<CampaignStatus>("status", "kuji_campaign_status")
        .default(CampaignStatus.DRAFT)
    public val activatedAt = timestampWithTimeZone("activated_at").nullable()
    public val soldOutAt = timestampWithTimeZone("sold_out_at").nullable()
    public val createdByStaffId = uuid("created_by_staff_id")
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")
    public val approvalStatus = varchar("approval_status", 32).default("NOT_REQUIRED")
    public val approvedBy = uuid("approved_by").nullable()
    public val approvedAt = timestampWithTimeZone("approved_at").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object UnlimitedCampaignsTable : Table("unlimited_campaigns") {
    public val id = uuid("id").autoGenerate()
    public val title = varchar("title", 255)
    public val description = text("description").nullable()
    public val coverImageUrl = text("cover_image_url").nullable()
    public val pricePerDraw = integer("price_per_draw")
    public val rateLimitPerSecond = integer("rate_limit_per_second").default(1)

    /**
     * Uses the `unlimited_campaign_status` PG enum (no SOLD_OUT value).
     * The backing Kotlin type [CampaignStatus] has SOLD_OUT, which is not present
     * in this PG enum; the application layer must never write SOLD_OUT here.
     */
    public val status = pgEnum<CampaignStatus>("status", "unlimited_campaign_status")
        .default(CampaignStatus.DRAFT)
    public val activatedAt = timestampWithTimeZone("activated_at").nullable()
    public val createdByStaffId = uuid("created_by_staff_id")
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")
    public val approvalStatus = varchar("approval_status", 32).default("NOT_REQUIRED")
    public val approvedBy = uuid("approved_by").nullable()
    public val approvedAt = timestampWithTimeZone("approved_at").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object TicketBoxesTable : Table("ticket_boxes") {
    public val id = uuid("id").autoGenerate()
    public val kujiCampaignId = uuid("kuji_campaign_id")
    public val name = varchar("name", 64)
    public val totalTickets = integer("total_tickets")
    public val remainingTickets = integer("remaining_tickets")
    public val status = pgEnum<TicketBoxStatus>("status", "ticket_box_status")
        .default(TicketBoxStatus.AVAILABLE)
    public val soldOutAt = timestampWithTimeZone("sold_out_at").nullable()
    public val displayOrder = integer("display_order").default(0)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object DrawTicketsTable : Table("draw_tickets") {
    public val id = uuid("id").autoGenerate()
    public val ticketBoxId = uuid("ticket_box_id")
    public val prizeDefinitionId = uuid("prize_definition_id")
    public val position = integer("position")
    public val status = pgEnum<DrawTicketStatus>("status", "draw_ticket_status")
        .default(DrawTicketStatus.AVAILABLE)
    public val drawnByPlayerId = uuid("drawn_by_player_id").nullable()
    public val drawnAt = timestampWithTimeZone("drawn_at").nullable()
    public val prizeInstanceId = uuid("prize_instance_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
