package com.prizedraw.viewmodels.prize

import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.viewmodels.base.BaseViewModel

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
 * TODO(T125): Implement after PrizeRemoteDataSource is wired.
 *
 * Implementation checklist:
 * - [PrizeInventoryIntent.LoadInventory]: call GET /api/v1/players/me/prizes, update prizes.
 * - [PrizeInventoryIntent.SetFilter]: update filter and recompute filteredPrizes.
 * - [PrizeInventoryIntent.Refresh]: re-fetch inventory.
 */
public class PrizeInventoryViewModel :
    BaseViewModel<PrizeInventoryState, PrizeInventoryIntent>(PrizeInventoryState()) {
    override fun onIntent(intent: PrizeInventoryIntent) {
        TODO(
            "T125: implement MVI intent dispatch — LoadInventory, SetFilter, Refresh",
        )
    }
}
