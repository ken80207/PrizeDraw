package com.prizedraw.screens.draw

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.components.animation.AnimatedReveal
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.i18n.S

/**
 * Full-screen draw reveal screen.
 *
 * Dispatches to the appropriate animation composable via [AnimatedReveal] based
 * on the player's [animationMode] preference. Once the animation completes the
 * prize name and grade are displayed with a "Continue" button.
 *
 * @param prizePhotoUrl CDN URL of the prize to reveal.
 * @param prizeName Display name of the won prize.
 * @param prizeGrade Grade label (e.g. "A", "Last One Prize").
 * @param animationMode The player's chosen animation style.
 * @param onContinue Called when the player dismisses the reveal screen.
 */
@Composable
public fun DrawRevealScreen(
    prizePhotoUrl: String,
    prizeName: String,
    prizeGrade: String,
    animationMode: DrawAnimationMode,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var revealed by remember { mutableStateOf(false) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier =
            modifier
                .fillMaxSize()
                .padding(16.dp),
    ) {
        AnimatedReveal(
            mode = animationMode,
            prizePhotoUrl = prizePhotoUrl,
            prizeGrade = prizeGrade,
            prizeName = prizeName,
            onRevealed = { revealed = true },
            modifier =
                Modifier
                    .weight(1f)
                    .padding(bottom = 16.dp),
        )

        if (revealed) {
            Text(
                text = prizeGrade,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = prizeName,
                style = MaterialTheme.typography.headlineSmall,
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onContinue) {
                Text(S("common.continue"))
            }
        }
    }
}
