package com.prizedraw.application.usecases.leaderboard

import com.prizedraw.application.ports.input.leaderboard.IGetLeaderboardUseCase
import com.prizedraw.application.ports.output.ILeaderboardRepository
import com.prizedraw.contracts.dto.leaderboard.LeaderboardDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardEntryDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.dto.leaderboard.SelfRankDto
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.minus
import kotlinx.datetime.toLocalDateTime

/**
 * Fetches a leaderboard from the [ILeaderboardRepository] and assembles the DTO.
 *
 * Period boundaries are computed in UTC. Campaign-specific queries delegate to
 * [ILeaderboardRepository.findCampaignTopPlayers]; all others use
 * [ILeaderboardRepository.findGlobalTopPlayers].
 */
public class GetLeaderboardUseCase(
    private val leaderboardRepository: ILeaderboardRepository,
) : IGetLeaderboardUseCase {
    override suspend fun execute(
        type: LeaderboardType,
        period: LeaderboardPeriod,
        campaignId: CampaignId?,
        limit: Int,
        requestingPlayerId: PlayerId?,
    ): LeaderboardDto {
        val clampedLimit = limit.coerceIn(1, IGetLeaderboardUseCase.MAX_LIMIT)
        val (from, until) = period.toTimeWindow()

        val entries = fetchEntries(type, campaignId, from, until, clampedLimit)
        val selfRank = requestingPlayerId?.let { resolveSelfRank(it, from, until) }

        return LeaderboardDto(
            type = type,
            period = period,
            entries = entries,
            selfRank = selfRank,
        )
    }

    private suspend fun fetchEntries(
        type: LeaderboardType,
        campaignId: CampaignId?,
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntryDto> {
        val raw =
            if (type == LeaderboardType.CAMPAIGN_SPECIFIC && campaignId != null) {
                leaderboardRepository.findCampaignTopPlayers(campaignId, from, until, limit)
            } else {
                leaderboardRepository.findGlobalTopPlayers(from, until, limit)
            }
        return raw.map { entry ->
            LeaderboardEntryDto(
                rank = entry.rank,
                playerId = entry.playerId.value.toString(),
                nickname = entry.nickname,
                avatarUrl = null,
                score = entry.score,
                detail = null,
            )
        }
    }

    private suspend fun resolveSelfRank(
        playerId: PlayerId,
        from: Instant,
        until: Instant,
    ): SelfRankDto? {
        val rank = leaderboardRepository.findPlayerRank(playerId, from, until) ?: return null
        return SelfRankDto(rank = rank, score = 0L)
    }
}

// --- Period boundary helpers ---

internal fun LeaderboardPeriod.toTimeWindow(): Pair<Instant, Instant> {
    val now = Clock.System.now()
    val tz = TimeZone.UTC
    val today = now.toLocalDateTime(tz).date
    return when (this) {
        LeaderboardPeriod.TODAY -> {
            val start = today.atStartOfDayIn(tz)
            start to now
        }
        LeaderboardPeriod.THIS_WEEK -> {
            val weekStart = today.minus(today.dayOfWeek.ordinal, DateTimeUnit.DAY)
            weekStart.atStartOfDayIn(tz) to now
        }
        LeaderboardPeriod.THIS_MONTH -> {
            val monthStart = today.minus(today.dayOfMonth - 1, DateTimeUnit.DAY)
            monthStart.atStartOfDayIn(tz) to now
        }
        LeaderboardPeriod.ALL_TIME -> {
            Instant.fromEpochSeconds(0) to now
        }
    }
}
