"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectKujiWebSocket,
  type BoardSnapshotMessage,
  type KujiWsMessage,
  type RawTicketDto,
  type TicketDrawnMessage,
} from "@/services/kujiWebSocket";
import { apiClient } from "@/services/apiClient";

export interface TicketCellView {
  id: string;
  position: number;
  isDrawn: boolean;
  grade: string | null;
  prizeName: string | null;
  prizePhotoUrl: string | null;
  drawnByNickname: string | null;
  drawnAt: string | null;
}

export interface KujiBoardState {
  /** Ordered ticket cells for the board grid. */
  tickets: TicketCellView[];
  /** True while the initial board data is loading. */
  isLoading: boolean;
  /** True while the WebSocket is connected. */
  isConnected: boolean;
  /** Most recent error message, or null. */
  error: string | null;
  /** Triggers a manual refresh of the ticket board. */
  refresh: () => void;
}

/**
 * Custom hook managing the WebSocket connection and board state for a kuji room.
 *
 * On mount the hook:
 * 1. Fetches the initial ticket board via HTTP.
 * 2. Connects to `/ws/kuji/{campaignId}` for real-time updates.
 * 3. Applies `BOARD_SNAPSHOT` messages (full refresh) and `TICKET_DRAWN` events
 *    (partial update of affected cells).
 *
 * @param campaignId The kuji campaign whose board to track.
 * @param boxId The ticket box to display (used for the HTTP fetch).
 * @returns [KujiBoardState] with the current tickets, loading/connection flags, and refresh.
 */
export function useKujiBoard(campaignId: string, boxId: string): KujiBoardState {
  const [tickets, setTickets] = useState<TicketCellView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  const applySnapshot = useCallback((raw: RawTicketDto[]) => {
    setTickets(raw.map(toView));
  }, []);

  const applyTicketDrawn = useCallback((msg: TicketDrawnMessage) => {
    // Reload the board to get accurate drawn state after a draw event
    fetchBoard(campaignId, boxId).then(applySnapshot).catch(() => {});
  }, [campaignId, boxId, applySnapshot]);

  const handleMessage = useCallback((msg: KujiWsMessage) => {
    if (msg.type === "BOARD_SNAPSHOT") {
      applySnapshot((msg as BoardSnapshotMessage).tickets);
    } else if (msg.type === "TICKET_DRAWN") {
      applyTicketDrawn(msg as TicketDrawnMessage);
    }
  }, [applySnapshot, applyTicketDrawn]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchBoard(campaignId, boxId)
      .then((raw) => { applySnapshot(raw); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load board"))
      .finally(() => setIsLoading(false));
  }, [campaignId, boxId, applySnapshot]);

  useEffect(() => {
    refresh();
    disposeRef.current = connectKujiWebSocket(campaignId, {
      onMessage: handleMessage,
      onConnected: () => setIsConnected(true),
      onDisconnected: () => setIsConnected(false),
      onError: () => setError("WebSocket error"),
    });
    return () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, [campaignId, boxId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tickets, isLoading, isConnected, error, refresh };
}

async function fetchBoard(campaignId: string, boxId: string): Promise<RawTicketDto[]> {
  return apiClient.get<RawTicketDto[]>(
    `/api/v1/campaigns/kuji/${campaignId}/boxes/${boxId}/tickets`,
  );
}

function toView(raw: RawTicketDto): TicketCellView {
  return {
    id: raw.id,
    position: raw.position,
    isDrawn: raw.drawnAt !== null,
    grade: raw.grade,
    prizeName: raw.prizeName,
    prizePhotoUrl: raw.prizePhotoUrl,
    drawnByNickname: raw.drawnByNickname,
    drawnAt: raw.drawnAt,
  };
}
