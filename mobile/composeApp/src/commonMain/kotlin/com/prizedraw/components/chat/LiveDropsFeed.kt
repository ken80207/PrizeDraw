package com.prizedraw.components.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.chip.TierBadge
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.i18n.S

/** A single live drop entry. */
public data class LiveDrop(
    val id: String,
    val playerName: String,
    val prizeName: String,
    val tierGrade: String,
    val timestamp: String,
)

/** Feed showing real-time draw results from other players. */
@Composable
public fun LiveDropsFeed(
    drops: List<LiveDrop>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        SectionHeader(title = S("draw.liveDrops"), subtitle = S("draw.verifiedOdds"))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            drops.forEach { drop ->
                PrizeDrawCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = drop.playerName,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(top = 2.dp),
                            ) {
                                Text(
                                    text = drop.prizeName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                TierBadge(grade = drop.tierGrade)
                            }
                        }
                        Text(
                            text = drop.timestamp,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
