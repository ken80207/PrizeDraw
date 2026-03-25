/**
 * WebSocket client for the chat room channel.
 *
 * Connects to `/ws/chat/{roomId}` and delivers typed `ChatEvent` messages via
 * a callback. Implements exponential backoff reconnect up to MAX_RETRIES attempts.
 *
 * Room ID conventions (mirrors ChatService.kt):
 *   - `kuji:{campaignId}`                            — kuji campaign rooms
 *   - `unlimited:{campaignId}:{broadcasterId}`       — unlimited draw broadcast rooms
 *
 * The server broadcasts CHAT_MESSAGE and CHAT_REACTION events over this socket.
 * Text messages and reactions are *sent* via the REST endpoints
 * POST /api/v1/chat/{roomId}/messages and POST /api/v1/chat/{roomId}/reactions.
 */

const BASE_WS_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:8080");

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_000;

// ─────────────────────────────────────────────────────────────────────────────
// Event shape types — mirror ChatEvent sealed class in ChatService.kt
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessageEvent {
  type: "CHAT_MESSAGE";
  playerId: string;
  nickname: string;
  message: string;
  timestamp: string;
}

export interface ChatReactionEvent {
  type: "CHAT_REACTION";
  playerId: string;
  nickname: string;
  emoji: string;
  timestamp: string;
}

export type ChatWsEvent = ChatMessageEvent | ChatReactionEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatWebSocketOptions {
  onEvent: (event: ChatWsEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a WebSocket connection to the chat room for `roomId`.
 *
 * @param roomId The chat room to subscribe to (e.g. `kuji:{campaignId}`).
 * @param options Typed event / lifecycle callbacks.
 * @returns A dispose function — call it to close the socket and stop reconnecting.
 */
export function connectChatWebSocket(
  roomId: string,
  options: ChatWebSocketOptions,
): () => void {
  let ws: WebSocket | null = null;
  let retries = 0;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (disposed) return;
    const url = `${BASE_WS_URL}/ws/chat/${encodeURIComponent(roomId)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retries = 0;
      options.onConnected?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ChatWsEvent;
        if (msg.type === "CHAT_MESSAGE" || msg.type === "CHAT_REACTION") {
          options.onEvent(msg);
        }
      } catch {
        // Malformed frame — ignore
      }
    };

    ws.onerror = (event) => {
      options.onError?.(event);
    };

    ws.onclose = () => {
      options.onDisconnected?.();
      if (!disposed && retries < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, retries);
        retries++;
        reconnectTimer = setTimeout(connect, delay);
      }
    };
  }

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
