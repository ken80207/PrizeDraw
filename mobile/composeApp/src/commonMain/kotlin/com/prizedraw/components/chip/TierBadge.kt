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
import com.prizedraw.theme.PrizeDrawPrimary
import com.prizedraw.theme.PrizeDrawSecondary
import com.prizedraw.theme.PrizeDrawTertiary

/** Colored badge displaying a prize tier grade (SSR, SR, A, B, N, LAST). */
@Composable
public fun TierBadge(
    grade: String,
    modifier: Modifier = Modifier,
) {
    val (bgColor, textColor) = tierColors(grade)
    Box(
        modifier = modifier
            .clip(MaterialTheme.shapes.small)
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = grade.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = textColor,
        )
    }
}

private fun tierColors(grade: String): Pair<Color, Color> {
    return when (grade.uppercase()) {
        "SSR" -> Color(0xFFFF6B6B) to Color.White
        "SR" -> PrizeDrawPrimary to Color(0xFF472A00)
        "A" -> PrizeDrawSecondary to Color(0xFF1A1A40)
        "B" -> PrizeDrawTertiary to Color(0xFF003548)
        "N" -> Color(0xFF666680) to Color.White
        "LAST" -> Color(0xFFFF4500) to Color.White
        else -> Color(0xFF666680) to Color.White
    }
}
