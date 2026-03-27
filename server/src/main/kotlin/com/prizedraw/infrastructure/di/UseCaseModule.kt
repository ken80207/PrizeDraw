package com.prizedraw.infrastructure.di

import com.prizedraw.application.ports.input.admin.ICreateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.ICreateKujiCampaignUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.IUpdateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.ICreateStaffUseCase
import com.prizedraw.application.ports.input.admin.ICreateUnlimitedCampaignUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateStaffUseCase
import com.prizedraw.application.ports.input.admin.IGetAuditLogUseCase
import com.prizedraw.application.ports.input.admin.IManageAnimationModesUseCase
import com.prizedraw.application.ports.input.admin.IUpdateBuybackPriceUseCase
import com.prizedraw.application.ports.input.admin.IUpdateCampaignStatusUseCase
import com.prizedraw.application.ports.input.admin.IUpdateCampaignUseCase
import com.prizedraw.application.ports.input.admin.IUpdateStaffRoleUseCase
import com.prizedraw.application.ports.input.admin.IUpdateTradeFeeRateUseCase
import com.prizedraw.application.ports.input.auth.IBindPhoneUseCase
import com.prizedraw.application.ports.input.auth.ILoginUseCase
import com.prizedraw.application.ports.input.auth.ILogoutUseCase
import com.prizedraw.application.ports.input.auth.IRefreshTokenUseCase
import com.prizedraw.application.ports.input.auth.ISendOtpUseCase
import com.prizedraw.application.ports.input.buyback.IBuybackUseCase
import com.prizedraw.application.ports.input.buyback.IGetBuybackPriceUseCase
import com.prizedraw.application.ports.input.coupon.IApplyCouponToDrawUseCase
import com.prizedraw.application.ports.input.coupon.ICreateCouponUseCase
import com.prizedraw.application.ports.input.coupon.IDeactivateCouponUseCase
import com.prizedraw.application.ports.input.coupon.IRedeemDiscountCodeUseCase
import com.prizedraw.application.ports.input.draw.IDrawKujiUseCase
import com.prizedraw.application.ports.input.draw.IDrawUnlimitedUseCase
import com.prizedraw.application.ports.input.exchange.ICancelExchangeRequestUseCase
import com.prizedraw.application.ports.input.exchange.ICreateExchangeRequestUseCase
import com.prizedraw.application.ports.input.exchange.IRespondExchangeRequestUseCase
import com.prizedraw.application.ports.input.leaderboard.IGetLeaderboardUseCase
import com.prizedraw.application.ports.input.payment.IConfirmPaymentWebhookUseCase
import com.prizedraw.application.ports.input.payment.ICreatePaymentOrderUseCase
import com.prizedraw.application.ports.input.player.IGetPlayerProfileUseCase
import com.prizedraw.application.ports.input.player.IGetPrizeInventoryUseCase
import com.prizedraw.application.ports.input.player.IUpdateAnimationPreferenceUseCase
import com.prizedraw.application.ports.input.player.IUpdatePlayerProfileUseCase
import com.prizedraw.application.ports.input.shipping.ICancelShippingOrderUseCase
import com.prizedraw.application.ports.input.shipping.IConfirmDeliveryUseCase
import com.prizedraw.application.ports.input.shipping.ICreateShippingOrderUseCase
import com.prizedraw.application.ports.input.shipping.IFulfillShippingOrderUseCase
import com.prizedraw.application.ports.input.support.ICloseSupportTicketUseCase
import com.prizedraw.application.ports.input.support.ICreateSupportTicketUseCase
import com.prizedraw.application.ports.input.support.IGetSupportTicketDetailUseCase
import com.prizedraw.application.ports.input.support.IReplySupportTicketUseCase
import com.prizedraw.application.ports.input.trade.ICancelTradeListingUseCase
import com.prizedraw.application.ports.input.trade.ICreateTradeListingUseCase
import com.prizedraw.application.ports.input.trade.IPurchaseTradeListingUseCase
import com.prizedraw.application.ports.input.withdrawal.IApproveWithdrawalUseCase
import com.prizedraw.application.ports.input.withdrawal.ICreateWithdrawalRequestUseCase
import com.prizedraw.application.ports.input.withdrawal.IRejectWithdrawalUseCase
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.ISmsService
import com.prizedraw.application.ports.output.IWithdrawalGateway
import com.prizedraw.application.services.KujiQueueService
import com.prizedraw.application.services.LevelService
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.application.services.TokenService
import com.prizedraw.application.usecases.admin.CreateAnnouncementUseCase
import com.prizedraw.application.usecases.admin.CreateKujiCampaignUseCase
import com.prizedraw.application.usecases.admin.DeactivateAnnouncementUseCase
import com.prizedraw.application.usecases.admin.UpdateAnnouncementUseCase
import com.prizedraw.application.usecases.admin.ApproveCampaignUseCase
import com.prizedraw.application.usecases.admin.CreateUnlimitedCampaignUseCase
import com.prizedraw.application.usecases.admin.GetRiskSettingsUseCase
import com.prizedraw.application.usecases.admin.ManageAnimationModesUseCase
import com.prizedraw.application.usecases.admin.UpdateBuybackPriceUseCase
import com.prizedraw.application.usecases.admin.UpdateCampaignStatusUseCase
import com.prizedraw.application.usecases.admin.UpdateCampaignUseCase
import com.prizedraw.application.usecases.admin.UpdateTradeFeeRateUseCase
import com.prizedraw.application.usecases.admin.UpdateUnlimitedPrizeTableUseCase
import com.prizedraw.application.usecases.auth.BindPhoneUseCase
import com.prizedraw.application.usecases.auth.LoginUseCase
import com.prizedraw.application.usecases.auth.LogoutUseCase
import com.prizedraw.application.usecases.auth.RefreshTokenUseCase
import com.prizedraw.application.usecases.auth.SendOtpUseCase
import com.prizedraw.application.usecases.buyback.BuybackUseCase
import com.prizedraw.application.usecases.buyback.GetBuybackPriceUseCase
import com.prizedraw.application.usecases.draw.DrawKujiDeps
import com.prizedraw.application.usecases.draw.DrawKujiUseCase
import com.prizedraw.application.usecases.draw.DrawUnlimitedDeps
import com.prizedraw.application.usecases.draw.DrawUnlimitedUseCase
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.DrawCoreDeps
import com.prizedraw.application.usecases.exchange.CancelExchangeRequestUseCase
import com.prizedraw.application.usecases.exchange.CreateExchangeRequestUseCase
import com.prizedraw.application.usecases.exchange.RespondExchangeRequestUseCase
import com.prizedraw.application.usecases.leaderboard.GetLeaderboardUseCase
import com.prizedraw.application.usecases.leaderboard.LeaderboardAggregationJob
import com.prizedraw.application.usecases.payment.ConfirmPaymentWebhookUseCase
import com.prizedraw.application.usecases.payment.CreatePaymentOrderUseCase
import com.prizedraw.application.usecases.player.GetPlayerProfileUseCase
import com.prizedraw.application.usecases.player.GetPrizeInventoryUseCase
import com.prizedraw.application.usecases.player.UpdateAnimationPreferenceUseCase
import com.prizedraw.application.usecases.player.UpdatePlayerProfileUseCase
import com.prizedraw.application.usecases.shipping.CancelShippingOrderUseCase
import com.prizedraw.application.usecases.shipping.ConfirmDeliveryUseCase
import com.prizedraw.application.usecases.shipping.CreateShippingOrderUseCase
import com.prizedraw.application.usecases.shipping.FulfillShippingOrderUseCase
import com.prizedraw.application.usecases.trade.CancelTradeListingUseCase
import com.prizedraw.application.usecases.trade.CreateTradeListingUseCase
import com.prizedraw.application.usecases.trade.PurchaseTradeListingUseCase
import com.prizedraw.application.usecases.withdrawal.ApproveWithdrawalUseCase
import com.prizedraw.application.usecases.withdrawal.CreateWithdrawalRequestUseCase
import com.prizedraw.application.usecases.withdrawal.RejectWithdrawalUseCase
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.infrastructure.external.redis.DistributedLock
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import org.koin.dsl.module

/**
 * Koin module binding all application use case interfaces to their implementations.
 *
 * Phase 3: Auth, Player, and Payment use cases.
 */
public val useCaseModule =
    module {
        // --- Auth ---
        single<ILoginUseCase> {
            LoginUseCase(
                playerRepository = get(),
                oAuthTokenValidator = get<IOAuthTokenValidator>(),
                tokenService = get<TokenService>(),
                auditRepository = get(),
            )
        }

        single<ISendOtpUseCase> {
            SendOtpUseCase(
                redisClient = get<RedisClient>(),
                smsService = get<ISmsService>(),
            )
        }

        single<IBindPhoneUseCase> {
            BindPhoneUseCase(
                playerRepository = get(),
                redisClient = get<RedisClient>(),
                auditRepository = get(),
            )
        }

        single<IRefreshTokenUseCase> {
            RefreshTokenUseCase(tokenService = get<TokenService>())
        }

        single<ILogoutUseCase> {
            LogoutUseCase(tokenService = get<TokenService>())
        }

        // --- Player ---
        single<IGetPlayerProfileUseCase> {
            GetPlayerProfileUseCase(playerRepository = get())
        }

        single<IUpdatePlayerProfileUseCase> {
            UpdatePlayerProfileUseCase(playerRepository = get())
        }

        single<IGetPrizeInventoryUseCase> {
            GetPrizeInventoryUseCase(prizeRepository = get())
        }

        single<IUpdateAnimationPreferenceUseCase> {
            UpdateAnimationPreferenceUseCase(playerRepository = get())
        }

        // --- Payment ---
        single<ICreatePaymentOrderUseCase> {
            CreatePaymentOrderUseCase(
                paymentOrderRepository = get<IPaymentOrderRepository>(),
                paymentGateway = get<IPaymentGateway>(),
            )
        }

        single<IConfirmPaymentWebhookUseCase> {
            ConfirmPaymentWebhookUseCase(
                paymentOrderRepository = get<IPaymentOrderRepository>(),
                playerRepository = get(),
                drawPointTransactionRepository = get<IDrawPointTransactionRepository>(),
                outboxRepository = get(),
                paymentGateway = get<IPaymentGateway>(),
            )
        }

        // --- Phase 4: Kuji Draw ---
        single<KujiDrawDomainService> { KujiDrawDomainService() }

        // --- Phase 5: Unlimited Draw ---
        single<UnlimitedDrawDomainService> { UnlimitedDrawDomainService() }

        single<DrawCore> {
            DrawCore(
                deps = DrawCoreDeps(
                    playerRepository = get(),
                    prizeRepository = get(),
                    drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                    outboxRepository = get(),
                    levelService = get<LevelService>(),
                ),
            )
        }

        single<KujiQueueService> {
            KujiQueueService(
                distributedLock = get<DistributedLock>(),
                queueRepository = get<IQueueRepository>(),
                queueEntryRepository = get<IQueueEntryRepository>(),
                redisPubSub = get<RedisPubSub>(),
            )
        }

        single<IDrawKujiUseCase> {
            DrawKujiUseCase(
                deps =
                    DrawKujiDeps(
                        drawRepository = get(),
                        ticketBoxRepository = get(),
                        prizeRepository = get(),
                        playerRepository = get(),
                        campaignRepository = get(),
                        queueRepository = get<IQueueRepository>(),
                        outboxRepository = get(),
                        auditRepository = get(),
                        domainService = get<KujiDrawDomainService>(),
                        redisPubSub = get<RedisPubSub>(),
                        drawCore = get<DrawCore>(),
                        couponRepository = get(),
                    ),
            )
        }

        single<IDrawUnlimitedUseCase> {
            DrawUnlimitedUseCase(
                deps =
                    DrawUnlimitedDeps(
                        campaignRepository = get(),
                        prizeRepository = get(),
                        outboxRepository = get(),
                        auditRepository = get(),
                        domainService = get<UnlimitedDrawDomainService>(),
                        redisClient = get<RedisClient>(),
                        drawCore = get<DrawCore>(),
                        couponRepository = get(),
                    ),
            )
        }

        // --- Phase 6: Shipping ---
        single<ICreateShippingOrderUseCase> {
            CreateShippingOrderUseCase(
                prizeRepository = get(),
                shippingRepository = get(),
                outboxRepository = get(),
            )
        }

        single<ICancelShippingOrderUseCase> {
            CancelShippingOrderUseCase(
                shippingRepository = get(),
                prizeRepository = get(),
            )
        }

        single<IFulfillShippingOrderUseCase> {
            FulfillShippingOrderUseCase(
                shippingRepository = get(),
                prizeRepository = get(),
                outboxRepository = get(),
            )
        }

        single<IConfirmDeliveryUseCase> {
            ConfirmDeliveryUseCase(
                shippingRepository = get(),
                prizeRepository = get(),
            )
        }

        // --- Phase 7: Trade Marketplace ---
        single<ICreateTradeListingUseCase> {
            CreateTradeListingUseCase(
                prizeRepository = get(),
                tradeRepository = get(),
                playerRepository = get(),
                featureFlagRepository = get(),
                auditRepository = get(),
                outboxRepository = get(),
            )
        }

        single<IPurchaseTradeListingUseCase> {
            PurchaseTradeListingUseCase(
                tradeRepository = get(),
                playerRepository = get(),
                prizeRepository = get(),
                drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
                outboxRepository = get(),
                distributedLock = get<DistributedLock>(),
                levelService = get<LevelService>(),
            )
        }

        single<ICancelTradeListingUseCase> {
            CancelTradeListingUseCase(
                tradeRepository = get(),
                prizeRepository = get(),
            )
        }

        // --- Phase 8: Exchange ---
        single<ICreateExchangeRequestUseCase> {
            CreateExchangeRequestUseCase(
                exchangeRepository = get(),
                prizeRepository = get(),
                playerRepository = get(),
                featureFlagRepository = get(),
                auditRepository = get(),
                outboxRepository = get(),
            )
        }

        single<IRespondExchangeRequestUseCase> {
            RespondExchangeRequestUseCase(
                exchangeRepository = get(),
                prizeRepository = get(),
                playerRepository = get(),
                auditRepository = get(),
                outboxRepository = get(),
            )
        }

        single<ICancelExchangeRequestUseCase> {
            CancelExchangeRequestUseCase(
                exchangeRepository = get(),
                prizeRepository = get(),
                auditRepository = get(),
                outboxRepository = get(),
            )
        }

        // --- Phase 9: Buyback ---
        single<IBuybackUseCase> {
            BuybackUseCase(
                prizeRepository = get(),
                playerRepository = get(),
                buybackRepository = get(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
                auditRepository = get(),
                outboxRepository = get(),
            )
        }

        single<IGetBuybackPriceUseCase> {
            GetBuybackPriceUseCase(prizeRepository = get())
        }

        // --- Phase 10: Dual Points & Withdrawal ---
        single<PointsLedgerService> {
            PointsLedgerService(
                playerRepository = get(),
                drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
            )
        }

        single<ICreateWithdrawalRequestUseCase> {
            CreateWithdrawalRequestUseCase(
                playerRepository = get(),
                withdrawalRepository = get(),
                pointsLedgerService = get<PointsLedgerService>(),
            )
        }

        single<IApproveWithdrawalUseCase> {
            ApproveWithdrawalUseCase(
                withdrawalRepository = get(),
                withdrawalGateway = get<IWithdrawalGateway>(),
            )
        }

        single<IRejectWithdrawalUseCase> {
            RejectWithdrawalUseCase(
                withdrawalRepository = get(),
                pointsLedgerService = get<PointsLedgerService>(),
            )
        }

        // --- Phase 11: Admin Campaign Management ---
        single<ICreateKujiCampaignUseCase> {
            CreateKujiCampaignUseCase(
                campaignRepository = get(),
                ticketBoxRepository = get(),
                prizeRepository = get(),
                auditRepository = get(),
            )
        }

        single<ICreateUnlimitedCampaignUseCase> {
            CreateUnlimitedCampaignUseCase(
                campaignRepository = get(),
                auditRepository = get(),
                prizeRepository = get(),
                marginRiskService = get(),
                settingsRepository = get(),
            )
        }

        single<IUpdateCampaignStatusUseCase> {
            UpdateCampaignStatusUseCase(
                campaignRepository = get(),
                ticketBoxRepository = get(),
                prizeRepository = get(),
                auditRepository = get(),
                marginRiskService = get(),
                settingsRepository = get(),
            )
        }

        single<IUpdateCampaignUseCase> {
            UpdateCampaignUseCase(
                campaignRepository = get(),
                auditRepository = get(),
            )
        }

        // --- Unlimited Prize Table & Risk ---
        single<UpdateUnlimitedPrizeTableUseCase> {
            UpdateUnlimitedPrizeTableUseCase(
                campaignRepository = get(),
                prizeRepository = get(),
                marginRiskService = get(),
                settingsRepository = get(),
            )
        }

        single<ApproveCampaignUseCase> {
            ApproveCampaignUseCase(
                campaignRepository = get(),
                settingsRepository = get(),
            )
        }

        single<GetRiskSettingsUseCase> {
            GetRiskSettingsUseCase(settingsRepository = get())
        }

        // --- Phase 16: Animation Modes (Admin) ---
        single<IManageAnimationModesUseCase> {
            ManageAnimationModesUseCase(
                featureFlagRepository = get(),
                auditRepository = get(),
            )
        }

        // --- Phase 17: Leaderboard ---
        single<IGetLeaderboardUseCase> {
            GetLeaderboardUseCase(leaderboardRepository = get())
        }

        single<LeaderboardAggregationJob> {
            LeaderboardAggregationJob(leaderboardRepository = get())
        }

        // --- Phase 12: Admin Pricing ---
        single<IUpdateBuybackPriceUseCase> {
            UpdateBuybackPriceUseCase(
                prizeRepository = get(),
                auditRepository = get(),
            )
        }

        single<IUpdateTradeFeeRateUseCase> {
            UpdateTradeFeeRateUseCase(
                featureFlagRepository = get(),
                auditRepository = get(),
            )
        }

        // --- Phase 13: Support Tickets ---
        single<ICreateSupportTicketUseCase> {
            com.prizedraw.application.usecases.support.CreateSupportTicketUseCase(
                supportRepository = get(),
            )
        }

        single<IReplySupportTicketUseCase> {
            com.prizedraw.application.usecases.support.ReplySupportTicketUseCase(
                supportRepository = get(),
            )
        }

        single<ICloseSupportTicketUseCase> {
            com.prizedraw.application.usecases.support.CloseSupportTicketUseCase(
                supportRepository = get(),
            )
        }

        single<IGetSupportTicketDetailUseCase> {
            com.prizedraw.application.usecases.support.GetSupportTicketDetailUseCase(
                supportRepository = get(),
            )
        }

        // --- Phase 14: Staff Management & Audit Log ---
        single<ICreateStaffUseCase> {
            com.prizedraw.application.usecases.admin.CreateStaffUseCase(
                staffRepository = get(),
                auditRepository = get(),
            )
        }

        single<IUpdateStaffRoleUseCase> {
            com.prizedraw.application.usecases.admin.UpdateStaffRoleUseCase(
                staffRepository = get(),
                auditRepository = get(),
            )
        }

        single<IDeactivateStaffUseCase> {
            com.prizedraw.application.usecases.admin.DeactivateStaffUseCase(
                staffRepository = get(),
                auditRepository = get(),
            )
        }

        single<IGetAuditLogUseCase> {
            com.prizedraw.application.usecases.admin.GetAuditLogUseCase(
                auditRepository = get(),
            )
        }

        // --- Phase 20: Server Status / Announcement Management ---
        single<ICreateAnnouncementUseCase> {
            CreateAnnouncementUseCase(announcementRepository = get())
        }

        single<IUpdateAnnouncementUseCase> {
            UpdateAnnouncementUseCase(announcementRepository = get())
        }

        single<IDeactivateAnnouncementUseCase> {
            DeactivateAnnouncementUseCase(announcementRepository = get())
        }

        // --- Phase 15: Coupons ---
        single<ICreateCouponUseCase> {
            com.prizedraw.application.usecases.coupon.CreateCouponUseCase(
                couponRepository = get(),
                auditRepository = get(),
            )
        }

        single<IRedeemDiscountCodeUseCase> {
            com.prizedraw.application.usecases.coupon.RedeemDiscountCodeUseCase(
                couponRepository = get(),
            )
        }

        single<IApplyCouponToDrawUseCase> {
            com.prizedraw.application.usecases.coupon.ApplyCouponToDrawUseCase(
                couponRepository = get(),
            )
        }

        single<IDeactivateCouponUseCase> {
            com.prizedraw.application.usecases.coupon.DeactivateCouponUseCase(
                couponRepository = get(),
                auditRepository = get(),
            )
        }
    }
