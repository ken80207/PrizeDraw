"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/LoadingSkeleton";
import { toast } from "@/components/Toast";

interface TransactionDto {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface WalletData {
  drawPointsBalance: number;
  revenuePointsBalance: number;
  drawTransactions: TransactionDto[];
  revenueTransactions: TransactionDto[];
}

type TabId = "draw" | "revenue";

const TX_TYPE_ZH: Record<string, string> = {
  DRAW_PURCHASE: "儲值點數",
  DRAW_SPEND: "抽獎消費",
  TRADE_PURCHASE: "市集購買",
  TRADE_SALE: "市集收益",
  EXCHANGE: "賞品交換",
  REFUND: "退款",
  WITHDRAWAL: "提領",
  ADJUSTMENT: "點數調整",
  BUYBACK: "官方回收",
};

function formatTxType(type: string): string {
  return TX_TYPE_ZH[type] ?? type.toLowerCase().replace(/_/g, " ");
}

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("draw");

  useEffect(() => {
    async function fetchWallet() {
      try {
        const data = await apiClient.get<WalletData>("/api/v1/players/me/wallet");
        setWallet(data);
      } catch (err) {
        if (err instanceof Error && err.message.includes("401")) {
          router.push("/(auth)/login");
          return;
        }
        setError(err instanceof Error ? err.message : "載入錢包失敗");
        toast.error("無法載入錢包資料");
      } finally {
        setLoading(false);
      }
    }
    fetchWallet();
  }, [router]);

  if (loading) return <WalletSkeleton />;

  if (error || !wallet) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{error ?? "無法載入錢包"}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          重新載入
        </button>
      </div>
    );
  }

  const transactions =
    activeTab === "draw" ? wallet.drawTransactions : wallet.revenueTransactions;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">我的錢包</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理你的點數與交易紀錄
          </p>
        </div>

        {/* Dual point cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Draw points */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎮</span>
              <span className="text-sm font-medium opacity-90">消費點數</span>
            </div>
            <p data-testid="draw-points-balance" className="text-3xl font-extrabold tabular-nums">
              {wallet.drawPointsBalance.toLocaleString()}
            </p>
            <p className="text-xs opacity-75 mt-1">用於抽獎 / 購買</p>
            <button
              onClick={() => router.push("/payment/packages")}
              className="mt-4 w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors border border-white/30"
            >
              儲值
            </button>
          </div>

          {/* Revenue points */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💰</span>
              <span className="text-sm font-medium opacity-90">收益點數</span>
            </div>
            <p data-testid="revenue-points-balance" className="text-3xl font-extrabold tabular-nums">
              {wallet.revenuePointsBalance.toLocaleString()}
            </p>
            <p className="text-xs opacity-75 mt-1">可提領現金</p>
            <Link
              href="/wallet/withdraw"
              className="mt-4 block w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors border border-white/30 text-center"
            >
              提領
            </Link>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {([["draw", "消費點數明細"], ["revenue", "收益點數明細"]] as [TabId, string][]).map(
              ([value, label]) => (
                <button
                  key={value}
                  data-testid={value === "draw" ? "tab-draw-transactions" : "tab-revenue-transactions"}
                  onClick={() => setActiveTab(value)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    activeTab === value
                      ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {/* Transaction table */}
          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">目前沒有交易紀錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      時間
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      說明
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      金額
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      餘額
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString("zh-TW", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatTxType(tx.type)}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">{tx.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            tx.amount >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}
                          {tx.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                          {tx.balanceAfter.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <Skeleton className="flex-1 h-12 rounded-none" />
          <Skeleton className="flex-1 h-12 rounded-none" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
