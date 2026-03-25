package com.prizedraw.game.model

import com.prizedraw.game.coordinate.IsometricPoint
import kotlinx.serialization.Serializable

/**
 * The complete, engine-agnostic definition of a game-room map.
 *
 * All spatial measurements are in tiles unless stated otherwise.
 *
 * @property id Unique map identifier (e.g. "default_shop_v1").
 * @property width Number of tile columns.
 * @property height Number of tile rows.
 * @property tileWidth Width of one tile in pixels.
 * @property tileHeight Height of one tile in pixels.
 * @property layers Ordered list of tile layers, painted back-to-front by [MapLayer.zIndex].
 * @property spawnPoints Named isometric spawn positions (e.g. "entrance", "counter").
 * @property walkableGrid `[row][col]` boolean grid; `true` means a character can walk there.
 * @property objects Interactive or decorative objects placed on the map.
 */
@Serializable
public data class GameMap(
    val id: String,
    val width: Int,
    val height: Int,
    val tileWidth: Int = 64,
    val tileHeight: Int = 32,
    val layers: List<MapLayer>,
    val spawnPoints: Map<String, IsometricPoint>,
    val walkableGrid: List<List<Boolean>>,
    val objects: List<MapObject> = emptyList(),
)

/**
 * A single named tile layer inside a [GameMap].
 *
 * @property name Human-readable identifier (e.g. "floor", "walls", "objects").
 * @property tiles `[row][col]` grid of tile IDs; 0 means empty.
 * @property zIndex Determines paint order — lower values are drawn first (underneath).
 */
@Serializable
public data class MapLayer(
    val name: String,
    val tiles: List<List<Int>>,
    val zIndex: Int,
)

/**
 * A statically-placed object on the map.
 *
 * @property id Unique identifier within the map.
 * @property type Semantic category of the object.
 * @property position Isometric position of the object's anchor.
 * @property interactable Whether players can trigger an interaction with this object.
 * @property metadata Arbitrary key-value pairs for engine-specific or feature-specific data.
 */
@Serializable
public data class MapObject(
    val id: String,
    val type: MapObjectType,
    val position: IsometricPoint,
    val interactable: Boolean = false,
    val metadata: Map<String, String> = emptyMap(),
)

/** Semantic categories for objects placed on a [GameMap]. */
@Serializable
public enum class MapObjectType {
    /** A shelf displaying prizes or merchandise. */
    DISPLAY_SHELF,

    /** The kuji ticket counter where draws are conducted. */
    COUNTER,

    /** The entrance/exit point of the virtual shop. */
    ENTRANCE,

    /** A purely visual decoration with no interaction. */
    DECORATION,

    /** A visible marker indicating a player's position in queue. */
    QUEUE_MARKER,
}
