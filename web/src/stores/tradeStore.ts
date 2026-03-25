/**
 * Zustand store for marketplace trade state.
 *
 * Tracks the current listing page, active filters, and the result of the last
 * purchase for optimistic UI updates. This store is updated by the marketplace
 * page component and the buy-flow hooks.
 */

import { create } from "zustand";

export interface TradeListingState {
  id: string;
  sellerId: string;
  sellerNickname: string;
  prizeInstanceId: string;
  prizeGrade: string;
  prizeName: string;
  prizePhotoUrl: string;
  listPrice: number;
  feeRateBps: number;
  status: "LISTED" | "COMPLETED" | "CANCELLED";
  listedAt: string;
}

export interface TradeStore {
  /** Currently displayed marketplace listings. */
  listings: TradeListingState[];

  /** Active grade filter. Empty string = no filter. */
  gradeFilter: string;

  /** Active price range filter. */
  minPrice: number | null;
  maxPrice: number | null;

  /** Zero-based page index for pagination. */
  currentPage: number;

  /** Whether more pages are available. */
  hasMore: boolean;

  /** True while fetching listings. */
  isLoading: boolean;

  /** Human-readable error message, or null. */
  error: string | null;

  /** Replace the current listing page. */
  setListings: (listings: TradeListingState[]) => void;

  /** Append listings for infinite scroll / load more. */
  appendListings: (listings: TradeListingState[]) => void;

  /** Apply grade filter and reset to page 0. */
  setGradeFilter: (grade: string) => void;

  /** Apply price range filter and reset to page 0. */
  setPriceRange: (min: number | null, max: number | null) => void;

  /** Advance to the next page. */
  nextPage: () => void;

  /** Mark a listing as COMPLETED after purchase. */
  markPurchased: (listingId: string) => void;

  /** Remove a listing from the store after cancellation. */
  removeListing: (listingId: string) => void;

  /** Update loading / error state. */
  setLoadingState: (isLoading: boolean, error: string | null) => void;

  /** Reset all state. */
  reset: () => void;
}

export const useTradeStore = create<TradeStore>((set) => ({
  listings: [],
  gradeFilter: "",
  minPrice: null,
  maxPrice: null,
  currentPage: 0,
  hasMore: true,
  isLoading: false,
  error: null,

  setListings(newListings) {
    set({ listings: newListings, hasMore: newListings.length > 0 });
  },

  appendListings(newListings) {
    set((state) => ({
      listings: [...state.listings, ...newListings],
      hasMore: newListings.length > 0,
    }));
  },

  setGradeFilter(grade) {
    set({ gradeFilter: grade, currentPage: 0, listings: [] });
  },

  setPriceRange(min, max) {
    set({ minPrice: min, maxPrice: max, currentPage: 0, listings: [] });
  },

  nextPage() {
    set((state) => ({ currentPage: state.currentPage + 1 }));
  },

  markPurchased(listingId) {
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === listingId ? { ...l, status: "COMPLETED" as const } : l,
      ),
    }));
  },

  removeListing(listingId) {
    set((state) => ({
      listings: state.listings.filter((l) => l.id !== listingId),
    }));
  },

  setLoadingState(isLoading, error) {
    set({ isLoading, error });
  },

  reset() {
    set({
      listings: [],
      gradeFilter: "",
      minPrice: null,
      maxPrice: null,
      currentPage: 0,
      hasMore: true,
      isLoading: false,
      error: null,
    });
  },
}));

/** Legacy singleton accessor. Prefer `useTradeStore` in React components. */
export const tradeStore = {
  get listings() { return useTradeStore.getState().listings; },
  get gradeFilter() { return useTradeStore.getState().gradeFilter; },
  get minPrice() { return useTradeStore.getState().minPrice; },
  get maxPrice() { return useTradeStore.getState().maxPrice; },
  get currentPage() { return useTradeStore.getState().currentPage; },
  get hasMore() { return useTradeStore.getState().hasMore; },
  get isLoading() { return useTradeStore.getState().isLoading; },
  get error() { return useTradeStore.getState().error; },
  setListings: (listings: TradeListingState[]) => useTradeStore.getState().setListings(listings),
  appendListings: (listings: TradeListingState[]) => useTradeStore.getState().appendListings(listings),
  setGradeFilter: (grade: string) => useTradeStore.getState().setGradeFilter(grade),
  setPriceRange: (min: number | null, max: number | null) => useTradeStore.getState().setPriceRange(min, max),
  nextPage: () => useTradeStore.getState().nextPage(),
  markPurchased: (listingId: string) => useTradeStore.getState().markPurchased(listingId),
  removeListing: (listingId: string) => useTradeStore.getState().removeListing(listingId),
  setLoadingState: (isLoading: boolean, error: string | null) => useTradeStore.getState().setLoadingState(isLoading, error),
  reset: () => useTradeStore.getState().reset(),
};
