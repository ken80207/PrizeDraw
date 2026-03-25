package com.prizedraw.screens.leaderboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.leaderboard.LeaderboardDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardEntryDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.viewmodels.leaderboard.LeaderboardIntent
import com.prizedraw.viewmodels.leaderboard.LeaderboardViewModel

/**
 * Leaderboard screen.
 *
 * Allows the player to switch between leaderboard types (Draw Count, Prize Grade,
 * Trade Volume) and time periods (Today, This Week, This Month, All Time).
 *
 * When the authenticated player is not in the top list, their own rank is shown
 * in a pinned row at the bottom (from [LeaderboardDto.selfRank]).
 *
 * TODO: wire [LeaderboardViewModel] to real data source.
 */
@Composable
public fun LeaderboardScreen(
    viewModel: LeaderboardViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        LeaderboardTypeSelector(
            selected = state.selectedType,
            onSelect = { viewModel.onIntent(LeaderboardIntent.SelectType(it)) },
        )
        LeaderboardPeriodSelector(
            selected = state.selectedPeriod,
            onSelect = { viewModel.onIntent(LeaderboardIntent.SelectPeriod(it)) },
        )

        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Loading…")
            }
        } else if (state.error != null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(state.error!!, color = MaterialTheme.colorScheme.error)
            }
        } else {
            Box(modifier = Modifier.weight(1f)) {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(state.entries, key = { it.playerId }) { entry ->
                        LeaderboardRow(entry = entry, isHighlighted = false)
                    }
                }
            }
            state.selfRank?.let { self ->
                Card(
                    colors =
                        CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(12.dp),
                    ) {
                        Text("#${self.rank}", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "Your rank — score: ${self.score}",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardTypeSelector(
    selected: LeaderboardType,
    onSelect: (LeaderboardType) -> Unit,
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        items(LeaderboardType.entries) { type ->
            FilterChip(
                selected = type == selected,
                onClick = { onSelect(type) },
                label = { Text(type.displayName()) },
            )
        }
    }
}

@Composable
private fun LeaderboardPeriodSelector(
    selected: LeaderboardPeriod,
    onSelect: (LeaderboardPeriod) -> Unit,
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        items(LeaderboardPeriod.entries) { period ->
            FilterChip(
                selected = period == selected,
                onClick = { onSelect(period) },
                label = { Text(period.displayName()) },
            )
        }
    }
}

@Composable
private fun LeaderboardRow(
    entry: LeaderboardEntryDto,
    isHighlighted: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        RankBadge(rank = entry.rank)
        Text(
            text = entry.nickname,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = entry.score.toString(),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun RankBadge(rank: Int) {
    val bg =
        when (rank) {
            1 -> MaterialTheme.colorScheme.tertiary
            2 -> MaterialTheme.colorScheme.secondary
            3 -> MaterialTheme.colorScheme.secondaryContainer
            else -> MaterialTheme.colorScheme.surfaceVariant
        }
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(bg),
    ) {
        Text(text = "#$rank", style = MaterialTheme.typography.labelMedium)
    }
}

private fun LeaderboardType.displayName(): String =
    when (this) {
        LeaderboardType.DRAW_COUNT -> "Draws"
        LeaderboardType.PRIZE_GRADE -> "Grade"
        LeaderboardType.TRADE_VOLUME -> "Trades"
        LeaderboardType.CAMPAIGN_SPECIFIC -> "Campaign"
    }

private fun LeaderboardPeriod.displayName(): String =
    when (this) {
        LeaderboardPeriod.TODAY -> "Today"
        LeaderboardPeriod.THIS_WEEK -> "Week"
        LeaderboardPeriod.THIS_MONTH -> "Month"
        LeaderboardPeriod.ALL_TIME -> "All Time"
    }
