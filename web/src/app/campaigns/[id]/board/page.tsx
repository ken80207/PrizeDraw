"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useKujiBoard } from "@/features/kuji/useKujiBoard";

/**
 * Interactive ticket board page for a kuji box.
 *
 * Fetches the initial ticket board via HTTP and subscribes to real-time
 * draw events via the kuji WebSocket. Board state is managed by [useKujiBoard].
 *
 * URL params:
 * - `id`    — campaign ID (from dynamic route segment)
 * - `boxId` — ticket box ID (query param)
 */
export default function BoardPage() {
  return (
    <Suspense>
      <BoardContent />
    </Suspense>
  );
}

function BoardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations("campaign");

  const campaignId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const boxId = searchParams.get("boxId") ?? "";
  const isSpectating = searchParams.get("spectate") === "true";

  const { tickets, isLoading, isConnected, error, refresh } = useKujiBoard(campaignId, boxId);

  return (
    <div className="flex min-h-screen flex-col bg-surface-dim">
      {/* Spectate mode banner */}
      {isSpectating && (
        <div className="flex items-center justify-center gap-2 bg-tertiary-container px-4 py-2 text-sm font-medium text-on-tertiary-container">
          <span className="material-symbols-outlined text-base leading-none">visibility</span>
          {t("spectatingMode")}
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between bg-surface-container-low px-4 py-3">
        <h1 className="font-headline text-lg font-semibold text-on-surface">{t("ticketBoard")}</h1>
        <div className="flex items-center gap-3">
          <ConnectionDot connected={isConnected} />
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base leading-none">refresh</span>
            {t("refresh")}
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <BoardLoader />
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-xl bg-error-container/20 px-6 py-4 text-center">
              <span className="material-symbols-outlined mb-2 block text-3xl text-error">error</span>
              <p className="text-sm text-error">{error}</p>
            </div>
          </div>
        ) : (
          <TicketGrid tickets={tickets} />
        )}
      </div>
    </div>
  );
}

interface TicketCellViewLocal {
  id: string;
  position: number;
  isDrawn: boolean;
  grade: string | null;
  prizeName: string | null;
  prizePhotoUrl: string | null;
  drawnByNickname: string | null;
}

function TicketGrid({ tickets }: { tickets: TicketCellViewLocal[] }) {
  const sorted = [...tickets].sort((a, b) => a.position - b.position);
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {sorted.map((ticket) => (
        <TicketCell key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}

function TicketCell({ ticket }: { ticket: TicketCellViewLocal }) {
  const t = useTranslations("campaign");
  if (ticket.isDrawn) {
    return (
      <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg bg-surface-container p-1 text-center">
        {ticket.prizePhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ticket.prizePhotoUrl}
            alt={ticket.prizeName ?? t("ticketDrawn")}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative z-10 flex flex-col items-center">
          {!ticket.prizePhotoUrl && (
            <span className="material-symbols-outlined text-lg text-primary">workspace_premium</span>
          )}
          <span className="text-[9px] font-bold leading-tight text-primary">
            {ticket.grade ?? ""}
          </span>
          {ticket.drawnByNickname && (
            <span className="mt-0.5 max-w-full truncate text-[8px] text-on-surface/60">
              {ticket.drawnByNickname}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-square items-center justify-center rounded-lg bg-surface-container-high text-xs font-bold text-secondary tabular-nums transition-colors hover:bg-surface-container-highest">
      {ticket.position}
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  const t = useTranslations("campaign");
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        connected ? "text-tertiary" : "text-on-surface-variant"
      }`}
      title={connected ? t("connected") : t("disconnected")}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-tertiary animate-pulse" : "bg-on-surface-variant"
        }`}
      />
      {connected ? t("liveConnected") : t("liveOffline")}
    </span>
  );
}

function BoardLoader() {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse rounded-lg bg-surface-container-high"
        />
      ))}
    </div>
  );
}
