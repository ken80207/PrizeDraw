package com.prizedraw.screens.trade

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.viewmodels.trade.MarketplaceIntent
import com.prizedraw.viewmodels.trade.MarketplaceViewModel

private val GRADE_FILTERS = listOf("A", "B", "C", "D", "LAST")

/**
 * Trade marketplace browse screen.
 *
 * Shows a filter bar (grade) and a [LazyColumn] of [TradeListingCard]s.
 * Navigates to [ListingDetailScreen] on card tap.
 *
 * TODO(T135): Wire navigation and call [MarketplaceIntent.LoadListings] on composition.
 */
@Composable
public fun MarketplaceScreen(
    viewModel: MarketplaceViewModel,
    onListingClick: (TradeListingDto) -> Unit,
    onCreateListing: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        // Filter bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            GRADE_FILTERS.forEach { grade ->
                FilterChip(
                    selected = state.gradeFilter == grade,
                    onClick = {
                        val newFilter = if (state.gradeFilter == grade) null else grade
                        viewModel.onIntent(MarketplaceIntent.SetGradeFilter(newFilter))
                    },
                    label = { Text(grade) },
                )
            }
        }

        if (state.isLoading && state.listings.isEmpty()) {
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

        LazyColumn(modifier = Modifier.fillMaxSize().padding(8.dp)) {
            items(state.listings) { listing ->
                TradeListingCard(listing = listing, onClick = { onListingClick(listing) })
            }
        }
    }
}

@Composable
private fun TradeListingCard(
    listing: TradeListingDto,
    onClick: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        onClick = onClick,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(text = listing.prizeName, style = MaterialTheme.typography.bodyLarge)
                Text(
                    text = "Grade ${listing.prizeGrade} • ${listing.sellerNickname}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = "${listing.listPrice} pts",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
