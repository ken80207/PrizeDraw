package com.prizedraw.components.animation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.prizedraw.contracts.enums.DrawAnimationMode

/**
 * Dispatcher composable that routes to the appropriate animation implementation
 * based on the player's [mode] preference.
 *
 * All four modes share the same surface contract: they accept [prizePhotoUrl],
 * optional [prizeGrade] and [prizeName] metadata, and call [onRevealed] when the
 * reveal is complete. Callers need only import this single composable rather than
 * referencing each mode directly.
 *
 * If a mode is disabled server-side the server sets [mode] to [DrawAnimationMode.INSTANT]
 * in the profile response, so no additional fallback logic is needed here.
 *
 * @param mode The animation mode to play.
 * @param prizePhotoUrl CDN URL of the prize image to reveal.
 * @param prizeGrade Grade label shown as an overlay on applicable modes (e.g. "A賞").
 * @param prizeName Display name of the prize shown on applicable modes.
 * @param onRevealed Callback invoked once the animation completes.
 * @param modifier Optional [Modifier] applied to the root composable of each mode.
 */
@Composable
public fun AnimatedReveal(
    mode: DrawAnimationMode,
    prizePhotoUrl: String,
    onRevealed: () -> Unit,
    modifier: Modifier = Modifier,
    prizeGrade: String = "",
    prizeName: String = "",
) {
    when (mode) {
        DrawAnimationMode.TEAR ->
            TearAnimation(
                prizePhotoUrl = prizePhotoUrl,
                onRevealed = onRevealed,
                modifier = modifier,
            )
        DrawAnimationMode.SCRATCH ->
            ScratchAnimation(
                prizePhotoUrl = prizePhotoUrl,
                onRevealed = onRevealed,
                modifier = modifier,
            )
        DrawAnimationMode.FLIP ->
            FlipAnimation(
                prizePhotoUrl = prizePhotoUrl,
                prizeGrade = prizeGrade,
                prizeName = prizeName,
                onRevealed = onRevealed,
                modifier = modifier,
            )
        DrawAnimationMode.INSTANT ->
            InstantReveal(
                prizePhotoUrl = prizePhotoUrl,
                prizeGrade = prizeGrade,
                prizeName = prizeName,
                onRevealed = onRevealed,
                modifier = modifier,
            )
    }
}
