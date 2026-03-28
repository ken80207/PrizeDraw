"use client";

import type { PityProgressProps } from "./PityProgressBar";

// Re-export so consumers can import the interface from any of the three files.
export type { PityProgressProps };

// ---------------------------------------------------------------------------
// PityCircularProgress — SVG ring variant
// ---------------------------------------------------------------------------

const RADIUS = 36;
const STROKE = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = (RADIUS + STROKE) * 2;

/**
 * Displays pity progress as an SVG circular ring with a percentage label in
 * the centre and a count / subtitle beside it.
 */
export function PityCircularProgress({
  drawCount,
  threshold,
  mode,
  isPityTriggered,
}: PityProgressProps) {
  const percent = threshold > 0 ? Math.min((drawCount / threshold) * 100, 100) : 0;
  const remaining = Math.max(threshold - drawCount, 0);
  const dashOffset = CIRCUMFERENCE * (1 - percent / 100);

  const gradientId = "pity-circle-gradient";
  const trackColor = "rgba(255,255,255,0.08)";
  const ringColor = isPityTriggered ? "#ffd700" : "url(#" + gradientId + ")";

  return (
    <div
      style={{
        background: "#16213e",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: isPityTriggered
          ? "0 0 0 2px #ffd700, 0 0 16px 4px rgba(255,215,0,0.5)"
          : undefined,
        transition: "box-shadow 0.4s ease",
      }}
    >
      {/* SVG ring */}
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6c63ff" />
            <stop offset="100%" stopColor="#e94560" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={STROKE}
        />

        {/* Progress arc */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SVG_SIZE / 2} ${SVG_SIZE / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.4s ease" }}
        />

        {/* Centre percentage */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          style={{
            fontSize: 13,
            fontWeight: 700,
            fill: isPityTriggered ? "#ffd700" : "#e2e0fc",
          }}
        >
          {Math.round(percent)}%
        </text>
      </svg>

      {/* Text beside ring */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isPityTriggered ? "#ffd700" : "#c0c1ff",
            marginBottom: 4,
            letterSpacing: "0.04em",
          }}
        >
          {isPityTriggered ? "✨ 保底觸發！" : "保底進度"}
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#e2e0fc",
            lineHeight: 1.1,
            marginBottom: 4,
          }}
        >
          {drawCount}
          <span style={{ fontSize: 13, fontWeight: 400, color: "#a08e7a" }}>
            {" "}
            / {threshold}
          </span>
        </div>

        <div style={{ fontSize: 12, color: "#d8c3ad" }}>
          {mode === "SESSION" ? "本次開箱" : "累計"} · 再 {remaining} 抽必得稀有獎品
        </div>
      </div>
    </div>
  );
}
