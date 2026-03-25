package com.prizedraw.viewmodels.draw

import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.viewmodels.base.BaseViewModel

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
 * TODO(T117): Implement intent dispatch once [com.prizedraw.data.remote.CampaignRemoteDataSource]
 *   and [com.prizedraw.data.remote.DrawRemoteDataSource] are wired into the shared module.
 *
 * Implementation checklist:
 * - [UnlimitedDrawIntent.LoadCampaign]: fetch unlimited campaign detail from
 *   `GET /api/v1/campaigns/unlimited/{id}`, populate [UnlimitedDrawState.campaign],
 *   [UnlimitedDrawState.prizeDefinitions], and [UnlimitedDrawState.pointBalance].
 * - [UnlimitedDrawIntent.Draw]: set [UnlimitedDrawState.isDrawing] = true, call
 *   `POST /api/v1/draws/unlimited` [quantity] times (sequential for rapid-fire mode),
 *   accumulate results into [UnlimitedDrawState.drawHistory], update [lastResult] and
 *   decrement [pointBalance] locally, then set [isDrawing] = false.
 * - [UnlimitedDrawIntent.DismissError]: set [UnlimitedDrawState.error] = null.
 * - [UnlimitedDrawIntent.AcknowledgeResult]: set [UnlimitedDrawState.lastResult] = null.
 */
public class UnlimitedDrawViewModel : BaseViewModel<UnlimitedDrawState, UnlimitedDrawIntent>(UnlimitedDrawState()) {
    override fun onIntent(intent: UnlimitedDrawIntent) {
        TODO(
            "T117: implement MVI intent dispatch for $intent — " +
                "LoadCampaign, Draw (single + rapid-fire), DismissError, AcknowledgeResult",
        )
    }
}
