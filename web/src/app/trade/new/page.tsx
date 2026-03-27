"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tt = useTranslations("trade");
  const tc = useTranslations("common");

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
      setError(err instanceof Error ? err.message : tt("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-label text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {tc("back")}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-3xl">sell</span>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {tt("listPrize")}
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-error/10">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
              error_outline
            </span>
            <p className="font-body text-sm text-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Prize selector */}
          {!preselectedPrizeId && prizes.length > 0 && (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="prize"
                className="font-label text-sm font-medium text-on-surface-variant uppercase tracking-wider"
              >
                {tt("selectPrize")}
              </label>
              <select
                id="prize"
                value={selectedPrizeId}
                onChange={(e) => setSelectedPrizeId(e.target.value)}
                required
                className="rounded-xl bg-surface-container-lowest px-4 py-3 text-sm text-on-surface font-body focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="">{tt("selectPrizePlaceholder")}</option>
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
            <div className="flex items-center gap-4 rounded-xl bg-surface-container p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPrize.photoUrl}
                alt={selectedPrize.name}
                className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
              />
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary text-xs font-bold font-label tracking-wide mb-1.5">
                  {selectedPrize.grade}
                </span>
                <p className="font-headline font-semibold text-on-surface text-sm">
                  {selectedPrize.name}
                </p>
              </div>
            </div>
          )}

          {/* Price input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="price"
              className="font-label text-sm font-medium text-on-surface-variant uppercase tracking-wider"
            >
              {tt("listingPrice")}
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
              className="rounded-xl bg-surface-container-lowest px-4 py-3 text-sm text-on-surface font-body placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Fee preview */}
          {listPrice > 0 && (
            <div className="rounded-xl bg-surface-container p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-on-surface-variant">
                  {tt("platformFee", { rate: DEFAULT_FEE_RATE_BPS / 100 })}
                </span>
                <span className="font-label text-sm text-on-surface-variant">
                  {feeAmount.toLocaleString()} {tc("pts")}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-on-surface/10">
                <span className="font-label text-sm font-bold text-on-surface">
                  {tt("yourProceeds")}
                </span>
                <span className="font-headline text-lg font-black text-primary">
                  {proceeds.toLocaleString()} {tc("pts")}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !selectedPrizeId || listPrice <= 0}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            {isLoading ? tt("creating") : tt("confirmListing")}
          </button>
        </form>
      </div>
    </div>
  );
}
