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
      } else {
        setStats({
          todayRevenue: 45200,
          activePlayers: 1234,
          activeCampaigns: 8,
          pendingWithdrawals: 3,
          openTickets: 12,
          pendingShipments: 5,
          revenueChange: 12,
          playerChange: 5,
        });
      }
      if (activityResult.status === "fulfilled") {
        setActivity(activityResult.value);
      } else {
        setActivity([
          { id: "1", type: "draw", message: "PlayerXXX 抽到 A賞（一番賞 ABC）", timestamp: "14:32" },
          { id: "2", type: "trade", message: "交易完成 #1234（350 點）", timestamp: "14:30" },
          { id: "3", type: "ticket", message: "新工單 #1567 已建立", timestamp: "14:28" },
          { id: "4", type: "draw", message: "PlayerYYY 抽到 B賞（無限賞 XYZ）", timestamp: "14:25" },
          { id: "5", type: "withdrawal", message: "提領申請 #89（$380）待審核", timestamp: "14:20" },
        ]);
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
            {/* Revenue chart placeholder */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">近 7 日營收趨勢</h3>
              <div className="flex items-end gap-1 h-32">
                {[38, 42, 35, 50, 48, 44, 45].map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-indigo-200 hover:bg-indigo-400 transition-colors cursor-pointer"
                    style={{ height: `${(v / 55) * 100}%` }}
                    title={`$${v},000`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>週一</span>
                <span>今日</span>
              </div>
            </div>

            {/* Campaign distribution */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">活動類型分佈</h3>
              <div className="flex items-center justify-center h-32">
                <div className="relative">
                  <svg width="100" height="100" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#e0e7ff" strokeWidth="3.8" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="transparent"
                      stroke="#4f46e5" strokeWidth="3.8"
                      strokeDasharray="60 40"
                      strokeDashoffset="25"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">60%</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                  一番賞
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-200 inline-block" />
                  無限賞
                </span>
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
