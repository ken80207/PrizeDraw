package com.prizedraw.viewmodels.campaign

import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.campaign.TicketBoxDto
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.contracts.dto.draw.JoinQueueRequest
import com.prizedraw.contracts.dto.draw.LeaveQueueRequest
import com.prizedraw.contracts.dto.draw.QueueEntryDto
import com.prizedraw.contracts.dto.draw.SwitchBoxRequest
import com.prizedraw.data.remote.CampaignRemoteDataSource
import com.prizedraw.data.remote.DrawRemoteDataSource
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.coroutines.launch

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
 * Handles campaign loading, ticket board fetching, draw execution, and queue
 * management. Draw and queue operations delegate to [drawDataSource].
 *
 * When the player is unauthenticated (no stored token) the draw/queue calls will
 * receive HTTP 401 from the server; this is converted to an error state rather
 * than a crash.
 *
 * @param campaignDataSource Data source for campaign and ticket board HTTP calls.
 * @param drawDataSource Data source for draw execution and queue management.
 */
public class KujiCampaignViewModel(
    private val campaignDataSource: CampaignRemoteDataSource,
    private val drawDataSource: DrawRemoteDataSource,
) : BaseViewModel<KujiCampaignState, KujiCampaignIntent>(KujiCampaignState()) {

    override fun onIntent(intent: KujiCampaignIntent) {
        when (intent) {
            is KujiCampaignIntent.LoadCampaign -> loadCampaign(intent.campaignId)
            is KujiCampaignIntent.SelectBox -> selectBox(intent.boxId)
            is KujiCampaignIntent.WebSocketTicketDrawn -> reloadTicketBoard()
            is KujiCampaignIntent.SessionExpired ->
                setState(state.value.copy(isMyTurn = false, sessionCountdown = null))
            is KujiCampaignIntent.SpectatorCountUpdated ->
                setState(state.value.copy(spectatorCount = intent.count))
            is KujiCampaignIntent.JoinQueue -> joinQueue()
            is KujiCampaignIntent.LeaveQueue -> leaveQueue()
            is KujiCampaignIntent.SelectTicket -> drawKuji(ticketIds = intent.ticketIds)
            is KujiCampaignIntent.MultiDraw -> drawKuji(quantity = intent.quantity)
            is KujiCampaignIntent.SwitchBox -> switchBox(intent.toBoxId)
        }
    }

    private fun loadCampaign(campaignId: String) {
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching { campaignDataSource.fetchKujiCampaignDetail(campaignId) }
                .onSuccess { detail ->
                    val firstBox = detail.boxes.firstOrNull()
                    setState(
                        state.value.copy(
                            campaign = detail.campaign,
                            boxes = detail.boxes,
                            selectedBox = firstBox,
                            isLoading = false,
                        ),
                    )
                    // Eagerly load the ticket board for the first box.
                    firstBox?.let { loadTicketBoard(campaignId, it.id) }
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to load campaign",
                        ),
                    )
                }
        }
    }

    private fun selectBox(boxId: String) {
        val box = state.value.boxes.firstOrNull { it.id == boxId } ?: return
        setState(state.value.copy(selectedBox = box, tickets = emptyList()))
        val campaignId = state.value.campaign?.id ?: return
        viewModelScope.launch { loadTicketBoard(campaignId, boxId) }
    }

    private fun reloadTicketBoard() {
        val campaignId = state.value.campaign?.id ?: return
        val boxId = state.value.selectedBox?.id ?: return
        viewModelScope.launch { loadTicketBoard(campaignId, boxId) }
    }

    private suspend fun loadTicketBoard(
        campaignId: String,
        boxId: String,
    ) {
        runCatching { campaignDataSource.fetchTicketBoard(campaignId, boxId) }
            .onSuccess { tickets ->
                setState(state.value.copy(tickets = tickets))
            }
            .onFailure { error ->
                setState(state.value.copy(error = error.message ?: "Failed to load ticket board"))
            }
    }

    private fun drawKuji(
        ticketIds: List<String> = emptyList(),
        quantity: Int = 1,
    ) {
        val campaignId = state.value.campaign?.id ?: return
        val boxId = state.value.selectedBox?.id ?: return
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching {
                drawDataSource.drawKuji(
                    campaignId = campaignId,
                    boxId = boxId,
                    ticketIds = ticketIds,
                    quantity = quantity,
                )
            }
                .onSuccess { result ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            lastDrawResult = result,
                        ),
                    )
                    // Refresh the ticket board so drawn positions are reflected.
                    loadTicketBoard(campaignId, boxId)
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Draw failed",
                        ),
                    )
                }
        }
    }

    private fun joinQueue() {
        val boxId = state.value.selectedBox?.id ?: return
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching { drawDataSource.joinQueue(JoinQueueRequest(ticketBoxId = boxId)) }
                .onSuccess { entry ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            queueEntry = entry,
                        ),
                    )
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to join queue",
                        ),
                    )
                }
        }
    }

    private fun leaveQueue() {
        val boxId = state.value.selectedBox?.id ?: return
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching { drawDataSource.leaveQueue(LeaveQueueRequest(ticketBoxId = boxId)) }
                .onSuccess {
                    setState(
                        state.value.copy(
                            isLoading = false,
                            queueEntry = null,
                            isMyTurn = false,
                            sessionCountdown = null,
                        ),
                    )
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to leave queue",
                        ),
                    )
                }
        }
    }

    private fun switchBox(toBoxId: String) {
        val fromBoxId = state.value.selectedBox?.id ?: return
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching {
                drawDataSource.switchBox(
                    SwitchBoxRequest(fromBoxId = fromBoxId, toBoxId = toBoxId),
                )
            }
                .onSuccess { entry ->
                    // Also apply the UI box selection.
                    val newBox = state.value.boxes.firstOrNull { it.id == toBoxId }
                    setState(
                        state.value.copy(
                            isLoading = false,
                            queueEntry = entry,
                            selectedBox = newBox ?: state.value.selectedBox,
                            tickets = emptyList(),
                        ),
                    )
                    val campaignId = state.value.campaign?.id ?: return@onSuccess
                    loadTicketBoard(campaignId, toBoxId)
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to switch box",
                        ),
                    )
                }
        }
    }
}
