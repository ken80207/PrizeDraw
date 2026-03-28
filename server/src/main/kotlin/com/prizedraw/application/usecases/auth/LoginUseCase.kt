package com.prizedraw.application.usecases.auth

import com.prizedraw.application.ports.input.auth.ILoginUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.OAuthValidationResult
import com.prizedraw.application.services.TokenService
import com.prizedraw.contracts.dto.auth.LoginRequest
import com.prizedraw.contracts.dto.auth.TokenResponse
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.services.PlayerCodeGenerator
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Implements the social login flow.
 *
 * 1. Validates the OAuth ID token via [IOAuthTokenValidator].
 * 2. Finds an existing [Player] by `(provider, subject)` or creates a new one.
 * 3. New players are created with [Player.isActive] = false — pending phone binding.
 * 4. Issues a [TokenService.TokenPair] via [TokenService.createTokenPair].
 * 5. Records an [AuditLog] entry for the login event.
 */
public class LoginUseCase(
    private val playerRepository: IPlayerRepository,
    private val oAuthTokenValidator: IOAuthTokenValidator,
    private val tokenService: TokenService,
    private val auditRepository: IAuditRepository,
) : ILoginUseCase {
    private val log = LoggerFactory.getLogger(LoginUseCase::class.java)

    @Suppress("TooGenericExceptionCaught")
    override suspend fun execute(request: LoginRequest): TokenResponse {
        val validationResult = validateOAuthToken(request)

        val existingPlayer = playerRepository.findByOAuth(request.provider, validationResult.subject)
        val player = existingPlayer ?: createNewPlayer(request, validationResult)

        val tokenPair = tokenService.createTokenPair(player.id)
        recordLoginAudit(player, request, isNewPlayer = existingPlayer == null)

        return TokenResponse(
            accessToken = tokenPair.accessToken,
            refreshToken = tokenPair.refreshToken,
            expiresIn = ACCESS_TOKEN_EXPIRES_IN_SECONDS,
            needsPhoneBinding = player.phoneNumber == null,
        )
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun validateOAuthToken(request: LoginRequest): OAuthValidationResult =
        try {
            oAuthTokenValidator.validate(request.provider, request.idToken)
        } catch (e: Exception) {
            throw AuthException("OAuth token validation failed: ${e.message}", e)
        }

    private suspend fun createNewPlayer(
        request: LoginRequest,
        validationResult: OAuthValidationResult,
    ): Player {
        val now = Clock.System.now()
        val nickname =
            validationResult.name
                ?: "Player-${UUID.randomUUID().toString().take(SHORT_ID_LENGTH)}"
        val playerCode = generateUniquePlayerCode()
        val newPlayer =
            Player(
                id = PlayerId.generate(),
                nickname = nickname,
                playerCode = playerCode,
                avatarUrl = null,
                phoneNumber = null,
                phoneVerifiedAt = null,
                oauthProvider = request.provider,
                oauthSubject = validationResult.subject,
                drawPointsBalance = 0,
                revenuePointsBalance = 0,
                version = 0,
                preferredAnimationMode = DrawAnimationMode.FLIP,
                locale = DEFAULT_LOCALE,
                isActive = false,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )
        log.info("Creating new player {} for OAuth provider {}", newPlayer.id, request.provider)
        return playerRepository.save(newPlayer)
    }

    private suspend fun recordLoginAudit(
        player: Player,
        request: LoginRequest,
        isNewPlayer: Boolean,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.PLAYER,
                actorPlayerId = player.id,
                actorStaffId = null,
                action = "auth.login",
                entityType = "Player",
                entityId = player.id.value,
                beforeValue = null,
                afterValue =
                    buildJsonObject {
                        put("provider", request.provider.name)
                        put("isActive", player.isActive)
                        put("isNewPlayer", isNewPlayer)
                    },
                metadata = buildJsonObject { put("provider", request.provider.name) },
                createdAt = Clock.System.now(),
            ),
        )
    }

    private suspend fun generateUniquePlayerCode(): String {
        repeat(MAX_CODE_RETRIES) {
            val code = PlayerCodeGenerator.generate()
            if (playerRepository.findByPlayerCode(code) == null) {
                return code
            }
        }
        error("Failed to generate unique player code after $MAX_CODE_RETRIES attempts")
    }

    private companion object {
        const val ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900L
        const val SHORT_ID_LENGTH = 8
        const val DEFAULT_LOCALE = "zh-TW"
        const val MAX_CODE_RETRIES = 5
    }
}
