package com.prizedraw.viewmodels.leaderboard

import com.prizedraw.contracts.dto.leaderboard.LeaderboardEntryDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.dto.leaderboard.SelfRankDto
import com.prizedraw.viewmodels.base.BaseViewModel

/**
 * MVI state for the leaderboard screen.
 *
 * @property selectedType The currently displayed metric type.
 * @property selectedPeriod The currently displayed time period.
 * @property entries Ranked leaderboard entries.
 * @property selfRank The authenticated player's own rank, or null when not in the top list.
 * @property isLoading True while a fetch is in progress.
 * @property error Human-readable error message, or null.
 */
public data class LeaderboardState(
    val selectedType: LeaderboardType = LeaderboardType.DRAW_COUNT,
    val selectedPeriod: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME,
    val entries: List<LeaderboardEntryDto> = emptyList(),
    val selfRank: SelfRankDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/** MVI intents for the leaderboard screen. */
public sealed class LeaderboardIntent {
    /** Switch the displayed leaderboard type. */
    public data class SelectType(
        val type: LeaderboardType,
    ) : LeaderboardIntent()

    /** Switch the displayed time period. */
    public data class SelectPeriod(
        val period: LeaderboardPeriod,
    ) : LeaderboardIntent()

    /** Refresh the current leaderboard data. */
    public data object Refresh : LeaderboardIntent()
}

/**
 * ViewModel driving the leaderboard MVI flow.
 *
 * TODO: inject a leaderboard data source and implement coroutine-based fetching.
 * When [LeaderboardIntent.SelectType] or [LeaderboardIntent.SelectPeriod] fires,
 * update state immediately then trigger a data fetch in a coroutine.
 */
public class LeaderboardViewModel : BaseViewModel<LeaderboardState, LeaderboardIntent>(LeaderboardState()) {
    override fun onIntent(intent: LeaderboardIntent) {
        when (intent) {
            is LeaderboardIntent.SelectType ->
                setState(state.value.copy(selectedType = intent.type, isLoading = true))
            is LeaderboardIntent.SelectPeriod ->
                setState(state.value.copy(selectedPeriod = intent.period, isLoading = true))
            is LeaderboardIntent.Refresh ->
                setState(state.value.copy(isLoading = true))
        }
        // TODO: launch coroutine to fetch leaderboard data
    }
}
