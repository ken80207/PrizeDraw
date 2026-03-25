"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
        setError(err instanceof Error ? err.message : "無法載入對方賞品，請確認玩家 ID 是否正確"),
      )
      .finally(() => setIsLoadingPrizes(false));
  }

  function toggleOwn(id: string) {
    setSelectedOwn((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRecipient(id: string) {
    setSelectedRecipient((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
      setError(err instanceof Error ? err.message : "Failed to create exchange offer");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Create Exchange Offer
      </h1>

      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Recipient Player ID"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={loadRecipientPrizes}
          disabled={isLoadingPrizes || !recipientId.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isLoadingPrizes ? "Loading…" : "Load Prizes"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-6">
        <PrizeSelector
          title="Their prizes you want"
          prizes={recipientPrizes}
          selected={selectedRecipient}
          onToggle={toggleRecipient}
        />
        <PrizeSelector
          title="Your prizes to offer"
          prizes={ownPrizes}
          selected={selectedOwn}
          onToggle={toggleOwn}
        />
      </div>

      <textarea
        placeholder="Optional message to recipient…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
      />

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting || selectedOwn.size === 0 || selectedRecipient.size === 0}
          className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isSubmitting ? "Sending…" : "Send Offer"}
        </button>
      </div>
    </div>
  );
}

function PrizeSelector({
  title,
  prizes,
  selected,
  onToggle,
}: {
  title: string;
  prizes: PrizeInstanceDto[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
      {prizes.length === 0 && (
        <p className="text-xs text-zinc-400">No prizes available.</p>
      )}
      <ul className="space-y-2">
        {prizes.map((prize) => (
          <li key={prize.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 p-3 hover:border-zinc-400 dark:border-zinc-700">
              <input
                type="checkbox"
                checked={selected.has(prize.id)}
                onChange={() => onToggle(prize.id)}
                className="h-4 w-4 accent-zinc-900"
              />
              <div>
                <span className="text-xs font-bold text-zinc-500">{prize.grade}</span>
                <p className="text-sm text-zinc-900 dark:text-zinc-50">{prize.name}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
