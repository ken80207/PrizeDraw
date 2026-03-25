"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ServerStatus = "ONLINE" | "MAINTENANCE";

export type AnnouncementType = "MAINTENANCE" | "ANNOUNCEMENT" | "UPDATE_REQUIRED";

export interface AnnouncementItem {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  isBlocking: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface MinAppVersion {
  android: string | null;
  ios: string | null;
}

export interface ServerStatusData {
  status: ServerStatus;
  serverTime: string;
  announcements: AnnouncementItem[];
  minAppVersion: MinAppVersion | null;
}

export interface UseServerStatusReturn {
  /** Overall server status, or null while the first fetch is in progress. */
  status: ServerStatus | null;
  /** All active announcements returned by the server. */
  announcements: AnnouncementItem[];
  /**
   * True when the server is in maintenance mode and at least one active
   * announcement has `isBlocking = true`. Callers should render a
   * full-screen blocking overlay in this state.
   */
  isBlocked: boolean;
  /** True during the initial fetch. */
  isLoading: boolean;
  /** Error message from the most recent failed fetch attempt, or null. */
  error: string | null;
  /** Immediately re-fetches the status without waiting for the next poll cycle. */
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Polling interval during normal operation (60 seconds). */
const POLL_INTERVAL_NORMAL_MS = 60_000;

/** Polling interval while the server is in blocking maintenance (30 seconds). */
const POLL_INTERVAL_MAINTENANCE_MS = 30_000;

const STATUS_ENDPOINT = "/api/v1/status";

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches `/api/v1/status` on mount and polls periodically.
 *
 * When `isBlocked` is `true`, the caller should replace all rendered children
 * with a full-screen maintenance page. The polling interval automatically
 * shortens to 30 seconds while maintenance is active so the UI recovers
 * promptly once the server comes back online.
 *
 * No authentication is required for the status endpoint.
 */
export function useServerStatus(): UseServerStatusReturn {
  const [data, setData] = useState<ServerStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(STATUS_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json: ServerStatusData = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch server status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Schedule the next poll after a fetch completes.
  const scheduleNextPoll = useCallback(
    (isBlocked: boolean) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      const interval = isBlocked ? POLL_INTERVAL_MAINTENANCE_MS : POLL_INTERVAL_NORMAL_MS;
      timerRef.current = setTimeout(async () => {
        await fetchStatus();
      }, interval);
    },
    [fetchStatus],
  );

  useEffect(() => {
    fetchStatus().then(() => {
      // After the first fetch, schedule polling based on current status.
    });

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [fetchStatus]);

  // Re-schedule every time data changes.
  useEffect(() => {
    const blocked =
      data?.status === "MAINTENANCE" &&
      (data?.announcements?.some((a) => a.isBlocking) ?? false);
    scheduleNextPoll(blocked);
  }, [data, scheduleNextPoll]);

  const status = data?.status ?? null;
  const announcements = data?.announcements ?? [];
  const isBlocked =
    status === "MAINTENANCE" && announcements.some((a) => a.isBlocking);

  return {
    status,
    announcements,
    isBlocked,
    isLoading,
    error,
    refetch: () => void fetchStatus(),
  };
}
