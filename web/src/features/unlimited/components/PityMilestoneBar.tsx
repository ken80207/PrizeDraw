"use client";

import type { PityProgressProps } from "./PityProgressBar";

// Re-export for convenience.
export type { PityProgressProps };

// ---------------------------------------------------------------------------
// PityMilestoneBar — segmented horizontal bar with milestone markers
// ---------------------------------------------------------------------------

const SEGMENTS = 5; // number of equal segments

/**
 * Displays pity progress as a segmented milestone bar.  Each segment
 * represents an equal fraction of the threshold.  A gift icon sits at the
 * rightmost end and glows gold when pity is triggered.
 */
export function PityMilestoneBar({
  drawCount,
  threshold,
  isPityTriggered,
}: PityProgressProps) {
  const percent = threshold > 0 ? Math.min((drawCount / threshold) * 100, 100) : 0;
  const remaining = Math.max(threshold - drawCount, 0);

  // Build segment fill info
  const segmentWidth = 100 / SEGMENTS;
  const segments = Array.from({ length: SEGMENTS }, (_, i) => {
    const segStart = i * segmentWidth;
    const segEnd = (i + 1) * segmentWidth;
    if (percent >= segEnd) return "full";
    if (percent > segStart) return "partial";
    return "empty";
  });

  const filledGradient = isPityTriggered
    ? "linear-gradient(90deg, #ffd700, #ffaa00)"
    : "linear-gradient(90deg, #6c63ff, #e94560)";

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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
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
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e0fc" }}>
          {drawCount} / {threshold}
        </span>
      </div>

      {/* Segmented bar + gift icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", gap: 3 }}>
          {segments.map((fill, idx) => {
            const partialPercent =
              fill === "partial"
                ? ((percent - idx * segmentWidth) / segmentWidth) * 100
                : 0;

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  position: "relative",
                }}
                aria-hidden="true"
              >
                {fill === "full" && (
                  <div
                    style={{
                      height: "100%",
                      width: "100%",
                      borderRadius: 4,
                      background: filledGradient,
                    }}
                  />
                )}
                {fill === "partial" && (
                  <div
                    style={{
                      height: "100%",
                      width: `${partialPercent}%`,
                      borderRadius: 4,
                      background: filledGradient,
                      transition: "width 0.5s ease",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Gift icon at end */}
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 20,
            color: isPityTriggered ? "#ffd700" : "#a08e7a",
            transition: "color 0.4s ease",
            flexShrink: 0,
          }}
          aria-label="保底獎品"
        >
          redeem
        </span>
      </div>

      {/* Milestone tick labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          paddingRight: 26, // align with end of bar (gift icon offset)
        }}
      >
        {Array.from({ length: SEGMENTS + 1 }, (_, i) => (
          <span
            key={i}
            style={{
              fontSize: 10,
              color: "#a08e7a",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round((i / SEGMENTS) * threshold)}
          </span>
        ))}
      </div>

      {/* Subtitle */}
      <div style={{ marginTop: 6, fontSize: 12, color: "#d8c3ad" }}>
        再 {remaining} 抽必得稀有獎品
      </div>
    </div>
  );
}
