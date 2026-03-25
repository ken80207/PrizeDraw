package com.prizedraw.screens.campaign

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.viewmodels.campaign.KujiCampaignIntent
import com.prizedraw.viewmodels.campaign.KujiCampaignState
import com.prizedraw.viewmodels.campaign.KujiCampaignViewModel

private val DRAW_QUANTITIES = listOf(1, 3, 5, 12)

/**
 * Queue status and multi-draw selector screen.
 *
 * Displays:
 * - Queue position / "Your Turn!" notification.
 * - Countdown timer for the active session.
 * - Estimated wait time for waiting players.
 * - Multi-draw quantity selector (1 / 3 / 5 / 12) with point cost preview.
 * - Leave queue button.
 *
 * TODO(T110): Add animated "Your turn!" notification using Compose animation APIs.
 * TODO(T110): Wire sessionCountdown to a real ticker coroutine.
 *
 * @param viewModel The MVI ViewModel.
 */
@Composable
public fun QueueScreen(viewModel: KujiCampaignViewModel) {
    val state by viewModel.state.collectAsState()
    var selectedQuantity by remember { mutableIntStateOf(1) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        QueueStatusCard(state)
        if (state.isMyTurn) {
            DrawQuantitySelector(
                selectedQuantity = selectedQuantity,
                pricePerDraw = state.campaign?.pricePerDraw ?: 0,
                onQuantitySelected = { selectedQuantity = it },
            )
            Button(
                onClick = {
                    viewModel.onIntent(KujiCampaignIntent.MultiDraw(selectedQuantity))
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Draw $selectedQuantity ticket${if (selectedQuantity > 1) "s" else ""}")
            }
        }
        if (state.queueEntry != null) {
            OutlinedButton(
                onClick = { viewModel.onIntent(KujiCampaignIntent.LeaveQueue) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Leave Queue")
            }
        }
    }
}

@Composable
private fun QueueStatusCard(state: KujiCampaignState) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (state.isMyTurn) {
                Text(
                    text = "Your Turn!",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                state.sessionCountdown?.let { seconds ->
                    Text(
                        text = "Time remaining: ${seconds}s",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            } else if (state.queueEntry != null) {
                Text(
                    text = "Queue Position",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = "#${state.queueEntry.position}",
                    style = MaterialTheme.typography.displaySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                val ahead = (state.queueEntry.position - 1).coerceAtLeast(0)
                Text(
                    text = "$ahead player${if (ahead != 1) "s" else ""} ahead",
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                Text(
                    text = "Not in queue",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

@Composable
private fun DrawQuantitySelector(
    selectedQuantity: Int,
    pricePerDraw: Int,
    onQuantitySelected: (Int) -> Unit,
) {
    Column {
        Text(
            text = "Select quantity",
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            DRAW_QUANTITIES.forEach { qty ->
                val isSelected = qty == selectedQuantity
                if (isSelected) {
                    Button(
                        onClick = { onQuantitySelected(qty) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("$qty\n${qty * pricePerDraw}pts")
                    }
                } else {
                    OutlinedButton(
                        onClick = { onQuantitySelected(qty) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("$qty\n${qty * pricePerDraw}pts")
                    }
                }
            }
        }
    }
}
