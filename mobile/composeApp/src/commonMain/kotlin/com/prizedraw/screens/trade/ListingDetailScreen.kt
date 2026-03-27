package com.prizedraw.screens.trade

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.i18n.S

/**
 * Listing detail screen showing prize photo, grade, seller nickname, price, and buy button.
 *
 * Presents a confirmation [AlertDialog] before executing the purchase.
 *
 * TODO(T135): Wire actual purchase call via ViewModel.
 */
@Composable
public fun ListingDetailScreen(
    listing: TradeListingDto,
    currentPlayerId: String,
    onPurchase: (TradeListingDto) -> Unit,
    onBack: () -> Unit,
) {
    var showConfirmDialog by remember { mutableStateOf(false) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Photo placeholder
        androidx.compose.foundation.layout.Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(IMAGE_HEIGHT.dp),
        ) {
            Text(
                text = listing.prizePhotoUrl.ifEmpty { S("prizes.noImage") },
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = listing.prizeGrade, style = MaterialTheme.typography.titleMedium)
        }

        Text(text = listing.prizeName, style = MaterialTheme.typography.titleLarge)
        Text(
            text = "${S("trade.seller")}: ${listing.sellerNickname}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Divider()

        Text(
            text = "${listing.listPrice} pts",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.primary,
        )

        if (listing.sellerId != currentPlayerId) {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { showConfirmDialog = true },
            ) {
                Text(S("trade.buyNow"))
            }
        }
    }

    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text(S("trade.confirmPurchase")) },
            text = {
                Text(
                    "\"${listing.prizeName}\" — ${listing.listPrice} ${S("trade.drawPoints")}?",
                )
            },
            confirmButton = {
                Button(onClick = {
                    showConfirmDialog = false
                    onPurchase(listing)
                }) {
                    Text(S("common.confirm"))
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text(S("common.cancel"))
                }
            },
        )
    }
}

private const val IMAGE_HEIGHT = 280
