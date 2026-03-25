package com.prizedraw.domain.valueobjects

/**
 * Represents a signed integer amount used in ledger transactions (draw or revenue points).
 *
 * Unlike [Money], a [PointAmount] may be negative to represent a debit entry.
 * The value must be non-zero; zero-amount transactions are meaningless and rejected.
 *
 * @property amount The signed point amount. Must be non-zero.
 * @throws IllegalArgumentException if [amount] is zero.
 */
@JvmInline
public value class PointAmount(
    public val amount: Int,
) {
    init {
        require(amount != 0) { "PointAmount must be non-zero" }
    }

    /** Returns true if this is a credit (positive) amount. */
    public fun isCredit(): Boolean = amount > 0

    /** Returns true if this is a debit (negative) amount. */
    public fun isDebit(): Boolean = amount < 0

    /** Returns the absolute value as a [Money] instance. */
    public fun absoluteMoney(): Money = Money(kotlin.math.abs(amount))

    override fun toString(): String =
        if (isCredit()) {
            "+$amount pts"
        } else {
            "$amount pts"
        }

    public companion object {
        /** Creates a credit (positive) [PointAmount]. */
        public fun credit(points: Int): PointAmount {
            require(points > 0) { "Credit amount must be positive, was: $points" }
            return PointAmount(points)
        }

        /** Creates a debit (negative) [PointAmount]. */
        public fun debit(points: Int): PointAmount {
            require(points > 0) { "Debit amount must be a positive value representing the magnitude, was: $points" }
            return PointAmount(-points)
        }
    }
}
