package com.prizedraw.infrastructure.di

import com.prizedraw.application.ports.input.admin.ICreateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.input.admin.ICreateKujiCampaignUseCase
import com.prizedraw.application.ports.input.admin.ICreateStaffUseCase
import com.prizedraw.application.ports.input.admin.ICreateUnlimitedCampaignUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateStaffUseCase
import com.prizedraw.application.ports.input.admin.IGetAuditLogUseCase
import com.prizedraw.application.ports.input.admin.IManageAnimationModesUseCase
import com.prizedraw.application.ports.input.admin.IUpdateAnnouncementUseCase
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
import com.prizedraw.application.ports.input.favorite.IAddFavoriteUseCase
import com.prizedraw.application.ports.input.favorite.IGetFavoritesUseCase
import com.prizedraw.application.ports.input.favorite.IRemoveFavoriteUseCase
import com.prizedraw.application.ports.input.follow.IBatchFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IFollowPlayerUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowersListUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowingListUseCase
import com.prizedraw.application.ports.input.follow.ISearchPlayerByCodeUseCase
import com.prizedraw.application.ports.input.follow.IUnfollowPlayerUseCase
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
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.application.ports.output.IBuybackRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IDistributedLockService
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.ILeaderboardRepository
import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.application.ports.output.ISmsService
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.application.ports.output.IWithdrawalGateway
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.application.services.FeedService
import com.prizedraw.application.services.KujiQueueService
import com.prizedraw.application.services.LevelService
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.application.services.TokenService
import com.prizedraw.application.usecases.admin.ApproveCampaignUseCase
import com.prizedraw.application.usecases.admin.CreateBannerUseCase
import com.prizedraw.application.usecases.admin.DeactivateBannerUseCase
import com.prizedraw.application.usecases.admin.UpdateBannerUseCase
import com.prizedraw.application.usecases.admin.CreateAnnouncementUseCase
import com.prizedraw.application.usecases.admin.CreateKujiCampaignUseCase
import com.prizedraw.application.usecases.admin.CreateUnlimitedCampaignUseCase
import com.prizedraw.application.usecases.admin.DeactivateAnnouncementUseCase
import com.prizedraw.application.usecases.admin.GetRiskSettingsUseCase
import com.prizedraw.application.usecases.admin.ManageAnimationModesUseCase
import com.prizedraw.application.usecases.admin.UpdateAnnouncementUseCase
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
import com.prizedraw.application.usecases.exchange.CancelExchangeRequestUseCase
import com.prizedraw.application.usecases.exchange.CreateExchangeRequestUseCase
import com.prizedraw.application.usecases.exchange.RespondExchangeRequestUseCase
import com.prizedraw.application.usecases.favorite.AddFavoriteUseCase
import com.prizedraw.application.usecases.favorite.GetFavoritesUseCase
import com.prizedraw.application.usecases.favorite.RemoveFavoriteUseCase
import com.prizedraw.application.usecases.follow.BatchFollowStatusUseCase
import com.prizedraw.application.usecases.follow.FollowPlayerUseCase
import com.prizedraw.application.usecases.follow.GetFollowStatusUseCase
import com.prizedraw.application.usecases.follow.GetFollowersListUseCase
import com.prizedraw.application.usecases.follow.GetFollowingListUseCase
import com.prizedraw.application.usecases.follow.SearchPlayerByCodeUseCase
import com.prizedraw.application.usecases.follow.UnfollowPlayerUseCase
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
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.DrawCoreDeps
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.services.MarginRiskService
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
                playerRepository = get<IPlayerRepository>(),
                oAuthTokenValidator = get<IOAuthTokenValidator>(),
                tokenService = get<TokenService>(),
                auditRepository = get<IAuditRepository>(),
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
                playerRepository = get<IPlayerRepository>(),
                redisClient = get<RedisClient>(),
                auditRepository = get<IAuditRepository>(),
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
            GetPlayerProfileUseCase(
                playerRepository = get<IPlayerRepository>(),
                followRepository = get<IFollowRepository>(),
            )
        }

        single<IUpdatePlayerProfileUseCase> {
            UpdatePlayerProfileUseCase(playerRepository = get<IPlayerRepository>())
        }

        single<IGetPrizeInventoryUseCase> {
            GetPrizeInventoryUseCase(prizeRepository = get<IPrizeRepository>())
        }

        single<IUpdateAnimationPreferenceUseCase> {
            UpdateAnimationPreferenceUseCase(playerRepository = get<IPlayerRepository>())
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
                playerRepository = get<IPlayerRepository>(),
                drawPointTransactionRepository = get<IDrawPointTransactionRepository>(),
                outboxRepository = get<IOutboxRepository>(),
                paymentGateway = get<IPaymentGateway>(),
            )
        }

        // --- Phase 4: Kuji Draw ---
        single<KujiDrawDomainService> { KujiDrawDomainService() }

        // --- Phase 5: Unlimited Draw ---
        single<UnlimitedDrawDomainService> { UnlimitedDrawDomainService() }

        single<DrawCore> {
            DrawCore(
                deps =
                    DrawCoreDeps(
                        playerRepository = get<IPlayerRepository>(),
                        prizeRepository = get<IPrizeRepository>(),
                        drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                        outboxRepository = get<IOutboxRepository>(),
                        levelService = get<LevelService>(),
                    ),
            )
        }

        single<KujiQueueService> {
            KujiQueueService(
                distributedLock = get<IDistributedLockService>(),
                queueRepository = get<IQueueRepository>(),
                queueEntryRepository = get<IQueueEntryRepository>(),
                pubSub = get<IPubSubService>(),
            )
        }

        single<IDrawKujiUseCase> {
            DrawKujiUseCase(
                deps =
                    DrawKujiDeps(
                        drawRepository = get<IDrawRepository>(),
                        ticketBoxRepository = get<ITicketBoxRepository>(),
                        prizeRepository = get<IPrizeRepository>(),
                        playerRepository = get<IPlayerRepository>(),
                        campaignRepository = get<ICampaignRepository>(),
                        queueRepository = get<IQueueRepository>(),
                        outboxRepository = get<IOutboxRepository>(),
                        auditRepository = get<IAuditRepository>(),
                        domainService = get<KujiDrawDomainService>(),
                        redisPubSub = get<RedisPubSub>(),
                        drawCore = get<DrawCore>(),
                        couponRepository = getOrNull<ICouponRepository>(),
                        feedService = get<FeedService>(),
                    ),
            )
        }

        single<IDrawUnlimitedUseCase> {
            DrawUnlimitedUseCase(
                deps =
                    DrawUnlimitedDeps(
                        campaignRepository = get<ICampaignRepository>(),
                        prizeRepository = get<IPrizeRepository>(),
                        outboxRepository = get<IOutboxRepository>(),
                        auditRepository = get<IAuditRepository>(),
                        domainService = get<UnlimitedDrawDomainService>(),
                        redisClient = get<RedisClient>(),
                        drawCore = get<DrawCore>(),
                        couponRepository = getOrNull<ICouponRepository>(),
                        feedService = get<FeedService>(),
                        playerRepository = get<IPlayerRepository>(),
                    ),
            )
        }

        // --- Phase 6: Shipping ---
        single<ICreateShippingOrderUseCase> {
            CreateShippingOrderUseCase(
                prizeRepository = get<IPrizeRepository>(),
                shippingRepository = get<IShippingRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<ICancelShippingOrderUseCase> {
            CancelShippingOrderUseCase(
                shippingRepository = get<IShippingRepository>(),
                prizeRepository = get<IPrizeRepository>(),
            )
        }

        single<IFulfillShippingOrderUseCase> {
            FulfillShippingOrderUseCase(
                shippingRepository = get<IShippingRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<IConfirmDeliveryUseCase> {
            ConfirmDeliveryUseCase(
                shippingRepository = get<IShippingRepository>(),
                prizeRepository = get<IPrizeRepository>(),
            )
        }

        // --- Phase 7: Trade Marketplace ---
        single<ICreateTradeListingUseCase> {
            CreateTradeListingUseCase(
                prizeRepository = get<IPrizeRepository>(),
                tradeRepository = get<ITradeRepository>(),
                playerRepository = get<IPlayerRepository>(),
                featureFlagRepository = get<IFeatureFlagRepository>(),
                auditRepository = get<IAuditRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<IPurchaseTradeListingUseCase> {
            PurchaseTradeListingUseCase(
                tradeRepository = get<ITradeRepository>(),
                playerRepository = get<IPlayerRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
                outboxRepository = get<IOutboxRepository>(),
                distributedLock = get<DistributedLock>(),
                levelService = getOrNull<LevelService>(),
            )
        }

        single<ICancelTradeListingUseCase> {
            CancelTradeListingUseCase(
                tradeRepository = get<ITradeRepository>(),
                prizeRepository = get<IPrizeRepository>(),
            )
        }

        // --- Phase 8: Exchange ---
        single<ICreateExchangeRequestUseCase> {
            CreateExchangeRequestUseCase(
                exchangeRepository = get<IExchangeRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                playerRepository = get<IPlayerRepository>(),
                featureFlagRepository = get<IFeatureFlagRepository>(),
                auditRepository = get<IAuditRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<IRespondExchangeRequestUseCase> {
            RespondExchangeRequestUseCase(
                exchangeRepository = get<IExchangeRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                playerRepository = get<IPlayerRepository>(),
                auditRepository = get<IAuditRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<ICancelExchangeRequestUseCase> {
            CancelExchangeRequestUseCase(
                exchangeRepository = get<IExchangeRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                auditRepository = get<IAuditRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        // --- Phase 9: Buyback ---
        single<IBuybackUseCase> {
            BuybackUseCase(
                prizeRepository = get<IPrizeRepository>(),
                playerRepository = get<IPlayerRepository>(),
                buybackRepository = get<IBuybackRepository>(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
                auditRepository = get<IAuditRepository>(),
                outboxRepository = get<IOutboxRepository>(),
            )
        }

        single<IGetBuybackPriceUseCase> {
            GetBuybackPriceUseCase(prizeRepository = get<IPrizeRepository>())
        }

        // --- Phase 10: Dual Points & Withdrawal ---
        single<PointsLedgerService> {
            PointsLedgerService(
                playerRepository = get<IPlayerRepository>(),
                drawPointTxRepository = get<IDrawPointTransactionRepository>(),
                revenuePointTxRepository = get<IRevenuePointTransactionRepository>(),
            )
        }

        single<ICreateWithdrawalRequestUseCase> {
            CreateWithdrawalRequestUseCase(
                playerRepository = get<IPlayerRepository>(),
                withdrawalRepository = get<IWithdrawalRepository>(),
                pointsLedgerService = get<PointsLedgerService>(),
            )
        }

        single<IApproveWithdrawalUseCase> {
            ApproveWithdrawalUseCase(
                withdrawalRepository = get<IWithdrawalRepository>(),
                withdrawalGateway = get<IWithdrawalGateway>(),
            )
        }

        single<IRejectWithdrawalUseCase> {
            RejectWithdrawalUseCase(
                withdrawalRepository = get<IWithdrawalRepository>(),
                pointsLedgerService = get<PointsLedgerService>(),
            )
        }

        // --- Phase 11: Admin Campaign Management ---
        single<ICreateKujiCampaignUseCase> {
            CreateKujiCampaignUseCase(
                campaignRepository = get<ICampaignRepository>(),
                ticketBoxRepository = get<ITicketBoxRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<ICreateUnlimitedCampaignUseCase> {
            CreateUnlimitedCampaignUseCase(
                campaignRepository = get<ICampaignRepository>(),
                auditRepository = get<IAuditRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                marginRiskService = get<MarginRiskService>(),
                settingsRepository = get<ISystemSettingsRepository>(),
            )
        }

        single<IUpdateCampaignStatusUseCase> {
            UpdateCampaignStatusUseCase(
                campaignRepository = get<ICampaignRepository>(),
                ticketBoxRepository = get<ITicketBoxRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                auditRepository = get<IAuditRepository>(),
                marginRiskService = get<MarginRiskService>(),
                settingsRepository = get<ISystemSettingsRepository>(),
                favoriteRepo = get(),
                notificationRepo = get(),
                outboxRepo = get(),
            )
        }

        single<IUpdateCampaignUseCase> {
            UpdateCampaignUseCase(
                campaignRepository = get<ICampaignRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        // --- Unlimited Prize Table & Risk ---
        single<UpdateUnlimitedPrizeTableUseCase> {
            UpdateUnlimitedPrizeTableUseCase(
                campaignRepository = get<ICampaignRepository>(),
                prizeRepository = get<IPrizeRepository>(),
                marginRiskService = get<MarginRiskService>(),
                settingsRepository = get<ISystemSettingsRepository>(),
            )
        }

        single<ApproveCampaignUseCase> {
            ApproveCampaignUseCase(
                campaignRepository = get<ICampaignRepository>(),
                settingsRepository = get<ISystemSettingsRepository>(),
            )
        }

        single<GetRiskSettingsUseCase> {
            GetRiskSettingsUseCase(settingsRepository = get<ISystemSettingsRepository>())
        }

        // --- Phase 16: Animation Modes (Admin) ---
        single<IManageAnimationModesUseCase> {
            ManageAnimationModesUseCase(
                featureFlagRepository = get<IFeatureFlagRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        // --- Phase 17: Leaderboard ---
        single<IGetLeaderboardUseCase> {
            GetLeaderboardUseCase(leaderboardRepository = get<ILeaderboardRepository>())
        }

        single<LeaderboardAggregationJob> {
            LeaderboardAggregationJob(leaderboardRepository = get<ILeaderboardRepository>())
        }

        // --- Phase 12: Admin Pricing ---
        single<IUpdateBuybackPriceUseCase> {
            UpdateBuybackPriceUseCase(
                prizeRepository = get<IPrizeRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<IUpdateTradeFeeRateUseCase> {
            UpdateTradeFeeRateUseCase(
                featureFlagRepository = get<IFeatureFlagRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        // --- Phase 13: Support Tickets ---
        single<ICreateSupportTicketUseCase> {
            com.prizedraw.application.usecases.support.CreateSupportTicketUseCase(
                supportRepository = get<ISupportRepository>(),
            )
        }

        single<IReplySupportTicketUseCase> {
            com.prizedraw.application.usecases.support.ReplySupportTicketUseCase(
                supportRepository = get<ISupportRepository>(),
            )
        }

        single<ICloseSupportTicketUseCase> {
            com.prizedraw.application.usecases.support.CloseSupportTicketUseCase(
                supportRepository = get<ISupportRepository>(),
            )
        }

        single<IGetSupportTicketDetailUseCase> {
            com.prizedraw.application.usecases.support.GetSupportTicketDetailUseCase(
                supportRepository = get<ISupportRepository>(),
            )
        }

        // --- Phase 14: Staff Management & Audit Log ---
        single<ICreateStaffUseCase> {
            com.prizedraw.application.usecases.admin.CreateStaffUseCase(
                staffRepository = get<IStaffRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<IUpdateStaffRoleUseCase> {
            com.prizedraw.application.usecases.admin.UpdateStaffRoleUseCase(
                staffRepository = get<IStaffRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<IDeactivateStaffUseCase> {
            com.prizedraw.application.usecases.admin.DeactivateStaffUseCase(
                staffRepository = get<IStaffRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<IGetAuditLogUseCase> {
            com.prizedraw.application.usecases.admin.GetAuditLogUseCase(
                auditRepository = get<IAuditRepository>(),
            )
        }

        // --- Phase 20: Server Status / Announcement Management ---
        single<ICreateAnnouncementUseCase> {
            CreateAnnouncementUseCase(announcementRepository = get<IServerAnnouncementRepository>())
        }

        single<IUpdateAnnouncementUseCase> {
            UpdateAnnouncementUseCase(announcementRepository = get<IServerAnnouncementRepository>())
        }

        single<IDeactivateAnnouncementUseCase> {
            DeactivateAnnouncementUseCase(announcementRepository = get<IServerAnnouncementRepository>())
        }

        // --- Banner Carousel ---
        single<ICreateBannerUseCase> {
            CreateBannerUseCase(bannerRepository = get<IBannerRepository>())
        }

        single<IUpdateBannerUseCase> {
            UpdateBannerUseCase(bannerRepository = get<IBannerRepository>())
        }

        single<IDeactivateBannerUseCase> {
            DeactivateBannerUseCase(bannerRepository = get<IBannerRepository>())
        }

        // --- Phase 15: Coupons ---
        single<ICreateCouponUseCase> {
            com.prizedraw.application.usecases.coupon.CreateCouponUseCase(
                couponRepository = get<ICouponRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        single<IRedeemDiscountCodeUseCase> {
            com.prizedraw.application.usecases.coupon.RedeemDiscountCodeUseCase(
                couponRepository = get<ICouponRepository>(),
            )
        }

        single<IApplyCouponToDrawUseCase> {
            com.prizedraw.application.usecases.coupon.ApplyCouponToDrawUseCase(
                couponRepository = get<ICouponRepository>(),
            )
        }

        single<IDeactivateCouponUseCase> {
            com.prizedraw.application.usecases.coupon.DeactivateCouponUseCase(
                couponRepository = get<ICouponRepository>(),
                auditRepository = get<IAuditRepository>(),
            )
        }

        // --- Campaign Favorites ---
        single<IAddFavoriteUseCase> {
            AddFavoriteUseCase(
                favoriteRepository = get<ICampaignFavoriteRepository>(),
                campaignRepository = get<ICampaignRepository>(),
            )
        }

        single<IRemoveFavoriteUseCase> {
            RemoveFavoriteUseCase(favoriteRepository = get<ICampaignFavoriteRepository>())
        }

        single<IGetFavoritesUseCase> {
            GetFavoritesUseCase(
                favoriteRepository = get<ICampaignFavoriteRepository>(),
                campaignRepository = get<ICampaignRepository>(),
            )
        }

        // --- Follow System ---
        single<IFollowPlayerUseCase> {
            FollowPlayerUseCase(
                followRepository = get<IFollowRepository>(),
                playerRepository = get<IPlayerRepository>(),
            )
        }
        single<IUnfollowPlayerUseCase> {
            UnfollowPlayerUseCase(followRepository = get<IFollowRepository>())
        }
        single<IGetFollowingListUseCase> {
            GetFollowingListUseCase(
                followRepository = get<IFollowRepository>(),
                playerRepository = get<IPlayerRepository>(),
            )
        }
        single<IGetFollowersListUseCase> {
            GetFollowersListUseCase(
                followRepository = get<IFollowRepository>(),
                playerRepository = get<IPlayerRepository>(),
            )
        }
        single<IGetFollowStatusUseCase> {
            GetFollowStatusUseCase(followRepository = get<IFollowRepository>())
        }
        single<ISearchPlayerByCodeUseCase> {
            SearchPlayerByCodeUseCase(
                playerRepository = get<IPlayerRepository>(),
                followRepository = get<IFollowRepository>(),
            )
        }
        single<IBatchFollowStatusUseCase> {
            BatchFollowStatusUseCase(followRepository = get<IFollowRepository>())
        }
    }
