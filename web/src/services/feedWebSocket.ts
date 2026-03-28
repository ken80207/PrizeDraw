export interface DrawFeedEvent {
  drawId: string;
  playerId: string;
  playerNickname: string;
  playerAvatarUrl: string | null;
  campaignId: string;
  campaignTitle: string;
  campaignType: "KUJI" | "UNLIMITED";
  prizeGrade: string;
  prizeName: string;
  prizePhotoUrl: string | null;
  drawnAt: string;
}

export interface FeedWsMessage {
  type: "feed_event";
  data: DrawFeedEvent;
}

export type FeedEventListener = (event: DrawFeedEvent) => void;
export type FeedConnectionListener = (connected: boolean) => void;

const BASE_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? `ws://${typeof window !== "undefined" ? window.location.host : "localhost:9092"}`;
const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 1000;

let ws: WebSocket | null = null;
let retries = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const eventListeners = new Set<FeedEventListener>();
const connectionListeners = new Set<FeedConnectionListener>();

function notifyConnection(connected: boolean) {
  connectionListeners.forEach((cb) => cb(connected));
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const url = `${BASE_WS_URL}/ws/feed`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    retries = 0;
    notifyConnection(true);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as FeedWsMessage;
      if (msg.type === "feed_event" && msg.data) {
        eventListeners.forEach((cb) => cb(msg.data));
      }
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    notifyConnection(false);
    if (eventListeners.size > 0 && retries < MAX_RETRIES) {
      const delay = BASE_BACKOFF_MS * Math.pow(2, retries);
      retries++;
      reconnectTimer = setTimeout(connect, delay);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  retries = 0;
  ws?.close();
  ws = null;
}

export function subscribeFeed(
  onEvent: FeedEventListener,
  onConnection?: FeedConnectionListener,
): () => void {
  eventListeners.add(onEvent);
  if (onConnection) connectionListeners.add(onConnection);

  if (eventListeners.size === 1) connect();

  return () => {
    eventListeners.delete(onEvent);
    if (onConnection) connectionListeners.delete(onConnection);
    if (eventListeners.size === 0) disconnect();
  };
}
