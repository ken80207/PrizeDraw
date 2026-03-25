package com.prizedraw.domain.valueobjects

/**
 * Represents a non-negative integer point amount used as currency in the platform.
 *
 * All monetary values are stored as integer points to avoid floating-point precision issues.
 * This type enforces the invariant that a point balance or price cannot be negative.
 *
 * @property points The point amount. Must be non-negative.
 * @throws IllegalArgumentException if [points] is negative.
 */
@JvmInline
public value class Money(
    public val points: Int,
) {
    init {
        require(points >= 0) { "Money amount cannot be negative, was: $points" }
    }

    /** Returns a new [Money] instance representing the sum of this and [other]. */
    public operator fun plus(other: Money): Money = Money(points + other.points)

    /**
     * Returns a new [Money] instance representing the difference of this and [other].
     * @throws IllegalArgumentException if the result would be negative.
     */
    public operator fun minus(other: Money): Money = Money(points - other.points)

    /** Returns true if this amount is zero. */
    public fun isZero(): Boolean = points == 0

    override fun toString(): String = "$points pts"
}
