package com.prizedraw.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Face
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prizedraw.components.button.PrimaryButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.i18n.S
import com.prizedraw.viewmodels.auth.AuthIntent
import com.prizedraw.viewmodels.auth.AuthState
import com.prizedraw.viewmodels.auth.AuthViewModel

private data class CountryCode(val code: String, val dialCode: String)

private val COUNTRY_CODES = listOf(
    CountryCode("TW", "+886"),
    CountryCode("US", "+1"),
    CountryCode("JP", "+81"),
    CountryCode("HK", "+852"),
)

/**
 * Login screen presenting the KUJI NOIR branded entry flow.
 *
 * Layout (centered card, max 400dp wide, on a dark surfaceDim background):
 * - Diamond logo + "KUJI NOIR" bold title + "THE ILLUMINATED GALLERY" subtitle in amber.
 * - Google sign-in full-width button + Apple / LINE icon buttons in a row.
 * - Divider with "OR CONTINUE WITH PHONE" label.
 * - Phone number field: country-code dropdown + phone input.
 * - Verification code field with "Get Code" trailing text button.
 * - [PrimaryButton]("Enter The Gallery →") full width.
 * - "New here? Register with phone" link.
 * - Footer: TERMS OF SERVICE + PRIVACY POLICY links (muted, small).
 *
 * Dispatches [AuthIntent.Login] when a provider button is tapped.
 * Navigates via [onNeedsPhoneBinding] / [onAuthenticated] based on [AuthState].
 *
 * TODO(T095): Wire up platform-specific OAuth SDKs via expect/actual:
 *   - Android: Google Sign-In SDK, Sign In with Apple SDK, LINE SDK
 *   - iOS: AuthenticationServices (Apple), Google Sign-In iOS, LINE SDK
 *
 * @param viewModel MVI ViewModel managing auth state.
 * @param onNeedsPhoneBinding Invoked when [AuthState.NeedsPhoneBinding] is emitted.
 * @param onAuthenticated Invoked when [AuthState.Authenticated] is emitted.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun LoginScreen(
    viewModel: AuthViewModel,
    onNeedsPhoneBinding: () -> Unit,
    onAuthenticated: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    when (state) {
        is AuthState.NeedsPhoneBinding -> onNeedsPhoneBinding()
        is AuthState.Authenticated -> onAuthenticated()
        else -> Unit
    }

    var phoneNumber by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    var selectedCountry by remember { mutableStateOf(COUNTRY_CODES.first()) }
    var countryExpanded by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surfaceDim),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 400.dp)
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Logo area
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
                    .padding(4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.AccountCircle,
                    contentDescription = "Logo",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(36.dp),
                )
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = "KUJI NOIR",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                letterSpacing = 4.sp,
            )
            Text(
                text = "THE ILLUMINATED GALLERY",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                letterSpacing = 2.sp,
            )

            Spacer(Modifier.height(32.dp))

            PrizeDrawCard {
                if (state is AuthState.Loading) {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(160.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                } else {
                    // Google full-width button
                    OutlinedButton(
                        onClick = {
                            // TODO(T095): launch Google Sign-In SDK → get idToken → dispatch
                            viewModel.onIntent(AuthIntent.Login(OAuthProvider.GOOGLE, "TODO:google-id-token"))
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = MaterialTheme.shapes.medium,
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                            contentColor = MaterialTheme.colorScheme.onSurface,
                        ),
                        border = null,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.AccountCircle,
                                contentDescription = "Google",
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "GOOGLE",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp,
                            )
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    // Apple + LINE row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        // Apple icon button
                        OutlinedButton(
                            onClick = {
                                // TODO(T095): launch Sign In with Apple → get identityToken → dispatch
                                viewModel.onIntent(AuthIntent.Login(OAuthProvider.APPLE, "TODO:apple-id-token"))
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = MaterialTheme.shapes.medium,
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                                contentColor = MaterialTheme.colorScheme.onSurface,
                            ),
                            border = null,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Face,
                                contentDescription = S("auth.continueWithApple"),
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        // LINE icon button
                        OutlinedButton(
                            onClick = {
                                // TODO(T095): launch LINE SDK → get idToken → dispatch
                                viewModel.onIntent(AuthIntent.Login(OAuthProvider.LINE, "TODO:line-id-token"))
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            shape = MaterialTheme.shapes.medium,
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                                contentColor = MaterialTheme.colorScheme.onSurface,
                            ),
                            border = null,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Email,
                                contentDescription = S("auth.continueWithLine"),
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Divider
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                        Text(
                            text = "OR CONTINUE WITH PHONE",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                    }

                    Spacer(Modifier.height(16.dp))

                    // Phone number label
                    Text(
                        text = "PHONE NUMBER",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(6.dp))

                    // Country code + phone field
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ExposedDropdownMenuBox(
                            expanded = countryExpanded,
                            onExpandedChange = { countryExpanded = !countryExpanded },
                        ) {
                            OutlinedTextField(
                                value = selectedCountry.dialCode,
                                onValueChange = {},
                                readOnly = true,
                                modifier = Modifier
                                    .width(96.dp)
                                    .menuAnchor(),
                                singleLine = true,
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = countryExpanded)
                                },
                                shape = MaterialTheme.shapes.medium,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                                ),
                            )
                            ExposedDropdownMenu(
                                expanded = countryExpanded,
                                onDismissRequest = { countryExpanded = false },
                            ) {
                                COUNTRY_CODES.forEach { country ->
                                    DropdownMenuItem(
                                        text = { Text("${country.code} ${country.dialCode}") },
                                        onClick = {
                                            selectedCountry = country
                                            countryExpanded = false
                                        },
                                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = phoneNumber,
                            onValueChange = { phoneNumber = it },
                            placeholder = { Text("080-0000-0000") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                            ),
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // Verification code
                    OutlinedTextField(
                        value = verificationCode,
                        onValueChange = { verificationCode = it },
                        placeholder = { Text("6-digit code") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = MaterialTheme.shapes.medium,
                        trailingIcon = {
                            TextButton(onClick = {}) {
                                Text(
                                    text = "Get Code",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                        ),
                    )

                    Spacer(Modifier.height(20.dp))

                    // Enter button
                    PrimaryButton(
                        text = "Enter The Gallery \u2192",
                        onClick = { /* TODO(T095): dispatch phone login */ },
                        fullWidth = true,
                        enabled = phoneNumber.isNotBlank() && verificationCode.isNotBlank(),
                    )

                    if (state is AuthState.Error) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = (state as AuthState.Error).message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // Register link
                    Text(
                        text = buildAnnotatedString {
                            withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)) {
                                append("New here? ")
                            }
                            withStyle(
                                SpanStyle(
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                            ) {
                                append("Register with phone")
                            }
                        },
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { },
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // Footer links
            Row(
                horizontalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Text(
                    text = "TERMS OF SERVICE",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.clickable { },
                )
                Text(
                    text = "PRIVACY POLICY",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.clickable { },
                )
            }
        }
    }
}
