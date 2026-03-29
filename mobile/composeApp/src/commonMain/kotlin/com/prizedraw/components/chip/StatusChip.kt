package com.prizedraw.components.chip

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** Colored chip displaying a status label. */
@Composable
public fun StatusChip(
    status: String,
    modifier: Modifier = Modifier,
) {
    val (bgColor, textColor) = statusColors(status)
    Box(
        modifier = modifier
            .clip(MaterialTheme.shapes.small)
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = status.uppercase().replace("_", " "),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = textColor,
        )
    }
}

private fun statusColors(status: String): Pair<Color, Color> {
    return when (status.uppercase()) {
        "OPEN" -> Color(0xFF4CAF50) to Color.White
        "IN_PROGRESS", "PENDING" -> Color(0xFFF59E0B) to Color(0xFF472A00)
        "RESOLVED", "COMPLETED" -> Color(0xFF666680) to Color.White
        "CLOSED" -> Color(0xFF444460) to Color.White
        else -> Color(0xFF666680) to Color.White
    }
}
