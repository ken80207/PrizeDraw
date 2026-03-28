import { create } from "zustand";
import type { LiveDrawItem } from "@/services/liveDrawService";
import { fetchLiveDraws } from "@/services/liveDrawService";

interface LiveDrawStore {
  draws: Map<string, LiveDrawItem>;
  isLoading: boolean;
  fetchLiveDraws: () => Promise<void>;
  addDraw: (item: LiveDrawItem) => void;
  removeDraw: (sessionId: string) => void;
}

export const useLiveDrawStore = create<LiveDrawStore>((set) => ({
  draws: new Map(),
  isLoading: false,

  fetchLiveDraws: async () => {
    set({ isLoading: true });
    try {
      const items = await fetchLiveDraws();
      const draws = new Map<string, LiveDrawItem>();
      for (const item of items) {
        draws.set(item.sessionId, item);
      }
      set({ draws });
    } catch {
      // silently fail
    } finally {
      set({ isLoading: false });
    }
  },

  addDraw: (item) => {
    set((state) => {
      const draws = new Map(state.draws);
      draws.set(item.sessionId, item);
      return { draws };
    });
  },

  removeDraw: (sessionId) => {
    set((state) => {
      const draws = new Map(state.draws);
      draws.delete(sessionId);
      return { draws };
    });
  },
}));
