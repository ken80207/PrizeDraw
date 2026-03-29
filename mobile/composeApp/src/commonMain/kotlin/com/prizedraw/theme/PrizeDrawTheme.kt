package com.prizedraw.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val PrizeDrawDarkColorScheme = darkColorScheme(
    primary = PrizeDrawPrimary,
    primaryContainer = PrizeDrawPrimaryContainer,
    onPrimary = PrizeDrawOnPrimary,
    onPrimaryContainer = PrizeDrawOnPrimaryContainer,
    secondary = PrizeDrawSecondary,
    secondaryContainer = PrizeDrawSecondaryContainer,
    onSecondary = PrizeDrawOnSecondary,
    onSecondaryContainer = PrizeDrawOnSecondaryContainer,
    tertiary = PrizeDrawTertiary,
    tertiaryContainer = PrizeDrawTertiaryContainer,
    onTertiary = PrizeDrawOnTertiary,
    onTertiaryContainer = PrizeDrawOnTertiaryContainer,
    surface = PrizeDrawSurface,
    surfaceDim = PrizeDrawSurfaceDim,
    surfaceBright = PrizeDrawSurfaceBright,
    surfaceContainerLowest = PrizeDrawSurfaceContainerLowest,
    surfaceContainerLow = PrizeDrawSurfaceContainerLow,
    surfaceContainer = PrizeDrawSurfaceContainer,
    surfaceContainerHigh = PrizeDrawSurfaceContainerHigh,
    surfaceContainerHighest = PrizeDrawSurfaceContainerHighest,
    onSurface = PrizeDrawOnSurface,
    onSurfaceVariant = PrizeDrawOnSurfaceVariant,
    error = PrizeDrawError,
    onError = PrizeDrawOnError,
    errorContainer = PrizeDrawErrorContainer,
    onErrorContainer = PrizeDrawOnErrorContainer,
    outline = PrizeDrawOutline,
    outlineVariant = PrizeDrawOutlineVariant,
    inverseSurface = PrizeDrawInverseSurface,
    inverseOnSurface = PrizeDrawInverseOnSurface,
    inversePrimary = PrizeDrawInversePrimary,
    scrim = PrizeDrawScrim,
)

/**
 * Root Material 3 theme for the PrizeDraw app.
 *
 * Applies a dark color scheme with amber/gold primary accents matching the
 * web app palette, along with [PrizeDrawShapes] for consistent corner radii
 * across all components.
 *
 * @param content The composable content to render within this theme.
 */
@Composable
public fun PrizeDrawTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = PrizeDrawDarkColorScheme,
        shapes = PrizeDrawShapes,
        content = content,
    )
}
