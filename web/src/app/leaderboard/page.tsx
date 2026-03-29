"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { apiClient } from "@/services/apiClient";

type LeaderboardType = "DRAW_COUNT" | "PRIZE_GRADE" | "TRADE_VOLUME";
type LeaderboardPeriod = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL_TIME";

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  score: number;
  detail: string | null;
}

interface SelfRank {
  rank: number;
  score: number;
}

interface LeaderboardData {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  selfRank: SelfRank | null;
}

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const tCommon = useTranslations("common");

  const TYPE_TABS: { value: LeaderboardType; label: string; icon: string; unit: string }[] = [
    { value: "DRAW_COUNT", label: t("drawMasters"), icon: "confirmation_number", unit: t("drawCountUnit") },
    { value: "PRIZE_GRADE", label: t("luckyStars"), icon: "star", unit: t("gradeUnit") },
    { value: "TRADE_VOLUME", label: t("tradeStars"), icon: "swap_horiz", unit: t("tradeUnit") },
  ];

  const PERIOD_TABS: { value: LeaderboardPeriod; label: string }[] = [
    { value: "TODAY", label: t("today") },
    { value: "THIS_WEEK", label: t("thisWeek") },
    { value: "THIS_MONTH", label: t("thisMonth") },
    { value: "ALL_TIME", label: t("allTime") },
  ];

  const [type, setType] = useState<LeaderboardType>("DRAW_COUNT");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTypeInfo = TYPE_TABS.find((tab) => tab.value === type)!;

  const fetchLeaderboard = useCallback(
    async (leaderboardType: LeaderboardType, p: LeaderboardPeriod) => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiClient.get<LeaderboardData>(
          `/api/v1/leaderboards?type=${leaderboardType}&period=${p}&limit=50`,
        );
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchLeaderboard(type, period);
  }, [type, period, fetchLeaderboard]);

  const columnHeader =
    currentTypeInfo.unit === t("drawCountUnit")
      ? t("drawCountLabel")
      : currentTypeInfo.unit === t("gradeUnit")
        ? t("gradeLabel")
        : t("tradeLabel");

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255, 193, 116, 0.05) 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-primary text-3xl">military_tech</span>
              <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight">
                {t("title")}
              </h1>
            </div>
            {/* Type tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" role="tablist">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  role="tab"
                  aria-selected={type === tab.value}
                  onClick={() => setType(tab.value)}
                  className={`shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-headline font-bold tracking-wide transition-all ${
                    type === tab.value
                      ? "bg-surface-container-highest text-primary"
                      : "text-secondary opacity-60 hover:opacity-100 hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period tabs */}
          <div className="flex items-center bg-surface-container-low p-1.5 rounded-full self-start shrink-0" role="tablist">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={period === tab.value}
                data-testid={
                  tab.value === "TODAY" ? "period-today"
                  : tab.value === "THIS_WEEK" ? "period-this-week"
                  : tab.value === "THIS_MONTH" ? "period-this-month"
                  : "period-all-time"
                }
                onClick={() => setPeriod(tab.value)}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  period === tab.value
                    ? "bg-surface-container-high text-primary shadow-sm"
                    : "text-secondary opacity-60 hover:opacity-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-surface-container-high flex items-center justify-between">
            <span className="text-sm text-error">{error}</span>
            <button
              onClick={() => fetchLeaderboard(type, period)}
              className="text-sm font-bold text-primary hover:opacity-80"
            >
              {tCommon("retry")}
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon="🏆"
            title={t("noData")}
            description={t("noDataDesc")}
          />
        ) : (
          <>
            {/* Podium for top 3 */}
            {data.entries.length >= 3 && (
              <div className="grid grid-cols-3 gap-6 mb-12 items-end">
                {/* 2nd */}
                <PodiumCard entry={data.entries[1]} rank={2} unit={currentTypeInfo.unit} scoreLabel={t("score")} detailsLabel={t("details")} />
                {/* 1st */}
                <PodiumCard entry={data.entries[0]} rank={1} unit={currentTypeInfo.unit} scoreLabel={t("score")} detailsLabel={t("details")} />
                {/* 3rd */}
                <PodiumCard entry={data.entries[2]} rank={3} unit={currentTypeInfo.unit} scoreLabel={t("score")} detailsLabel={t("details")} />
              </div>
            )}

            {/* Leaderboard table */}
            <div className="bg-surface-container rounded-2xl overflow-hidden shadow-2xl">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs font-bold tracking-widest uppercase text-secondary opacity-40">
                <div className="col-span-1">{t("rank")}</div>
                <div className="col-span-7">PLAYER</div>
                <div className="col-span-4 text-right">{columnHeader}</div>
              </div>

              <div className="divide-y divide-surface-container-highest">
                {data.entries.slice(3).map((entry) => (
                  <LeaderboardRow
                    key={entry.playerId}
                    entry={entry}
                    unit={currentTypeInfo.unit}
                  />
                ))}
              </div>
            </div>

            {/* Self rank banner */}
            {data.selfRank && !data.entries.some((e) => e.rank === data.selfRank!.rank) && (
              <div
                data-testid="self-rank"
                className="mt-4 flex items-center justify-between glass-panel rounded-2xl px-5 py-4"
                style={{ borderTop: "1px solid rgba(255,193,116,0.1)" }}
              >
                <div>
                  <p className="text-xs text-primary opacity-60 mb-0.5 font-bold uppercase tracking-widest">
                    {t("yourRank")}
                  </p>
                  <p className="font-headline font-bold text-on-surface">
                    #{data.selfRank.rank}
                  </p>
                </div>
                <p className="text-xl font-headline font-extrabold text-primary tabular-nums">
                  {data.selfRank.score.toLocaleString()}
                  <span className="text-sm ml-1 text-on-surface-variant font-normal">{currentTypeInfo.unit}</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  rank,
  unit,
  scoreLabel,
  detailsLabel,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  unit: string;
  scoreLabel: string;
  detailsLabel: string;
}) {
  const rankConfig = {
    1: {
      borderColor: "border-primary",
      avatarSize: "w-20 h-20",
      badgeBg: "amber-gradient",
      badgeColor: "text-on-primary",
      rankBadgeSize: "w-10 h-10 text-sm",
      cardPadding: "p-6",
      nameSize: "text-lg",
      scoreSize: "text-2xl",
      scoreColor: "text-primary",
      rankLabel: "text-primary",
      rankText: "1ST",
      order: "order-2",
      glow: "gold-glow",
      rankNum: "text-8xl opacity-10",
      rankIconBg: "amber-gradient",
      statBg: "bg-surface-container-lowest",
      statBorder: "border-primary/10",
    },
    2: {
      borderColor: "border-[#C0C0C0]/40",
      avatarSize: "w-16 h-16",
      badgeBg: "bg-[#C0C0C0]",
      badgeColor: "text-[#1a1a1a]",
      rankBadgeSize: "w-8 h-8 text-xs",
      cardPadding: "p-5",
      nameSize: "text-base",
      scoreSize: "text-xl",
      scoreColor: "text-on-surface",
      rankLabel: "text-secondary",
      rankText: "2ND",
      order: "order-1",
      glow: "",
      rankNum: "text-6xl opacity-10",
      rankIconBg: "bg-[#C0C0C0]",
      statBg: "bg-surface-container-lowest",
      statBorder: "",
    },
    3: {
      borderColor: "border-[#CD7F32]/40",
      avatarSize: "w-16 h-16",
      badgeBg: "bg-[#CD7F32]",
      badgeColor: "text-white",
      rankBadgeSize: "w-8 h-8 text-xs",
      cardPadding: "p-5",
      nameSize: "text-base",
      scoreSize: "text-xl",
      scoreColor: "text-on-surface",
      rankLabel: "text-on-surface-variant",
      rankText: "3RD",
      order: "order-3",
      glow: "",
      rankNum: "text-6xl opacity-10",
      rankIconBg: "bg-[#CD7F32]",
      statBg: "bg-surface-container-lowest",
      statBorder: "",
    },
  };

  const cfg = rankConfig[rank];
  const isFirst = rank === 1;

  return (
    <div className={`relative flex flex-col ${cfg.order}`}>
      {/* Background rank number */}
      <div className={`absolute -top-4 left-1/2 -translate-x-1/2 font-headline font-black italic select-none text-on-surface ${cfg.rankNum}`}>
        {String(rank).padStart(2, "0")}
      </div>

      {isFirst && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
          <span
            className="material-symbols-outlined text-primary text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            workspace_premium
          </span>
        </div>
      )}

      <div
        className={`bg-surface-container rounded-2xl ${cfg.cardPadding} flex flex-col items-center ${cfg.glow} relative overflow-hidden group hover:bg-surface-container-high transition-all duration-500 mt-${isFirst ? "10" : "6"}`}
        style={isFirst ? { border: "1px solid rgba(255,193,116,0.2)" } : { border: "1px solid rgba(255,255,255,0.05)" }}
      >
        {isFirst && (
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}

        {/* Avatar */}
        <div className="relative mb-4">
          <div
            className={`${cfg.avatarSize} rounded-full overflow-hidden border-4 ${cfg.borderColor} p-0.5`}
            style={isFirst ? { boxShadow: "0 0 30px rgba(255,193,116,0.3)" } : {}}
          >
            {entry.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.avatarUrl}
                alt={entry.nickname}
                className={`w-full h-full object-cover rounded-full ${isFirst ? "scale-110" : ""}`}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
            )}
          </div>
          <div
            className={`absolute -bottom-2 -right-2 ${cfg.rankBadgeSize} rounded-full ${isFirst ? "amber-gradient" : cfg.rankIconBg} flex items-center justify-center ${cfg.badgeColor} font-black shadow-xl`}
          >
            {cfg.rankText}
          </div>
        </div>

        {/* Name */}
        <h3 className={`font-headline font-bold ${cfg.nameSize} text-on-surface mb-1 text-center`}>
          {entry.nickname}
        </h3>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${cfg.rankLabel}`}>
          CONNOISSEUR
        </p>

        {/* Stats */}
        <div className="flex gap-2 w-full">
          <div
            className={`flex-1 ${cfg.statBg} ${isFirst ? "border " + cfg.statBorder : ""} rounded-xl p-3 text-center`}
          >
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isFirst ? "text-primary opacity-60" : "text-secondary opacity-40"}`}>
              {scoreLabel}
            </p>
            <p className={`font-headline font-black ${cfg.scoreSize} ${cfg.scoreColor}`}>
              {entry.score.toLocaleString()}
              <span className="text-xs font-normal ml-1 opacity-60">{unit}</span>
            </p>
          </div>
          {entry.detail && (
            <div
              className={`flex-1 ${cfg.statBg} ${isFirst ? "border " + cfg.statBorder : ""} rounded-xl p-3 text-center`}
            >
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isFirst ? "text-primary opacity-60" : "text-secondary opacity-40"}`}>
                {detailsLabel}
              </p>
              <p className={`font-headline font-black ${cfg.scoreSize} ${cfg.scoreColor} truncate`}>
                {entry.detail}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  unit,
}: {
  entry: LeaderboardEntry;
  unit: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-5 hover:bg-surface-container-high items-center transition-colors group">
      <div className="col-span-1 font-headline font-extrabold text-lg text-secondary opacity-40">
        {String(entry.rank).padStart(2, "0")}
      </div>
      <div className="col-span-7 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-container-highest overflow-hidden shrink-0">
          {entry.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.avatarUrl} alt={entry.nickname} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">person</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">
            {entry.nickname}
          </p>
          {entry.detail && (
            <p className="text-xs text-on-surface-variant opacity-60 truncate">{entry.detail}</p>
          )}
        </div>
      </div>
      <div className="col-span-4 text-right font-headline font-bold text-on-surface tabular-nums">
        {entry.score.toLocaleString()}
        <span className="ml-1 text-xs text-on-surface-variant font-normal">{unit}</span>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-6 items-end mb-10">
        {[2, 1, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <Skeleton className={`rounded-full ${i === 1 ? "w-20 h-20" : "w-16 h-16"}`} />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className={`w-full rounded-2xl ${i === 1 ? "h-40" : "h-32"}`} />
          </div>
        ))}
      </div>
      <div className="bg-surface-container rounded-2xl overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 px-6 py-5 border-b border-surface-container-highest last:border-0">
            <Skeleton className="col-span-1 h-4" />
            <div className="col-span-7 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="col-span-4 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
