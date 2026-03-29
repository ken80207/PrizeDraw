package com.prizedraw.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Classifies window width into phone (Compact) or tablet (Medium) categories.
 */
public enum class WindowWidthSizeClass {
    /** Phone portrait: width < 600dp */
    Compact,

    /** Tablet / phone landscape: width >= 600dp */
    Medium,
}

/**
 * Remembers the [WindowWidthSizeClass] for the given [widthDp].
 */
@Composable
public fun rememberWindowWidthSizeClass(widthDp: Dp): WindowWidthSizeClass =
    remember(widthDp) {
        when {
            widthDp < 600.dp -> WindowWidthSizeClass.Compact
            else -> WindowWidthSizeClass.Medium
        }
    }
