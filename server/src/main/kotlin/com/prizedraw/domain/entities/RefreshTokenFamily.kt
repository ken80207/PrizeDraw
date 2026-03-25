package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Actor type for a refresh token family — either a player or a staff member.
 */
public enum class TokenActorType {
    PLAYER,
    STAFF,
}

/**
 * Represents a JWT refresh token family for token rotation with family-level revocation.
 *
 * Each login creates a new family. When a refresh token is used, a new token is issued
 * and the old one is invalidated. If a previously-consumed token is detected (replay attack),
 * the entire family is revoked immediately.
 *
 * @property id Surrogate primary key (row UUID).
 * @property familyToken Stable opaque identifier embedded in the refresh token sent to clients.
 * @property actorType Whether this family belongs to a player or a staff member.
 * @property playerId FK to the [Player] who owns this family. Non-null when [actorType] is PLAYER.
 * @property staffId FK to the Staff who owns this family. Non-null when [actorType] is STAFF.
 * @property currentTokenHash Bcrypt/SHA-256 hash of the currently-valid refresh token.
 * @property isRevoked True when the entire family has been revoked.
 * @property revokedAt Timestamp of family revocation.
 * @property expiresAt When the family itself expires (regardless of individual token rotation).
 * @property createdAt Creation timestamp (corresponds to login time).
 * @property updatedAt Last rotation timestamp.
 */
public data class RefreshTokenFamily(
    val id: UUID,
    val familyToken: String,
    val actorType: TokenActorType,
    val playerId: PlayerId?,
    val staffId: UUID?,
    val currentTokenHash: String,
    val isRevoked: Boolean,
    val revokedAt: Instant?,
    val expiresAt: Instant,
    val createdAt: Instant,
    val updatedAt: Instant,
)
