package com.prizedraw.game.pathfinding

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * A* pathfinder that operates on the `walkableGrid` from [com.prizedraw.game.model.GameMap].
 *
 * Grid convention: `walkableGrid[row][col]` — `true` means passable.
 * Coordinates are expressed as `Pair(col, row)` throughout this class.
 *
 * The implementation is engine-agnostic and produces no side effects.
 */
public object AStarPathfinder {
    private val SQRT2 = sqrt(2f)

    /** Cardinal (N/S/E/W) movement directions as (dCol, dRow). */
    private val CARDINAL_DIRS = listOf(0 to 1, 1 to 0, 0 to -1, -1 to 0)

    /** Diagonal movement directions as (dCol, dRow). */
    private val DIAGONAL_DIRS = listOf(1 to 1, 1 to -1, -1 to 1, -1 to -1)

    /**
     * Finds the shortest path between [start] and [end] on [walkableGrid].
     *
     * @param walkableGrid 2-D grid where `grid[row][col] == true` means walkable.
     * @param start Starting `(col, row)` tile coordinate.
     * @param end Destination `(col, row)` tile coordinate.
     * @param allowDiagonal When `true`, 8-directional movement is permitted;
     *   otherwise only 4-directional movement is used.
     * @return Ordered list of `(col, row)` tiles from [start] to [end] (both inclusive),
     *   or `null` if no path exists. Returns an empty list when [start] equals [end].
     */
    public fun findPath(
        walkableGrid: List<List<Boolean>>,
        start: Pair<Int, Int>,
        end: Pair<Int, Int>,
        allowDiagonal: Boolean = true,
    ): List<Pair<Int, Int>>? {
        if (walkableGrid.isEmpty() || walkableGrid[0].isEmpty()) {
            return null
        }
        val ctx = GridContext(walkableGrid, end, allowDiagonal)
        return ctx.search(start, end)
    }

    /** Walks the [parent] map back from [end] to [start] and returns the ordered path. */
    private fun reconstructPath(
        parent: Map<Int, Int>,
        rows: Int,
        start: Pair<Int, Int>,
        end: Pair<Int, Int>,
    ): List<Pair<Int, Int>> {
        val path = mutableListOf<Pair<Int, Int>>()
        var col = end.first
        var row = end.second

        while (!(col == start.first && row == start.second)) {
            path.add(col to row)
            val key = col * rows + row
            val prevKey = parent[key] ?: break
            if (prevKey == -1) {
                break
            }
            col = prevKey / rows
            row = prevKey % rows
        }

        path.add(start.first to start.second)
        path.reverse()
        return path
    }

    /** An entry in the A* open list. */
    private data class OpenEntry(
        val col: Int,
        val row: Int,
        val gCost: Float,
        val fCost: Float,
    )

    /**
     * Carries all per-search state: grid dimensions, goal, directions, and the
     * admissible heuristic. Splitting this out keeps [findPath] simple and
     * reduces its cyclomatic complexity.
     */
    private class GridContext(
        private val grid: List<List<Boolean>>,
        private val end: Pair<Int, Int>,
        allowDiagonal: Boolean,
    ) {
        val rows: Int = grid.size
        val cols: Int = grid[0].size
        private val directions =
            if (allowDiagonal) {
                CARDINAL_DIRS + DIAGONAL_DIRS
            } else {
                CARDINAL_DIRS
            }
        private val use8Dir = allowDiagonal

        fun inBounds(
            col: Int,
            row: Int,
        ): Boolean = col in 0 until cols && row in 0 until rows

        fun walkable(
            col: Int,
            row: Int,
        ): Boolean = inBounds(col, row) && grid[row][col]

        fun cellKey(
            col: Int,
            row: Int,
        ): Int = col * rows + row

        /** Chebyshev for 8-dir (admissible), Manhattan for 4-dir (admissible). */
        fun heuristic(
            col: Int,
            row: Int,
        ): Float {
            val dx = abs(col - end.first)
            val dy = abs(row - end.second)
            return if (use8Dir) {
                maxOf(dx, dy).toFloat()
            } else {
                (dx + dy).toFloat()
            }
        }

        fun moveCost(
            dCol: Int,
            dRow: Int,
        ): Float =
            if (dCol != 0 && dRow != 0) {
                SQRT2
            } else {
                1f
            }

        /**
         * Runs the A* search from [start] to [end].
         *
         * @return Path or `null` if unreachable. Empty list when start == end.
         */
        fun search(
            start: Pair<Int, Int>,
            end: Pair<Int, Int>,
        ): List<Pair<Int, Int>>? {
            if (!walkable(start.first, start.second)) {
                return null
            }
            if (!walkable(end.first, end.second)) {
                return null
            }
            if (start == end) {
                return emptyList()
            }

            val parent = HashMap<Int, Int>()
            val bestG = HashMap<Int, Float>()
            val open = ArrayDeque<OpenEntry>()

            val startKey = cellKey(start.first, start.second)
            open.add(OpenEntry(start.first, start.second, 0f, heuristic(start.first, start.second)))
            bestG[startKey] = 0f
            parent[startKey] = -1

            while (open.isNotEmpty()) {
                val current = open.minByOrNull { it.fCost } ?: break
                open.remove(current)

                if (current.col == end.first && current.row == end.second) {
                    return reconstructPath(parent, rows, start, end)
                }

                expandNode(current, parent, bestG, open)
            }

            return null
        }

        private fun expandNode(
            current: OpenEntry,
            parent: HashMap<Int, Int>,
            bestG: HashMap<Int, Float>,
            open: ArrayDeque<OpenEntry>,
        ) {
            for ((dCol, dRow) in directions) {
                val nCol = current.col + dCol
                val nRow = current.row + dRow
                if (!walkable(nCol, nRow)) {
                    continue
                }

                val newG = current.gCost + moveCost(dCol, dRow)
                val nk = cellKey(nCol, nRow)

                if (newG < (bestG[nk] ?: Float.MAX_VALUE)) {
                    bestG[nk] = newG
                    parent[nk] = cellKey(current.col, current.row)
                    open.add(OpenEntry(nCol, nRow, newG, newG + heuristic(nCol, nRow)))
                }
            }
        }
    }
}
