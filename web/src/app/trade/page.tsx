"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
import { GradeBadge } from "@/components/GradeBadge";
import { PrizeCardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

interface TradeListingDto {
  id: string;
  sellerId: string;
  sellerNickname: string;
  prizeGrade: string;
  prizeName: string;
  prizePhotoUrl: string | null;
  listPrice: number;
  status: string;
  listedAt: string;
  sourceCampaignTitle?: string;
}

interface TradeListingPageDto {
  items: TradeListingDto[];
  totalCount: number;
}

interface PurchaseConfirmProps {
  listing: TradeListingDto;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

const GRADE_FILTER_VALUES = ["全部", "A賞", "B賞", "C賞", "D賞", "Last賞"];

export default function TradePage() {
  const tt = useTranslations("trade");
  const tc = useTranslations("common");

  const SORT_OPTIONS = [
    { value: "newest", label: tt("sortNewest") },
    { value: "price_asc", label: tt("sortPriceLow") },
    { value: "price_desc", label: tt("sortPriceHigh") },
  ];

  const [listings, setListings] = useState<TradeListingDto[]>([]);
  const [gradeFilter, setGradeFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<TradeListingDto | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ offset: "0", limit: "48", sort });
      if (gradeFilter !== "全部") params.set("grade", gradeFilter);
      if (search) params.set("q", search);
      if (priceMin) params.set("priceMin", priceMin);
      if (priceMax) params.set("priceMax", priceMax);

      const data = await apiClient.get<TradeListingPageDto>(
        `/api/v1/trade/listings?${params.toString()}`,
      );
      setListings(data.items ?? []);
    } catch (err) {
      // Treat auth errors as empty list (user not logged in yet)
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        setListings([]);
      } else {
        const msg = err instanceof Error ? err.message : tt("loadFailed");
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, search, sort, priceMin, priceMax, tt]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function handlePurchase() {
    if (!selectedListing) return;
    setPurchasing(true);
    try {
      await apiClient.post(`/api/v1/trade/listings/${selectedListing.id}/purchase`, { listingId: selectedListing.id });
      toast.success(`${tt("purchaseSuccess")} ${selectedListing.prizeName}`);
      setSelectedListing(null);
      loadListings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt("loadFailed"));
    } finally {
      setPurchasing(false);
    }
  }

  // Grade filter display labels: "全部" maps to tc("all"), others keep their value
  const gradeLabel = (grade: string) => grade === "全部" ? tc("all") : grade;

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-3xl">storefront</span>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
                {tt("title")}
              </h1>
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              {tt("subtitle")}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface-container rounded-2xl p-6 mb-8 shadow-xl">
          {/* Search */}
          <div className="relative group mb-5">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors text-xl">
              search
            </span>
            <input
              type="text"
              placeholder={tt("searchPlaceholder")}
              aria-label={tt("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/50 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Grade filter pills */}
            <div className="flex flex-wrap gap-2">
              {GRADE_FILTER_VALUES.map((grade) => (
                <button
                  key={grade}
                  onClick={() => setGradeFilter(grade)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold font-label uppercase tracking-wider transition-all ${
                    gradeFilter === grade
                      ? "bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-md shadow-primary/20"
                      : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {gradeLabel(grade)}
                </button>
              ))}
            </div>

            {/* Price range */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold">
                {tc("pts")}
              </span>
              <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl p-1">
                <input
                  type="number"
                  placeholder="Min"
                  aria-label={tt("priceMin")}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-20 bg-transparent px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                />
                <div className="w-px h-4 bg-on-surface-variant/20" />
                <input
                  type="number"
                  placeholder="Max"
                  aria-label={tt("priceMax")}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-20 bg-transparent px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                />
              </div>

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-surface-container-lowest rounded-xl py-2 pl-3 pr-8 text-xs text-on-surface font-label focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 flex items-center justify-between">
            <span className="text-sm text-error font-body">{error}</span>
            <button
              onClick={loadListings}
              className="text-sm font-medium text-error hover:underline font-label"
            >
              {tc("retry")}
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <PrizeCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon="shopping_cart"
            title={tt("noListings")}
            description={tt("adjustFilters")}
            action={{
              label: tc("clearFilters"),
              onClick: () => {
                setGradeFilter("全部");
                setSearch("");
                setPriceMin("");
                setPriceMax("");
              },
            }}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBuy={() => setSelectedListing(listing)}
                buyLabel={tt("buy")}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB: List a Prize */}
      <Link
        href="/trade/new"
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-semibold font-label shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 active:scale-95 z-30"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        {tt("createListing")}
      </Link>

      {/* Purchase confirmation modal */}
      {selectedListing && (
        <PurchaseConfirm
          listing={selectedListing}
          onConfirm={handlePurchase}
          onClose={() => setSelectedListing(null)}
          loading={purchasing}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onBuy,
  buyLabel,
}: {
  listing: TradeListingDto;
  onBuy: () => void;
  buyLabel: string;
}) {
  return (
    <div
      data-testid="listing-card"
      className="group relative bg-surface-container rounded-lg overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
    >
      {/* Image */}
      <div className="relative w-full h-44 bg-surface-container-low group-hover:bg-surface-container-high overflow-hidden transition-colors">
        {listing.prizePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.prizePhotoUrl}
            alt={listing.prizeName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">
              trophy
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <GradeBadge grade={listing.prizeGrade} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          {listing.sourceCampaignTitle && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold font-label mb-1 block">
              {listing.sourceCampaignTitle}
            </span>
          )}
          <h3 className="font-headline font-bold text-sm text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {listing.prizeName}
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-on-surface/5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">
              person
            </span>
            <span className="text-xs text-on-surface-variant font-body">
              {listing.sellerNickname}
            </span>
          </div>
          <div className="flex items-center gap-1 text-primary font-black font-label">
            <span className="material-symbols-outlined text-sm">monetization_on</span>
            <span className="text-sm">{listing.listPrice.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onBuy}
          className="w-full py-2.5 rounded-xl bg-surface-container-high text-on-surface font-bold font-label text-xs uppercase tracking-widest border border-on-surface/10 group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-primary-container group-hover:text-on-primary group-hover:border-transparent transition-all"
        >
          {buyLabel}
        </button>
      </div>
    </div>
  );
}

function PurchaseConfirm({ listing, onConfirm, onClose, loading }: PurchaseConfirmProps) {
  const tt = useTranslations("trade");
  const tc = useTranslations("common");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-surface-container rounded-lg max-w-sm w-full shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-headline text-lg font-bold text-on-surface">{tt("confirmPurchase")}</h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5 p-4 bg-surface-container-high rounded-xl">
          {listing.prizePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.prizePhotoUrl}
              alt={listing.prizeName}
              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <GradeBadge grade={listing.prizeGrade} className="mb-1.5" />
            <p className="font-headline font-semibold text-on-surface text-sm">
              {listing.prizeName}
            </p>
            <p className="text-xs text-on-surface-variant font-body mt-0.5">
              {tt("seller")}: {listing.sellerNickname}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary">monetization_on</span>
          <span className="font-headline text-2xl font-black text-primary">
            {listing.listPrice.toLocaleString()}
          </span>
          <span className="text-on-surface-variant font-body text-sm">{tc("pts")}</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-on-surface/20 text-on-surface-variant font-label font-medium hover:text-on-surface hover:border-on-surface/40 transition-colors text-sm"
          >
            {tc("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold disabled:opacity-50 transition-all shadow-lg shadow-primary/20 text-sm"
          >
            {loading ? tt("processing") : tt("confirmPurchase")}
          </button>
        </div>
      </div>
    </div>
  );
}
