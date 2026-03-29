package com.prizedraw.screens.support

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBox
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.chip.StatusChip
import com.prizedraw.components.input.SearchFilterBar
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.viewmodels.support.SupportTicketSummaryDto
import com.prizedraw.viewmodels.support.SupportViewModel

/**
 * Support ticket list screen.
 *
 * Displays the player's support tickets grouped under "Active Cases".
 * Each card shows: ticket ID, [StatusChip], title, category, and date.
 *
 * On tablet (width >= 600dp) shows a side-by-side layout with the ticket list on the
 * left and [TicketDetailScreen] embedded on the right. On phone, tapping a ticket
 * navigates to a separate [TicketDetailScreen] via [onTicketClick].
 *
 * A [PrimaryButton]("New Ticket") is pinned at the bottom of the list.
 *
 * TODO(T170): Dispatch [com.prizedraw.viewmodels.support.SupportIntent.LoadTickets] on first composition.
 *
 * @param viewModel The MVI ViewModel driving this screen.
 * @param onTicketClick Invoked with the ticket UUID when a row is tapped (phone only).
 * @param onCreateTicket Invoked when "New Ticket" button is pressed.
 * @param onBack Optional back navigation for phone layout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun SupportTicketListScreen(
    viewModel: SupportViewModel,
    onTicketClick: (ticketId: String) -> Unit,
    onCreateTicket: () -> Unit,
    onBack: (() -> Unit)? = null,
) {
    val state by viewModel.state.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedTicketId by remember { mutableStateOf<String?>(null) }

    val filteredTickets =
        if (searchQuery.isBlank()) {
            state.tickets
        } else {
            state.tickets.filter { it.id.contains(searchQuery, ignoreCase = true) }
        }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = S("support.title"),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Manage your inquiries and prize claims.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon =
                    if (onBack != null) {
                        {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = S("common.back"))
                            }
                        }
                    } else {
                        {}
                    },
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background,
                    ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        BoxWithConstraints(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
        ) {
            val sizeClass = rememberWindowWidthSizeClass(maxWidth)
            val isTablet = sizeClass == WindowWidthSizeClass.Medium

            if (isTablet) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Left panel — ticket list
                    Column(
                        modifier =
                            Modifier
                                .width(320.dp)
                                .fillMaxHeight(),
                    ) {
                        TicketListPanel(
                            tickets = filteredTickets,
                            searchQuery = searchQuery,
                            isLoading = state.isLoading,
                            error = state.error,
                            selectedTicketId = selectedTicketId,
                            onSearchChange = { searchQuery = it },
                            onTicketClick = { id ->
                                selectedTicketId = id
                                viewModel.onIntent(
                                    com.prizedraw.viewmodels.support.SupportIntent
                                        .LoadTicketDetail(id),
                                )
                            },
                            onCreateTicket = onCreateTicket,
                        )
                    }
                    // Right panel — detail or empty state
                    Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                        val ticketId = selectedTicketId
                        if (ticketId != null) {
                            TicketDetailScreen(
                                viewModel = viewModel,
                                ticketId = ticketId,
                                onBack = { selectedTicketId = null },
                                embedded = true,
                            )
                        } else {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "Select a ticket to view the conversation.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    TicketListPanel(
                        tickets = filteredTickets,
                        searchQuery = searchQuery,
                        isLoading = state.isLoading,
                        error = state.error,
                        selectedTicketId = null,
                        onSearchChange = { searchQuery = it },
                        onTicketClick = onTicketClick,
                        onCreateTicket = onCreateTicket,
                    )
                }
            }
        }
    }
}

@Composable
private fun TicketListPanel(
    tickets: List<SupportTicketSummaryDto>,
    searchQuery: String,
    isLoading: Boolean,
    error: String?,
    selectedTicketId: String?,
    onSearchChange: (String) -> Unit,
    onTicketClick: (String) -> Unit,
    onCreateTicket: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        SectionHeader(
            title = "Active Cases",
            actionText = "SORT: RECENT",
            onAction = {},
        )

        SearchFilterBar(
            query = searchQuery,
            onQueryChange = onSearchChange,
            placeholder = "Search Ticket ID",
        )

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when {
                isLoading && tickets.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                error != null -> {
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.align(Alignment.Center).padding(16.dp),
                    )
                }
                tickets.isEmpty() -> {
                    Text(
                        text = S("support.noTickets"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center).padding(16.dp),
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(tickets, key = { it.id }) { ticket ->
                            TicketListCard(
                                ticket = ticket,
                                isSelected = ticket.id == selectedTicketId,
                                onClick = { onTicketClick(ticket.id) },
                            )
                        }
                    }
                }
            }
        }

        PrimaryButton(
            text = "+ New Ticket",
            onClick = onCreateTicket,
            fullWidth = true,
            modifier = Modifier.padding(vertical = 12.dp),
        )
    }
}

@Composable
private fun TicketListCard(
    ticket: SupportTicketSummaryDto,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    PrizeDrawCard(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .then(
                    if (isSelected) {
                        Modifier
                    } else {
                        Modifier
                    },
                ),
    ) {
        // Ticket ID + status
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = ticket.id.take(10).let { "TK-${it.takeLast(6).uppercase()}" },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            StatusChip(status = ticket.status)
        }
        // Subject
        Text(
            text = ticket.subject,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
        HorizontalDivider(
            modifier = Modifier.padding(vertical = 8.dp),
            color = MaterialTheme.colorScheme.outlineVariant,
        )
        // Category + date
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = categoryIcon(ticket.category),
                contentDescription = ticket.category,
                tint = MaterialTheme.colorScheme.primary,
                modifier =
                    Modifier
                        .padding(end = 2.dp)
                        .let { it },
            )
            Text(
                text =
                    ticket.category
                        .replace("_", " ")
                        .lowercase()
                        .replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = ticket.updatedAt,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
