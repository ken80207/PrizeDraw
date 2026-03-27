"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-tertiary/15 text-tertiary",
  COUNTER_PROPOSED: "bg-secondary/15 text-secondary",
  COMPLETED: "bg-primary/15 text-primary",
  REJECTED: "bg-error/15 text-error",
  CANCELLED: "bg-surface-container-highest text-on-surface-variant",
};

export default function ExchangePage() {
  const t = useTranslations("exchange");
  const tCommon = useTranslations("common");

  const STATUS_LABELS: Record<string, string> = {
    PENDING: t("statusPending"),
    COUNTER_PROPOSED: t("statusCounterProposed"),
    COMPLETED: t("statusCompleted"),
    REJECTED: t("statusRejected"),
    CANCELLED: t("statusCancelled"),
  };

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
      const msg = err instanceof Error ? err.message : t("loadError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  async function handleAccept(offerId: string) {
    try {
      await apiClient.post(`/api/v1/exchange/offers/${offerId}/respond`, { action: "ACCEPT" });
      toast.success(t("accept") + "!");
      loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  }

  async function handleReject(offerId: string) {
    try {
      await apiClient.post(`/api/v1/exchange/offers/${offerId}/respond`, { action: "REJECT" });
      toast.info(t("reject"));
      loadOffers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  }

  const TABS: [Tab, string, string][] = [
    ["received", t("received"), "move_to_inbox"],
    ["sent", t("sent"), "outbox"],
  ];

  const displayed = offers.filter((o) =>
    tab === "sent" ? o.initiatorId === currentPlayerId : o.recipientId === currentPlayerId,
  );

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-3xl">swap_horiz</span>
              <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/exchange/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold font-label shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {t("createOffer")}
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1.5 bg-surface-container rounded-2xl w-fit mb-8">
          {TABS.map(([value, label, icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-label font-bold transition-all ${
                tab === value
                  ? "bg-surface-container-highest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center justify-between p-4 rounded-xl bg-error/10">
            <span className="font-body text-sm text-error">{error}</span>
            <button
              onClick={loadOffers}
              className="font-label text-sm font-medium text-error hover:underline"
            >
              {tCommon("retry")}
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={tab === "received" ? "move_to_inbox" : "outbox"}
            title={tab === "received" ? t("noExchanges") : t("noSentExchanges")}
            description={tab === "received" ? t("noExchangesDesc") : t("noSentExchangesDesc")}
            action={
              tab === "sent"
                ? { label: t("createOffer"), onClick: () => (window.location.href = "/exchange/new") }
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
                statusLabels={STATUS_LABELS}
                fromLabel={t("from")}
                toLabel={t("to")}
                offeredLabel={t("offered")}
                requestedLabel={t("requested")}
                acceptLabel={t("accept")}
                rejectLabel={t("reject")}
                counterProposeLabel={t("counterPropose")}
                viewDetailsLabel={t("viewDetails")}
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
  statusLabels,
  fromLabel,
  toLabel,
  offeredLabel,
  requestedLabel,
  acceptLabel,
  rejectLabel,
  counterProposeLabel,
  viewDetailsLabel,
  onAccept,
  onReject,
}: {
  offer: ExchangeOfferDto;
  tab: Tab;
  statusLabels: Record<string, string>;
  fromLabel: string;
  toLabel: string;
  offeredLabel: string;
  requestedLabel: string;
  acceptLabel: string;
  rejectLabel: string;
  counterProposeLabel: string;
  viewDetailsLabel: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusLabel = statusLabels[offer.status] ?? offer.status;
  const statusStyle = STATUS_STYLES[offer.status] ?? STATUS_STYLES.CANCELLED;
  const isPending = offer.status === "PENDING";

  return (
    <div
      data-testid="exchange-card"
      className="bg-surface-container rounded-lg p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
          <p className="font-headline text-sm font-bold text-on-surface">
            {tab === "received"
              ? `${fromLabel}: ${offer.initiatorNickname}`
              : `${toLabel}: ${offer.recipientNickname}`}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-label ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {/* Prize exchange visual */}
      <div className="flex items-center gap-3 mb-5">
        {/* Initiator items */}
        <div className="flex-1">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
            {offer.initiatorNickname} {offeredLabel}
          </p>
          <div className="flex gap-2 flex-wrap">
            {offer.initiatorItems.map((item, i) => (
              <ItemThumb key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="shrink-0">
          <span className="material-symbols-outlined text-2xl text-on-surface-variant">
            swap_horiz
          </span>
        </div>

        {/* Recipient items */}
        <div className="flex-1">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
            {offer.recipientNickname} {requestedLabel}
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
        <div className="flex items-start gap-2 italic bg-surface-container-high rounded-xl px-4 py-3 mb-4">
          <span className="material-symbols-outlined text-sm text-on-surface-variant flex-shrink-0 mt-0.5">
            format_quote
          </span>
          <p className="font-body text-sm text-on-surface-variant">{offer.message}</p>
        </div>
      )}

      {/* Actions */}
      {isPending && tab === "received" && (
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold font-label shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {acceptLabel}
          </button>
          <Link
            href={`/exchange/${offer.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-secondary/30 text-secondary text-sm font-bold font-label hover:bg-secondary/10 transition-colors text-center"
          >
            <span className="material-symbols-outlined text-sm">reply</span>
            {counterProposeLabel}
          </Link>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-error/30 text-error text-sm font-bold font-label hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
            {rejectLabel}
          </button>
        </div>
      )}

      {!isPending && (
        <Link
          href={`/exchange/${offer.id}`}
          className="flex items-center justify-center gap-1.5 py-2 text-sm font-label text-primary hover:underline transition-colors"
        >
          {viewDetailsLabel}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      )}

      <p className="font-label text-xs text-on-surface-variant/50 mt-3">
        {new Date(offer.createdAt).toLocaleString("zh-TW")}
      </p>
    </div>
  );
}

function ItemThumb({ item }: { item: ExchangeItemDto }) {
  return (
    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-surface-container-high">
      {item.prizePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.prizePhotoUrl}
          alt={item.prizeName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined text-xl text-on-surface-variant/40">
            trophy
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0">
        <GradeBadge
          grade={item.grade}
          className="w-full text-center text-[10px] px-1 py-0.5 rounded-none rounded-b-lg"
        />
      </div>
    </div>
  );
}
