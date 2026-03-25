package com.prizedraw.screens.campaign

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.viewmodels.campaign.KujiCampaignState
import com.prizedraw.viewmodels.campaign.KujiCampaignViewModel

/**
 * Campaign list screen displaying active kuji campaigns.
 *
 * Shows a [LazyColumn] of [KujiCampaignCardStub] items. Each card shows the campaign title,
 * cover image placeholder, price per draw, and status badge. Active campaigns have a
 * "Watch Live" button that connects the player as a spectator without joining the queue.
 *
 * @param viewModel The MVI ViewModel (injected or created by caller).
 * @param onCampaignSelected Callback invoked when the player taps a campaign card (joins/watches).
 */
@Composable
public fun CampaignListScreen(
    viewModel: KujiCampaignViewModel,
    onCampaignSelected: (campaignId: String) -> Unit,
) {
    val state by viewModel.state.collectAsState()
    CampaignListContent(state = state, onCampaignSelected = onCampaignSelected)
}

@Composable
private fun CampaignListContent(
    state: KujiCampaignState,
    onCampaignSelected: (campaignId: String) -> Unit,
) {
    when {
        state.isLoading -> LoadingIndicator()
        state.error != null -> ErrorMessage(state.error)
        else ->
            CampaignList(
                campaigns = emptyList(), // TODO(T109): replace with real campaign list from state
                onCampaignSelected = onCampaignSelected,
            )
    }
}

@Composable
private fun CampaignList(
    campaigns: List<KujiCampaignDto>,
    onCampaignSelected: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(campaigns, key = { it.id }) { campaign ->
            KujiCampaignCardStub(
                campaign = campaign,
                onClick = { onCampaignSelected(campaign.id) },
                onWatchLive = { onCampaignSelected(campaign.id) },
            )
        }
    }
}

/**
 * Single kuji campaign card.
 *
 * Displays the campaign title, price, and status badge. For ACTIVE campaigns a
 * "Watch Live" button is shown that navigates to the board in spectator mode
 * (i.e. without joining the draw queue).
 *
 * TODO(T109): Replace cover image Box with Coil 3 AsyncImage.
 */
@Composable
private fun KujiCampaignCardStub(
    campaign: KujiCampaignDto,
    onClick: () -> Unit,
    onWatchLive: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Cover image placeholder — replace with AsyncImage
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {}
                Text(
                    text = "Cover",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = campaign.title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                text = "${campaign.pricePerDraw} pts / draw",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = campaign.status.name,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (campaign.status == com.prizedraw.contracts.enums.CampaignStatus.ACTIVE) {
                Button(
                    onClick = onWatchLive,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Text("Watch Live")
                }
            }
        }
    }
}

@Composable
private fun LoadingIndicator() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorMessage(message: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = message, color = MaterialTheme.colorScheme.error)
    }
}
