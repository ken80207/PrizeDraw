"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GradeBadge } from "@/components/GradeBadge";
import { SpectatorAnimation } from "@/components/SpectatorAnimation";
import type { ActiveDrawSession, RevealedResult } from "@/hooks/useDrawSync";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SpectatorBarProps {
  /** Non-null while a player is in the draw animation. */
  activeSession: ActiveDrawSession | null;
  /** Set immediately after DRAW_REVEALED; clear with `onRevealDismissed`. */
  lastRevealed: RevealedResult | null;
  onRevealDismissed: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Horizontal bar displayed at the top of the kuji page while another player
 * is drawing. Shows the player's nickname, animation mode, a live progress bar,
 * and a miniature SpectatorAnimation card.
 *
 * When DRAW_REVEALED fires, a brief celebration overlay is shown for 3 s before
 * auto-dismissing.
 */
export function SpectatorBar({
  activeSession,
  lastRevealed,
  onRevealDismissed,
}: SpectatorBarProps) {
  const t = useTranslations("spectator");

  const ANIMATION_MODE_LABELS: Record<string, string> = {
    TEAR: t("tearMode"),
    SCRATCH: t("scratchMode"),
    FLIP: t("flipMode"),
    INSTANT: t("instantMode"),
  };

  function modeLabel(mode: string): string {
    return ANIMATION_MODE_LABELS[mode] ?? mode;
  }

  // Celebration overlay state — shown for ~3 s after a reveal
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!lastRevealed) return;
    setShowCelebration(true);
    const timer = setTimeout(() => {
      setShowCelebration(false);
      onRevealDismissed();
    }, 3_000);
    return () => clearTimeout(timer);
  }, [lastRevealed, onRevealDismissed]);

  // ── Nothing to show ────────────────────────────────────────────────────────
  if (!activeSession && !showCelebration) return null;

  // ── Celebration overlay (brief, after reveal) ──────────────────────────────
  if (showCelebration && lastRevealed) {
    return (
      <div
        data-testid="spectator-bar"
        className="w-full px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-top duration-300"
        style={{
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(255,193,116,0.1) 100%)",
        }}
      >
        {/* Prize thumbnail */}
        {lastRevealed.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lastRevealed.photoUrl}
            alt={lastRevealed.prizeName}
            className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-lg shadow-primary/20"
          />
        ) : (
          <span className="material-symbols-outlined text-3xl text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
        )}

        {/* Result text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-primary font-bold text-sm font-headline">{t("drawResult")}</span>
            <GradeBadge grade={lastRevealed.grade} />
          </div>
          <p className="text-on-surface font-semibold text-sm truncate mt-0.5">
            {lastRevealed.prizeName}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => {
            setShowCelebration(false);
            onRevealDismissed();
          }}
          className="text-on-surface-variant hover:text-on-surface shrink-0 transition-colors"
          aria-label={t("close")}
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    );
  }

  // ── Active draw bar ────────────────────────────────────────────────────────
  if (!activeSession) return null;

  const progressPct = Math.round(activeSession.progress * 100);

  return (
    <div
      data-testid="spectator-bar"
      className="w-full px-4 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(49,49,192,0.12) 0%, rgba(192,193,255,0.08) 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap sm:flex-nowrap">
        {/* LIVE badge + nickname */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse" />
            {t("live")}
          </span>
          <span data-testid="spectator-nickname" className="text-sm font-medium text-on-surface">
            <span className="material-symbols-outlined text-sm text-secondary align-middle mr-1">movie</span>
            {activeSession.nickname}{" "}
            <span className="text-on-surface-variant font-normal">
              {t("drawing")}
            </span>
          </span>
          <span className="hidden sm:inline text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded-full font-bold">
            {modeLabel(activeSession.animationMode)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Mini animation */}
        <div className="shrink-0 hidden sm:block">
          <SpectatorAnimation
            animationMode={activeSession.animationMode}
            progress={activeSession.progress}
            revealed={false}
          />
        </div>
      </div>
    </div>
  );
}
