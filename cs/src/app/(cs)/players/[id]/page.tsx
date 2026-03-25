"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

interface PlayerDetail {
  id: string;
  nickname: string;
  phone?: string;
  email?: string;
  accountStatus: string;
  registeredAt: string;
  lastLoginAt?: string;
  drawPoints: number;
  revenuePoints: number;
  totalSpent: number;
  lineLinked: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  referenceId?: string;
}

interface DrawRecord {
  id: string;
  campaignName: string;
  prizeName: string;
  result: string;
  createdAt: string;
}

interface PrizeItem {
  id: string;
  prizeName: string;
  campaignName: string;
  status: string;
  acquiredAt: string;
}

interface ShippingRecord {
  id: string;
  prizeName: string;
  trackingNumber?: string;
  status: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Status helpers                                                        */
/* ------------------------------------------------------------------ */

const ACCOUNT_STATUS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "正常", className: "text-green-600" },
  SUSPENDED: { label: "停權", className: "text-red-600" },
  BANNED: { label: "封禁", className: "text-red-700" },
  PENDING_VERIFICATION: { label: "待驗證", className: "text-amber-600" },
};

const PRIZE_STATUS_LABELS: Record<string, string> = {
  HOLDING: "持有中",
  SHIPPING: "寄送中",
  DELIVERED: "已送達",
  EXCHANGED: "已兌換",
};

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  PENDING: "待寄送",
  SHIPPED: "已出貨",
  DELIVERED: "已送達",
  RETURNED: "已退回",
};

type Tab =
  | "profile"
  | "transactions"
  | "draws"
  | "prizes"
  | "shipping";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "profile", label: "基本資料", icon: "👤" },
  { key: "transactions", label: "交易紀錄", icon: "💰" },
  { key: "draws", label: "抽獎紀錄", icon: "🎰" },
  { key: "prizes", label: "賞品庫", icon: "🏆" },
  { key: "shipping", label: "寄送紀錄", icon: "📦" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Main component                                                        */
/* ------------------------------------------------------------------ */

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [shipping, setShipping] = useState<ShippingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(true);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayer = useCallback(async () => {
    setIsLoadingPlayer(true);
    try {
      const data = await apiClient.get<PlayerDetail>(
        `/api/v1/admin/players/${playerId}`,
      );
      setPlayer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入玩家資料失敗");
    } finally {
      setIsLoadingPlayer(false);
    }
  }, [playerId]);

  const fetchTabData = useCallback(
    async (tab: Tab) => {
      setIsLoadingTab(true);
      try {
        switch (tab) {
          case "transactions": {
            const data = await apiClient.get<Transaction[]>(
              `/api/v1/admin/players/${playerId}/transactions?limit=50`,
            );
            setTransactions(data);
            break;
          }
          case "draws": {
            const data = await apiClient.get<DrawRecord[]>(
              `/api/v1/admin/players/${playerId}/draws?limit=50`,
            );
            setDraws(data);
            break;
          }
          case "prizes": {
            const data = await apiClient.get<PrizeItem[]>(
              `/api/v1/admin/players/${playerId}/prizes`,
            );
            setPrizes(data);
            break;
          }
          case "shipping": {
            const data = await apiClient.get<ShippingRecord[]>(
              `/api/v1/admin/players/${playerId}/shipping`,
            );
            setShipping(data);
            break;
          }
          default:
            break;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入資料失敗");
      } finally {
        setIsLoadingTab(false);
      }
    },
    [playerId],
  );

  useEffect(() => {
    void fetchPlayer();
  }, [fetchPlayer]);

  useEffect(() => {
    if (activeTab !== "profile") {
      void fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

  if (isLoadingPlayer) {
    return (
      <div className="flex h-64 items-center justify-center">
        <svg
          className="h-6 w-6 animate-spin text-indigo-600"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          />
        </svg>
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 text-slate-500">
        <span className="text-4xl">😕</span>
        <p className="text-base font-medium">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/players")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          返回玩家查詢
        </button>
      </div>
    );
  }

  if (!player) return null;

  const statusConfig = ACCOUNT_STATUS[player.accountStatus] ?? {
    label: player.accountStatus,
    className: "text-slate-600",
  };

  return (
    <div className="p-5">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/players" className="hover:text-slate-700 transition-colors">
          玩家查詢
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-800">{player.nickname}</span>
        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
          唯讀
        </span>
      </div>

      {/* Player header card */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
              {player.nickname.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {player.nickname}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                {player.phone && <span>{player.phone}</span>}
                {player.email && <span>{player.email}</span>}
                <span className={`font-medium ${statusConfig.className}`}>
                  {statusConfig.label}
                </span>
                {player.lineLinked && (
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
                    LINE 已綁定
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                註冊於 {formatDate(player.registeredAt)}
                {player.lastLoginAt &&
                  ` · 最後登入 ${formatDate(player.lastLoginAt)}`}
              </p>
            </div>
          </div>

          {/* Points summary */}
          <div className="flex gap-4">
            <div className="rounded-lg bg-slate-50 px-4 py-2.5 text-center">
              <p className="text-xs text-slate-500">消費點數</p>
              <p className="text-lg font-bold text-slate-900">
                {player.drawPoints.toLocaleString("zh-TW")}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-2.5 text-center">
              <p className="text-xs text-slate-500">收益點數</p>
              <p className="text-lg font-bold text-slate-900">
                {player.revenuePoints.toLocaleString("zh-TW")}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-2.5 text-center">
              <p className="text-xs text-slate-500">累計消費</p>
              <p className="text-lg font-bold text-slate-900">
                NT${player.totalSpent.toLocaleString("zh-TW")}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/tickets?playerId=${player.id}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            查看工單紀錄
          </Link>
          <Link
            href={`/tickets/new?playerId=${player.id}`}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            建立新工單
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isLoadingTab ? (
        <div className="flex h-32 items-center justify-center">
          <svg
            className="h-5 w-5 animate-spin text-indigo-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Profile tab */}
          {activeTab === "profile" && (
            <div className="divide-y divide-slate-100">
              {[
                { label: "玩家 ID", value: player.id },
                { label: "暱稱", value: player.nickname },
                { label: "手機號碼", value: player.phone ?? "未設定" },
                { label: "電子郵件", value: player.email ?? "未設定" },
                { label: "帳戶狀態", value: statusConfig.label },
                { label: "LINE 綁定", value: player.lineLinked ? "已綁定" : "未綁定" },
                { label: "消費點數", value: player.drawPoints.toLocaleString("zh-TW") },
                { label: "收益點數", value: player.revenuePoints.toLocaleString("zh-TW") },
                { label: "累計消費金額", value: `NT$${player.totalSpent.toLocaleString("zh-TW")}` },
                { label: "註冊時間", value: formatDate(player.registeredAt) },
                {
                  label: "最後登入",
                  value: player.lastLoginAt
                    ? formatDate(player.lastLoginAt)
                    : "從未登入",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className="text-sm font-medium text-slate-800">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Transactions tab */}
          {activeTab === "transactions" && (
            <div>
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="text-4xl">💸</span>
                  <p className="mt-3 text-sm">無交易紀錄</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">時間</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">說明</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateShort(tx.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{tx.description}</td>
                        <td className={`px-4 py-3 text-right text-sm font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Draws tab */}
          {activeTab === "draws" && (
            <div>
              {draws.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="text-4xl">🎰</span>
                  <p className="mt-3 text-sm">無抽獎紀錄</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">時間</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">活動</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">獲得賞品</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">結果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draws.map((draw) => (
                      <tr key={draw.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateShort(draw.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{draw.campaignName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{draw.prizeName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{draw.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Prizes tab */}
          {activeTab === "prizes" && (
            <div>
              {prizes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="text-4xl">🏆</span>
                  <p className="mt-3 text-sm">賞品庫為空</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">賞品</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">活動</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">狀態</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">取得時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prizes.map((prize) => (
                      <tr key={prize.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{prize.prizeName}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{prize.campaignName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {PRIZE_STATUS_LABELS[prize.status] ?? prize.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateShort(prize.acquiredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Shipping tab */}
          {activeTab === "shipping" && (
            <div>
              {shipping.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="text-4xl">📦</span>
                  <p className="mt-3 text-sm">無寄送紀錄</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">賞品</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">追蹤號碼</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">狀態</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">出貨時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shipping.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{record.prizeName}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">
                          {record.trackingNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {SHIPPING_STATUS_LABELS[record.status] ?? record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {record.shippedAt ? formatDateShort(record.shippedAt) : "未出貨"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
