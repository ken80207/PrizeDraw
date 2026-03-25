package com.prizedraw.application.usecases.trade

import com.prizedraw.application.ports.input.trade.ICancelTradeListingUseCase
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Cancels a LISTED trade listing and restores the prize instance to HOLDING.
 */
public class CancelTradeListingUseCase(
    private val tradeRepository: ITradeRepository,
    private val prizeRepository: IPrizeRepository,
) : ICancelTradeListingUseCase {
    override suspend fun execute(
        sellerId: PlayerId,
        listingId: UUID,
    ): Unit =
        newSuspendedTransaction {
            val listing =
                tradeRepository.findById(listingId)
                    ?: throw TradeListingNotFoundException("Listing $listingId not found")
            if (listing.sellerId != sellerId) {
                throw ListingNotAvailableException("Listing $listingId does not belong to player")
            }
            if (listing.status != TradeOrderStatus.LISTED) {
                throw ListingNotAvailableException(
                    "Listing $listingId cannot be cancelled in state: ${listing.status}",
                )
            }
            val now = Clock.System.now()
            tradeRepository.save(
                listing.copy(status = TradeOrderStatus.CANCELLED, cancelledAt = now, updatedAt = now),
            )
            prizeRepository.updateInstanceState(
                id = listing.prizeInstanceId,
                newState = PrizeState.HOLDING,
                expectedState = PrizeState.TRADING,
            )
        }
}
