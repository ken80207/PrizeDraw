package com.prizedraw.screens.campaign

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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest

/**
 * A single item in the banner carousel.
 *
 * @property id Unique identifier for the banner.
 * @property imageUrl Remote URL of the banner image.
 * @property title Campaign headline displayed as overlay text.
 * @property subtitle Short description displayed below the title.
 * @property drawPrice Entry cost per draw (in points).
 */
public data class BannerItem(
    val id: String,
    val imageUrl: String,
    val title: String = "",
    val subtitle: String = "",
    val drawPrice: Int = 0,
)

/**
 * Horizontal auto-playing hero banner carousel with dark gradient overlay and CTA buttons.
 *
 * Displays a [HorizontalPager] of full-bleed banner images loaded via Coil 3 [AsyncImage].
 * Each page shows a dark gradient overlay with a "FEATURED EVENT" badge, the campaign title,
 * subtitle, and two action buttons. Auto-advances every 5 seconds. Manual swipes pause
 * auto-play for 10 seconds before resuming.
 *
 * If [banners] is empty nothing is rendered.
 *
 * @param banners Ordered list of [BannerItem]s to display.
 * @param onDrawNow Invoked when the user taps "Draw Now" on the active banner.
 * @param onViewPrizeList Invoked when the user taps "View Prize List" on the active banner.
 * @param modifier Optional layout modifier applied to the outer [Box].
 */
@Composable
public fun BannerCarousel(
    banners: List<BannerItem>,
    onDrawNow: (bannerId: String) -> Unit = {},
    onViewPrizeList: (bannerId: String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (banners.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { banners.size })
    var isAutoPlaying by remember { mutableStateOf(true) }

    // Detect manual swipes: pause auto-play for 10 s then resume.
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.isScrollInProgress }
            .collectLatest { scrollInProgress ->
                if (scrollInProgress) {
                    isAutoPlaying = false
                    delay(10_000L)
                    isAutoPlaying = true
                }
            }
    }

    // Auto-advance every 5 seconds when auto-play is active.
    LaunchedEffect(pagerState, isAutoPlaying) {
        if (isAutoPlaying) {
            while (true) {
                delay(5_000L)
                if (isAutoPlaying) {
                    val nextPage = (pagerState.currentPage + 1) % banners.size
                    pagerState.animateScrollToPage(nextPage)
                }
            }
        }
    }

    Box(modifier = modifier) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth(),
        ) { page ->
            val banner = banners[page]
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
            ) {
                AsyncImage(
                    model = banner.imageUrl,
                    contentDescription = banner.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp),
                )
                // Dark gradient overlay from bottom
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color(0xCC0A0A1A),
                                    Color(0xF00A0A1A),
                                ),
                                startY = 40f,
                            ),
                        ),
                )
                // Content overlay
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(horizontal = 20.dp, vertical = 20.dp),
                ) {
                    // "FEATURED EVENT" badge
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(bottom = 10.dp),
                    ) {
                        Text(
                            text = "FEATURED EVENT",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                    if (banner.title.isNotBlank()) {
                        Text(
                            text = banner.title,
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                        )
                    }
                    if (banner.subtitle.isNotBlank()) {
                        Text(
                            text = banner.subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f),
                            modifier = Modifier.padding(top = 4.dp, bottom = 14.dp),
                        )
                    } else {
                        Spacer(Modifier.height(14.dp))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val priceLabel = if (banner.drawPrice > 0) {
                            "Draw Now - ${banner.drawPrice} pts"
                        } else {
                            "Draw Now"
                        }
                        PrimaryButton(
                            text = priceLabel,
                            onClick = { onDrawNow(banner.id) },
                        )
                        PrizeDrawOutlinedButton(
                            text = "View Prize List",
                            onClick = { onViewPrizeList(banner.id) },
                        )
                    }
                }
            }
        }

        // Page indicator dots
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            repeat(banners.size) { index ->
                val isActive = pagerState.currentPage == index
                Box(
                    modifier = Modifier
                        .size(if (isActive) 10.dp else 6.dp)
                        .clip(CircleShape)
                        .background(
                            if (isActive) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                Color.White.copy(alpha = 0.4f)
                            },
                        ),
                )
            }
        }
    }
}
