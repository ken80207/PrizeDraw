package com.prizedraw.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ExitToApp
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prizedraw.components.user.UserProfileRow
import com.prizedraw.i18n.S

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

private data class SidebarNavItem(
    val labelKey: String,
    val icon: ImageVector,
    val route: String,
)

private val SIDEBAR_NAV_ITEMS = listOf(
    SidebarNavItem(labelKey = "nav.home", icon = Icons.Outlined.Home, route = "campaigns"),
    SidebarNavItem(labelKey = "nav.market", icon = Icons.Outlined.ShoppingCart, route = "trade"),
    SidebarNavItem(labelKey = "nav.leaderboard", icon = Icons.Outlined.Star, route = "leaderboard"),
    SidebarNavItem(labelKey = "nav.myPrizes", icon = Icons.Outlined.Favorite, route = "prizes"),
    SidebarNavItem(labelKey = "nav.wallet", icon = Icons.AutoMirrored.Outlined.List, route = "wallet"),
)

// ---------------------------------------------------------------------------
// Sidebar composable
// ---------------------------------------------------------------------------

/**
 * Tablet sidebar navigation composable (~200dp wide).
 *
 * Renders the app brand name at the top, five primary navigation items in the
 * body, and a bottom section that contains the user profile row plus
 * Settings, Support, and Logout actions.
 *
 * The active navigation item is highlighted with [MaterialTheme.colorScheme.primaryContainer]
 * background and [MaterialTheme.colorScheme.onPrimary] text / icon colour.
 *
 * @param currentRoute Route string of the currently selected tab (e.g. `"campaigns"`).
 * @param onNavigate Invoked with the target route when a nav item is tapped.
 * @param onNavigateToSettings Invoked when the Settings action is tapped.
 * @param onNavigateToSupport Invoked when the Support action is tapped.
 * @param onLogout Invoked when the Logout action is tapped.
 * @param userName Display name shown in [UserProfileRow].
 * @param userTier Tier label shown in [UserProfileRow]; empty string hides it.
 * @param userAvatarUrl Optional remote URL for the user avatar image.
 * @param modifier [Modifier] applied to the sidebar root column.
 */
@Composable
public fun Sidebar(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    onNavigateToSettings: () -> Unit,
    onNavigateToSupport: () -> Unit,
    onLogout: () -> Unit,
    userName: String = "",
    userTier: String = "",
    userAvatarUrl: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(200.dp)
            .fillMaxHeight()
            .background(MaterialTheme.colorScheme.surface)
            .padding(vertical = 16.dp),
    ) {
        // Brand name
        Text(
            text = S("brand.title"),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Main nav items
        SIDEBAR_NAV_ITEMS.forEach { item ->
            SidebarNavItemRow(
                item = item,
                isActive = currentRoute == item.route,
                onClick = { onNavigate(item.route) },
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        HorizontalDivider(
            modifier = Modifier.padding(horizontal = 16.dp),
            color = MaterialTheme.colorScheme.outlineVariant,
        )

        Spacer(modifier = Modifier.height(8.dp))

        // User profile row
        if (userName.isNotEmpty()) {
            UserProfileRow(
                nickname = userName,
                avatarUrl = userAvatarUrl,
                tierLabel = userTier.takeIf { it.isNotEmpty() },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        // Settings
        SidebarActionRow(
            label = S("nav.settings"),
            icon = Icons.Outlined.Settings,
            onClick = onNavigateToSettings,
        )

        // Support
        SidebarActionRow(
            label = S("nav.support"),
            icon = Icons.Outlined.Favorite,
            onClick = onNavigateToSupport,
        )

        // Logout
        SidebarActionRow(
            label = S("nav.logout"),
            icon = Icons.AutoMirrored.Outlined.ExitToApp,
            onClick = onLogout,
        )

        Spacer(modifier = Modifier.height(8.dp))
    }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

@Composable
private fun SidebarNavItemRow(
    item: SidebarNavItem,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    val backgroundModifier = if (isActive) {
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
    } else {
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
    }

    val contentColor = if (isActive) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

    Row(
        modifier = backgroundModifier
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        Icon(
            imageVector = item.icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(20.dp),
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = S(item.labelKey),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal,
            color = contentColor,
        )
    }
}

@Composable
private fun SidebarActionRow(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
