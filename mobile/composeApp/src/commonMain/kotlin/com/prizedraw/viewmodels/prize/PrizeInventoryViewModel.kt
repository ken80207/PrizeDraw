package com.prizedraw.viewmodels.prize

import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.data.remote.PrizeRemoteDataSource
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.coroutines.launch

/**
 * MVI state for the player's prize inventory screen.
 *
 * @property prizes Full list of fetched prize instances.
 * @property filteredPrizes Prizes after applying the active [filter].
 * @property filter Currently selected state filter. Null = show all.
 * @property isLoading True while an async operation is in flight.
 * @property error Human-readable error message, or null.
 */
public data class PrizeInventoryState(
    val prizes: List<PrizeInstanceDto> = emptyList(),
    val filteredPrizes: List<PrizeInstanceDto> = emptyList(),
    val filter: PrizeState? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/**
 * MVI intents for the prize inventory screen.
 */
public sealed class PrizeInventoryIntent {
    /** Load the player's prize inventory from the API. */
    public data object LoadInventory : PrizeInventoryIntent()

    /** Apply a state filter tab. Pass null to show all prizes. */
    public data class SetFilter(
        val state: PrizeState?,
    ) : PrizeInventoryIntent()

    /** Refresh the inventory list. */
    public data object Refresh : PrizeInventoryIntent()
}

/**
 * ViewModel driving the prize inventory MVI flow.
 *
 * @param prizeDataSource Remote data source for prize inventory HTTP calls.
 */
public class PrizeInventoryViewModel(
    private val prizeDataSource: PrizeRemoteDataSource,
) : BaseViewModel<PrizeInventoryState, PrizeInventoryIntent>(PrizeInventoryState()) {

    override fun onIntent(intent: PrizeInventoryIntent) {
        when (intent) {
            is PrizeInventoryIntent.LoadInventory -> loadInventory()
            is PrizeInventoryIntent.Refresh -> loadInventory()
            is PrizeInventoryIntent.SetFilter -> applyFilter(intent.state)
        }
    }

    private fun loadInventory() {
        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching { prizeDataSource.fetchMyPrizes() }
                .onSuccess { prizes ->
                    setState(
                        state.value.copy(
                            prizes = prizes,
                            filteredPrizes = applyFilterToList(prizes, state.value.filter),
                            isLoading = false,
                        ),
                    )
                }
                .onFailure { error ->
                    setState(
                        state.value.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to load prizes",
                        ),
                    )
                }
        }
    }

    private fun applyFilter(filter: PrizeState?) {
        setState(
            state.value.copy(
                filter = filter,
                filteredPrizes = applyFilterToList(state.value.prizes, filter),
            ),
        )
    }

    private fun applyFilterToList(
        prizes: List<PrizeInstanceDto>,
        filter: PrizeState?,
    ): List<PrizeInstanceDto> = if (filter == null) prizes else prizes.filter { it.state == filter }
}
