/**
 * WebSocket client for the per-player notification channel.
 *
 * Connects to `/ws/player/notifications?token={accessToken}` and delivers
 * typed notification events via callbacks. Implements exponential backoff
 * reconnect up to MAX_RETRIES attempts.
 */

const BASE_WS_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:3000");

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_000;

export interface PlayerWsMessage {
  eventType: string;
  notificationId?: string;
  title: string;
  body: string;
  data: Record<string, string>;
  timestamp: string;
}

export interface PlayerWebSocketOptions {
  onNotification: (msg: PlayerWsMessage) => void;
  onConnected?: (unreadCount: number) => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

export function connectPlayerWebSocket(
  accessToken: string,
  options: PlayerWebSocketOptions,
): () => void {
  let ws: WebSocket | null = null;
  let retries = 0;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (disposed) return;
    const url = `${BASE_WS_URL}/ws/player/notifications?token=${encodeURIComponent(accessToken)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retries = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.eventType === "CONNECTED") {
          options.onConnected?.(msg.unreadCount ?? 0);
          return;
        }
        options.onNotification(msg as PlayerWsMessage);
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
