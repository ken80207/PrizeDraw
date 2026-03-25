package com.prizedraw.contracts.dto.leaderboard

import kotlinx.serialization.Serializable

@Serializable
public enum class LeaderboardType {
    DRAW_COUNT,
    PRIZE_GRADE,
    TRADE_VOLUME,
    CAMPAIGN_SPECIFIC,
}

@Serializable
public enum class LeaderboardPeriod {
    TODAY,
    THIS_WEEK,
    THIS_MONTH,
    ALL_TIME,
}

@Serializable
public data class LeaderboardDto(
    val type: LeaderboardType,
    val period: LeaderboardPeriod,
    val entries: List<LeaderboardEntryDto>,
    val selfRank: SelfRankDto?,
)

@Serializable
public data class LeaderboardEntryDto(
    val rank: Int,
    val playerId: String,
    val nickname: String,
    val avatarUrl: String?,
    val score: Long,
    val detail: String?,
)

@Serializable
public data class SelfRankDto(
    val rank: Int,
    val score: Long,
)
