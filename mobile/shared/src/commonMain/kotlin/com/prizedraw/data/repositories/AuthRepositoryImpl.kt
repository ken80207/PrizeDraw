package com.prizedraw.data.repositories

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.data.local.AuthTokenStore
import com.prizedraw.data.remote.AuthRemoteDataSource
import com.prizedraw.domain.repositories.IAuthRepository

/**
 * Concrete implementation of [IAuthRepository].
 *
 * Orchestrates [AuthRemoteDataSource] for network calls and [AuthTokenStore] for
 * local token persistence.
 *
 * TODO(T092): Complete implementation after HttpClient and DataStore are wired.
 */
public class AuthRepositoryImpl(
    private val remoteDataSource: AuthRemoteDataSource,
    private val tokenStore: AuthTokenStore,
) : IAuthRepository {
    override suspend fun login(
        provider: OAuthProvider,
        idToken: String,
    ): PlayerDto {
        TODO("T092: call remoteDataSource.login + store tokens + fetch player profile")
    }

    override suspend fun sendOtp(phoneNumber: String) {
        TODO("T092: call remoteDataSource.sendOtp")
    }

    override suspend fun bindPhone(
        phoneNumber: String,
        otpCode: String,
    ): PlayerDto {
        TODO("T092: call remoteDataSource.bindPhone + return updated player")
    }

    override suspend fun logout() {
        TODO("T092: call remoteDataSource.logout + tokenStore.clearTokens")
    }

    override suspend fun refreshToken(): Boolean {
        TODO("T092: call remoteDataSource.refresh + update tokenStore")
    }

    override suspend fun getAccessToken(): String? = tokenStore.getAccessToken()
}
