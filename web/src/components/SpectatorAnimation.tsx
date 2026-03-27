"use client";

import { useEffect, useRef } from "react";
import type { AnimationMode } from "@/animations/AnimatedReveal";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SpectatorAnimationProps {
  animationMode: string;
  /** Normalised 0.0 – 1.0 draw progress reported by the drawing player. */
  progress: number;
  /** Prize photo URL — only available after DRAW_REVEALED. */
  prizePhotoUrl?: string | null;
  /** Whether the reveal has happened. */
  revealed?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read-only miniature animation that mirrors the drawing player's current
 * progress for spectators. The card is intentionally smaller (200 × 280 px)
 * than the full player version and has pointer-events disabled.
 *
 * Mode-specific behaviour:
 *   TEAR    — paper-peel fill driven by `progress`
 *   SCRATCH — scratch reveal coverage driven by `progress`
 *   FLIP    — rotates at progress > 0.5
 *   INSTANT — spinner → prize photo
 */
export function SpectatorAnimation({
  animationMode,
  progress,
  prizePhotoUrl,
  revealed = false,
}: SpectatorAnimationProps) {
  const mode = (animationMode as AnimationMode) ?? "INSTANT";

  // ── After reveal: show prize photo ──────────────────────────────────────────
  if (revealed && prizePhotoUrl) {
    return (
      <div className="w-[200px] h-[280px] rounded-xl overflow-hidden relative shrink-0 shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={prizePhotoUrl}
          alt="抽籤結果"
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
            已揭曉
          </span>
        </div>
      </div>
    );
  }

  // ── Mode-specific spectator views ────────────────────────────────────────────
  if (mode === "TEAR") return <TearSpectator progress={progress} />;
  if (mode === "SCRATCH") return <ScratchSpectator progress={progress} />;
  if (mode === "FLIP") return <FlipSpectator progress={progress} />;
  return <InstantSpectator />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAR — canvas parchment peel driven by progress
// ─────────────────────────────────────────────────────────────────────────────

function TearSpectator({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Parchment background (always visible — the card back)
    const grad = ctx.createLinearGradient(0, 0, W * 0.7, H * 0.7);
    const colours = ["#e8d5b7", "#d9bc93", "#c8a57a", "#b08d61"];
    colours.forEach((c, i) => grad.addColorStop(i / (colours.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (progress > 0) {
      // Show a revealed "window" at the bottom proportional to progress
      const revealH = Math.round(H * progress);
      ctx.clearRect(0, H - revealH, W, revealH);

      // Fold-line shadow strip
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, H - revealH - 4, W, 8);
    }

    // Grain texture
    ctx.globalAlpha = 0.025;
    ctx.fillStyle = "#000";
    for (let y = 0; y < H; y += 5) {
      for (let x = 0; x < W; x += 7) {
        if (Math.sin(x * 0.31 + y * 0.77) > 0.6) ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }, [progress]);

  return (
    <div
      className="w-[200px] h-[280px] rounded-xl overflow-hidden relative shrink-0 shadow-md bg-surface-container-high"
      style={{ pointerEvents: "none" }}
    >
      <canvas ref={canvasRef} width={200} height={280} className="w-full h-full" />
      <ProgressLabel progress={progress} label="撕籤中" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRATCH — radial reveal coverage driven by progress
// ─────────────────────────────────────────────────────────────────────────────

function ScratchSpectator({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Scratch-off silver layer
    ctx.fillStyle = "#aaa";
    ctx.fillRect(0, 0, W, H);

    if (progress > 0) {
      // Simulated scratch circles distributed pseudo-randomly
      ctx.globalCompositeOperation = "destination-out";
      const count = Math.round(progress * 80);
      for (let i = 0; i < count; i++) {
        const px = (Math.sin(i * 2.4) * 0.5 + 0.5) * W;
        const py = (Math.cos(i * 1.7) * 0.5 + 0.5) * H;
        const r = 14 + Math.abs(Math.sin(i * 0.9)) * 12;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }, [progress]);

  return (
    <div
      className="w-[200px] h-[280px] rounded-xl overflow-hidden relative shrink-0 shadow-md bg-secondary-container/20"
      style={{ pointerEvents: "none" }}
    >
      {/* Prize placeholder beneath scratch layer */}
      <div className="absolute inset-0 flex items-center justify-center text-4xl">🎁</div>
      <canvas
        ref={canvasRef}
        width={200}
        height={280}
        className="absolute inset-0 w-full h-full"
      />
      <ProgressLabel progress={progress} label="刮刮中" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLIP — CSS transform rotation driven by progress
// ─────────────────────────────────────────────────────────────────────────────

function FlipSpectator({ progress }: { progress: number }) {
  // Flip from 0° → 180° as progress goes 0 → 1
  const rotation = progress * 180;
  const isBack = rotation >= 90;

  return (
    <div
      className="w-[200px] h-[280px] shrink-0 relative"
      style={{ perspective: "600px", pointerEvents: "none" }}
    >
      <div
        className="w-full h-full transition-transform duration-75"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotation}deg)`,
        }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-secondary-container to-secondary flex items-center justify-center text-on-surface text-5xl shadow-md"
          style={{ backfaceVisibility: "hidden" }}
        >
          🎫
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary text-5xl shadow-md"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          🏆
        </div>
      </div>

      {!isBack && <ProgressLabel progress={progress} label="翻牌中" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANT — pulsing spinner
// ─────────────────────────────────────────────────────────────────────────────

function InstantSpectator() {
  return (
    <div
      className="w-[200px] h-[280px] shrink-0 rounded-xl bg-gradient-to-br from-surface-container to-surface-container-high flex flex-col items-center justify-center gap-3 shadow-md"
      style={{ pointerEvents: "none" }}
    >
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-on-surface-variant">即時抽獎中</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared progress label
// ─────────────────────────────────────────────────────────────────────────────

function ProgressLabel({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{
          background: "rgba(0,0,0,0.55)",
          color: "#e5e7eb",
          backdropFilter: "blur(4px)",
        }}
      >
        {label} {pct}%
      </span>
    </div>
  );
}
