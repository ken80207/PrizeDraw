package com.prizedraw.draw.application.events

import com.prizedraw.draw.application.ports.output.DomainEvent
import java.util.UUID

/** Emitted when a kuji draw ticket is successfully drawn by a player (draw-service copy). */
public data class DrawCompleted(
    val ticketId: UUID,
    val playerId: UUID,
    val prizeInstanceId: UUID,
    val campaignId: UUID,
) : DomainEvent {
    override val eventType: String = "draw.completed"
    override val aggregateType: String = "DrawTicket"
    override val aggregateId: UUID = ticketId
}

/** Emitted when a probability-based unlimited draw is successfully completed (draw-service copy). */
public data class UnlimitedDrawCompleted(
    val prizeInstanceId: UUID,
    val playerId: UUID,
    val campaignId: UUID,
) : DomainEvent {
    override val eventType: String = "draw.unlimited.completed"
    override val aggregateType: String = "PrizeInstance"
    override val aggregateId: UUID = prizeInstanceId
}

/** Emitted when a player starts drawing; triggers fan-out to followers (draw-service copy). */
public data class FollowingDrawStarted(
    val playerId: UUID,
    val playerNickname: String,
    val campaignId: UUID,
    val campaignName: String,
) : DomainEvent {
    override val eventType: String = "following.draw_started"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}

/** Emitted when a player draws a rare prize; triggers fan-out to followers (draw-service copy). */
public data class FollowingRarePrizeDrawn(
    val playerId: UUID,
    val playerNickname: String,
    val campaignId: UUID,
    val campaignName: String,
    val prizeName: String,
    val prizeGrade: String,
) : DomainEvent {
    override val eventType: String = "following.rare_prize_drawn"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}
