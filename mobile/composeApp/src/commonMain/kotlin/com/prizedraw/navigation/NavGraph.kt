package com.prizedraw.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.prizedraw.contracts.dto.player.WalletDto
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.screens.auth.LoginScreen
import com.prizedraw.screens.auth.PhoneBindingScreen
import com.prizedraw.screens.campaign.CampaignListScreen
import com.prizedraw.screens.campaign.KujiBoardScreen
import com.prizedraw.screens.campaign.QueueScreen
import com.prizedraw.screens.campaign.UnlimitedDrawScreen
import com.prizedraw.screens.draw.DrawRevealScreen
import com.prizedraw.screens.exchange.ExchangeCounterProposeScreen
import com.prizedraw.screens.exchange.ExchangeOfferScreen
import com.prizedraw.screens.home.HomeScreen
import com.prizedraw.screens.leaderboard.LeaderboardScreen
import com.prizedraw.screens.prize.MyPrizesScreen
import com.prizedraw.screens.settings.SettingsScreen
import com.prizedraw.screens.support.CreateTicketScreen
import com.prizedraw.screens.support.SupportTicketListScreen
import com.prizedraw.screens.support.TicketDetailScreen
import com.prizedraw.screens.trade.MarketplaceScreen
import com.prizedraw.screens.wallet.WalletScreen
import com.prizedraw.screens.wallet.WithdrawalScreen
import com.prizedraw.viewmodels.auth.AuthViewModel
import com.prizedraw.viewmodels.campaign.KujiCampaignViewModel
import com.prizedraw.viewmodels.draw.UnlimitedDrawViewModel
import com.prizedraw.viewmodels.leaderboard.LeaderboardViewModel
import com.prizedraw.viewmodels.prize.PrizeInventoryViewModel
import com.prizedraw.viewmodels.support.SupportViewModel
import com.prizedraw.viewmodels.trade.MarketplaceViewModel

// ---------------------------------------------------------------------------
// Route constant object
// ---------------------------------------------------------------------------

/**
 * Canonical route strings for the entire app navigation graph.
 *
 * Usage:
 * ```kotlin
 * navController.navigate(Routes.KUJI_BOARD.replace("{campaignId}", id))
 * ```
 */
public object Routes {
    // Auth flow
    const val LOGIN = "login"
    const val PHONE_BINDING = "phone_binding"

    // Main shell
    const val HOME = "home"

    // Campaigns tab
    const val CAMPAIGNS = "campaigns"
    const val KUJI_BOARD = "campaign/{campaignId}/board"
    const val QUEUE = "campaign/{campaignId}/queue"
    const val UNLIMITED_DRAW = "campaign/{campaignId}/unlimited"
    const val DRAW_REVEAL =
        "draw/reveal?prizeInstanceId={prizeInstanceId}" +
            "&prizeName={prizeName}" +
            "&prizeGrade={prizeGrade}" +
            "&prizePhotoUrl={prizePhotoUrl}" +
            "&mode={mode}"

    // Prizes tab
    const val PRIZES = "prizes"

    // Marketplace tab
    const val TRADE = "trade"

    // Exchange
    const val EXCHANGE = "exchange"

    // Wallet tab
    const val WALLET = "wallet"
    const val WITHDRAWAL = "wallet/withdraw"

    // Leaderboard
    const val LEADERBOARD = "leaderboard"

    // Support
    const val SUPPORT = "support"
    const val CREATE_TICKET = "support/new"
    const val TICKET_DETAIL = "support/{ticketId}"

    // Settings
    const val SETTINGS = "settings"
}

// ---------------------------------------------------------------------------
// Root NavGraph
// ---------------------------------------------------------------------------

/**
 * Root Navigation Compose graph connecting all screens in the PrizeDraw app.
 *
 * Start destination is [Routes.LOGIN]. Once authentication completes the
 * auth flow pushes [Routes.HOME] and clears the back stack.
 *
 * ViewModels are remembered at the NavGraph level so they survive screen
 * recompositions but are cleared when the graph is removed.
 *
 * TODO(T172): Replace `remember { FooViewModel() }` calls with Koin
 *   `koinViewModel<FooViewModel>()` once the DI module is wired.
 *
 * @param navController Navigation controller. Defaults to a new instance so
 *   callers can optionally inject their own (useful for testing).
 * @param appVersion Version string forwarded to [SettingsScreen].
 */
@Composable
public fun PrizeDrawNavGraph(
    navController: NavHostController = rememberNavController(),
    appVersion: String = "1.0.0",
) {
    val authViewModel = remember { AuthViewModel() }
    val campaignViewModel = remember { KujiCampaignViewModel() }
    val unlimitedDrawViewModel = remember { UnlimitedDrawViewModel() }
    val prizeViewModel = remember { PrizeInventoryViewModel() }
    val marketplaceViewModel = remember { MarketplaceViewModel() }
    val leaderboardViewModel = remember { LeaderboardViewModel() }
    val supportViewModel = remember { SupportViewModel() }

    NavHost(
        navController = navController,
        startDestination = Routes.LOGIN,
    ) {
        // Auth flow
        composable(Routes.LOGIN) {
            LoginScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onNeedsPhoneBinding = {
                    navController.navigate(Routes.PHONE_BINDING)
                },
            )
        }

        composable(Routes.PHONE_BINDING) {
            PhoneBindingScreen(
                viewModel = authViewModel,
                onAuthenticated = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
            )
        }

        // Main shell
        composable(Routes.HOME) {
            HomeScreen(
                onNavigateToSettings = { navController.navigate(Routes.SETTINGS) },
                onNavigateToNotifications = { /* TODO: notifications route */ },
                tabContent = { route ->
                    when (route) {
                        "campaigns" ->
                            CampaignListScreen(
                                viewModel = campaignViewModel,
                                onCampaignSelected = { campaignId ->
                                    navController.navigate(
                                        Routes.KUJI_BOARD.replace("{campaignId}", campaignId),
                                    )
                                },
                            )

                        "prizes" ->
                            MyPrizesScreen(
                                viewModel = prizeViewModel,
                                onPrizeClick = { /* TODO(T125): navigate to prize detail */ },
                            )

                        "trade" ->
                            MarketplaceScreen(
                                viewModel = marketplaceViewModel,
                                onListingClick = { /* TODO(T172): navigate to listing detail */ },
                                onCreateListing = { /* TODO(T172): navigate to create listing */ },
                            )

                        "wallet" ->
                            WalletScreen(
                                // TODO(T172): source from WalletViewModel
                                wallet =
                                    WalletDto(
                                        drawPointsBalance = 0,
                                        revenuePointsBalance = 0,
                                        drawTransactions = emptyList(),
                                        revenueTransactions = emptyList(),
                                    ),
                                onTopUp = { /* TODO: payment top-up route */ },
                            )

                        else -> Unit
                    }
                },
            )
        }

        // Campaigns
        composable(
            route = Routes.KUJI_BOARD,
            arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val campaignId =
                backStackEntry.savedStateHandle.get<String>("campaignId") ?: return@composable
            KujiBoardScreen(
                viewModel = campaignViewModel,
                campaignId = campaignId,
            )
        }

        composable(
            route = Routes.QUEUE,
            arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
        ) {
            QueueScreen(viewModel = campaignViewModel)
        }

        composable(
            route = Routes.UNLIMITED_DRAW,
            arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val campaignId =
                backStackEntry.savedStateHandle.get<String>("campaignId") ?: return@composable
            UnlimitedDrawScreen(
                viewModel = unlimitedDrawViewModel,
                campaignId = campaignId,
            )
        }

        composable(
            route = Routes.DRAW_REVEAL,
            arguments =
                listOf(
                    navArgument("prizeInstanceId") { type = NavType.StringType },
                    navArgument("prizeName") { type = NavType.StringType },
                    navArgument("prizeGrade") { type = NavType.StringType },
                    navArgument("prizePhotoUrl") {
                        type = NavType.StringType
                        defaultValue = ""
                    },
                    navArgument("mode") {
                        type = NavType.StringType
                        defaultValue = "INSTANT"
                    },
                ),
        ) { backStackEntry ->
            val ssh = backStackEntry.savedStateHandle
            DrawRevealScreen(
                prizePhotoUrl = ssh.get<String>("prizePhotoUrl") ?: "",
                prizeName = ssh.get<String>("prizeName") ?: "",
                prizeGrade = ssh.get<String>("prizeGrade") ?: "",
                animationMode =
                    runCatching {
                        DrawAnimationMode.valueOf(ssh.get<String>("mode") ?: "INSTANT")
                    }.getOrDefault(DrawAnimationMode.INSTANT),
                onContinue = {
                    navController.navigate(Routes.PRIZES) {
                        popUpTo(Routes.HOME) { inclusive = false }
                    }
                },
            )
        }

        // Prizes
        composable(Routes.PRIZES) {
            MyPrizesScreen(
                viewModel = prizeViewModel,
                onPrizeClick = { /* TODO(T125): navigate to prize detail */ },
            )
        }

        // Trade
        composable(Routes.TRADE) {
            MarketplaceScreen(
                viewModel = marketplaceViewModel,
                onListingClick = { /* TODO(T172): navigate to listing detail */ },
                onCreateListing = { /* TODO(T172): navigate to create listing */ },
            )
        }

        // Exchange offer flow
        composable(Routes.EXCHANGE) {
            ExchangeOfferScreen(
                recipientNickname = "",
                recipientPrizes = emptyList(),
                ownPrizes = emptyList(),
                onSubmit = { _, _, _ -> navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }

        // Exchange counter-propose flow (own prizes sourced from prizeViewModel)
        composable(Routes.EXCHANGE) {
            ExchangeCounterProposeScreen(
                ownPrizes = emptyList(),
                onSubmit = { navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }

        // Wallet
        composable(Routes.WALLET) {
            WalletScreen(
                wallet =
                    WalletDto(
                        drawPointsBalance = 0,
                        revenuePointsBalance = 0,
                        drawTransactions = emptyList(),
                        revenueTransactions = emptyList(),
                    ),
                onTopUp = { /* TODO: payment top-up route */ },
            )
        }

        composable(Routes.WITHDRAWAL) {
            WithdrawalScreen(
                revenuePointsBalance = 0,
                onSubmit = { _, _, _, _, _ -> navController.popBackStack() },
                onBack = { navController.popBackStack() },
            )
        }

        // Leaderboard
        composable(Routes.LEADERBOARD) {
            LeaderboardScreen(viewModel = leaderboardViewModel)
        }

        // Support
        composable(Routes.SUPPORT) {
            SupportTicketListScreen(
                viewModel = supportViewModel,
                onTicketClick = { ticketId ->
                    navController.navigate(
                        Routes.TICKET_DETAIL.replace("{ticketId}", ticketId),
                    )
                },
                onCreateTicket = { navController.navigate(Routes.CREATE_TICKET) },
            )
        }

        composable(Routes.CREATE_TICKET) {
            CreateTicketScreen(
                viewModel = supportViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Routes.TICKET_DETAIL,
            arguments = listOf(navArgument("ticketId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val ticketId =
                backStackEntry.savedStateHandle.get<String>("ticketId") ?: return@composable
            TicketDetailScreen(
                viewModel = supportViewModel,
                ticketId = ticketId,
                onBack = { navController.popBackStack() },
            )
        }

        // Settings
        composable(Routes.SETTINGS) {
            SettingsScreen(
                appVersion = appVersion,
                onBack = { navController.popBackStack() },
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
    }
}
