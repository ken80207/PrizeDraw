package com.prizedraw.screens.support

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBox
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S
import com.prizedraw.viewmodels.support.SupportIntent
import com.prizedraw.viewmodels.support.SupportTicketSummaryDto
import com.prizedraw.viewmodels.support.SupportViewModel

/**
 * Support ticket list screen.
 *
 * Displays the player's support tickets in a [LazyColumn]. Each card shows:
 * - Category icon (matching the ticket category enum)
 * - Subject text
 * - Status badge
 * - Last message preview (truncated)
 * - Timestamp
 *
 * A [FloatingActionButton] navigates to the create-ticket flow.
 *
 * TODO(T170): Dispatch [SupportIntent.LoadTickets] on first composition.
 *
 * @param viewModel The MVI ViewModel driving this screen.
 * @param onTicketClick Invoked with the ticket UUID when a row is tapped.
 * @param onCreateTicket Invoked when the FAB is pressed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun SupportTicketListScreen(
    viewModel: SupportViewModel,
    onTicketClick: (ticketId: String) -> Unit,
    onCreateTicket: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(S("support.title")) })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateTicket) {
                Icon(Icons.Filled.Add, contentDescription = S("support.createTicket"))
            }
        },
    ) { innerPadding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
        ) {
            when {
                state.isLoading && state.tickets.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }

                state.error != null -> {
                    Text(
                        text = state.error!!,
                        color = MaterialTheme.colorScheme.error,
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(16.dp),
                    )
                }

                state.tickets.isEmpty() -> {
                    Text(
                        text = S("support.noTickets"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(16.dp),
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding =
                            androidx.compose.foundation.layout.PaddingValues(
                                horizontal = 16.dp,
                                vertical = 8.dp,
                            ),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(state.tickets, key = { it.id }) { ticket ->
                            TicketCard(
                                ticket = ticket,
                                onClick = { onTicketClick(ticket.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TicketCard(
    ticket: SupportTicketSummaryDto,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(
                imageVector = categoryIcon(ticket.category),
                contentDescription = ticket.category,
                modifier =
                    Modifier
                        .size(28.dp)
                        .padding(top = 2.dp),
                tint = MaterialTheme.colorScheme.primary,
            )

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = ticket.subject,
                        style = MaterialTheme.typography.bodyLarge,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    TicketStatusChip(status = ticket.status)
                }

                ticket.lastMessagePreview?.let { preview ->
                    Text(
                        text = preview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }

                Text(
                    text = ticket.updatedAt,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun TicketStatusChip(status: String) {
    val containerColor =
        when (status) {
            "OPEN" -> MaterialTheme.colorScheme.primaryContainer
            "IN_PROGRESS" -> MaterialTheme.colorScheme.tertiaryContainer
            "RESOLVED" -> MaterialTheme.colorScheme.secondaryContainer
            else -> MaterialTheme.colorScheme.surfaceVariant
        }
    val contentColor =
        when (status) {
            "OPEN" -> MaterialTheme.colorScheme.onPrimaryContainer
            "IN_PROGRESS" -> MaterialTheme.colorScheme.onTertiaryContainer
            "RESOLVED" -> MaterialTheme.colorScheme.onSecondaryContainer
            else -> MaterialTheme.colorScheme.onSurfaceVariant
        }
    Box(
        modifier =
            Modifier
                .padding(0.dp),
    ) {
        androidx.compose.material3.Surface(
            shape = MaterialTheme.shapes.small,
            color = containerColor,
            contentColor = contentColor,
        ) {
            Text(
                text = status.replace("_", " "),
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
}

private fun categoryIcon(category: String): ImageVector =
    when (category) {
        "TRADE_DISPUTE" -> Icons.Filled.List
        "DRAW_ISSUE" -> Icons.Filled.Build
        "ACCOUNT_ISSUE" -> Icons.Filled.AccountBox
        "SHIPPING_ISSUE" -> Icons.Filled.ShoppingCart
        "PAYMENT_ISSUE" -> Icons.Filled.Email
        else -> Icons.Filled.Info
    }
