"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";

// ---------------------------------------------------------------------------
// Shared contract types (mirrors api-contracts DTOs)
// ---------------------------------------------------------------------------

export interface UnlimitedCampaignDto {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  pricePerDraw: number;
  rateLimitPerSecond: number;
  status: string;
  activatedAt: string | null;
}

export interface PrizeDefinitionDto {
  id: string;
  grade: string;
  name: string;
  photos: string[];
  buybackPrice: number;
  buybackEnabled: boolean;
  probabilityBps: number | null;
  ticketCount: number | null;
  displayOrder: number;
}

export interface UnlimitedCampaignDetailDto {
  campaign: UnlimitedCampaignDto;
  prizes: PrizeDefinitionDto[];
}

export interface UnlimitedDrawResultDto {
  prizeInstanceId: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string;
  pointsCharged: number;
  pityProgress?: PityProgressDto;
}

export interface PityProgressDto {
  drawCount: number;
  threshold: number;
  isPityTriggered: boolean;
  mode: string;
  sessionExpiresAt?: string;
}

// ---------------------------------------------------------------------------
// Hook state and return type
// ---------------------------------------------------------------------------

export interface UnlimitedDrawState {
  /** Loaded campaign, or null while fetching. */
  campaign: UnlimitedCampaignDto | null;
  /** Prize probability table ordered by displayOrder. */
  prizes: PrizeDefinitionDto[];
  /** Most recent draw result for the reveal animation. Null before first draw. */
  lastResult: UnlimitedDrawResultDto | null;
  /** Accumulated draw history for the current session, newest first. */
  drawHistory: UnlimitedDrawResultDto[];
  /** Latest pity progress snapshot, or null before first draw. */
  pityProgress: PityProgressDto | null;
  /** True while a draw request is in flight. */
  isDrawing: boolean;
  /** True while campaign detail is loading. */
  isLoading: boolean;
  /** Human-readable error message, or null. */
  error: string | null;
}

export interface UnlimitedDrawActions {
  /** Execute a single draw. */
  draw: () => Promise<void>;
  /** Clear the last result after the reveal animation completes. */
  acknowledgeResult: () => void;
  /** Dismiss the current error. */
  dismissError: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Manages campaign loading, draw execution, and optimistic UI state for an
 * unlimited campaign draw page.
 *
 * On mount the hook fetches `GET /api/v1/campaigns/unlimited/{campaignId}` to
 * populate the prize probability table. Each `draw()` call posts to
 * `POST /api/v1/draws/unlimited` and appends the result to `drawHistory`.
 *
 * Rate-limit errors (HTTP 429) and insufficient-point errors (HTTP 402) are
 * surfaced via the `error` field so the UI can show a user-friendly banner
 * without crashing.
 *
 * @param campaignId The unlimited campaign UUID string.
 * @returns State snapshot and action callbacks.
 */
export function useUnlimitedDraw(
  campaignId: string,
): UnlimitedDrawState & UnlimitedDrawActions {
  const [campaign, setCampaign] = useState<UnlimitedCampaignDto | null>(null);
  const [prizes, setPrizes] = useState<PrizeDefinitionDto[]>([]);
  const [lastResult, setLastResult] = useState<UnlimitedDrawResultDto | null>(null);
  const [drawHistory, setDrawHistory] = useState<UnlimitedDrawResultDto[]>([]);
  const [pityProgress, setPityProgress] = useState<PityProgressDto | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load campaign detail on mount / when campaignId changes
  useEffect(() => {
    if (!campaignId) return;
    setIsLoading(true);
    apiClient
      .get<UnlimitedCampaignDetailDto>(`/api/v1/campaigns/unlimited/${campaignId}`)
      .then((detail) => {
        setCampaign(detail.campaign);
        setPrizes(detail.prizes.slice().sort((a, b) => a.displayOrder - b.displayOrder));
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load campaign"),
      )
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  const draw = useCallback(async () => {
    if (isDrawing || !campaign) return;
    setIsDrawing(true);
    setError(null);
    try {
      const result = await apiClient.post<UnlimitedDrawResultDto>(
        "/api/v1/draws/unlimited",
        { campaignId, quantity: 1 },
      );
      setLastResult(result);
      setDrawHistory((prev) => [result, ...prev]);
      if (result.pityProgress) {
        setPityProgress(result.pityProgress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setIsDrawing(false);
    }
  }, [campaignId, campaign, isDrawing]);

  const acknowledgeResult = useCallback(() => setLastResult(null), []);
  const dismissError = useCallback(() => setError(null), []);

  return {
    campaign,
    prizes,
    lastResult,
    drawHistory,
    pityProgress,
    isDrawing,
    isLoading,
    error,
    draw,
    acknowledgeResult,
    dismissError,
  };
}

// ---------------------------------------------------------------------------
// Pure utility
// ---------------------------------------------------------------------------

/**
 * Converts a probability in basis points to a display string.
 *
 * @param bps Probability in units of 0.0001% (100_0000 = 100%).
 * @returns Formatted percentage string, e.g. `"12.3456%"`.
 */
export function formatProbabilityBps(bps: number): string {
  return `${(bps / 10_000).toFixed(4)}%`;
}
