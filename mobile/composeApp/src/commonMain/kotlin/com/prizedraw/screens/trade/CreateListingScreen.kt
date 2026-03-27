package com.prizedraw.screens.trade

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.i18n.S

/** Default platform fee rate in basis points (5.00%). */
private const val DEFAULT_FEE_RATE_BPS = 500
private const val BASIS_POINTS = 10_000

/**
 * Create trade listing screen.
 *
 * Shows the selected prize (from inventory), price input, and a fee preview
 * displaying `proceeds = price * (1 - feeRate)`.
 *
 * TODO(T136): Add prize picker if no prize is pre-selected.
 *
 * @param prize The HOLDING prize to list. Pre-selected from inventory.
 * @param feeRateBps Current platform fee rate in basis points.
 * @param onConfirm Callback when the player confirms the listing.
 * @param onBack Callback to navigate back.
 */
@Composable
public fun CreateListingScreen(
    prize: PrizeInstanceDto,
    feeRateBps: Int = DEFAULT_FEE_RATE_BPS,
    onConfirm: (prizeInstanceId: String, listPrice: Int) -> Unit,
    onBack: () -> Unit,
) {
    var priceInput by remember { mutableStateOf("") }
    val listPrice = priceInput.toIntOrNull() ?: 0
    val feeAmount = kotlin.math.round(listPrice.toFloat() * feeRateBps.toFloat() / BASIS_POINTS.toFloat()).toLong()
    val proceeds = (listPrice - feeAmount).coerceAtLeast(0)

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = S("trade.listForSale"), style = MaterialTheme.typography.titleLarge)

        // Prize summary
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
        ) {
            Text(
                text = "${S("trade.grade")}: ${prize.grade} — ${prize.name}",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = "${S("trade.currentState")}: ${prize.state.name}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        OutlinedTextField(
            value = priceInput,
            onValueChange = { priceInput = it.filter { c -> c.isDigit() } },
            label = { Text(S("trade.listingPrice")) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )

        if (listPrice > 0) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "${S("trade.platformFee")} (${feeRateBps / 100.0}%): $feeAmount pts",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${S("trade.yourProceeds")}: $proceeds pts",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Button(
            modifier = Modifier.fillMaxWidth(),
            enabled = listPrice > 0,
            onClick = { onConfirm(prize.id, listPrice) },
        ) {
            Text(S("trade.confirmListing"))
        }
    }
}
