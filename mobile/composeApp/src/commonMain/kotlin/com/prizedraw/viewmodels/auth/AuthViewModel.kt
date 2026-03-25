package com.prizedraw.viewmodels.auth

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.viewmodels.base.BaseViewModel

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
}

/**
 * ViewModel driving the authentication MVI flow.
 *
 * TODO(T094): Implement after [com.prizedraw.domain.usecases.LoginUseCase] and
 *   [com.prizedraw.domain.usecases.BindPhoneUseCase] are wired in T093.
 *
 * @see AuthState
 * @see AuthIntent
 */
public class AuthViewModel : BaseViewModel<AuthState, AuthIntent>(AuthState.Idle) {
    override fun onIntent(intent: AuthIntent) {
        TODO("T094: implement MVI intent dispatch — Login, SendOtp, BindPhone, Logout")
    }
}
