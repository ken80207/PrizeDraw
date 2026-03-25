package com.prizedraw.data.local

/**
 * Encrypted local storage for JWT access and refresh tokens.
 *
 * Uses DataStore with EncryptedPreferences on Android and iOS Keychain on iOS
 * to persist tokens securely across app restarts.
 *
 * TODO(T092): Implement with DataStore Preferences + encryption:
 *   - Android: `androidx.datastore.preferences.core.Preferences` + `EncryptedSharedPreferences`
 *   - iOS: `NSUserDefaults` + `SecKeychain` via expect/actual
 */
public class AuthTokenStore {
    /**
     * Persists the access and refresh token pair.
     *
     * @param accessToken The JWT access token.
     * @param refreshToken The opaque `familyToken:rawToken` refresh token.
     */
    public suspend fun saveTokens(
        accessToken: String,
        refreshToken: String,
    ) {
        TODO("T092: implement DataStore encrypted token persistence")
    }

    /**
     * Returns the stored access token, or null if no session exists.
     */
    public suspend fun getAccessToken(): String? {
        TODO("T092: implement DataStore read")
    }

    /**
     * Returns the stored refresh token, or null if no session exists.
     */
    public suspend fun getRefreshToken(): String? {
        TODO("T092: implement DataStore read")
    }

    /**
     * Clears all stored tokens (used on logout).
     */
    public suspend fun clearTokens() {
        TODO("T092: implement DataStore clear")
    }
}
