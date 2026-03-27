package com.prizedraw.screens.prize

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.i18n.S

/**
 * Confirmation dialog for the Official Buyback action.
 *
 * Displays the prize name and the buyback price (in revenue points) that will be
 * credited to the player's wallet. The player must explicitly confirm before the
 * buyback is submitted to POST /api/v1/prizes/{id}/buyback.
 *
 * TODO(T146): Load the preview price by calling GET /api/v1/prizes/buyback-price/{id}
 *   before showing this dialog, and pass the result as [buybackPrice].
 *
 * @param prize        The prize being considered for buyback.
 * @param buybackPrice Revenue points that will be credited (preview value).
 * @param onConfirm    Invoked when the player confirms the buyback.
 * @param onDismiss    Invoked when the player cancels.
 */
@Composable
public fun BuybackConfirmDialog(
    prize: PrizeInstanceDto,
    buybackPrice: Int,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = S("prizes.officialBuyback"),
                style = MaterialTheme.typography.titleMedium,
            )
        },
        text = {
            Text(
                text =
                    "\"${prize.name}\" (${prize.grade}) — $buybackPrice ${S("prizes.revenuePoints")}? ${S("prizes.buybackWarning")}",
                style = MaterialTheme.typography.bodyMedium,
            )
        },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text(S("prizes.confirmBuyback"))
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(S("common.cancel"))
            }
        },
    )
}
