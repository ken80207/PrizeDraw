"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";

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

const TYPE_TABS: { value: LeaderboardType; label: string; icon: string; unit: string }[] = [
  { value: "DRAW_COUNT", label: "抽獎達人", icon: "🎫", unit: "次" },
  { value: "PRIZE_GRADE", label: "幸運之星", icon: "⭐", unit: "分" },
  { value: "TRADE_VOLUME", label: "交易風雲", icon: "💱", unit: "點" },
];

const PERIOD_TABS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "TODAY", label: "今日" },
  { value: "THIS_WEEK", label: "本週" },
  { value: "THIS_MONTH", label: "本月" },
  { value: "ALL_TIME", label: "全部" },
];

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const [type, setType] = useState<LeaderboardType>("DRAW_COUNT");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTypeInfo = TYPE_TABS.find((t) => t.value === type)!;

  const fetchLeaderboard = useCallback(
    async (t: LeaderboardType, p: LeaderboardPeriod) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/leaderboards/${t}?period=${p}&limit=50`,
        );
        if (!res.ok) throw new Error(`伺服器錯誤 ${res.status}`);
        const json = (await res.json()) as LeaderboardData;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "載入排行榜失敗");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchLeaderboard(type, period);
  }, [type, period, fetchLeaderboard]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">排行榜</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            看看誰是最強的抽獎達人！
          </p>
        </div>

        {/* Type tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setType(tab.value)}
              className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                type === tab.value
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit mb-6">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPeriod(tab.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button
              onClick={() => fetchLeaderboard(type, period)}
              className="text-sm font-medium text-red-700 hover:underline"
            >
              重試
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={currentTypeInfo.icon}
            title="暫無排行榜資料"
            description="此時段還沒有足夠的資料，稍後再來看看吧！"
          />
        ) : (
          <>
            {/* Podium for top 3 */}
            {data.entries.length >= 3 && (
              <div className="flex items-end justify-center gap-3 mb-6 bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950/20 dark:to-transparent rounded-2xl p-6">
                {/* 2nd */}
                <PodiumCard entry={data.entries[1]} rank={2} unit={currentTypeInfo.unit} />
                {/* 1st */}
                <PodiumCard entry={data.entries[0]} rank={1} unit={currentTypeInfo.unit} />
                {/* 3rd */}
                <PodiumCard entry={data.entries[2]} rank={3} unit={currentTypeInfo.unit} />
              </div>
            )}

            {/* Rest of the list */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {data.entries.slice(3).map((entry) => (
                <LeaderboardRow
                  key={entry.playerId}
                  entry={entry}
                  unit={currentTypeInfo.unit}
                />
              ))}
            </div>

            {/* Self rank banner */}
            {data.selfRank && !data.entries.some((e) => e.rank === data.selfRank!.rank) && (
              <div className="mt-4 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-4">
                <div>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-0.5">你的排名</p>
                  <p className="font-bold text-indigo-700 dark:text-indigo-300">
                    第 {data.selfRank.rank} 名
                  </p>
                </div>
                <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {data.selfRank.score.toLocaleString()} {currentTypeInfo.unit}
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
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  unit: string;
}) {
  const heights = { 1: "h-28", 2: "h-20", 3: "h-16" };
  const orders = { 1: "order-2", 2: "order-1", 3: "order-3" };
  const scales = { 1: "scale-110", 2: "scale-100", 3: "scale-95" };

  return (
    <div className={`flex flex-col items-center ${orders[rank]} ${scales[rank]} transition-transform`}>
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-200 to-purple-200 dark:from-indigo-700 dark:to-purple-700 flex items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-200 mb-1 overflow-hidden">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt={entry.nickname} className="w-full h-full object-cover" />
        ) : (
          entry.nickname.charAt(0)
        )}
      </div>
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 max-w-[80px] truncate text-center">
        {entry.nickname}
      </p>
      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
        {entry.score.toLocaleString()} {unit}
      </p>
      <div
        className={`${heights[rank]} w-16 rounded-t-xl flex items-start justify-center pt-1 ${
          rank === 1
            ? "bg-amber-400 dark:bg-amber-500"
            : rank === 2
              ? "bg-gray-300 dark:bg-gray-500"
              : "bg-amber-600 dark:bg-amber-700"
        }`}
      >
        <span className="text-2xl">{RANK_MEDALS[rank]}</span>
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
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <span className="w-8 text-center text-sm font-bold text-gray-500 dark:text-gray-400 tabular-nums">
        {RANK_MEDALS[entry.rank] ?? `#${entry.rank}`}
      </span>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-300 overflow-hidden shrink-0">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt={entry.nickname} className="w-full h-full object-cover" />
        ) : (
          entry.nickname.charAt(0)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{entry.nickname}</p>
        {entry.detail && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.detail}</p>
        )}
      </div>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
        {entry.score.toLocaleString()} {unit}
      </span>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-center gap-3 bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-6">
        {[2, 1, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-14 h-14 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className={`w-16 rounded-t-xl ${i === 1 ? "h-24" : i === 2 ? "h-16" : "h-12"}`} />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <Skeleton className="w-8 h-4" />
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
