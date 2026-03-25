"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

  const campaignId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const boxId = searchParams.get("boxId") ?? "";

  const { tickets, isLoading, isConnected, error, refresh } = useKujiBoard(campaignId, boxId);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ticket Board</h1>
        <div className="flex items-center gap-2">
          <ConnectionDot connected={isConnected} />
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <BoardLoader />
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
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
    <div className="grid grid-cols-5 gap-1 sm:grid-cols-8 md:grid-cols-10">
      {sorted.map((ticket) => (
        <TicketCell key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}

function TicketCell({ ticket }: { ticket: TicketCellViewLocal }) {
  if (ticket.isDrawn) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-zinc-100 p-1 text-center dark:bg-zinc-800">
        {ticket.prizePhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ticket.prizePhotoUrl}
            alt={ticket.prizeName ?? "Prize"}
            className="mb-1 h-8 w-8 rounded object-cover"
          />
        )}
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200 leading-tight">
          {ticket.grade ?? ""}
        </span>
        {ticket.drawnByNickname && (
          <span className="mt-0.5 truncate text-[10px] text-zinc-400 max-w-full">
            {ticket.drawnByNickname}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex aspect-square items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
      {ticket.position}
    </div>
  );
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        connected ? "bg-green-500" : "bg-zinc-400"
      }`}
      title={connected ? "Connected" : "Disconnected"}
    />
  );
}

function BoardLoader() {
  return (
    <div className="grid grid-cols-5 gap-1 sm:grid-cols-8 md:grid-cols-10">
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
        />
      ))}
    </div>
  );
}
