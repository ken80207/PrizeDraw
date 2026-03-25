package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.valueobjects.PhoneNumber
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant

/**
 * Central user entity representing a registered player on the platform.
 *
 * Players authenticate exclusively via third-party OAuth2 providers. A phone number
 * binding via OTP is mandatory before core platform features (draw, trade, exchange,
 * buyback, withdrawal) are unlocked.
 *
 * Dual point balances ([drawPointsBalance] and [revenuePointsBalance]) are maintained
 * directly on this entity and protected by optimistic locking via [version].
 *
 * @property id Surrogate primary key.
 * @property nickname Display name shown in UI and on ticket boards.
 * @property avatarUrl CDN URL for the player's profile image. Null until set.
 * @property phoneNumber E.164-format phone number. Null until binding is completed.
 * @property phoneVerifiedAt Timestamp of successful OTP verification. Null until verified.
 * @property oauthProvider The OAuth2 provider used to authenticate.
 * @property oauthSubject Provider-issued user identifier (`sub` claim).
 * @property drawPointsBalance Current spendable draw points (消費點數). Non-negative.
 * @property revenuePointsBalance Current withdrawable revenue points (收益點數). Non-negative.
 * @property version Optimistic lock counter; incremented on every balance mutation.
 * @property preferredAnimationMode Player's default reveal animation.
 * @property locale BCP-47 locale code for i18n, e.g. `zh-TW`.
 * @property isActive False when the account is frozen/suspended.
 * @property deletedAt Soft-delete timestamp. Null for active accounts.
 * @property createdAt Account creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class Player(
    val id: PlayerId,
    val nickname: String,
    val avatarUrl: String?,
    val phoneNumber: PhoneNumber?,
    val phoneVerifiedAt: Instant?,
    val oauthProvider: OAuthProvider,
    val oauthSubject: String,
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
    val version: Int,
    val preferredAnimationMode: DrawAnimationMode,
    val locale: String,
    val isActive: Boolean,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /**
     * Returns true if the player has completed phone number binding and OTP verification.
     *
     * Both [phoneNumber] and [phoneVerifiedAt] must be non-null; a phone number stored
     * without a verification timestamp indicates an incomplete binding flow.
     */
    public fun isVerified(): Boolean = phoneNumber != null && phoneVerifiedAt != null

    /**
     * Returns true if this player may perform write operations on the platform.
     *
     * A player can use the platform only when:
     * - Phone verification is complete ([isVerified] returns true).
     * - The account is not suspended ([isActive] is true).
     * - The account has not been soft-deleted ([deletedAt] is null).
     */
    public fun canUsePlatform(): Boolean = isVerified() && isActive && deletedAt == null
}
