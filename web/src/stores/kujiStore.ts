/**
 * Zustand store for kuji session state.
 *
 * Tracks the player's queue entry, active session expiry, and the current
 * ticket board snapshot. This store is updated by the WebSocket hook
 * (`useKujiBoard`) and the draw API responses.
 *
 * When Zustand is not yet available, this file provides a module-level
 * singleton with the same interface so callers are migration-safe.
 *
 * TODO(T113): Replace the singleton implementation with `create` from
 *   `zustand` once added to package.json.
 */

export interface QueueEntryState {
  id: string;
  position: number;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED" | "EVICTED";
  joinedAt: string;
  activatedAt: string | null;
  queueLength: number;
  sessionExpiresAt: string | null;
}

export interface DrawnTicketState {
  ticketId: string;
  position: number;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string;
  drawnByNickname: string;
  pointsCharged: number;
}

export interface TicketCellState {
  id: string;
  position: number;
  isDrawn: boolean;
  grade: string | null;
  prizeName: string | null;
  prizePhotoUrl: string | null;
  drawnByNickname: string | null;
  drawnAt: string | null;
}

export interface KujiStore {
  /** The player's current queue entry, or null when not queued. */
  queueEntry: QueueEntryState | null;

  /** When the active draw session expires (ISO string), or null. */
  sessionExpiry: string | null;

  /** The current ticket board keyed by ticket position. */
  currentBoard: Map<number, TicketCellState>;

  /** Last draw result (cleared after animation plays). */
  lastDrawResult: DrawnTicketState[] | null;

  /** Set the player's queue entry after join/switch. */
  setQueueEntry: (entry: QueueEntryState | null) => void;

  /** Update the session expiry timestamp. */
  setSessionExpiry: (expiry: string | null) => void;

  /** Apply a full board snapshot from the WebSocket. */
  applyBoardSnapshot: (tickets: TicketCellState[]) => void;

  /** Mark a ticket as drawn (from WebSocket push). */
  markTicketDrawn: (ticket: TicketCellState) => void;

  /** Store the latest draw result for animation. */
  setLastDrawResult: (result: DrawnTicketState[] | null) => void;

  /** Clear all session state on leave/campaign exit. */
  reset: () => void;
}

function createKujiStore(): KujiStore {
  let queueEntry: QueueEntryState | null = null;
  let sessionExpiry: string | null = null;
  const currentBoard = new Map<number, TicketCellState>();
  let lastDrawResult: DrawnTicketState[] | null = null;

  return {
    get queueEntry() { return queueEntry; },
    get sessionExpiry() { return sessionExpiry; },
    get currentBoard() { return currentBoard; },
    get lastDrawResult() { return lastDrawResult; },

    setQueueEntry(entry) { queueEntry = entry; },
    setSessionExpiry(expiry) { sessionExpiry = expiry; },

    applyBoardSnapshot(tickets) {
      currentBoard.clear();
      for (const t of tickets) {
        currentBoard.set(t.position, t);
      }
    },

    markTicketDrawn(ticket) {
      currentBoard.set(ticket.position, { ...ticket, isDrawn: true });
    },

    setLastDrawResult(result) { lastDrawResult = result; },

    reset() {
      queueEntry = null;
      sessionExpiry = null;
      currentBoard.clear();
      lastDrawResult = null;
    },
  };
}

/** Module-level singleton. Replace with Zustand `create` when available. */
export const kujiStore = createKujiStore();
