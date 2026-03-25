package com.prizedraw.screens.prize

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.viewmodels.prize.PrizeInventoryIntent
import com.prizedraw.viewmodels.prize.PrizeInventoryViewModel

private val FILTER_TABS: List<Pair<String, PrizeState?>> =
    listOf(
        "All" to null,
        "Holding" to PrizeState.HOLDING,
        "In Transit" to PrizeState.PENDING_SHIPMENT,
        "Shipped" to PrizeState.SHIPPED,
    )

/**
 * Prize inventory grid screen showing the player's owned prizes.
 *
 * Displays a filter tab bar (All / Holding / In Transit / Shipped) and a
 * [LazyVerticalGrid] of [PrizeCard]s. Navigates to [PrizeDetailScreen] on card tap.
 *
 * TODO(T125): Wire navigation callback and call LoadInventory on composition.
 */
@Composable
public fun MyPrizesScreen(
    viewModel: PrizeInventoryViewModel,
    onPrizeClick: (PrizeInstanceDto) -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        ScrollableTabRow(
            selectedTabIndex = FILTER_TABS.indexOfFirst { it.second == state.filter }.coerceAtLeast(0),
        ) {
            FILTER_TABS.forEachIndexed { index, (label, prizeState) ->
                Tab(
                    selected = state.filter == prizeState,
                    onClick = { viewModel.onIntent(PrizeInventoryIntent.SetFilter(prizeState)) },
                    text = { Text(label) },
                )
            }
        }

        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        state.error?.let { error ->
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = error)
            }
            return@Column
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(GRID_COLUMNS),
            modifier = Modifier.fillMaxSize().padding(8.dp),
        ) {
            items(state.filteredPrizes) { prize ->
                PrizeCard(prize = prize, onClick = { onPrizeClick(prize) })
            }
        }
    }
}

private const val GRID_COLUMNS = 2
