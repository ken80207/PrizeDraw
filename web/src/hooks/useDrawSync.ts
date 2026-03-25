"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isDrawSyncEvent,
  resolveNickname,
  type DrawSyncEvent,
} from "@/services/drawSyncWebSocket";
import {
  connectKujiWebSocket,
  type KujiWsMessage,
} from "@/services/kujiWebSocket";

// ─────────────────────────────────────────────────────────────────────────────
// Public state shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveDrawSession {
  sessionId: string;
  playerId: string;
  nickname: string;
  animationMode: string;
  progress: number;
}

export interface RevealedResult {
  ticketId: string | null;
  grade: string;
  prizeName: string;
  photoUrl: string | null;
}

export interface DrawSyncState {
  /** Non-null while a player is in the draw animation; null between draws. */
  activeDrawSession: ActiveDrawSession | null;
  /** Set when DRAW_REVEALED arrives; cleared by `clearRevealed()`. */
  lastRevealed: RevealedResult | null;
  /** True while the WebSocket is connected. */
  isConnected: boolean;
}

export interface UseDrawSyncReturn extends DrawSyncState {
  /** Call this after consuming `lastRevealed` to reset it. */
  clearRevealed: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscribes to the kuji WebSocket channel for `campaignId` and surfaces
 * draw-sync events (DRAW_STARTED, DRAW_PROGRESS, DRAW_CANCELLED, DRAW_REVEALED)
 * as structured React state.
 *
 * The hook piggybacks on the same `/ws/kuji/{campaignId}` connection already
 * used by `useKujiBoard`. For spectator-only pages that do not need the full
 * board state, this hook opens its own lightweight connection.
 *
 * @param campaignId The campaign to watch. Pass an empty string to disable.
 */
export function useDrawSync(campaignId: string): UseDrawSyncReturn {
  const [activeDrawSession, setActiveDrawSession] =
    useState<ActiveDrawSession | null>(null);
  const [lastRevealed, setLastRevealed] = useState<RevealedResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep a ref to the active session so progress events can update it without
  // stale closure issues.
  const activeSessionRef = useRef<ActiveDrawSession | null>(null);
  activeSessionRef.current = activeDrawSession;

  const handleDrawSyncEvent = useCallback((event: DrawSyncEvent) => {
    switch (event.type) {
      case "DRAW_STARTED": {
        const session: ActiveDrawSession = {
          sessionId: event.sessionId,
          playerId: event.playerId,
          nickname: resolveNickname(event.playerId),
          animationMode: event.animationMode,
          progress: 0,
        };
        setActiveDrawSession(session);
        // Clear any stale revealed result from the previous round
        setLastRevealed(null);
        break;
      }

      case "DRAW_PROGRESS": {
        setActiveDrawSession((prev) => {
          if (!prev || prev.sessionId !== event.sessionId) return prev;
          return { ...prev, progress: event.progress };
        });
        break;
      }

      case "DRAW_CANCELLED": {
        setActiveDrawSession((prev) => {
          if (prev?.sessionId === event.sessionId) return null;
          return prev;
        });
        break;
      }

      case "DRAW_REVEALED": {
        setActiveDrawSession((prev) => {
          if (prev?.sessionId === event.sessionId) return null;
          return prev;
        });
        setLastRevealed({
          ticketId: event.ticketId,
          grade: event.grade,
          prizeName: event.prizeName,
          photoUrl: event.photoUrl,
        });
        break;
      }
    }
  }, []);

  const handleMessage = useCallback(
    (msg: KujiWsMessage) => {
      // The kuji socket multiplexes board events and draw-sync events.
      // isDrawSyncEvent narrows the union to draw-sync only.
      if (isDrawSyncEvent(msg as { type: string })) {
        handleDrawSyncEvent(msg as unknown as DrawSyncEvent);
      }
    },
    [handleDrawSyncEvent],
  );

  useEffect(() => {
    if (!campaignId) return;

    const dispose = connectKujiWebSocket(campaignId, {
      onMessage: handleMessage,
      onConnected: () => setIsConnected(true),
      onDisconnected: () => setIsConnected(false),
    });

    return dispose;
  }, [campaignId, handleMessage]);

  const clearRevealed = useCallback(() => {
    setLastRevealed(null);
  }, []);

  return { activeDrawSession, lastRevealed, isConnected, clearRevealed };
}
