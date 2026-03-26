"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface FPSStats {
  current: number;
  average: number;
  min: number;
  memoryMB: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** How many recent frame deltas to keep for computing average/min FPS */
const SAMPLE_WINDOW = 60;

/** Refresh UI at most this often (ms) to avoid excessive re-renders */
const UPDATE_INTERVAL_MS = 500;

// ── Colour coding ────────────────────────────────────────────────────────────

function fpsColour(fps: number): string {
  if (fps >= 50) return "#4ade80"; // green-400
  if (fps >= 30) return "#facc15"; // yellow-400
  return "#f87171";               // red-400
}

// ── Extended performance memory type ─────────────────────────────────────────

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function getMemoryMB(): number | null {
  if (typeof performance === "undefined") return null;
  const mem = (performance as unknown as { memory?: PerformanceMemory }).memory;
  if (!mem) return null;
  return Math.round(mem.usedJSHeapSize / 1024 / 1024);
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * FPSCounter — overlay that measures and displays real-time rendering
 * performance using requestAnimationFrame timestamps.
 *
 * Displays:
 *  - Current FPS (colour-coded green/yellow/red)
 *  - Rolling average FPS over the last 60 frames
 *  - Minimum FPS seen in the rolling window
 *  - JS heap memory usage (Chromium only)
 */
export function FPSCounter() {
  const [stats, setStats] = useState<FPSStats>({
    current: 0,
    average: 0,
    min: 0,
    memoryMB: null,
  });

  // Refs so RAF callback doesn't cause stale-closure issues
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const samplesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    let running = true;

    function frame(timestamp: number) {
      if (!running) return;

      if (lastTimeRef.current !== 0) {
        const delta = timestamp - lastTimeRef.current;
        const fps = delta > 0 ? 1000 / delta : 0;

        // Keep a rolling window
        samplesRef.current.push(fps);
        if (samplesRef.current.length > SAMPLE_WINDOW) {
          samplesRef.current.shift();
        }

        // Only update React state periodically to limit re-renders
        if (timestamp - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
          const samples = samplesRef.current;
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          const min = Math.min(...samples);

          setStats({
            current: Math.round(fps),
            average: Math.round(avg),
            min: Math.round(min),
            memoryMB: getMemoryMB(),
          });

          lastUpdateRef.current = timestamp;
        }
      }

      lastTimeRef.current = timestamp;
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const currentColour = fpsColour(stats.current);
  const avgColour = fpsColour(stats.average);
  const minColour = fpsColour(stats.min);

  return (
    <div
      className="fixed bottom-2 right-2 z-50 select-none"
      aria-label="FPS performance monitor"
      role="status"
      aria-live="polite"
    >
      <div className="bg-black/85 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[11px] leading-relaxed shadow-xl">
        {/* Current FPS — largest value */}
        <div className="flex items-baseline gap-1">
          <span className="text-gray-500 text-[9px] uppercase tracking-wider w-7">FPS</span>
          <span style={{ color: currentColour }} className="text-sm font-bold tabular-nums w-6 text-right">
            {stats.current}
          </span>
        </div>

        {/* Average FPS */}
        <div className="flex items-baseline gap-1">
          <span className="text-gray-500 text-[9px] uppercase tracking-wider w-7">AVG</span>
          <span style={{ color: avgColour }} className="tabular-nums w-6 text-right">
            {stats.average}
          </span>
        </div>

        {/* Minimum FPS */}
        <div className="flex items-baseline gap-1">
          <span className="text-gray-500 text-[9px] uppercase tracking-wider w-7">MIN</span>
          <span style={{ color: minColour }} className="tabular-nums w-6 text-right">
            {stats.min}
          </span>
        </div>

        {/* Memory — only shown when available (Chromium) */}
        {stats.memoryMB !== null && (
          <div className="flex items-baseline gap-1 border-t border-white/10 mt-1 pt-1">
            <span className="text-gray-500 text-[9px] uppercase tracking-wider w-7">MEM</span>
            <span className="text-blue-300 tabular-nums w-auto text-right">
              {stats.memoryMB}
              <span className="text-gray-500 text-[9px] ml-0.5">MB</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
