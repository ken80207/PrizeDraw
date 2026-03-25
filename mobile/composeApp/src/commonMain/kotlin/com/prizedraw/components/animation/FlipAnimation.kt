package com.prizedraw.components.animation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlin.math.abs

/** Total rotation degrees for a full flip. */
private const val FULL_ROTATION = 180f

/** Rotation angle at which faces swap (half flip). */
private const val HALF_ROTATION = 90f

/** Flip animation duration in milliseconds. */
private const val FLIP_DURATION_MS = 650

/** Camera distance multiplier for perspective depth. */
private const val CAMERA_DISTANCE_MULTIPLIER = 12f

private val FRONT_GRADIENT_START = Color(0xFF4F46E5)
private val FRONT_GRADIENT_MID = Color(0xFF7C3AED)
private val FRONT_GRADIENT_END = Color(0xFFA855F7)

/**
 * 3D card-flip reveal animation using [graphicsLayer] rotationY.
 *
 * Front face: decorative card with purple gradient, grid pattern overlay, and a "?" mark.
 * Back face: prize image with grade label and name, counter-rotated so it reads correctly.
 *
 * The player taps the card to trigger the flip. [onRevealed] is called when the
 * 650ms animation finishes.
 *
 * @param prizePhotoUrl CDN URL of the prize image shown on the back face.
 * @param prizeGrade Grade label to display on the back (e.g. "A賞").
 * @param prizeName Display name of the prize shown on the back face.
 * @param onRevealed Callback invoked once the flip animation completes.
 */
@Composable
public fun FlipAnimation(
    prizePhotoUrl: String,
    prizeGrade: String = "",
    prizeName: String = "",
    onRevealed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val rotation = remember { Animatable(0f) }
    var flipped by remember { mutableStateOf(false) }
    var revealed by remember { mutableStateOf(false) }

    // Trigger flip when user taps
    LaunchedEffect(flipped) {
        if (!flipped) return@LaunchedEffect
        rotation.animateTo(
            targetValue = FULL_ROTATION,
            animationSpec =
                tween(
                    durationMillis = FLIP_DURATION_MS,
                    easing = FastOutSlowInEasing,
                ),
        )
        revealed = true
        onRevealed()
    }

    // True when the back face should be visible (past the halfway point)
    val showBack = rotation.value > HALF_ROTATION

    // Shadow elevation tracks rotation — deepest at 90° (edge-on)
    val shadowElevation = (1f - abs(rotation.value - HALF_ROTATION) / HALF_ROTATION) * 16f + 4f

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier.fillMaxSize(),
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 240.dp, height = 340.dp)
                    .shadow(
                        elevation = shadowElevation.dp,
                        shape = RoundedCornerShape(20.dp),
                        ambientColor = Color(0x55000000),
                        spotColor = Color(0x44000000),
                    ).graphicsLayer {
                        rotationY = rotation.value
                        cameraDistance = CAMERA_DISTANCE_MULTIPLIER * density
                    }.clip(RoundedCornerShape(20.dp))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                        role = Role.Button,
                        enabled = !flipped,
                    ) {
                        flipped = true
                    },
        ) {
            if (!showBack) {
                // ── Front face ──────────────────────────────────────────
                FrontFace()
            } else {
                // ── Back face — counter-rotated to appear upright ───────
                BackFace(
                    prizePhotoUrl = prizePhotoUrl,
                    prizeGrade = prizeGrade,
                    prizeName = prizeName,
                )
            }
        }

        // Tap hint (visible before flip)
        if (!flipped) {
            Text(
                text = "點擊翻牌",
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 13.sp,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp),
            )
        }
    }
}

@Composable
private fun FrontFace() {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .fillMaxSize()
                .background(
                    brush =
                        Brush.linearGradient(
                            colors =
                                listOf(
                                    FRONT_GRADIENT_START,
                                    FRONT_GRADIENT_MID,
                                    FRONT_GRADIENT_END,
                                ),
                        ),
                ),
    ) {
        // Decorative concentric diamonds
        for (i in 4 downTo 1) {
            Box(
                modifier =
                    Modifier
                        .size((i * 40).dp)
                        .graphicsLayer { rotationZ = 45f }
                        .background(
                            color = Color.White.copy(alpha = 0.04f * i),
                            shape = RoundedCornerShape(6.dp),
                        ),
            )
        }

        // Center "?" badge
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(80.dp)
                    .graphicsLayer { rotationZ = 45f }
                    .background(
                        color = Color.White.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                    ),
        ) {
            Text(
                text = "?",
                color = Color.White,
                fontSize = 36.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.graphicsLayer { rotationZ = -45f },
            )
        }
    }
}

@Composable
private fun BackFace(
    prizePhotoUrl: String,
    prizeGrade: String,
    prizeName: String,
) {
    // The back face must be counter-rotated 180° around Y so it reads left-to-right
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    rotationY = FULL_ROTATION // un-mirror the back face
                },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color.White),
        ) {
            // Prize image — upper 60% of card
            Box(
                modifier =
                    Modifier
                        .weight(0.6f)
                        .fillMaxSize(),
            ) {
                AsyncImage(
                    model = prizePhotoUrl,
                    contentDescription = "Prize",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                // Gradient fade to white at bottom
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(
                                brush =
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.White),
                                        startY = Float.MAX_VALUE * 0.5f,
                                    ),
                            ),
                )
            }

            // Grade + name — lower 40% of card
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier =
                    Modifier
                        .weight(0.4f)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
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
                        color = Color(0xFF1A1A2E),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp,
                    )
                }
            }
        }
    }
}
