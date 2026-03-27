package com.prizedraw.screens.exchange

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.exchange.ExchangeItemDto
import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.i18n.S

/**
 * Exchange request detail screen showing both sides' items with respond actions.
 *
 * Displays items offered by each party. If the current player is the recipient
 * and the request is PENDING, shows Accept / Reject / Counter-Propose buttons.
 *
 * TODO(T142): Wire to ExchangeViewModel — dispatch respond intents.
 *
 * @param offer           The exchange offer to display.
 * @param currentPlayerId The current player's ID for role detection.
 * @param onAccept        Invoked when the recipient taps Accept.
 * @param onReject        Invoked when the recipient taps Reject.
 * @param onCounterPropose Invoked when the recipient taps Counter-Propose.
 * @param onCancel        Invoked when the initiator taps Cancel.
 * @param onBack          Navigation back.
 */
@Composable
public fun ExchangeRequestDetailScreen(
    offer: ExchangeOfferDto,
    currentPlayerId: String,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onCounterPropose: () -> Unit,
    onCancel: () -> Unit,
    onBack: () -> Unit,
) {
    val isRecipient = offer.recipientId == currentPlayerId
    val isInitiator = offer.initiatorId == currentPlayerId
    val isPending =
        offer.status == ExchangeRequestStatus.PENDING ||
            offer.status == ExchangeRequestStatus.COUNTER_PROPOSED

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = S("exchange.requestTitle"),
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "${S("common.status")}: ${offer.status.name}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item {
            Text(
                text = "${offer.initiatorNickname}${S("exchange.initiatorOffer")}",
                style = MaterialTheme.typography.titleMedium,
            )
        }
        items(offer.initiatorItems) { item ->
            ExchangeItemCard(item)
        }
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "${offer.recipientNickname}${S("exchange.recipientRequest")}",
                style = MaterialTheme.typography.titleMedium,
            )
        }
        items(offer.recipientItems) { item ->
            ExchangeItemCard(item)
        }
        if (offer.message != null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(S("exchange.message"), style = MaterialTheme.typography.labelMedium)
                        Text(offer.message ?: "", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        if (isPending) {
            item {
                when {
                    isRecipient -> RecipientActions(onAccept, onReject, onCounterPropose)
                    isInitiator -> InitiatorActions(onCancel)
                }
            }
        }
        item {
            OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
                Text(S("common.back"))
            }
        }
    }
}

@Composable
private fun ExchangeItemCard(item: ExchangeItemDto) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(text = item.grade, style = MaterialTheme.typography.labelMedium)
            Text(text = item.prizeName, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun RecipientActions(
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onCounterPropose: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onAccept, modifier = Modifier.fillMaxWidth()) {
            Text(S("exchange.accept"))
        }
        OutlinedButton(onClick = onCounterPropose, modifier = Modifier.fillMaxWidth()) {
            Text(S("exchange.counterPropose"))
        }
        OutlinedButton(
            onClick = onReject,
            colors =
                ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(S("exchange.reject"))
        }
    }
}

@Composable
private fun InitiatorActions(onCancel: () -> Unit) {
    OutlinedButton(
        onClick = onCancel,
        colors =
            ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(S("exchange.cancelOffer"))
    }
}
