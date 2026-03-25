package com.prizedraw.application.usecases.auth

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.auth.IBindPhoneUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.auth.PhoneBindRequest
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.valueobjects.PhoneNumber
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.external.redis.RedisClient
import kotlinx.coroutines.future.await
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.security.MessageDigest
import java.util.UUID

/**
 * Verifies the phone OTP and completes the phone-binding flow for a player.
 *
 * Steps:
 * 1. Load the player; throw [PlayerNotFoundException] if not found.
 * 2. Parse and validate the phone number format.
 * 3. Verify the OTP against the SHA-256 hash stored in Redis at `otp:{phone}`.
 * 4. Check that no other player already holds this phone number.
 * 5. Update the player with phone, phoneVerifiedAt, and isActive=true.
 * 6. Record an [AuditLog] entry.
 */
public class BindPhoneUseCase(
    private val playerRepository: IPlayerRepository,
    private val redisClient: RedisClient,
    private val auditRepository: IAuditRepository,
) : IBindPhoneUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        request: PhoneBindRequest,
    ): PlayerDto {
        val player =
            playerRepository.findById(playerId)
                ?: throw PlayerNotFoundException("Player $playerId not found")

        val phone =
            runCatching { PhoneNumber(request.phoneNumber) }.getOrElse {
                throw OtpInvalidException("Invalid phone number format: ${request.phoneNumber}")
            }

        verifyOtp(phone.value, request.otpCode)

        val existing = playerRepository.findByPhone(phone)
        if (existing != null && existing.id != playerId) {
            throw PhoneAlreadyBoundException("Phone number ${phone.value} is already bound to another account")
        }

        val now = Clock.System.now()
        val updated =
            playerRepository.save(
                player.copy(
                    phoneNumber = phone,
                    phoneVerifiedAt = now,
                    isActive = true,
                    updatedAt = now,
                ),
            )

        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.PLAYER,
                actorPlayerId = playerId,
                actorStaffId = null,
                action = "auth.phone_bound",
                entityType = "Player",
                entityId = playerId.value,
                beforeValue =
                    buildJsonObject {
                        put("isActive", player.isActive)
                        put("phoneNumber", player.phoneNumber?.value)
                    },
                afterValue =
                    buildJsonObject {
                        put("isActive", true)
                        put("phoneNumber", phone.value)
                    },
                metadata = buildJsonObject {},
                createdAt = now,
            ),
        )

        return updated.toDto()
    }

    private suspend fun verifyOtp(
        phone: String,
        otpCode: String,
    ) {
        val otpKey = "otp:$phone"
        val storedHash =
            redisClient.withConnection { commands ->
                commands.get(otpKey).await()
            } ?: throw OtpInvalidException("OTP expired or not found for $phone")

        val presentedHash = sha256Hex(otpCode)
        if (presentedHash != storedHash) {
            throw OtpInvalidException("Invalid OTP code for $phone")
        }

        // Consume the OTP so it cannot be replayed
        redisClient.withConnection { commands ->
            commands.del(otpKey).await()
        }
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest
            .digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }
}
