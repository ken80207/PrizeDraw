package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Represents a unidirectional follow relationship (fan model).
 *
 * [followerId] follows [followingId]. No approval required.
 *
 * @property id Surrogate primary key.
 * @property followerId The player who follows.
 * @property followingId The player being followed.
 * @property createdAt Timestamp when the follow was created.
 */
public data class Follow(
    val id: UUID = UUID.randomUUID(),
    val followerId: UUID,
    val followingId: UUID,
    val createdAt: Instant,
)
