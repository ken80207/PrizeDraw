package com.prizedraw.game.model

import kotlinx.serialization.Serializable

/**
 * Describes a single named animation that references frames within a sprite sheet.
 *
 * AnimationDef is purely declarative — it carries no rendering calls.
 *
 * @property key Unique name for this animation (e.g. "walk_south", "celebrate").
 * @property spriteSheetKey Key of the [SpriteSheetDef] that contains the frames.
 * @property frames Ordered list of frame indices within the sprite sheet.
 * @property frameDurationMs Duration of each frame in milliseconds.
 * @property loop Whether the animation restarts after the last frame.
 */
@Serializable
public data class AnimationDef(
    val key: String,
    val spriteSheetKey: String,
    val frames: List<Int>,
    val frameDurationMs: Int,
    val loop: Boolean = false,
)

/**
 * Metadata for a sprite sheet image and the animations it hosts.
 *
 * The renderer is responsible for loading the image at [url]; this class only
 * describes the layout.
 *
 * @property key Unique identifier used to reference this sheet (e.g. "char_default").
 * @property url CDN or relative URL of the sheet image.
 * @property frameWidth Width of a single frame in pixels.
 * @property frameHeight Height of a single frame in pixels.
 * @property columns Number of frame columns in the sheet.
 * @property animations Named animations contained in this sheet, keyed by animation key.
 */
@Serializable
public data class SpriteSheetDef(
    val key: String,
    val url: String,
    val frameWidth: Int,
    val frameHeight: Int,
    val columns: Int,
    val animations: Map<String, AnimationDef> = emptyMap(),
)

/**
 * Complete asset manifest that a renderer must load before a room can be displayed.
 *
 * @property spriteSheets Character and object sprite sheets.
 * @property tilesets Tile images for rendering [com.prizedraw.game.model.MapLayer] grids.
 * @property sounds Optional sound-effect definitions.
 */
@Serializable
public data class AssetManifest(
    val spriteSheets: List<SpriteSheetDef>,
    val tilesets: List<TilesetDef>,
    val sounds: List<SoundDef> = emptyList(),
)

/**
 * Metadata for a tileset image used to render map layers.
 *
 * @property key Unique identifier used in [com.prizedraw.game.model.MapLayer] tile IDs.
 * @property url CDN or relative URL of the tileset image.
 * @property tileWidth Width of a single tile in pixels.
 * @property tileHeight Height of a single tile in pixels.
 * @property columns Number of tile columns in the tileset.
 */
@Serializable
public data class TilesetDef(
    val key: String,
    val url: String,
    val tileWidth: Int,
    val tileHeight: Int,
    val columns: Int,
)

/**
 * A single audio-effect asset.
 *
 * @property key Unique identifier (e.g. "sfx_celebrate", "sfx_queue_advance").
 * @property url CDN or relative URL of the audio file.
 */
@Serializable
public data class SoundDef(
    val key: String,
    val url: String,
)
