"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
        setError(err instanceof Error ? err.message : "Failed to load offer"),
      )
      .finally(() => setIsLoading(false));
  }, [params.id]);

  async function respond(action: "ACCEPT" | "REJECT") {
    setIsActing(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/exchange/offers/${params.id}/respond`, { action });
      router.push("/exchange");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
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
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      </div>
    );
  }
  if (error || !offer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600">{error ?? "Offer not found"}</p>
        <button type="button" onClick={() => router.back()} className="text-sm underline">
          Go back
        </button>
      </div>
    );
  }

  const isRecipient = offer.recipientId === currentPlayerId;
  const isInitiator = offer.initiatorId === currentPlayerId;
  const isPending = offer.status === "PENDING" || offer.status === "COUNTER_PROPOSED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button type="button" onClick={() => router.back()} className="mb-6 text-sm text-zinc-500 hover:text-zinc-800">
        ← Back
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Exchange Offer</h1>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            offer.status === "COMPLETED"
              ? "bg-green-100 text-green-800"
              : offer.status === "PENDING"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {offer.status.replace("_", " ")}
        </span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <ItemList title={`${offer.initiatorNickname}'s Offer`} items={offer.initiatorItems} />
        <ItemList title={`${offer.recipientNickname}'s Request`} items={offer.recipientItems} />
      </div>

      {offer.message && (
        <blockquote className="mb-4 rounded-lg border-l-4 border-zinc-300 bg-zinc-50 p-3 text-sm italic text-zinc-600 dark:bg-zinc-800">
          {offer.message}
        </blockquote>
      )}

      {isPending && isRecipient && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => respond("ACCEPT")}
            disabled={isActing}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {isActing ? "Processing…" : "Accept"}
          </button>
          <a
            href={`/exchange/new?recipientId=${offer.initiatorId}&counterFor=${params.id}`}
            className="block w-full rounded-lg border border-zinc-300 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            Counter-Propose
          </a>
          <button
            type="button"
            onClick={() => respond("REJECT")}
            disabled={isActing}
            className="w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {isPending && isInitiator && (
        <button
          type="button"
          onClick={cancel}
          disabled={isActing}
          className="w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {isActing ? "Cancelling…" : "Cancel Offer"}
        </button>
      )}
    </div>
  );
}

function ItemList({ title, items }: { title: string; items: ExchangeItemDto[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.prizeInstanceId}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <span className="text-xs font-bold text-zinc-500">{item.grade}</span>
            <p className="text-sm text-zinc-900 dark:text-zinc-50">{item.prizeName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
