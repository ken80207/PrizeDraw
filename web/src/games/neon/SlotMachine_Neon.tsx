"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NeonSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineNeonProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: NeonSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 420;

// ─────────────────────────────────────────────────────────────────────────────
// Neon color palette
// ─────────────────────────────────────────────────────────────────────────────

const NEO = {
  bg:        "#0a0a1a",
  bgMid:     "#0d0d22",
  pink:      "#ff00ff",
  cyan:      "#00ffff",
  green:     "#00ff66",
  yellow:    "#ffff00",
  orange:    "#ff6600",
  white:     "#ffffff",
  dimPink:   "#660066",
  dimCyan:   "#006666",
  dimGreen:  "#006633",
  gridLine:  "rgba(0,255,255,0.06)",
  // Per-grade neon
  gradeA:    "#ffd700",   // gold glow
  gradeB:    "#00ffff",   // cyan glow
  gradeC:    "#00ff66",   // green glow
  gradeD:    "#ff00ff",   // magenta glow
};

// Grade → neon color
const GRADE_COLOR: Record<string, string> = {
  "A賞": NEO.gradeA,
  "B賞": NEO.gradeB,
  "C賞": NEO.gradeC,
  "D賞": NEO.gradeD,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 56;
const REEL_VISIBLE = 3;

// Neon symbol shapes as SVG-like vector paths (drawn with strokes)
// Each shape: array of [x, y] normalized 0-1 paths (moveTo, lineTo sequences)
// We'll draw them as stroked polygons centered in the cell

type NeonShape = { type: "polygon"; pts: [number, number][] } | { type: "lines"; segs: [number, number, number, number][] };

const GRADE_SHAPES: Record<Grade, NeonShape> = {
  "A賞": {
    type: "polygon",
    pts: [[0.5, 0.1], [0.62, 0.38], [0.93, 0.38], [0.7, 0.57], [0.79, 0.85], [0.5, 0.68], [0.21, 0.85], [0.3, 0.57], [0.07, 0.38], [0.38, 0.38]],
  },
  "B賞": {
    type: "polygon",
    pts: [[0.5, 0.08], [0.6, 0.35], [0.9, 0.35], [0.68, 0.54], [0.76, 0.82], [0.5, 0.65], [0.24, 0.82], [0.32, 0.54], [0.1, 0.35], [0.4, 0.35]],
  },
  "C賞": {
    type: "polygon",
    pts: [[0.5, 0.08], [0.92, 0.5], [0.5, 0.92], [0.08, 0.5]],
  },
  "D賞": {
    type: "lines",
    segs: [
      [0.5, 0.1, 0.5, 0.9],
      [0.1, 0.5, 0.9, 0.5],
      [0.22, 0.22, 0.78, 0.78],
      [0.78, 0.22, 0.22, 0.78],
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Neon draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function setNeonStroke(ctx: CanvasRenderingContext2D, color: string, blur: number, width = 2) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function neonRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur = 15, lw = 2) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.strokeRect(x, y, w, h);
  // Inner glow pass
  ctx.shadowBlur = blur * 0.3;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function neonLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, blur = 12, lw = 2) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontSize: number, blur = 18, align: CanvasTextAlign = "center") {
  ctx.save();
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  // Second pass for extra glow
  ctx.shadowBlur = blur * 0.4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawNeonShape(ctx: CanvasRenderingContext2D, shape: NeonShape, cx: number, cy: number, size: number, color: string, blur: number) {
  ctx.save();
  setNeonStroke(ctx, color, blur, 2);
  ctx.lineJoin = "round";

  if (shape.type === "polygon") {
    ctx.beginPath();
    const pts = shape.pts;
    ctx.moveTo(cx + (pts[0]![0] - 0.5) * size, cy + (pts[0]![1] - 0.5) * size);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(cx + (pts[i]![0] - 0.5) * size, cy + (pts[i]![1] - 0.5) * size);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    for (const [x1r, y1r, x2r, y2r] of shape.segs) {
      ctx.beginPath();
      ctx.moveTo(cx + (x1r - 0.5) * size, cy + (y1r - 0.5) * size);
      ctx.lineTo(cx + (x2r - 0.5) * size, cy + (y2r - 0.5) * size);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Draw Tron-style background grid
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = NEO.gridLine;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  const GRID = 24;
  for (let x = 0; x <= W; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

// Scanline overlay
function drawScanlines(ctx: CanvasRenderingContext2D, scanOffset: number) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#000";
  for (let y = (scanOffset % 3); y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Neon({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineNeonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<NeonSlotGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<NeonSlotGameState>("IDLE");

  // Reel state
  const reelOffsets = useRef<number[]>([0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0]);
  const reelLocked = useRef<boolean[]>([false, false, false]);

  // Animation state
  const leverAngle = useRef(0);
  const flashAlpha = useRef(0);
  const flashColor = useRef(NEO.pink);
  const scanOffset = useRef(0);
  const pulseT = useRef(0);
  const lastTime = useRef(0);

  // Neon particles (glow rings on win)
  const particles = useRef<{ x: number; y: number; r: number; maxR: number; alpha: number; color: string }[]>([]);
  // Floating neon dots
  const floatDots = useRef<{ x: number; y: number; vy: number; vx: number; color: string; alpha: number; size: number }[]>([]);

  // Frame lights pulse tracker
  const lightPhase = useRef<number[]>([]);

  // Initialize floating dots
  useEffect(() => {
    const colors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow, NEO.orange];
    floatDots.current = Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.4,
      color: colors[i % colors.length]!,
      alpha: 0.3 + Math.random() * 0.5,
      size: 1 + Math.random() * 2,
    }));
    lightPhase.current = Array.from({ length: 14 }, (_, i) => i * 0.4);
  }, []);

  const changeState = useCallback((s: NeonSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw frame ─────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    pulseT.current += dt * 0.003;
    scanOffset.current += dt * 0.05;

    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = NEO.bg;
    ctx.fillRect(0, 0, W, H);

    drawGrid(ctx);

    // ── Floating neon dots ────────────────────────────────────────────────────
    for (const dot of floatDots.current) {
      dot.x += dot.vx * dt / 16;
      dot.y += dot.vy * dt / 16;
      if (dot.y < -4) { dot.y = H + 4; dot.x = Math.random() * W; }
      if (dot.x < -4) dot.x = W + 4;
      if (dot.x > W + 4) dot.x = -4;
      ctx.save();
      ctx.globalAlpha = dot.alpha * (0.6 + 0.4 * Math.sin(pulseT.current * 2 + dot.x));
      ctx.fillStyle = dot.color;
      ctx.shadowColor = dot.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Machine body ──────────────────────────────────────────────────────────
    const mX = 18, mY = 12, mW = 244, mH = H - 24;

    // Machine dark fill
    ctx.fillStyle = NEO.bgMid;
    ctx.fillRect(mX, mY, mW, mH);

    // Outer neon frame (magenta)
    const frameGlow = 12 + 6 * Math.sin(pulseT.current);
    neonRect(ctx, mX, mY, mW, mH, NEO.pink, frameGlow, 2);

    // Inner frame accent (cyan, thinner)
    neonRect(ctx, mX + 4, mY + 4, mW - 8, mH - 8, NEO.cyan, 6, 1);

    // ── Frame lights (pulsing neon dots along top/bottom) ────────────────────
    const dotColors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow, NEO.orange, NEO.pink, NEO.cyan];
    const dotSpacing = mW / 14;
    for (let i = 0; i < 14; i++) {
      const lx = mX + (i + 0.5) * dotSpacing;
      const phase = (lightPhase.current[i] ?? 0) + pulseT.current;
      const brightness = 0.5 + 0.5 * Math.sin(phase * 2);
      const col = dotColors[i % dotColors.length]!;

      ctx.save();
      ctx.globalAlpha = brightness;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10 * brightness;
      ctx.beginPath();
      ctx.arc(lx, mY + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, mY + mH - 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Header: "PRIZE DRAW" neon sign ───────────────────────────────────────
    const headerY = mY + 24;
    // Header bar fill
    ctx.fillStyle = "rgba(255,0,255,0.05)";
    ctx.fillRect(mX + 8, headerY - 12, mW - 16, 22);
    neonRect(ctx, mX + 8, headerY - 12, mW - 16, 22, NEO.pink, 8, 1);
    neonText(ctx, "PRIZE", mX + mW * 0.32, headerY, NEO.pink, 14, 20);
    neonText(ctx, "DRAW", mX + mW * 0.68, headerY, NEO.cyan, 14, 20);

    // ── 一番賞 kanji sign ────────────────────────────────────────────────────
    const signY = headerY + 22;
    neonText(ctx, "一番賞", mX + mW / 2, signY, NEO.yellow, 11, 14);

    // ── Reel window ──────────────────────────────────────────────────────────
    const reelAreaX = mX + 10;
    const reelAreaY = signY + 16;
    const reelAreaW = mW - 20;
    const reelAreaH = REEL_VISIBLE * CELL_H + 4;

    // Dark reel bg
    ctx.fillStyle = NEO.bg;
    ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);

    // Reel border (cyan)
    neonRect(ctx, reelAreaX, reelAreaY, reelAreaW, reelAreaH, NEO.cyan, 14, 2);

    // Win-line highlight (middle row)
    const winRowY = reelAreaY + CELL_H + 2;
    const winLinePulse = 0.6 + 0.4 * Math.sin(pulseT.current * 3);
    ctx.save();
    ctx.globalAlpha = winLinePulse;
    neonLine(ctx, reelAreaX + 2, winRowY, reelAreaX + reelAreaW - 2, winRowY, NEO.pink, 12, 2);
    neonLine(ctx, reelAreaX + 2, winRowY + CELL_H - 1, reelAreaX + reelAreaW - 2, winRowY + CELL_H - 1, NEO.pink, 12, 2);
    ctx.restore();

    // Win-line arrows
    const arrowMidY = winRowY + CELL_H / 2;
    ctx.save();
    ctx.strokeStyle = NEO.yellow;
    ctx.shadowColor = NEO.yellow;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(reelAreaX - 12, arrowMidY);
    ctx.lineTo(reelAreaX - 4, arrowMidY - 5);
    ctx.lineTo(reelAreaX - 4, arrowMidY + 5);
    ctx.closePath();
    ctx.stroke();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(reelAreaX + reelAreaW + 12, arrowMidY);
    ctx.lineTo(reelAreaX + reelAreaW + 4, arrowMidY - 5);
    ctx.lineTo(reelAreaX + reelAreaW + 4, arrowMidY + 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // ── Draw each reel ────────────────────────────────────────────────────────
    const singleReelW = Math.floor(reelAreaW / REEL_COUNT);
    for (let r = 0; r < REEL_COUNT; r++) {
      const rx = reelAreaX + r * singleReelW;
      const offset = reelOffsets.current[r] ?? 0;

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.clip();

      const startIdx = Math.floor(offset / CELL_H);
      const frac = offset % CELL_H;

      for (let v = -1; v <= REEL_VISIBLE + 1; v++) {
        const symbolIdx = ((startIdx + v) % SYMBOL_STRIP.length + SYMBOL_STRIP.length) % SYMBOL_STRIP.length;
        const grade = SYMBOL_STRIP[symbolIdx] as Grade;
        const cellY = reelAreaY + v * CELL_H - frac + 2;

        const col = GRADE_COLOR[grade] ?? NEO.pink;
        const cx = rx + singleReelW / 2;
        const cy = cellY + CELL_H / 2;

        // Cell separator
        ctx.save();
        ctx.strokeStyle = "rgba(0,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, cellY + CELL_H - 1);
        ctx.lineTo(rx + singleReelW, cellY + CELL_H - 1);
        ctx.stroke();
        ctx.restore();

        // Neon shape
        const shape = GRADE_SHAPES[grade]!;
        const isCenter = v === 1 && reelLocked.current[r];
        const shapeBlur = isCenter ? 22 : 12;
        const shapeSize = CELL_H * 0.62;
        drawNeonShape(ctx, shape, cx, cy - 8, shapeSize, col, shapeBlur);

        // Grade label
        neonText(ctx, grade[0] ?? "", cx, cy + CELL_H * 0.28, col, 11, isCenter ? 18 : 10);
      }

      // Reel divider
      if (r < REEL_COUNT - 1) {
        ctx.restore();
        neonLine(ctx, rx + singleReelW, reelAreaY + 2, rx + singleReelW, reelAreaY + reelAreaH - 2, NEO.cyan, 6, 1);
      } else {
        ctx.restore();
      }
    }

    // ── Lever ─────────────────────────────────────────────────────────────────
    const levX = mX + mW + 16;
    const levBaseY = reelAreaY + reelAreaH / 2 + 10;
    const leverPull = leverAngle.current;
    const levTopY = levBaseY - 52 + leverPull * 40;
    const levCol = NEO.orange;

    // Rod
    ctx.save();
    ctx.strokeStyle = levCol;
    ctx.shadowColor = levCol;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(levX + 5, levTopY + 14);
    ctx.lineTo(levX + 5, levBaseY);
    ctx.stroke();
    ctx.restore();

    // Base socket
    neonRect(ctx, levX - 2, levBaseY, 14, 8, levCol, 8, 2);

    // Knob (circle)
    ctx.save();
    ctx.fillStyle = levCol;
    ctx.shadowColor = levCol;
    ctx.shadowBlur = 20 + 8 * Math.sin(pulseT.current * 2);
    ctx.beginPath();
    ctx.arc(levX + 5, levTopY + 7, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = NEO.white;
    ctx.shadowColor = NEO.white;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner bright spot
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(levX + 3, levTopY + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Grade/Target display ──────────────────────────────────────────────────
    const infoY = reelAreaY + reelAreaH + 12;
    const targetGrade = resultGrade as Grade;
    const targetCol = GRADE_COLOR[targetGrade] ?? NEO.pink;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(mX + 8, infoY, mW - 16, 22);
    neonRect(ctx, mX + 8, infoY, mW - 16, 22, targetCol, 8, 1);
    neonText(ctx, `TARGET: ${targetGrade}`, mX + mW / 2, infoY + 11, targetCol, 10, 14);

    // ── PULL / RESET button ───────────────────────────────────────────────────
    const btnY = infoY + 32;
    const btnX = mX + 8;
    const btnW = mW - 16;
    const btnH = 30;
    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canAct = isIdle || isResult;
    const btnLabel = isResult ? "RESET" : "PULL!";
    const btnCol = isResult ? NEO.cyan : (canAct ? NEO.green : NEO.dimGreen);
    const btnPulse = canAct ? (0.7 + 0.3 * Math.sin(pulseT.current * 4)) : 0.4;

    ctx.fillStyle = `rgba(0,0,0,0.7)`;
    ctx.fillRect(btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.globalAlpha = btnPulse;
    neonRect(ctx, btnX, btnY, btnW, btnH, btnCol, canAct ? 18 : 6, 2);
    ctx.restore();

    neonText(ctx, btnLabel, mX + mW / 2, btnY + btnH / 2, canAct ? btnCol : NEO.dimGreen, 13, canAct ? 16 : 6);

    // ── JACKPOT text (result state) ───────────────────────────────────────────
    if (stateRef.current === "RESULT") {
      const jt = pulseT.current * 2;
      // Color cycle through neon palette
      const jackpotColors = [NEO.pink, NEO.cyan, NEO.yellow, NEO.green];
      const jCol = jackpotColors[Math.floor(jt / 0.8) % jackpotColors.length]!;
      const jackY = btnY + btnH + 26;
      neonText(ctx, "JACKPOT!", mX + mW / 2, jackY, jCol, 20, 30);
      neonText(ctx, prizeName, mX + mW / 2, jackY + 26, NEO.white, 10, 12);
    }

    // ── Win ring particles ────────────────────────────────────────────────────
    for (const p of particles.current) {
      p.r += dt * 0.12;
      p.alpha -= dt * 0.006;
      if (p.alpha > 0 && p.r < p.maxR) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    particles.current = particles.current.filter((p) => p.alpha > 0 && p.r < p.maxR);

    // ── Screen flash ─────────────────────────────────────────────────────────
    if (flashAlpha.current > 0) {
      ctx.fillStyle = flashColor.current.replace(")", `,${flashAlpha.current})`).replace("rgb", "rgba");
      // Use a simple rgba fill approach
      ctx.save();
      ctx.globalAlpha = flashAlpha.current;
      ctx.fillStyle = flashColor.current;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      flashAlpha.current = Math.max(0, flashAlpha.current - dt / 120);
    }

    // ── State label ──────────────────────────────────────────────────────────
    const stateLabels: Record<NeonSlotGameState, string> = {
      IDLE: "IDLE", SPINNING: "SPIN", STOPPING: "STOP", RESULT: "WIN!",
    };
    const stateCol =
      stateRef.current === "RESULT" ? NEO.yellow :
      stateRef.current === "SPINNING" ? NEO.green :
      NEO.dimCyan;
    neonText(ctx, stateLabels[stateRef.current], mX + mW - 22, mY + mH - 14, stateCol, 9, 10);

    // ── Scanlines (last, on top of everything) ────────────────────────────────
    drawScanlines(ctx, scanOffset.current);

    clearGlow(ctx);
  }, [resultGrade, prizeName]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;

    const state = stateRef.current;

    if (state === "SPINNING" || state === "STOPPING") {
      for (let r = 0; r < REEL_COUNT; r++) {
        if (reelLocked.current[r]) continue;
        reelOffsets.current[r] = (reelOffsets.current[r]! + (reelSpeeds.current[r] ?? 0) * dt / 16) % (SYMBOL_STRIP.length * CELL_H);
      }

      if (state === "STOPPING" && reelLocked.current.every((l) => l)) {
        changeState("RESULT");
        flashAlpha.current = 0.6;
        flashColor.current = GRADE_COLOR[resultGrade as Grade] ?? NEO.pink;

        // Spawn expanding ring particles
        const cx = W / 2, cy = H * 0.4;
        const ringColors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow];
        for (let i = 0; i < 5; i++) {
          particles.current.push({
            x: cx + (Math.random() - 0.5) * 60,
            y: cy + (Math.random() - 0.5) * 40,
            r: 4 + i * 6,
            maxR: 80 + i * 20,
            alpha: 0.9 - i * 0.1,
            color: ringColors[i % ringColors.length]!,
          });
        }
        onResult?.(resultGrade);
      }

      if (leverAngle.current > 0) {
        leverAngle.current = Math.max(0, leverAngle.current - dt / 400);
      }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, onResult, resultGrade]);

  // ── Start/stop loop ────────────────────────────────────────────────────────
  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── startSpin ─────────────────────────────────────────────────────────────
  const startSpin = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [5.0, 4.5, 4.0];
    reelLocked.current = [false, false, false];
    leverAngle.current = 1;
    changeState("SPINNING");

    const targetGrade = resultGrade as Grade;
    const targetIdx = SYMBOL_STRIP.findLastIndex((g) => g === targetGrade);

    [0, 1, 2].forEach((r) => {
      setTimeout(() => {
        reelSpeeds.current[r] = 1;
        setTimeout(() => {
          const targetOffset = targetIdx * CELL_H + CELL_H;
          reelOffsets.current[r] = ((targetOffset % (SYMBOL_STRIP.length * CELL_H)) + SYMBOL_STRIP.length * CELL_H) % (SYMBOL_STRIP.length * CELL_H);
          reelSpeeds.current[r] = 0;
          reelLocked.current[r] = true;
          if (r === REEL_COUNT - 1) {
            changeState("STOPPING");
          }
        }, 300);
      }, 600 + r * 500);
    });
  }, [resultGrade, changeState]);

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [0, 0, 0];
    reelLocked.current = [false, false, false];
    leverAngle.current = 0;
    flashAlpha.current = 0;
    particles.current = [];
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    const mX = 18, mY = 12, mW = 244;
    const signY = mY + 24 + 22;
    const reelAreaY = signY + 16;
    const reelAreaH = REEL_VISIBLE * CELL_H + 4;
    const infoY = reelAreaY + reelAreaH + 12;
    const btnY = infoY + 32;
    const btnX = mX + 8;
    const btnW = mW - 16;
    const btnH = 30;

    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;
    const levX = mX + mW + 16;
    const onLever = nx >= levX - 4 && nx <= levX + 20 && ny >= 40 && ny <= 200;

    const state = stateRef.current;
    if ((onBtn || onLever) && state === "RESULT") {
      reset();
    } else if ((onBtn || onLever) && state === "IDLE") {
      startSpin();
    }
  }, [reset, startSpin]);

  // Expose gameState to parent via state (unused in render but triggers re-render for status)
  void gameState;

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: NEO.bg, padding: 8 }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleClick}
        style={{
          width: "100%",
          maxWidth: W,
          cursor: "pointer",
          display: "block",
        }}
      />
    </div>
  );
}
