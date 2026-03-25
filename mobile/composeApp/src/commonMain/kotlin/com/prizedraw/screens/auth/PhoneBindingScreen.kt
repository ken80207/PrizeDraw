package com.prizedraw.screens.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prizedraw.viewmodels.auth.AuthIntent
import com.prizedraw.viewmodels.auth.AuthState
import com.prizedraw.viewmodels.auth.AuthViewModel
import kotlinx.coroutines.delay

/** Resend cooldown duration in seconds. */
private const val RESEND_COOLDOWN_SECONDS = 60

/**
 * Phone binding screen with E.164 phone input, OTP code input, and a 60-second resend timer.
 *
 * - Tapping "Send OTP" dispatches [AuthIntent.SendOtp] and starts a 60-second countdown.
 * - Tapping "Verify" dispatches [AuthIntent.BindPhone] with the entered phone + OTP.
 * - On [AuthState.Authenticated] navigates to the home screen.
 *
 * TODO(T095): Add phone number format validation before dispatching SendOtp.
 */
@Composable
public fun PhoneBindingScreen(
    viewModel: AuthViewModel,
    onAuthenticated: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    var phone by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var resendCountdown by remember { mutableIntStateOf(0) }
    var otpSent by remember { mutableStateOf(false) }

    // Start countdown timer when OTP is dispatched
    LaunchedEffect(otpSent) {
        if (otpSent && resendCountdown <= 0) {
            resendCountdown = RESEND_COOLDOWN_SECONDS
            while (resendCountdown > 0) {
                delay(1_000)
                resendCountdown--
            }
        }
    }

    when (state) {
        is AuthState.Authenticated -> onAuthenticated()
        else -> Unit
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Verify Your Phone",
            style = MaterialTheme.typography.headlineMedium,
        )

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Phone Number (e.g. +886912345678)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            singleLine = true,
        )

        Spacer(Modifier.height(16.dp))

        if (otpSent) {
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = otp,
                onValueChange = { otp = it },
                label = { Text("6-digit OTP Code") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                singleLine = true,
            )

            Spacer(Modifier.height(8.dp))

            TextButton(
                onClick = {
                    if (resendCountdown <= 0) {
                        viewModel.onIntent(AuthIntent.SendOtp(phone))
                        otpSent = true
                    }
                },
                enabled = resendCountdown <= 0,
            ) {
                Text(
                    if (resendCountdown > 0) "Resend OTP in ${resendCountdown}s" else "Resend OTP",
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        if (state is AuthState.Loading) {
            CircularProgressIndicator()
        } else if (!otpSent) {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    viewModel.onIntent(AuthIntent.SendOtp(phone))
                    otpSent = true
                },
                enabled = phone.isNotBlank(),
            ) {
                Text("Send OTP")
            }
        } else {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    viewModel.onIntent(AuthIntent.BindPhone(phone, otp))
                },
                enabled = phone.isNotBlank() && otp.length == 6,
            ) {
                Text("Verify")
            }
        }

        if (state is AuthState.Error) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = (state as AuthState.Error).message,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
