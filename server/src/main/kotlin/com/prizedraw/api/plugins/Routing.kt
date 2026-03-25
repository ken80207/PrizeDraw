package com.prizedraw.api.plugins

import com.prizedraw.api.routes.adminAnnouncementRoutes
import com.prizedraw.api.routes.roomRoutes
import com.prizedraw.api.routes.adminAnimationRoutes
import com.prizedraw.api.routes.adminCampaignRoutes
import com.prizedraw.api.routes.adminPricingRoutes
import com.prizedraw.api.routes.adminStaffRoutes
import com.prizedraw.api.routes.authRoutes
import com.prizedraw.api.routes.broadcastRoutes
import com.prizedraw.api.routes.buybackRoutes
import com.prizedraw.api.routes.campaignRoutes
import com.prizedraw.api.routes.chatRoutes
import com.prizedraw.api.routes.couponRoutes
import com.prizedraw.api.routes.drawRoutes
import com.prizedraw.api.routes.exchangeRoutes
import com.prizedraw.api.routes.leaderboardRoutes
import com.prizedraw.api.routes.lineWebhookRoute
import com.prizedraw.api.routes.paymentRoutes
import com.prizedraw.api.routes.playerRoutes
import com.prizedraw.api.routes.shippingRoutes
import com.prizedraw.api.routes.statusRoutes
import com.prizedraw.api.routes.supportRoutes
import com.prizedraw.api.routes.tradeRoutes
import com.prizedraw.api.routes.withdrawalRoutes
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.services.ChatService
import com.prizedraw.application.services.DrawSyncService
import com.prizedraw.application.services.RoomScalingService
import com.prizedraw.application.usecases.leaderboard.LeaderboardAggregationJob
import com.prizedraw.infrastructure.websocket.ConnectionManager
import com.prizedraw.infrastructure.websocket.chatWebSocketHandler
import com.prizedraw.infrastructure.websocket.kujiWebSocketHandler
import com.prizedraw.infrastructure.websocket.queueWebSocketHandler
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
public fun Application.configureRouting() {
    val prometheusRegistry: PrometheusMeterRegistry by inject()
    val connectionManager: ConnectionManager by inject()
    val drawRepository: IDrawRepository by inject()
    val prizeRepository: IPrizeRepository by inject()
    val queueRepository: IQueueRepository by inject()
    val queueEntryRepository: IQueueEntryRepository by inject()
    val leaderboardAggregationJob: LeaderboardAggregationJob by inject()
    val drawSyncService: DrawSyncService by inject()
    val chatService: ChatService by inject()
    val roomScalingService: RoomScalingService by inject()

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

        // Phase 3: Auth, Player, Payment
        authRoutes()
        playerRoutes()
        paymentRoutes()

        // Phase 4: Campaign, Draw, WebSocket
        campaignRoutes()
        drawRoutes()
        kujiWebSocketHandler(connectionManager, drawRepository, prizeRepository, drawSyncService, roomScalingService)

        // Phase 21: Room scaling REST endpoints
        roomRoutes()
        queueWebSocketHandler(connectionManager, queueRepository, queueEntryRepository)

        // Phase 19+: Gameification — Chat, Broadcast, Draw Sync
        chatRoutes()
        broadcastRoutes()
        chatWebSocketHandler(connectionManager, chatService)

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

        // Phase 13: Support tickets + LINE webhook
        supportRoutes()
        lineWebhookRoute()

        // Phase 15: Coupon redemption (player routes inside)
        couponRoutes()

        // Phase 11 & 12: Admin Campaign Management + Pricing
        // authenticate("staff") wraps all admin routes
        authenticate("staff") {
            adminCampaignRoutes()
            adminPricingRoutes()

            // Phase 14: Staff management + Audit log (ADMIN role enforced per handler)
            adminStaffRoutes()

            // Phase 16: Animation mode admin controls
            adminAnimationRoutes()

            // Phase 20: Announcement management
            adminAnnouncementRoutes()
        }
    }
}
