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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.user.UserProfileRow
import com.prizedraw.i18n.S
import com.prizedraw.viewmodels.support.SupportIntent
import com.prizedraw.viewmodels.support.SupportViewModel
import com.prizedraw.viewmodels.support.TicketMessageDto

/**
 * Ticket detail screen showing a message thread with an agent.
 *
 * Layout:
 * - Agent info bar: [UserProfileRow] (agent avatar + name + role) + "Close Ticket" button.
 * - [LazyColumn] of message bubbles:
 *   - Agent messages: left-aligned, surface-variant background.
 *   - Player messages: right-aligned, primary-container (amber) background.
 *   - Date separator labels between days.
 * - Timestamps shown beneath each bubble.
 * - If the ticket is RESOLVED or CLOSED: a 1–5 star satisfaction rating row.
 * - Otherwise: a [OutlinedTextField] + send [IconButton] pinned at the bottom.
 *
 * When [embedded] is `true` the Scaffold top bar is omitted (used inside the tablet two-column layout).
 *
 * TODO(T170): Dispatch [SupportIntent.LoadTicketDetail] on first composition.
 *
 * @param viewModel The shared support MVI ViewModel.
 * @param ticketId UUID of the ticket to display.
 * @param onBack Invoked when the user presses the back arrow.
 * @param embedded When `true`, the top app bar is hidden (tablet side-by-side mode).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun TicketDetailScreen(
    viewModel: SupportViewModel,
    ticketId: String,
    onBack: () -> Unit,
    embedded: Boolean = false,
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

    if (embedded) {
        // No Scaffold — render directly in the caller's container
        DetailContent(
            viewModel = viewModel,
            ticket = ticket,
            messages = state.messages,
            listState = listState,
            replyText = replyText,
            isClosed = isClosed,
            isLoading = state.isLoading,
            error = state.error,
            onBack = onBack,
            onReplyChange = { replyText = it },
            onSend = {
                if (replyText.isNotBlank() && ticket != null) {
                    viewModel.onIntent(
                        SupportIntent.Reply(ticketId = ticket.id, body = replyText.trim()),
                    )
                    replyText = ""
                }
            },
            onRate = { score ->
                ticket?.let {
                    viewModel.onIntent(SupportIntent.RateSatisfaction(ticketId = it.id, score = score))
                }
            },
        )
    } else {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = ticket?.subject ?: S("support.ticket"),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = S("common.back"))
                        }
                    },
                    colors =
                        TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.background,
                        ),
                )
            },
            containerColor = MaterialTheme.colorScheme.background,
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                DetailContent(
                    viewModel = viewModel,
                    ticket = ticket,
                    messages = state.messages,
                    listState = listState,
                    replyText = replyText,
                    isClosed = isClosed,
                    isLoading = state.isLoading,
                    error = state.error,
                    onBack = onBack,
                    onReplyChange = { replyText = it },
                    onSend = {
                        if (replyText.isNotBlank() && ticket != null) {
                            viewModel.onIntent(
                                SupportIntent.Reply(ticketId = ticket.id, body = replyText.trim()),
                            )
                            replyText = ""
                        }
                    },
                    onRate = { score ->
                        ticket?.let {
                            viewModel.onIntent(SupportIntent.RateSatisfaction(ticketId = it.id, score = score))
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun DetailContent(
    viewModel: SupportViewModel,
    ticket: com.prizedraw.viewmodels.support.SupportTicketDetailDto?,
    messages: List<TicketMessageDto>,
    listState: androidx.compose.foundation.lazy.LazyListState,
    replyText: String,
    isClosed: Boolean,
    isLoading: Boolean,
    error: String?,
    onBack: () -> Unit,
    onReplyChange: (String) -> Unit,
    onSend: () -> Unit,
    onRate: (Int) -> Unit,
) {
    when {
        isLoading && ticket == null -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        error != null -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = error, color = MaterialTheme.colorScheme.error)
            }
        }
        ticket != null -> {
            Column(modifier = Modifier.fillMaxSize()) {
                // Agent info bar
                AgentInfoBar(
                    agentName = "Agent Akira",
                    agentRole = "Assigned Senior Support Specialist",
                    isClosed = isClosed,
                    onCloseTicket = {},
                )

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

                // Message thread
                LazyColumn(
                    state = listState,
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding =
                        androidx.compose.foundation.layout
                            .PaddingValues(vertical = 16.dp),
                ) {
                    if (messages.isEmpty()) {
                        item {
                            Text(
                                text = S("support.noMessages"),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                            )
                        }
                    }
                    // Group messages with date separators
                    var lastDate = ""
                    messages.forEachIndexed { index, message ->
                        val dateStr = message.createdAt.take(10)
                        if (dateStr != lastDate) {
                            lastDate = dateStr
                            item(key = "date-$dateStr-$index") {
                                DateSeparator(date = dateStr)
                            }
                        }
                        item(key = message.id) {
                            MessageBubble(message = message)
                        }
                    }
                }

                // Rating or reply input
                if (isClosed) {
                    SatisfactionRatingRow(
                        currentScore = ticket.satisfactionScore,
                        onRate = onRate,
                    )
                } else {
                    MessageInputBar(
                        replyText = replyText,
                        isLoading = isLoading,
                        onReplyChange = onReplyChange,
                        onSend = onSend,
                    )
                }
            }
        }
        else -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = S("support.noMessages"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun AgentInfoBar(
    agentName: String,
    agentRole: String,
    isClosed: Boolean,
    onCloseTicket: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainer)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        UserProfileRow(
            nickname = agentName,
            tierLabel = agentRole,
            avatarSize = 36.dp,
        )
        if (!isClosed) {
            PrizeDrawOutlinedButton(
                text = "Close Ticket",
                onClick = onCloseTicket,
            )
        }
    }
}

@Composable
private fun DateSeparator(date: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.outlineVariant,
        )
        Text(
            text = date,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.outlineVariant,
        )
    }
}

@Composable
private fun MessageBubble(message: TicketMessageDto) {
    val isPlayer = message.authorType == "PLAYER"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isPlayer) Arrangement.End else Arrangement.Start,
    ) {
        if (!isPlayer) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .padding(end = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "A",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            }
            Spacer(modifier = Modifier.size(8.dp))
        }
        Column(
            modifier =
                Modifier
                    .widthIn(max = 280.dp)
                    .clip(
                        RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isPlayer) 16.dp else 4.dp,
                            bottomEnd = if (isPlayer) 4.dp else 16.dp,
                        ),
                    ).background(
                        if (isPlayer) {
                            MaterialTheme.colorScheme.primaryContainer
                        } else {
                            MaterialTheme.colorScheme.surfaceContainerHigh
                        },
                    ).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (!isPlayer) {
                Text(
                    text = "AGENT AKIRA",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            Text(
                text = message.body,
                style = MaterialTheme.typography.bodyMedium,
                color =
                    if (isPlayer) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
            )
            Text(
                text = message.createdAt.takeLast(8).take(5),
                style = MaterialTheme.typography.labelSmall,
                color =
                    if (isPlayer) {
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    },
                modifier = Modifier.align(Alignment.End).padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun MessageInputBar(
    replyText: String,
    isLoading: Boolean,
    onReplyChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainer)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = replyText,
            onValueChange = onReplyChange,
            placeholder = { Text(S("support.replyPlaceholder")) },
            modifier = Modifier.weight(1f),
            maxLines = 3,
            shape = MaterialTheme.shapes.medium,
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                ),
        )
        IconButton(
            onClick = onSend,
            enabled = replyText.isNotBlank() && !isLoading,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.Send,
                contentDescription = S("support.sendReply"),
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

@Composable
private fun SatisfactionRatingRow(
    currentScore: Int?,
    onRate: (Int) -> Unit,
) {
    PrizeDrawCard(modifier = Modifier.padding(12.dp)) {
        Text(
            text =
                if (currentScore != null) {
                    "${S("support.thanksFeedback")} ($currentScore/5)"
                } else {
                    S("support.satisfactionPrompt")
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
