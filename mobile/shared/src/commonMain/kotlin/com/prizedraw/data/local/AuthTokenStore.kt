package com.prizedraw.data.local

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * In-memory token storage for development.
 *
 * Production implementation (T092) will use DataStore with EncryptedPreferences
 * on Android and iOS Keychain on iOS.
 */
public class AuthTokenStore {
    private var _accessToken: String? = null
    private var _refreshToken: String? = null
    private val _isLoggedIn = MutableStateFlow(false)

    /** Observable login state. */
    public val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    /**
     * Persists the access and refresh token pair.
     */
    public suspend fun saveTokens(
        accessToken: String,
        refreshToken: String,
    ) {
        _accessToken = accessToken
        _refreshToken = refreshToken
        _isLoggedIn.value = true
    }

    /**
     * Returns the stored access token, or null if no session exists.
     */
    public suspend fun getAccessToken(): String? = _accessToken

    /**
     * Returns the stored refresh token, or null if no session exists.
     */
    public suspend fun getRefreshToken(): String? = _refreshToken

    /**
     * Clears all stored tokens (used on logout).
     */
    public suspend fun clearTokens() {
        _accessToken = null
        _refreshToken = null
        _isLoggedIn.value = false
    }
}
