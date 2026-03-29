package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Server-side state for a single in-flight draw animation.
 *
 * The result fields ([resultGrade], [resultPrizeName], [resultPhotoUrl], [resultPrizeInstanceId])
 * are pre-computed and stored here before the animation begins. They are **never** broadcast to
 * spectators until [com.prizedraw.realtime.services.DrawSyncService.completeDraw] is called —
 * this is the anti-spoiler guarantee.
 *
 * @param id Session identifier.
 * @param ticketId Kuji ticket drawn; `null` for unlimited draws.
 * @param campaignId Parent campaign.
 * @param playerId The drawing player.
 * @param animationMode Client-side animation type (e.g. `TEAR`, `SCRATCH`, `FLIP`).
 * @param resultGrade Hidden prize grade — revealed only on [isRevealed].
 * @param resultPrizeName Hidden prize name.
 * @param resultPhotoUrl Optional hidden prize photo URL.
 * @param resultPrizeInstanceId Hidden prize instance foreign key.
 * @param progress Latest progress value relayed from the client (0.0–1.0).
 * @param isRevealed `true` after the result has been broadcast to spectators.
 * @param isCancelled `true` if the player cancelled mid-animation.
 * @param startedAt Server-side creation time.
 * @param revealedAt Timestamp of result reveal; `null` until revealed.
 * @param cancelledAt Timestamp of cancellation; `null` unless cancelled.
 */
public data class DrawSyncSession(
    val id: UUID,
    val ticketId: UUID?,
    val campaignId: UUID,
    val playerId: UUID,
    val animationMode: String,
    val resultGrade: String?,
    val resultPrizeName: String?,
    val resultPhotoUrl: String?,
    val resultPrizeInstanceId: UUID?,
    val progress: Float,
    val isRevealed: Boolean,
    val isCancelled: Boolean,
    val startedAt: Instant,
    val revealedAt: Instant?,
    val cancelledAt: Instant?,
)
