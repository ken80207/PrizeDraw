package com.prizedraw.viewmodels.draw

import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.data.remote.CampaignRemoteDataSource
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
 * Handles campaign loading via [CampaignRemoteDataSource]. The [UnlimitedDrawIntent.Draw]
 * intent is pending implementation of [com.prizedraw.data.remote.DrawRemoteDataSource] (T117).
 *
 * @param campaignDataSource Data source for unlimited campaign HTTP calls.
 */
public class UnlimitedDrawViewModel(
    private val campaignDataSource: CampaignRemoteDataSource,
) : BaseViewModel<UnlimitedDrawState, UnlimitedDrawIntent>(UnlimitedDrawState()) {

    override fun onIntent(intent: UnlimitedDrawIntent) {
        when (intent) {
            is UnlimitedDrawIntent.LoadCampaign -> loadCampaign(intent.id)
            is UnlimitedDrawIntent.Draw -> {
                // TODO(T117): implement draw via DrawRemoteDataSource once wired.
                setState(state.value.copy(error = "Draw not yet implemented (T117)."))
            }
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
}
