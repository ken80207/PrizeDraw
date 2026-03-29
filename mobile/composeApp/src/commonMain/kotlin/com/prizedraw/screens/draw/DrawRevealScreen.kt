package com.prizedraw.screens.draw

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prizedraw.components.animation.AnimatedReveal
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.contracts.enums.DrawAnimationMode

/**
 * Full-screen draw reveal screen styled to match the Zenith Cyber-Geisha Edition design.
 *
 * Layout:
 * - Campaign title + series header + timer badge (top)
 * - Animated prize reveal (center — keeps existing [AnimatedReveal] wrappers)
 * - "CONGRATULATIONS" overlay text once revealed
 * - Prize name + description
 * - Two action buttons: "Claim Masterpiece" (primary) + "View Prize Pool" (outlined)
 * - Three draw quantity option cards at the bottom (1/3/5 draws) with "RECOMMENDED" on 3-draw
 *
 * @param prizePhotoUrl CDN URL of the prize to reveal.
 * @param prizeName Display name of the won prize.
 * @param prizeGrade Grade label (e.g. "A", "Last One Prize").
 * @param animationMode The player's chosen animation style.
 * @param onContinue Called when the player taps "Claim Masterpiece".
 * @param modifier Optional [Modifier] applied to the root composable.
 * @param campaignTitle Campaign headline displayed at the top (e.g. "Zenith Cyber-Geisha Edition").
 * @param seriesLabel Series subtitle displayed below the campaign title.
 * @param prizeDescription Short description of the won prize.
 * @param seriesSerial Optional series serial number (e.g. "#8829-ZK").
 * @param onViewPrizePool Called when the player taps "View Prize Pool".
 */
@Composable
public fun DrawRevealScreen(
    prizePhotoUrl: String,
    prizeName: String,
    prizeGrade: String,
    animationMode: DrawAnimationMode,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
    campaignTitle: String = "Zenith Cyber-Geisha Edition",
    seriesLabel: String = "Premium Ichiban Kuji Series • Vol. 04",
    prizeDescription: String = "Hand-painted gold leaf",
    seriesSerial: String = "#8829-ZK",
    onViewPrizePool: () -> Unit = {},
) {
    var revealed by remember { mutableStateOf(false) }

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF0A0A1A),
                                Color(0xFF151530),
                                Color(0xFF0A0A1A),
                            ),
                    ),
                ),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(16.dp))

            // Top row: campaign title + timer badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text =
                            campaignTitle.let { title ->
                                // Render italic style within the title (e.g. "Zenith Cyber-Geisha Edition")
                                title
                            },
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                    )
                    Text(
                        text = seriesLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceContainer,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Timer,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier =
                                Modifier
                                    .width(14.dp)
                                    .height(14.dp),
                        )
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "TIME REMAINING",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                text = "05:00",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Animated reveal area (center)
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                AnimatedReveal(
                    mode = animationMode,
                    prizePhotoUrl = prizePhotoUrl,
                    prizeGrade = prizeGrade,
                    prizeName = prizeName,
                    onRevealed = { revealed = true },
                    modifier = Modifier.fillMaxSize(),
                )

                // Congratulations overlay once revealed
                if (revealed) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "CONGRATULATIONS",
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                // Series serial badge (top-right of image area)
                if (revealed && seriesSerial.isNotBlank()) {
                    Surface(
                        modifier =
                            Modifier
                                .align(Alignment.TopEnd)
                                .padding(8.dp),
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.primary,
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = "SERIES SERIAL",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                            )
                            Text(
                                text = seriesSerial,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        }
                    }
                }
            }

            // Prize info + action buttons (visible after reveal)
            if (revealed) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "CONGRATULATIONS",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing =
                        androidx.compose.ui.unit.TextUnit(
                            2f,
                            androidx.compose.ui.unit.TextUnitType.Sp,
                        ),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = prizeName,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    fontStyle = FontStyle.Italic,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                )
                if (prizeDescription.isNotBlank()) {
                    Text(
                        text = prizeDescription,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Spacer(Modifier.height(12.dp))
                // Action buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PrimaryButton(
                        text = "Claim Masterpiece",
                        onClick = onContinue,
                    )
                    PrizeDrawOutlinedButton(
                        text = "View Prize Pool",
                        onClick = onViewPrizePool,
                    )
                }
                Spacer(Modifier.height(12.dp))
            } else {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "SWIPE TO REVEAL DESTINY",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing =
                        androidx.compose.ui.unit.TextUnit(
                            1.5f,
                            androidx.compose.ui.unit.TextUnitType.Sp,
                        ),
                )
                Spacer(Modifier.height(12.dp))
            }

            // Draw quantity selection cards
            DrawQuantitySection(modifier = Modifier.fillMaxWidth())

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun DrawQuantitySection(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // 1 Draw option
        Box(modifier = Modifier.weight(1f)) {
            PrizeDrawCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "SINGLE ENTRY",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "1 DRAW",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "500 pts",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // 3 Draw option (RECOMMENDED — highlighted)
        Box(modifier = Modifier.weight(1f)) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.primary,
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "RECOMMENDED",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "3 DRAWS",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "1,400 pts",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                    )
                }
            }
        }

        // 5 Draw option
        Box(modifier = Modifier.weight(1f)) {
            PrizeDrawCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "BULK ENTRY",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "5 DRAWS",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "2,250 pts",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
