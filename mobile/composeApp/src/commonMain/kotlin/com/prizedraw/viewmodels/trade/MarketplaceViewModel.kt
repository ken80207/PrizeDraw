package com.prizedraw.viewmodels.trade

import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.viewmodels.base.BaseViewModel

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

/**
 * ViewModel driving the trade marketplace MVI flow.
 *
 * TODO(T135): Implement after TradeRemoteDataSource is wired.
 *
 * Implementation checklist:
 * - [MarketplaceIntent.LoadListings]: GET /api/v1/trade/listings?page=0, replace listings.
 * - [MarketplaceIntent.LoadMore]: GET /api/v1/trade/listings?page=n, append listings.
 * - [MarketplaceIntent.SetGradeFilter]: update gradeFilter, reload listings.
 * - [MarketplaceIntent.SetPriceRange]: update price bounds, reload listings.
 * - [MarketplaceIntent.ClearFilters]: reset all filters, reload listings.
 */
public class MarketplaceViewModel : BaseViewModel<MarketplaceState, MarketplaceIntent>(MarketplaceState()) {
    override fun onIntent(intent: MarketplaceIntent) {
        TODO(
            "T135: implement MVI dispatch — LoadListings, LoadMore, SetGradeFilter, " +
                "SetPriceRange, ClearFilters",
        )
    }
}
