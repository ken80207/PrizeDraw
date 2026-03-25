package com.prizedraw.components.animation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage

/** Duration of the scale-in + fade-in animation in milliseconds. */
private const val REVEAL_DURATION_MS = 300

/**
 * Instant reveal animation.
 *
 * Shows the prize image with a brief [scaleIn] + [fadeIn] (300ms).
 * Overlays the grade label and prize name on a translucent banner at the bottom.
 * [onRevealed] is called as soon as the visibility transition starts (non-blocking).
 *
 * @param prizePhotoUrl CDN URL of the prize image.
 * @param prizeGrade Grade label (e.g. "A賞"). Shown in a coloured badge if non-blank.
 * @param prizeName Display name of the prize. Shown below the grade badge.
 * @param onRevealed Callback invoked once the animation has been triggered.
 */
@Composable
public fun InstantReveal(
    prizePhotoUrl: String,
    prizeGrade: String = "",
    prizeName: String = "",
    onRevealed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
        onRevealed()
    }

    AnimatedVisibility(
        visible = visible,
        enter =
            scaleIn(
                initialScale = 0.88f,
                animationSpec = tween(durationMillis = REVEAL_DURATION_MS),
            ) +
                fadeIn(
                    animationSpec = tween(durationMillis = REVEAL_DURATION_MS),
                ),
        modifier = modifier.fillMaxSize(),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = prizePhotoUrl,
                contentDescription = prizeName.ifBlank { "Prize" },
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )

            // Gradient banner at bottom with grade + name
            if (prizeGrade.isNotBlank() || prizeName.isNotBlank()) {
                Box(
                    contentAlignment = Alignment.BottomCenter,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .background(
                                    brush =
                                        Brush.verticalGradient(
                                            colors =
                                                listOf(
                                                    Color.Transparent,
                                                    Color(0xAA000000),
                                                ),
                                            startY = Float.MAX_VALUE * 0.45f,
                                        ),
                                ).padding(bottom = 20.dp),
                        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Bottom,
                    ) {
                        if (prizeGrade.isNotBlank()) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier =
                                    Modifier
                                        .background(
                                            brush =
                                                Brush.horizontalGradient(
                                                    colors = listOf(Color(0xFFF59E0B), Color(0xFFF97316)),
                                                ),
                                            shape = RoundedCornerShape(50),
                                        ).padding(horizontal = 12.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    text = prizeGrade,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                        }

                        if (prizeName.isNotBlank()) {
                            Text(
                                text = prizeName,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
