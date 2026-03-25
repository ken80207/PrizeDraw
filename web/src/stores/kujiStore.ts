/**
 * Zustand store for kuji session state.
 *
 * Tracks the player's queue entry, active session expiry, and the current
 * ticket board snapshot. This store is updated by the WebSocket hook
 * (`useKujiBoard`) and the draw API responses.
 */

import { create } from "zustand";

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

export const useKujiStore = create<KujiStore>((set) => ({
  queueEntry: null,
  sessionExpiry: null,
  currentBoard: new Map(),
  lastDrawResult: null,

  setQueueEntry(entry) {
    set({ queueEntry: entry });
  },

  setSessionExpiry(expiry) {
    set({ sessionExpiry: expiry });
  },

  applyBoardSnapshot(tickets) {
    const board = new Map<number, TicketCellState>();
    for (const t of tickets) {
      board.set(t.position, t);
    }
    set({ currentBoard: board });
  },

  markTicketDrawn(ticket) {
    set((state) => {
      const board = new Map(state.currentBoard);
      board.set(ticket.position, { ...ticket, isDrawn: true });
      return { currentBoard: board };
    });
  },

  setLastDrawResult(result) {
    set({ lastDrawResult: result });
  },

  reset() {
    set({
      queueEntry: null,
      sessionExpiry: null,
      currentBoard: new Map(),
      lastDrawResult: null,
    });
  },
}));

/** Legacy singleton accessor. Prefer `useKujiStore` in React components. */
export const kujiStore = {
  get queueEntry() { return useKujiStore.getState().queueEntry; },
  get sessionExpiry() { return useKujiStore.getState().sessionExpiry; },
  get currentBoard() { return useKujiStore.getState().currentBoard; },
  get lastDrawResult() { return useKujiStore.getState().lastDrawResult; },
  setQueueEntry: (entry: QueueEntryState | null) => useKujiStore.getState().setQueueEntry(entry),
  setSessionExpiry: (expiry: string | null) => useKujiStore.getState().setSessionExpiry(expiry),
  applyBoardSnapshot: (tickets: TicketCellState[]) => useKujiStore.getState().applyBoardSnapshot(tickets),
  markTicketDrawn: (ticket: TicketCellState) => useKujiStore.getState().markTicketDrawn(ticket),
  setLastDrawResult: (result: DrawnTicketState[] | null) => useKujiStore.getState().setLastDrawResult(result),
  reset: () => useKujiStore.getState().reset(),
};
