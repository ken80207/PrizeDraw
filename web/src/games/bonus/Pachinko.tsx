"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PachinkoGameState = "IDLE" | "FALLING" | "RESULT";

export interface PachinkoProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: PachinkoGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 300;
const CANVAS_H = 480;

const BALL_R = 7;
const PEG_R = 5;
const GRAVITY = 0.25;
const BOUNCE_DAMPEN = 0.55;

// Slot definitions — bottom of canvas
const SLOTS = [
  { grade: "A賞", color: "#b45309", textColor: "#fde68a" },
  { grade: "B賞", color: "#1d4ed8", textColor: "#bae6fd" },
  { grade: "C賞", color: "#065f46", textColor: "#a7f3d0" },
  { grade: "D賞", color: "#581c87", textColor: "#ddd6fe" },
];
const SLOT_W = CANVAS_W / SLOTS.length;
const SLOT_H = 56;
const SLOT_Y = CANVAS_H - SLOT_H;

// Grade → slot index
const GRADE_TO_SLOT: Record<string, number> = {
  "A賞": 0,
  "B賞": 1,
  "C賞": 2,
  "D賞": 3,
};

// Glow per grade
const GRADE_GLOW: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
};

// ─────────────────────────────────────────────────────────────────────────────
// Peg layout — triangular grid
// ─────────────────────────────────────────────────────────────────────────────

interface Peg {
  x: number;
  y: number;
}

function buildPegs(targetSlotIndex: number): Peg[] {
  const pegs: Peg[] = [];
  const rows = 8;
  const topY = 80;
  const rowSpacingY = (SLOT_Y - topY - 20) / rows;

  for (let row = 0; row < rows; row++) {
    const pegsInRow = row % 2 === 0 ? 5 : 4;
    const xOffset = row % 2 === 0 ? 0 : SLOT_W / 2;
    const spacing = (CANVAS_W - 40) / (pegsInRow - 1);

    for (let col = 0; col < pegsInRow; col++) {
      const x = 20 + col * spacing + xOffset;
      const y = topY + row * rowSpacingY;

      // Bias pegs near the bottom towards the target slot
      // by shrinking available x-range so ball naturally drifts there
      const biasStrength = row / rows; // 0 → 1 as we go down
      const targetCentreX = SLOT_W * targetSlotIndex + SLOT_W / 2;
      const biasedX = x + (targetCentreX - x) * biasStrength * 0.3;

      pegs.push({ x: biasedX, y });
    }
  }
  return pegs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Physics ball
// ─────────────────────────────────────────────────────────────────────────────

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Side walls
  ctx.fillStyle = "#312e81";
  ctx.fillRect(0, 0, 4, CANVAS_H);
  ctx.fillRect(CANVAS_W - 4, 0, 4, CANVAS_H);
}

function drawPegs(ctx: CanvasRenderingContext2D, pegs: Peg[]) {
  for (const peg of pegs) {
    // Glow
    ctx.shadowColor = "#818cf8";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2);
    const pegGrad = ctx.createRadialGradient(
      peg.x - 1, peg.y - 1, 0,
      peg.x, peg.y, PEG_R,
    );
    pegGrad.addColorStop(0, "#a5b4fc");
    pegGrad.addColorStop(1, "#4f46e5");
    ctx.fillStyle = pegGrad;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawSlots(
  ctx: CanvasRenderingContext2D,
  winSlotIndex: number | null,
  glowAlpha: number,
) {
  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const sx = i * SLOT_W;

    const isWin = winSlotIndex === i;

    ctx.save();
    if (isWin && glowAlpha > 0) {
      ctx.shadowColor = GRADE_GLOW[slot.grade] ?? "#fff";
      ctx.shadowBlur = 30 * glowAlpha;
    }

    ctx.fillStyle = isWin
      ? slot.color
      : `${slot.color}99`;
    ctx.fillRect(sx + 2, SLOT_Y, SLOT_W - 4, SLOT_H);

    // Slot dividers
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, SLOT_Y, SLOT_W - 4, SLOT_H);

    ctx.fillStyle = slot.textColor;
    ctx.font = `bold ${isWin ? 14 : 12}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slot.grade, sx + SLOT_W / 2, SLOT_Y + SLOT_H / 2);

    ctx.restore();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  // Trail
  for (let i = 0; i < ball.trail.length; i++) {
    const tp = ball.trail[i];
    const alpha = (i / ball.trail.length) * 0.4;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, BALL_R * (i / ball.trail.length), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251,191,36,${alpha})`;
    ctx.fill();
  }

  // Ball glow
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 14;

  const ballGrad = ctx.createRadialGradient(
    ball.x - 2, ball.y - 2, 1,
    ball.x, ball.y, BALL_R,
  );
  ballGrad.addColorStop(0, "#fde68a");
  ballGrad.addColorStop(1, "#d97706");
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawDropZone(ctx: CanvasRenderingContext2D) {
  // Top "entry" label
  ctx.fillStyle = "rgba(139,92,246,0.15)";
  ctx.fillRect(CANVAS_W / 2 - 20, 20, 40, 24);
  ctx.strokeStyle = "rgba(139,92,246,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(CANVAS_W / 2 - 20, 20, 40, 24);
  ctx.fillStyle = "#a78bfa";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DROP", CANVAS_W / 2, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Pachinko({
  resultGrade,
  prizeName = "獎品",
  onResult,
  onStateChange,
}: PachinkoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [gameState, setGameState] = useState<PachinkoGameState>("IDLE");
  const [winSlot, setWinSlot] = useState<number | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const pegsRef = useRef<Peg[]>([]);
  const glowFrameRef = useRef<number>(0);

  const setState = useCallback(
    (s: PachinkoGameState) => {
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Build pegs when result changes
  useEffect(() => {
    const slotIdx = GRADE_TO_SLOT[resultGrade] ?? 0;
    pegsRef.current = buildPegs(slotIdx);
  }, [resultGrade]);

  // Idle render
  useEffect(() => {
    if (gameState !== "IDLE") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      drawBackground(ctx);
      drawDropZone(ctx);
      drawPegs(ctx, pegsRef.current);
      drawSlots(ctx, null, 0);
    };
    draw();
  }, [gameState]);

  // Physics loop
  useEffect(() => {
    if (gameState !== "FALLING") return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const slotIdx = GRADE_TO_SLOT[resultGrade] ?? 0;
    const pegs = pegsRef.current;

    // Initial ball at top-centre with slight random horizontal nudge
    const ball: Ball = {
      x: CANVAS_W / 2 + (Math.random() - 0.5) * 10,
      y: 55,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0,
      trail: [],
    };
    ballRef.current = ball;

    const tick = () => {
      // Physics
      ball.vy += GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 12) ball.trail.shift();

      // Wall bounce
      if (ball.x - BALL_R < 4) {
        ball.x = 4 + BALL_R;
        ball.vx = Math.abs(ball.vx) * BOUNCE_DAMPEN;
      }
      if (ball.x + BALL_R > CANVAS_W - 4) {
        ball.x = CANVAS_W - 4 - BALL_R;
        ball.vx = -Math.abs(ball.vx) * BOUNCE_DAMPEN;
      }

      // Peg collisions
      for (const peg of pegs) {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = BALL_R + PEG_R;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          // Separate
          ball.x = peg.x + nx * minDist;
          ball.y = peg.y + ny * minDist;
          // Reflect velocity
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dot * nx) * BOUNCE_DAMPEN;
          ball.vy = (ball.vy - 2 * dot * ny) * BOUNCE_DAMPEN;
          // Tiny random nudge to keep things lively
          ball.vx += (Math.random() - 0.5) * 0.4;
        }
      }

      // Reached slot zone?
      if (ball.y + BALL_R >= SLOT_Y) {
        // Snap to the expected slot centre-x
        const expectedX = slotIdx * SLOT_W + SLOT_W / 2;
        const snapT = 0.08;
        ball.x += (expectedX - ball.x) * snapT;
      }

      // Landed in a slot?
      if (ball.y > SLOT_Y + SLOT_H / 2) {
        cancelAnimationFrame(rafRef.current);
        const landedSlot = Math.floor(ball.x / SLOT_W);
        const finalSlot = Math.max(0, Math.min(SLOTS.length - 1, landedSlot));

        setWinSlot(finalSlot);
        setState("RESULT");
        onResult?.(resultGrade);
        return;
      }

      // Draw
      drawBackground(ctx);
      drawDropZone(ctx);
      drawPegs(ctx, pegs);
      drawSlots(ctx, null, 0);
      drawBall(ctx, ball);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, resultGrade, onResult, setState]);

  // Result glow animation
  useEffect(() => {
    if (gameState !== "RESULT") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const tick = () => {
      frame++;
      const glow = 0.5 + 0.5 * Math.sin(frame * 0.08);
      drawBackground(ctx);
      drawDropZone(ctx);
      drawPegs(ctx, pegsRef.current);
      drawSlots(ctx, winSlot, glow);
      glowFrameRef.current = requestAnimationFrame(tick);
    };
    glowFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(glowFrameRef.current);
  }, [gameState, winSlot]);

  const handleDrop = useCallback(() => {
    if (gameState !== "IDLE") return;
    setState("FALLING");
  }, [gameState, setState]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 select-none">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-xl border border-indigo-900/50"
        aria-label="彈珠台抽獎"
        aria-live={gameState === "RESULT" ? "polite" : undefined}
      />

      {gameState === "IDLE" && (
        <button
          onClick={handleDrop}
          className="px-8 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/30"
        >
          投入彈珠
        </button>
      )}

      {gameState === "FALLING" && (
        <p className="text-xs text-indigo-400 font-bold animate-pulse">彈珠飛行中...</p>
      )}

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
    </div>
  );
}
