package com.prizedraw.application.events

import com.prizedraw.application.ports.output.DomainEvent
import java.util.UUID

// Concrete sealed domain event hierarchy.
// Every event implements DomainEvent and carries the minimum context needed for the
// outbox worker to route delivery. Richer payloads are serialised into the
// OutboxEvent.payload JSON column.

/** Emitted when a kuji draw ticket is successfully drawn by a player. */
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

/** Emitted when a prize instance changes owner (trade or exchange). */
public data class PrizeTransferred(
    val prizeInstanceId: UUID,
    val fromPlayerId: UUID,
    val toPlayerId: UUID,
) : DomainEvent {
    override val eventType: String = "prize.transferred"
    override val aggregateType: String = "PrizeInstance"
    override val aggregateId: UUID = prizeInstanceId
}

/** Emitted when a marketplace trade order is completed. */
public data class TradeCompleted(
    val tradeOrderId: UUID,
    val sellerId: UUID,
    val buyerId: UUID,
    val prizeInstanceId: UUID,
    val salePrice: Int,
) : DomainEvent {
    override val eventType: String = "trade.completed"
    override val aggregateType: String = "TradeOrder"
    override val aggregateId: UUID = tradeOrderId
}

/** Emitted when an exchange request is completed (swap executed). */
public data class ExchangeCompleted(
    val exchangeRequestId: UUID,
    val initiatorId: UUID,
    val recipientId: UUID,
) : DomainEvent {
    override val eventType: String = "exchange.completed"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = exchangeRequestId
}

/** Emitted when a buyback is processed and revenue points are credited. */
public data class BuybackCompleted(
    val buybackRecordId: UUID,
    val playerId: UUID,
    val prizeInstanceId: UUID,
    val revenuePointsCredited: Int,
) : DomainEvent {
    override val eventType: String = "buyback.completed"
    override val aggregateType: String = "BuybackRecord"
    override val aggregateId: UUID = buybackRecordId
}

/** Emitted when a shipping order status transitions. */
public data class ShippingStatusChanged(
    val shippingOrderId: UUID,
    val playerId: UUID,
    val newStatus: String,
    val trackingNumber: String?,
) : DomainEvent {
    override val eventType: String = "shipping.status_changed"
    override val aggregateType: String = "ShippingOrder"
    override val aggregateId: UUID = shippingOrderId
}

/** Emitted when a payment order is confirmed as paid. */
public data class PaymentConfirmed(
    val paymentOrderId: UUID,
    val playerId: UUID,
    val drawPointsGranted: Int,
    val fiatAmount: Int,
) : DomainEvent {
    override val eventType: String = "payment.confirmed"
    override val aggregateType: String = "PaymentOrder"
    override val aggregateId: UUID = paymentOrderId
}

/** Emitted when a withdrawal request status changes (approved, transferred, rejected). */
public data class WithdrawalStatusChanged(
    val withdrawalRequestId: UUID,
    val playerId: UUID,
    val newStatus: String,
) : DomainEvent {
    override val eventType: String = "withdrawal.status_changed"
    override val aggregateType: String = "WithdrawalRequest"
    override val aggregateId: UUID = withdrawalRequestId
}

/** Emitted when a staff member replies to a support ticket. */
public data class SupportTicketReplied(
    val supportTicketId: UUID,
    val playerId: UUID,
    val messageId: UUID,
) : DomainEvent {
    override val eventType: String = "support_ticket.replied"
    override val aggregateType: String = "SupportTicket"
    override val aggregateId: UUID = supportTicketId
}

/** Emitted when a player sends an exchange request to another player. */
public data class ExchangeRequested(
    val exchangeRequestId: UUID,
    val initiatorId: UUID,
    val recipientId: UUID,
) : DomainEvent {
    override val eventType: String = "exchange.requested"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = exchangeRequestId
}

/** Emitted when a player sends a counter-proposal on an exchange. */
public data class ExchangeCounterProposed(
    val exchangeRequestId: UUID,
    val proposerId: UUID,
    val recipientId: UUID,
) : DomainEvent {
    override val eventType: String = "exchange.counter_proposed"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = exchangeRequestId
}

/** Emitted when a player rejects an exchange request. */
public data class ExchangeRejected(
    val exchangeRequestId: UUID,
    val rejecterId: UUID,
    val otherPlayerId: UUID,
) : DomainEvent {
    override val eventType: String = "exchange.rejected"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = exchangeRequestId
}

/** Emitted when a payment order fails or expires. */
public data class PaymentFailed(
    val paymentOrderId: UUID,
    val playerId: UUID,
    val reason: String,
) : DomainEvent {
    override val eventType: String = "payment.failed"
    override val aggregateType: String = "PaymentOrder"
    override val aggregateId: UUID = paymentOrderId
}

/** Emitted when a player levels up. */
public data class PlayerLevelUp(
    val playerId: UUID,
    val newLevel: Int,
    val newTierName: String,
) : DomainEvent {
    override val eventType: String = "player.level_up"
    override val aggregateType: String = "Player"
    override val aggregateId: UUID = playerId
}

/** Emitted when a player creates a new marketplace trade listing. */
public data class TradeListingCreated(
    val tradeOrderId: UUID,
    val sellerId: UUID,
) : DomainEvent {
    override val eventType: String = "trade.listing.created"
    override val aggregateType: String = "TradeListing"
    override val aggregateId: UUID = tradeOrderId
}

/** Emitted when a probability-based unlimited draw is successfully completed by a player. */
public data class UnlimitedDrawCompleted(
    val prizeInstanceId: UUID,
    val playerId: UUID,
    val campaignId: UUID,
) : DomainEvent {
    override val eventType: String = "draw.unlimited.completed"
    override val aggregateType: String = "PrizeInstance"
    override val aggregateId: UUID = prizeInstanceId
}

/** Emitted when a campaign is activated and a player who favorited it should be notified. */
public data class FavoriteCampaignActivated(
    val campaignId: UUID,
    val campaignType: String,
    val playerId: UUID,
) : DomainEvent {
    override val eventType: String = "favorite.campaign_activated"
    override val aggregateType: String = "Campaign"
    override val aggregateId: UUID = campaignId
}
