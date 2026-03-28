package com.prizedraw.application.events

import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Background job that polls active kuji campaigns and dispatches low-stock notifications
 * to players who have favorited a campaign once its remaining ticket ratio drops below
 * [LOW_STOCK_THRESHOLD].
 *
 * The job runs every [POLL_INTERVAL_MS] milliseconds. Each eligible campaign is processed
 * at most once: [ICampaignRepository.markLowStockNotified] is called after all notifications
 * are enqueued so the campaign is excluded from subsequent polling cycles.
 *
 * Notification records are inserted via [INotificationRepository.batchInsertIgnore] using a
 * per-player dedup key (`favorite.campaign_low_stock:<campaignId>:<playerId>`), making the
 * operation idempotent in the event of a crash after insertion but before the mark call.
 *
 * @param campaignRepo Source of active, un-notified kuji campaigns and ticket counts.
 * @param favoriteRepo Source of player IDs who have favorited a given campaign.
 * @param notificationRepo Sink for persisted [Notification] records.
 * @param outboxRepo Sink for [FavoriteCampaignLowStock] outbox events.
 */
public class LowStockNotificationJob(
    private val campaignRepo: ICampaignRepository,
    private val favoriteRepo: ICampaignFavoriteRepository,
    private val notificationRepo: INotificationRepository,
    private val outboxRepo: IOutboxRepository,
) {
    private val log = LoggerFactory.getLogger(LowStockNotificationJob::class.java)
    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    /** Starts the background polling loop. */
    public fun start() {
        scope.launch {
            log.info("LowStockNotificationJob started; polling every {} min", POLL_INTERVAL_MINUTES)
            while (isActive) {
                @Suppress("TooGenericExceptionCaught")
                try {
                    checkLowStock()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    log.error("LowStockNotificationJob cycle error: {}", e.message, e)
                }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    /** Stops the polling loop by cancelling the coroutine scope. */
    public fun stop() {
        job.cancel()
        log.info("LowStockNotificationJob stopped")
    }

    private suspend fun checkLowStock() {
        val campaigns = campaignRepo.findActiveKujiCampaignsNotLowStockNotified()
        if (campaigns.isEmpty()) {
            log.debug("LowStockNotificationJob: no eligible campaigns")
            return
        }
        log.debug("LowStockNotificationJob: checking {} campaigns for low stock", campaigns.size)

        campaigns.forEach { campaign ->
            processCampaign(campaign)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun processCampaign(campaign: KujiCampaign) {
        val campaignId = campaign.id
        try {
            val total = campaignRepo.countTotalTickets(campaignId)
            if (total == 0) {
                log.debug("LowStockNotificationJob: campaign {} has 0 total tickets; skipping", campaignId.value)
                return
            }

            val remaining = campaignRepo.countRemainingTickets(campaignId)
            val ratio = remaining.toDouble() / total.toDouble()

            if (ratio >= LOW_STOCK_THRESHOLD) {
                log.debug(
                    "LowStockNotificationJob: campaign {} ratio={} >= threshold; skipping",
                    campaignId.value,
                    ratio,
                )
                return
            }

            log.info(
                "LowStockNotificationJob: campaign {} is low stock (remaining={}/{}, ratio={})",
                campaignId.value,
                remaining,
                total,
                ratio,
            )

            notifyFavoritingPlayers(campaignId, campaign.title)
            campaignRepo.markLowStockNotified(campaignId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            log.error(
                "LowStockNotificationJob: failed to process campaign {}: {}",
                campaignId.value,
                e.message,
                e,
            )
        }
    }

    private suspend fun notifyFavoritingPlayers(
        campaignId: CampaignId,
        campaignTitle: String,
    ) {
        val playerIds: List<UUID> = favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId)
        if (playerIds.isEmpty()) {
            log.debug(
                "LowStockNotificationJob: campaign {} has no favoriting players; skipping notifications",
                campaignId.value,
            )
            return
        }

        val notifications =
            playerIds.map { playerId ->
                Notification(
                    playerId = playerId,
                    eventType = "favorite.campaign_low_stock",
                    title = "收藏的活動即將售完",
                    body = "你收藏的『$campaignTitle』票券即將售完，把握機會！",
                    data =
                        mapOf(
                            "campaignId" to campaignId.value.toString(),
                            "campaignType" to CampaignType.KUJI.name,
                        ),
                    dedupKey = "favorite.campaign_low_stock:${campaignId.value}:$playerId",
                )
            }
        notificationRepo.batchInsertIgnore(notifications)

        playerIds.forEach { playerId ->
            outboxRepo.enqueue(
                FavoriteCampaignLowStock(
                    campaignId = campaignId.value,
                    playerId = playerId,
                ),
            )
        }

        log.info(
            "LowStockNotificationJob: dispatched low-stock notifications for campaign {} to {} players",
            campaignId.value,
            playerIds.size,
        )
    }

    private companion object {
        const val POLL_INTERVAL_MS = 5 * 60 * 1000L
        const val POLL_INTERVAL_MINUTES = 5L
        const val LOW_STOCK_THRESHOLD = 0.10
    }
}
