package com.prizedraw.game.coordinate

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * A position expressed in isometric (tile) coordinates.
 *
 * @property isoX Horizontal tile axis (increases east).
 * @property isoY Vertical tile axis (increases south).
 */
@Serializable
public data class IsometricPoint(
    val isoX: Float,
    val isoY: Float,
)

/**
 * A position in 2-D screen (pixel) space, origin at top-left.
 *
 * @property x Horizontal pixel offset.
 * @property y Vertical pixel offset.
 */
@Serializable
public data class ScreenPoint(
    val x: Float,
    val y: Float,
)

/**
 * Pure-math coordinate-conversion utilities for an isometric grid.
 *
 * All functions are stateless and engine-agnostic; they contain no rendering calls.
 *
 * Conventions (same as the roadmap spec):
 * ```
 * screenX = (isoX - isoY) * (tileWidth  / 2)
 * screenY = (isoX + isoY) * (tileHeight / 2)
 * ```
 */
public object CoordinateSystem {
    /**
     * Converts an isometric position to screen-pixel coordinates.
     *
     * @param iso The isometric position to convert.
     * @param tileWidth Width of one tile in pixels.
     * @param tileHeight Height of one tile in pixels (typically tileWidth / 2 for 2:1 iso).
     * @return The corresponding [ScreenPoint].
     */
    public fun isoToScreen(
        iso: IsometricPoint,
        tileWidth: Int,
        tileHeight: Int,
    ): ScreenPoint {
        val screenX = (iso.isoX - iso.isoY) * (tileWidth / 2f)
        val screenY = (iso.isoX + iso.isoY) * (tileHeight / 2f)
        return ScreenPoint(screenX, screenY)
    }

    /**
     * Converts a screen-pixel position back to isometric coordinates.
     *
     * @param screen The screen position to convert.
     * @param tileWidth Width of one tile in pixels.
     * @param tileHeight Height of one tile in pixels.
     * @return The corresponding [IsometricPoint].
     */
    public fun screenToIso(
        screen: ScreenPoint,
        tileWidth: Int,
        tileHeight: Int,
    ): IsometricPoint {
        val halfW = tileWidth / 2f
        val halfH = tileHeight / 2f
        val isoX = (screen.x / halfW + screen.y / halfH) / 2f
        val isoY = (screen.y / halfH - screen.x / halfW) / 2f
        return IsometricPoint(isoX, isoY)
    }

    /**
     * Converts integer tile grid coordinates to an [IsometricPoint].
     *
     * Tile (0, 0) maps to iso (0, 0). Column increases east; row increases south.
     *
     * @param tileCol Column index (x-axis) of the tile.
     * @param tileRow Row index (y-axis) of the tile.
     * @return Centre of the tile as an [IsometricPoint].
     */
    public fun tileToIso(
        tileCol: Int,
        tileRow: Int,
    ): IsometricPoint = IsometricPoint(tileCol.toFloat(), tileRow.toFloat())

    /**
     * Converts an [IsometricPoint] to the nearest integer tile coordinates.
     *
     * @param iso The isometric point to snap to a tile.
     * @return A [Pair] of `(col, row)` tile indices.
     */
    public fun isoToTile(iso: IsometricPoint): Pair<Int, Int> = Pair(iso.isoX.toInt(), iso.isoY.toInt())

    /**
     * Euclidean distance between two isometric points.
     *
     * @param a First point.
     * @param b Second point.
     * @return Distance in isometric units.
     */
    public fun distance(
        a: IsometricPoint,
        b: IsometricPoint,
    ): Float {
        val dx = a.isoX - b.isoX
        val dy = a.isoY - b.isoY
        return sqrt(dx * dx + dy * dy)
    }

    /**
     * Manhattan distance between two isometric points (no sqrt).
     *
     * @param a First point.
     * @param b Second point.
     * @return Manhattan distance in isometric units.
     */
    public fun manhattanDistance(
        a: IsometricPoint,
        b: IsometricPoint,
    ): Float = abs(a.isoX - b.isoX) + abs(a.isoY - b.isoY)
}
