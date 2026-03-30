package com.prizedraw.viewmodels.trade

import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.data.remote.TradeRemoteDataSource
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.coroutines.launch

/**
 * MVI state for the trade marketplace screen.
 *
 * @property listings Paginated marketplace listings.
 * @property gradeFilter Optional grade filter string (e.g. `A`, `LAST`).
 * @property minPrice Optional minimum price filter in draw points.
 * @property maxPrice Optional maximum price filter in draw points.
 * @property currentPage Zero-based current page index.
 * @property hasMore Whether more pages are available.
 * @property isLoading True while fetching data.
 * @property error Human-readable error message, or null.
 */
public data class MarketplaceState(
    val listings: List<TradeListingDto> = emptyList(),
    val gradeFilter: String? = null,
    val minPrice: Int? = null,
    val maxPrice: Int? = null,
    val currentPage: Int = 0,
    val hasMore: Boolean = true,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/**
 * MVI intents for the marketplace screen.
 */
public sealed class MarketplaceIntent {
    /** Load the first page of listings with current filters. */
    public data object LoadListings : MarketplaceIntent()

    /** Load the next page of listings (pagination). */
    public data object LoadMore : MarketplaceIntent()

    /** Apply grade filter. Null clears the filter. */
    public data class SetGradeFilter(
        val grade: String?,
    ) : MarketplaceIntent()

    /** Apply price range filter. */
    public data class SetPriceRange(
        val min: Int?,
        val max: Int?,
    ) : MarketplaceIntent()

    /** Reset all filters and reload. */
    public data object ClearFilters : MarketplaceIntent()
}

private const val PAGE_SIZE = 20

/**
 * ViewModel driving the trade marketplace MVI flow.
 *
 * @param tradeDataSource Remote data source for trade listing HTTP calls.
 */
public class MarketplaceViewModel(
    private val tradeDataSource: TradeRemoteDataSource,
) : BaseViewModel<MarketplaceState, MarketplaceIntent>(MarketplaceState()) {

    override fun onIntent(intent: MarketplaceIntent) {
        when (intent) {
            is MarketplaceIntent.LoadListings -> loadListings(resetPage = true)
            is MarketplaceIntent.LoadMore -> loadListings(resetPage = false)
            is MarketplaceIntent.SetGradeFilter -> {
                setState(state.value.copy(gradeFilter = intent.grade))
                loadListings(resetPage = true)
            }
            is MarketplaceIntent.SetPriceRange -> {
                setState(state.value.copy(minPrice = intent.min, maxPrice = intent.max))
                loadListings(resetPage = true)
            }
            is MarketplaceIntent.ClearFilters -> {
                setState(
                    state.value.copy(
                        gradeFilter = null,
                        minPrice = null,
                        maxPrice = null,
                    ),
                )
                loadListings(resetPage = true)
            }
        }
    }

    private fun loadListings(resetPage: Boolean) {
        // Guard: do not stack another request while one is already in flight.
        if (state.value.isLoading) return

        val targetPage = if (resetPage) 0 else state.value.currentPage + 1

        viewModelScope.launch {
            setState(state.value.copy(isLoading = true, error = null))
            runCatching {
                tradeDataSource.fetchTradeListings(
                    page = targetPage,
                    pageSize = PAGE_SIZE,
                    grade = state.value.gradeFilter,
                    minPrice = state.value.minPrice,
                    maxPrice = state.value.maxPrice,
                )
            }.onSuccess { page ->
                val updatedListings =
                    if (resetPage) page.items else state.value.listings + page.items
                val fetchedCount = if (resetPage) page.items.size else updatedListings.size
                setState(
                    state.value.copy(
                        listings = updatedListings,
                        currentPage = targetPage,
                        hasMore = fetchedCount < page.totalCount,
                        isLoading = false,
                    ),
                )
            }.onFailure { error ->
                setState(
                    state.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to load listings",
                    ),
                )
            }
        }
    }
}
