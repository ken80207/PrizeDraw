package com.prizedraw.game.maps

import com.prizedraw.game.coordinate.IsometricPoint
import com.prizedraw.game.model.GameMap
import com.prizedraw.game.model.MapLayer
import com.prizedraw.game.model.MapObject
import com.prizedraw.game.model.MapObjectType

/**
 * Factory for the default isometric 一番賞 shop layout.
 *
 * The shop is a 10×10 tile grid with:
 * - Floor tiles covering the entire walkable area.
 * - Wall tiles along the north (row 0) and west (col 0) edges.
 * - An entrance at the south-centre (row 9, col 4–5).
 * - A counter along the north-centre (row 1, col 3–6).
 * - Display shelves along the east wall (one per [ticketBoxCount], max 8).
 * - Queue markers leading south from the counter.
 * - Walkable paths between all interactive objects.
 *
 * Tile ID legend (used in layer grids):
 * - [TILE_EMPTY]        = empty / no tile
 * - [TILE_FLOOR]        = floor (light)
 * - [TILE_WALL_NORTH]   = wall north-edge
 * - [TILE_WALL_WEST]    = wall west-edge
 * - [TILE_WALL_CORNER]  = wall corner north-west
 * - [TILE_ENTRANCE_MAT] = entrance mat
 * - [TILE_COUNTER]      = counter
 * - [TILE_SHELF]        = display shelf
 * - [TILE_QUEUE_MARKER] = queue marker
 */
public object DefaultShopMap {
    private const val MAP_WIDTH = 10
    private const val MAP_HEIGHT = 10
    private const val TILE_WIDTH = 64
    private const val TILE_HEIGHT = 32

    /** Maximum shelves that fit along the east wall (rows 1..8). */
    private const val MAX_SHELVES = 8

    // Tile IDs
    private const val TILE_EMPTY = 0
    private const val TILE_FLOOR = 1
    private const val TILE_WALL_NORTH = 2
    private const val TILE_WALL_WEST = 3
    private const val TILE_WALL_CORNER = 4
    private const val TILE_ENTRANCE_MAT = 5
    private const val TILE_COUNTER = 6
    private const val TILE_SHELF = 7
    private const val TILE_QUEUE_MARKER = 8

    // Layout constants — grid positions
    private const val COUNTER_ROW = 1
    private const val COUNTER_COL_START = 3
    private const val COUNTER_COL_END = 6
    private const val QUEUE_COL = 5
    private const val QUEUE_START_ROW = 3
    private const val QUEUE_END_ROW = 6
    private const val QUEUE_MARKER_COUNT = 4
    private const val ENTRANCE_COL_START = 4
    private const val ENTRANCE_COL_END = 5
    private const val EAST_WALL_COL = MAP_WIDTH - 1

    // Spawn-point coordinates (isometric units)
    private const val ENTRANCE_ISO_X = 4.5f
    private const val ENTRANCE_ISO_Y = 9f
    private const val COUNTER_ISO_X = 4.5f
    private const val COUNTER_ISO_Y = 1.5f
    private const val SHELF_ACCESS_COL = 8f
    private const val SHELF_ISO_COL = 9f
    private const val QUEUE_ISO_X = 5f
    private const val DECOR_NW_ISO_X = 1f
    private const val DECOR_NW_ISO_Y = 1f

    // Z-indices
    private const val Z_FLOOR = 0
    private const val Z_WALLS = 1
    private const val Z_OBJECTS = 2

    /**
     * Creates a pre-built default shop [GameMap].
     *
     * @param campaignTitle Title used as the map `id` prefix.
     * @param ticketBoxCount Number of distinct prize tiers / ticket boxes to display.
     *   Clamped to [MAX_SHELVES] if larger.
     * @param maxQueueSize Maximum queue length; stored in the entrance spawn metadata.
     * @return A fully initialised [GameMap] ready for server or client use.
     */
    public fun create(
        campaignTitle: String,
        ticketBoxCount: Int,
        maxQueueSize: Int = 20,
    ): GameMap {
        val safeShelfCount = ticketBoxCount.coerceIn(1, MAX_SHELVES)
        val mapId = "shop_${campaignTitle.lowercase().replace(' ', '_')}"

        return GameMap(
            id = mapId,
            width = MAP_WIDTH,
            height = MAP_HEIGHT,
            tileWidth = TILE_WIDTH,
            tileHeight = TILE_HEIGHT,
            layers = listOf(buildFloorLayer(), buildWallLayer(), buildObjectLayer(safeShelfCount)),
            spawnPoints = buildSpawnPoints(safeShelfCount),
            walkableGrid = buildWalkableGrid(),
            objects = buildObjects(safeShelfCount, maxQueueSize),
        )
    }

    // ---------------------------------------------------------------------------
    // Layer builders
    // ---------------------------------------------------------------------------

    private fun buildFloorLayer(): MapLayer {
        val tiles =
            List(MAP_HEIGHT) { row ->
                List(MAP_WIDTH) { col ->
                    if (row == 0 || col == 0) {
                        TILE_EMPTY
                    } else {
                        TILE_FLOOR
                    }
                }
            }
        return MapLayer(name = "floor", tiles = tiles, zIndex = Z_FLOOR)
    }

    private fun buildWallLayer(): MapLayer {
        val tiles =
            List(MAP_HEIGHT) { row ->
                List(MAP_WIDTH) { col ->
                    when {
                        row == 0 && col == 0 -> TILE_WALL_CORNER
                        row == 0 -> TILE_WALL_NORTH
                        col == 0 -> TILE_WALL_WEST
                        row == MAP_HEIGHT - 1 && col in ENTRANCE_COL_START..ENTRANCE_COL_END ->
                            TILE_ENTRANCE_MAT
                        else -> TILE_EMPTY
                    }
                }
            }
        return MapLayer(name = "walls", tiles = tiles, zIndex = Z_WALLS)
    }

    private fun buildObjectLayer(shelfCount: Int): MapLayer {
        val tiles =
            List(MAP_HEIGHT) { row ->
                List(MAP_WIDTH) { col ->
                    when {
                        row == COUNTER_ROW && col in COUNTER_COL_START..COUNTER_COL_END -> TILE_COUNTER
                        col == EAST_WALL_COL && row in 1..shelfCount -> TILE_SHELF
                        col == QUEUE_COL && row in QUEUE_START_ROW..QUEUE_END_ROW -> TILE_QUEUE_MARKER
                        else -> TILE_EMPTY
                    }
                }
            }
        return MapLayer(name = "objects", tiles = tiles, zIndex = Z_OBJECTS)
    }

    // ---------------------------------------------------------------------------
    // Walkable grid
    // ---------------------------------------------------------------------------

    /**
     * Builds the walkable grid.
     *
     * Non-walkable cells:
     * - Row 0 (north wall)
     * - Col 0 (west wall)
     * - Col [EAST_WALL_COL] (east wall / display shelves)
     * - Counter: row [COUNTER_ROW], cols [COUNTER_COL_START]..[COUNTER_COL_END]
     */
    private fun buildWalkableGrid(): List<List<Boolean>> =
        List(MAP_HEIGHT) { row ->
            List(MAP_WIDTH) { col ->
                when {
                    row == 0 -> false
                    col == 0 -> false
                    col == EAST_WALL_COL -> false
                    row == COUNTER_ROW && col in COUNTER_COL_START..COUNTER_COL_END -> false
                    else -> true
                }
            }
        }

    // ---------------------------------------------------------------------------
    // Spawn points
    // ---------------------------------------------------------------------------

    private fun buildSpawnPoints(shelfCount: Int): Map<String, IsometricPoint> {
        val points = mutableMapOf<String, IsometricPoint>()

        points["entrance"] = IsometricPoint(isoX = ENTRANCE_ISO_X, isoY = ENTRANCE_ISO_Y)
        points["counter"] = IsometricPoint(isoX = COUNTER_ISO_X, isoY = COUNTER_ISO_Y)

        for (i in 0 until shelfCount) {
            points["display_${i + 1}"] = IsometricPoint(isoX = SHELF_ACCESS_COL, isoY = (i + 1).toFloat())
        }

        for (queuePos in 0 until QUEUE_MARKER_COUNT) {
            points["queue_$queuePos"] =
                IsometricPoint(isoX = QUEUE_ISO_X, isoY = (QUEUE_START_ROW + queuePos).toFloat())
        }

        return points
    }

    // ---------------------------------------------------------------------------
    // Map objects
    // ---------------------------------------------------------------------------

    private fun buildObjects(
        shelfCount: Int,
        maxQueueSize: Int,
    ): List<MapObject> {
        val objects = mutableListOf<MapObject>()

        objects.add(buildEntrance(maxQueueSize))
        objects.add(buildCounter())
        objects.addAll(buildShelves(shelfCount))
        objects.addAll(buildQueueMarkers())
        objects.add(buildNorthWestDecoration())

        return objects
    }

    private fun buildEntrance(maxQueueSize: Int) =
        MapObject(
            id = "entrance",
            type = MapObjectType.ENTRANCE,
            position = IsometricPoint(isoX = ENTRANCE_ISO_X, isoY = ENTRANCE_ISO_Y),
            interactable = false,
            metadata = mapOf("maxQueueSize" to maxQueueSize.toString()),
        )

    private fun buildCounter() =
        MapObject(
            id = "counter",
            type = MapObjectType.COUNTER,
            position = IsometricPoint(isoX = COUNTER_ISO_X, isoY = COUNTER_ISO_Y),
            interactable = true,
        )

    private fun buildShelves(shelfCount: Int): List<MapObject> =
        (0 until shelfCount).map { i ->
            MapObject(
                id = "shelf_${i + 1}",
                type = MapObjectType.DISPLAY_SHELF,
                position = IsometricPoint(isoX = SHELF_ISO_COL, isoY = (i + 1).toFloat()),
                interactable = true,
                metadata = mapOf("ticketBoxIndex" to i.toString()),
            )
        }

    private fun buildQueueMarkers(): List<MapObject> =
        (0 until QUEUE_MARKER_COUNT).map { queuePos ->
            MapObject(
                id = "queue_marker_$queuePos",
                type = MapObjectType.QUEUE_MARKER,
                position =
                    IsometricPoint(
                        isoX = QUEUE_ISO_X,
                        isoY = (QUEUE_START_ROW + queuePos).toFloat(),
                    ),
                interactable = false,
                metadata = mapOf("queueIndex" to queuePos.toString()),
            )
        }

    private fun buildNorthWestDecoration() =
        MapObject(
            id = "decoration_nw",
            type = MapObjectType.DECORATION,
            position = IsometricPoint(isoX = DECOR_NW_ISO_X, isoY = DECOR_NW_ISO_Y),
            interactable = false,
        )
}
