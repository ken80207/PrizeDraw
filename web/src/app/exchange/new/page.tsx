"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";

interface PrizeInstanceDto {
  id: string;
  grade: string;
  name: string;
  photoUrl: string | null;
  state: string;
}

/**
 * Create exchange offer page.
 *
 * Flow:
 * 1. Player enters the recipient player ID (or it can be passed via query param ?recipientId=).
 * 2. The page loads the recipient's public HOLDING prizes and the current player's HOLDING prizes.
 * 3. Player selects prizes from each side and adds an optional message.
 * 4. Submits POST /api/v1/exchange/offers.
 */
export default function NewExchangePage() {
  return (
    <Suspense>
      <NewExchangeContent />
    </Suspense>
  );
}

function NewExchangeContent() {
  const t = useTranslations("exchange");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipientId, setRecipientId] = useState(searchParams.get("recipientId") ?? "");
  const [recipientPrizes, setRecipientPrizes] = useState<PrizeInstanceDto[]>([]);
  const [ownPrizes, setOwnPrizes] = useState<PrizeInstanceDto[]>([]);
  const [selectedOwn, setSelectedOwn] = useState<Set<string>>(new Set());
  const [selectedRecipient, setSelectedRecipient] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PrizeInstanceDto[]>("/api/v1/players/me/prizes?state=HOLDING")
      .then(setOwnPrizes)
      .catch(() => {});
  }, []);

  function loadRecipientPrizes() {
    if (!recipientId.trim()) return;
    setIsLoadingPrizes(true);
    setError(null);
    apiClient
      .get<PrizeInstanceDto[]>(`/api/v1/players/${recipientId}/prizes/public`)
      .then(setRecipientPrizes)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("loadRecipientError")),
      )
      .finally(() => setIsLoadingPrizes(false));
  }

  function toggleOwn(id: string) {
    setSelectedOwn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleRecipient(id: string) {
    setSelectedRecipient((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function submit() {
    if (selectedOwn.size === 0 || selectedRecipient.size === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/exchange/offers", {
        recipientId,
        offeredPrizeInstanceIds: Array.from(selectedOwn),
        requestedPrizeInstanceIds: Array.from(selectedRecipient),
        message: message.trim() || null,
      });
      router.push("/exchange");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

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

        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-3xl">swap_horiz</span>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {t("createTitle")}
          </h1>
        </div>

        {/* Recipient ID input */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
              person_search
            </span>
            <input
              type="text"
              placeholder={t("recipientPlaceholder")}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/50 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={loadRecipientPrizes}
            disabled={isLoadingPrizes || !recipientId.trim()}
            className="px-5 py-3 rounded-xl bg-surface-container-highest text-on-surface font-label font-bold text-sm hover:text-primary transition-colors disabled:opacity-50"
          >
            {isLoadingPrizes ? t("loadingPrizes") : t("loadPrizesBtn")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-error/10">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
              error_outline
            </span>
            <p className="font-body text-sm text-error">{error}</p>
          </div>
        )}

        {/* Prize selectors */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <PrizeSelector
            title={t("theirPrizes")}
            prizes={recipientPrizes}
            selected={selectedRecipient}
            noPrizesLabel={t("noPrizesAvailable")}
            onToggle={toggleRecipient}
          />
          <PrizeSelector
            title={t("yourPrizes")}
            prizes={ownPrizes}
            selected={selectedOwn}
            noPrizesLabel={t("noPrizesAvailable")}
            onToggle={toggleOwn}
          />
        </div>

        {/* Message */}
        <div className="mb-5">
          <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            {t("optionalMessage")}
          </label>
          <textarea
            placeholder={t("messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-surface-container-lowest px-4 py-3 text-sm text-on-surface font-body placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-on-surface/20 py-3 text-sm font-label font-medium text-on-surface-variant hover:text-on-surface hover:border-on-surface/40 transition-colors"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting || selectedOwn.size === 0 || selectedRecipient.size === 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container py-3 text-sm font-bold font-label text-on-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 transition-all"
          >
            <span className="material-symbols-outlined text-lg">send</span>
            {isSubmitting ? t("sending") : t("sendOffer")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrizeSelector({
  title,
  prizes,
  selected,
  noPrizesLabel,
  onToggle,
}: {
  title: string;
  prizes: PrizeInstanceDto[];
  selected: Set<string>;
  noPrizesLabel: string;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        {title}
      </h2>
      {prizes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-surface-container text-center">
          <span className="material-symbols-outlined text-2xl text-on-surface-variant/40 mb-2">
            inbox
          </span>
          <p className="font-body text-xs text-on-surface-variant/60">{noPrizesLabel}</p>
        </div>
      )}
      <ul className="space-y-2">
        {prizes.map((prize) => (
          <li key={prize.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all ${
                selected.has(prize.id)
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-surface-container border border-transparent hover:border-on-surface/20"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(prize.id)}
                onChange={() => onToggle(prize.id)}
                className="h-4 w-4 accent-primary"
              />
              <div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary text-[10px] font-bold font-label mb-0.5">
                  {prize.grade}
                </span>
                <p className="font-body text-xs text-on-surface">{prize.name}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
