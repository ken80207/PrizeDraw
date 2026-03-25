package com.prizedraw.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.draw.DrawTicketDto

/**
 * Reusable kuji ticket board Composable.
 *
 * Renders a [LazyVerticalGrid] of [TicketSlot] cells. When a ticket transitions from
 * available to drawn a scale + fade-in animation plays on the prize reveal.
 *
 * TODO(T110): Replace prize photo placeholder with Coil 3 `AsyncImage`.
 *
 * @param tickets The ordered list of ticket slots to display.
 * @param columns Number of grid columns (default 5 for portrait mobile).
 * @param isInteractive When true, available tickets emit [onTicketTapped] on click.
 * @param onTicketTapped Callback with the tapped ticket's ID.
 * @param modifier Modifier applied to the outer [LazyVerticalGrid].
 */
@Composable
public fun KujiBoard(
    tickets: List<DrawTicketDto>,
    columns: Int = 5,
    isInteractive: Boolean = false,
    onTicketTapped: (ticketId: String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier.fillMaxSize(),
    ) {
        items(tickets, key = { it.id }) { ticket ->
            TicketSlot(
                ticket = ticket,
                interactive = isInteractive && ticket.drawnAt == null,
                onTap = { onTicketTapped(ticket.id) },
            )
        }
    }
}

@Composable
private fun TicketSlot(
    ticket: DrawTicketDto,
    interactive: Boolean,
    onTap: () -> Unit,
) {
    val isDrawn = ticket.drawnAt != null
    var revealVisible by remember(ticket.id) { mutableStateOf(false) }

    LaunchedEffect(isDrawn) {
        if (isDrawn) revealVisible = true
    }

    Card(
        onClick = { if (interactive) onTap() },
        enabled = interactive,
        colors =
            CardDefaults.cardColors(
                containerColor =
                    if (isDrawn) {
                        MaterialTheme.colorScheme.surfaceVariant
                    } else {
                        MaterialTheme.colorScheme.primaryContainer
                    },
            ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(4.dp),
        ) {
            if (isDrawn) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    AnimatedVisibility(
                        visible = revealVisible,
                        enter = scaleIn(animationSpec = tween(300)) + fadeIn(animationSpec = tween(300)),
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            // TODO(T110): AsyncImage(model = ticket.prizePhotoUrl, ...)
                            Text(
                                text = ticket.grade ?: "?",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            ticket.drawnByNickname?.let { nick ->
                                Text(
                                    text = nick,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            } else {
                Text(
                    text = ticket.position.toString(),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}
