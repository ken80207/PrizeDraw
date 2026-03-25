package com.prizedraw.screens.exchange

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto

/**
 * Exchange offer creation screen.
 *
 * Displays the recipient player's prizes (their public inventory) in the top section
 * and the current player's HOLDING prizes in the bottom section. The player selects
 * one or more prizes from each side, adds an optional message, then taps Submit.
 *
 * TODO(T142): Wire to ExchangeViewModel — load recipient inventory and own HOLDING prizes,
 *   dispatch CreateExchangeOffer intent on submit.
 *
 * @param recipientNickname  Display name of the target player.
 * @param recipientPrizes    Public HOLDING inventory of the recipient.
 * @param ownPrizes          Current player's HOLDING prizes.
 * @param onSubmit           Invoked with (offeredIds, requestedIds, message).
 * @param onBack             Navigation back.
 */
@Composable
public fun ExchangeOfferScreen(
    recipientNickname: String,
    recipientPrizes: List<PrizeInstanceDto>,
    ownPrizes: List<PrizeInstanceDto>,
    onSubmit: (offeredIds: List<String>, requestedIds: List<String>, message: String?) -> Unit,
    onBack: () -> Unit,
) {
    val selectedOwn = remember { mutableStateOf(setOf<String>()) }
    val selectedRecipient = remember { mutableStateOf(setOf<String>()) }
    var message by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Exchange with $recipientNickname",
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(text = "Their prizes (select what you want):", style = MaterialTheme.typography.titleMedium)
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(recipientPrizes) { prize ->
                SelectablePrizeCard(
                    prize = prize,
                    selected = prize.id in selectedRecipient.value,
                    onToggle = { id ->
                        selectedRecipient.value = selectedRecipient.value.toggle(id)
                    },
                )
            }
        }
        Text(text = "Your prizes to offer:", style = MaterialTheme.typography.titleMedium)
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(ownPrizes) { prize ->
                SelectablePrizeCard(
                    prize = prize,
                    selected = prize.id in selectedOwn.value,
                    onToggle = { id ->
                        selectedOwn.value = selectedOwn.value.toggle(id)
                    },
                )
            }
        }
        OutlinedTextField(
            value = message,
            onValueChange = { message = it },
            label = { Text("Optional message") },
            modifier = Modifier.fillMaxWidth(),
            maxLines = 3,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Cancel") }
            Button(
                onClick = {
                    onSubmit(
                        selectedOwn.value.toList(),
                        selectedRecipient.value.toList(),
                        message.ifBlank { null },
                    )
                },
                enabled = selectedOwn.value.isNotEmpty() && selectedRecipient.value.isNotEmpty(),
                modifier = Modifier.weight(1f),
            ) { Text("Send Offer") }
        }
    }
}

@Composable
private fun SelectablePrizeCard(
    prize: PrizeInstanceDto,
    selected: Boolean,
    onToggle: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = selected, onCheckedChange = { onToggle(prize.id) })
            Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                Text(text = prize.grade, style = MaterialTheme.typography.labelMedium)
                Text(text = prize.name, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

private fun Set<String>.toggle(id: String): Set<String> = if (contains(id)) minus(id) else plus(id)
