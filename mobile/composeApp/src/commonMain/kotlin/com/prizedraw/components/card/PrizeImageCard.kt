package com.prizedraw.components.card

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.prizedraw.components.chip.TierBadge

/** Prize image card with tier badge, name, and series label. */
@Composable
public fun PrizeImageCard(
    imageUrl: String,
    name: String,
    seriesName: String,
    tierGrade: String,
    modifier: Modifier = Modifier,
    prizeId: String? = null,
    onClick: (() -> Unit)? = null,
) {
    PrizeDrawCard(
        modifier =
            modifier.then(
                if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
            ),
    ) {
        Box {
            AsyncImage(
                model = imageUrl,
                contentDescription = name,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(MaterialTheme.shapes.medium)
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentScale = ContentScale.Crop,
            )
            TierBadge(
                grade = tierGrade,
                modifier = Modifier.align(Alignment.BottomStart).padding(8.dp),
            )
        }
        Text(
            text = name,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            text = seriesName,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
        if (prizeId != null) {
            Text(
                text = "ID: $prizeId",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
