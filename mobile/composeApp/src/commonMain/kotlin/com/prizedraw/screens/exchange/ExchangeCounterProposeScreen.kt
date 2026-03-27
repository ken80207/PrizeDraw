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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.i18n.S

/**
 * Counter-propose screen for re-selecting prizes to offer in response to an exchange.
 *
 * The player picks new prizes from their HOLDING inventory to replace the original offer.
 *
 * TODO(T142): Wire to ExchangeViewModel — dispatch CounterProposeIntent with selected IDs.
 *
 * @param ownPrizes       Current player's HOLDING prize inventory.
 * @param onSubmit        Invoked with the list of selected prize instance IDs.
 * @param onBack          Navigation back.
 */
@Composable
public fun ExchangeCounterProposeScreen(
    ownPrizes: List<PrizeInstanceDto>,
    onSubmit: (counterOfferedIds: List<String>) -> Unit,
    onBack: () -> Unit,
) {
    val selected = remember { mutableStateOf(setOf<String>()) }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = S("exchange.counterProposeTitle"),
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = S("exchange.counterProposePrompt"),
            style = MaterialTheme.typography.bodyMedium,
        )
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(ownPrizes) { prize ->
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = prize.id in selected.value,
                            onCheckedChange = { _ ->
                                selected.value =
                                    selected.value.let {
                                        if (prize.id in it) it - prize.id else it + prize.id
                                    }
                            },
                        )
                        Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(text = prize.grade, style = MaterialTheme.typography.labelMedium)
                            Text(text = prize.name, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text(S("common.cancel")) }
            Button(
                onClick = { onSubmit(selected.value.toList()) },
                enabled = selected.value.isNotEmpty(),
                modifier = Modifier.weight(1f),
            ) { Text(S("exchange.submitCounter")) }
        }
    }
}
