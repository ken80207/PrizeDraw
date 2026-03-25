package com.prizedraw.screens.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.viewmodels.campaign.KujiCampaignIntent
import com.prizedraw.viewmodels.campaign.KujiCampaignState
import com.prizedraw.viewmodels.campaign.KujiCampaignViewModel

/**
 * Full-screen ticket board for a kuji box.
 *
 * Renders each ticket as a cell in a [LazyVerticalGrid]:
 * - Available: shows slot number, tappable when [isMyTurn] is true.
 * - Drawn: shows prize photo placeholder, grade overlay, and drawer nickname.
 *
 * Players not in the queue automatically enter **spectator mode**: a "Watching" badge
 * is shown in the header, real-time draw events are still received via WebSocket, and
 * a "Join Queue" CTA is shown at the bottom.
 *
 * @param viewModel The MVI ViewModel.
 * @param campaignId The campaign whose board to display.
 */
@Composable
public fun KujiBoardScreen(
    viewModel: KujiCampaignViewModel,
    campaignId: String,
) {
    val state by viewModel.state.collectAsState()
    val isSpectator = state.queueEntry == null

    Column(modifier = Modifier.fillMaxSize()) {
        if (isSpectator) {
            SpectatorBanner(spectatorCount = state.spectatorCount)
        }
        Box(modifier = Modifier.weight(1f)) {
            TicketGrid(
                tickets = state.tickets,
                isMyTurn = state.isMyTurn,
                onTicketTapped = { ticketId ->
                    viewModel.onIntent(KujiCampaignIntent.SelectTicket(listOf(ticketId)))
                },
            )
        }
        QueueBottomBar(state = state, viewModel = viewModel)
    }
}

@Composable
private fun SpectatorBanner(spectatorCount: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Text(
            text = "Watching",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (spectatorCount > 0) {
            Text(
                text = "$spectatorCount viewers",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun TicketGrid(
    tickets: List<DrawTicketDto>,
    isMyTurn: Boolean,
    onTicketTapped: (String) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        contentPadding = PaddingValues(8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(tickets, key = { it.id }) { ticket ->
            TicketCellStub(ticket = ticket, enabled = isMyTurn, onTap = { onTicketTapped(ticket.id) })
        }
    }
}

@Composable
private fun TicketCellStub(
    ticket: DrawTicketDto,
    enabled: Boolean,
    onTap: () -> Unit,
) {
    Card(
        onClick = { if (enabled && ticket.drawnAt == null) onTap() },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(8.dp)) {
            if (ticket.drawnAt != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    // TODO(T109): AsyncImage for prizePhotoUrl
                    Text(text = ticket.grade ?: "", style = MaterialTheme.typography.labelLarge)
                    Text(text = ticket.drawnByNickname ?: "", style = MaterialTheme.typography.labelSmall)
                }
            } else {
                Text(
                    text = ticket.position.toString(),
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
    }
}

@Composable
private fun QueueBottomBar(
    state: KujiCampaignState,
    viewModel: KujiCampaignViewModel,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(16.dp),
    ) {
        if (state.queueEntry != null) {
            val label =
                if (state.isMyTurn) {
                    "Your turn! ${state.sessionCountdown ?: 0}s remaining"
                } else {
                    "Queue position: ${state.queueEntry.position}"
                }
            Text(text = label, style = MaterialTheme.typography.bodyMedium)
        } else {
            Button(
                onClick = { viewModel.onIntent(KujiCampaignIntent.JoinQueue) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Join Queue")
            }
        }
    }
}
