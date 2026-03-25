"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

const GRADE_FILTERS = ["全部", "A賞", "B賞", "C賞", "D賞", "Last賞"];
const SORT_OPTIONS = [
  { value: "newest", label: "最新上架" },
  { value: "price_asc", label: "價格低到高" },
  { value: "price_desc", label: "價格高到低" },
];

export default function TradePage() {
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
      const msg = err instanceof Error ? err.message : "載入市集失敗";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [gradeFilter, search, sort, priceMin, priceMax]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function handlePurchase() {
    if (!selectedListing) return;
    setPurchasing(true);
    try {
      await apiClient.post(`/api/v1/trade/listings/${selectedListing.id}/purchase`, { listingId: selectedListing.id });
      toast.success(`成功購買 ${selectedListing.prizeName}！`);
      setSelectedListing(null);
      loadListings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "購買失敗");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">交易市集</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              購買其他玩家上架的賞品
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              placeholder="搜尋賞品名稱..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Grade filter pills */}
            <div className="flex flex-wrap gap-2">
              {GRADE_FILTERS.map((grade) => (
                <button
                  key={grade}
                  onClick={() => setGradeFilter(grade)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    gradeFilter === grade
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>

            {/* Price range */}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="number"
                placeholder="最低價"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-20 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="number"
                placeholder="最高價"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-20 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button onClick={loadListings} className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">
              重試
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <PrizeCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="目前沒有符合條件的商品"
            description="試試調整篩選條件，或稍後再來看看"
            action={{ label: "清除篩選", onClick: () => { setGradeFilter("全部"); setSearch(""); setPriceMin(""); setPriceMax(""); } }}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBuy={() => setSelectedListing(listing)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB: 我要上架 */}
      <Link
        href="/trade/new"
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 z-30"
      >
        <span className="text-lg">+</span>
        我要上架
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
}: {
  listing: TradeListingDto;
  onBuy: () => void;
}) {
  return (
    <div className="group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all">
      <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {listing.prizePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.prizePhotoUrl}
            alt={listing.prizeName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {listing.prizeGrade}
          </div>
        )}
        <div className="absolute top-2 left-2">
          <GradeBadge grade={listing.prizeGrade} />
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
          {listing.prizeName}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          賣家: {listing.sellerNickname}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
            💰 {listing.listPrice.toLocaleString()} 點
          </span>
          <button
            onClick={onBuy}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
          >
            購買
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseConfirm({ listing, onConfirm, onClose, loading }: PurchaseConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full shadow-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">確認購買</h3>
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          {listing.prizePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.prizePhotoUrl}
              alt={listing.prizeName}
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div>
            <GradeBadge grade={listing.prizeGrade} className="mb-1" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">{listing.prizeName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">賣家: {listing.sellerNickname}</p>
          </div>
        </div>
        <p className="text-center text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-5">
          {listing.listPrice.toLocaleString()} 消費點數
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? "處理中..." : "確認購買"}
          </button>
        </div>
      </div>
    </div>
  );
}
