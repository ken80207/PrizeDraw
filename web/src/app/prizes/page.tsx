"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/LoadingSkeleton";
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

/** Returns Tailwind classes for the grade badge */
function gradeStyle(grade: string): string {
  const g = grade.toUpperCase();
  if (g === "SSR" || g === "LAST") return "amber-gradient text-on-primary";
  if (g === "SR") return "bg-secondary text-on-secondary";
  if (g === "R") return "bg-surface-container-highest text-on-surface";
  return "bg-surface-container-highest text-on-surface";
}

export default function PrizesPage() {
  const t = useTranslations("prizes");
  const tCommon = useTranslations("common");

  const FILTER_TABS: { label: string; value: FilterState }[] = [
    { label: t("filterAll"), value: "ALL" },
    { label: t("filterHolding"), value: "HOLDING" },
    { label: t("filterTrading"), value: "TRADING" },
    { label: t("filterShipping"), value: "PENDING_SHIPMENT" },
  ];

  const SORT_OPTIONS: { label: string; value: SortOption }[] = [
    { label: t("sortDateDesc"), value: "date_desc" },
    { label: t("sortDateAsc"), value: "date_asc" },
    { label: t("sortGrade"), value: "grade" },
    { label: t("filterCampaign"), value: "campaign" },
  ];

  const STATE_LABELS: Record<string, string> = {
    HOLDING: t("stateHolding"),
    TRADING: t("stateTrading"),
    PENDING_SHIPMENT: t("stateShipping"),
    SHIPPED: t("stateShipped"),
    EXCHANGING: t("stateExchanging"),
    RECYCLED: t("stateRecycled"),
  };

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
      const msg = err instanceof Error ? err.message : tCommon("error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-primary text-3xl">auto_awesome_motion</span>
              <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-sm text-on-surface-variant mt-1 ml-10">
              {t("subtitle")}
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex bg-surface-container-low p-1.5 rounded-full shadow-inner self-start shrink-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === tab.value
                    ? "bg-surface-container-highest text-primary shadow-lg"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-surface-container rounded-xl px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              style={{ border: "none" }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-surface-container-high flex items-center justify-between">
            <span className="text-sm text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </span>
            <button
              onClick={loadPrizes}
              className="text-sm font-bold text-primary hover:opacity-80"
            >
              {tCommon("retry")}
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <PrizeCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-20">
                inventory_2
              </span>
            </div>
            <h3 className="font-headline font-bold text-2xl text-on-surface mb-2">
              {filter === "ALL" ? t("noPrizes") : t("noFilterPrizes")}
            </h3>
            <p className="text-on-surface-variant max-w-xs mx-auto mb-8 text-sm">
              {filter === "ALL" ? t("noPrizesDesc") : tCommon("clearFilters")}
            </p>
            {filter === "ALL" ? (
              <button
                onClick={() => (window.location.href = "/campaigns")}
                className="px-8 py-3 rounded-full amber-gradient text-on-primary font-bold text-sm uppercase tracking-widest shadow-xl"
              >
                {t("goDraw")}
              </button>
            ) : (
              <button
                onClick={() => setFilter("ALL")}
                className="px-8 py-3 rounded-full amber-gradient text-on-primary font-bold text-sm uppercase tracking-widest shadow-xl"
              >
                {t("viewAllPrizes")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map((p) => (
              <PrizeItemCard key={p.id} prize={p} stateLabels={STATE_LABELS} shipLabel={t("ship")} tradeLabel={t("trade")} detailLabel={t("detail")} unknownCampaign={tCommon("unknownCampaign")} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrizeItemCard({
  prize,
  stateLabels,
  shipLabel,
  tradeLabel,
  detailLabel,
  unknownCampaign,
}: {
  prize: PrizeInstanceDto;
  stateLabels: Record<string, string>;
  shipLabel: string;
  tradeLabel: string;
  detailLabel: string;
  unknownCampaign: string;
}) {
  const stateLabel = stateLabels[prize.state] ?? prize.state;
  const isHolding = prize.state === "HOLDING";

  return (
    <div
      data-testid="prize-card"
      className="group relative bg-surface-container rounded-2xl overflow-visible transition-all duration-500 hover:-translate-y-2 shadow-2xl shadow-black/40 hover:shadow-primary/10"
    >
      {/* Image area */}
      <div className="relative h-52 w-full overflow-hidden rounded-t-2xl bg-surface-container-highest">
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent opacity-70 z-10 pointer-events-none" />
        {prize.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.photoUrl}
            alt={prize.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant opacity-20">
              emoji_events
            </span>
          </div>
        )}
        {/* Grade badge */}
        <div className="absolute top-3 left-3 z-20">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest shadow-lg ${gradeStyle(prize.grade)}`}>
            {prize.grade} TIER
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 relative z-30">
        <h3 className="font-headline font-extrabold text-on-surface text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
          {prize.name}
        </h3>
        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold mb-4 truncate">
          {prize.sourceCampaignTitle ?? unknownCampaign}
        </p>

        {/* Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-on-surface-variant opacity-60">
            {new Date(prize.acquiredAt).toLocaleDateString("zh-TW")}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
            prize.state === "HOLDING"
              ? "bg-primary/10 text-primary"
              : prize.state === "TRADING"
                ? "bg-secondary/10 text-secondary"
                : "bg-surface-container-highest text-on-surface-variant"
          }`}>
            {stateLabel}
          </span>
        </div>

        {/* Hover action buttons — only for HOLDING state */}
        {isHolding && (
          <div className="grid grid-cols-3 gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <Link
              href={`/shipping/new?prizeId=${prize.id}`}
              className="bg-primary/90 hover:bg-primary text-on-primary py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">{shipLabel}</span>
            </Link>
            <Link
              href={`/trade/new?prizeId=${prize.id}`}
              className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-base">swap_horiz</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">{tradeLabel}</span>
            </Link>
            <Link
              href={`/prizes/${prize.id}`}
              className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">{detailLabel}</span>
            </Link>
          </div>
        )}

        {/* Non-holding: just a view link */}
        {!isHolding && (
          <Link
            href={`/prizes/${prize.id}`}
            className="block w-full text-center py-2 rounded-xl bg-surface-container-highest text-on-surface-variant text-xs font-bold hover:text-on-surface transition-colors opacity-0 group-hover:opacity-100"
          >
            {detailLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function PrizeCardSkeleton() {
  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      <Skeleton className="w-full h-52 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    </div>
  );
}
