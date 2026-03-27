"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tt = useTranslations("trade");
  const tc = useTranslations("common");

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
      .catch((err) => setError(err instanceof Error ? err.message : tt("loadFailed")))
      .finally(() => setIsLoading(false));
  }, [params.id, tt]);

  async function purchase() {
    if (!listing) return;
    setIsPurchasing(true);
    try {
      await apiClient.post(`/api/v1/trade/listings/${listing.id}/purchase`, { listingId: listing.id });
      router.push("/prizes");
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("loadFailed"));
    } finally {
      setIsPurchasing(false);
      setShowConfirm(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-dim">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-dim">
        <span className="material-symbols-outlined text-5xl text-error">error_outline</span>
        <p className="text-error font-body">{error ?? tc("noData")}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-label text-on-surface-variant hover:text-on-surface underline"
        >
          {tc("back")}
        </button>
      </div>
    );
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
          {tt("backToMarketplace")}
        </button>

        {/* Prize image */}
        <div className="relative mb-6 h-72 rounded-lg overflow-hidden bg-surface-container-low">
          {listing.prizePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.prizePhotoUrl}
              alt={listing.prizeName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-7xl text-on-surface-variant/30">
                trophy
              </span>
            </div>
          )}
        </div>

        {/* Grade & Title */}
        <div className="mb-1">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold font-label tracking-wide shadow-sm">
            {listing.prizeGrade}
          </span>
        </div>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-1 mt-3">
          {listing.prizeName}
        </h1>
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
          <p className="font-body text-sm text-on-surface-variant">
            {tt("seller")}: {listing.sellerNickname}
          </p>
        </div>

        {/* Price card */}
        <div className="mb-6 flex items-center justify-between bg-surface-container rounded-xl p-5">
          <span className="font-label text-sm text-on-surface-variant uppercase tracking-widest">
            {tt("price")}
          </span>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">monetization_on</span>
            <span className="font-headline text-2xl font-black text-primary">
              {listing.listPrice.toLocaleString()} {tc("pts")}
            </span>
          </div>
        </div>

        {listing.status === "LISTED" && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">shopping_cart</span>
            {tt("buyNow")}
          </button>
        )}

        {listing.status !== "LISTED" && (
          <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-surface-container">
            <span className="material-symbols-outlined text-on-surface-variant">info</span>
            <p className="font-body text-sm text-on-surface-variant">
              {tt("listingNotAvailable")}
            </p>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm z-50">
          <div className="w-full max-w-sm bg-surface-container rounded-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline text-base font-bold text-on-surface">
                {tt("confirmPurchase")}
              </h2>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="font-body mb-5 text-sm text-on-surface-variant">
              {tt("buyNow")} &ldquo;{listing.prizeName}&rdquo;{" "}
              <span className="text-primary font-bold">
                {listing.listPrice.toLocaleString()} {tt("buyDrawPoints")}
              </span>
              ?
            </p>

            {error && (
              <p className="mb-3 text-sm text-error font-body">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-on-surface/20 py-2.5 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface hover:border-on-surface/40 transition-colors"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={purchase}
                disabled={isPurchasing}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-container py-2.5 text-sm font-label font-bold text-on-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 transition-all"
              >
                {isPurchasing ? tt("processing") : tc("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
