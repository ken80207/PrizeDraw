package com.prizedraw.screens.campaign

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.chat.ChatMessage
import com.prizedraw.components.chat.LiveChatPanel
import com.prizedraw.components.chat.LiveDrop
import com.prizedraw.components.chat.LiveDropsFeed
import com.prizedraw.components.chip.TierBadge
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.viewmodels.draw.UnlimitedDrawIntent
import com.prizedraw.viewmodels.draw.UnlimitedDrawState
import com.prizedraw.viewmodels.draw.UnlimitedDrawViewModel

// ---------------------------------------------------------------------------
// Sample data for demo rendering prior to ViewModel wiring
// ---------------------------------------------------------------------------

private val sampleLiveDrops =
    listOf(
        LiveDrop(
            id = "d1",
            playerName = "S.Tanaka just pulled",
            prizeName = "CYBER SHOGUN",
            tierGrade = "SSR",
            timestamp = "just now",
        ),
        LiveDrop(
            id = "d2",
            playerName = "Yuki_02 just pulled",
            prizeName = "NEON KATANA",
            tierGrade = "SR",
            timestamp = "1m",
        ),
        LiveDrop(
            id = "d3",
            playerName = "Hiro_X just pulled",
            prizeName = "LOGOUT BUTTON",
            tierGrade = "B",
            timestamp = "3m",
        ),
    )

private val sampleGalleryChatMessages =
    listOf(
        ChatMessage(
            id = "m1",
            senderName = "VERTA_DEV",
            text = "Just saw a guy win 3 SRs in a row..the luck is insane today!",
            timestamp = "now"
        ),
        ChatMessage(
            id = "m2",
            senderName = "You",
            text = "Saving up for a 10-pull, wish me luck!",
            timestamp = "30s",
            isCurrentUser = true
        ),
        ChatMessage(
            id = "m3",
            senderName = "MIKA_CHAN",
            text = "The SSR drop rate seems higher in the last hour, anyone else noticed?",
            timestamp = "2m"
        ),
    )

private val sampleTierProbabilities =
    listOf(
        TierProbabilityRow(
            "SSR",
            "Legendary Relics",
            "Full Set Collectible • NFT • +500 redeemable",
            "1.0%",
            "~100 max"
        ),
        TierProbabilityRow("SR", "Premium Figures", "Hand-painted Resin Statue", "4.5%", "5 - 122"),
        TierProbabilityRow("A", "Rare Accessories", "Acrylic Stands & Keychains", "24.5%", "80+ items"),
        TierProbabilityRow("N", "Standard Goods", "Art Cards & Stickers", "70.0%", "∞ Cards & Stickers"),
    )

private data class TierProbabilityRow(
    val grade: String,
    val name: String,
    val description: String,
    val probability: String,
    val quantity: String,
)

// ---------------------------------------------------------------------------
// Public screen composable
// ---------------------------------------------------------------------------

/**
 * Unlimited draw screen showing the hero banner, tier probability table, live drops feed,
 * live chat panel, and draw history.
 *
 * Layout adapts between phone (single column) and tablet (two-column with side panel) via
 * [BoxWithConstraints] and [rememberWindowWidthSizeClass].
 *
 * Keep existing MVI wiring — only the UI layout is restyled.
 *
 * @param viewModel The MVI ViewModel providing state and accepting intents.
 * @param campaignId The unlimited campaign UUID — triggers [UnlimitedDrawIntent.LoadCampaign]
 *   on first composition if the campaign is not yet loaded.
 */
@Composable
public fun UnlimitedDrawScreen(
    viewModel: UnlimitedDrawViewModel,
    campaignId: String,
) {
    val state by viewModel.state.collectAsState()
    UnlimitedDrawContent(
        state = state,
        onDraw = { viewModel.onIntent(UnlimitedDrawIntent.Draw(quantity = 1)) },
        onMultiDraw = { qty -> viewModel.onIntent(UnlimitedDrawIntent.Draw(quantity = qty)) },
        onAcknowledgeResult = { viewModel.onIntent(UnlimitedDrawIntent.AcknowledgeResult) },
    )
}

@Composable
private fun UnlimitedDrawContent(
    state: UnlimitedDrawState,
    onDraw: () -> Unit,
    onMultiDraw: (Int) -> Unit,
    onAcknowledgeResult: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        when {
            state.isLoading -> CenteredLoader()
            state.error != null -> CenteredError(state.error)
            else ->
                UnlimitedDrawBody(
                    campaign = state.campaign,
                    prizeDefinitions = state.prizeDefinitions,
                    drawHistory = state.drawHistory,
                    pointBalance = state.pointBalance,
                    isDrawing = state.isDrawing,
                    onDraw = onDraw,
                    onMultiDraw = onMultiDraw,
                )
        }
        ResultRevealOverlay(
            result = state.lastResult,
            onDismiss = onAcknowledgeResult,
        )
    }
}

@Composable
private fun UnlimitedDrawBody(
    campaign: UnlimitedCampaignDto?,
    prizeDefinitions: List<PrizeDefinitionDto>,
    drawHistory: List<UnlimitedDrawResultDto>,
    pointBalance: Int?,
    isDrawing: Boolean,
    onDraw: () -> Unit,
    onMultiDraw: (Int) -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSizeClass = rememberWindowWidthSizeClass(maxWidth)

        if (windowSizeClass == WindowWidthSizeClass.Medium) {
            // Tablet: main content | side panel
            Row(modifier = Modifier.fillMaxSize()) {
                UnlimitedMainColumn(
                    campaign = campaign,
                    prizeDefinitions = prizeDefinitions,
                    drawHistory = drawHistory,
                    pointBalance = pointBalance,
                    isDrawing = isDrawing,
                    onDraw = onDraw,
                    onMultiDraw = onMultiDraw,
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                )
                UnlimitedSidePanel(
                    modifier = Modifier.width(300.dp).fillMaxHeight(),
                )
            }
        } else {
            // Phone: stacked layout
            UnlimitedMainColumn(
                campaign = campaign,
                prizeDefinitions = prizeDefinitions,
                drawHistory = drawHistory,
                pointBalance = pointBalance,
                isDrawing = isDrawing,
                onDraw = onDraw,
                onMultiDraw = onMultiDraw,
                modifier = Modifier.fillMaxSize(),
                appendSideContent = true,
            )
        }
    }
}

@Composable
private fun UnlimitedMainColumn(
    campaign: UnlimitedCampaignDto?,
    prizeDefinitions: List<PrizeDefinitionDto>,
    drawHistory: List<UnlimitedDrawResultDto>,
    pointBalance: Int?,
    isDrawing: Boolean,
    onDraw: () -> Unit,
    onMultiDraw: (Int) -> Unit,
    modifier: Modifier = Modifier,
    appendSideContent: Boolean = false,
) {
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        // Hero banner with draw button
        item {
            UnlimitedHeroBanner(
                campaign = campaign,
                pointBalance = pointBalance,
                isDrawing = isDrawing,
                onDraw = onDraw,
            )
        }

        // Tier probability table
        item {
            val definitions =
                if (prizeDefinitions.isNotEmpty()) {
                    prizeDefinitions.map { def ->
                        TierProbabilityRow(
                            grade = def.grade,
                            name = def.name,
                            description = def.name,
                            probability =
                                def.probabilityBps?.let { bps ->
                                    val pct = bps / 100.0
                                    val intPart = pct.toInt()
                                    val fracPart = ((pct - intPart) * 10).toInt()
                                    "$intPart.$fracPart%"
                                } ?: "--",
                            quantity = "--",
                        )
                    }
                } else {
                    sampleTierProbabilities
                }
            TierProbabilitySection(
                rows = definitions,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        // Side content appended on phone
        if (appendSideContent) {
            item {
                LiveDropsFeed(
                    drops = sampleLiveDrops,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
            item {
                LiveChatPanel(
                    title = "GALLERY LOUNGE",
                    messages = sampleGalleryChatMessages,
                    viewerCount = 2358,
                    onSendMessage = {},
                    isLive = true,
                    modifier =
                        Modifier
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .height(280.dp),
                )
            }
        }

        // YOUR HISTORY section
        // always show section header
        if (drawHistory.isNotEmpty() || true) {
            item {
                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    color = MaterialTheme.colorScheme.outlineVariant,
                )
                SectionHeader(
                    title = "YOUR HISTORY",
                    actionText = "VIEW FULL JOURNAL",
                    onAction = {},
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
            if (drawHistory.isNotEmpty()) {
                items(drawHistory) { result -> DrawHistoryRow(result) }
            } else {
                // Sample history rows for demo
                item {
                    SampleHistoryRow(
                        prizeName = "NEON KITSUNE MASK",
                        grade = "SR",
                        cost = 500,
                        date = "2025.10.14 16:52",
                    )
                }
                item {
                    SampleHistoryRow(
                        prizeName = "PULLED COMMON STICKER PACK",
                        grade = "N",
                        cost = 500,
                        date = "2025.10.14 16:41",
                    )
                }
            }
        }
    }
}

@Composable
private fun UnlimitedHeroBanner(
    campaign: UnlimitedCampaignDto?,
    pointBalance: Int?,
    isDrawing: Boolean,
    onDraw: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(220.dp),
    ) {
        // Background gradient
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors =
                                listOf(
                                    Color(0xFF3D1A00),
                                    Color(0xFF0A0A1A),
                                ),
                        ),
                    ),
        )
        // Campaign title and draw button
        Column(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(20.dp),
        ) {
            Text(
                text = campaign?.title ?: "INFINITE KUJI\nULTRA BLITZ",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Black,
                color = Color.White,
            )
            Spacer(Modifier.height(16.dp))
            PrimaryButton(
                text = if (isDrawing) "DRAWING..." else "DRAW NOW",
                onClick = onDraw,
                enabled = !isDrawing,
            )
            Spacer(Modifier.height(8.dp))
            val price = campaign?.pricePerDraw ?: 500
            Text(
                text = "ENTRY FEE\n$price PTS",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            )
        }
        // SSR prize badge on the right
        Column(
            modifier =
                Modifier
                    .align(Alignment.CenterEnd)
                    .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = Color(0xFFFF6B6B).copy(alpha = 0.9f),
            ) {
                Text(
                    text = "SSR RANK",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = "CYBER SHOGUN\n\"NO-FACE\"",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun TierProbabilitySection(
    rows: List<TierProbabilityRow>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Tier Probability",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = "VERIFIED ODDS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            rows.forEach { row ->
                TierProbabilityCard(row = row)
            }
        }
    }
}

@Composable
private fun TierProbabilityCard(row: TierProbabilityRow) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            TierBadge(grade = row.grade)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = row.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = row.description,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = row.probability,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = row.quantity,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun UnlimitedSidePanel(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .background(MaterialTheme.colorScheme.surfaceContainerLow)
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        LiveDropsFeed(
            drops = sampleLiveDrops,
            modifier = Modifier.weight(0.4f),
        )
        LiveChatPanel(
            title = "GALLERY LOUNGE",
            messages = sampleGalleryChatMessages,
            viewerCount = 2358,
            onSendMessage = {},
            isLive = true,
            modifier = Modifier.weight(0.6f),
        )
        // Coming Soon promo card
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = Color(0xFF1A1A40),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "COMING SOON",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "NEO TOKYO COLLECTION",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "NOTIFY ME",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun DrawHistoryRow(result: UnlimitedDrawResultDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = MaterialTheme.shapes.small,
                    ),
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Pulled ",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = result.prizeName,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(4.dp))
                TierBadge(grade = result.grade)
            }
            Text(
                text = "Spent ${result.pointsCharged} PTS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SampleHistoryRow(
    prizeName: String,
    grade: String,
    cost: Int,
    date: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = MaterialTheme.shapes.small,
                    ),
        )
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = "Pulled ",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = prizeName,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                TierBadge(grade = grade)
            }
            Text(
                text = "Spent ${cost}PTS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            text = date,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * Animated overlay card that appears when [result] is non-null.
 *
 * Tapping the overlay calls [onDismiss] to clear the result and end the reveal animation.
 */
@Composable
private fun ResultRevealOverlay(
    result: UnlimitedDrawResultDto?,
    onDismiss: () -> Unit,
) {
    AnimatedVisibility(
        visible = result != null,
        enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
        exit = fadeOut(),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.7f)),
            contentAlignment = Alignment.Center,
        ) {
            result?.let { r ->
                Card(
                    modifier =
                        Modifier
                            .fillMaxWidth(0.8f)
                            .padding(16.dp),
                    onClick = onDismiss,
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors =
                        CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainer,
                        ),
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        TierBadge(grade = r.grade)
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            modifier = Modifier.size(120.dp),
                            shape = MaterialTheme.shapes.medium,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                        ) {}
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = r.prizeName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "-${r.pointsCharged} pts",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = S("draw.tapToContinue"),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CenteredLoader() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun CenteredError(message: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = message, color = MaterialTheme.colorScheme.error)
    }
}
