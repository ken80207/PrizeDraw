"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Shared interface
// ---------------------------------------------------------------------------

export interface PityProgressProps {
  drawCount: number;
  threshold: number;
  mode: "PERSISTENT" | "SESSION";
  sessionExpiresAt?: string; // ISO timestamp
  isPityTriggered: boolean;
}

// ---------------------------------------------------------------------------
// PityProgressBar — default horizontal gradient progress bar
// ---------------------------------------------------------------------------

/**
 * Displays pity progress as a horizontal gradient bar with a count label,
 * optional SESSION-mode countdown timer, and a golden glow when pity fires.
 */
export function PityProgressBar({
  drawCount,
  threshold,
  mode,
  sessionExpiresAt,
  isPityTriggered,
}: PityProgressProps) {
  const percent = threshold > 0 ? Math.min((drawCount / threshold) * 100, 100) : 0;
  const remaining = Math.max(threshold - drawCount, 0);

  // --- SESSION countdown timer ---
  // Derive the current seconds synchronously so we never need setState in effect.
  const computeSeconds = (expiresAt: string) =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (mode !== "SESSION" || !sessionExpiresAt) return null;
    return computeSeconds(sessionExpiresAt);
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode !== "SESSION" || !sessionExpiresAt) return;

    timerRef.current = setInterval(() => {
      const s = computeSeconds(sessionExpiresAt);
      setSecondsLeft(s);
      if (s <= 0 && timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [mode, sessionExpiresAt]);

  return (
    <div
      style={{
        background: "#16213e",
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: isPityTriggered
          ? "0 0 0 2px #ffd700, 0 0 16px 4px rgba(255,215,0,0.5)"
          : undefined,
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isPityTriggered ? "#ffd700" : "#c0c1ff",
            letterSpacing: "0.04em",
          }}
        >
          {isPityTriggered ? "✨ 保底觸發！" : "保底進度"}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#e2e0fc",
          }}
        >
          {drawCount} / {threshold}
        </span>
      </div>

      {/* Progress track */}
      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            borderRadius: 5,
            background: isPityTriggered
              ? "linear-gradient(90deg, #ffd700, #ffaa00)"
              : "linear-gradient(90deg, #6c63ff, #e94560)",
            transition: "width 0.5s ease, background 0.4s ease",
          }}
        />
      </div>

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "#d8c3ad" }}>
          再 {remaining} 抽必得稀有獎品
        </span>

        {mode === "SESSION" && secondsLeft !== null && (
          <span
            style={{
              fontSize: 12,
              color: secondsLeft <= 10 ? "#ffb4ab" : "#8fd5ff",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ⏱ {secondsLeft}s
          </span>
        )}
      </div>
    </div>
  );
}
