package com.prizedraw.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.prizedraw.i18n.S

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

private data class ShellNavItem(
    val labelKey: String,
    val icon: ImageVector,
    val route: String,
)

private val SHELL_NAV_ITEMS =
    listOf(
        ShellNavItem(labelKey = "nav.home", icon = Icons.Outlined.Home, route = "campaigns"),
        ShellNavItem(labelKey = "nav.market", icon = Icons.Outlined.ShoppingCart, route = "trade"),
        ShellNavItem(labelKey = "nav.leaderboard", icon = Icons.Outlined.Star, route = "leaderboard"),
        ShellNavItem(labelKey = "nav.myPrizes", icon = Icons.Outlined.Favorite, route = "prizes"),
        ShellNavItem(labelKey = "nav.wallet", icon = Icons.AutoMirrored.Outlined.List, route = "wallet"),
    )

// ---------------------------------------------------------------------------
// AppShell composable
// ---------------------------------------------------------------------------

/**
 * Adaptive application shell that switches between phone and tablet layouts
 * based on the current window width.
 *
 * **Phone (< 600dp):** Renders a [Scaffold] with a [TopAppBar] (app name +
 * notification bell + profile avatar) and a five-item [NavigationBar] at the
 * bottom. The [content] slot fills the inner padding area.
 *
 * **Tablet (>= 600dp):** Renders a [Row] containing a [Sidebar] (~200dp) on
 * the left and the [content] slot filling the remaining width.
 *
 * @param currentRoute Route string of the currently active tab (e.g. `"campaigns"`).
 * @param onNavigate Invoked with the route when a nav item is selected.
 * @param onNavigateToSettings Invoked when the settings action is triggered.
 * @param onNavigateToSupport Invoked when the support action is triggered.
 * @param onNavigateToNotifications Invoked when the notification bell is tapped (phone only).
 * @param onLogout Invoked when the logout action is triggered (tablet sidebar only).
 * @param userName Display name for the signed-in user.
 * @param userTier Tier label for the signed-in user; empty string hides the label.
 * @param userAvatarUrl Optional remote URL for the user avatar image.
 * @param content Content slot composable rendered inside the shell's main area.
 */
@Composable
public fun AppShell(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToSupport: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onLogout: () -> Unit,
    userName: String = "",
    userTier: String = "",
    userAvatarUrl: String? = null,
    content: @Composable () -> Unit,
) {
    androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val sizeClass = rememberWindowWidthSizeClass(maxWidth)
        if (sizeClass == WindowWidthSizeClass.Compact) {
            PhoneShell(
                currentRoute = currentRoute,
                onNavigate = onNavigate,
                onNavigateToNotifications = onNavigateToNotifications,
                content = content,
            )
        } else {
            TabletShell(
                currentRoute = currentRoute,
                onNavigate = onNavigate,
                onNavigateToSettings = onNavigateToSettings,
                onNavigateToSupport = onNavigateToSupport,
                onLogout = onLogout,
                userName = userName,
                userTier = userTier,
                userAvatarUrl = userAvatarUrl,
                content = content,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Phone shell
// ---------------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PhoneShell(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    onNavigateToNotifications: () -> Unit,
    content: @Composable () -> Unit,
) {
    val currentItem = SHELL_NAV_ITEMS.firstOrNull { it.route == currentRoute }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = S("brand.title"),
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            imageVector = Icons.Filled.Notifications,
                            contentDescription = S("nav.notifications"),
                        )
                    }
                    // Profile avatar placeholder — size matches typical avatar button
                    Box(
                        modifier =
                            Modifier
                                .padding(end = 8.dp)
                                .size(36.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        // TODO(T220): replace with UserAvatarButton once profile state is available
                        Icon(
                            imageVector = Icons.Outlined.Favorite,
                            contentDescription = S("nav.my"),
                            tint = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                SHELL_NAV_ITEMS.forEach { item ->
                    NavigationBarItem(
                        selected = currentRoute == item.route,
                        onClick = { onNavigate(item.route) },
                        icon = {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = S(item.labelKey),
                            )
                        },
                        label = { Text(S(item.labelKey)) },
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            contentAlignment = Alignment.TopStart,
        ) {
            content()
        }
    }
}

// ---------------------------------------------------------------------------
// Tablet shell
// ---------------------------------------------------------------------------

@Composable
private fun TabletShell(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToSupport: () -> Unit,
    onLogout: () -> Unit,
    userName: String,
    userTier: String,
    userAvatarUrl: String?,
    content: @Composable () -> Unit,
) {
    Row(modifier = Modifier.fillMaxSize()) {
        Sidebar(
            currentRoute = currentRoute,
            onNavigate = onNavigate,
            onNavigateToSettings = onNavigateToSettings,
            onNavigateToSupport = onNavigateToSupport,
            onLogout = onLogout,
            userName = userName,
            userTier = userTier,
            userAvatarUrl = userAvatarUrl,
        )
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxSize(),
            contentAlignment = Alignment.TopStart,
        ) {
            content()
        }
    }
}
