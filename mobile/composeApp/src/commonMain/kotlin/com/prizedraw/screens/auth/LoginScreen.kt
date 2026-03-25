package com.prizedraw.screens.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.viewmodels.auth.AuthIntent
import com.prizedraw.viewmodels.auth.AuthState
import com.prizedraw.viewmodels.auth.AuthViewModel

/**
 * Login screen presenting Google, Apple, and LINE OAuth login buttons.
 *
 * Dispatches [AuthIntent.Login] when a provider button is tapped.
 * Transitions to [LoginScreen] → [PhoneBindingScreen] when the server
 * returns [AuthState.NeedsPhoneBinding].
 *
 * TODO(T095): Wire up platform-specific OAuth SDKs via expect/actual:
 *   - Android: Google Sign-In SDK, Sign In with Apple SDK, LINE SDK
 *   - iOS: AuthenticationServices (Apple), Google Sign-In iOS, LINE SDK
 */
@Composable
public fun LoginScreen(
    viewModel: AuthViewModel,
    onNeedsPhoneBinding: () -> Unit,
    onAuthenticated: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    when (val currentState = state) {
        is AuthState.NeedsPhoneBinding -> onNeedsPhoneBinding()
        is AuthState.Authenticated -> onAuthenticated()
        else -> Unit
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "PrizeDraw",
            style = MaterialTheme.typography.headlineLarge,
        )

        Spacer(Modifier.height(48.dp))

        if (state is AuthState.Loading) {
            CircularProgressIndicator()
        } else {
            // Google login button
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    // TODO(T095): launch Google Sign-In SDK → get idToken → dispatch
                    viewModel.onIntent(AuthIntent.Login(OAuthProvider.GOOGLE, "TODO:google-id-token"))
                },
            ) {
                Text("Continue with Google")
            }

            Spacer(Modifier.height(16.dp))

            // Apple login button
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    // TODO(T095): launch Sign In with Apple → get identityToken → dispatch
                    viewModel.onIntent(AuthIntent.Login(OAuthProvider.APPLE, "TODO:apple-id-token"))
                },
            ) {
                Text("Continue with Apple")
            }

            Spacer(Modifier.height(16.dp))

            // LINE login button
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    // TODO(T095): launch LINE SDK → get idToken → dispatch
                    viewModel.onIntent(AuthIntent.Login(OAuthProvider.LINE, "TODO:line-id-token"))
                },
            ) {
                Text("Continue with LINE")
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
}
