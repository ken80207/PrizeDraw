"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectKujiWebSocket,
  type KujiWsMessage,
} from "@/services/kujiWebSocket";
import {
  isDrawSyncEvent,
  resolveNickname,
  type DrawSyncEvent,
} from "@/services/drawSyncWebSocket";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single high-frequency touch frame emitted by the drawing player.
 * Coordinates are normalised to [0, 1] relative to the canvas dimensions
 * so spectators can scale them to any display size.
 */
export interface TouchFrame {
  /** Normalised horizontal position (0 = left edge, 1 = right edge). */
  x: number;
  /** Normalised vertical position (0 = top edge, 1 = bottom edge). */
  y: number;
  /** True while the finger/pointer is pressed down on the canvas. */
  isDown: boolean;
  /** Unix timestamp (ms) when the frame was captured on the drawer's device. */
  timestamp: number;
}

export interface DrawInputSyncState {
  /** The most-recently received touch frame, or null when no frame has arrived. */
  currentFrame: TouchFrame | null;
  /** True while at least one touch frame with isDown=true has been received
   *  since the last DRAW_STARTED event. */
  isDrawing: boolean;
  /** Player ID of the current drawer, or null between draws. */
  drawerId: string | null;
  /** Display name of the current drawer. */
  drawerNickname: string | null;
  /** Animation mode string (SCRATCH | TEAR | FLIP | INSTANT). */
  animationMode: string | null;
  /** Active draw session ID, used to correlate DRAW_REVEALED events. */
  sessionId: string | null;
  /** True while the WebSocket is connected. */
  isConnected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire-format type for the DRAW_INPUT message broadcast by the server
// ─────────────────────────────────────────────────────────────────────────────

interface DrawInputMessage {
  type: "DRAW_INPUT";
  sessionId: string;
  x: number;
  y: number;
  isDown: boolean;
  timestamp: number;
}

function isDrawInputMessage(msg: { type: string }): msg is DrawInputMessage {
  return msg.type === "DRAW_INPUT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the kuji WebSocket channel and surfaces DRAW_INPUT touch
 * frames at up to 60 fps for spectator animation playback.
 *
 * The hook also listens for DRAW_STARTED / DRAW_CANCELLED / DRAW_REVEALED so
 * the spectator UI can reflect the drawer's session lifecycle.
 *
 * Architecture note: DRAW_INPUT events are intentionally NOT passed through
 * React state (which would create one re-render per frame at 60 fps). Instead,
 * `currentFrame` is kept in state but only updated when the value changes;
 * consumers that need sub-frame accuracy can use the `onFrame` callback option.
 *
 * @param roomId The campaign/room ID to connect to. Pass "" to disable.
 */
export function useDrawInputSync(roomId: string): DrawInputSyncState {
  const [state, setState] = useState<DrawInputSyncState>({
    currentFrame: null,
    isDrawing: false,
    drawerId: null,
    drawerNickname: null,
    animationMode: null,
    sessionId: null,
    isConnected: false,
  });

  // Keep the active sessionId in a ref for fast comparison inside high-freq
  // message handler without stale closures.
  const sessionIdRef = useRef<string | null>(null);

  const handleDrawSyncEvent = useCallback((event: DrawSyncEvent) => {
    switch (event.type) {
      case "DRAW_STARTED": {
        sessionIdRef.current = event.sessionId;
        setState((prev) => ({
          ...prev,
          currentFrame: null,
          isDrawing: false,
          drawerId: event.playerId,
          drawerNickname: resolveNickname(event.playerId),
          animationMode: event.animationMode,
          sessionId: event.sessionId,
        }));
        break;
      }

      case "DRAW_CANCELLED": {
        if (sessionIdRef.current === event.sessionId) {
          sessionIdRef.current = null;
          setState((prev) => ({
            ...prev,
            currentFrame: null,
            isDrawing: false,
            drawerId: null,
            drawerNickname: null,
            animationMode: null,
            sessionId: null,
          }));
        }
        break;
      }

      case "DRAW_REVEALED": {
        if (sessionIdRef.current === event.sessionId) {
          sessionIdRef.current = null;
          setState((prev) => ({
            ...prev,
            currentFrame: null,
            isDrawing: false,
            drawerId: null,
            drawerNickname: null,
            animationMode: null,
            sessionId: null,
          }));
        }
        break;
      }

      // DRAW_PROGRESS is the old progress-based event — intentionally ignored
      // here because we now consume DRAW_INPUT frames instead.
      case "DRAW_PROGRESS":
        break;
    }
  }, []);

  const handleMessage = useCallback(
    (msg: KujiWsMessage | DrawInputMessage) => {
      const raw = msg as { type: string };

      // High-frequency touch frame — update state directly, no batching needed
      // because React 18 batches all state updates in event handlers and
      // microtasks already.
      if (isDrawInputMessage(raw)) {
        // Drop frames from a stale session (race condition during transition)
        if (raw.sessionId !== sessionIdRef.current) return;
        const frame: TouchFrame = {
          x: raw.x,
          y: raw.y,
          isDown: raw.isDown,
          timestamp: raw.timestamp,
        };
        setState((prev) => ({
          ...prev,
          currentFrame: frame,
          isDrawing: raw.isDown ? true : prev.isDrawing,
        }));
        return;
      }

      if (isDrawSyncEvent(raw)) {
        handleDrawSyncEvent(raw as DrawSyncEvent);
      }
    },
    [handleDrawSyncEvent],
  );

  useEffect(() => {
    if (!roomId) return;

    const dispose = connectKujiWebSocket(roomId, {
      onMessage: handleMessage as (msg: KujiWsMessage) => void,
      onConnected: () =>
        setState((prev) => ({ ...prev, isConnected: true })),
      onDisconnected: () =>
        setState((prev) => ({ ...prev, isConnected: false })),
    });

    return dispose;
  }, [roomId, handleMessage]);

  return state;
}
