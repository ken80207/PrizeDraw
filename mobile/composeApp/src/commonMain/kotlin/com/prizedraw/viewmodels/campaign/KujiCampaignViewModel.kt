package com.prizedraw.viewmodels.campaign

import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.campaign.TicketBoxDto
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.contracts.dto.draw.QueueEntryDto
import com.prizedraw.viewmodels.base.BaseViewModel

/**
 * MVI state for the kuji campaign flow.
 *
 * @property campaign The active campaign, or null before data loads.
 * @property boxes The campaign's ticket boxes.
 * @property selectedBox The currently displayed box.
 * @property tickets Ticket board for the selected box.
 * @property queueEntry The current player's queue entry, or null when not queued (spectator mode).
 * @property sessionCountdown Remaining session seconds, or null when not active.
 * @property isMyTurn True when the player holds the active draw session.
 * @property spectatorCount Number of viewers currently connected to the campaign room.
 * @property isLoading True while an async operation is in flight.
 * @property error Human-readable error message, or null.
 */
public data class KujiCampaignState(
    val campaign: KujiCampaignDto? = null,
    val boxes: List<TicketBoxDto> = emptyList(),
    val selectedBox: TicketBoxDto? = null,
    val tickets: List<DrawTicketDto> = emptyList(),
    val queueEntry: QueueEntryDto? = null,
    val sessionCountdown: Int? = null,
    val isMyTurn: Boolean = false,
    val spectatorCount: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val lastDrawResult: DrawResultDto? = null,
)

/**
 * MVI intents for the kuji campaign flow.
 */
public sealed class KujiCampaignIntent {
    /** Load the campaign detail and ticket board for [campaignId]. */
    public data class LoadCampaign(
        val campaignId: String,
    ) : KujiCampaignIntent()

    /** Select a specific ticket box to display. */
    public data class SelectBox(
        val boxId: String,
    ) : KujiCampaignIntent()

    /** Join the draw queue for the currently selected box. */
    public data object JoinQueue : KujiCampaignIntent()

    /** Leave the draw queue for the currently selected box. */
    public data object LeaveQueue : KujiCampaignIntent()

    /**
     * Draw a specific set of tickets.
     *
     * @property ticketIds IDs of the tickets to draw. Empty for random multi-draw.
     */
    public data class SelectTicket(
        val ticketIds: List<String>,
    ) : KujiCampaignIntent()

    /**
     * Execute a multi-draw of [quantity] random tickets.
     *
     * @property quantity Number of tickets to draw (e.g. 1, 3, 5, 12).
     */
    public data class MultiDraw(
        val quantity: Int,
    ) : KujiCampaignIntent()

    /**
     * Switch from the current box queue to a different box queue.
     *
     * @property toBoxId The target box to switch to.
     */
    public data class SwitchBox(
        val toBoxId: String,
    ) : KujiCampaignIntent()

    /**
     * A ticket-drawn WebSocket event arrived for the current campaign.
     *
     * @property drawnByNickname Display name of the player who drew.
     * @property ticketCount Number of tickets drawn.
     */
    public data class WebSocketTicketDrawn(
        val drawnByNickname: String,
        val ticketCount: Int,
    ) : KujiCampaignIntent()

    /** The active draw session has expired. */
    public data object SessionExpired : KujiCampaignIntent()

    /**
     * A spectator count update arrived from the WebSocket.
     *
     * @property count Total number of connections in the campaign room.
     */
    public data class SpectatorCountUpdated(
        val count: Int,
    ) : KujiCampaignIntent()
}

/**
 * ViewModel driving the kuji campaign MVI flow.
 *
 * TODO(T108): Implement after [com.prizedraw.data.remote.CampaignRemoteDataSource],
 *   [com.prizedraw.data.remote.DrawRemoteDataSource], and WebSocket clients are wired.
 *
 * Implementation checklist:
 * - [KujiCampaignIntent.LoadCampaign]: fetch campaign detail, board, and start WS connection.
 * - [KujiCampaignIntent.JoinQueue]: call DrawRemoteDataSource.joinQueue, update queueEntry.
 * - [KujiCampaignIntent.LeaveQueue]: call DrawRemoteDataSource.leaveQueue, clear queueEntry.
 * - [KujiCampaignIntent.SelectTicket]: call DrawRemoteDataSource.drawKuji with explicit IDs.
 * - [KujiCampaignIntent.MultiDraw]: call DrawRemoteDataSource.drawKuji with quantity.
 * - [KujiCampaignIntent.SwitchBox]: call DrawRemoteDataSource.switchBox, update selectedBox.
 * - [KujiCampaignIntent.WebSocketTicketDrawn]: reload ticket board.
 * - [KujiCampaignIntent.SessionExpired]: update isMyTurn, clear countdown.
 */
public class KujiCampaignViewModel : BaseViewModel<KujiCampaignState, KujiCampaignIntent>(KujiCampaignState()) {
    override fun onIntent(intent: KujiCampaignIntent) {
        TODO(
            "T108: implement MVI intent dispatch for $intent — " +
                "LoadCampaign, SelectBox, JoinQueue, LeaveQueue, SelectTicket, " +
                "MultiDraw, SwitchBox, WebSocketTicketDrawn, SessionExpired",
        )
    }
}
