package com.prizedraw.screens.status

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S

/**
 * A non-blocking, dismissible top banner for regular (non-critical) announcements.
 *
 * This banner is shown above the main content area when the server returns active
 * [com.prizedraw.contracts.dto.status.AnnouncementType.ANNOUNCEMENT] entries whose
 * `isBlocking` flag is `false`. Users can dismiss it with the close button.
 *
 * The dismissed state is preserved across recompositions via [rememberSaveable].
 * If the banner content changes (new announcement), pass a different [announcementId]
 * to reset the dismissed state for the new announcement.
 *
 * @param announcementId Stable identifier used to key the dismissed-state saveable.
 * @param title Short announcement headline.
 * @param message Detailed body text shown alongside the headline.
 */
@Composable
public fun AnnouncementBanner(
    announcementId: String,
    title: String,
    message: String,
) {
    var isDismissed by rememberSaveable(key = "banner_dismissed_$announcementId") {
        mutableStateOf(false)
    }

    AnimatedVisibility(
        visible = !isDismissed,
        enter = expandVertically(),
        exit = shrinkVertically(),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )

            Spacer(modifier = Modifier.width(10.dp))

            androidx.compose.foundation.layout.Column(
                modifier = Modifier.weight(1f),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }

            IconButton(onClick = { isDismissed = true }) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = S("common.closeBanner"),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}
