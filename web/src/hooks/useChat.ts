"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectChatWebSocket,
  type ChatWsEvent,
} from "@/services/chatWebSocket";
import { apiClient } from "@/services/apiClient";
import { authStore } from "@/stores/authStore";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  /** Unique client-side ID (used as React key). */
  id: string;
  playerId: string;
  nickname: string;
  message: string;
  /** True when the record is a CHAT_REACTION event (emoji-only). */
  isReaction: boolean;
  timestamp: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  /**
   * Sends a plain-text message to the room.
   * Applies a 500 ms client-side cooldown after each successful send.
   */
  sendMessage: (text: string) => void;
  /**
   * Sends an emoji reaction to the room.
   */
  sendReaction: (emoji: string) => void;
  /** True during the 500 ms client-side rate-limit cooldown. */
  isCoolingDown: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum messages kept in memory — oldest are trimmed beyond this. */
const MAX_MESSAGES = 200;

/** Client-side send cooldown in ms (matches server RATE_LIMIT_WINDOW_MS = 1000). */
const SEND_COOLDOWN_MS = 500;

/** Number of history messages to preload on connect. */
const HISTORY_LIMIT = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

let _msgCounter = 0;
function nextId(): string {
  return `cm_${Date.now()}_${++_msgCounter}`;
}

/**
 * Manages the chat WebSocket connection, message history, and send actions for
 * a single chat room.
 *
 * @param roomId The chat room identifier (e.g. `kuji:{campaignId}`).
 */
export function useChat(roomId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Append helper ──────────────────────────────────────────────────────────

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
  }, []);

  // ── WebSocket event handler ────────────────────────────────────────────────

  const handleEvent = useCallback(
    (event: ChatWsEvent) => {
      // Skip own messages — already shown via optimistic echo.
      const selfId = authStore.player?.id;
      if (selfId && event.playerId === selfId) return;

      if (event.type === "CHAT_MESSAGE") {
        appendMessage({
          id: nextId(),
          playerId: event.playerId,
          nickname: event.nickname,
          message: event.message,
          isReaction: false,
          timestamp: event.timestamp,
        });
      } else if (event.type === "CHAT_REACTION") {
        appendMessage({
          id: nextId(),
          playerId: event.playerId,
          nickname: event.nickname,
          message: event.emoji,
          isReaction: true,
          timestamp: event.timestamp,
        });
      }
    },
    [appendMessage],
  );

  // ── WebSocket lifecycle ────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;

    // Pre-load history
    apiClient
      .get<{ roomId: string; messages: Array<{
        id: string;
        playerId: string;
        playerNickname: string | null;
        message: string;
        isReaction: boolean;
        createdAt: string;
      }> }>(`/api/v1/chat/${encodeURIComponent(roomId)}/history?limit=${HISTORY_LIMIT}`)
      .then(({ messages: history }) => {
        // History is returned newest-first; reverse to chronological order.
        const chronological = [...history].reverse();
        setMessages(
          chronological.map((m) => ({
            id: m.id,
            playerId: m.playerId,
            nickname: m.playerNickname ?? "玩家",
            message: m.message,
            isReaction: m.isReaction,
            timestamp: m.createdAt,
          })),
        );
      })
      .catch(() => {
        // History load failure is non-fatal — live messages still arrive via WS.
      });

    const dispose = connectChatWebSocket(roomId, {
      onEvent: handleEvent,
      onConnected: () => setIsConnected(true),
      onDisconnected: () => setIsConnected(false),
    });

    return () => {
      dispose();
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [roomId, handleEvent]);

  // ── Send helpers ───────────────────────────────────────────────────────────

  const startCooldown = useCallback(() => {
    setIsCoolingDown(true);
    if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
      cooldownTimerRef.current = null;
    }, SEND_COOLDOWN_MS);
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Optimistic local echo — display immediately, no await.
      const player = authStore.player;
      appendMessage({
        id: nextId(),
        playerId: player?.id ?? "",
        nickname: player?.nickname ?? "我",
        message: trimmed,
        isReaction: false,
        timestamp: new Date().toISOString(),
      });
      startCooldown();
      // Fire-and-forget — errors logged but not surfaced.
      apiClient.post(`/api/v1/chat/${encodeURIComponent(roomId)}/messages`, {
        message: trimmed,
      }).catch(() => {});
    },
    [roomId, startCooldown, appendMessage],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      const player = authStore.player;
      appendMessage({
        id: nextId(),
        playerId: player?.id ?? "",
        nickname: player?.nickname ?? "我",
        message: emoji,
        isReaction: true,
        timestamp: new Date().toISOString(),
      });
      startCooldown();
      apiClient.post(`/api/v1/chat/${encodeURIComponent(roomId)}/reactions`, { emoji }).catch(() => {});
    },
    [roomId, startCooldown, appendMessage],
  );

  return { messages, isConnected, sendMessage, sendReaction, isCoolingDown };
}
