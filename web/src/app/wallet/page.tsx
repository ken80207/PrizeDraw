"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";
import { Skeleton } from "@/components/LoadingSkeleton";

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

const TX_TYPE_ICON: Record<string, string> = {
  DRAW_PURCHASE: "add_circle",
  DRAW_SPEND: "shopping_bag",
  TRADE_PURCHASE: "storefront",
  TRADE_SALE: "sell",
  EXCHANGE: "swap_horiz",
  REFUND: "keyboard_return",
  WITHDRAWAL: "account_balance",
  ADJUSTMENT: "tune",
  BUYBACK: "recycling",
};

function getTxIcon(type: string): string {
  return TX_TYPE_ICON[type] ?? "receipt_long";
}

export default function WalletPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const tw = useTranslations("wallet");
  const tc = useTranslations("common");

  useEffect(() => {
    // Wait for localStorage rehydration before deciding to redirect, to avoid
    // a false redirect on the initial render where isAuthenticated is still false.
    if (hasHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return null;
  }

  const TX_TYPE_LABEL: Record<string, string> = {
    DRAW_PURCHASE: tw("recharge"),
    DRAW_SPEND: tc("pts"),
    TRADE_PURCHASE: tc("more"),
    TRADE_SALE: tc("more"),
    EXCHANGE: tc("more"),
    REFUND: tc("more"),
    WITHDRAWAL: tw("withdraw"),
    ADJUSTMENT: tc("more"),
    BUYBACK: tc("more"),
  };

  function formatTxType(type: string): string {
    return TX_TYPE_LABEL[type] ?? type.toLowerCase().replace(/_/g, " ");
  }

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
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : tw("loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    fetchWallet();
  }, [router, tw]);

  if (loading) return <WalletSkeleton />;

  // Fall back to empty wallet so the page structure always renders
  const emptyWallet: WalletData = {
    drawPointsBalance: 0,
    revenuePointsBalance: 0,
    drawTransactions: [],
    revenueTransactions: [],
  };
  const data = wallet ?? emptyWallet;

  const transactions =
    activeTab === "draw" ? data.drawTransactions : data.revenueTransactions;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-error-container/20">
            <span className="text-sm text-on-surface-variant">{error}</span>
            <button onClick={() => window.location.reload()} className="text-xs text-primary font-bold shrink-0">
              {tw("retryBtn")}
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span
            className="material-symbols-outlined text-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            account_balance_wallet
          </span>
          <div>
            <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
              {tw("title")}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{tw("subtitle")}</p>
          </div>
        </div>

        {/* Dual balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

          {/* Draw points card */}
          <div className="relative group bg-surface-container rounded-2xl p-6 overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-secondary font-headline font-bold text-xs tracking-widest uppercase">
                  {tw("drawPointsCardTitle")}
                </h2>
                <span className="material-symbols-outlined text-primary">token</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p
                  data-testid="draw-points-balance"
                  className="font-headline font-extrabold text-5xl text-primary tabular-nums"
                  style={{ textShadow: "0 0 20px rgba(245, 158, 11, 0.4)" }}
                >
                  {data.drawPointsBalance.toLocaleString()}
                </p>
                <span className="text-on-surface-variant text-sm font-medium">{tc("pts")}</span>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">info</span>
                {tw("drawPointsCardDesc")}
              </p>
              <button
                onClick={() => router.push("/payment/packages")}
                className="w-full py-3 rounded-full amber-gradient text-on-primary font-bold text-sm uppercase tracking-widest shadow-lg"
              >
                {tw("recharge")}
              </button>
            </div>
          </div>

          {/* Revenue points card */}
          <div className="relative group bg-surface-container-high rounded-2xl p-6 overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-full -mr-12 -mt-12 blur-2xl group-hover:bg-secondary/20 transition-all pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-secondary font-headline font-bold text-xs tracking-widest uppercase">
                  {tw("revenuePointsCardTitle")}
                </h2>
                <span className="material-symbols-outlined text-secondary">payments</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p
                  data-testid="revenue-points-balance"
                  className="font-headline font-extrabold text-5xl text-on-surface tabular-nums"
                >
                  {data.revenuePointsBalance.toLocaleString()}
                </p>
                <span className="text-on-surface-variant text-sm font-medium">{tc("pts")}</span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  {tw("revenuePointsCardDesc")}
                </p>
                <span className="text-xs text-secondary bg-secondary/10 px-3 py-1 rounded-full font-bold">
                  {tw("revenuePointsRate")}
                </span>
              </div>
              <Link
                href="/wallet/withdraw"
                className="block w-full py-3 rounded-full text-center text-primary font-bold text-sm uppercase tracking-widest transition-all hover:bg-surface-container-highest"
                style={{ border: "1px solid rgba(255,193,116,0.3)" }}
              >
                {tw("withdraw")}
              </Link>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-surface-container rounded-2xl overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex p-1.5 gap-1 bg-surface-container-low">
            {([["draw", tw("drawPointsTab")], ["revenue", tw("revenuePointsTab")]] as [TabId, string][]).map(
              ([value, label]) => (
                <button
                  key={value}
                  data-testid={value === "draw" ? "tab-draw-transactions" : "tab-revenue-transactions"}
                  onClick={() => setActiveTab(value)}
                  className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                    activeTab === value
                      ? "bg-surface-container-highest text-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {/* Transaction list */}
          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-20 block mb-3">
                receipt_long
              </span>
              <p className="text-on-surface-variant text-sm">{tw("noTransactions")}</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-container-high">
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  formatTxType={formatTxType}
                  balanceAfterLabel={tw("balanceAfterLabel")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({
  tx,
  formatTxType,
  balanceAfterLabel,
}: {
  tx: TransactionDto;
  formatTxType: (type: string) => string;
  balanceAfterLabel: string;
}) {
  const isCredit = tx.amount >= 0;
  const icon = getTxIcon(tx.type);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container-high transition-colors">
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isCredit ? "bg-primary/10" : "bg-surface-container-highest"
        }`}
      >
        <span
          className={`material-symbols-outlined text-xl ${isCredit ? "text-primary" : "text-on-surface-variant"}`}
        >
          {icon}
        </span>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">{formatTxType(tx.type)}</p>
        {tx.description && (
          <p className="text-xs text-on-surface-variant truncate">{tx.description}</p>
        )}
        <p className="text-[10px] text-on-surface-variant opacity-50 mt-0.5">
          {new Date(tx.createdAt).toLocaleString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Amounts */}
      <div className="text-right shrink-0">
        <p
          className={`text-sm font-headline font-bold tabular-nums ${
            isCredit ? "text-primary" : "text-error"
          }`}
        >
          {isCredit ? "+" : ""}
          {tx.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-on-surface-variant opacity-50 tabular-nums">
          {balanceAfterLabel} {tx.balanceAfter.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Skeleton className="h-9 w-40 mb-8 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
      <div className="bg-surface-container rounded-2xl overflow-hidden">
        <div className="flex gap-1 p-1.5 bg-surface-container-low">
          <Skeleton className="flex-1 h-10 rounded-full" />
          <Skeleton className="flex-1 h-10 rounded-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-4 border-b border-surface-container-high last:border-0">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
