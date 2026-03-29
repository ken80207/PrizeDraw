"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatCard } from "@/components/StatCard";

interface DashboardStats {
  todayRevenue: number;
  activePlayers: number;
  activeCampaigns: number;
  pendingWithdrawals: number;
  openTickets: number;
  pendingShipments: number;
  revenueChange: number;
  playerChange: number;
}

interface ActivityItem {
  id: string;
  type: "draw" | "trade" | "ticket" | "withdrawal";
  message: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<DashboardStats>("/api/v1/admin/dashboard/stats"),
      apiClient.get<ActivityItem[]>("/api/v1/admin/dashboard/activity"),
    ]).then(([statsResult, activityResult]) => {
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }
      if (activityResult.status === "fulfilled") {
        setActivity(activityResult.value);
      }
      setIsLoading(false);
    });
  }, []);

  const ACTIVITY_ICONS: Record<string, string> = {
    draw: "🎰",
    trade: "💱",
    ticket: "🎧",
    withdrawal: "💰",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">總覽</h1>
        <p className="text-sm text-slate-500">即時營運數據</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-5 h-28" />
          ))
        ) : (
          <>
            <StatCard
              title="今日營收"
              value={`$${(stats?.todayRevenue ?? 0).toLocaleString()}`}
              trend={{ value: `${stats?.revenueChange ?? 0}%`, positive: (stats?.revenueChange ?? 0) > 0 }}
              icon="💰"
              color="green"
            />
            <StatCard
              title="活躍玩家"
              value={(stats?.activePlayers ?? 0).toLocaleString()}
              trend={{ value: `${stats?.playerChange ?? 0}%`, positive: (stats?.playerChange ?? 0) > 0 }}
              icon="👥"
              color="blue"
            />
            <StatCard
              title="進行中活動"
              value={stats?.activeCampaigns ?? 0}
              subtitle="一番賞 + 無限賞"
              icon="🎰"
              color="indigo"
            />
            <StatCard
              title="待處理事項"
              value={(stats?.pendingWithdrawals ?? 0) + (stats?.openTickets ?? 0) + (stats?.pendingShipments ?? 0)}
              subtitle="提領 + 工單 + 出貨"
              icon="⚠️"
              color="yellow"
            />
          </>
        )}
      </div>

      {/* Charts + Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Revenue chart — TODO: integrate real chart library (e.g. recharts) with API data */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">近 7 日營收趨勢</h3>
              <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                接入 API 後顯示圖表
              </div>
            </div>

            {/* Campaign distribution — TODO: integrate real data */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">活動類型分佈</h3>
              <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                接入 API 後顯示圖表
              </div>
            </div>
          </div>
        </div>

        {/* Right column: activity + todo */}
        <div className="space-y-4">
          {/* Live activity */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">即時動態</h3>
            <div className="space-y-3">
              {activity.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <span className="text-base leading-none mt-0.5">{ACTIVITY_ICONS[item.type] ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 leading-snug">{item.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Todo */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">待辦事項</h3>
            <div className="space-y-2">
              {stats && stats.pendingWithdrawals > 0 && (
                <Link
                  href="/withdrawals"
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm hover:bg-red-100 transition-colors"
                >
                  <span className="text-red-700">提領待審核</span>
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {stats.pendingWithdrawals}
                  </span>
                </Link>
              )}
              {stats && stats.openTickets > 0 && (
                <Link
                  href="/support"
                  className="flex items-center justify-between rounded-lg bg-yellow-50 px-3 py-2 text-sm hover:bg-yellow-100 transition-colors"
                >
                  <span className="text-yellow-700">工單未回覆</span>
                  <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
                    {stats.openTickets}
                  </span>
                </Link>
              )}
              {stats && stats.pendingShipments > 0 && (
                <Link
                  href="/shipping"
                  className="flex items-center justify-between rounded-lg bg-yellow-50 px-3 py-2 text-sm hover:bg-yellow-100 transition-colors"
                >
                  <span className="text-yellow-700">出貨待處理</span>
                  <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
                    {stats.pendingShipments}
                  </span>
                </Link>
              )}
              {(!stats || (stats.pendingWithdrawals === 0 && stats.openTickets === 0 && stats.pendingShipments === 0)) && (
                <p className="text-center text-sm text-slate-400 py-2">目前沒有待辦事項 ✓</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
