package com.prizedraw.viewmodels.draw

import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.data.remote.CampaignRemoteDataSource
import com.prizedraw.data.remote.DrawRemoteDataSource
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.coroutines.launch

/**
 * MVI state for the unlimited draw flow.
 *
 * @property campaign The active unlimited campaign. Null until [UnlimitedDrawIntent.LoadCampaign]
 *   completes successfully.
 * @property prizeDefinitions Prize probability table for the campaign. Ordered by [displayOrder].
 * @property lastResult The most recent draw result. Null before the first draw is executed.
 * @property drawHistory Accumulated list of all results in the current session, newest first.
 * @property pointBalance The player's current draw-point balance. Null until loaded.
 * @property isDrawing True while a draw request is in flight (prevents duplicate submissions).
 * @property isLoading True while the campaign detail is loading.
 * @property error Human-readable error message, or null when no error is present.
 */
public data class UnlimitedDrawState(
    val campaign: UnlimitedCampaignDto? = null,
    val prizeDefinitions: List<PrizeDefinitionDto> = emptyList(),
    val lastResult: UnlimitedDrawResultDto? = null,
    val drawHistory: List<UnlimitedDrawResultDto> = emptyList(),
    val pointBalance: Int? = null,
    val isDrawing: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/**
 * MVI intents for the unlimited draw flow.
 */
public sealed class UnlimitedDrawIntent {
    /**
     * Load the unlimited campaign detail and prize probability table.
     *
     * @property id The campaign UUID string.
     */
    public data class LoadCampaign(
        val id: String,
    ) : UnlimitedDrawIntent()

    /**
     * Execute a draw on the currently loaded campaign.
     *
     * @property quantity Number of draws to perform in rapid-fire mode (1 for single draw).
     * @property playerCouponId Optional coupon UUID string to apply a discount. Null if unused.
     */
    public data class Draw(
        val quantity: Int = 1,
        val playerCouponId: String? = null,
    ) : UnlimitedDrawIntent()

    /** Dismiss the current error and clear [UnlimitedDrawState.error]. */
    public data object DismissError : UnlimitedDrawIntent()

    /** Clear [UnlimitedDrawState.lastResult] after the reveal animation completes. */
    public data object AcknowledgeResult : UnlimitedDrawIntent()
}

/**
 * ViewModel driving the unlimited draw MVI flow.
 *
 * Handles campaign loading via [campaignDataSource] and draw execution via
 * [drawDataSource]. When the player is unauthenticated (no stored token) the
 * draw call receives HTTP 401; this is converted to an error state rather than
 * a crash.
 *
 * @param campaignDataSource Data source for unlimited campaign HTTP calls.
 * @param drawDataSource Data source for draw execution.
 */
public class UnlimitedDrawViewModel(
    private val campaignDataSource: CampaignRemoteDataSource,
    private val drawDataSource: DrawRemoteDataSource,
) : BaseViewModel<UnlimitedDrawState, UnlimitedDrawIntent>(UnlimitedDrawState()) {

    override fun onIntent(intent: UnlimitedDrawIntent) {
        when (intent) {
            is UnlimitedDrawIntent.LoadCampaign -> loadCampaign(intent.id)
            is UnlimitedDrawIntent.Draw -> executeDraw(intent.quantity, intent.playerCouponId)
            is UnlimitedDrawIntent.DismissError -> setState(state.value.copy(error = null))
            is UnlimitedDrawIntent.AcknowledgeResult -> setState(state.value.copy(lastResult = null))
        }
    }

    private fun loadCampaign(campaignId: String) {
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching { campaignDataSource.fetchUnlimitedCampaignDetail(campaignId) }
                .onSuccess { detail ->
                    setState(
                        state.value.copy(
                            campaign = detail.campaign,
                            prizeDefinitions = detail.prizes,
                            isLoading = false,
                        ),
                    )
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

    private fun executeDraw(
        quantity: Int,
        playerCouponId: String?,
    ) {
        val campaignId = state.value.campaign?.id ?: run {
            setState(state.value.copy(error = "Campaign not loaded"))
            return
        }
        // Guard against duplicate in-flight draws.
        if (state.value.isDrawing) return

        viewModelScope.launch {
            setState(state.value.copy(isDrawing = true, error = null))
            runCatching {
                drawDataSource.drawUnlimited(
                    campaignId = campaignId,
                    count = quantity,
                    playerCouponId = playerCouponId,
                )
            }
                .onSuccess { result ->
                    setState(
                        state.value.copy(
                            isDrawing = false,
                            lastResult = result,
                            drawHistory = listOf(result) + state.value.drawHistory,
                        ),
                    )
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isDrawing = false,
                            error = error.message ?: "Draw failed",
                        ),
                    )
                }
        }
    }
}
