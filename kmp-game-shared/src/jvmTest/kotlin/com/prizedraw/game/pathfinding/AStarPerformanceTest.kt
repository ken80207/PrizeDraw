package com.prizedraw.game.pathfinding

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * JVM-only performance test for [AStarPathfinder].
 *
 * Kept separate from commonTest because it relies on [System.currentTimeMillis].
 */
class AStarPerformanceTest {
    @Test
    fun largeGrid_100x100_completesUnder500ms() {
        val size = 100
        val grid = List(size) { List(size) { true } }
        val start = System.currentTimeMillis()
        val path = AStarPathfinder.findPath(grid, 0 to 0, size - 1 to size - 1)
        val elapsed = System.currentTimeMillis() - start
        assertNotNull(path)
        assertTrue(elapsed < 500, "Pathfinding took ${elapsed}ms on a 100×100 grid — expected < 500ms")
    }
}
