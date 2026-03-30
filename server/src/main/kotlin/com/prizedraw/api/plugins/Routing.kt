package com.prizedraw.api.plugins

import com.prizedraw.api.routes.adminAnimationRoutes
import com.prizedraw.api.routes.adminAnnouncementRoutes
import com.prizedraw.api.routes.adminAuditRoutes
import com.prizedraw.api.routes.adminBannerRoutes
import com.prizedraw.api.routes.adminCampaignRoutes
import com.prizedraw.api.routes.adminDashboardRoutes
import com.prizedraw.api.routes.adminFeatureFlagRoutes
import com.prizedraw.api.routes.adminGradeRoutes
import com.prizedraw.api.routes.adminLeaderboardConfigRoutes
import com.prizedraw.api.routes.adminPaymentRoutes
import com.prizedraw.api.routes.adminPlayerRoutes
import com.prizedraw.api.routes.adminPricingRoutes
import com.prizedraw.api.routes.adminPrizesRoutes
import com.prizedraw.api.routes.adminSettingsRoutes
import com.prizedraw.api.routes.adminStaffRoutes
import com.prizedraw.api.routes.adminTradeRoutes
import com.prizedraw.api.routes.authRoutes
import com.prizedraw.api.routes.bannerRoutes
import com.prizedraw.api.routes.broadcastRoutes
import com.prizedraw.api.routes.buybackRoutes
import com.prizedraw.api.routes.campaignRoutes
import com.prizedraw.api.routes.chatRoutes
import com.prizedraw.api.routes.couponRoutes
import com.prizedraw.api.routes.deviceRoutes
import com.prizedraw.api.routes.drawRoutes
import com.prizedraw.api.routes.exchangeRoutes
import com.prizedraw.api.routes.favoriteRoutes
import com.prizedraw.api.routes.feedRoutes
import com.prizedraw.api.routes.followRoutes
import com.prizedraw.api.routes.leaderboardRoutes
import com.prizedraw.api.routes.levelRoutes
import com.prizedraw.api.routes.lineWebhookRoute
import com.prizedraw.api.routes.liveDrawRoutes
import com.prizedraw.api.routes.notificationRoutes
import com.prizedraw.api.routes.paymentRoutes
import com.prizedraw.api.routes.playerRoutes
import com.prizedraw.api.routes.roomRoutes
import com.prizedraw.api.routes.shippingRoutes
import com.prizedraw.api.routes.statusRoutes
import com.prizedraw.api.routes.storageUploadRoute
import com.prizedraw.api.routes.supportRoutes
import com.prizedraw.api.routes.tradeRoutes
import com.prizedraw.api.routes.withdrawalRoutes
import com.prizedraw.application.usecases.leaderboard.LeaderboardAggregationJob
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.koin.ktor.ext.inject

/**
 * Registers all API routes.
 *
 * Phase 3 routes:
 * - Auth:    POST /api/v1/auth/login, refresh, logout, otp/send, phone/bind
 * - Player:  GET/PATCH /api/v1/players/me, GET /api/v1/players/me/wallet
 * - Payment: GET /api/v1/payment/packages, POST /orders, POST /webhook/{gateway}
 *
 * Phase 4 routes:
 * - Campaigns: GET /api/v1/campaigns/kuji, GET /api/v1/campaigns/kuji/{id}, GET board
 * - Draw:      POST /api/v1/draws/kuji, queue join/leave/switch-box
 * - WebSocket: /ws/kuji/{campaignId}, /ws/queue/{ticketBoxId}
 *
 * Phase 16: PATCH /api/v1/players/me/preferences/animation, admin animation mode toggles
 * Phase 17: GET /api/v1/leaderboards, GET /api/v1/leaderboards/campaign/{campaignId}
 * Phase 18: GET /api/v1/campaigns/kuji/{campaignId}/spectators
 */
@Suppress("LongMethod")
public fun Application.configureRouting() {
    val prometheusRegistry: PrometheusMeterRegistry by inject()
    val leaderboardAggregationJob: LeaderboardAggregationJob by inject()

    // Start the leaderboard background aggregation job once at startup
    leaderboardAggregationJob.start()

    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        get("/metrics") {
            call.respondText(prometheusRegistry.scrape())
        }

        // Phase 20: Server Status — public, no auth required, checked first by all clients
        statusRoutes()

        // Banner carousel — public, no auth required
        bannerRoutes()

        // Phase 3: Auth, Player, Payment
        authRoutes()
        playerRoutes()
        paymentRoutes()

        // Campaign Favorites
        favoriteRoutes()

        // Follow system — follow/unfollow players, lists, status, search by code
        followRoutes()

        // Phase 9: FCM device token registration
        deviceRoutes()

        // Phase 10: Notification history and read-status management
        notificationRoutes()

        // Phase 4: Campaign, Draw
        // Note: WebSocket routes (kuji, queue, chat, feed, player notifications) have been
        // extracted to the realtime-gateway microservice (port 9094).
        campaignRoutes()
        drawRoutes()

        // Phase 21: Room scaling REST endpoints
        roomRoutes()

        // Phase 19+: Gameification — Chat, Broadcast
        chatRoutes()
        broadcastRoutes()

        // Phase 6: Prize Inventory & Shipping
        shippingRoutes()

        // Phase 7: Trade Marketplace
        tradeRoutes()

        // Phase 8: Exchange
        exchangeRoutes()

        // Phase 9: Buyback
        buybackRoutes()

        // Phase 10: Withdrawal
        withdrawalRoutes()

        // Phase 17: Leaderboard (public, but optional auth for self-rank)
        leaderboardRoutes()

        // Live draw marquee — public REST snapshot of active sessions
        liveDrawRoutes()

        // Live draw feed — public REST endpoint
        // Note: /ws/feed WebSocket fanout is served by realtime-gateway.
        feedRoutes()

        // Phase 22: Player level/tier system and XP leaderboard
        levelRoutes()

        // Phase 13: Support tickets + LINE webhook
        supportRoutes()
        lineWebhookRoute()

        // Phase 15: Coupon redemption (player routes inside)
        couponRoutes()

        // Phase 11 & 12: Admin Campaign Management + Pricing
        // authenticate("staff") wraps all admin routes
        authenticate("staff") {
            // Admin dashboard aggregates
            adminDashboardRoutes()

            adminCampaignRoutes()
            adminGradeRoutes()
            adminPricingRoutes()

            // Phase 14: Staff management + Audit log (ADMIN role enforced per handler)
            adminStaffRoutes()

            // Phase 16: Animation mode admin controls
            adminAnimationRoutes()

            // Phase 20: Announcement management
            adminAnnouncementRoutes()

            // Banner carousel admin management
            adminBannerRoutes()

            // Shared storage upload (staff-authenticated)
            storageUploadRoute()

            // Admin player list (with search)
            adminPlayerRoutes()

            // Admin trade listings view
            adminTradeRoutes()

            // Admin prize definitions view
            adminPrizesRoutes()

            // Admin leaderboard configuration
            adminLeaderboardConfigRoutes()

            // Feature flags (ADMIN role enforced per handler)
            adminFeatureFlagRoutes()

            // System settings (ADMIN role enforced per handler)
            adminSettingsRoutes()

            // Payment orders (ADMIN role enforced per handler)
            adminPaymentRoutes()

            // Audit logs direct query endpoint (ADMIN role enforced per handler)
            adminAuditRoutes()
        }
    }
}
