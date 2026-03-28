package com.prizedraw.screens.status

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prizedraw.i18n.S

/**
 * Full-screen overlay shown when the installed app version is below the server-mandated minimum.
 *
 * When [isBlocking] is `true` the "Later" button is hidden and the user
 * **must** update before continuing. When `false`, an optional dismiss is provided.
 *
 * The [onUpdate] callback should open the platform's app store listing. Implementations
 * typically call `uriHandler.openUri(updateUrl)` on Android or `UIApplication.open(url)`
 * on iOS via expect/actual.
 *
 * @param currentVersion The version string currently installed (shown for transparency).
 * @param minRequiredVersion The server-mandated minimum version string.
 * @param isBlocking When true, hides the skip button — user must update to proceed.
 * @param onUpdate Callback to open the App Store / Play Store update page.
 * @param onDismiss Callback when the user opts to skip (only available when [isBlocking] is false).
 */
@Composable
public fun UpdateRequiredScreen(
    currentVersion: String,
    minRequiredVersion: String,
    isBlocking: Boolean,
    onUpdate: () -> Unit,
    onDismiss: (() -> Unit)? = null,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Update icon
            Text(
                text = "\u2B06\uFE0F", // upward arrow emoji
                fontSize = 64.sp,
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = S("status.updateRequired"),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground,
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = S("status.updateRequiredMessage"),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "${S(
                    "status.currentVersion"
                )}: $currentVersion\n${S("status.minRequired")}: $minRequiredVersion",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.outline,
            )

            Spacer(modifier = Modifier.height(40.dp))

            Button(
                onClick = onUpdate,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(S("status.updateApp"))
            }

            if (!isBlocking && onDismiss != null) {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(S("status.updateLater"))
                }
            }
        }
    }
}
