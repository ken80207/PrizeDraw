package com.prizedraw.contracts.dto.draw

import kotlinx.serialization.Serializable

/**
 * Request body for POST `/api/v1/draws/sync/progress`.
 *
 * @param sessionId The active draw sync session.
 * @param progress Animation progress in the range 0.0–1.0.
 */
@Serializable
public data class DrawProgressRequest(
    val sessionId: String,
    val progress: Float,
)

/**
 * Request body for POST `/api/v1/draws/sync/cancel`.
 *
 * @param sessionId The draw sync session to cancel.
 */
@Serializable
public data class DrawSyncCancelRequest(
    val sessionId: String,
)

/**
 * Request body for POST `/api/v1/draws/sync/complete`.
 *
 * @param sessionId The draw sync session to complete and reveal.
 */
@Serializable
public data class DrawSyncCompleteRequest(
    val sessionId: String,
)

/**
 * Represents a draw-sync event delivered over WebSocket to spectators.
 *
 * The [result] fields are only populated in events of type `DRAW_REVEALED`.
 *
 * @param type Event type identifier (e.g. `DRAW_STARTED`, `DRAW_PROGRESS`, `DRAW_REVEALED`).
 * @param sessionId Identifies the draw sync session.
 * @param progress Latest animation progress (populated for `DRAW_PROGRESS` events).
 * @param grade Revealed prize grade (`DRAW_REVEALED` only).
 * @param prizeName Revealed prize name (`DRAW_REVEALED` only).
 * @param photoUrl Revealed prize photo URL (`DRAW_REVEALED` only; may be `null`).
 */
@Serializable
public data class DrawSyncEventDto(
    val type: String,
    val sessionId: String,
    val progress: Float? = null,
    val grade: String? = null,
    val prizeName: String? = null,
    val photoUrl: String? = null,
)

/**
 * A single high-frequency touch-coordinate frame sent by the drawing player via
 * `C2S_DRAW_INPUT` and relayed to spectators as `DRAW_INPUT`.
 *
 * Frames are transmitted at up to 60 fps and are **never persisted** — they exist
 * solely as a live relay signal for the spectator UI to mirror the drawing gesture.
 *
 * @param sessionId The active draw sync session this frame belongs to.
 * @param x Normalised horizontal touch position in the range 0.0–1.0 (left → right).
 * @param y Normalised vertical touch position in the range 0.0–1.0 (top → bottom).
 * @param isDown `true` while the finger is in contact with the screen; `false` on lift.
 * @param timestamp Client-side epoch milliseconds at the moment the frame was captured.
 */
@Serializable
public data class DrawInputFrame(
    val sessionId: String,
    val x: Float,
    val y: Float,
    val isDown: Boolean,
    val timestamp: Long,
)
