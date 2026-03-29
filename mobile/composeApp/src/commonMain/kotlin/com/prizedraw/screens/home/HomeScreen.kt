package com.prizedraw.screens.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S

/**
 * Home / gallery page content.
 *
 * This composable is pure content — all navigation chrome (top bar, bottom nav,
 * sidebar) is provided by the outer [com.prizedraw.navigation.AppShell]. It is
 * rendered when the active shell tab is `"campaigns"`.
 *
 * TODO(T220): Implement the full home screen with featured events, Ichiban Kuji
 *   grid, and Infinite Kuji grid once the campaign data layer is wired.
 *
 * @param onCampaignSelected Invoked with the campaign ID when a campaign card is tapped.
 * @param onViewAllKuji Invoked when the user taps "View All" in the Ichiban Kuji section.
 * @param onViewAllInfinite Invoked when the user taps "View All" in the Infinite Kuji section.
 */
@Composable
public fun HomeScreen(
    onCampaignSelected: (campaignId: String) -> Unit,
    onViewAllKuji: () -> Unit,
    onViewAllInfinite: () -> Unit,
) {
    // Placeholder — will be filled in next task
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
    ) {
        Text(
            text = S("nav.home"),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
