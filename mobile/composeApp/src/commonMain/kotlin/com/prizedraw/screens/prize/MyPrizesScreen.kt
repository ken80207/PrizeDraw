package com.prizedraw.screens.prize

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
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.components.card.PrizeImageCard
import com.prizedraw.components.card.StatCard
import com.prizedraw.components.common.EmptyState
import com.prizedraw.components.input.SearchFilterBar
import com.prizedraw.components.layout.FilterTabs
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.viewmodels.prize.PrizeInventoryIntent
import com.prizedraw.viewmodels.prize.PrizeInventoryViewModel

private data class FilterTab(
    val labelKey: String,
    val state: PrizeState?,
)

private val FILTER_TABS: List<FilterTab> =
    listOf(
        FilterTab(labelKey = "prizes.filterAll", state = null),
        FilterTab(labelKey = "prizes.filterHolding", state = PrizeState.HOLDING),
        FilterTab(labelKey = "prizes.filterInTransit", state = PrizeState.PENDING_SHIPMENT),
        FilterTab(labelKey = "prizes.filterShipped", state = PrizeState.SHIPPED),
    )

/**
 * Prize inventory grid screen showing the player's owned prizes.
 *
 * Displays a "Curated Treasures" section header with item count, a search bar,
 * filter tabs (All / In Possession / In Trade / Shipping), a responsive
 * [LazyVerticalGrid] of [PrizeImageCard]s (2 columns on phone, 3 on tablet),
 * and a fixed bottom stats bar showing Total Value, Global Rank, SSR Ratio,
 * and Pending Shipments.
 */
@Composable
public fun MyPrizesScreen(
    viewModel: PrizeInventoryViewModel,
    onPrizeClick: (PrizeInstanceDto) -> Unit,
) {
    val state by viewModel.state.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    val selectedTabIndex = FILTER_TABS.indexOfFirst { it.state == state.filter }.coerceAtLeast(0)
    val tabLabels = FILTER_TABS.map { S(it.labelKey) }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSize = rememberWindowWidthSizeClass(maxWidth)
        val gridColumns = if (windowSize == WindowWidthSizeClass.Compact) 2 else 3

        Column(modifier = Modifier.fillMaxSize()) {
            // Header + search
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                SectionHeader(
                    title = S("prizes.curatedTreasures"),
                    subtitle = S("prizes.showingCount").replace("{count}", state.filteredPrizes.size.toString()),
                )
                SearchFilterBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    placeholder = S("prizes.searchPlaceholder"),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            FilterTabs(
                tabs = tabLabels,
                selectedIndex = selectedTabIndex,
                onTabSelected = { index ->
                    viewModel.onIntent(PrizeInventoryIntent.SetFilter(FILTER_TABS[index].state))
                },
            )

            // Content
            Box(modifier = Modifier.weight(1f)) {
                when {
                    state.isLoading -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    state.error != null -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(text = state.error ?: "")
                        }
                    }
                    state.filteredPrizes.isEmpty() -> {
                        EmptyState(
                            icon = Icons.Filled.Star,
                            title = S("prizes.emptyTitle"),
                            subtitle = S("prizes.emptySubtitle"),
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    else -> {
                        val displayedPrizes = if (searchQuery.isBlank()) {
                            state.filteredPrizes
                        } else {
                            state.filteredPrizes.filter {
                                it.name.contains(searchQuery, ignoreCase = true)
                            }
                        }
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(gridColumns),
                            modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(displayedPrizes) { prize ->
                                PrizeImageCard(
                                    imageUrl = prize.photoUrl ?: "",
                                    name = prize.name,
                                    seriesName = prize.acquisitionMethod,
                                    tierGrade = prize.grade,
                                    prizeId = prize.id,
                                    onClick = { onPrizeClick(prize) },
                                )
                            }
                        }
                    }
                }
            }

            // Fixed bottom stats bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatCard(
                    value = "—",
                    label = S("prizes.statTotalValue"),
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    value = "—",
                    label = S("prizes.statGlobalRank"),
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    value = "—",
                    label = S("prizes.statSsrRatio"),
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    value = "—",
                    label = S("prizes.statPendingShipments"),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}
