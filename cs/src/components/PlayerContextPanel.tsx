"use client";

import Link from "next/link";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface DrawRecord {
  id: string;
  campaignName: string;
  result: string;
  createdAt: string;
}

interface PrizeItem {
  id: string;
  prizeName: string;
  status: string;
}

interface PlayerContext {
  id: string;
  nickname: string;
  phone?: string;
  email?: string;
  drawPoints: number;
  revenuePoints: number;
  accountStatus: string;
  registeredAt: string;
  recentTransactions: Transaction[];
  recentDraws: DrawRecord[];
  prizeInventory: PrizeItem[];
}

interface PlayerContextPanelProps {
  player: PlayerContext | null;
  isLoading?: boolean;
}

const PRIZE_STATUS_LABELS: Record<string, string> = {
  HOLDING: "持有中",
  SHIPPING: "寄送中",
  DELIVERED: "已送達",
  EXCHANGED: "已兌換",
};

const PRIZE_STATUS_COLORS: Record<string, string> = {
  HOLDING: "text-blue-600",
  SHIPPING: "text-amber-600",
  DELIVERED: "text-green-600",
  EXCHANGED: "text-slate-500",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}

function formatPoints(n: number): string {
  return n.toLocaleString("zh-TW");
}

export function PlayerContextPanel({
  player,
  isLoading,
}: PlayerContextPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
        無法載入玩家資訊
      </div>
    );
  }

  const statusOk = player.accountStatus === "ACTIVE";

  return (
    <div className="overflow-y-auto text-sm">
      {/* Player header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
              {player.nickname.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{player.nickname}</p>
              {player.phone && (
                <p className="text-xs text-slate-500">{player.phone}</p>
              )}
            </div>
          </div>
          <Link
            href={`/players/${player.id}`}
            className="flex-shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            詳情
          </Link>
        </div>
      </div>

      {/* Points */}
      <div className="border-b border-slate-200 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">消費點數</p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {formatPoints(player.drawPoints)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">收益點數</p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {formatPoints(player.revenuePoints)}
            </p>
          </div>
        </div>
      </div>

      {/* Account status */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">帳戶狀態</span>
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              statusOk ? "text-green-600" : "text-red-600"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusOk ? "bg-green-500" : "bg-red-500"}`}
            />
            {statusOk ? "正常" : player.accountStatus}
          </span>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="border-b border-slate-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          最近交易
        </p>
        {player.recentTransactions.length === 0 ? (
          <p className="text-xs text-slate-400">無交易紀錄</p>
        ) : (
          <ul className="space-y-1.5">
            {player.recentTransactions.slice(0, 5).map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-600">
                  {formatDate(tx.createdAt)} {tx.description}
                </span>
                <span
                  className={`flex-shrink-0 text-xs font-medium ${
                    tx.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent draws */}
      <div className="border-b border-slate-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          最近抽獎
        </p>
        {player.recentDraws.length === 0 ? (
          <p className="text-xs text-slate-400">無抽獎紀錄</p>
        ) : (
          <ul className="space-y-1.5">
            {player.recentDraws.slice(0, 5).map((draw) => (
              <li key={draw.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-600">
                  {formatDate(draw.createdAt)} {draw.campaignName}
                </span>
                <span className="flex-shrink-0 text-xs text-slate-500">
                  {draw.result}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Prize inventory */}
      <div className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          賞品庫
        </p>
        {player.prizeInventory.length === 0 ? (
          <p className="text-xs text-slate-400">賞品庫為空</p>
        ) : (
          <ul className="space-y-1.5">
            {player.prizeInventory.slice(0, 5).map((prize) => (
              <li key={prize.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-600">
                  {prize.prizeName}
                </span>
                <span
                  className={`flex-shrink-0 text-xs font-medium ${
                    PRIZE_STATUS_COLORS[prize.status] ?? "text-slate-500"
                  }`}
                >
                  {PRIZE_STATUS_LABELS[prize.status] ?? prize.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
