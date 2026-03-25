package com.prizedraw.screens.prize

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto

/**
 * Prize inventory card showing grade badge, name, and state.
 *
 * TODO(T125): Add coil/async image loading for [PrizeInstanceDto.photoUrl].
 */
@Composable
public fun PrizeCard(
    prize: PrizeInstanceDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier =
            modifier
                .padding(4.dp)
                .clickable(onClick = onClick),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Prize image placeholder
            androidx.compose.foundation.layout.Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(CARD_ASPECT_RATIO)
                        .padding(8.dp),
            ) {
                Text(
                    text = prize.grade,
                    style = MaterialTheme.typography.titleLarge,
                )
            }
            Column(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                Text(
                    text = prize.name,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2,
                )
                Text(
                    text = prize.state.name.replace("_", " "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private const val CARD_ASPECT_RATIO = 1f
