package com.prizedraw.screens.trade

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.card.PrizeImageCard
import com.prizedraw.components.chip.TierBadge
import com.prizedraw.components.common.EmptyState
import com.prizedraw.components.input.SearchFilterBar
import com.prizedraw.components.layout.FilterTabs
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.components.user.PointsDisplay
import com.prizedraw.components.user.UserProfileRow
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.viewmodels.trade.MarketplaceIntent
import com.prizedraw.viewmodels.trade.MarketplaceViewModel

private val BUY_SELL_TABS = listOf("BUY", "SELL")

/**
 * Trade marketplace browse screen.
 *
 * Shows a "Marketplace" section header, a search filter bar, BUY/SELL toggle
 * tabs, and a responsive [LazyVerticalGrid] of marketplace listing cards
 * (2 columns on phone, 4 on tablet). Each card shows the prize image, tier
 * badge, seller profile row, price via [PointsDisplay], and a BUY NOW button.
 * A "LOAD MORE TREASURES" button appears at the bottom.
 */
@Composable
public fun MarketplaceScreen(
    viewModel: MarketplaceViewModel,
    onListingClick: (TradeListingDto) -> Unit,
    onCreateListing: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var buySellIndex by remember { mutableIntStateOf(0) }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSize = rememberWindowWidthSizeClass(maxWidth)
        val gridColumns = if (windowSize == WindowWidthSizeClass.Compact) 2 else 4

        Column(modifier = Modifier.fillMaxSize()) {
            // Page header
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                SectionHeader(
                    title = S("marketplace.title"),
                    subtitle = S("marketplace.subtitle"),
                )

                // Search bar with BUY/SELL toggle in trailing slot
                SearchFilterBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    placeholder = S("marketplace.searchPlaceholder"),
                    modifier = Modifier.padding(top = 8.dp),
                )

                // BUY / SELL toggle tabs
                FilterTabs(
                    tabs = BUY_SELL_TABS,
                    selectedIndex = buySellIndex,
                    onTabSelected = { index ->
                        buySellIndex = index
                        if (index == 1) onCreateListing()
                    },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            // Content
            Box(modifier = Modifier.weight(1f)) {
                when {
                    state.isLoading && state.listings.isEmpty() -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    state.error != null -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(text = state.error ?: "")
                        }
                    }
                    state.listings.isEmpty() -> {
                        EmptyState(
                            icon = Icons.Filled.ShoppingCart,
                            title = S("marketplace.emptyTitle"),
                            subtitle = S("marketplace.emptySubtitle"),
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    else -> {
                        val displayedListings = if (searchQuery.isBlank()) {
                            state.listings
                        } else {
                            state.listings.filter {
                                it.prizeName.contains(searchQuery, ignoreCase = true) ||
                                    it.sellerNickname.contains(searchQuery, ignoreCase = true)
                            }
                        }
                        Column(modifier = Modifier.fillMaxSize()) {
                            LazyVerticalGrid(
                                columns = GridCells.Fixed(gridColumns),
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                items(displayedListings) { listing ->
                                    MarketplaceListingCard(
                                        listing = listing,
                                        onClick = { onListingClick(listing) },
                                    )
                                }
                            }

                            // Load more button
                            if (state.hasMore) {
                                PrizeDrawOutlinedButton(
                                    text = S("marketplace.loadMore"),
                                    onClick = { viewModel.onIntent(MarketplaceIntent.LoadMore) },
                                    fullWidth = true,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MarketplaceListingCard(
    listing: TradeListingDto,
    onClick: () -> Unit,
) {
    PrizeDrawCard(modifier = Modifier.fillMaxWidth()) {
        // Prize image with tier badge overlay
        PrizeImageCard(
            imageUrl = listing.prizePhotoUrl,
            name = listing.prizeName,
            seriesName = listing.sellerNickname,
            tierGrade = listing.prizeGrade,
            onClick = onClick,
        )

        // Seller row
        UserProfileRow(
            nickname = listing.sellerNickname,
            avatarSize = 24.dp,
            modifier = Modifier.padding(top = 8.dp),
        )

        // Price row
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PointsDisplay(
                points = listing.listPrice.toString(),
                label = S("marketplace.pts"),
            )
            TierBadge(grade = listing.prizeGrade)
        }

        // Buy button
        PrizeDrawOutlinedButton(
            text = S("marketplace.buyNow"),
            onClick = onClick,
            fullWidth = true,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
