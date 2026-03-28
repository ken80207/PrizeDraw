package com.prizedraw.domain.services

import kotlin.random.Random

/**
 * Generates unique 8-character player codes from a safe alphanumeric charset.
 *
 * Excludes visually confusable characters: 0/O, 1/I/L.
 */
public object PlayerCodeGenerator {
    private const val CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    private const val CODE_LENGTH = 8

    /** Generates a random player code. Caller must check uniqueness. */
    public fun generate(): String =
        buildString(CODE_LENGTH) {
            repeat(CODE_LENGTH) {
                append(CHARSET[Random.nextInt(CHARSET.length)])
            }
        }
}
