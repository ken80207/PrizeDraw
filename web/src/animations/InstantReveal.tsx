"use client";

import { useEffect, useRef, useState } from "react";

interface InstantRevealProps {
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  onRevealed: () => void;
}

const SCALE_DURATION_MS = 300;

/**
 * Instant reveal animation — a brief scale-up + fade-in of the prize.
 *
 * Uses a CSS animation defined inline for zero external dependencies.
 * `onRevealed` is called after the animation completes (300ms).
 */
export function InstantReveal({
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  onRevealed,
}: InstantRevealProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Start animation on next frame so the initial "invisible" state paints first
    const raf = requestAnimationFrame(() => {
      setVisible(true);
    });
    timerRef.current = setTimeout(() => {
      onRevealed();
    }, SCALE_DURATION_MS + 50);

    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onRevealed]);

  return (
    <div
      className="relative overflow-hidden rounded-xl w-full h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.88)",
        transition: `opacity ${SCALE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${SCALE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={prizePhotoUrl}
        alt={prizeName}
        className="block w-full h-full object-cover"
        draggable={false}
      />

      {/* Prize info overlay at bottom */}
      <div
        className="absolute bottom-0 inset-x-0 p-4 flex flex-col items-center gap-1"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)",
        }}
      >
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ background: "linear-gradient(90deg,#f59e0b,#f97316)" }}
        >
          {prizeGrade}
        </span>
        <p className="text-white font-semibold text-sm text-center leading-tight drop-shadow">
          {prizeName}
        </p>
      </div>
    </div>
  );
}
