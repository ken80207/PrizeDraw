"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RouletteGameState = "IDLE" | "SPINNING" | "RESULT";

export interface RouletteProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: RouletteGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 340;
const CANVAS_H = 340;

const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;
const OUTER_R = 150;
const INNER_R = 48; // hub hole

// 8 segments cycling through 4 grades × 2 slots each, colours mixed
const SEGMENTS: { grade: string; color: string; textColor: string }[] = [
  { grade: "A賞", color: "#b45309", textColor: "#fde68a" },
  { grade: "C賞", color: "#065f46", textColor: "#a7f3d0" },
  { grade: "B賞", color: "#1d4ed8", textColor: "#bae6fd" },
  { grade: "D賞", color: "#581c87", textColor: "#ddd6fe" },
  { grade: "A賞", color: "#92400e", textColor: "#fde68a" },
  { grade: "B賞", color: "#1e40af", textColor: "#bae6fd" },
  { grade: "C賞", color: "#064e3b", textColor: "#a7f3d0" },
  { grade: "D賞", color: "#4c1d95", textColor: "#ddd6fe" },
];

const SEGMENT_COUNT = SEGMENTS.length;
const SEGMENT_ANGLE = (Math.PI * 2) / SEGMENT_COUNT;

// Pointer sits at top (−π/2)
const POINTER_ANGLE = -Math.PI / 2;

// Glow colours per grade
const GRADE_GLOW: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
};

// ─────────────────────────────────────────────────────────────────────────────
// Confetti
// ─────────────────────────────────────────────────────────────────────────────

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotSpeed: number;
  life: number;
}

function spawnConfetti(): Confetti[] {
  const colors = ["#f59e0b", "#3b82f6", "#10b981", "#a855f7", "#ec4899", "#fde68a"];
  return Array.from({ length: 60 }, () => ({
    x: CX + (Math.random() - 0.5) * 80,
    y: CY + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 5,
    vy: -Math.random() * 6 - 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 6 + 3,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.2,
    life: 1,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawWheel(
  ctx: CanvasRenderingContext2D,
  rotation: number,
  winSegment: number | null,
  glowAlpha: number,
) {
  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 20;

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const startAngle = rotation + i * SEGMENT_ANGLE;
    const endAngle = startAngle + SEGMENT_ANGLE;
    const seg = SEGMENTS[i];

    // Glow on winning segment
    if (winSegment !== null && i === winSegment && glowAlpha > 0) {
      ctx.shadowColor = GRADE_GLOW[seg.grade] ?? "#fff";
      ctx.shadowBlur = 40 * glowAlpha;
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
    }

    // Segment pie
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, OUTER_R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // Segment border
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // Grade labels
  ctx.save();
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const midAngle = rotation + i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const seg = SEGMENTS[i];
    const labelR = OUTER_R * 0.68;
    const lx = CX + Math.cos(midAngle) * labelR;
    const ly = CY + Math.sin(midAngle) * labelR;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = seg.textColor;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(seg.grade, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Outer rim
  ctx.beginPath();
  ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Rim gradient overlay
  const rimGrad = ctx.createRadialGradient(CX, CY, OUTER_R - 6, CX, CY, OUTER_R + 2);
  rimGrad.addColorStop(0, "rgba(255,255,255,0.1)");
  rimGrad.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.beginPath();
  ctx.arc(CX, CY, OUTER_R + 2, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // Centre hub
  const hubGrad = ctx.createRadialGradient(CX - 8, CY - 8, 2, CX, CY, INNER_R);
  hubGrad.addColorStop(0, "#6d28d9");
  hubGrad.addColorStop(1, "#1e1b4b");
  ctx.beginPath();
  ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hub icon
  ctx.fillStyle = "#a78bfa";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SPIN", CX, CY);
}

function drawPointer(ctx: CanvasRenderingContext2D) {
  const px = CX;
  const py = CY - OUTER_R - 2;
  ctx.save();
  ctx.translate(px, py);

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-12, -28);
  ctx.lineTo(12, -28);
  ctx.closePath();
  ctx.fillStyle = "#f43f5e";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pointer base dot
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Dark radial background
  const bg = ctx.createRadialGradient(CX, CY, 10, CX, CY, CANVAS_W * 0.75);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(1, "#0f0a1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Decorative dots
  ctx.fillStyle = "rgba(139,92,246,0.08)";
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = OUTER_R + 16;
    ctx.beginPath();
    ctx.arc(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function Roulette({
  resultGrade,
  prizeName = "獎品",
  onResult,
  onStateChange,
}: RouletteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Find all segments that match the result grade; pick the first one
  const winSegmentIndex = SEGMENTS.findIndex((s) => s.grade === resultGrade);
  const effectiveWinSegment = winSegmentIndex >= 0 ? winSegmentIndex : 0;

  // The winning segment should stop under the pointer (POINTER_ANGLE = −π/2).
  // Centre of segment i is at rotation + i * SEGMENT_ANGLE + SEGMENT_ANGLE/2 = POINTER_ANGLE
  // → rotation = POINTER_ANGLE − i * SEGMENT_ANGLE − SEGMENT_ANGLE/2
  const targetRotationBase =
    POINTER_ANGLE -
    effectiveWinSegment * SEGMENT_ANGLE -
    SEGMENT_ANGLE / 2;

  // Add extra full spins for drama
  const EXTRA_SPINS = 6;
  const targetRotation = targetRotationBase - Math.PI * 2 * EXTRA_SPINS;

  const rotationRef = useRef(0);
  const [gameState, setGameState] = useState<RouletteGameState>("IDLE");
  const [glowAlpha, setGlowAlpha] = useState(0);
  const confettiRef = useRef<Confetti[]>([]);
  const glowAnimRef = useRef<number>(0);
  const spinStartRef = useRef<number>(0);
  const spinStartRotRef = useRef<number>(0);
  const SPIN_DURATION_MS = 3200;

  const setState = useCallback(
    (s: RouletteGameState) => {
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Render loop
  const render = useCallback(
    (winSeg: number | null, glow: number, confetti: Confetti[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      drawBackground(ctx);
      drawWheel(ctx, rotationRef.current, winSeg, glow);
      drawPointer(ctx);

      // Confetti
      for (const p of confetti) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    },
    [],
  );

  // Idle animation
  useEffect(() => {
    if (gameState !== "IDLE") return;

    let frame = 0;
    const tick = () => {
      frame++;
      rotationRef.current = (frame * 0.003) % (Math.PI * 2);
      render(null, 0, []);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, render]);

  // Spin animation
  useEffect(() => {
    if (gameState !== "SPINNING") return;

    const startTime = spinStartRef.current;
    const startRot = spinStartRotRef.current;
    const totalDelta = targetRotation - startRot;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SPIN_DURATION_MS, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      rotationRef.current = startRot + totalDelta * eased;
      render(null, 0, []);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rotationRef.current = targetRotation;
        render(effectiveWinSegment, 0, []);
        setState("RESULT");
        onResult?.(resultGrade);
        confettiRef.current = spawnConfetti();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, targetRotation, effectiveWinSegment, resultGrade, onResult, render, setState]);

  // Result glow + confetti animation
  useEffect(() => {
    if (gameState !== "RESULT") return;

    let frame = 0;
    const tick = () => {
      frame++;
      const glow = 0.6 + 0.4 * Math.sin(frame * 0.08);

      // Update confetti
      for (const p of confettiRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.rotation += p.rotSpeed;
        p.life -= 0.012;
      }
      confettiRef.current = confettiRef.current.filter((p) => p.life > 0);

      render(effectiveWinSegment, glow, confettiRef.current);
      setGlowAlpha(glow);
      glowAnimRef.current = requestAnimationFrame(tick);
    };
    glowAnimRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(glowAnimRef.current);
  }, [gameState, effectiveWinSegment, render]);

  const handleSpin = useCallback(() => {
    if (gameState !== "IDLE") return;
    spinStartRef.current = performance.now();
    spinStartRotRef.current = rotationRef.current;
    setState("SPINNING");
  }, [gameState, setState]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 select-none">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-xl cursor-pointer"
        onClick={handleSpin}
        aria-label="轉盤抽獎 — 點擊旋轉"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSpin(); }}
      />

      {/* Result banner */}
      {gameState === "RESULT" && (
        <div
          className="px-6 py-2 rounded-full text-sm font-black animate-bounce"
          style={{
            background: GRADE_GLOW[resultGrade] ?? "#6366f1",
            color: "#fff",
            boxShadow: `0 0 20px ${GRADE_GLOW[resultGrade] ?? "#6366f1"}80`,
          }}
        >
          {resultGrade} — {prizeName}！
        </div>
      )}

      {/* Spin hint */}
      {gameState === "IDLE" && (
        <p className="text-xs text-gray-500 font-medium">點擊轉盤開始旋轉</p>
      )}
      {gameState === "SPINNING" && (
        <p className="text-xs text-purple-400 font-bold animate-pulse">旋轉中...</p>
      )}
    </div>
  );
}
