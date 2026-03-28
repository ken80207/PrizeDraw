import { create } from "zustand";
import type { DrawFeedEvent } from "@/services/feedWebSocket";

const MAX_ITEMS = 100;

export interface FeedStore {
  items: DrawFeedEvent[];
  selectedCampaignIds: Set<string>;
  selectedGrades: Set<string>;
  connected: boolean;

  addEvent: (event: DrawFeedEvent) => void;
  setInitialItems: (items: DrawFeedEvent[]) => void;
  setConnected: (connected: boolean) => void;
  toggleCampaignFilter: (campaignId: string) => void;
  toggleGradeFilter: (grade: string) => void;
  clearFilters: () => void;
}

export const useFeedStore = create<FeedStore>((set) => ({
  items: [],
  selectedCampaignIds: new Set(),
  selectedGrades: new Set(),
  connected: false,

  addEvent(event) {
    set((state) => ({
      items: [event, ...state.items].slice(0, MAX_ITEMS),
    }));
  },

  setInitialItems(items) {
    set({ items: items.slice(0, MAX_ITEMS) });
  },

  setConnected(connected) {
    set({ connected });
  },

  toggleCampaignFilter(campaignId) {
    set((state) => {
      const next = new Set(state.selectedCampaignIds);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return { selectedCampaignIds: next };
    });
  },

  toggleGradeFilter(grade) {
    set((state) => {
      const next = new Set(state.selectedGrades);
      if (next.has(grade)) {
        next.delete(grade);
      } else {
        next.add(grade);
      }
      return { selectedGrades: next };
    });
  },

  clearFilters() {
    set({ selectedCampaignIds: new Set(), selectedGrades: new Set() });
  },
}));

export function useFilteredFeedItems(): DrawFeedEvent[] {
  return useFeedStore((state) => {
    const { items, selectedCampaignIds, selectedGrades } = state;
    return items.filter((item) => {
      if (selectedCampaignIds.size > 0 && !selectedCampaignIds.has(item.campaignId)) {
        return false;
      }
      if (selectedGrades.size > 0 && !selectedGrades.has(item.prizeGrade)) {
        return false;
      }
      return true;
    });
  });
}
