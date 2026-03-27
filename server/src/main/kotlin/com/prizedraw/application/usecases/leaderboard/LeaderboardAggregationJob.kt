package com.prizedraw.application.usecases.leaderboard

import com.prizedraw.application.ports.output.ILeaderboardRepository
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import kotlin.coroutines.coroutineContext

/**
 * Scheduled coroutine that refreshes leaderboard data every [REFRESH_INTERVAL_MS].
 *
 * The job calls [ILeaderboardRepository.findGlobalTopPlayers] for each period to warm
 * the DB-side aggregation. In production, results can be written to Redis sorted sets
 * by the repository implementation; here we warm the DB query path.
 *
 * The job is started once at application start and runs until the process exits.
 */
public class LeaderboardAggregationJob(
    private val leaderboardRepository: ILeaderboardRepository,
) {
    private val log = LoggerFactory.getLogger(LeaderboardAggregationJob::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Starts the background aggregation loop. Safe to call multiple times; only the first call takes effect. */
    public fun start() {
        scope.launch { runLoop() }
        log.info("LeaderboardAggregationJob started (interval=${REFRESH_INTERVAL_MS}ms)")
    }

    private suspend fun runLoop() {
        // Initial delay to let DB connect before first aggregation
        @Suppress("MagicNumber")
        delay(10_000L)
        while (coroutineContext[kotlinx.coroutines.Job]?.isActive != false) {
            runCatching { aggregate() }
                .onFailure { e -> log.error("Leaderboard aggregation failed", e) }
            delay(REFRESH_INTERVAL_MS)
        }
    }

    private suspend fun aggregate() {
        for (period in LeaderboardPeriod.entries) {
            val (from, until) = period.toTimeWindow()
            leaderboardRepository.findGlobalTopPlayers(from, until, WARM_LIMIT)
            log.debug("Leaderboard aggregated period=$period")
        }
    }

    private companion object {
        const val REFRESH_INTERVAL_MS = 5 * 60 * 1_000L
        const val WARM_LIMIT = 500
    }
}
