"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"];

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "A賞": { bg: "#78350f", border: "#f59e0b", text: "#fde68a", glow: "#f59e0b" },
  "B賞": { bg: "#1e3a5f", border: "#38bdf8", text: "#bae6fd", glow: "#38bdf8" },
  "C賞": { bg: "#064e3b", border: "#34d399", text: "#a7f3d0", glow: "#34d399" },
  "D賞": { bg: "#3b0764", border: "#a78bfa", text: "#ddd6fe", glow: "#a78bfa" },
};

// Symbol sequence used for the reel strip — 8 symbols tall
const REEL_SYMBOLS = ["A賞", "C賞", "B賞", "D賞", "A賞", "B賞", "C賞", "D賞"];

// Canvas dimensions
const CANVAS_W = 340;
const CANVAS_H = 480;

// Reel geometry
const REEL_COUNT = 3;
const REEL_W = 80;
const REEL_H = 340;
const REEL_GAP = 10;
const REEL_X_OFFSET = (CANVAS_W - REEL_COUNT * REEL_W - (REEL_COUNT - 1) * REEL_GAP) / 2;
const REEL_Y = 70;
const SYMBOL_H = REEL_H / 5; // 5 visible symbols
const SYMBOL_W = REEL_W;

// Full strip height for the 8-symbol loop
const STRIP_H = SYMBOL_H * REEL_SYMBOLS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  x: number,
  y: number,
  w: number,
  h: number,
  highlighted: boolean,
  alpha = 1,
) {
  const col = GRADE_COLORS[symbol] ?? GRADE_COLORS["D賞"];

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, highlighted ? col.border : col.bg);
  gradient.addColorStop(1, col.bg);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = highlighted ? col.border : `${col.border}55`;
  ctx.lineWidth = highlighted ? 2.5 : 1;
  ctx.stroke();

  // Glow on highlighted
  if (highlighted) {
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Text
  ctx.fillStyle = highlighted ? col.text : `${col.text}bb`;
  ctx.font = `bold ${highlighted ? 15 : 13}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x + w / 2, y + h / 2);

  ctx.restore();
}

function drawReel(
  ctx: CanvasRenderingContext2D,
  reelIndex: number,
  offset: number, // pixel offset within the strip (scrolls down)
  stopped: boolean,
  resultSymbol: string,
) {
  const rx = REEL_X_OFFSET + reelIndex * (REEL_W + REEL_GAP);
  const ry = REEL_Y;

  // Clip to reel area
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, REEL_W, REEL_H);
  ctx.clip();

  // Draw background
  ctx.fillStyle = "#111827";
  ctx.fillRect(rx, ry, REEL_W, REEL_H);

  // Which symbol index is at the center row?
  // Center row Y in reel local coords = SYMBOL_H * 2 (0-indexed: rows 0..4)
  const normalizedOffset = ((offset % STRIP_H) + STRIP_H) % STRIP_H;
  const startSymbolFloat = normalizedOffset / SYMBOL_H;
  const startSymbol = Math.floor(startSymbolFloat);
  const subOffset = (startSymbolFloat - startSymbol) * SYMBOL_H;

  // Draw symbols from startSymbol - 1 to startSymbol + 5 (extra for smooth scroll)
  for (let i = -1; i <= 6; i++) {
    const symIdx = ((startSymbol + i) % REEL_SYMBOLS.length + REEL_SYMBOLS.length) % REEL_SYMBOLS.length;
    const sym = REEL_SYMBOLS[symIdx] ?? "D賞";
    const symY = ry + i * SYMBOL_H - subOffset;
    const centerRow = 2; // middle row is row index 2
    const isCenter = i - 0 === centerRow && Math.abs(subOffset) < 2;

    // Fade symbols near edges
    const localY = symY - ry;
    const edge = SYMBOL_H * 0.5;
    let alpha = 1;
    if (localY < edge) alpha = Math.max(0.2, localY / edge);
    if (localY > REEL_H - edge) alpha = Math.max(0.2, (REEL_H - localY) / edge);

    drawSymbol(ctx, sym, rx, symY, SYMBOL_W, SYMBOL_H, isCenter && stopped, alpha);
  }

  // Win line overlay (flashing border on center row)
  if (stopped) {
    const centerY = ry + SYMBOL_H * 2;
    ctx.strokeStyle = "#f59e0b88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(rx + 2, centerY + 2, REEL_W - 4, SYMBOL_H - 4);
    ctx.stroke();
  }

  ctx.restore();

  // Vertical gradient overlays (fade top & bottom)
  const topGrad = ctx.createLinearGradient(rx, ry, rx, ry + SYMBOL_H);
  topGrad.addColorStop(0, "#111827ee");
  topGrad.addColorStop(1, "#11182700");
  ctx.fillStyle = topGrad;
  ctx.fillRect(rx, ry, REEL_W, SYMBOL_H);

  const botGrad = ctx.createLinearGradient(rx, ry + REEL_H - SYMBOL_H, rx, ry + REEL_H);
  botGrad.addColorStop(0, "#11182700");
  botGrad.addColorStop(1, "#111827ee");
  ctx.fillStyle = botGrad;
  ctx.fillRect(rx, ry + REEL_H - SYMBOL_H, REEL_W, SYMBOL_H);
}

// ─────────────────────────────────────────────────────────────────────────────
// Particles for A賞 win
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  maxLife: number;
  size: number;
  color: string;
}

function spawnParticles(count: number): Particle[] {
  const colors = ["#f59e0b", "#fde68a", "#fbbf24", "#fff7ed", "#fb923c"];
  return Array.from({ length: count }, () => ({
    x: CANVAS_W / 2 + (Math.random() - 0.5) * 120,
    y: CANVAS_H / 2 + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 6,
    vy: -Math.random() * 8 - 2,
    life: 1,
    maxLife: 0.6 + Math.random() * 0.6,
    size: 3 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)] ?? "#f59e0b",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine({ resultGrade, prizeName, onResult, onStateChange }: SlotMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  // Reel state (mutable refs for RAF loop)
  const reelOffsetsRef = useRef([0, 0, 0]);
  const reelSpeedsRef = useRef([0, 0, 0]);
  const reelStoppedRef = useRef([false, false, false]);
  const reelTargetOffsetRef = useRef([0, 0, 0]);

  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const flashRef = useRef(0); // win flash alpha

  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [spinCount, setSpinCount] = useState(0);

  const setGameStateSync = useCallback(
    (s: GameState) => {
      stateRef.current = s;
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Calculate the pixel offset that shows `resultGrade` in the center row (row 2)
  const calcTargetOffset = useCallback(
    (reelIndex: number) => {
      // We want REEL_SYMBOLS[idx] == resultGrade to be at center row
      // Center row = normalizedOffset / SYMBOL_H fractional part gives row 2
      // Find first occurrence of resultGrade in REEL_SYMBOLS
      const targetIdx = REEL_SYMBOLS.findIndex((s) => s === resultGrade);
      const safeIdx = targetIdx >= 0 ? targetIdx : 0;

      // The offset such that center row shows safeIdx:
      // normalizedOffset = safeIdx * SYMBOL_H (row 0 at top)
      // But center is row 2, so we need the strip to scroll such that
      // row 2 from the top shows safeIdx
      // offset = (safeIdx - 2 + REEL_SYMBOLS.length) % REEL_SYMBOLS.length * SYMBOL_H
      const centeredIdx = ((safeIdx - 2) % REEL_SYMBOLS.length + REEL_SYMBOLS.length) % REEL_SYMBOLS.length;

      // Add extra full rotations for the spinning effect: at least 3 full rotations
      // plus current position
      const currentOffset = reelOffsetsRef.current[reelIndex] ?? 0;
      const extraRotations = (3 + reelIndex) * STRIP_H;
      const normalizedCurrent = ((currentOffset % STRIP_H) + STRIP_H) % STRIP_H;
      const targetNorm = centeredIdx * SYMBOL_H;

      // How much more to spin to reach target
      let delta = targetNorm - normalizedCurrent;
      if (delta <= 0) delta += STRIP_H;

      return currentOffset + extraRotations + delta;
    },
    [resultGrade],
  );

  // Main render + update loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;
    const now = performance.now();

    // Update shake
    if (shakeRef.current.intensity > 0) {
      shakeRef.current.intensity *= 0.88;
      shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity;
      if (shakeRef.current.intensity < 0.3) {
        shakeRef.current = { x: 0, y: 0, intensity: 0 };
      }
    }

    ctx.save();
    ctx.translate(shakeRef.current.x, shakeRef.current.y);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Header
    const headerGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    headerGrad.addColorStop(0, "#7c3aed");
    headerGrad.addColorStop(0.5, "#db2777");
    headerGrad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, CANVAS_W, 55);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎰  PRIZE DRAW  🎰", CANVAS_W / 2, 27);

    // Machine body
    const bodyGrad = ctx.createLinearGradient(20, 60, 20, CANVAS_H - 60);
    bodyGrad.addColorStop(0, "#1e293b");
    bodyGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, 60, CANVAS_W - 40, CANVAS_H - 120, 16);
    ctx.fill();
    ctx.stroke();

    // Update reels
    const speeds = reelSpeedsRef.current;
    const offsets = reelOffsetsRef.current;
    const targets = reelTargetOffsetRef.current;
    const stopped = reelStoppedRef.current;

    if (state === "SPINNING") {
      for (let i = 0; i < REEL_COUNT; i++) {
        offsets[i] = (offsets[i] ?? 0) + (speeds[i] ?? 0);
        if ((speeds[i] ?? 0) < 18) speeds[i] = (speeds[i] ?? 0) + 1.5;
      }
    } else if (state === "STOPPING") {
      let allStopped = true;
      for (let i = 0; i < REEL_COUNT; i++) {
        if (stopped[i]) continue;
        allStopped = false;
        const target = targets[i] ?? 0;
        const current = offsets[i] ?? 0;
        const diff = target - current;

        if (diff <= 0.5) {
          offsets[i] = target;
          stopped[i] = true;
          // Trigger shake on last reel stop
          if (i === REEL_COUNT - 1) {
            shakeRef.current.intensity = resultGrade === "A賞" ? 15 : 5;
            flashRef.current = resultGrade === "A賞" ? 1 : 0;
            if (resultGrade === "A賞") {
              particlesRef.current = spawnParticles(80);
            }
          }
        } else {
          // Ease out: slow down as approaching target
          const easeSpeed = Math.max(2, diff * 0.12);
          offsets[i] = current + easeSpeed;
        }
      }

      if (allStopped && stateRef.current === "STOPPING") {
        setGameStateSync("RESULT");
        onResult?.(resultGrade);
      }
    }

    // Draw reels
    for (let i = 0; i < REEL_COUNT; i++) {
      drawReel(ctx, i, offsets[i] ?? 0, stopped[i] ?? false, resultGrade);
    }

    // Win line highlight bar
    const winY = REEL_Y + SYMBOL_H * 2;
    const lineX = REEL_X_OFFSET - 8;
    const lineW = REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 16;
    ctx.strokeStyle = "#f59e0b44";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(lineX, winY);
    ctx.lineTo(lineX + lineW, winY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lineX, winY + SYMBOL_H);
    ctx.lineTo(lineX + lineW, winY + SYMBOL_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flash effect for A賞
    if (flashRef.current > 0) {
      flashRef.current -= 0.02;
      ctx.fillStyle = `rgba(251, 191, 36, ${flashRef.current * 0.25})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.life -= 0.016 / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Result banner
    if (state === "RESULT") {
      const col = GRADE_COLORS[resultGrade] ?? GRADE_COLORS["D賞"];
      const bannerY = REEL_Y + REEL_H + 12;

      const grad = ctx.createLinearGradient(40, bannerY, CANVAS_W - 40, bannerY);
      grad.addColorStop(0, col.bg);
      grad.addColorStop(0.5, `${col.border}44`);
      grad.addColorStop(1, col.bg);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(40, bannerY, CANVAS_W - 80, 42, 10);
      ctx.fill();
      ctx.strokeStyle = col.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = col.text;
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        resultGrade === "A賞" ? `✨ ${resultGrade} — ${prizeName ?? "大獎"} ✨` : `${resultGrade}  ${prizeName ?? ""}`,
        CANVAS_W / 2,
        bannerY + 21,
      );
    }

    ctx.restore();
    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName, onResult, setGameStateSync]);

  // Start loop on mount
  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const handlePull = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;

    // Reset
    reelOffsetsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [0, 0, 0];
    reelStoppedRef.current = [false, false, false];
    particlesRef.current = [];
    flashRef.current = 0;
    shakeRef.current = { x: 0, y: 0, intensity: 0 };

    setGameStateSync("SPINNING");
    setSpinCount((c) => c + 1);

    // After 1.2s, start stopping reels one by one
    setTimeout(() => {
      // Calculate targets
      reelTargetOffsetRef.current = [0, 1, 2].map((i) => calcTargetOffset(i));

      setGameStateSync("STOPPING");

      // Stagger the stop: each reel gets its target locked in sequence
      // The loop handles easing, so we just need to mark which reels
      // should start easing at different times
      // We do this by initially setting targets very far so they keep spinning
      // then at intervals updating them to real targets
      const realTargets = reelTargetOffsetRef.current.slice();

      // Set reel 0 to decelerate now (real target already set)
      // Reels 1 and 2: give them extra distance first
      reelTargetOffsetRef.current[1] = (reelOffsetsRef.current[1] ?? 0) + STRIP_H * 2;
      reelTargetOffsetRef.current[2] = (reelOffsetsRef.current[2] ?? 0) + STRIP_H * 3;

      setTimeout(() => {
        reelTargetOffsetRef.current[1] = realTargets[1] ?? 0;
      }, 900);

      setTimeout(() => {
        reelTargetOffsetRef.current[2] = realTargets[2] ?? 0;
      }, 1800);
    }, 1200);
  }, [calcTargetOffset, setGameStateSync]);

  const handleReset = useCallback(() => {
    reelOffsetsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [0, 0, 0];
    reelStoppedRef.current = [false, false, false];
    reelTargetOffsetRef.current = [0, 0, 0];
    particlesRef.current = [];
    flashRef.current = 0;
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    setGameStateSync("IDLE");
  }, [setGameStateSync]);

  const isInteractable = gameState === "IDLE" || gameState === "RESULT";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-gray-700 shadow-2xl block"
        style={{ background: "#0f172a" }}
      />

      {/* Controls below canvas */}
      <div className="flex gap-3">
        <button
          onClick={handlePull}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-red-500/30 cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          <span className="text-base">🔴</span>
          拉桿 PULL
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          重置
        </button>
      </div>

      {/* Status */}
      <div className="text-xs text-gray-500 font-mono">
        狀態:{" "}
        <span
          className={
            gameState === "RESULT"
              ? "text-amber-400"
              : gameState === "SPINNING"
                ? "text-emerald-400"
                : "text-gray-400"
          }
        >
          {gameState}
        </span>
        {spinCount > 0 && <span className="ml-3 text-gray-600">第 {spinCount} 次</span>}
      </div>
    </div>
  );
}
