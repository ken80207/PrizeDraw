"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";

interface ExchangeItemDto {
  prizeInstanceId: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string;
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

/**
 * Exchange request detail page with respond actions.
 *
 * Fetches GET /api/v1/exchange/offers/{offerId}.
 * If the current player is the recipient and status is PENDING/COUNTER_PROPOSED,
 * shows Accept / Reject / Counter-Propose buttons.
 * If the current player is the initiator and status is PENDING, shows Cancel.
 */
export default function ExchangeDetailPage() {
  const t = useTranslations("exchange");
  const tCommon = useTranslations("common");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [offer, setOffer] = useState<ExchangeOfferDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const currentPlayerId =
    typeof window !== "undefined" ? localStorage.getItem("playerId") ?? "" : "";

  useEffect(() => {
    apiClient
      .get<ExchangeOfferDto>(`/api/v1/exchange/offers/${params.id}`)
      .then(setOffer)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("loadError")),
      )
      .finally(() => setIsLoading(false));
  }, [params.id, t]);

  async function respond(action: "ACCEPT" | "REJECT") {
    setIsActing(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/exchange/offers/${params.id}/respond`, { action });
      router.push("/exchange");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setIsActing(false);
    }
  }

  async function cancel() {
    setIsActing(true);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/exchange/offers/${params.id}`);
      router.push("/exchange");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-dim">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-dim">
        <span className="material-symbols-outlined text-5xl text-error">error_outline</span>
        <p className="text-error font-body">{error ?? t("offerNotFound")}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="font-label text-sm text-on-surface-variant hover:text-on-surface underline"
        >
          {tCommon("goBack")}
        </button>
      </div>
    );
  }

  const isRecipient = offer.recipientId === currentPlayerId;
  const isInitiator = offer.initiatorId === currentPlayerId;
  const isPending = offer.status === "PENDING" || offer.status === "COUNTER_PROPOSED";

  const statusStyle =
    offer.status === "COMPLETED"
      ? "bg-primary/15 text-primary"
      : offer.status === "PENDING"
        ? "bg-tertiary/15 text-tertiary"
        : "bg-surface-container-highest text-on-surface-variant";

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-label text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {tCommon("back")}
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">swap_horiz</span>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface">
              {t("exchangeOffer")}
            </h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold font-label ${statusStyle}`}>
            {offer.status.replace("_", " ")}
          </span>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-error/10">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
              error_outline
            </span>
            <p className="font-body text-sm text-error">{error}</p>
          </div>
        )}

        {/* Item lists */}
        <div className="mb-5 grid grid-cols-2 gap-4">
          <ItemList
            title={`${offer.initiatorNickname}${t("offerLabel")}`}
            items={offer.initiatorItems}
          />
          <ItemList
            title={`${offer.recipientNickname}${t("requestLabel")}`}
            items={offer.recipientItems}
          />
        </div>

        {/* Message */}
        {offer.message && (
          <div className="mb-5 flex items-start gap-3 bg-surface-container rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-sm text-on-surface-variant flex-shrink-0 mt-0.5">
              format_quote
            </span>
            <p className="font-body text-sm italic text-on-surface-variant">{offer.message}</p>
          </div>
        )}

        {/* Actions — recipient */}
        {isPending && isRecipient && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => respond("ACCEPT")}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container py-3 text-sm font-bold font-label text-on-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 transition-all"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {isActing ? t("accepting") : t("accept")}
            </button>
            <a
              href={`/exchange/new?recipientId=${offer.initiatorId}&counterFor=${params.id}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-secondary/30 py-3 text-center text-sm font-bold font-label text-secondary hover:bg-secondary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">reply</span>
              {t("counterProposeLink")}
            </a>
            <button
              type="button"
              onClick={() => respond("REJECT")}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-error/30 py-3 text-sm font-bold font-label text-error hover:bg-error/10 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">cancel</span>
              {t("reject")}
            </button>
          </div>
        )}

        {/* Actions — initiator */}
        {isPending && isInitiator && (
          <button
            type="button"
            onClick={cancel}
            disabled={isActing}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-error/30 py-3 text-sm font-bold font-label text-error hover:bg-error/10 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">cancel</span>
            {isActing ? t("cancelling") : t("cancelOffer")}
          </button>
        )}
      </div>
    </div>
  );
}

function ItemList({ title, items }: { title: string; items: ExchangeItemDto[] }) {
  return (
    <div>
      <h2 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.prizeInstanceId}
            className="rounded-xl bg-surface-container p-3"
          >
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary text-[10px] font-bold font-label mb-1.5">
              {item.grade}
            </span>
            <p className="font-body text-sm text-on-surface">{item.prizeName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
