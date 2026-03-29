package com.prizedraw.screens.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.chat.ChatMessage
import com.prizedraw.components.chat.LiveChatPanel
import com.prizedraw.components.card.PrizeImageCard
import com.prizedraw.components.layout.FilterTabs
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.components.user.PointsDisplay
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.viewmodels.campaign.KujiCampaignIntent
import com.prizedraw.viewmodels.campaign.KujiCampaignState
import com.prizedraw.viewmodels.campaign.KujiCampaignViewModel

// ---------------------------------------------------------------------------
// Sample chat messages for demo rendering
// ---------------------------------------------------------------------------

private val sampleChatMessages = listOf(
    ChatMessage(id = "c1", senderName = "CyberPanda", text = "I need that Prize A!", timestamp = "now"),
    ChatMessage(id = "c2", senderName = "Task_Art", text = "Anyone drawn in Box B yet?", timestamp = "1m"),
    ChatMessage(id = "c3", senderName = "You", text = "Waiting for 1 tickets draw.", timestamp = "30s", isCurrentUser = true),
    ChatMessage(id = "c4", senderName = "Lucky_Duck", text = "Pulled Prize C! Ronin Figurine!", timestamp = "2m"),
)

// ---------------------------------------------------------------------------
// Public screen composable
// ---------------------------------------------------------------------------

/**
 * Full-screen ticket board for a kuji box.
 *
 * Layout adapts between phone (single column) and tablet (two-column with live chat side panel)
 * using [BoxWithConstraints] and [rememberWindowWidthSizeClass].
 *
 * Renders each ticket as a cell in a [LazyVerticalGrid]:
 * - Available: shows slot number prominently, tappable when the player's turn is active.
 * - Drawn: shows prize grade, prize name, and optionally the drawer's nickname.
 *
 * Players not in the queue see a spectator banner. Real-time draw events are still received
 * via WebSocket and a "Join Queue" CTA is shown at the bottom.
 *
 * @param viewModel The MVI ViewModel providing state and accepting intents.
 * @param campaignId The campaign whose board to display.
 */
@Composable
public fun KujiBoardScreen(
    viewModel: KujiCampaignViewModel,
    campaignId: String,
) {
    val state by viewModel.state.collectAsState()

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSizeClass = rememberWindowWidthSizeClass(maxWidth)

        if (windowSizeClass == WindowWidthSizeClass.Medium) {
            // Tablet layout: main content + right side panel
            Row(modifier = Modifier.fillMaxSize()) {
                Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    KujiBoardMainContent(
                        state = state,
                        viewModel = viewModel,
                        modifier = Modifier.weight(1f),
                    )
                    KujiBottomBar(state = state, viewModel = viewModel)
                }
                KujiSidePanel(
                    viewerCount = state.spectatorCount,
                    modifier = Modifier.width(320.dp).fillMaxHeight(),
                )
            }
        } else {
            // Phone layout: main content stacked, side panel below
            Column(modifier = Modifier.fillMaxSize()) {
                KujiBoardMainContent(
                    state = state,
                    viewModel = viewModel,
                    modifier = Modifier.weight(1f),
                )
                KujiSidePanel(
                    viewerCount = state.spectatorCount,
                    modifier = Modifier.fillMaxWidth().height(320.dp),
                )
                KujiBottomBar(state = state, viewModel = viewModel)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Private layout sections
// ---------------------------------------------------------------------------

@Composable
private fun KujiBoardMainContent(
    state: KujiCampaignState,
    viewModel: KujiCampaignViewModel,
    modifier: Modifier = Modifier,
) {
    var selectedBoxIndex by remember { mutableIntStateOf(0) }
    val boxTabs = if (state.boxes.isNotEmpty()) {
        state.boxes.map { it.name }
    } else {
        listOf("Box A", "Box B", "Box C")
    }

    Column(modifier = modifier.fillMaxWidth()) {
        // Spectator banner
        if (state.queueEntry == null) {
            SpectatorBanner(spectatorCount = state.spectatorCount)
        }

        // Scrollable main body
        androidx.compose.foundation.lazy.LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 8.dp),
        ) {
            // Campaign hero area
            item {
                KujiCampaignHero(
                    campaign = state.campaign,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Prize pool section
            item {
                SectionHeader(
                    title = "Prize Pool",
                    subtitle = "${state.tickets.size} / 80 items remaining",
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.height(220.dp),
                ) {
                    val prizeItems = listOf(
                        Triple("APEX PROTOTYPE X-01", "SSR", "1/2"),
                        Triple("RONIN SPECTER 7", "SR", "3/4"),
                        Triple("GOLDEN MASK", "A", "LOCKED"),
                    )
                    items(prizeItems) { (name, grade, remaining) ->
                        PrizePrizePoolCard(name = name, grade = grade, remaining = remaining)
                    }
                }
            }

            // Box tabs
            item {
                FilterTabs(
                    tabs = boxTabs,
                    selectedIndex = selectedBoxIndex,
                    onTabSelected = { idx ->
                        selectedBoxIndex = idx
                        if (state.boxes.isNotEmpty()) {
                            viewModel.onIntent(KujiCampaignIntent.SelectBox(state.boxes[idx].id))
                        }
                    },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

            // Ticket grid
            item {
                TicketGrid(
                    tickets = state.tickets,
                    isMyTurn = state.isMyTurn,
                    onTicketTapped = { ticketId ->
                        viewModel.onIntent(KujiCampaignIntent.SelectTicket(listOf(ticketId)))
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                        .padding(horizontal = 16.dp),
                )
            }
        }
    }
}

@Composable
private fun KujiCampaignHero(
    campaign: com.prizedraw.contracts.dto.campaign.KujiCampaignDto?,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .height(200.dp)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        // Placeholder or campaign cover image
        if (campaign?.coverImageUrl != null) {
            AsyncImage(
                model = campaign.coverImageUrl,
                contentDescription = campaign.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = campaign?.title ?: "NEON LEGENDS: VOLUME I",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
        // Overlay with badge and draw price
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(16.dp),
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 6.dp),
            ) {
                Text(
                    text = "NOW LIVE",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
            if (campaign != null) {
                Text(
                    text = campaign.title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                )
                Text(
                    text = "Official Ichiban Kuji Collection - Series A102",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.7f),
                )
            }
        }
        // Draw price badge
        Surface(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp),
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.9f),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "DRAW PRICE",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "850",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = "pts/ticket",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PrizePrizePoolCard(
    name: String,
    grade: String,
    remaining: String,
) {
    Surface(
        modifier = Modifier
            .width(140.dp)
            .fillMaxHeight(),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // Grade badge on image placeholder
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.TopStart,
            ) {
                Surface(
                    modifier = Modifier.padding(6.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary,
                ) {
                    Text(
                        text = grade,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = name,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
            )
            Text(
                text = "REMAINING",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = remaining,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun SpectatorBanner(spectatorCount: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.error),
        )
        Text(
            text = S("spectator.watching"),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (spectatorCount > 0) {
            Text(
                text = "$spectatorCount ${S("spectator.viewers")}",
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
    modifier: Modifier = Modifier,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        contentPadding = PaddingValues(8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = modifier,
    ) {
        items(tickets, key = { it.id }) { ticket ->
            TicketCell(
                ticket = ticket,
                isSelectable = isMyTurn && ticket.status == "AVAILABLE",
                onSelect = { onTicketTapped(ticket.id) },
            )
        }
    }
}

/**
 * Single ticket cell in the kuji board grid.
 *
 * @param ticket The ticket data to display.
 * @param isSelectable Whether the cell is tappable for the current player.
 * @param onSelect Invoked when the cell is tapped while selectable.
 */
@Composable
public fun TicketCell(
    ticket: DrawTicketDto,
    isSelectable: Boolean,
    onSelect: () -> Unit,
) {
    val isDrawn = ticket.status == "DRAWN"

    Card(
        onClick = { if (isSelectable) onSelect() },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = when {
            isDrawn -> CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            isSelectable -> CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            )
            else -> CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainer,
            )
        },
        enabled = isSelectable || isDrawn,
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            if (isDrawn) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "#${ticket.position}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = ticket.grade ?: "",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                    ticket.prizeName?.let { name ->
                        Text(
                            text = name,
                            style = MaterialTheme.typography.labelSmall,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                        )
                    }
                }
            } else {
                Text(
                    text = ticket.position.toString(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelectable) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
            }
        }
    }
}

@Composable
private fun KujiBottomBar(
    state: KujiCampaignState,
    viewModel: KujiCampaignViewModel,
) {
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Points balance
        Column(modifier = Modifier.weight(1f)) {
            PointsDisplay(points = "25,000", label = "pts")
            Spacer(Modifier.height(2.dp))
            // Wait time and queue position
            val queueInfo = if (state.queueEntry != null) {
                if (state.isMyTurn) {
                    "Your turn — ${state.sessionCountdown ?: 0}s remaining"
                } else {
                    "~4 mins wait • ${state.queueEntry.position}th in line"
                }
            } else {
                "~4 mins wait • 12th in line"
            }
            Text(
                text = queueInfo,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        PrimaryButton(
            text = if (state.queueEntry != null) S("draw.yourTurn") else S("campaign.joinQueue"),
            onClick = {
                if (state.queueEntry == null) {
                    viewModel.onIntent(KujiCampaignIntent.JoinQueue)
                }
            },
        )
    }
}

@Composable
private fun KujiSidePanel(
    viewerCount: Int,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceContainerLow)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Live Gallery Chat
        LiveChatPanel(
            title = "LIVE GALLERY CHAT",
            messages = sampleChatMessages,
            viewerCount = viewerCount.coerceAtLeast(1286),
            onSendMessage = {},
            isLive = true,
            modifier = Modifier.weight(1f),
        )
        // Next Drop promo card
        NextDropPromoCard()
    }
}

@Composable
private fun NextDropPromoCard() {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.primaryContainer,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "NEXT DROP",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = "PHANTOM PROTOCOL",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                text = "Early access for Premium Members starts in 4 hours.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                modifier = Modifier.padding(top = 4.dp),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Notify Me →",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
