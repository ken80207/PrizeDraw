"use client";

import { useEffect, useRef } from "react";
import { FlipReveal } from "./FlipReveal";
import { InstantReveal } from "./InstantReveal";
import { ScratchReveal } from "./ScratchReveal";
import { TearReveal } from "./TearReveal";

export type AnimationMode = "TEAR" | "SCRATCH" | "FLIP" | "INSTANT";

interface AnimatedRevealProps {
  mode: AnimationMode;
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  onRevealed: () => void;
  /** Called when the player explicitly closes the modal without waiting */
  onDismiss?: () => void;
}

/**
 * Full-screen overlay dispatcher that routes to the correct animation
 * component based on `mode`.
 *
 * Wraps the animation in a dark backdrop modal. The backdrop can be tapped
 * on INSTANT mode to dismiss early; interactive modes consume all pointer
 * events so they don't interfere with the backdrop.
 */
export function AnimatedReveal({
  mode,
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  onRevealed,
  onDismiss,
}: AnimatedRevealProps) {
  const revealedRef = useRef(false);

  // Prevent scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleRevealed = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onRevealed();
  };

  const renderAnimation = () => {
    // Canvas API guard — if unavailable fall back to instant
    const canvasUnavailable =
      typeof window !== "undefined" &&
      !document.createElement("canvas").getContext;

    const effectiveMode: AnimationMode = canvasUnavailable
      ? "INSTANT"
      : mode;

    switch (effectiveMode) {
      case "TEAR":
        return (
          <TearReveal
            prizePhotoUrl={prizePhotoUrl}
            onRevealed={handleRevealed}
          />
        );
      case "SCRATCH":
        return (
          <ScratchReveal
            prizePhotoUrl={prizePhotoUrl}
            onRevealed={handleRevealed}
          />
        );
      case "FLIP":
        return (
          <FlipReveal
            prizePhotoUrl={prizePhotoUrl}
            prizeGrade={prizeGrade}
            prizeName={prizeName}
            onRevealed={handleRevealed}
          />
        );
      case "INSTANT":
      default:
        return (
          <InstantReveal
            prizePhotoUrl={prizePhotoUrl}
            prizeGrade={prizeGrade}
            prizeName={prizeName}
            onRevealed={handleRevealed}
          />
        );
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => {
        // Only allow tap-to-dismiss on instant mode (interactive modes own the pointer)
        if (mode === "INSTANT") onDismiss?.();
      }}
    >
      {/* Animation container */}
      <div
        className="relative"
        style={{
          width: "min(340px, 90vw)",
          height: "min(480px, 80vh)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {renderAnimation()}
      </div>

      {/* Prize info bar shown for non-FLIP modes (FLIP embeds its own info) */}
      {(mode === "TEAR" || mode === "SCRATCH") && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl flex flex-col items-center gap-1 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ background: "linear-gradient(90deg,#f59e0b,#f97316)" }}
          >
            {prizeGrade}
          </span>
          <p className="text-white font-semibold text-sm text-center">{prizeName}</p>
        </div>
      )}
    </div>
  );
}
