package com.prizedraw.screens.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.List
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Describes one tab in the bottom navigation bar.
 *
 * @property label Text label displayed below the icon.
 * @property icon Material 3 [ImageVector] for the icon slot.
 * @property route Destination route string consumed by the nav graph.
 */
private data class BottomTab(
    val label: String,
    val icon: ImageVector,
    val route: String,
)

private val TABS =
    listOf(
        BottomTab(label = "Campaigns", icon = Icons.Outlined.Home, route = "campaigns"),
        BottomTab(label = "My Prizes", icon = Icons.Outlined.Star, route = "prizes"),
        BottomTab(label = "Marketplace", icon = Icons.Outlined.ShoppingCart, route = "trade"),
        BottomTab(label = "Wallet", icon = Icons.Outlined.List, route = "wallet"),
    )

/**
 * Home screen shell with a bottom [NavigationBar] (4 tabs) and a top app bar.
 *
 * The top bar shows the active tab title, a notifications bell icon, and a
 * settings gear icon. The content area is provided by [tabContent] so the
 * nav graph can swap in the appropriate screen composable per tab.
 *
 * TODO(T172): Replace the selected-tab index with a proper NavController
 *   back-stack and wire [onNavigateToSettings] / [onNavigateToNotifications]
 *   to their respective routes.
 *
 * @param tabContent Slot composable that receives the currently selected tab
 *   route string and renders the appropriate screen.
 * @param onNavigateToSettings Invoked when the settings icon is tapped.
 * @param onNavigateToNotifications Invoked when the bell icon is tapped.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun HomeScreen(
    onNavigateToSettings: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    tabContent: @Composable (route: String) -> Unit,
) {
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val currentTab = TABS[selectedTabIndex]

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = currentTab.label,
                        style = MaterialTheme.typography.titleLarge,
                    )
                },
                actions = {
                    IconButton(onClick = onNavigateToNotifications) {
                        Icon(
                            Icons.Filled.Notifications,
                            contentDescription = "Notifications",
                        )
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(
                            Icons.Filled.Settings,
                            contentDescription = "Settings",
                        )
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                TABS.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        icon = {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label) },
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
            tabContent(currentTab.route)
        }
    }
}
