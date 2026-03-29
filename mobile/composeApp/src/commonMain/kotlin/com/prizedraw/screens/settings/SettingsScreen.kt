package com.prizedraw.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prizedraw.components.button.PrizeDrawOutlinedButton
import com.prizedraw.components.card.PrizeDrawCard
import com.prizedraw.components.chip.StatusChip
import com.prizedraw.components.layout.SectionHeader
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.i18n.S
import com.prizedraw.navigation.WindowWidthSizeClass
import com.prizedraw.navigation.rememberWindowWidthSizeClass

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

private data class AnimationOption(
    val mode: DrawAnimationMode,
    val label: String,
    val icon: ImageVector,
)

/**
 * Settings screen.
 *
 * Sections:
 * 1. **Profile** — large avatar with edit overlay, nickname/phone fields, bio textarea.
 * 2. **Animation Preferences** — four icon options (Scratch Card, Tear Tape, Card Flip, Fast Mode).
 * 3. **App Settings** — language dropdown, theme mode toggle, notification switches.
 * 4. **Security** — change password, linked accounts, logout.
 *
 * On tablet (width >= 600dp) a two-column layout places the profile + animation sections
 * on the left and app settings + security on the right.
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
    var selectedMode by remember { mutableStateOf(DrawAnimationMode.SCRATCH) }
    var selectedLanguage by remember { mutableStateOf(LANGUAGES.first()) }
    var languageExpanded by remember { mutableStateOf(false) }
    var nickname by remember { mutableStateOf("Kaito_Arisaka") }
    var phone by remember { mutableStateOf("+886 912 *** 789") }
    var bio by remember { mutableStateOf("Passionate collector of rare vinyl figures and neo-tokyo cyberpunk aesthetic. Always looking for A-Tier prizes.") }
    var notifyNewLotteries by remember { mutableStateOf(true) }
    var notifyBigPrize by remember { mutableStateOf(true) }
    var notifyTradeRequests by remember { mutableStateOf(false) }
    var isDarkMode by remember { mutableStateOf(true) }

    val animationOptions = listOf(
        AnimationOption(DrawAnimationMode.SCRATCH, S("settings.animationScratch"), Icons.Filled.Edit),
        AnimationOption(DrawAnimationMode.TEAR, S("settings.animationTear"), Icons.Filled.Refresh),
        AnimationOption(DrawAnimationMode.FLIP, S("settings.animationFlip"), Icons.Filled.Face),
        AnimationOption(DrawAnimationMode.INSTANT, S("settings.animationInstant"), Icons.Filled.Build),
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = S("settings.title"),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Tailor your gallery experience and account security.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = S("common.back"),
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            val sizeClass = rememberWindowWidthSizeClass(maxWidth)
            val isTablet = sizeClass == WindowWidthSizeClass.Medium

            if (isTablet) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 24.dp, vertical = 16.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        ProfileSection(nickname, phone, bio, onNicknameChange = { nickname = it })
                        AnimationPreferencesSection(selectedMode, animationOptions) { selectedMode = it }
                    }
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        AppSettingsSection(
                            selectedLanguage = selectedLanguage,
                            languageExpanded = languageExpanded,
                            isDarkMode = isDarkMode,
                            notifyNewLotteries = notifyNewLotteries,
                            notifyBigPrize = notifyBigPrize,
                            notifyTradeRequests = notifyTradeRequests,
                            onLanguageExpanded = { languageExpanded = it },
                            onLanguageSelected = { selectedLanguage = it; languageExpanded = false },
                            onThemeToggle = { isDarkMode = it },
                            onNotifyNewLotteries = { notifyNewLotteries = it },
                            onNotifyBigPrize = { notifyBigPrize = it },
                            onNotifyTradeRequests = { notifyTradeRequests = it },
                        )
                        SecuritySection(onLogout = onLogout)
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    ProfileSection(nickname, phone, bio, onNicknameChange = { nickname = it })
                    AnimationPreferencesSection(selectedMode, animationOptions) { selectedMode = it }
                    AppSettingsSection(
                        selectedLanguage = selectedLanguage,
                        languageExpanded = languageExpanded,
                        isDarkMode = isDarkMode,
                        notifyNewLotteries = notifyNewLotteries,
                        notifyBigPrize = notifyBigPrize,
                        notifyTradeRequests = notifyTradeRequests,
                        onLanguageExpanded = { languageExpanded = it },
                        onLanguageSelected = { selectedLanguage = it; languageExpanded = false },
                        onThemeToggle = { isDarkMode = it },
                        onNotifyNewLotteries = { notifyNewLotteries = it },
                        onNotifyBigPrize = { notifyBigPrize = it },
                        onNotifyTradeRequests = { notifyTradeRequests = it },
                    )
                    SecuritySection(onLogout = onLogout)
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun ProfileSection(
    nickname: String,
    phone: String,
    bio: String,
    onNicknameChange: (String) -> Unit,
) {
    PrizeDrawCard {
        // Avatar with edit overlay
        Box(
            modifier = Modifier
                .size(72.dp)
                .align(Alignment.CenterHorizontally),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = nickname.take(1).uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .align(Alignment.BottomEnd),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Edit,
                    contentDescription = "Edit avatar",
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Text(
            text = nickname,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )
        Text(
            text = "PREMIUM MEMBER SINCE 2023",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        )

        Spacer(Modifier.height(16.dp))

        // Nickname + Phone row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = nickname,
                onValueChange = onNicknameChange,
                label = { Text("NICKNAME", style = MaterialTheme.typography.labelSmall) },
                modifier = Modifier.weight(1f),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                ),
            )
            Column(modifier = Modifier.weight(1f)) {
                OutlinedTextField(
                    value = phone,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("PHONE NUMBER", style = MaterialTheme.typography.labelSmall) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    trailingIcon = {
                        StatusChip(status = "VERIFIED")
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    ),
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = bio,
            onValueChange = {},
            label = { Text("BIO", style = MaterialTheme.typography.labelSmall) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 4,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            ),
        )
    }
}

@Composable
private fun AnimationPreferencesSection(
    selectedMode: DrawAnimationMode,
    options: List<AnimationOption>,
    onModeSelected: (DrawAnimationMode) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title = S("settings.drawAnimation"))
        PrizeDrawCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                options.forEach { option ->
                    val isSelected = selectedMode == option.mode
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clickable { onModeSelected(option.mode) }
                            .padding(8.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isSelected) {
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                                    } else {
                                        MaterialTheme.colorScheme.surfaceContainerHigh
                                    },
                                ).then(
                                    if (isSelected) {
                                        Modifier.border(
                                            2.dp,
                                            MaterialTheme.colorScheme.primary,
                                            CircleShape,
                                        )
                                    } else {
                                        Modifier
                                    },
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = option.icon,
                                contentDescription = option.label,
                                tint = if (isSelected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                                modifier = Modifier.size(24.dp),
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = option.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isSelected) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppSettingsSection(
    selectedLanguage: LanguageOption,
    languageExpanded: Boolean,
    isDarkMode: Boolean,
    notifyNewLotteries: Boolean,
    notifyBigPrize: Boolean,
    notifyTradeRequests: Boolean,
    onLanguageExpanded: (Boolean) -> Unit,
    onLanguageSelected: (LanguageOption) -> Unit,
    onThemeToggle: (Boolean) -> Unit,
    onNotifyNewLotteries: (Boolean) -> Unit,
    onNotifyBigPrize: (Boolean) -> Unit,
    onNotifyTradeRequests: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title = "App Settings")
        PrizeDrawCard {
            // Language
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = S("settings.language"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                ExposedDropdownMenuBox(
                    expanded = languageExpanded,
                    onExpandedChange = { onLanguageExpanded(!languageExpanded) },
                ) {
                    Row(
                        modifier = Modifier
                            .menuAnchor()
                            .clickable { onLanguageExpanded(!languageExpanded) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            text = selectedLanguage.label,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageExpanded)
                    }
                    ExposedDropdownMenu(
                        expanded = languageExpanded,
                        onDismissRequest = { onLanguageExpanded(false) },
                    ) {
                        LANGUAGES.forEach { lang ->
                            DropdownMenuItem(
                                text = { Text(lang.label) },
                                onClick = { onLanguageSelected(lang) },
                                contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                            )
                        }
                    }
                }
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.outlineVariant,
            )

            // Theme Mode
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Theme Mode",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Lock,
                        contentDescription = "Dark",
                        tint = if (isDarkMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                    Switch(
                        checked = !isDarkMode,
                        onCheckedChange = { onThemeToggle(!it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                            checkedTrackColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                    Icon(
                        imageVector = Icons.Filled.Settings,
                        contentDescription = "Light",
                        tint = if (!isDarkMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.outlineVariant,
            )

            // Notifications header
            Text(
                text = "NOTIFICATIONS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )

            NotificationToggle(
                label = "New Lotteries",
                checked = notifyNewLotteries,
                onCheckedChange = onNotifyNewLotteries,
            )
            Spacer(Modifier.height(4.dp))
            NotificationToggle(
                label = "Big Prize Alerts",
                checked = notifyBigPrize,
                onCheckedChange = onNotifyBigPrize,
            )
            Spacer(Modifier.height(4.dp))
            NotificationToggle(
                label = "Trade Requests",
                checked = notifyTradeRequests,
                onCheckedChange = onNotifyTradeRequests,
            )
        }
    }
}

@Composable
private fun NotificationToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                checkedTrackColor = MaterialTheme.colorScheme.primary,
            ),
        )
    }
}

@Composable
private fun SecuritySection(onLogout: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title = "Security")
        PrizeDrawCard {
            // Change Password
            Text(
                text = "Change Password",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { },
            )

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(Modifier.height(12.dp))

            // Linked accounts
            Text(
                text = "LINKED ACCOUNTS",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LinkedAccountButton(label = "", icon = Icons.Filled.Face)
                LinkedAccountButton(label = "G", icon = null)
                LinkedAccountButton(label = "L", icon = null)
            }

            Spacer(Modifier.height(16.dp))

            // Logout button
            PrizeDrawOutlinedButton(
                text = "${S("auth.logOut")} Account",
                onClick = onLogout,
                fullWidth = true,
            )
        }
    }
}

@Composable
private fun LinkedAccountButton(
    label: String,
    icon: ImageVector?,
) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .clickable { },
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
