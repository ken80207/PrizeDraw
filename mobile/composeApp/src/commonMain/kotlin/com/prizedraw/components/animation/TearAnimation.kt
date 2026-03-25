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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlin.math.abs
import kotlin.math.min

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Cover strip occupies the top this fraction of the ticket height. */
private const val COVER_RATIO = 0.32f

/**
 * Fraction of canvas width the user must drag before releasing locks in a
 * full tear-off. Below this, the cover snaps back.
 */
private const val REVEAL_THRESHOLD = 0.70f

/** How far the curl arc rises above the perforation line (dp-independent px). */
private const val CURL_HEIGHT = 44f

/**
 * Grab zone: what fraction of the canvas width from each edge counts as
 * "touching the cover strip edge" and initiates a tear.
 */
private const val EDGE_ZONE_RATIO = 0.28f

// ── Cover strip metallic colours ─────────────────────────────────────────────
private val COVER_C1 = Color(0xFFB8B8B8)
private val COVER_C2 = Color(0xFFE0E0E0)
private val COVER_C3 = Color(0xFFF0F0F0)
private val COVER_C4 = Color(0xFFD0D0D0)
private val COVER_C5 = Color(0xFFA0A0A0)

// ── Ticket body ───────────────────────────────────────────────────────────────
private val TICKET_BG = Color(0xFFFFF8F0)
private val TICKET_LINE_COLOR = Color(0x0A8B7355)

// ── Perforation ───────────────────────────────────────────────────────────────
private val PERF_SHADOW = Color(0x40000000)
private val PERF_HIGHLIGHT = Color(0x99FFFFFF)

// ── Grade badge colours ───────────────────────────────────────────────────────
private data class GradeColor(val bg: Color, val text: Color)

private val GRADE_COLORS: Map<String, GradeColor> = mapOf(
    "A賞"    to GradeColor(Color(0xFFEF4444), Color.White),
    "B賞"    to GradeColor(Color(0xFFF97316), Color.White),
    "C賞"    to GradeColor(Color(0xFF3B82F6), Color.White),
    "D賞"    to GradeColor(Color(0xFF22C55E), Color.White),
    "E賞"    to GradeColor(Color(0xFFA855F7), Color.White),
    "F賞"    to GradeColor(Color(0xFFEC4899), Color.White),
    "Last賞" to GradeColor(Color(0xFFF59E0B), Color.White),
    "LAST賞" to GradeColor(Color(0xFFF59E0B), Color.White),
)
private val DEFAULT_GRADE_COLOR = GradeColor(Color(0xFF6B7280), Color.White)

// ─────────────────────────────────────────────────────────────────────────────
// Tear direction enum
// ─────────────────────────────────────────────────────────────────────────────

/** Which horizontal edge the user grabbed to initiate the tear. */
private enum class TearDirection { LEFT, RIGHT }

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the horizontal tear progress [0f..1f] from a drag gesture.
 *
 * Tearing from LEFT: finger moves rightward → tearX sweeps left-to-right.
 * Tearing from RIGHT: finger moves leftward → tearX sweeps right-to-left.
 */
private fun computeTearProgress(
    startX: Float,
    currentX: Float,
    direction: TearDirection,
    canvasW: Float,
): Float {
    val delta = currentX - startX
    val travel = if (direction == TearDirection.LEFT) delta else -delta
    return (travel / canvasW).coerceIn(0f, 1f)
}

/** The absolute x-coordinate of the tear front given the current progress. */
private fun tearXFromProgress(
    progress: Float,
    direction: TearDirection,
    W: Float,
): Float = when (direction) {
    TearDirection.LEFT  -> progress * W
    TearDirection.RIGHT -> W - progress * W
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draws the ticket body: cream background, subtle texture, perforation line,
 * ticket number label, and the prize info area (grade badge + prize name).
 *
 * The prize image itself is rendered by [AsyncImage] in the Composable layer
 * behind the Canvas, so this function only draws the structural chrome.
 */
private fun DrawScope.drawTicketBody(
    coverH: Float,
    prizeGrade: String?,
    prizeName: String?,
    textMeasurer: androidx.compose.ui.text.TextMeasurer,
) {
    val W = size.width
    val H = size.height

    // ── Card background ───────────────────────────────────────────────────
    drawRect(color = TICKET_BG)

    // ── Subtle horizontal texture lines ──────────────────────────────────
    var lineY = coverH + 8f
    while (lineY < H) {
        drawLine(
            color = TICKET_LINE_COLOR,
            start = Offset(8f, lineY),
            end = Offset(W - 8f, lineY),
            strokeWidth = 1f,
        )
        lineY += 6f
    }

    // ── Perforation line (dashed, with 3D indent effect) ─────────────────
    val dashEffect = PathEffect.dashPathEffect(floatArrayOf(5f, 5f))

    // Shadow line (0.5px above perforation)
    drawLine(
        color = PERF_SHADOW,
        start = Offset(4f, coverH - 0.5f),
        end = Offset(W - 4f, coverH - 0.5f),
        strokeWidth = 1f,
        pathEffect = dashEffect,
    )
    // Highlight line (0.5px below perforation)
    drawLine(
        color = PERF_HIGHLIGHT,
        start = Offset(4f, coverH + 0.5f),
        end = Offset(W - 4f, coverH + 0.5f),
        strokeWidth = 1f,
        pathEffect = dashEffect,
    )

    // ── Ticket number ─────────────────────────────────────────────────────
    val numResult = textMeasurer.measure(
        text = "No. 一番賞",
        style = TextStyle(
            color = Color(0xFF999080),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        ),
    )
    drawText(
        textLayoutResult = numResult,
        topLeft = Offset(
            x = (W - numResult.size.width) / 2f,
            y = coverH + 16f,
        ),
    )

    // ── Prize grade badge ─────────────────────────────────────────────────
    if (prizeGrade != null) {
        val colors = GRADE_COLORS[prizeGrade] ?: DEFAULT_GRADE_COLOR
        val badgeResult = textMeasurer.measure(
            text = prizeGrade,
            style = TextStyle(
                color = colors.text,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        val badgeW = badgeResult.size.width + 28f
        val badgeH = badgeResult.size.height + 10f
        val badgeX = (W - badgeW) / 2f
        val badgeY = H - badgeH - (if (prizeName != null) 42f else 20f)

        val badgePath = Path().apply {
            addRoundRect(RoundRect(
                rect = Rect(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH),
                cornerRadius = CornerRadius(6f, 6f),
            ))
        }
        drawPath(path = badgePath, color = colors.bg)
        drawText(
            textLayoutResult = badgeResult,
            topLeft = Offset(
                x = (W - badgeResult.size.width) / 2f,
                y = badgeY + 5f,
            ),
        )
    }

    // ── Prize name ────────────────────────────────────────────────────────
    if (prizeName != null) {
        val nameResult = textMeasurer.measure(
            text = prizeName,
            style = TextStyle(
                color = Color(0xFF5C4A30),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
            ),
        )
        val nameY = H - nameResult.size.height - 12f
        drawText(
            textLayoutResult = nameResult,
            topLeft = Offset(
                x = (W - nameResult.size.width) / 2f,
                y = nameY,
            ),
        )
    }
}

/**
 * Draws the metallic silver/gold cover strip from [clipStartX] to [clipEndX].
 * Horizontal clipping controls the un-torn portion of the cover.
 *
 * @param shimmerPhase Sweeping highlight phase [0f..1f], used for the idle shimmer.
 */
private fun DrawScope.drawCoverStrip(
    coverH: Float,
    clipStartX: Float,
    clipEndX: Float,
    shimmerPhase: Float,
    textMeasurer: androidx.compose.ui.text.TextMeasurer,
) {
    val W = size.width
    if (clipEndX <= clipStartX) return

    // Clip to the un-torn portion
    val clipPath = Path().apply {
        addRect(Rect(clipStartX, 0f, clipEndX, coverH))
    }
    clipPath(clipPath) {
        // ── Base metallic gradient (horizontal) ──────────────────────────
        drawRect(
            brush = Brush.horizontalGradient(
                colorStops = arrayOf(
                    0.00f to COVER_C1,
                    0.20f to COVER_C2,
                    0.45f to COVER_C3,
                    0.70f to COVER_C4,
                    1.00f to COVER_C5,
                ),
                startX = 0f,
                endX = W,
            ),
            size = Size(W, coverH),
        )

        // ── Vertical sheen ────────────────────────────────────────────────
        drawRect(
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color(0x59FFFFFF),  // top highlight
                    Color(0x14FFFFFF),  // mid
                    Color(0x26000000),  // bottom shadow
                ),
                startY = 0f,
                endY = coverH,
            ),
            size = Size(W, coverH),
        )

        // ── Shimmer sweep ─────────────────────────────────────────────────
        val shimX = shimmerPhase * (W + 80f) - 40f
        drawRect(
            brush = Brush.horizontalGradient(
                colors = listOf(
                    Color.Transparent,
                    Color(0x8CFFFFFF),
                    Color.Transparent,
                ),
                startX = shimX - 40f,
                endX = shimX + 40f,
            ),
            size = Size(W, coverH),
        )

        // ── Cover text ────────────────────────────────────────────────────
        val textResult = textMeasurer.measure(
            text = "一番賞　封條",
            style = TextStyle(
                color = Color(0xB3504030),
                fontSize = min(coverH * 0.35f, 14f).sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        drawText(
            textLayoutResult = textResult,
            topLeft = Offset(
                x = (W - textResult.size.width) / 2f,
                y = (coverH - textResult.size.height) / 2f,
            ),
        )

        // ── Top border highlight ──────────────────────────────────────────
        drawRect(
            color = Color(0x8CFFFFFF),
            topLeft = Offset(0f, 0f),
            size = Size(W, 2f),
        )

        // ── Bottom border shadow ──────────────────────────────────────────
        drawRect(
            color = Color(0x33000000),
            topLeft = Offset(0f, coverH - 2f),
            size = Size(W, 2f),
        )
    }
}

/**
 * Draws the curl/peel effect at the tear edge.
 *
 * The torn portion of the cover strip appears to lift up and away from the
 * ticket, showing the underside (lighter colour). A drop-shadow below the
 * curl reinforces the 3D lifting effect.
 */
private fun DrawScope.drawCurlEffect(
    tearX: Float,
    coverH: Float,
    direction: TearDirection,
    progress: Float,
) {
    if (progress < 0.01f) return

    val curlSign = if (direction == TearDirection.LEFT) -1f else 1f
    val curlExtent = min(progress * 60f + 20f, 80f)
    val alpha = min(progress * 2f, 1f)

    // ── Drop shadow below the curl ────────────────────────────────────────
    drawRect(
        brush = Brush.linearGradient(
            colors = listOf(Color(0x33000000), Color.Transparent),
            start = Offset(tearX, coverH),
            end = Offset(tearX - curlSign * 18f, coverH + 14f),
        ),
        topLeft = Offset(
            x = if (direction == TearDirection.LEFT) tearX - 20f else tearX,
            y = coverH - 4f,
        ),
        size = Size(20f, 18f),
        alpha = 0.22f * alpha,
    )

    // ── Back-of-cover colour ──────────────────────────────────────────────
    val backBrush = Brush.linearGradient(
        colors = listOf(
            Color(0xFFD8D8D8),
            Color(0xFFEFEFEF),
            Color(0x4CF0F0F0),
        ),
        start = Offset(tearX, coverH),
        end = Offset(tearX - curlSign * curlExtent, coverH - CURL_HEIGHT),
    )

    // Control point and end point for the quadratic bezier curl shape
    val cp1x = tearX - curlSign * curlExtent * 0.4f
    val cp1y = coverH - CURL_HEIGHT * 0.6f
    val endX = tearX - curlSign * curlExtent
    val endY = coverH - CURL_HEIGHT * 0.8f
    val stripW = coverH * 0.85f

    val curlPath = Path().apply {
        moveTo(tearX, coverH)
        quadraticTo(cp1x, cp1y, endX, endY)
        lineTo(endX, endY - stripW * 0.25f)
        quadraticTo(cp1x, cp1y - stripW * 0.3f, tearX, coverH - stripW * 0.15f)
        close()
    }

    drawPath(path = curlPath, brush = backBrush, alpha = alpha * 0.88f)

    // ── Edge highlight on the curl ────────────────────────────────────────
    val curlEdgePath = Path().apply {
        moveTo(tearX, coverH)
        quadraticTo(cp1x, cp1y, endX, endY)
    }
    drawPath(
        path = curlEdgePath,
        color = Color(0xB3FFFFFF),
        style = androidx.compose.ui.graphics.drawscope.Stroke(
            width = 1.5f,
            cap = StrokeCap.Round,
        ),
        alpha = 0.4f * alpha,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ichiban Kuji (一番賞) horizontal cover-strip tear reveal animation.
 *
 * The ticket has a metallic silver cover strip across the top ~32% of its
 * height. The user grabs either the left or right edge of the strip and drags
 * horizontally to tear the cover away, progressively revealing the prize info.
 *
 * Physics:
 * - Releasing before [REVEAL_THRESHOLD] (70%): cover snaps back with spring.
 * - Releasing at or past 70%: remaining strip flies off the screen, then
 *   [onRevealed] is invoked.
 *
 * Visual layers (bottom to top):
 * 1. [AsyncImage] — prize photo, always rendered underneath the canvas.
 * 2. [Canvas] — ticket body chrome, cover strip, and curl effect.
 *
 * @param prizePhotoUrl  CDN URL of the prize photo to reveal.
 * @param prizeGrade     Optional grade label, e.g. "A賞" — shown as a coloured badge.
 * @param prizeName      Optional prize display name.
 * @param onRevealed     Callback invoked once the tear-off animation completes.
 * @param onProgress     Optional real-time progress callback [0f..1f].
 * @param modifier       Modifier applied to the root [Box].
 */
@Composable
public fun TearAnimation(
    prizePhotoUrl: String,
    onRevealed: () -> Unit,
    prizeGrade: String? = null,
    prizeName: String? = null,
    onProgress: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    // ── State ─────────────────────────────────────────────────────────────

    var progress by remember { mutableFloatStateOf(0f) }
    var isDragging by remember { mutableStateOf(false) }

    /** X coordinate (in canvas px) where the drag gesture started. */
    var startX by remember { mutableFloatStateOf(0f) }

    /** Current X coordinate of the dragging finger. */
    var currentX by remember { mutableFloatStateOf(0f) }

    /** Which edge was grabbed to start the tear. */
    var tearDirection by remember { mutableStateOf(TearDirection.LEFT) }

    /** Width of the canvas — captured during the first draw. */
    var canvasWidth by remember { mutableFloatStateOf(0f) }

    // Phase flags
    var revealed by remember { mutableStateOf(false) }
    var tearingOff by remember { mutableStateOf(false) }
    var snappingBack by remember { mutableStateOf(false) }

    /** Whether the user has touched the cover at least once. */
    var hasInteracted by remember { mutableStateOf(false) }

    /** Shimmer phase [0f..1f] — drives the idle highlight sweep. */
    var shimmerPhase by remember { mutableFloatStateOf(0f) }

    // Animatables for spring-back
    val springProgress = remember { Animatable(0f) }

    // Animatables for tear-off fly
    val tearOffTransX = remember { Animatable(0f) }
    val tearOffAlpha = remember { Animatable(1f) }

    val textMeasurer = rememberTextMeasurer()

    // ── Shimmer idle animation ─────────────────────────────────────────────

    // Continuously sweep a shimmer highlight across the cover strip until the
    // user first touches it. Each sweep takes ~2 s; the loop restarts from 0.
    LaunchedEffect(hasInteracted, revealed) {
        if (hasInteracted || revealed) return@LaunchedEffect
        while (!hasInteracted && !revealed) {
            val anim = Animatable(0f)
            anim.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 2000),
                block = { shimmerPhase = value },
            )
            shimmerPhase = 0f
        }
    }

    // ── Spring-back ────────────────────────────────────────────────────────

    LaunchedEffect(snappingBack) {
        if (!snappingBack) return@LaunchedEffect
        springProgress.snapTo(progress)
        springProgress.animateTo(
            targetValue = 0f,
            animationSpec = spring(dampingRatio = 0.55f, stiffness = 320f),
        )
        progress = 0f
        snappingBack = false
        onProgress?.invoke(0f)
    }

    // ── Tear-off fly animation ─────────────────────────────────────────────

    LaunchedEffect(tearingOff) {
        if (!tearingOff) return@LaunchedEffect

        tearOffTransX.snapTo(0f)
        tearOffAlpha.snapTo(1f)

        val targetX = if (tearDirection == TearDirection.LEFT) -canvasWidth * 1.2f
                      else canvasWidth * 1.2f

        coroutineScope {
            listOf(
                async {
                    tearOffTransX.animateTo(
                        targetValue = targetX,
                        animationSpec = tween(durationMillis = 360),
                    )
                },
                async {
                    tearOffAlpha.animateTo(
                        targetValue = 0f,
                        animationSpec = tween(durationMillis = 360),
                    )
                },
            ).forEach { it.await() }
        }

        revealed = true
        onRevealed()
    }

    // ── Layout ─────────────────────────────────────────────────────────────

    Box(modifier = modifier.fillMaxSize()) {
        // Bottom layer: prize image — always visible underneath
        AsyncImage(
            model = prizePhotoUrl,
            contentDescription = "Prize",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        if (!revealed) {
            // Effective values (spring-back overrides live drag values)
            val effectiveProgress = when {
                snappingBack -> springProgress.value
                else         -> progress
            }

            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(tearingOff, snappingBack) {
                        if (tearingOff || snappingBack) return@pointerInput
                        detectDragGestures(
                            onDragStart = { offset ->
                                val W = size.width.toFloat()
                                val edgeZone = W * EDGE_ZONE_RATIO
                                // Only begin a tear when touching near the left or right edge
                                val side = when {
                                    offset.x <= edgeZone      -> TearDirection.LEFT
                                    offset.x >= W - edgeZone  -> TearDirection.RIGHT
                                    else                       -> null
                                }
                                if (side == null) return@detectDragGestures
                                isDragging = true
                                tearDirection = side
                                startX = offset.x
                                currentX = offset.x
                                progress = 0f
                                canvasWidth = W
                                hasInteracted = true
                                onProgress?.invoke(0f)
                            },
                            onDrag = { change, _ ->
                                change.consume()
                                if (!isDragging) return@detectDragGestures
                                currentX = change.position.x
                                val p = computeTearProgress(
                                    startX = startX,
                                    currentX = currentX,
                                    direction = tearDirection,
                                    canvasW = canvasWidth,
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
                val W = size.width
                val H = size.height
                val coverH = H * COVER_RATIO

                if (canvasWidth == 0f) canvasWidth = W

                // ── 1. Ticket body ─────────────────────────────────────────
                drawTicketBody(
                    coverH = coverH,
                    prizeGrade = prizeGrade,
                    prizeName = prizeName,
                    textMeasurer = textMeasurer,
                )

                if (effectiveProgress < 1f) {
                    // ── 2. Cover strip (un-torn portion) ──────────────────
                    val tearX = tearXFromProgress(effectiveProgress, tearDirection, W)

                    val (coverStartX, coverEndX) = when (tearDirection) {
                        TearDirection.LEFT  -> tearX to W
                        TearDirection.RIGHT -> 0f to tearX
                    }

                    withTransform(
                        transformBlock = {
                            if (tearingOff) {
                                translate(left = tearOffTransX.value)
                            }
                        },
                    ) {
                        drawCoverStrip(
                            coverH = coverH,
                            clipStartX = coverStartX,
                            clipEndX = coverEndX,
                            shimmerPhase = shimmerPhase,
                            textMeasurer = textMeasurer,
                        )
                    }

                    // ── 3. Curl at the tear edge ───────────────────────────
                    if (!tearingOff && effectiveProgress > 0f) {
                        drawCurlEffect(
                            tearX = tearX,
                            coverH = coverH,
                            direction = tearDirection,
                            progress = effectiveProgress,
                        )
                    }
                }

                // ── Hint text ─────────────────────────────────────────────
                if (!hasInteracted && effectiveProgress < 0.03f) {
                    val hintResult = textMeasurer.measure(
                        text = "← 從邊緣撕開封條 →",
                        style = TextStyle(
                            color = Color(0xFF5A3A10),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            background = Color(0xCCFFEBB4),
                        ),
                    )
                    drawText(
                        textLayoutResult = hintResult,
                        topLeft = Offset(
                            x = (W - hintResult.size.width) / 2f,
                            y = coverH + 8f,
                        ),
                        alpha = 0.9f,
                    )
                }
            }
        }
    }
}
