package com.prizedraw.infrastructure.di

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IBroadcastRepository
import com.prizedraw.application.ports.output.IBuybackRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IChatRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IDrawSyncRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.ports.output.ILeaderboardRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.infrastructure.persistence.repositories.AuditRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.BroadcastRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.BuybackRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.CampaignRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.ChatRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.CouponRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.DrawPointTransactionRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.DrawRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.DrawSyncRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.ExchangeRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.FeatureFlagRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.LeaderboardRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.OutboxRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.PaymentOrderRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.PlayerRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.PrizeRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.QueueEntryRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.QueueRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.RevenuePointTransactionRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.ShippingRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.StaffRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.SupportRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.TicketBoxRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.TradeRepositoryImpl
import com.prizedraw.infrastructure.persistence.repositories.WithdrawalRepositoryImpl
import org.koin.dsl.module

/**
 * Koin module binding all output port repository interfaces to their Exposed implementations.
 *
 * All implementations are registered as singletons to avoid unnecessary allocations
 * on each request; Exposed's [newSuspendedTransaction] handles connection pooling internally.
 */
public val repositoryModule =
    module {
        single<IPlayerRepository> { PlayerRepositoryImpl() }
        single<ICampaignRepository> { CampaignRepositoryImpl() }
        single<IPrizeRepository> { PrizeRepositoryImpl() }
        single<IDrawRepository> { DrawRepositoryImpl() }
        single<ITicketBoxRepository> { TicketBoxRepositoryImpl() }
        single<ITradeRepository> { TradeRepositoryImpl() }
        single<IExchangeRepository> { ExchangeRepositoryImpl() }
        single<IBuybackRepository> { BuybackRepositoryImpl() }
        single<IShippingRepository> { ShippingRepositoryImpl() }
        single<ICouponRepository> { CouponRepositoryImpl() }
        single<ILeaderboardRepository> { LeaderboardRepositoryImpl() }
        single<ISupportRepository> { SupportRepositoryImpl() }
        single<IAuditRepository> { AuditRepositoryImpl() }
        single<IOutboxRepository> { OutboxRepositoryImpl() }
        single<IFeatureFlagRepository> { FeatureFlagRepositoryImpl() }
        single<IPaymentOrderRepository> { PaymentOrderRepositoryImpl() }
        single<IDrawPointTransactionRepository> { DrawPointTransactionRepositoryImpl() }
        single<IRevenuePointTransactionRepository> { RevenuePointTransactionRepositoryImpl() }
        single<IQueueRepository> { QueueRepositoryImpl() }
        single<IQueueEntryRepository> { QueueEntryRepositoryImpl() }
        single<IWithdrawalRepository> { WithdrawalRepositoryImpl() }
        single<IStaffRepository> { StaffRepositoryImpl() }
        // Gameification (Phase 19+)
        single<IChatRepository> { ChatRepositoryImpl() }
        single<IBroadcastRepository> { BroadcastRepositoryImpl() }
        single<IDrawSyncRepository> { DrawSyncRepositoryImpl() }
    }
