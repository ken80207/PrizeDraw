/**
 * WebSocket client extension for draw-sync events on the kuji room channel.
 *
 * The kuji WebSocket (`/ws/kuji/{campaignId}`) multiplexes both board events
 * (BOARD_SNAPSHOT, TICKET_DRAWN) and draw-sync events (DRAW_STARTED,
 * DRAW_PROGRESS, DRAW_CANCELLED, DRAW_REVEALED) on the same connection.
 *
 * This module adds typed interfaces for the draw-sync event shapes emitted by
 * `DrawSyncService.kt` and exports a thin factory that wires them into an
 * existing `connectKujiWebSocket` callback without opening a second socket.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event shape types — mirror DrawSyncEvent sealed class in DrawSyncService.kt
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawStartedEvent {
  type: "DRAW_STARTED";
  sessionId: string;
  ticketId: string | null;
  playerId: string;
  /** TEAR | SCRATCH | FLIP | INSTANT */
  animationMode: string;
}

export interface DrawProgressEvent {
  type: "DRAW_PROGRESS";
  sessionId: string;
  /** Normalised 0.0 – 1.0 */
  progress: number;
}

export interface DrawCancelledEvent {
  type: "DRAW_CANCELLED";
  sessionId: string;
}

export interface DrawRevealedEvent {
  type: "DRAW_REVEALED";
  sessionId: string;
  ticketId: string | null;
  grade: string;
  prizeName: string;
  photoUrl: string | null;
}

export type DrawSyncEvent =
  | DrawStartedEvent
  | DrawProgressEvent
  | DrawCancelledEvent
  | DrawRevealedEvent;

export type DrawSyncEventType =
  | "DRAW_STARTED"
  | "DRAW_PROGRESS"
  | "DRAW_CANCELLED"
  | "DRAW_REVEALED";

// ─────────────────────────────────────────────────────────────────────────────
// Type guard
// ─────────────────────────────────────────────────────────────────────────────

const DRAW_SYNC_TYPES: ReadonlySet<string> = new Set<DrawSyncEventType>([
  "DRAW_STARTED",
  "DRAW_PROGRESS",
  "DRAW_CANCELLED",
  "DRAW_REVEALED",
]);

/**
 * Returns true when `msg` is one of the draw-sync event types, allowing the
 * kuji board message handler to route draw-sync events separately.
 */
export function isDrawSyncEvent(msg: { type: string }): msg is DrawSyncEvent {
  return DRAW_SYNC_TYPES.has(msg.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nickname lookup helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight in-memory cache mapping playerId → nickname for the current
 * session. The kuji board does not carry player nicknames on draw-sync events
 * (the server intentionally strips them to prevent spoilers), so the UI falls
 * back to a short masked ID when a nickname is not available.
 *
 * Call `registerPlayerNickname` whenever the auth store has a known nickname.
 */
const nicknameCache = new Map<string, string>();

export function registerPlayerNickname(playerId: string, nickname: string): void {
  nicknameCache.set(playerId, nickname);
}

/**
 * Returns the cached nickname for `playerId`, or a masked placeholder such as
 * `Player...a1b2` when the player is unknown.
 */
export function resolveNickname(playerId: string): string {
  return nicknameCache.get(playerId) ?? `Player...${playerId.slice(-4)}`;
}
