"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CampaignCard, type CampaignCardData } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { apiClient } from "@/services/apiClient";

type TabId = "all" | "ichiban" | "unlimited";
type SortOption = "newest" | "popular" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "最新" },
  { value: "popular", label: "最熱門" },
  { value: "price_asc", label: "價格低到高" },
  { value: "price_desc", label: "價格高到低" },
];

const TABS: { id: TabId; label: string }[] = [
  { id: "ichiban", label: "一番賞" },
  { id: "unlimited", label: "無限賞" },
  { id: "all", label: "全部" },
];

export default function CampaignsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialType = (searchParams.get("type") as TabId) ?? "ichiban";
  const [activeTab, setActiveTab] = useState<TabId>(initialType);
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadCampaigns = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      const currentPage = reset ? 1 : page;
      try {
        const params = new URLSearchParams({
          sort,
          page: String(currentPage),
          limit: "12",
        });
        if (search) params.set("q", search);

        let items: CampaignCardData[] = [];

        if (activeTab === "all") {
          // Fetch both lists and merge
          const [kujiData, unlimitedData] = await Promise.all([
            apiClient.get<{ items: CampaignCardData[] }>(
              `/api/v1/campaigns/kuji?${params.toString()}`,
            ).catch(() => ({ items: [] as CampaignCardData[] })),
            apiClient.get<{ items: CampaignCardData[] }>(
              `/api/v1/campaigns/unlimited?${params.toString()}`,
            ).catch(() => ({ items: [] as CampaignCardData[] })),
          ]);
          items = [...(kujiData.items ?? []), ...(unlimitedData.items ?? [])];
        } else if (activeTab === "ichiban") {
          const data = await apiClient.get<{ items: CampaignCardData[] }>(
            `/api/v1/campaigns/kuji?${params.toString()}`,
          );
          items = data.items ?? [];
        } else {
          const data = await apiClient.get<{ items: CampaignCardData[] }>(
            `/api/v1/campaigns/unlimited?${params.toString()}`,
          );
          items = data.items ?? [];
        }

        if (reset) {
          setCampaigns(items);
          setPage(1);
        } else {
          setCampaigns((prev) => [...prev, ...items]);
        }
        setHasMore(items.length === 12);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入活動失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, sort, search, page],
  );

  useEffect(() => {
    loadCampaigns(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sort, search]);

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    router.replace(`/campaigns?type=${tab}`, { scroll: false });
  }

  function handleLoadMore() {
    setPage((p) => {
      const next = p + 1;
      // trigger next page load
      setTimeout(() => loadCampaigns(false), 0);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">活動列表</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            瀏覽所有開放中的一番賞及無限賞活動
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
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
              placeholder="搜尋活動名稱..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <span className="text-lg">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={() => loadCampaigns(true)}
              className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline"
            >
              重試
            </button>
          </div>
        )}

        {/* Grid */}
        {loading && campaigns.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.length === 0 && !loading ? (
          <EmptyState
            icon="🎯"
            title="沒有符合條件的活動"
            description="試試調整篩選條件，或稍後再回來看看"
            action={{ label: "清除篩選", onClick: () => { setSearch(""); setSort("newest"); } }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
              {/* Loading more skeletons */}
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <CampaignCardSkeleton key={`sk-${i}`} />
              ))}
            </div>

            {hasMore && !loading && (
              <div className="mt-10 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  載入更多
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
