package com.prizedraw.screens.campaign

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.viewmodels.draw.UnlimitedDrawIntent
import com.prizedraw.viewmodels.draw.UnlimitedDrawState
import com.prizedraw.viewmodels.draw.UnlimitedDrawViewModel

/**
 * Unlimited draw screen showing the probability table, draw button, and live result feed.
 *
 * Layout:
 * - Campaign header (title, cover image placeholder, price per draw).
 * - Prize probability table (grade, probability %, photo placeholder).
 * - Large "Draw" button with current point cost; disabled while [UnlimitedDrawState.isDrawing].
 * - Rapid-fire results list that grows from the top as draws complete.
 * - Animated result card that appears over the content on each win.
 *
 * TODO(T118): Replace image placeholder [Surface]s with Coil 3 `AsyncImage` calls once
 *   the shared image-loading library is wired into the KMP module.
 *
 * @param viewModel The MVI ViewModel providing state and accepting intents.
 * @param campaignId The unlimited campaign UUID string — triggers [UnlimitedDrawIntent.LoadCampaign]
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
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { CampaignHeader(campaign) }
        item { PrizeProbabilityTable(prizeDefinitions) }
        item {
            DrawActionSection(
                pricePerDraw = campaign?.pricePerDraw ?: 0,
                pointBalance = pointBalance,
                isDrawing = isDrawing,
                onDraw = onDraw,
                onMultiDraw = onMultiDraw,
            )
        }
        if (drawHistory.isNotEmpty()) {
            item {
                Text(
                    text = "Results this session",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            items(drawHistory) { result -> DrawResultRow(result) }
        }
    }
}

@Composable
private fun CampaignHeader(campaign: UnlimitedCampaignDto?) {
    if (campaign == null) return
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Cover image placeholder
            Surface(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.12f),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("Cover", style = MaterialTheme.typography.labelMedium)
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(
                text = campaign.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            campaign.description?.let { desc ->
                Text(
                    text = desc,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun PrizeProbabilityTable(definitions: List<PrizeDefinitionDto>) {
    if (definitions.isEmpty()) return
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "Prize Probabilities",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            definitions.forEach { def -> ProbabilityRow(def) }
        }
    }
}

@Composable
private fun ProbabilityRow(definition: PrizeDefinitionDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Prize photo placeholder
        Surface(
            modifier = Modifier.size(40.dp),
            shape = MaterialTheme.shapes.small,
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.12f),
        ) {}
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = definition.grade, style = MaterialTheme.typography.labelMedium)
            Text(
                text = definition.name,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        val probabilityText =
            definition.probabilityBps?.let { bps ->
                val percent = bps / 10_000.0
                "${(kotlin.math.round(percent * 10000) / 10000.0)}%"
            } ?: "--"
        Text(
            text = probabilityText,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.End,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun DrawActionSection(
    pricePerDraw: Int,
    pointBalance: Int?,
    isDrawing: Boolean,
    onDraw: () -> Unit,
    onMultiDraw: (Int) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        pointBalance?.let { balance ->
            Text(
                text = "Balance: $balance pts",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }
        Button(
            onClick = onDraw,
            enabled = !isDrawing,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(56.dp),
        ) {
            if (isDrawing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text(
                    text = "Draw  ($pricePerDraw pts)",
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(3, 5, 10).forEach { qty ->
                Button(
                    onClick = { onMultiDraw(qty) },
                    enabled = !isDrawing,
                    colors = ButtonDefaults.outlinedButtonColors(),
                ) {
                    Text(text = "×$qty")
                }
            }
        }
    }
}

@Composable
private fun DrawResultRow(result: UnlimitedDrawResultDto) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            modifier = Modifier.size(36.dp),
            shape = MaterialTheme.shapes.small,
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {}
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = result.prizeName, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = result.grade,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            text = "-${result.pointsCharged} pts",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
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
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = r.grade,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(8.dp))
                        // Prize image placeholder
                        Surface(
                            modifier = Modifier.size(120.dp),
                            shape = MaterialTheme.shapes.medium,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                        ) {}
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = r.prizeName,
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "-${r.pointsCharged} pts",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = "Tap to continue",
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
        CircularProgressIndicator()
    }
}

@Composable
private fun CenteredError(message: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = message, color = MaterialTheme.colorScheme.error)
    }
}
