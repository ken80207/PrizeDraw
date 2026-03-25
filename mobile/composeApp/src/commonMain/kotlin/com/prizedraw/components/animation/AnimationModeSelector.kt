package com.prizedraw.components.animation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.enums.DrawAnimationMode

/**
 * Settings composable for selecting the player's preferred draw animation mode.
 *
 * Renders a radio-button list for each available [DrawAnimationMode]. The
 * [availableModes] parameter restricts the choices to those currently enabled by
 * the admin (via feature flags); disabled modes do not appear, preventing players
 * from selecting a mode that would fall back silently.
 *
 * @param selectedMode The currently selected mode.
 * @param availableModes Set of modes enabled by server feature flags.
 * @param onModeSelected Callback invoked when the player selects a mode.
 */
@Composable
public fun AnimationModeSelector(
    selectedMode: DrawAnimationMode,
    availableModes: Set<DrawAnimationMode> = DrawAnimationMode.entries.toSet(),
    onModeSelected: (DrawAnimationMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = "Draw Animation",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        availableModes.forEach { mode ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .selectable(
                            selected = mode == selectedMode,
                            onClick = { onModeSelected(mode) },
                        ).padding(vertical = 4.dp),
            ) {
                RadioButton(
                    selected = mode == selectedMode,
                    onClick = { onModeSelected(mode) },
                )
                Text(
                    text = mode.displayName(),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

private fun DrawAnimationMode.displayName(): String =
    when (this) {
        DrawAnimationMode.TEAR -> "Tear Open"
        DrawAnimationMode.SCRATCH -> "Scratch Card"
        DrawAnimationMode.FLIP -> "Card Flip"
        DrawAnimationMode.INSTANT -> "Instant Reveal"
    }
