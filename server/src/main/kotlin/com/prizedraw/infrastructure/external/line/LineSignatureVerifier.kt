package com.prizedraw.infrastructure.external.line

import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Verifies HMAC-SHA256 signatures on incoming LINE webhook requests.
 *
 * LINE signs each webhook delivery with HMAC-SHA256 using the channel secret as the key.
 * The signature is base64-encoded and delivered in the `X-Line-Signature` header.
 *
 * Reference: https://developers.line.biz/en/reference/messaging-api/#webhooks
 *
 * @param channelSecret The LINE channel secret from the LINE Developers console.
 */
public class LineSignatureVerifier(
    private val channelSecret: String,
) {
    /**
     * Verifies that [signature] matches the HMAC-SHA256 digest of [body] using [channelSecret].
     *
     * @param body The raw request body bytes (must be the unmodified bytes as received).
     * @param signature The base64-encoded signature from the `X-Line-Signature` header.
     * @return True when the signature is valid; false otherwise.
     */
    public fun verify(
        body: ByteArray,
        signature: String,
    ): Boolean {
        if (signature.isBlank()) {
            return false
        }
        return runCatching {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(channelSecret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
            val computed = Base64.getEncoder().encodeToString(mac.doFinal(body))
            computed == signature
        }.getOrDefault(false)
    }
}
