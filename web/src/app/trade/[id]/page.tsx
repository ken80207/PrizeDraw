"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";

interface TradeListingDto {
  id: string;
  sellerId: string;
  sellerNickname: string;
  prizeInstanceId: string;
  prizeGrade: string;
  prizeName: string;
  prizePhotoUrl: string;
  listPrice: number;
  feeRateBps: number;
  status: string;
  listedAt: string;
}

/**
 * Trade listing detail page.
 *
 * Fetches GET /api/v1/trade/listings/{listingId}.
 * Shows prize photo, grade, seller nickname, price, and a buy confirmation flow.
 * Calls POST /api/v1/trade/listings/{listingId}/purchase on confirm.
 */
export default function TradeListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<TradeListingDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    apiClient
      .get<TradeListingDto>(`/api/v1/trade/listings/${params.id}`)
      .then(setListing)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load listing"))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  async function purchase() {
    if (!listing) return;
    setIsPurchasing(true);
    try {
      await apiClient.post(`/api/v1/trade/listings/${listing.id}/purchase`, { listingId: listing.id });
      router.push("/prizes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setIsPurchasing(false);
      setShowConfirm(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      </div>
    );
  }
  if (error || !listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600 dark:text-red-400">{error ?? "Listing not found"}</p>
        <button type="button" onClick={() => router.back()} className="text-sm underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button type="button" onClick={() => router.back()} className="mb-4 text-sm text-zinc-500 hover:text-zinc-800">
        ← Back to Marketplace
      </button>

      <div className="mb-6 flex h-72 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
        {listing.prizePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.prizePhotoUrl} alt={listing.prizeName} className="h-full w-full rounded-xl object-cover" />
        ) : (
          <span className="text-5xl font-bold text-zinc-400">{listing.prizeGrade}</span>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-bold text-zinc-100 dark:bg-zinc-100 dark:text-zinc-800">
          {listing.prizeGrade}
        </span>
      </div>
      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{listing.prizeName}</h1>
      <p className="mb-4 text-sm text-zinc-500">Seller: {listing.sellerNickname}</p>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <span className="text-sm text-zinc-500">Price</span>
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {listing.listPrice.toLocaleString()} pts
        </span>
      </div>

      {listing.status === "LISTED" && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Buy Now
        </button>
      )}

      {listing.status !== "LISTED" && (
        <p className="text-center text-sm text-zinc-500">This listing is no longer available.</p>
      )}

      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">Confirm Purchase</h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Buy &ldquo;{listing.prizeName}&rdquo; for {listing.listPrice.toLocaleString()} draw points?
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={purchase}
                disabled={isPurchasing}
                className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
              >
                {isPurchasing ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
