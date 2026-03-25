"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/services/apiClient";

interface PrizeInstanceDto {
  id: string;
  grade: string;
  name: string;
  photoUrl: string | null;
  state: string;
}

interface CreateListingRequest {
  prizeInstanceId: string;
  listPrice: number;
}

interface TradeListingDto {
  id: string;
}

const DEFAULT_FEE_RATE_BPS = 500;
const BASIS_POINTS = 10_000;

/**
 * Create trade listing page.
 *
 * Loads the selected prize (from query param prizeId) or fetches all HOLDING prizes
 * for a picker. Shows price input with fee preview. On confirm calls
 * POST /api/v1/trade/listings.
 *
 * The selected prize's photo is displayed when available.
 */
export default function CreateListingPage() {
  return (
    <Suspense>
      <CreateListingContent />
    </Suspense>
  );
}

function CreateListingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPrizeId = searchParams.get("prizeId") ?? "";

  const [prizes, setPrizes] = useState<PrizeInstanceDto[]>([]);
  const [selectedPrizeId, setSelectedPrizeId] = useState(preselectedPrizeId);
  const [priceInput, setPriceInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPrice = parseInt(priceInput) || 0;
  const feeAmount = Math.round((listPrice * DEFAULT_FEE_RATE_BPS) / BASIS_POINTS);
  const proceeds = Math.max(listPrice - feeAmount, 0);

  useEffect(() => {
    if (!preselectedPrizeId) {
      apiClient
        .get<PrizeInstanceDto[]>("/api/v1/players/me/prizes")
        .then((all) => setPrizes(all.filter((p) => p.state === "HOLDING")))
        .catch(() => {});
    }
  }, [preselectedPrizeId]);

  // Find the currently selected prize object (for photo display)
  const selectedPrize = prizes.find((p) => p.id === selectedPrizeId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrizeId || listPrice <= 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const body: CreateListingRequest = { prizeInstanceId: selectedPrizeId, listPrice };
      const listing = await apiClient.post<TradeListingDto>("/api/v1/trade/listings", body);
      router.push(`/trade/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button type="button" onClick={() => router.back()} className="mb-4 text-sm text-zinc-500 hover:text-zinc-800">
        ← Back
      </button>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">List a Prize for Sale</h1>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!preselectedPrizeId && prizes.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="prize" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Select Prize
            </label>
            <select
              id="prize"
              value={selectedPrizeId}
              onChange={(e) => setSelectedPrizeId(e.target.value)}
              required
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">-- Select a prize --</option>
              {prizes.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.grade}] {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prize photo preview */}
        {selectedPrize?.photoUrl && (
          <div className="flex items-center gap-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPrize.photoUrl}
              alt={selectedPrize.name}
              className="h-20 w-20 rounded-lg object-cover flex-shrink-0 border border-zinc-200 dark:border-zinc-700"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">
                {selectedPrize.grade}
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {selectedPrize.name}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Listing Price (draw points)
          </label>
          <input
            id="price"
            data-testid="listing-price"
            type="number"
            min={1}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            required
            placeholder="e.g. 500"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        {listPrice > 0 && (
          <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
            <p className="text-zinc-500">Platform fee ({DEFAULT_FEE_RATE_BPS / 100}%): <strong>{feeAmount.toLocaleString()} pts</strong></p>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
              Your proceeds: {proceeds.toLocaleString()} pts
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !selectedPrizeId || listPrice <= 0}
          className="flex h-11 items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isLoading ? "Creating…" : "Confirm Listing"}
        </button>
      </form>
    </div>
  );
}
