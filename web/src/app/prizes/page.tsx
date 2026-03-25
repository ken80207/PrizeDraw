"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/services/apiClient";
import { PrizeCard, type PrizeCardData } from "@/components/PrizeCard";
import { PrizeCardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

interface PrizeInstanceDto {
  id: string;
  prizeDefinitionId: string;
  grade: string;
  name: string;
  photoUrl: string | null;
  state: string;
  acquisitionMethod: string;
  acquiredAt: string;
  sourceCampaignTitle?: string;
}

type FilterState = "ALL" | "HOLDING" | "TRADING" | "PENDING_SHIPMENT" | "SHIPPED";
type SortOption = "date_desc" | "date_asc" | "grade" | "campaign";

const FILTER_TABS: { label: string; value: FilterState }[] = [
  { label: "全部", value: "ALL" },
  { label: "持有中", value: "HOLDING" },
  { label: "交易中", value: "TRADING" },
  { label: "寄送中", value: "PENDING_SHIPMENT" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "取得時間（新→舊）", value: "date_desc" },
  { label: "取得時間（舊→新）", value: "date_asc" },
  { label: "等級", value: "grade" },
  { label: "來源活動", value: "campaign" },
];

const STATE_ZH: Record<string, string> = {
  HOLDING: "持有中",
  TRADING: "交易中",
  PENDING_SHIPMENT: "寄送中",
  SHIPPED: "已寄送",
  EXCHANGING: "交換中",
  RECYCLED: "已回收",
};

function toPrizeCard(p: PrizeInstanceDto): PrizeCardData {
  return {
    id: p.id,
    name: p.name,
    grade: p.grade,
    photoUrl: p.photoUrl,
    sourceCampaign: p.sourceCampaignTitle ?? "未知活動",
    acquisitionDate: new Date(p.acquiredAt).toLocaleDateString("zh-TW"),
    status: STATE_ZH[p.state] ?? p.state,
  };
}

export default function PrizesPage() {
  const [prizes, setPrizes] = useState<PrizeInstanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>("ALL");
  const [sort, setSort] = useState<SortOption>("date_desc");

  const loadPrizes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<PrizeInstanceDto[]>("/api/v1/players/me/prizes");
      setPrizes(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "載入賞品庫失敗";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrizes();
  }, [loadPrizes]);

  // Client-side filter + sort
  const filtered = prizes
    .filter((p) => filter === "ALL" || p.state === filter)
    .sort((a, b) => {
      if (sort === "date_asc") return new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime();
      if (sort === "date_desc") return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
      if (sort === "grade") return a.grade.localeCompare(b.grade);
      if (sort === "campaign") return (a.sourceCampaignTitle ?? "").localeCompare(b.sourceCampaignTitle ?? "");
      return 0;
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">我的賞品庫</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理你所有的賞品，包括交易、寄送和回收
          </p>
        </div>

        {/* Filter tabs + sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === tab.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button
              onClick={loadPrizes}
              className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline"
            >
              重試
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PrizeCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="這裡還沒有賞品"
            description={
              filter === "ALL"
                ? "去抽獎活動抽取你的第一個賞品吧！"
                : `${FILTER_TABS.find((t) => t.value === filter)?.label} 分類目前沒有賞品`
            }
            action={
              filter === "ALL"
                ? { label: "去抽獎", onClick: () => (window.location.href = "/campaigns") }
                : { label: "查看全部賞品", onClick: () => setFilter("ALL") }
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <PrizeCard key={p.id} prize={toPrizeCard(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
