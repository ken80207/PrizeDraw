package com.prizedraw.components.animation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sin

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Fraction of revealed area that commits the peel and triggers tear-off. */
private const val REVEAL_THRESHOLD = 0.7f

/** Width of the fold-shadow strip in canvas pixels. */
private const val CURL_WIDTH = 32f

/** Paper parchment colour stops (warm brown gradient). */
private val PAPER_COLOR_LIGHT = Color(0xFFE8D5B7)
private val PAPER_COLOR_MID1 = Color(0xFFD9BC93)
private val PAPER_COLOR_MID2 = Color(0xFFC8A57A)
private val PAPER_COLOR_DARK = Color(0xFF8B6914)

/** Fold-shadow colours. */
private val SHADOW_NEAR = Color(0x72000000)
private val SHADOW_FAR = Color.Transparent

/** Fold-highlight colour (bright crease on the peeled side). */
private val HIGHLIGHT_NEAR = Color(0x8CFFFFFF)
private val HIGHLIGHT_FAR = Color.Transparent

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the peel progress [0f..1f] for the given drag.
 *
 * Progress is a blend of:
 * - how many of the four canvas corners are on the "peeled" side of the fold line, and
 * - how far the drag distance is relative to 75% of the canvas diagonal.
 */
private fun computeProgress(
    start: Offset,
    current: Offset,
    canvasW: Float,
    canvasH: Float,
): Float {
    val drag = current - start
    val dragLen = drag.getDistance()
    if (dragLen < 1f) return 0f

    val dragUnit = drag / dragLen
    val foldPoint = current

    val corners =
        listOf(
            Offset(0f, 0f),
            Offset(canvasW, 0f),
            Offset(canvasW, canvasH),
            Offset(0f, canvasH),
        )

    val peeled =
        corners.count { c ->
            val v = c - foldPoint
            (v.x * dragUnit.x + v.y * dragUnit.y) > 0f
        }
    val cornerFraction = peeled / 4f

    val diag = hypot(canvasW, canvasH)
    val distFraction = (dragLen / (diag * 0.75f)).coerceIn(0f, 1f)

    return (cornerFraction * 0.6f + distFraction * 0.4f).coerceIn(0f, 1f)
}

/**
 * Returns the fold-line direction unit vector — perpendicular to the drag direction.
 * The fold line runs through [foldPoint] in this direction.
 */
private fun foldDirection(dragUnit: Offset): Offset {
    // Rotate drag 90°: (-dy, dx)
    val d = Offset(-dragUnit.y, dragUnit.x)
    val len = d.getDistance()
    return if (len > 0.001f) d / len else Offset(1f, 0f)
}

/**
 * Finds the two points where the fold line (through [foldPoint], direction [foldDir])
 * intersects the canvas boundary rectangle [0,0]..[W,H].
 */
private fun foldLineIntersections(
    foldPoint: Offset,
    foldDir: Offset,
    W: Float,
    H: Float,
): List<Offset> {
    val edges =
        listOf(
            Pair(Offset(0f, 0f), Offset(W, 0f)), // top
            Pair(Offset(W, 0f), Offset(W, H)), // right
            Pair(Offset(W, H), Offset(0f, H)), // bottom
            Pair(Offset(0f, H), Offset(0f, 0f)), // left
        )

    val results = mutableListOf<Offset>()
    for ((a, b) in edges) {
        val ex = b.x - a.x
        val ey = b.y - a.y
        val denom = foldDir.x * ey - foldDir.y * ex
        if (abs(denom) < 0.0001f) continue
        val t = ((a.x - foldPoint.x) * ey - (a.y - foldPoint.y) * ex) / denom
        val s = ((a.x - foldPoint.x) * foldDir.y - (a.y - foldPoint.y) * foldDir.x) / denom
        if (s in 0f..1f) {
            results.add(Offset(foldPoint.x + t * foldDir.x, foldPoint.y + t * foldDir.y))
        }
    }
    return results.distinctBy { "${it.x.toInt()},${it.y.toInt()}" }
}

/**
 * Builds a [Path] that covers the desired half-plane of the canvas.
 *
 * @param peeled true → the drag-forward (peeled) half; false → the covered half.
 */
private fun buildHalfPlaneClipPath(
    foldPoint: Offset,
    dragUnit: Offset,
    foldDir: Offset,
    W: Float,
    H: Float,
    peeled: Boolean,
): Path {
    val sign = if (peeled) 1f else -1f
    val eps = 0.5f

    val intersections = foldLineIntersections(foldPoint, foldDir, W, H)

    val allCorners =
        listOf(
            Offset(0f, 0f),
            Offset(W, 0f),
            Offset(W, H),
            Offset(0f, H),
        )
    val oneSideCorners =
        allCorners.filter { c ->
            val v = c - foldPoint
            sign * (v.x * dragUnit.x + v.y * dragUnit.y) >= -eps
        }

    if (intersections.size < 2) {
        // Degenerate fallback — cover entire canvas
        return Path().apply { addRect(Rect(0f, 0f, W, H)) }
    }

    val points =
        buildList {
            add(intersections[0])
            addAll(oneSideCorners)
            add(intersections[1])
        }

    return Path().apply {
        moveTo(points[0].x, points[0].y)
        for (i in 1 until points.size) lineTo(points[i].x, points[i].y)
        close()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Draws the full parchment paper fill. */
private fun DrawScope.drawPaper() {
    drawRect(
        brush =
            Brush.linearGradient(
                colorStops =
                    arrayOf(
                        0.00f to PAPER_COLOR_LIGHT,
                        0.30f to PAPER_COLOR_MID1,
                        0.60f to PAPER_COLOR_MID2,
                        1.00f to PAPER_COLOR_DARK,
                    ),
                start = Offset(0f, 0f),
                end = Offset(size.width * 0.8f, size.height * 0.8f),
            ),
    )

    // Subtle grain dots
    val seed = 42
    for (yi in 0 until (size.height / 5).toInt()) {
        for (xi in 0 until (size.width / 7).toInt()) {
            val x = xi * 7f
            val y = yi * 5f
            if (sin(x * 0.31f + y * 0.77f + seed) > 0.62f) {
                drawRect(
                    color = Color(0x08000000),
                    topLeft = Offset(x, y),
                    size =
                        androidx.compose.ui.geometry
                            .Size(2f, 2f),
                )
            }
        }
    }
}

/**
 * Draws the fold-edge shadow (into the covered region) and highlight (into the peeled region)
 * to give a 3D curl effect.
 */
private fun DrawScope.drawFoldShadow(
    foldPoint: Offset,
    dragUnit: Offset,
    foldDir: Offset,
    W: Float,
    H: Float,
) {
    val intersections = foldLineIntersections(foldPoint, foldDir, W, H)
    if (intersections.size < 2) return

    val p0 = intersections[0]
    val p1 = intersections[1]

    // Shadow goes in the -drag direction (into still-covered area)
    val shadowDir = Offset(-dragUnit.x, -dragUnit.y)

    // Draw shadow on covered side
    val coveredPath = buildHalfPlaneClipPath(foldPoint, dragUnit, foldDir, W, H, false)
    clipPath(coveredPath) {
        val shadowPath =
            Path().apply {
                moveTo(p0.x, p0.y)
                lineTo(p1.x, p1.y)
                lineTo(p1.x + shadowDir.x * CURL_WIDTH, p1.y + shadowDir.y * CURL_WIDTH)
                lineTo(p0.x + shadowDir.x * CURL_WIDTH, p0.y + shadowDir.y * CURL_WIDTH)
                close()
            }
        drawPath(
            path = shadowPath,
            brush =
                Brush.linearGradient(
                    colors = listOf(SHADOW_NEAR, SHADOW_FAR),
                    start = foldPoint,
                    end =
                        Offset(
                            foldPoint.x + shadowDir.x * CURL_WIDTH,
                            foldPoint.y + shadowDir.y * CURL_WIDTH,
                        ),
                ),
        )
    }

    // Highlight crease on peeled side
    val peeledPath = buildHalfPlaneClipPath(foldPoint, dragUnit, foldDir, W, H, true)
    clipPath(peeledPath) {
        val highlightPath =
            Path().apply {
                moveTo(p0.x, p0.y)
                lineTo(p1.x, p1.y)
                lineTo(p1.x + dragUnit.x * 6f, p1.y + dragUnit.y * 6f)
                lineTo(p0.x + dragUnit.x * 6f, p0.y + dragUnit.y * 6f)
                close()
            }
        drawPath(
            path = highlightPath,
            brush =
                Brush.linearGradient(
                    colors = listOf(HIGHLIGHT_NEAR, HIGHLIGHT_FAR),
                    start = foldPoint,
                    end = Offset(foldPoint.x + dragUnit.x * 6f, foldPoint.y + dragUnit.y * 6f),
                ),
        )
    }
}

/**
 * Renders the full peel state onto the canvas:
 * 1. Un-peeled paper on the covered side.
 * 2. Semi-transparent mirrored paper ghost on the peeled side (simulates paper back).
 * 3. Shadow/highlight along the fold crease.
 */
private fun DrawScope.drawPeelState(
    startPoint: Offset,
    currentPoint: Offset,
    progress: Float,
) {
    if (progress <= 0f) {
        drawPaper()
        return
    }

    val drag = currentPoint - startPoint
    val dragLen = drag.getDistance()
    if (dragLen < 1f) {
        drawPaper()
        return
    }

    val dragUnit = drag / dragLen
    val foldDir = foldDirection(dragUnit)
    val foldPoint = currentPoint

    val canvasW = size.width
    val canvasH = size.height

    // 1. Covered (un-peeled) region — full paper
    val coveredPath = buildHalfPlaneClipPath(foldPoint, dragUnit, foldDir, canvasW, canvasH, false)
    clipPath(coveredPath) {
        drawPaper()
    }

    // 2. Peeled region — ghost (mirrored paper back, semi-transparent)
    //    We simulate the reflection by drawing a paper fill into the peeled clip
    //    with reduced opacity. A proper 2D reflection would require a save-layer
    //    with matrix transforms; here we approximate it with a slightly different
    //    gradient direction to hint at the flip.
    val peeledPath = buildHalfPlaneClipPath(foldPoint, dragUnit, foldDir, canvasW, canvasH, true)
    clipPath(peeledPath) {
        drawRect(
            brush =
                Brush.linearGradient(
                    colorStops =
                        arrayOf(
                            0.00f to PAPER_COLOR_DARK.copy(alpha = 0.28f),
                            0.50f to PAPER_COLOR_MID2.copy(alpha = 0.22f),
                            1.00f to PAPER_COLOR_LIGHT.copy(alpha = 0.18f),
                        ),
                    start = Offset(canvasW, canvasH),
                    end = Offset(0f, 0f),
                ),
        )
    }

    // 3. Fold-edge shadow and highlight
    drawFoldShadow(foldPoint, dragUnit, foldDir, canvasW, canvasH)
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physics-based reversible paper-peel reveal animation.
 *
 * The paper peels from wherever the user starts dragging, following the finger
 * in real time. Releasing below 70% snaps the paper back with spring physics.
 * Releasing above 70% tears the paper off with a fly-away animation and calls [onRevealed].
 *
 * The folded-back portion is rendered as a semi-transparent ghost with a shadow/
 * highlight along the fold crease to simulate the 3D curl of a sticker peeling off.
 *
 * @param prizePhotoUrl CDN URL of the prize image to reveal.
 * @param onRevealed Callback invoked once the full reveal animation completes.
 * @param onProgress Optional progress callback (0.0–1.0) for spectator sync.
 * @param modifier Modifier applied to the root [Box].
 */
@Composable
public fun TearAnimation(
    prizePhotoUrl: String,
    onRevealed: () -> Unit,
    onProgress: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    // ── State ────────────────────────────────────────────────────────────────

    var progress by remember { mutableFloatStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }
    var startOffset by remember { mutableStateOf(Offset.Zero) }
    var currentOffset by remember { mutableStateOf(Offset.Zero) }

    // Phase flags
    var revealed by remember { mutableStateOf(false) }
    var tearingOff by remember { mutableStateOf(false) }
    var snappingBack by remember { mutableStateOf(false) }

    // Spring-back: we animate progress back to 0 with spring physics
    val springProgress = remember { Animatable(0f) }

    // Tear-off transform animatables
    val tearRotation = remember { Animatable(0f) }
    val tearTx = remember { Animatable(0f) }
    val tearTy = remember { Animatable(0f) }
    val tearAlpha = remember { Animatable(1f) }

    val textMeasurer = rememberTextMeasurer()

    // ── Spring-back launch ───────────────────────────────────────────────────

    LaunchedEffect(snappingBack) {
        if (!snappingBack) return@LaunchedEffect
        springProgress.snapTo(progress)
        springProgress.animateTo(
            targetValue = 0f,
            animationSpec = spring(dampingRatio = 0.55f, stiffness = 320f),
        )
        progress = 0f
        // Ease current offset back to start so geometry resets
        currentOffset = startOffset
        snappingBack = false
        onProgress?.invoke(0f)
    }

    // ── Tear-off launch ──────────────────────────────────────────────────────

    LaunchedEffect(tearingOff) {
        if (!tearingOff) return@LaunchedEffect

        // Fly paper off screen: rotate + translate + fade simultaneously
        coroutineScope {
            listOf(
                async {
                    tearRotation.animateTo(
                        targetValue = 35f,
                        animationSpec = tween(durationMillis = 420),
                    )
                },
                async {
                    tearTx.animateTo(
                        targetValue = 380f,
                        animationSpec = tween(durationMillis = 420),
                    )
                },
                async {
                    tearTy.animateTo(
                        targetValue = -260f,
                        animationSpec = tween(durationMillis = 420),
                    )
                },
                async {
                    tearAlpha.animateTo(
                        targetValue = 0f,
                        animationSpec = tween(durationMillis = 420),
                    )
                },
            ).forEach { it.await() }
        }

        revealed = true
        onRevealed()
    }

    // ── Layout ───────────────────────────────────────────────────────────────

    Box(modifier = modifier.fillMaxSize()) {
        // Bottom layer: prize image always visible
        AsyncImage(
            model = prizePhotoUrl,
            contentDescription = "Prize",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        if (!revealed) {
            // Effective progress: use spring value when snapping back
            val effectiveProgress =
                when {
                    snappingBack -> springProgress.value
                    else -> progress
                }
            // Effective offset: lerp currentOffset toward startOffset during snap-back
            val effectiveCurrent =
                when {
                    snappingBack -> {
                        val t = 1f - springProgress.value.coerceIn(0f, 1f)
                        Offset(
                            x = startOffset.x + (currentOffset.x - startOffset.x) * (1f - t),
                            y = startOffset.y + (currentOffset.y - startOffset.y) * (1f - t),
                        )
                    }
                    else -> currentOffset
                }

            Canvas(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .then(
                            if (tearingOff) {
                                // Apply fly-away transform to the canvas
                                Modifier.graphicsLayer {
                                    rotationZ = tearRotation.value
                                    translationX = tearTx.value
                                    translationY = tearTy.value
                                    alpha = tearAlpha.value
                                }
                            } else {
                                Modifier
                            },
                        ).pointerInput(tearingOff, snappingBack) {
                            if (tearingOff || snappingBack) return@pointerInput
                            detectDragGestures(
                                onDragStart = { offset ->
                                    isDragging = true
                                    startOffset = offset
                                    currentOffset = offset
                                    progress = 0f
                                },
                                onDrag = { change, _ ->
                                    change.consume()
                                    if (!isDragging) return@detectDragGestures
                                    currentOffset = change.position
                                    val p =
                                        computeProgress(
                                            startOffset,
                                            currentOffset,
                                            size.width.toFloat(),
                                            size.height.toFloat(),
                                        )
                                    progress = p
                                    onProgress?.invoke(p)
                                },
                                onDragEnd = {
                                    isDragging = false
                                    if (progress >= REVEAL_THRESHOLD) {
                                        tearingOff = true
                                    } else {
                                        snappingBack = true
                                    }
                                },
                                onDragCancel = {
                                    isDragging = false
                                    snappingBack = true
                                },
                            )
                        },
            ) {
                drawPeelState(startOffset, effectiveCurrent, effectiveProgress)

                // Hint text — shown before any drag starts
                if (effectiveProgress < 0.04f && !isDragging) {
                    val result =
                        textMeasurer.measure(
                            text = "撕開紙張揭曉",
                            style =
                                TextStyle(
                                    color = Color(0xFF5A3A10),
                                    fontSize = 18.sp,
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
