"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
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

/** Returns styling for the grade badge */
function gradeStyle(grade: string): string {
  const g = grade.toUpperCase();
  if (g === "SSR" || g === "LAST") return "amber-gradient text-on-primary";
  if (g === "SR") return "bg-secondary text-on-secondary";
  return "bg-surface-container-highest text-on-surface";
}

function stateStyle(state: string) {
  switch (state) {
    case "HOLDING":
      return { bg: "bg-primary/10", text: "text-primary" };
    case "TRADING":
      return { bg: "bg-secondary/10", text: "text-secondary" };
    case "PENDING_SHIPMENT":
    case "SHIPPED":
      return { bg: "bg-tertiary/10", text: "text-tertiary" };
    default:
      return { bg: "bg-surface-container-highest", text: "text-on-surface-variant" };
  }
}

export default function PrizeDetailPage() {
  const t = useTranslations("prizes");
  const tCommon = useTranslations("common");

  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const STATE_LABELS: Record<string, string> = {
    HOLDING: t("stateHolding"),
    TRADING: t("stateTrading"),
    PENDING_SHIPMENT: t("stateShipping"),
    SHIPPED: t("stateShipped"),
    EXCHANGING: t("stateExchanging"),
    RECYCLED: t("stateRecycled"),
  };

  const ACQUISITION_LABELS: Record<string, string> = {
    DRAW: t("acquiredViaDraw"),
    PURCHASE: t("acquiredViaPurchase"),
    EXCHANGE: t("acquiredViaExchange"),
  };

  const [prize, setPrize] = useState<PrizeInstanceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buybackPrice, setBuybackPrice] = useState<number | null>(null);
  const [showBuybackModal, setShowBuybackModal] = useState(false);
  const [isBuyingBack, setIsBuyingBack] = useState(false);
  const [buybackError, setBuybackError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<PrizeInstanceDto>(`/api/v1/players/me/prizes/${id}`)
      .then((data) => {
        setPrize(data);
        setBuybackPrice(data.buybackPrice ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : tCommon("error")))
      .finally(() => setLoading(false));
  }, [id, tCommon]);

  async function handlePreviewBuyback() {
    if (buybackPrice !== null) {
      setShowBuybackModal(true);
      return;
    }
    try {
      const result = await apiClient.get<{ buybackPrice: number }>(
        `/api/v1/prizes/buyback-price/${id}`,
      );
      setBuybackPrice(result.buybackPrice);
      setShowBuybackModal(true);
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleConfirmBuyback() {
    setIsBuyingBack(true);
    setBuybackError(null);
    try {
      await apiClient.post(`/api/v1/prizes/${id}/buyback`, {});
      toast.success(t("buybackSuccessMsg"));
      router.push("/prizes");
    } catch (err) {
      const msg = err instanceof Error ? err.message : tCommon("error");
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
        <span className="material-symbols-outlined text-6xl text-on-surface-variant opacity-20">
          inventory_2
        </span>
        <p className="text-on-surface-variant">{error ?? t("notFound")}</p>
        <button
          onClick={() => router.push("/prizes")}
          className="px-6 py-3 rounded-full amber-gradient text-on-primary font-bold text-sm"
        >
          {t("backToPrizes")}
        </button>
      </div>
    );
  }

  const stateLabel = STATE_LABELS[prize.state] ?? prize.state;
  const stateSty = stateStyle(prize.state);
  const isHolding = prize.state === "HOLDING";
  const isTrading = prize.state === "TRADING";
  const isShipping = prize.state === "PENDING_SHIPMENT" || prize.state === "SHIPPED";

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Back */}
        <Link
          href="/prizes"
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary mb-8 transition-colors group"
        >
          <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">
            arrow_back
          </span>
          {t("backToPrizes")}
        </Link>

        {/* Hero image */}
        <div className="relative w-full aspect-square max-h-96 rounded-2xl overflow-hidden bg-surface-container mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {prize.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.photoUrl}
              alt={prize.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-8xl text-on-surface-variant opacity-20">
                emoji_events
              </span>
            </div>
          )}

          {/* Grade badge overlay */}
          <div className="absolute top-4 left-4">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-xl ${gradeStyle(prize.grade)}`}>
              {prize.grade} TIER
            </span>
          </div>

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none" />
        </div>

        {/* Prize info card */}
        <div className="bg-surface-container rounded-2xl p-6 mb-5 shadow-xl">
          <div className="flex items-start justify-between gap-4 mb-5">
            <h1 className="font-headline font-extrabold text-2xl text-on-surface leading-tight">
              {prize.name}
            </h1>
            <span className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${stateSty.bg} ${stateSty.text}`}>
              {stateLabel}
            </span>
          </div>

          {/* Details grid */}
          <dl className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-high rounded-xl p-4">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">
                {t("sourceCampaign")}
              </dt>
              <dd className="text-sm font-bold text-on-surface">
                {prize.sourceCampaignId ? (
                  <Link
                    href={`/campaigns/${prize.sourceCampaignId}`}
                    className="text-primary hover:opacity-80 transition-opacity"
                  >
                    {prize.sourceCampaignTitle ?? tCommon("unknownCampaign")}
                  </Link>
                ) : (
                  prize.sourceCampaignTitle ?? tCommon("unknownCampaign")
                )}
              </dd>
            </div>

            <div className="bg-surface-container-high rounded-xl p-4">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">
                {t("acquisitionMethod")}
              </dt>
              <dd className="text-sm font-bold text-on-surface">
                {ACQUISITION_LABELS[prize.acquisitionMethod] ?? prize.acquisitionMethod}
              </dd>
            </div>

            <div className="bg-surface-container-high rounded-xl p-4">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">
                {t("acquiredAt")}
              </dt>
              <dd className="text-sm font-bold text-on-surface">
                {new Date(prize.acquiredAt).toLocaleString("zh-TW")}
              </dd>
            </div>

            {buybackPrice !== null && (
              <div className="bg-surface-container-high rounded-xl p-4">
                <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">
                  {t("buybackPrice")}
                </dt>
                <dd className="text-sm font-headline font-extrabold text-primary">
                  {buybackPrice.toLocaleString()} pts
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
                className="flex items-center justify-center gap-2 w-full py-4 rounded-full amber-gradient text-on-primary font-bold text-sm uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">swap_horiz</span>
                {t("tradeListing")}
              </Link>
              <Link
                href={`/shipping/new?prizeId=${prize.id}`}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-surface-container text-on-surface font-bold text-sm uppercase tracking-widest hover:bg-surface-container-high transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="material-symbols-outlined text-lg">local_shipping</span>
                {t("requestShipping")}
              </Link>
              <button
                onClick={handlePreviewBuyback}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-surface-container text-on-surface-variant font-bold text-sm uppercase tracking-widest hover:bg-surface-container-high hover:text-on-surface transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="material-symbols-outlined text-lg">recycling</span>
                {t("officialBuyback")}
              </button>
            </>
          )}

          {isTrading && (
            <div className="p-5 rounded-2xl bg-surface-container flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-xl">info</span>
              <p className="text-sm text-on-surface-variant font-medium">
                {t("tradingInfo")}
              </p>
            </div>
          )}

          {isShipping && (
            <div className="p-5 rounded-2xl bg-surface-container flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-xl">local_shipping</span>
              <p className="text-sm text-on-surface-variant font-medium">
                {t("shippingInfo")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Buyback confirmation modal */}
      {showBuybackModal && buybackPrice !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-container rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">recycling</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t("buybackConfirmModal")}</h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
              {t("buybackConfirmText", {
                name: prize.name,
                grade: prize.grade,
                price: buybackPrice.toLocaleString(),
              })}
            </p>
            {buybackError && (
              <p className="text-sm text-error mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error</span>
                {buybackError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBuybackModal(false)}
                className="flex-1 py-3 rounded-full text-on-surface-variant font-bold text-sm hover:bg-surface-container-high transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={handleConfirmBuyback}
                disabled={isBuyingBack}
                className="flex-1 py-3 rounded-full amber-gradient text-on-primary font-bold text-sm disabled:opacity-40 transition-opacity"
              >
                {isBuyingBack ? tCommon("processing") : t("confirmBuyback")}
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
      <Skeleton className="h-4 w-20 mb-8 rounded-full" />
      <Skeleton className="w-full aspect-square max-h-96 rounded-2xl mb-6" />
      <div className="bg-surface-container rounded-2xl p-6 mb-5 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-14 rounded-full mb-3" />
      <Skeleton className="h-14 rounded-full mb-3" />
    </div>
  );
}
