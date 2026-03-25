/**
 * Zustand store for marketplace trade state.
 *
 * Tracks the current listing page, active filters, and the result of the last
 * purchase for optimistic UI updates. This store is updated by the marketplace
 * page component and the buy-flow hooks.
 *
 * When Zustand is not yet available, this file provides a module-level
 * singleton with the same interface so callers are migration-safe.
 *
 * TODO(T137): Replace the singleton implementation with `create` from
 *   `zustand` once added to package.json.
 */

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

function createTradeStore(): TradeStore {
  let listings: TradeListingState[] = [];
  let gradeFilter = "";
  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let currentPage = 0;
  let hasMore = true;
  let isLoading = false;
  let error: string | null = null;

  return {
    get listings() { return listings; },
    get gradeFilter() { return gradeFilter; },
    get minPrice() { return minPrice; },
    get maxPrice() { return maxPrice; },
    get currentPage() { return currentPage; },
    get hasMore() { return hasMore; },
    get isLoading() { return isLoading; },
    get error() { return error; },

    setListings(newListings) {
      listings = newListings;
      hasMore = newListings.length > 0;
    },

    appendListings(newListings) {
      listings = [...listings, ...newListings];
      hasMore = newListings.length > 0;
    },

    setGradeFilter(grade) {
      gradeFilter = grade;
      currentPage = 0;
      listings = [];
    },

    setPriceRange(min, max) {
      minPrice = min;
      maxPrice = max;
      currentPage = 0;
      listings = [];
    },

    nextPage() {
      currentPage += 1;
    },

    markPurchased(listingId) {
      listings = listings.map((l) =>
        l.id === listingId ? { ...l, status: "COMPLETED" } : l,
      );
    },

    removeListing(listingId) {
      listings = listings.filter((l) => l.id !== listingId);
    },

    setLoadingState(loading, err) {
      isLoading = loading;
      error = err;
    },

    reset() {
      listings = [];
      gradeFilter = "";
      minPrice = null;
      maxPrice = null;
      currentPage = 0;
      hasMore = true;
      isLoading = false;
      error = null;
    },
  };
}

/** Module-level singleton. Replace with Zustand `create` when available. */
export const tradeStore = createTradeStore();
