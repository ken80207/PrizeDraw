/**
 * WebSocket client for the kuji board real-time channel.
 *
 * Connects to `/ws/kuji/{campaignId}` and delivers typed messages via a
 * callback. Implements exponential backoff reconnect up to [MAX_RETRIES]
 * attempts.
 */

const BASE_WS_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:3000");

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_000;

export type KujiWsMessageType = "BOARD_SNAPSHOT" | "TICKET_DRAWN";

export interface BoardSnapshotMessage {
  type: "BOARD_SNAPSHOT";
  campaignId: string;
  tickets: RawTicketDto[];
}

export interface TicketDrawnMessage {
  type: "TICKET_DRAWN";
  campaignId: string;
  ticketBoxId: string;
  drawnByNickname: string;
  ticketCount: number;
}

export interface RawTicketDto {
  id: string;
  position: number;
  drawnAt: string | null;
  grade: string | null;
  prizeName: string | null;
  prizePhotoUrl: string | null;
  drawnByNickname: string | null;
}

export type KujiWsMessage = BoardSnapshotMessage | TicketDrawnMessage;

export interface KujiWebSocketOptions {
  onMessage: (msg: KujiWsMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Opens a WebSocket connection to the kuji room for [campaignId].
 *
 * @param campaignId The campaign to subscribe to.
 * @param options Typed message / lifecycle callbacks.
 * @returns A dispose function — call it to close the socket and stop reconnecting.
 */
export function connectKujiWebSocket(
  campaignId: string,
  options: KujiWebSocketOptions,
): () => void {
  let ws: WebSocket | null = null;
  let retries = 0;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (disposed) return;
    const url = `${BASE_WS_URL}/ws/kuji/${campaignId}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      retries = 0;
      options.onConnected?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as KujiWsMessage;
        options.onMessage(msg);
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
