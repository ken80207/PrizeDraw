package com.prizedraw.screens.prize

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState

/**
 * Prize detail screen showing image gallery, grade chip, source info, and action buttons.
 *
 * Action buttons shown conditionally by [PrizeInstanceDto.state]:
 * - HOLDING: "List for Sale", "Official Buyback", "Request Shipping"
 * - TRADING: "Cancel Listing"
 * - PENDING_SHIPMENT: "Cancel Shipping"
 *
 * TODO(T125): Implement zoomable image gesture for [PrizeInstanceDto.photoUrl].
 * TODO(T125): Add source campaign name lookup via prizeDefinitionId.
 */
@Composable
public fun PrizeDetailScreen(
    prize: PrizeInstanceDto,
    onRequestShipping: (PrizeInstanceDto) -> Unit,
    onListForSale: (PrizeInstanceDto) -> Unit,
    onBuyback: (PrizeInstanceDto) -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Image placeholder — TODO: zoomable AsyncImage
        androidx.compose.foundation.layout.Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(IMAGE_HEIGHT.dp),
        ) {
            Text(
                text = "Prize Image\n${prize.photoUrl ?: "No image"}",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SuggestionChip(
                onClick = {},
                label = { Text(prize.grade) },
            )
            SuggestionChip(
                onClick = {},
                label = { Text(prize.state.name.replace("_", " ")) },
            )
        }

        Text(text = prize.name, style = MaterialTheme.typography.titleLarge)
        Text(
            text = "Acquired via: ${prize.acquisitionMethod.replace("_", " ")}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (prize.state == PrizeState.HOLDING) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(modifier = Modifier.fillMaxWidth(), onClick = { onListForSale(prize) }) {
                    Text("List for Sale")
                }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { onBuyback(prize) }) {
                    Text("Official Buyback")
                }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { onRequestShipping(prize) }) {
                    Text("Request Shipping")
                }
            }
        }
    }
}

private const val IMAGE_HEIGHT = 280
