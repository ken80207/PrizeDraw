package com.prizedraw.screens.leaderboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.chip.TierBadge
import com.prizedraw.components.layout.FilterTabs
import com.prizedraw.components.user.UserProfileRow
import com.prizedraw.contracts.dto.leaderboard.LeaderboardEntryDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.dto.leaderboard.SelfRankDto
import com.prizedraw.i18n.S
import com.prizedraw.viewmodels.leaderboard.LeaderboardIntent
import com.prizedraw.viewmodels.leaderboard.LeaderboardViewModel

private val LEADERBOARD_TYPE_TABS = listOf(
    LeaderboardType.DRAW_COUNT,
    LeaderboardType.PRIZE_GRADE,
    LeaderboardType.TRADE_VOLUME,
)

private val PERIOD_TABS = listOf(
    LeaderboardPeriod.TODAY,
    LeaderboardPeriod.THIS_WEEK,
    LeaderboardPeriod.THIS_MONTH,
)

/**
 * Leaderboard screen with podium display for top 3 players and ranked list below.
 *
 * Layout:
 * - Period selector tabs (Today / This Week / This Month) at top right.
 * - Sub-tabs [FilterTabs] for ranking category (Draw Count / Prize Grade / Trade Volume).
 * - Podium showing rank #1 large center, #2 left, #3 right — each with avatar,
 *   nickname, SSR pulls, and score.
 * - Ranked list rows (rank 4+) showing rank number, [UserProfileRow], [TierBadge],
 *   items count, points, and trend arrow.
 * - Highlighted current user row with amber background and [PrimaryButton] for
 *   claiming weekly rewards.
 * - "VIEW RANKING 8-100" link at the bottom.
 */
@Composable
public fun LeaderboardScreen(
    viewModel: LeaderboardViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()

    val typeIndex = LEADERBOARD_TYPE_TABS.indexOf(state.selectedType).coerceAtLeast(0)
    val periodIndex = PERIOD_TABS.indexOf(state.selectedPeriod).coerceAtLeast(0)
    val typeTabs = LEADERBOARD_TYPE_TABS.map { it.displayName() }
    val periodTabs = PERIOD_TABS.map { it.displayName() }

    val top3 = state.entries.take(3)
    val rest = state.entries.drop(3)

    Column(modifier = modifier.fillMaxSize()) {
        // Period + type selectors
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = S("leaderboard.title"),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onSurface,
                letterSpacing = 2.sp,
            )
            // Period tabs (compact, right-aligned)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                periodTabs.forEachIndexed { index, label ->
                    val isSelected = periodIndex == index
                    Box(
                        modifier = Modifier
                            .background(
                                color = if (isSelected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.surfaceContainerHigh
                                },
                                shape = MaterialTheme.shapes.small,
                            )
                            .clickable {
                                viewModel.onIntent(LeaderboardIntent.SelectPeriod(PERIOD_TABS[index]))
                            }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) {
                                MaterialTheme.colorScheme.onPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                        )
                    }
                }
            }
        }

        // Category sub-tabs
        FilterTabs(
            tabs = typeTabs,
            selectedIndex = typeIndex,
            onTabSelected = { index ->
                viewModel.onIntent(LeaderboardIntent.SelectType(LEADERBOARD_TYPE_TABS[index]))
            },
        )

        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(S("common.loading"))
            }
            return@Column
        }

        if (state.error != null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(state.error ?: "", color = MaterialTheme.colorScheme.error)
            }
            return@Column
        }

        LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth()) {
            // Podium section
            if (top3.isNotEmpty()) {
                item {
                    PodiumSection(top3 = top3)
                }
            }

            // Ranked list rows (4+)
            items(rest, key = { it.playerId }) { entry ->
                LeaderboardListRow(entry = entry)
            }

            // View more link
            item {
                Text(
                    text = S("leaderboard.viewMore"),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp)
                        .clickable { /* TODO: navigate to full ranking */ },
                )
            }
        }

        // Pinned self-rank row
        state.selfRank?.let { self ->
            SelfRankBar(selfRank = self)
        }
    }
}

@Composable
private fun PodiumSection(top3: List<LeaderboardEntryDto>) {
    val first = top3.getOrNull(0)
    val second = top3.getOrNull(1)
    val third = top3.getOrNull(2)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.Bottom,
        ) {
            // Rank 2 (left, smaller)
            if (second != null) {
                PodiumEntry(
                    entry = second,
                    rankLabel = "02",
                    avatarSize = 64.dp,
                    isCenter = false,
                    modifier = Modifier.weight(1f),
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }

            // Rank 1 (center, larger)
            if (first != null) {
                PodiumEntry(
                    entry = first,
                    rankLabel = "01",
                    avatarSize = 88.dp,
                    isCenter = true,
                    modifier = Modifier.weight(1f),
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }

            // Rank 3 (right, smaller)
            if (third != null) {
                PodiumEntry(
                    entry = third,
                    rankLabel = "03",
                    avatarSize = 64.dp,
                    isCenter = false,
                    modifier = Modifier.weight(1f),
                )
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun PodiumEntry(
    entry: LeaderboardEntryDto,
    rankLabel: String,
    avatarSize: androidx.compose.ui.unit.Dp,
    isCenter: Boolean,
    modifier: Modifier = Modifier,
) {
    val rankColor = when (entry.rank) {
        1 -> MaterialTheme.colorScheme.primary
        2 -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.tertiary
    }

    Column(
        modifier = modifier.padding(horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Rank number overlay text (faded large)
        Text(
            text = rankLabel,
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.ExtraBold,
            color = rankColor.copy(alpha = 0.15f),
            modifier = Modifier.padding(bottom = 4.dp),
        )

        // Avatar
        Box(
            modifier = Modifier
                .size(avatarSize)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = entry.nickname.take(1).uppercase(),
                style = if (isCenter) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }

        // Rank badge below avatar
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .background(color = rankColor, shape = CircleShape)
                .padding(horizontal = 8.dp, vertical = 2.dp),
        ) {
            Text(
                text = "${entry.rank}st".let {
                    when (entry.rank) {
                        1 -> "1st"
                        2 -> "2nd"
                        3 -> "3rd"
                        else -> "${entry.rank}th"
                    }
                },
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = entry.nickname,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )

        entry.detail?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Stats row
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = S("leaderboard.ssrPulls"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = entry.score.toString().take(2),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isCenter) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = S("leaderboard.score"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = entry.score.toString(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isCenter) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun LeaderboardListRow(
    entry: LeaderboardEntryDto,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Rank number
        Text(
            text = String.format("%02d", entry.rank),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(32.dp),
        )

        // User info
        UserProfileRow(
            nickname = entry.nickname,
            avatarUrl = entry.avatarUrl,
            avatarSize = 36.dp,
            modifier = Modifier.weight(1f),
        )

        // Tier badge
        TierBadge(grade = "B")

        // Items count column
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = S("leaderboard.ssrItems"),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = (entry.score / 1000).toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }

        // Points column
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = S("leaderboard.points"),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = entry.score.toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }

        // Trend placeholder
        Text(
            text = "—",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SelfRankBar(selfRank: SelfRankDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "#${selfRank.rank}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.primary,
            )
            UserProfileRow(
                nickname = S("leaderboard.you"),
                avatarSize = 32.dp,
            )
        }

        PrimaryButton(
            text = S("leaderboard.claimWeeklyRewards"),
            onClick = { /* TODO: claim rewards */ },
        )
    }
}

@Composable
private fun LeaderboardType.displayName(): String =
    when (this) {
        LeaderboardType.DRAW_COUNT -> S("leaderboard.typeDraws")
        LeaderboardType.PRIZE_GRADE -> S("leaderboard.typeGrade")
        LeaderboardType.TRADE_VOLUME -> S("leaderboard.typeTrades")
        LeaderboardType.CAMPAIGN_SPECIFIC -> S("leaderboard.typeCampaign")
    }

@Composable
private fun LeaderboardPeriod.displayName(): String =
    when (this) {
        LeaderboardPeriod.TODAY -> S("leaderboard.periodToday")
        LeaderboardPeriod.THIS_WEEK -> S("leaderboard.periodWeek")
        LeaderboardPeriod.THIS_MONTH -> S("leaderboard.periodMonth")
        LeaderboardPeriod.ALL_TIME -> S("leaderboard.periodAllTime")
    }
