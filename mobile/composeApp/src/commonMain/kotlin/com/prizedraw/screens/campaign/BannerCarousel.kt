package com.prizedraw.screens.campaign

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest

/**
 * A single item in the banner carousel.
 *
 * @property id Unique identifier for the banner.
 * @property imageUrl Remote URL of the banner image.
 */
public data class BannerItem(
    val id: String,
    val imageUrl: String,
)

/**
 * Horizontal auto-playing banner carousel with swipe support and page indicators.
 *
 * Displays a [HorizontalPager] of banner images loaded via Coil 3 [AsyncImage]. Auto-advances
 * every 5 seconds. Manual swipes pause auto-play for 10 seconds before resuming.
 *
 * If [banners] is empty nothing is rendered.
 *
 * @param banners Ordered list of [BannerItem]s to display.
 * @param modifier Optional layout modifier applied to the outer [Box].
 */
@Composable
public fun BannerCarousel(
    banners: List<BannerItem>,
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
            AsyncImage(
                model = banners[page].imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp)),
            )
        }

        // Page indicator dots
        Row(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            repeat(banners.size) { index ->
                val isActive = pagerState.currentPage == index
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(
                                if (isActive) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                                },
                            ),
                )
            }
        }
    }
}
