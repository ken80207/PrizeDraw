"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { authStore, subscribeToAuthStore } from "@/stores/authStore";
import { GradeBadge } from "@/components/GradeBadge";
import { ListItemSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

interface ExchangeItemDto {
  prizeInstanceId: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string | null;
}

interface ExchangeOfferDto {
  id: string;
  initiatorId: string;
  initiatorNickname: string;
  recipientId: string;
  recipientNickname: string;
  initiatorItems: ExchangeItemDto[];
  recipientItems: ExchangeItemDto[];
  status: string;
  message: string | null;
  createdAt: string;
}

type Tab = "received" | "sent";

const STATUS_ZH: Record<string, string> = {
  PENDING: "待回應",
  COUNTER_PROPOSED: "反提案",
  COMPLETED: "已完成",
  REJECTED: "已拒絕",
  CANCELLED: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  COUNTER_PROPOSED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export default function ExchangePage() {
  const [offers, setOffers] = useState<ExchangeOfferDto[]>([]);
  const [tab, setTab] = useState<Tab>("received");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");

  useEffect(() => {
    setCurrentPlayerId(authStore.player?.id ?? "");
    const unsub = subscribeToAuthStore(() => {
      setCurrentPlayerId(authStore.player?.id ?? "");
    });
    return unsub;
  }, []);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ExchangeOfferDto[]>("/api/v1/exchange/offers");
      setOffers(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "載入交換請求失敗";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  async function handleAccept(offerId: string) {
    try {
      await apiClient.post(`/api/v1/exchange/offers/${offerId}/respond`, { action: "ACCEPT" });
      toast.success("已接受交換請求！");
      loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    }
  }

  async function handleReject(offerId: string) {
    try {
      await apiClient.post(`/api/v1/exchange/offers/${offerId}/respond`, { action: "REJECT" });
      toast.info("已拒絕交換請求");
      loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    }
  }

  const displayed = offers.filter((o) =>
    tab === "sent" ? o.initiatorId === currentPlayerId : o.recipientId === currentPlayerId,
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">賞品交換</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              與其他玩家互換喜愛的賞品
            </p>
          </div>
          <Link
            href="/exchange/new"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            + 發起新交換
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit mb-6">
          {([["received", "收到的請求"], ["sent", "發出的請求"]] as [Tab, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button onClick={loadOffers} className="text-sm font-medium text-red-700 hover:underline">
              重試
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={tab === "received" ? "📬" : "📤"}
            title={tab === "received" ? "還沒有收到任何交換請求" : "你還沒有發出任何交換請求"}
            description={
              tab === "received"
                ? "當其他玩家想和你交換賞品時，會出現在這裡"
                : "點擊「發起新交換」開始與玩家進行賞品交換"
            }
            action={
              tab === "sent"
                ? { label: "發起新交換", onClick: () => (window.location.href = "/exchange/new") }
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {displayed.map((offer) => (
              <ExchangeCard
                key={offer.id}
                offer={offer}
                tab={tab}
                onAccept={() => handleAccept(offer.id)}
                onReject={() => handleReject(offer.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExchangeCard({
  offer,
  tab,
  onAccept,
  onReject,
}: {
  offer: ExchangeOfferDto;
  tab: Tab;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusLabel = STATUS_ZH[offer.status] ?? offer.status;
  const statusColor = STATUS_COLORS[offer.status] ?? STATUS_COLORS.CANCELLED;
  const isPending = offer.status === "PENDING";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tab === "received"
            ? `來自: ${offer.initiatorNickname}`
            : `發給: ${offer.recipientNickname}`}
        </p>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Prize exchange visual */}
      <div className="flex items-center gap-3 mb-4">
        {/* Initiator items */}
        <div className="flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {offer.initiatorNickname} 提供
          </p>
          <div className="flex gap-2 flex-wrap">
            {offer.initiatorItems.map((item, i) => (
              <ItemThumb key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="shrink-0 text-gray-400 text-xl">⇌</div>

        {/* Recipient items */}
        <div className="flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {offer.recipientNickname} 的賞品
          </p>
          <div className="flex gap-2 flex-wrap">
            {offer.recipientItems.map((item, i) => (
              <ItemThumb key={i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Message */}
      {offer.message && (
        <p className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 mb-4">
          &ldquo;{offer.message}&rdquo;
        </p>
      )}

      {/* Actions */}
      {isPending && tab === "received" && (
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            接受
          </button>
          <Link
            href={`/exchange/${offer.id}`}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors text-center"
          >
            反提案
          </Link>
          <button
            onClick={onReject}
            className="flex-1 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            拒絕
          </button>
        </div>
      )}

      {!isPending && (
        <Link
          href={`/exchange/${offer.id}`}
          className="block text-center py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          查看詳情 →
        </Link>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        {new Date(offer.createdAt).toLocaleString("zh-TW")}
      </p>
    </div>
  );
}

function ItemThumb({ item }: { item: ExchangeItemDto }) {
  return (
    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
      {item.prizePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.prizePhotoUrl}
          alt={item.prizeName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
          🏆
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0">
        <GradeBadge grade={item.grade} className="w-full text-center text-[10px] px-1 py-0.5 rounded-none rounded-b-lg" />
      </div>
    </div>
  );
}
