package com.prizedraw.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.i18n.S

private data class LanguageOption(
    val code: String,
    val label: String,
)

private val LANGUAGES =
    listOf(
        LanguageOption("zh-TW", "繁體中文"),
        LanguageOption("en", "English"),
        LanguageOption("ja", "日本語"),
    )

/**
 * Settings screen.
 *
 * Sections:
 * 1. **Draw Animation** — four radio buttons (Tear / Scratch / Flip / Instant)
 *    corresponding to [DrawAnimationMode] values.
 * 2. **Language** — [ExposedDropdownMenuBox] with supported locales.
 * 3. **About** — app version string.
 * 4. **Logout** — destructive button that invokes [onLogout].
 *
 * TODO(T171): Persist animation mode and language via
 *   PATCH /api/v1/players/me/preferences and store in local settings store.
 *
 * @param appVersion Version string shown in the About section (e.g. "1.0.0-beta").
 * @param onBack Invoked when the user taps the back arrow.
 * @param onLogout Invoked when the user confirms logout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun SettingsScreen(
    appVersion: String = "1.0.0",
    onBack: () -> Unit,
    onLogout: () -> Unit,
) {
    var selectedMode by remember { mutableStateOf(DrawAnimationMode.INSTANT) }
    var selectedLanguage by remember { mutableStateOf(LANGUAGES.first()) }
    var languageExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(S("settings.title")) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = S("common.back"))
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ---- Animation Mode ----------------------------------------
            SettingsSection(title = S("settings.drawAnimation")) {
                val modes =
                    listOf(
                        DrawAnimationMode.TEAR to S("settings.animationTear"),
                        DrawAnimationMode.SCRATCH to S("settings.animationScratch"),
                        DrawAnimationMode.FLIP to S("settings.animationFlip"),
                        DrawAnimationMode.INSTANT to S("settings.animationInstant"),
                    )
                modes.forEach { (mode, label) ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = selectedMode == mode,
                            onClick = { selectedMode = mode },
                        )
                        Text(
                            text = label,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }

            // ---- Language -----------------------------------------------
            SettingsSection(title = S("settings.language")) {
                ExposedDropdownMenuBox(
                    expanded = languageExpanded,
                    onExpandedChange = { languageExpanded = !languageExpanded },
                ) {
                    OutlinedTextField(
                        value = selectedLanguage.label,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(S("settings.displayLanguage")) },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageExpanded)
                        },
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                    )
                    ExposedDropdownMenu(
                        expanded = languageExpanded,
                        onDismissRequest = { languageExpanded = false },
                    ) {
                        LANGUAGES.forEach { lang ->
                            DropdownMenuItem(
                                text = { Text(lang.label) },
                                onClick = {
                                    selectedLanguage = lang
                                    languageExpanded = false
                                },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                            )
                        }
                    }
                }
            }

            // ---- About --------------------------------------------------
            SettingsSection(title = S("settings.about")) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = S("settings.appVersion"),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        text = appVersion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // ---- Logout -------------------------------------------------
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
            ) {
                Text(S("auth.logOut"))
            }
        }
    }
}

@Composable
private fun SettingsSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            content()
        }
    }
}
