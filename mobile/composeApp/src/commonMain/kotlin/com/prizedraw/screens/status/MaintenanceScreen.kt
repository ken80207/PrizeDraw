package com.prizedraw.screens.status

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prizedraw.i18n.S
import kotlinx.coroutines.delay
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private const val AUTO_RETRY_INTERVAL_MS = 30_000L

/**
 * Full-screen blocking overlay displayed during platform maintenance.
 *
 * This screen **cannot be dismissed** — it covers all navigation and prevents
 * users from interacting with any other part of the app until the server returns
 * to [com.prizedraw.contracts.dto.status.ServerStatus.ONLINE].
 *
 * Auto-retry is triggered every 30 seconds by calling [onRetry]. The caller
 * (typically the NavGraph status observer) is responsible for removing this
 * composable from the composition once the server is back online.
 *
 * @param title Maintenance headline from the active announcement.
 * @param message Detailed maintenance message.
 * @param scheduledEnd Optional estimated restoration timestamp shown to users.
 * @param onRetry Callback invoked both by the manual retry button and the 30-second auto-retry.
 */
@Composable
public fun MaintenanceScreen(
    title: String,
    message: String,
    scheduledEnd: Instant?,
    onRetry: () -> Unit,
) {
    var isRetrying by remember { mutableStateOf(false) }

    // Auto-retry every 30 seconds
    LaunchedEffect(Unit) {
        while (true) {
            delay(AUTO_RETRY_INTERVAL_MS)
            isRetrying = true
            onRetry()
            delay(RETRY_INDICATOR_DURATION_MS)
            isRetrying = false
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .padding(horizontal = 32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Maintenance icon
                Text(
                    text = "\uD83D\uDD27", // wrench emoji
                    fontSize = 64.sp,
                )

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onBackground,
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (scheduledEnd != null) {
                    Spacer(modifier = Modifier.height(16.dp))
                    val localTime = scheduledEnd.toLocalDateTime(TimeZone.currentSystemDefault())
                    val timeString =
                        "%02d:%02d".format(localTime.hour, localTime.minute)
                    Text(
                        text = "${S("status.scheduledRestorationAt")} $timeString",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium,
                    )
                }

                Spacer(modifier = Modifier.height(40.dp))

                if (isRetrying) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Button(
                        onClick = {
                            isRetrying = true
                            onRetry()
                        },
                    ) {
                        Text(S("status.reconnect"))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = S("status.autoRetryEvery30s"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
}

private const val RETRY_INDICATOR_DURATION_MS = 1_500L
