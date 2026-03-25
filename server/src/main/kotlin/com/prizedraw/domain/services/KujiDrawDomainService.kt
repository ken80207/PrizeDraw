package com.prizedraw.domain.services

import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.security.SecureRandom

/**
 * Thrown when a draw validation rule is violated.
 *
 * @property message Human-readable description of the violation.
 */
public class DrawValidationException(
    message: String,
) : IllegalStateException(message)

/**
 * Domain service encapsulating kuji draw validation and ticket selection logic.
 *
 * All methods are pure and throw [DrawValidationException] on rule violations.
 * No I/O is performed — callers must load the relevant entities before invoking
 * these methods.
 */
public class KujiDrawDomainService {
    private val secureRandom = SecureRandom()

    /**
     * Validates that a player is eligible to draw the specified ticket.
     *
     * Rules enforced:
     * 1. The ticket must not already be in [DrawTicketStatus.DRAWN] state.
     * 2. The queue session must not be expired (current time before [Queue.sessionExpiresAt]).
     * 3. The player must be the active session holder ([Queue.activePlayerId]).
     *
     * @param ticket The ticket the player wants to draw.
     * @param queue The queue associated with the ticket's box.
     * @param playerId The player requesting the draw.
     * @throws DrawValidationException if any rule is violated.
     */
    public fun validateTicketSelection(
        ticket: DrawTicket,
        queue: Queue,
        playerId: PlayerId,
    ) {
        if (ticket.status == DrawTicketStatus.DRAWN) {
            throw DrawValidationException("Ticket ${ticket.id} has already been drawn")
        }
        val now = Clock.System.now()
        val expiresAt =
            queue.sessionExpiresAt
                ?: throw DrawValidationException("No active session on queue ${queue.id}")
        if (now >= expiresAt) {
            throw DrawValidationException("Draw session expired at $expiresAt")
        }
        if (queue.activePlayerId != playerId) {
            throw DrawValidationException(
                "Player ${playerId.value} is not the active session holder for queue ${queue.id}",
            )
        }
    }

    /**
     * Validates that the box has enough remaining tickets for a multi-draw.
     *
     * @param box The ticket box to draw from.
     * @param quantity The number of tickets requested.
     * @throws DrawValidationException if [TicketBox.remainingTickets] < [quantity].
     */
    public fun validateMultiDraw(
        box: TicketBox,
        quantity: Int,
    ) {
        require(quantity > 0) { "Quantity must be positive, was $quantity" }
        if (box.remainingTickets < quantity) {
            throw DrawValidationException(
                "Box ${box.id} has only ${box.remainingTickets} remaining tickets; requested $quantity",
            )
        }
    }

    /**
     * Selects [quantity] tickets at random from [availableTickets] using [SecureRandom].
     *
     * The selection is performed via a Fisher-Yates partial shuffle so that every
     * combination of [quantity] tickets from the available pool is equally likely.
     *
     * @param availableTickets All tickets eligible to be drawn (status = AVAILABLE).
     * @param quantity Number of tickets to select.
     * @return A list of exactly [quantity] randomly selected tickets.
     * @throws IllegalArgumentException if [availableTickets] has fewer than [quantity] elements.
     */
    public fun selectRandomTickets(
        availableTickets: List<DrawTicket>,
        quantity: Int,
    ): List<DrawTicket> {
        require(availableTickets.size >= quantity) {
            "Not enough available tickets: have ${availableTickets.size}, need $quantity"
        }
        val mutable = availableTickets.toMutableList()
        repeat(quantity) { i ->
            val swapIdx = i + secureRandom.nextInt(mutable.size - i)
            val tmp = mutable[i]
            mutable[i] = mutable[swapIdx]
            mutable[swapIdx] = tmp
        }
        return mutable.subList(0, quantity).toList()
    }
}
