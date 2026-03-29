package com.prizedraw.viewmodels.auth

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.viewmodels.base.BaseViewModel
import kotlinx.datetime.Clock

/**
 * MVI state for the authentication flow.
 */
public sealed class AuthState {
    /** Initial state before any action has been dispatched. */
    public data object Idle : AuthState()

    /** An async operation is in progress (login, OTP send, phone bind). */
    public data object Loading : AuthState()

    /**
     * OAuth login succeeded but the player has not yet bound a phone number.
     *
     * @property player The authenticated but inactive player.
     */
    public data class NeedsPhoneBinding(
        val player: PlayerDto,
    ) : AuthState()

    /**
     * Authentication and phone binding are complete.
     *
     * @property player The fully activated player profile.
     */
    public data class Authenticated(
        val player: PlayerDto,
    ) : AuthState()

    /**
     * An error occurred during authentication.
     *
     * @property message Human-readable error description.
     */
    public data class Error(
        val message: String,
    ) : AuthState()
}

/**
 * MVI intent for the authentication flow.
 */
public sealed class AuthIntent {
    /**
     * Initiates OAuth login for the specified provider.
     *
     * @property provider The OAuth2 provider chosen by the user.
     * @property idToken The raw provider-issued ID token from the native SDK.
     */
    public data class Login(
        val provider: OAuthProvider,
        val idToken: String,
    ) : AuthIntent()

    /**
     * Dispatches an OTP to the specified phone number.
     *
     * @property phoneNumber E.164-format phone number.
     */
    public data class SendOtp(
        val phoneNumber: String,
    ) : AuthIntent()

    /**
     * Submits the phone number + OTP code to complete phone binding.
     *
     * @property phoneNumber E.164-format phone number.
     * @property otpCode The 6-digit OTP code entered by the user.
     */
    public data class BindPhone(
        val phoneNumber: String,
        val otpCode: String,
    ) : AuthIntent()

    /** Revokes the current session and transitions back to [AuthState.Idle]. */
    public data object Logout : AuthIntent()

    /**
     * Dev-only: mock login as a predefined test player.
     *
     * @property playerId UUID of the mock player.
     * @property nickname Display name of the mock player.
     */
    public data class DevMockLogin(
        val playerId: String,
        val nickname: String,
    ) : AuthIntent()
}

/**
 * Dev mock players matching the seed data in the database.
 */
public data class DevPlayer(
    val id: String,
    val nickname: String,
)

public val DEV_PLAYERS: List<DevPlayer> =
    listOf(
        DevPlayer("00000000-0000-0000-0000-000000000001", "玩家小明"),
        DevPlayer("00000000-0000-0000-0000-000000000002", "玩家小花"),
        DevPlayer("00000000-0000-0000-0000-000000000003", "觀戰者小王"),
    )

/**
 * ViewModel driving the authentication MVI flow.
 *
 * Dev mock login is fully implemented. Real OAuth login (T094/T095) will be
 * wired once LoginUseCase and BindPhoneUseCase are implemented (T093).
 */
public class AuthViewModel : BaseViewModel<AuthState, AuthIntent>(AuthState.Idle) {
    override fun onIntent(intent: AuthIntent) {
        when (intent) {
            is AuthIntent.DevMockLogin -> {
                setState(AuthState.Loading)
                val player = PlayerDto(
                    id = intent.playerId,
                    playerCode = intent.playerId.takeLast(4),
                    nickname = intent.nickname,
                    avatarUrl = null,
                    phoneNumber = "+886900000001",
                    drawPointsBalance = 10000,
                    revenuePointsBalance = 500,
                    preferredAnimationMode = DrawAnimationMode.TEAR,
                    locale = "zh-TW",
                    isActive = true,
                    createdAt = Clock.System.now(),
                    followerCount = 0,
                    followingCount = 0,
                )
                setState(AuthState.Authenticated(player))
            }

            is AuthIntent.Login -> {
                setState(
                    AuthState.Error("OAuth login not yet implemented (T094/T095). Use dev mock login."),
                )
            }

            is AuthIntent.SendOtp -> {
                setState(AuthState.Error("OTP not yet implemented (T094)."))
            }

            is AuthIntent.BindPhone -> {
                setState(AuthState.Error("Phone binding not yet implemented (T094)."))
            }

            is AuthIntent.Logout -> {
                setState(AuthState.Idle)
            }
        }
    }
}
