package com.prizedraw.viewmodels.leaderboard

import com.prizedraw.contracts.dto.leaderboard.LeaderboardEntryDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.dto.leaderboard.SelfRankDto
import com.prizedraw.data.remote.LeaderboardRemoteDataSource
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.coroutines.launch

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
 * State is updated immediately on type/period selection, then a coroutine fetches
 * fresh data from [LeaderboardRemoteDataSource] and updates [LeaderboardState.entries]
 * and [LeaderboardState.selfRank].
 *
 * @param leaderboardDataSource Data source for leaderboard HTTP calls.
 */
public class LeaderboardViewModel(
    private val leaderboardDataSource: LeaderboardRemoteDataSource,
) : BaseViewModel<LeaderboardState, LeaderboardIntent>(LeaderboardState()) {

    init {
        // Load initial data when the ViewModel is first created.
        fetchLeaderboard()
    }

    override fun onIntent(intent: LeaderboardIntent) {
        when (intent) {
            is LeaderboardIntent.SelectType -> {
                setState(state.value.copy(selectedType = intent.type, isLoading = true, error = null))
                fetchLeaderboard()
            }
            is LeaderboardIntent.SelectPeriod -> {
                setState(state.value.copy(selectedPeriod = intent.period, isLoading = true, error = null))
                fetchLeaderboard()
            }
            is LeaderboardIntent.Refresh -> {
                setState(state.value.copy(isLoading = true, error = null))
                fetchLeaderboard()
            }
        }
    }

    private fun fetchLeaderboard() {
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching {
                leaderboardDataSource.fetchLeaderboard(
                    type = state.value.selectedType,
                    period = state.value.selectedPeriod,
                )
            }
                .onSuccess { dto ->
                    setState(
                        state.value.copy(
                            entries = dto.entries,
                            selfRank = dto.selfRank,
                            isLoading = false,
                        ),
                    )
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to load leaderboard",
                        ),
                    )
                }
        }
    }
}
