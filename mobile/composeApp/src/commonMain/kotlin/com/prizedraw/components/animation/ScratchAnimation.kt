package com.prizedraw.components.animation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlin.math.hypot

/** Stroke width of the scratch brush in dp-equivalent canvas units. */
private const val SCRATCH_WIDTH = 52f

/** Fraction of total path length vs canvas diagonal to trigger reveal. */
private const val REVEAL_THRESHOLD = 1.4

/** Duration (ms) for the fade-out of the overlay once threshold is hit. */
private const val FADE_OUT_MS = 450

/** Minimum distance (px) between consecutive points before we record a new one. */
private const val MIN_POINT_DISTANCE = 6f

private val OVERLAY_COLOR_1 = Color(0xFFE0E0E0)
private val OVERLAY_COLOR_2 = Color(0xFFBDBDBD)
private val OVERLAY_COLOR_3 = Color(0xFFCCCCCC)

/**
 * Draws the silver metallic overlay with the scratched paths erased via [BlendMode.Clear].
 *
 * Because [BlendMode.Clear] requires an isolated layer we use [drawIntoCanvas] with a
 * save-layer approach so the blend mode is applied only within the overlay layer and
 * doesn't punch through to the compositing surface.
 */
private fun DrawScope.drawScratchOverlay(
    paths: List<List<Offset>>,
    overlayAlpha: Float,
) {
    drawIntoCanvas { canvas ->
        // Save a new layer so Clear blends only within this layer
        canvas.saveLayer(
            bounds =
                androidx.compose.ui.geometry
                    .Rect(0f, 0f, size.width, size.height),
            paint = Paint().apply { alpha = overlayAlpha },
        )

        // --- Metallic silver background ---
        drawRect(
            brush =
                Brush.linearGradient(
                    colorStops =
                        arrayOf(
                            0.0f to OVERLAY_COLOR_1,
                            0.4f to OVERLAY_COLOR_2,
                            0.7f to OVERLAY_COLOR_3,
                            1.0f to OVERLAY_COLOR_2,
                        ),
                ),
        )

        // Subtle sheen stripe
        drawRect(
            brush =
                Brush.linearGradient(
                    colors =
                        listOf(
                            Color.Transparent,
                            Color(0x28FFFFFF),
                            Color.Transparent,
                        ),
                    start = Offset(0f, 0f),
                    end = Offset(size.width * 0.7f, size.height * 0.7f),
                ),
        )

        // --- Erase scratched paths using BlendMode.Clear ---
        val erasePaint =
            Paint().apply {
                this.blendMode = BlendMode.Clear
                this.strokeWidth = SCRATCH_WIDTH
                strokeCap = StrokeCap.Round
                strokeJoin = StrokeJoin.Round
                isAntiAlias = true
            }

        for (pts in paths) {
            if (pts.size < 2) continue
            val path = Path()
            path.moveTo(pts[0].x, pts[0].y)
            for (i in 1 until pts.size) {
                // Smooth curve through control points
                if (i < pts.size - 1) {
                    val cx = (pts[i].x + pts[i + 1].x) / 2f
                    val cy = (pts[i].y + pts[i + 1].y) / 2f
                    path.quadraticTo(pts[i].x, pts[i].y, cx, cy)
                } else {
                    path.lineTo(pts[i].x, pts[i].y)
                }
            }
            canvas.drawPath(path, erasePaint)
        }

        canvas.restore()
    }
}

/** Approximate total scratch path length against the canvas diagonal for coverage estimate. */
private fun coverageFraction(
    paths: List<List<Offset>>,
    canvasWidth: Float,
    canvasHeight: Float,
): Double {
    val diagonal = hypot(canvasWidth.toDouble(), canvasHeight.toDouble())
    val totalLength =
        paths.sumOf { pts ->
            if (pts.size < 2) {
                0.0
            } else {
                pts.zipWithNext().sumOf { (a, b) ->
                    hypot((b.x - a.x).toDouble(), (b.y - a.y).toDouble())
                }
            }
        }
    return totalLength / diagonal
}

/**
 * Canvas-based scratch-card reveal animation.
 *
 * A metallic silver overlay is drawn on top of the prize image. The player
 * drags their finger to scratch, which erases the overlay via [BlendMode.Clear].
 * Path coverage is approximated by total path length vs canvas diagonal. When
 * [REVEAL_THRESHOLD] is exceeded the overlay fades out and [onRevealed] is called.
 *
 * Shows a "用手指刮開！" hint until the player starts scratching.
 *
 * @param prizePhotoUrl CDN URL of the prize image.
 * @param onRevealed Callback invoked once the reveal animation completes.
 */
@Composable
public fun ScratchAnimation(
    prizePhotoUrl: String,
    onRevealed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Completed paths (list of point lists)
    val completedPaths = remember { mutableStateListOf<List<Offset>>() }
    // Current in-progress path
    val currentPath = remember { mutableStateListOf<Offset>() }

    var revealed by remember { mutableStateOf(false) }
    var thresholdReached by remember { mutableStateOf(false) }
    var showHint by remember { mutableStateOf(true) }

    // Animatable for the fade-out of the silver overlay
    val overlayAlpha = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()

    val textMeasurer = rememberTextMeasurer()

    // Trigger fade-out when threshold is first reached
    LaunchedEffect(thresholdReached) {
        if (!thresholdReached) return@LaunchedEffect
        overlayAlpha.animateTo(
            targetValue = 0f,
            animationSpec = tween(durationMillis = FADE_OUT_MS),
        )
        revealed = true
        onRevealed()
    }

    Box(modifier = modifier.fillMaxSize()) {
        AsyncImage(
            model = prizePhotoUrl,
            contentDescription = "Prize",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        if (!revealed) {
            // All paths including the live one
            val allPaths: List<List<Offset>> =
                buildList {
                    addAll(completedPaths)
                    if (currentPath.isNotEmpty()) add(currentPath.toList())
                }

            Canvas(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .pointerInput(thresholdReached) {
                            if (thresholdReached) return@pointerInput
                            detectDragGestures(
                                onDragStart = { offset ->
                                    currentPath.clear()
                                    currentPath.add(offset)
                                    showHint = false
                                },
                                onDrag = { change, _ ->
                                    change.consume()
                                    val last = currentPath.lastOrNull()
                                    val pos = change.position
                                    if (last == null ||
                                        hypot(
                                            (pos.x - last.x).toDouble(),
                                            (pos.y - last.y).toDouble(),
                                        ) >= MIN_POINT_DISTANCE
                                    ) {
                                        currentPath.add(pos)

                                        // Check coverage periodically
                                        if (currentPath.size % 8 == 0) {
                                            val coverage =
                                                coverageFraction(
                                                    buildList {
                                                        addAll(completedPaths)
                                                        add(currentPath.toList())
                                                    },
                                                    size.width.toFloat(),
                                                    size.height.toFloat(),
                                                )
                                            if (coverage >= REVEAL_THRESHOLD && !thresholdReached) {
                                                thresholdReached = true
                                            }
                                        }
                                    }
                                },
                                onDragEnd = {
                                    completedPaths.add(currentPath.toList())
                                    currentPath.clear()
                                },
                                onDragCancel = {
                                    completedPaths.add(currentPath.toList())
                                    currentPath.clear()
                                },
                            )
                        },
            ) {
                drawScratchOverlay(allPaths, overlayAlpha.value)

                // Hint text
                if (showHint) {
                    val result =
                        textMeasurer.measure(
                            text = "用手指刮開！",
                            style =
                                TextStyle(
                                    color = Color(0xFF555555),
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                        )
                    drawText(
                        textLayoutResult = result,
                        topLeft =
                            Offset(
                                x = (size.width - result.size.width) / 2f,
                                y = (size.height - result.size.height) / 2f,
                            ),
                    )
                }
            }
        }
    }
}
