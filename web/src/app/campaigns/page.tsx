"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CampaignCard, type CampaignCardData } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { apiClient } from "@/services/apiClient";

type TabId = "all" | "ichiban" | "unlimited";
type SortOption = "newest" | "popular" | "price_asc" | "price_desc";

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsContent />
    </Suspense>
  );
}

function CampaignsContent() {
  const tc = useTranslations("campaign");
  const tcommon = useTranslations("common");

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "newest", label: tcommon("newest") },
    { value: "popular", label: tc("mostPopular") },
    { value: "price_asc", label: tc("sortPriceLow") },
    { value: "price_desc", label: tc("sortPriceHigh") },
  ];

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: "ichiban", label: tc("ichiban"), icon: "confirmation_number" },
    { id: "unlimited", label: tc("unlimited"), icon: "all_inclusive" },
    { id: "all", label: tcommon("all"), icon: "apps" },
  ];

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
        setError(err instanceof Error ? err.message : tc("loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [activeTab, sort, search, page, tc],
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
    <div className="min-h-screen">
      <div className="p-6 lg:p-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black font-headline text-white tracking-tight">
            {tc("gallery")}
          </h1>
          <p className="mt-1 text-on-surface-variant">
            {tc("browseAll")}
          </p>
        </div>

        {/* Tabs + filter bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-surface-container-high rounded-xl w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              placeholder={tc("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2.5 rounded-xl bg-surface-container border-0 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-4 py-2.5 rounded-xl bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 border-0"
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
          <div className="mb-6 p-4 rounded-xl bg-error-container/20 flex items-center justify-between">
            <div className="flex items-center gap-3 text-on-error-container">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={() => loadCampaigns(true)}
              className="text-sm font-bold text-primary hover:underline"
            >
              {tcommon("retry")}
            </button>
          </div>
        )}

        {/* Grid */}
        {loading && campaigns.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.length === 0 && !loading ? (
          <EmptyState
            icon="confirmation_number"
            title={tc("noCampaigns")}
            description={tc("adjustFilters")}
            action={{ label: tcommon("clearFilters"), onClick: () => { setSearch(""); setSort("newest"); } }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
              {/* Loading more skeletons */}
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <CampaignCardSkeleton key={`sk-${i}`} />
              ))}
            </div>

            {hasMore && !loading && (
              <div className="mt-12 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-10 py-3.5 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm hover:bg-surface-container-highest transition-colors"
                >
                  {tc("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
