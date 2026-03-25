package com.prizedraw.game.pathfinding

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AStarPathfinderTest {
    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /** Build an all-walkable grid of [cols] columns × [rows] rows. */
    private fun openGrid(
        cols: Int = 5,
        rows: Int = 5,
    ): List<List<Boolean>> = List(rows) { List(cols) { true } }

    /**
     * 7×7 grid with a partial vertical wall at col=3, rows 1–5 blocked.
     * Row 0 and row 6 are open — characters must detour around the wall.
     *
     * ```
     * . . . . . . .   row 0 — gap top
     * . . . # . . .   row 1 — wall
     * . . . # . . .   row 2 — wall
     * . . . # . . .   row 3 — wall
     * . . . # . . .   row 4 — wall
     * . . . # . . .   row 5 — wall
     * . . . . . . .   row 6 — gap bottom
     * ```
     */
    private fun gridWithPartialWall(): List<List<Boolean>> =
        List(7) { row ->
            List(7) { col ->
                !(col == 3 && row in 1..5)
            }
        }

    /**
     * 6×6 grid with a single-cell obstacle in the middle.
     * Start (0,3) to end (5,3) — path must go around the block at (3,3).
     */
    private fun gridWithSingleObstacle(): List<List<Boolean>> =
        List(6) { row ->
            List(6) { col ->
                !(row == 3 && col == 3)
            }
        }

    /** Build a grid that is completely blocked except for start and end cells. */
    private fun fullyBlockedGrid(): List<List<Boolean>> =
        List(5) { row ->
            List(5) { col ->
                (row == 0 && col == 0) || (row == 4 && col == 4)
            }
        }

    // -----------------------------------------------------------------------
    // Basic correctness
    // -----------------------------------------------------------------------

    @Test
    fun directPath_noObstacles() {
        val path = AStarPathfinder.findPath(openGrid(), 0 to 0, 4 to 4)
        assertNotNull(path)
        assertEquals(0 to 0, path.first())
        assertEquals(4 to 4, path.last())
        assertTrue(path.size >= 5, "Expected at least 5 steps on a 5×5 grid diagonal")
    }

    @Test
    fun startEqualsEnd_returnsEmptyList() {
        val path = AStarPathfinder.findPath(openGrid(), 2 to 2, 2 to 2)
        assertNotNull(path)
        assertEquals(emptyList(), path)
    }

    @Test
    fun pathAroundObstacle_4directional() {
        // Partial wall at col=3 rows 1–5; gaps at rows 0 and 6.
        // Path must detour through row 0 or row 6 to bypass the wall.
        val grid = gridWithPartialWall()
        val path = AStarPathfinder.findPath(grid, 0 to 3, 6 to 3, allowDiagonal = false)
        assertNotNull(path, "Expected a path to exist around the partial wall")
        assertEquals(0 to 3, path.first())
        assertEquals(6 to 3, path.last())
        // No cell in the path may be on the wall segment (col=3, rows 1–5)
        assertTrue(
            path.none { (col, row) -> col == 3 && row in 1..5 },
            "Path must not cross the wall",
        )
        // Every consecutive step is exactly 1 tile in cardinal direction
        for (i in 1 until path.size) {
            val dc = abs(path[i].first - path[i - 1].first)
            val dr = abs(path[i].second - path[i - 1].second)
            assertEquals(1, dc + dr, "Step $i not cardinal: ${path[i - 1]} → ${path[i]}")
        }
    }

    @Test
    fun pathAroundSingleObstacle_diagonal() {
        // Single cell blocked at (3,3) in a 6×6 grid — diagonal is allowed.
        val grid = gridWithSingleObstacle()
        val path = AStarPathfinder.findPath(grid, 0 to 3, 5 to 3, allowDiagonal = true)
        assertNotNull(path, "Expected a diagonal path around the obstacle")
        assertEquals(0 to 3, path.first())
        assertEquals(5 to 3, path.last())
        assertTrue(path.none { (col, row) -> col == 3 && row == 3 }, "Path must avoid (3,3)")
    }

    @Test
    fun noPath_completelyBlocked() {
        val path = AStarPathfinder.findPath(fullyBlockedGrid(), 0 to 0, 4 to 4)
        assertNull(path)
    }

    @Test
    fun blockedStart_returnsNull() {
        val blockedGrid =
            List(5) { row ->
                List(5) { col ->
                    !(row == 0 && col == 0)
                }
            }
        val path = AStarPathfinder.findPath(blockedGrid, 0 to 0, 4 to 4)
        assertNull(path)
    }

    @Test
    fun blockedEnd_returnsNull() {
        val blockedGrid =
            List(5) { row ->
                List(5) { col ->
                    !(row == 4 && col == 4)
                }
            }
        val path = AStarPathfinder.findPath(blockedGrid, 0 to 0, 4 to 4)
        assertNull(path)
    }

    // -----------------------------------------------------------------------
    // Diagonal movement
    // -----------------------------------------------------------------------

    @Test
    fun diagonalMovement_allowedByDefault() {
        val path = AStarPathfinder.findPath(openGrid(), 0 to 0, 4 to 4)
        assertNotNull(path)
        // On an open 5×5 grid, the optimal diagonal path is exactly 5 tiles (start + 4 diagonal steps)
        assertEquals(5, path.size)
    }

    @Test
    fun diagonalMovement_disabled_longerOrEqualPath() {
        val path4 = AStarPathfinder.findPath(openGrid(), 0 to 0, 4 to 4, allowDiagonal = false)
        val path8 = AStarPathfinder.findPath(openGrid(), 0 to 0, 4 to 4, allowDiagonal = true)
        assertNotNull(path4)
        assertNotNull(path8)
        assertTrue(path4.size >= path8.size, "4-directional path should be at least as long as 8-directional")
    }

    @Test
    fun diagonalPath_eachStepIsAdjacent() {
        val path = AStarPathfinder.findPath(openGrid(10, 10), 0 to 0, 9 to 9)
        assertNotNull(path)
        for (i in 1 until path.size) {
            val (c0, r0) = path[i - 1]
            val (c1, r1) = path[i]
            val dc = abs(c1 - c0)
            val dr = abs(r1 - r0)
            assertTrue(
                dc <= 1 && dr <= 1 && (dc + dr) > 0,
                "Step $i is not adjacent: ${path[i - 1]} → ${path[i]}",
            )
        }
    }

    // -----------------------------------------------------------------------
    // Path validity
    // -----------------------------------------------------------------------

    @Test
    fun pathCellsAreAllWalkable() {
        // Use partial-wall grid — path exists and must stay on walkable cells
        val grid = gridWithPartialWall()
        val path = AStarPathfinder.findPath(grid, 0 to 3, 6 to 3, allowDiagonal = true)
        assertNotNull(path, "Expected a path to exist")
        for ((col, row) in path) {
            assertTrue(grid[row][col], "Cell ($col, $row) in path is not walkable")
        }
    }

    @Test
    fun pathStartAndEndAreCorrect_onLargeGrid() {
        val grid = openGrid(20, 20)
        val path = AStarPathfinder.findPath(grid, 0 to 0, 19 to 19)
        assertNotNull(path)
        assertEquals(0 to 0, path.first())
        assertEquals(19 to 19, path.last())
    }
}
