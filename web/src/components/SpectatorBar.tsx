"use client";

import { useEffect, useState } from "react";
import { GradeBadge } from "@/components/GradeBadge";
import { SpectatorAnimation } from "@/components/SpectatorAnimation";
import type { ActiveDrawSession, RevealedResult } from "@/hooks/useDrawSync";

// ─────────────────────────────────────────────────────────────────────────────
// Animation mode labels (繁體中文)
// ─────────────────────────────────────────────────────────────────────────────

const ANIMATION_MODE_ZH: Record<string, string> = {
  TEAR: "撕籤模式",
  SCRATCH: "刮刮模式",
  FLIP: "翻牌模式",
  INSTANT: "即時模式",
};

function modeLabel(mode: string): string {
  return ANIMATION_MODE_ZH[mode] ?? mode;
}

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
        className="w-full px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-top duration-300"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(249,115,22,0.18) 100%)",
          borderBottom: "1px solid rgba(251,191,36,0.3)",
        }}
      >
        {/* Prize thumbnail */}
        {lastRevealed.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lastRevealed.photoUrl}
            alt={lastRevealed.prizeName}
            className="w-12 h-12 rounded-lg object-cover shrink-0 shadow"
          />
        ) : (
          <span className="text-3xl shrink-0">🏆</span>
        )}

        {/* Result text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-amber-500 font-bold text-sm">🎊 抽籤結果</span>
            <GradeBadge grade={lastRevealed.grade} />
          </div>
          <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm truncate mt-0.5">
            {lastRevealed.prizeName}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => {
            setShowCelebration(false);
            onRevealDismissed();
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg shrink-0"
          aria-label="關閉"
        >
          ×
        </button>
      </div>
    );
  }

  // ── Active draw bar ────────────────────────────────────────────────────────
  if (!activeSession) return null;

  const progressPct = Math.round(activeSession.progress * 100);

  return (
    <div
      className="w-full px-4 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 100%)",
        borderBottom: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap sm:flex-nowrap">
        {/* LIVE badge + nickname */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            LIVE
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            🎬 {activeSession.nickname}{" "}
            <span className="text-gray-500 dark:text-gray-400 font-normal">
              正在抽籤中...
            </span>
          </span>
          <span className="hidden sm:inline text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
            {modeLabel(activeSession.animationMode)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
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
