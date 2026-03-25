package com.prizedraw.screens.support

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.prizedraw.viewmodels.support.SupportIntent
import com.prizedraw.viewmodels.support.SupportViewModel
import com.prizedraw.viewmodels.support.TicketMessageDto

/**
 * Ticket detail screen showing a message thread.
 *
 * Layout:
 * - Top app bar with back navigation and ticket subject.
 * - [LazyColumn] of message bubbles:
 *   - Player messages: left-aligned, surface-variant background.
 *   - Staff messages: right-aligned, primary-container background.
 * - If the ticket is RESOLVED or CLOSED: a 1-5 star satisfaction rating row.
 * - Otherwise: a [OutlinedTextField] + send [IconButton] at the bottom.
 *
 * TODO(T170): Dispatch [SupportIntent.LoadTicketDetail] on first composition.
 *
 * @param viewModel The shared support MVI ViewModel.
 * @param ticketId UUID of the ticket to display.
 * @param onBack Invoked when the user presses the back arrow.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun TicketDetailScreen(
    viewModel: SupportViewModel,
    ticketId: String,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val ticket = state.selectedTicket
    val listState = rememberLazyListState()

    var replyText by remember { mutableStateOf("") }

    val isClosed = ticket?.status == "CLOSED" || ticket?.status == "RESOLVED"

    // Scroll to bottom when new messages arrive
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.lastIndex)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = ticket?.subject ?: "Ticket",
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { innerPadding ->
        when {
            state.isLoading && ticket == null -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            state.error != null -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = state.error!!,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            ticket != null -> {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                ) {
                    // Message thread
                    LazyColumn(
                        state = listState,
                        modifier =
                            Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding =
                            androidx.compose.foundation.layout
                                .PaddingValues(vertical = 12.dp),
                    ) {
                        if (state.messages.isEmpty()) {
                            item {
                                Text(
                                    text = "No messages yet.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                                )
                            }
                        }
                        items(state.messages, key = { it.id }) { message ->
                            MessageBubble(message = message)
                        }
                    }

                    // Satisfaction rating — shown when ticket is closed/resolved
                    if (isClosed) {
                        SatisfactionRatingRow(
                            currentScore = ticket.satisfactionScore,
                            onRate = { score ->
                                viewModel.onIntent(
                                    SupportIntent.RateSatisfaction(
                                        ticketId = ticket.id,
                                        score = score,
                                    ),
                                )
                            },
                        )
                    } else {
                        // Reply input
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            OutlinedTextField(
                                value = replyText,
                                onValueChange = { replyText = it },
                                placeholder = { Text("Write a reply…") },
                                modifier = Modifier.weight(1f),
                                maxLines = 3,
                            )
                            IconButton(
                                onClick = {
                                    if (replyText.isNotBlank()) {
                                        viewModel.onIntent(
                                            SupportIntent.Reply(
                                                ticketId = ticket.id,
                                                body = replyText.trim(),
                                            ),
                                        )
                                        replyText = ""
                                    }
                                },
                                enabled = replyText.isNotBlank() && !state.isLoading,
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.Send,
                                    contentDescription = "Send reply",
                                    tint =
                                        if (replyText.isNotBlank()) {
                                            MaterialTheme.colorScheme.primary
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: TicketMessageDto) {
    val isPlayer = message.authorType == "PLAYER"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isPlayer) Arrangement.Start else Arrangement.End,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 280.dp)
                    .clip(
                        RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isPlayer) 4.dp else 16.dp,
                            bottomEnd = if (isPlayer) 16.dp else 4.dp,
                        ),
                    ).background(
                        if (isPlayer) {
                            MaterialTheme.colorScheme.surfaceVariant
                        } else {
                            MaterialTheme.colorScheme.primaryContainer
                        },
                    ).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (!isPlayer) {
                Text(
                    text = "Support Staff",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                text = message.body,
                style = MaterialTheme.typography.bodyMedium,
                color =
                    if (isPlayer) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    },
            )
            Text(
                text = message.createdAt,
                style = MaterialTheme.typography.labelSmall,
                color =
                    if (isPlayer) {
                        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                    },
                modifier = Modifier.align(Alignment.End).padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun SatisfactionRatingRow(
    currentScore: Int?,
    onRate: (Int) -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text =
                    if (currentScore != null) {
                        "Thanks for your feedback! ($currentScore/5)"
                    } else {
                        "How satisfied are you with the resolution?"
                    },
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                (1..5).forEach { score ->
                    IconButton(
                        onClick = { if (currentScore == null) onRate(score) },
                        enabled = currentScore == null,
                    ) {
                        Text(
                            text = if (currentScore != null && score <= currentScore) "\u2605" else "\u2606",
                            style = MaterialTheme.typography.headlineSmall,
                            color =
                                if (currentScore != null && score <= currentScore) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                        )
                    }
                }
            }
        }
    }
}
