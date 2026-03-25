"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/LoadingSkeleton";
import { toast } from "@/components/Toast";

interface PrizeInstanceDto {
  id: string;
  grade: string;
  name: string;
  photoUrl: string | null;
  state: string;
  acquisitionMethod: string;
  acquiredAt: string;
  sourceCampaignTitle?: string;
  sourceCampaignId?: string;
  buybackPrice?: number;
}

const STATE_ZH: Record<string, string> = {
  HOLDING: "持有中",
  TRADING: "交易中",
  PENDING_SHIPMENT: "寄送中",
  SHIPPED: "已寄送",
  EXCHANGING: "交換中",
  RECYCLED: "已回收",
};

const ACQUISITION_ZH: Record<string, string> = {
  DRAW: "抽獎",
  PURCHASE: "購買",
  EXCHANGE: "交換",
};

export default function PrizeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [prize, setPrize] = useState<PrizeInstanceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buybackPrice, setBuybackPrice] = useState<number | null>(null);
  const [showBuybackModal, setShowBuybackModal] = useState(false);
  const [isBuyingBack, setIsBuyingBack] = useState(false);
  const [buybackError, setBuybackError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // TODO: No single-prize endpoint defined in PlayerEndpoints. Only list ME_PRIZES exists.
    // Add GET /api/v1/players/me/prizes/{id} to PlayerEndpoints and server routes.
    apiClient
      .get<PrizeInstanceDto>(`/api/v1/players/me/prizes/${id}`)
      .then((data) => {
        setPrize(data);
        setBuybackPrice(data.buybackPrice ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "載入賞品詳情失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePreviewBuyback() {
    if (buybackPrice !== null) {
      setShowBuybackModal(true);
      return;
    }
    try {
      // TODO: No buyback-price endpoint in contracts. Add GET /api/v1/prizes/{id}/buyback-price
      // to PrizeEndpoints and server routes.
      const result = await apiClient.get<{ buybackPrice: number }>(
        `/api/v1/prizes/buyback-price/${id}`,
      );
      setBuybackPrice(result.buybackPrice);
      setShowBuybackModal(true);
    } catch {
      toast.error("無法取得回收價格");
    }
  }

  async function handleConfirmBuyback() {
    setIsBuyingBack(true);
    setBuybackError(null);
    try {
      // TODO: No buyback endpoint in contracts. Add POST /api/v1/prizes/{id}/buyback
      // to PrizeEndpoints and server routes.
      await apiClient.post(`/api/v1/prizes/${id}/buyback`, {});
      toast.success("官方回收成功！點數已存入收益帳戶");
      router.push("/prizes");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "回收失敗";
      setBuybackError(msg);
      toast.error(msg);
    } finally {
      setIsBuyingBack(false);
      setShowBuybackModal(false);
    }
  }

  if (loading) return <PrizeDetailSkeleton />;

  if (error || !prize) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{error ?? "找不到此賞品"}</p>
        <button
          onClick={() => router.push("/prizes")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          返回賞品庫
        </button>
      </div>
    );
  }

  const stateLabel = STATE_ZH[prize.state] ?? prize.state;
  const isHolding = prize.state === "HOLDING";
  const isTrading = prize.state === "TRADING";
  const isShipping = prize.state === "PENDING_SHIPMENT" || prize.state === "SHIPPED";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <Link
          href="/prizes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
        >
          ← 返回賞品庫
        </Link>

        {/* Large product image */}
        <div className="relative w-full aspect-square max-h-96 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-6 shadow-lg">
          {prize.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.photoUrl}
              alt={prize.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl">{prize.grade}</span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <GradeBadge grade={prize.grade} className="text-sm px-3 py-1" />
          </div>
        </div>

        {/* Prize info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{prize.name}</h1>
            <StatusBadge status={stateLabel} />
          </div>

          <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">來源活動</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {prize.sourceCampaignId ? (
                  <Link
                    href={`/campaigns/${prize.sourceCampaignId}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {prize.sourceCampaignTitle ?? "未知活動"}
                  </Link>
                ) : (
                  prize.sourceCampaignTitle ?? "未知活動"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">取得方式</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {ACQUISITION_ZH[prize.acquisitionMethod] ?? prize.acquisitionMethod}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">取得時間</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {new Date(prize.acquiredAt).toLocaleString("zh-TW")}
              </dd>
            </div>
            {buybackPrice !== null && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">官方回收價格</dt>
                <dd className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {buybackPrice.toLocaleString()} 點（收益點數）
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {isHolding && (
            <>
              <Link
                href={`/trade/new?prizeId=${prize.id}`}
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
              >
                🛒 上架交易
              </Link>
              <Link
                href={`/shipping/new?prizeId=${prize.id}`}
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                📦 申請寄送
              </Link>
              <button
                onClick={handlePreviewBuyback}
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                ♻️ 官方回收
              </button>
            </>
          )}

          {isTrading && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                此賞品目前正在交易中，其他操作暫時停用
              </p>
            </div>
          )}

          {isShipping && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                此賞品正在寄送中，請稍待
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Buyback confirmation modal */}
      {showBuybackModal && buybackPrice !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">官方回收確認</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              確定要將「<span className="font-semibold text-gray-900 dark:text-gray-100">{prize.name}</span>」（{prize.grade}）以{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {buybackPrice.toLocaleString()} 收益點數
              </span>{" "}
              回收？此操作無法復原。
            </p>
            {buybackError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{buybackError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBuybackModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBuyback}
                disabled={isBuyingBack}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors text-sm"
              >
                {isBuyingBack ? "處理中..." : "確認回收"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrizeDetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Skeleton className="h-4 w-20 mb-6" />
      <Skeleton className="w-full aspect-square max-h-96 rounded-2xl mb-6" />
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 mb-5 space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-12 rounded-xl mb-3" />
      <Skeleton className="h-12 rounded-xl mb-3" />
    </div>
  );
}
