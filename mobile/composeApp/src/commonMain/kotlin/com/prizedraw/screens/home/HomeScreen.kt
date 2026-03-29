package com.prizedraw.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.components.user.PointsDisplay
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass
import com.prizedraw.screens.campaign.BannerCarousel
import com.prizedraw.screens.campaign.BannerItem

// ---------------------------------------------------------------------------
// Sample / mock data for demo rendering prior to ViewModel wiring
// ---------------------------------------------------------------------------

private val sampleBanners =
    listOf(
        BannerItem(
            id = "b1",
            imageUrl = "https://picsum.photos/seed/banner1/800/400",
            title = "Demon Slayer:\nTo the Hashira Training",
            subtitle =
                "The ultimate battle begins. " +
                    "Win the exclusive Hashira figures before they vanish into the night.",
            drawPrice = 800,
        ),
        BannerItem(
            id = "b2",
            imageUrl = "https://picsum.photos/seed/banner2/800/400",
            title = "One Piece:\nFinal Saga Edition",
            subtitle = "Luffy and crew in stunning limited collector figures.",
            drawPrice = 650,
        ),
    )

private data class KujiCampaignCard(
    val id: String,
    val imageUrl: String,
    val name: String,
    val points: Int,
    val remainingTickets: Int,
    val totalTickets: Int,
)

private data class InfiniteKujiCard(
    val id: String,
    val imageUrl: String,
    val badge: String,
    val title: String,
    val pricePerDraw: Int,
    val ssrRate: String,
    val srRate: String,
)

private val sampleKujiCampaigns =
    listOf(
        KujiCampaignCard(
            id = "k1",
            imageUrl = "https://picsum.photos/seed/kuji1/300/300",
            name = "Dragon Ball Super Hero",
            points = 850,
            remainingTickets = 24,
            totalTickets = 40,
        ),
        KujiCampaignCard(
            id = "k2",
            imageUrl = "https://picsum.photos/seed/kuji2/300/300",
            name = "Evangelion Unit-01 Awakening",
            points = 700,
            remainingTickets = 12,
            totalTickets = 40,
        ),
        KujiCampaignCard(
            id = "k3",
            imageUrl = "https://picsum.photos/seed/kuji3/300/300",
            name = "One Piece: Wano Country",
            points = 950,
            remainingTickets = 8,
            totalTickets = 40,
        ),
        KujiCampaignCard(
            id = "k4",
            imageUrl = "https://picsum.photos/seed/kuji4/300/300",
            name = "Spy x Family: Mission Start",
            points = 650,
            remainingTickets = 31,
            totalTickets = 40,
        ),
    )

private val sampleInfiniteKuji =
    listOf(
        InfiniteKujiCard(
            id = "i1",
            imageUrl = "https://picsum.photos/seed/inf1/300/300",
            badge = "LIMITED",
            title = "Limited \"Glitch\" Series Art Toy",
            pricePerDraw = 450,
            ssrRate = "1.0%",
            srRate = "94.2%",
        ),
        InfiniteKujiCard(
            id = "i2",
            imageUrl = "https://picsum.photos/seed/inf2/300/300",
            badge = "LIMITED",
            title = "Cyber-Mechanical Keycap Set",
            pricePerDraw = 350,
            ssrRate = "1.2%",
            srRate = "50.3%",
        ),
        InfiniteKujiCard(
            id = "i3",
            imageUrl = "https://picsum.photos/seed/inf3/300/300",
            badge = "SPECIAL",
            title = "V-Bucks & Points Multiplier",
            pricePerDraw = 1200,
            ssrRate = "20.0%",
            srRate = "75.0%",
        ),
    )

// ---------------------------------------------------------------------------
// Public screen composable
// ---------------------------------------------------------------------------

/**
 * Home / gallery page with featured banner carousel, Ichiban Kuji section, and Infinite Kuji section.
 *
 * Uses mock data while ViewModel wiring is pending (see TODO in task backlog).
 * Layout adapts between phone (single column) and tablet (wider card row) via [WindowWidthSizeClass].
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
    androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val windowSizeClass = rememberWindowWidthSizeClass(maxWidth)
        val kujiCardWidth: Dp = if (windowSizeClass == WindowWidthSizeClass.Medium) 200.dp else 160.dp

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            // Hero banner carousel
            item {
                BannerCarousel(
                    banners = sampleBanners,
                    onDrawNow = { bannerId -> onCampaignSelected(bannerId) },
                    onViewPrizeList = { bannerId -> onCampaignSelected(bannerId) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Ichiban Kuji section header
            item {
                SectionHeader(
                    title = "Ichiban Kuji",
                    subtitle = "Premium Japanese Lottery Sets",
                    actionText = "View All",
                    onAction = onViewAllKuji,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            // Ichiban Kuji horizontal card row
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(sampleKujiCampaigns, key = { it.id }) { campaign ->
                        KujiCampaignCard(
                            campaign = campaign,
                            cardWidth = kujiCardWidth,
                            onClick = { onCampaignSelected(campaign.id) },
                        )
                    }
                }
            }

            item { Spacer(Modifier.height(8.dp)) }

            // Infinite Kuji section header
            item {
                SectionHeader(
                    title = "Infinite Kuji",
                    subtitle = "Continuous Draws with Probability Tiers",
                    actionText = "View All",
                    onAction = onViewAllInfinite,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            // Infinite Kuji horizontal card row
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(sampleInfiniteKuji, key = { it.id }) { item ->
                        InfiniteKujiCard(
                            item = item,
                            cardWidth = kujiCardWidth,
                            onClick = { onCampaignSelected(item.id) },
                        )
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Private card composables
// ---------------------------------------------------------------------------

@Composable
private fun KujiCampaignCard(
    campaign: KujiCampaignCard,
    cardWidth: Dp,
    onClick: () -> Unit,
) {
    val ticketProgress =
        if (campaign.totalTickets > 0) {
            (campaign.remainingTickets.toFloat() / campaign.totalTickets.toFloat()).coerceIn(0f, 1f)
        } else {
            0f
        }

    Surface(
        modifier =
            Modifier
                .width(cardWidth)
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
    ) {
        Column {
            AsyncImage(
                model = campaign.imageUrl,
                contentDescription = campaign.name,
                contentScale = ContentScale.Crop,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(cardWidth),
            )
            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = campaign.name,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                )
                Spacer(Modifier.height(6.dp))
                PointsDisplay(points = "${campaign.points}")
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Remaining Tickets: ${campaign.remainingTickets}/${campaign.totalTickets}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                // Ticket progress bar
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth(ticketProgress)
                                .height(4.dp)
                                .background(MaterialTheme.colorScheme.primary),
                    )
                }
            }
        }
    }
}

@Composable
private fun InfiniteKujiCard(
    item: InfiniteKujiCard,
    cardWidth: Dp,
    onClick: () -> Unit,
) {
    Surface(
        modifier =
            Modifier
                .width(cardWidth)
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
    ) {
        Column {
            Box {
                AsyncImage(
                    model = item.imageUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(cardWidth),
                )
                Surface(
                    modifier =
                        Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp),
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.tertiary,
                ) {
                    Text(
                        text = item.badge,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onTertiary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            text = "SSR RATE",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = item.ssrRate,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFF6B6B),
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "SR RATE",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = item.srRate,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                PrizeDrawOutlinedButton(
                    text = "Try Your Luck",
                    onClick = onClick,
                    fullWidth = true,
                )
            }
        }
    }
}
