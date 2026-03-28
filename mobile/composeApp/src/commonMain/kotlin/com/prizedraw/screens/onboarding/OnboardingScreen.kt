package com.prizedraw.screens.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier

/**
 * Onboarding screen placeholder.
 *
 * Currently auto-skips via [onComplete]. When ready to implement, replace
 * the `LaunchedEffect` body with the actual onboarding UI (e.g. a
 * `HorizontalPager` walkthrough).
 *
 * @param onComplete Called when onboarding finishes (or is skipped).
 */
@Composable
public fun OnboardingScreen(onComplete: () -> Unit) {
    // TODO: Replace with actual onboarding UI (HorizontalPager walkthrough)
    LaunchedEffect(Unit) {
        onComplete()
    }
    Box(modifier = Modifier.fillMaxSize())
}
