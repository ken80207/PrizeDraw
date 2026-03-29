package com.prizedraw.realtime.infrastructure.persistence

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.FeedEvent
import com.prizedraw.realtime.ports.IFeedEventRepository
import com.prizedraw.schema.tables.FeedEventsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed-backed implementation of [IFeedEventRepository] for the realtime-gateway.
 *
 * Timestamps are stored as [OffsetDateTime] (UTC) to match the `TIMESTAMPTZ` column type
 * used throughout this project.
 */
public class FeedEventRepositoryImpl : IFeedEventRepository {
    override suspend fun save(event: FeedEvent): Unit =
        newSuspendedTransaction {
            FeedEventsTable.insert {
                it[id] = event.id
                it[drawId] = event.drawId
                it[playerId] = event.playerId
                it[playerNickname] = event.playerNickname
                it[playerAvatarUrl] = event.playerAvatarUrl
                it[campaignId] = event.campaignId
                it[campaignTitle] = event.campaignTitle
                it[campaignType] = event.campaignType.name
                it[prizeGrade] = event.prizeGrade
                it[prizeName] = event.prizeName
                it[prizePhotoUrl] = event.prizePhotoUrl
                it[drawnAt] = OffsetDateTime.ofInstant(event.drawnAt.toJavaInstant(), ZoneOffset.UTC)
                it[createdAt] = OffsetDateTime.ofInstant(event.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
        }

    override suspend fun findRecent(limit: Int): List<FeedEvent> =
        newSuspendedTransaction {
            FeedEventsTable
                .selectAll()
                .orderBy(FeedEventsTable.drawnAt, SortOrder.DESC)
                .limit(limit)
                .map { row ->
                    FeedEvent(
                        id = row[FeedEventsTable.id],
                        drawId = row[FeedEventsTable.drawId],
                        playerId = row[FeedEventsTable.playerId],
                        playerNickname = row[FeedEventsTable.playerNickname],
                        playerAvatarUrl = row[FeedEventsTable.playerAvatarUrl],
                        campaignId = row[FeedEventsTable.campaignId],
                        campaignTitle = row[FeedEventsTable.campaignTitle],
                        campaignType = CampaignType.valueOf(row[FeedEventsTable.campaignType]),
                        prizeGrade = row[FeedEventsTable.prizeGrade],
                        prizeName = row[FeedEventsTable.prizeName],
                        prizePhotoUrl = row[FeedEventsTable.prizePhotoUrl],
                        drawnAt = row[FeedEventsTable.drawnAt].toInstant().toKotlinInstant(),
                        createdAt = row[FeedEventsTable.createdAt].toInstant().toKotlinInstant(),
                    )
                }
        }
}
