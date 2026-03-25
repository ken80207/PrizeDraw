"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SketchSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineSketchProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: SketchSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Sketch color palette
// ─────────────────────────────────────────────────────────────────────────────

const SK = {
  paper:       "#faf8f0",
  pencil:      "#333333",
  pencilLight: "#555555",
  pencilFaint: "#888888",
  notebookLine:"rgba(100,140,220,0.25)",
  marginLine:  "rgba(200,60,60,0.35)",
  redPen:      "#cc3333",
  bluePen:     "#3355cc",
  yellowHL:    "rgba(255,255,0,0.30)",
  gradeA:      "#b8860b",  // dark goldenrod — pencil-like gold
  gradeB:      "#1a3a8c",  // dark blue pen
  gradeC:      "#1a6b3a",  // dark green
  gradeD:      "#6b1a8c",  // dark purple
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": SK.gradeA,
  "B賞": SK.gradeB,
  "C賞": SK.gradeC,
  "D賞": SK.gradeD,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 70;
const REEL_VISIBLE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic wobble helper — sin-based, no Math.random per frame
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a deterministic wobble offset for a given vertex index and frame counter */
function wobbleOffset(frameCount: number, vertexIndex: number, amount = 2): number {
  return Math.sin(frameCount * 0.08 + vertexIndex * 1.7) * amount;
}

/** Draws a wobbly line from (x1,y1) to (x2,y2) using deterministic sin-based offsets */
function wobblyLineTo(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  frameCount: number,
  vertexBase: number,
  wobble = 2,
): void {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(Math.ceil(dist / 10), 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wx = wobbleOffset(frameCount, vertexBase + i * 2, wobble);
    const wy = wobbleOffset(frameCount, vertexBase + i * 2 + 1, wobble);
    ctx.lineTo(x1 + (x2 - x1) * t + wx, y1 + (y2 - y1) * t + wy);
  }
}

/** Draws a wobbly closed rectangle outline */
function wobblyRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  frameCount: number,
  vertexBase: number,
  wobble = 2,
): void {
  ctx.beginPath();
  ctx.moveTo(x + wobbleOffset(frameCount, vertexBase, wobble), y + wobbleOffset(frameCount, vertexBase + 1, wobble));
  wobblyLineTo(ctx, x, y, x + w, y, frameCount, vertexBase + 10, wobble);
  wobblyLineTo(ctx, x + w, y, x + w, y + h, frameCount, vertexBase + 30, wobble);
  wobblyLineTo(ctx, x + w, y + h, x, y + h, frameCount, vertexBase + 50, wobble);
  wobblyLineTo(ctx, x, y + h, x, y, frameCount, vertexBase + 70, wobble);
  ctx.closePath();
}

/** Draws cross-hatching in a rectangular area for shadow effect.
 *  Static per frame since density/angle don't change with frameCount. */
function crossHatch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  density = 7,
  alpha = 0.12,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = SK.pencil;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += density) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
  }
  ctx.stroke();
  // Second direction
  ctx.beginPath();
  for (let i = -h; i < w + h; i += density * 1.4) {
    ctx.moveTo(x + i + h, y);
    ctx.lineTo(x + i, y + h);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw a hand-drawn star using wobbly lines */
function drawWobblySketchStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  frameCount: number,
  vBase: number,
  color: string,
): void {
  const points = 5;
  const innerR = r * 0.4;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : innerR;
    const wx = wobbleOffset(frameCount, vBase + i * 3, 2);
    const wy = wobbleOffset(frameCount, vBase + i * 3 + 1, 2);
    const px = cx + Math.cos(angle) * radius + wx;
    const py = cy + Math.sin(angle) * radius + wy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Draw a wobbly circle */
function wobblyCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  frameCount: number,
  vBase: number,
  wobble = 1.5,
): void {
  const steps = 24;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wx = wobbleOffset(frameCount, vBase + i * 2, wobble);
    const wy = wobbleOffset(frameCount, vBase + i * 2 + 1, wobble);
    const px = cx + Math.cos(angle) * r + wx;
    const py = cy + Math.sin(angle) * r + wy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Draw grade icon in hand-drawn style */
function drawGradeIcon(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
  frameCount: number,
  vBase: number,
): void {
  const color = GRADE_COLOR[grade] ?? SK.pencil;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;

  if (grade === "A賞") {
    // Hand-drawn crown: three bumps on top, rectangular base
    const hw = size * 0.45;
    const bh = size * 0.28;
    // Base
    ctx.beginPath();
    ctx.moveTo(cx - hw + wobbleOffset(frameCount, vBase, 1.5), cy + bh * 0.5 + wobbleOffset(frameCount, vBase + 1, 1.5));
    wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx + hw, cy + bh * 0.5, frameCount, vBase + 10, 1.5);
    wobblyLineTo(ctx, cx + hw, cy + bh * 0.5, cx + hw, cy + bh * 1.8, frameCount, vBase + 20, 1.5);
    wobblyLineTo(ctx, cx + hw, cy + bh * 1.8, cx - hw, cy + bh * 1.8, frameCount, vBase + 30, 1.5);
    wobblyLineTo(ctx, cx - hw, cy + bh * 1.8, cx - hw, cy + bh * 0.5, frameCount, vBase + 40, 1.5);
    ctx.stroke();
    // Three crown spikes
    const spikeY = cy - size * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - hw + wobbleOffset(frameCount, vBase + 50, 1.2), cy + bh * 0.5 + wobbleOffset(frameCount, vBase + 51, 1.2));
    wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx - hw * 0.5, spikeY, frameCount, vBase + 52, 1.5);
    wobblyLineTo(ctx, cx - hw * 0.5, spikeY, cx, cy - size * 0.5, frameCount, vBase + 60, 1.5);
    wobblyLineTo(ctx, cx, cy - size * 0.5, cx + hw * 0.5, spikeY, frameCount, vBase + 68, 1.5);
    wobblyLineTo(ctx, cx + hw * 0.5, spikeY, cx + hw, cy + bh * 0.5, frameCount, vBase + 76, 1.5);
    ctx.stroke();
    // Small circles on tips
    for (const [ox, oy] of [[-hw, cy + bh * 0.5], [0, cy - size * 0.5], [hw, cy + bh * 0.5]] as [number, number][]) {
      wobblyCircle(ctx, cx + ox, oy, 2.5, frameCount, vBase + 90, 1);
      ctx.stroke();
    }
  } else if (grade === "B賞") {
    // Hand-drawn 5-point star
    drawWobblySketchStar(ctx, cx, cy, size * 0.5, frameCount, vBase, color);
  } else if (grade === "C賞") {
    // Hand-drawn diamond
    const d = size * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + wobbleOffset(frameCount, vBase, 1.5), cy - d + wobbleOffset(frameCount, vBase + 1, 1.5));
    wobblyLineTo(ctx, cx, cy - d, cx + d, cy, frameCount, vBase + 10, 1.5);
    wobblyLineTo(ctx, cx + d, cy, cx, cy + d, frameCount, vBase + 20, 1.5);
    wobblyLineTo(ctx, cx, cy + d, cx - d, cy, frameCount, vBase + 30, 1.5);
    wobblyLineTo(ctx, cx - d, cy, cx, cy - d, frameCount, vBase + 40, 1.5);
    ctx.closePath();
    ctx.stroke();
  } else {
    // D賞: hand-drawn circle
    wobblyCircle(ctx, cx, cy, size * 0.42, frameCount, vBase, 2);
    ctx.stroke();
    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw grade label in handwriting font */
function drawHandwrittenText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  color: string,
  tiltDeg = 0,
): void {
  ctx.save();
  ctx.font = `${fontSize}px "Segoe Script", "Comic Sans MS", cursive`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (tiltDeg !== 0) {
    ctx.translate(x, y);
    ctx.rotate((tiltDeg * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade index helper
// ─────────────────────────────────────────────────────────────────────────────

function gradeIndex(grade: Grade): number {
  return SYMBOL_STRIP.findLastIndex((g) => g === grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Sketch({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SketchSlotGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<SketchSlotGameState>("IDLE");

  const reelOffsets = useRef<number[]>([0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0]);
  const reelLocked = useRef<boolean[]>([false, false, false]);
  const leverAngle = useRef(0);
  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const winAlpha = useRef(0);

  const changeState = useCallback((s: SketchSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fc = frameCount.current;

    // ── Background: notebook paper ─────────────────────────────────────────

    // Off-white paper fill
    ctx.fillStyle = SK.paper;
    ctx.fillRect(0, 0, W, H);

    // Very subtle paper texture (deterministic, static)
    ctx.globalAlpha = 0.03;
    for (let row = 0; row < H; row += 4) {
      for (let col = 0; col < W; col += 4) {
        // Seed based on position only — static
        const noise = (Math.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1;
        if (Math.abs(noise) > 0.5) {
          ctx.fillStyle = "#aaa";
          ctx.fillRect(col, row, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Faint blue horizontal lines (notebook lines) — static, drawn every 24px
    ctx.strokeStyle = SK.notebookLine;
    ctx.lineWidth = 0.8;
    for (let ly = 24; ly < H; ly += 24) {
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(W, ly);
      ctx.stroke();
    }

    // Red margin line at x=40
    ctx.strokeStyle = SK.marginLine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, H);
    ctx.stroke();

    // ── Machine body ───────────────────────────────────────────────────────
    const mX = 48, mY = 22, mW = 220, mH = H - 40;
    const vBase = 100;

    // Cross-hatch shadow on right and bottom (static)
    crossHatch(ctx, mX + mW - 18, mY + 8, 18, mH, 6, 0.10);
    crossHatch(ctx, mX + 8, mY + mH - 18, mW - 8, 18, 6, 0.10);

    // Machine body wobbly outline
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2.2;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    wobblyRect(ctx, mX, mY, mW, mH, fc, vBase, 2);
    ctx.fill();
    ctx.stroke();

    // Inner double-line decoration (lighter, wobblier)
    ctx.strokeStyle = SK.pencilLight;
    ctx.lineWidth = 0.8;
    wobblyRect(ctx, mX + 6, mY + 6, mW - 12, mH - 12, fc, vBase + 200, 1.5);
    ctx.stroke();

    // ── Header: "SLOT" handwritten text ───────────────────────────────────
    const headerY = mY + 28;
    // Header underline scribble
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mX + 20 + wobbleOffset(fc, 300, 2), headerY + 12 + wobbleOffset(fc, 301, 1));
    wobblyLineTo(ctx, mX + 20, headerY + 12, mX + mW - 20, headerY + 12, fc, 302, 2);
    ctx.stroke();

    // Title text — slightly tilted
    ctx.save();
    ctx.translate(mX + mW / 2, headerY);
    ctx.rotate((-1.5 * Math.PI) / 180);
    ctx.font = `bold 22px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencil;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SLOT", 0, 0);
    ctx.restore();

    // Small doodle stars on either side of header
    drawWobblySketchStar(ctx, mX + 30, headerY, 8, fc, 400, SK.pencilLight);
    drawWobblySketchStar(ctx, mX + mW - 30, headerY, 8, fc, 450, SK.pencilLight);

    // ── Reel window area ───────────────────────────────────────────────────
    const reelAreaX = mX + 16;
    const reelAreaY = headerY + 22;
    const reelAreaW = mW - 32;
    const reelAreaH = REEL_VISIBLE * CELL_H + 8;

    // Reel area fill (slightly off-white)
    ctx.fillStyle = "rgba(240,238,225,0.85)";
    ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);

    // Yellow highlighter on winning (center) row
    const winRowY = reelAreaY + CELL_H + 4;
    ctx.fillStyle = SK.yellowHL;
    ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);

    // Reel area wobbly border
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2;
    wobblyRect(ctx, reelAreaX, reelAreaY, reelAreaW, reelAreaH, fc, vBase + 500, 1.5);
    ctx.stroke();

    // Arrow markers pointing to center row (hand-drawn)
    const arrowY = winRowY + CELL_H / 2;
    ctx.strokeStyle = SK.redPen;
    ctx.lineWidth = 1.5;
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(reelAreaX - 14, arrowY);
    wobblyLineTo(ctx, reelAreaX - 14, arrowY, reelAreaX - 2, arrowY, fc, 600, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(reelAreaX - 8, arrowY - 5);
    wobblyLineTo(ctx, reelAreaX - 8, arrowY - 5, reelAreaX - 2, arrowY, fc, 610, 1.5);
    wobblyLineTo(ctx, reelAreaX - 2, arrowY, reelAreaX - 8, arrowY + 5, fc, 620, 1.5);
    ctx.stroke();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(reelAreaX + reelAreaW + 14, arrowY);
    wobblyLineTo(ctx, reelAreaX + reelAreaW + 14, arrowY, reelAreaX + reelAreaW + 2, arrowY, fc, 630, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(reelAreaX + reelAreaW + 8, arrowY - 5);
    wobblyLineTo(ctx, reelAreaX + reelAreaW + 8, arrowY - 5, reelAreaX + reelAreaW + 2, arrowY, fc, 640, 1.5);
    wobblyLineTo(ctx, reelAreaX + reelAreaW + 2, arrowY, reelAreaX + reelAreaW + 8, arrowY + 5, fc, 650, 1.5);
    ctx.stroke();

    // ── Draw reels ─────────────────────────────────────────────────────────
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
        const cellY = reelAreaY + v * CELL_H - frac + 4;

        // Cell border (wobbly)
        ctx.strokeStyle = SK.pencilFaint;
        ctx.lineWidth = 0.8;
        wobblyRect(ctx, rx + 3, cellY + 2, singleReelW - 6, CELL_H - 4, fc, 700 + r * 100 + v * 10, 1.2);
        ctx.stroke();

        // Grade icon
        const iconCx = rx + singleReelW / 2;
        const iconCy = cellY + CELL_H / 2 - 8;
        drawGradeIcon(ctx, grade, iconCx, iconCy, 22, fc, 800 + r * 200 + v * 50);

        // Grade label
        drawHandwrittenText(ctx, grade, iconCx, cellY + CELL_H - 14, 10, GRADE_COLOR[grade] ?? SK.pencil);
      }

      // Reel divider lines
      if (r < REEL_COUNT - 1) {
        ctx.strokeStyle = SK.pencil;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(rx + singleReelW + wobbleOffset(fc, 900 + r, 1), reelAreaY);
        wobblyLineTo(ctx, rx + singleReelW, reelAreaY, rx + singleReelW, reelAreaY + reelAreaH, fc, 901 + r * 10, 1.2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // ── Lever (right side) ─────────────────────────────────────────────────
    const levX = mX + mW + 18;
    const levBaseY = reelAreaY + reelAreaH / 2 + 10;
    const levTopY = levBaseY - 55 + leverAngle.current * 38;

    // Lever arm (wobbly)
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(levX + wobbleOffset(fc, 1000, 1.5), levTopY + wobbleOffset(fc, 1001, 1.5));
    wobblyLineTo(ctx, levX, levTopY, levX, levBaseY + 10, fc, 1002, 1.8);
    ctx.stroke();

    // Lever socket (wobbly rectangle)
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(200,190,170,0.5)";
    wobblyRect(ctx, levX - 6, levBaseY + 6, 12, 8, fc, 1010, 1);
    ctx.fill();
    ctx.stroke();
    crossHatch(ctx, levX - 4, levBaseY + 7, 8, 6, 4, 0.15);

    // Lever knob (wobbly circle)
    ctx.strokeStyle = SK.redPen;
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(220,80,80,0.15)";
    wobblyCircle(ctx, levX, levTopY - 10, 9, fc, 1020, 1.5);
    ctx.fill();
    ctx.stroke();
    // Highlight scribble on knob
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(levX - 4 + wobbleOffset(fc, 1030, 1), levTopY - 15 + wobbleOffset(fc, 1031, 1));
    wobblyLineTo(ctx, levX - 4, levTopY - 15, levX + 1, levTopY - 13, fc, 1032, 1);
    ctx.stroke();

    // ── Info display (target grade) ────────────────────────────────────────
    const infoY = reelAreaY + reelAreaH + 16;
    const targetGrade = resultGrade as Grade;
    const targetColor = GRADE_COLOR[targetGrade] ?? SK.pencil;

    // Info box
    ctx.strokeStyle = SK.bluePen;
    ctx.lineWidth = 1.2;
    ctx.fillStyle = "rgba(200,215,255,0.15)";
    wobblyRect(ctx, mX + 16, infoY, mW - 32, 30, fc, 1100, 1.2);
    ctx.fill();
    ctx.stroke();

    // Target grade label
    ctx.save();
    ctx.font = `11px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilLight;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("目標:", mX + 24, infoY + 15);
    ctx.restore();
    drawHandwrittenText(ctx, targetGrade, mX + mW - 60, infoY + 15, 13, targetColor);

    // ── PULL button ────────────────────────────────────────────────────────
    const btnY = infoY + 44;
    const btnX = mX + 16;
    const btnW = mW - 32;
    const btnH = 36;
    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canPull = isIdle || isResult;
    const btnLabel = isResult ? "RESET" : "PULL!";

    // Button shadow (cross-hatch)
    crossHatch(ctx, btnX + 6, btnY + 6, btnW, btnH, 7, 0.12);

    // Button body
    ctx.strokeStyle = canPull ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 2;
    ctx.fillStyle = canPull ? "rgba(220,240,200,0.5)" : "rgba(200,200,200,0.3)";
    wobblyRect(ctx, btnX, btnY, btnW, btnH, fc, 1200, 1.5);
    ctx.fill();
    ctx.stroke();

    // Button text (handwritten, slightly tilted)
    ctx.save();
    ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
    ctx.rotate((-1 * Math.PI) / 180);
    ctx.font = `bold 17px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = canPull ? SK.pencil : SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btnLabel, 0, 0);
    ctx.restore();

    // ── Win celebration effects ────────────────────────────────────────────
    if (stateRef.current === "RESULT") {
      if (winAlpha.current < 1) winAlpha.current = Math.min(1, winAlpha.current + dt / 300);
      const wa = winAlpha.current;

      // Yellow highlighter underline under result
      ctx.save();
      ctx.globalAlpha = wa * 0.5;
      ctx.fillStyle = SK.yellowHL;
      ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Exclamation marks scribbled around win area
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.font = `bold 18px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const excPositions = [
        [mX + 10, winRowY + 20],
        [mX + 18, winRowY + 45],
        [mX + mW - 10, winRowY + 20],
        [mX + mW - 18, winRowY + 48],
      ] as [number, number][];
      for (const [ex, ey] of excPositions) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(wobbleOffset(fc, 1300 + ex, 0.3));
        ctx.fillText("!", 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // "JACKPOT!" text with wobble
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.translate(mX + mW / 2, winRowY - 14);
      ctx.rotate(wobbleOffset(fc, 1400, 0.04) * 0.5);
      ctx.font = `bold 19px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("JACKPOT!", 0, 0);
      ctx.restore();

      // Underline scribble under JACKPOT
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.strokeStyle = SK.redPen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ulX = mX + mW / 2 - 40;
      ctx.moveTo(ulX + wobbleOffset(fc, 1450, 2), winRowY - 4 + wobbleOffset(fc, 1451, 1.5));
      wobblyLineTo(ctx, ulX, winRowY - 4, ulX + 80, winRowY - 4, fc, 1452, 2);
      ctx.stroke();
      ctx.restore();

      // Wobbly stars around win area
      ctx.save();
      ctx.globalAlpha = wa * 0.85;
      const starPositions = [
        { x: reelAreaX + 10, y: reelAreaY - 10, r: 9, vb: 1500 },
        { x: reelAreaX + reelAreaW - 10, y: reelAreaY - 10, r: 9, vb: 1550 },
        { x: reelAreaX + reelAreaW / 2, y: reelAreaY + reelAreaH + 12, r: 11, vb: 1600 },
        { x: reelAreaX + 24, y: reelAreaY + reelAreaH + 10, r: 7, vb: 1650 },
        { x: reelAreaX + reelAreaW - 24, y: reelAreaY + reelAreaH + 10, r: 7, vb: 1700 },
      ];
      for (const sp of starPositions) {
        drawWobblySketchStar(ctx, sp.x, sp.y, sp.r, fc, sp.vb, SK.redPen);
      }
      ctx.restore();
    } else {
      winAlpha.current = 0;
    }

    // ── Margin doodles (decorative) ────────────────────────────────────────
    const doodleAlpha = 0.25;
    ctx.save();
    ctx.globalAlpha = doodleAlpha;

    // Small star doodle near top margin
    drawWobblySketchStar(ctx, 20, 40, 7, fc, 2000, SK.pencilLight);
    // Small heart outline near middle margin
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 130);
    ctx.bezierCurveTo(14, 124, 8, 130, 8, 136);
    ctx.bezierCurveTo(8, 144, 20, 152, 20, 152);
    ctx.bezierCurveTo(20, 152, 32, 144, 32, 136);
    ctx.bezierCurveTo(32, 130, 26, 124, 20, 130);
    ctx.stroke();
    // Spiral doodle near bottom margin
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 4; a += 0.2) {
      const r = a * 2;
      const px = 20 + Math.cos(a) * r;
      const py = H - 60 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();

    // ── Status label (small, handwritten) ─────────────────────────────────
    const stateLabels: Record<SketchSlotGameState, string> = {
      IDLE: "idle...",
      SPINNING: "spinning!",
      STOPPING: "stopping...",
      RESULT: "result!",
    };
    const stateColor =
      stateRef.current === "RESULT" ? SK.redPen :
      stateRef.current === "SPINNING" ? SK.bluePen :
      SK.pencilFaint;
    drawHandwrittenText(ctx, stateLabels[stateRef.current], mX + mW - 30, mY + mH - 12, 9, stateColor);

  }, [resultGrade]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;

    const state = stateRef.current;

    if (state === "SPINNING" || state === "STOPPING") {
      for (let r = 0; r < REEL_COUNT; r++) {
        if (reelLocked.current[r]) continue;
        reelOffsets.current[r] = (reelOffsets.current[r]! + (reelSpeeds.current[r] ?? 0) * dt / 16) % (SYMBOL_STRIP.length * CELL_H);
      }

      if (state === "STOPPING" && reelLocked.current.every((l) => l)) {
        changeState("RESULT");
        onResult?.(resultGrade);
      }

      if (leverAngle.current > 0) {
        leverAngle.current = Math.max(0, leverAngle.current - dt / 400);
      }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, onResult, resultGrade]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Spin logic ─────────────────────────────────────────────────────────────
  const startSpin = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [5.0, 4.5, 4.0];
    reelLocked.current = [false, false, false];
    leverAngle.current = 1;
    winAlpha.current = 0;
    changeState("SPINNING");

    const targetIdx = gradeIndex(resultGrade as Grade);

    [0, 1, 2].forEach((r) => {
      setTimeout(() => {
        const targetOffset = targetIdx * CELL_H + CELL_H;
        reelSpeeds.current[r] = 1;
        setTimeout(() => {
          reelOffsets.current[r] = (targetOffset % (SYMBOL_STRIP.length * CELL_H) + SYMBOL_STRIP.length * CELL_H) % (SYMBOL_STRIP.length * CELL_H);
          reelSpeeds.current[r] = 0;
          reelLocked.current[r] = true;
          if (r === REEL_COUNT - 1) {
            changeState("STOPPING");
          }
        }, 350);
      }, 600 + r * 550);
    });
  }, [resultGrade, changeState]);

  const reset = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [0, 0, 0];
    reelLocked.current = [false, false, false];
    leverAngle.current = 0;
    winAlpha.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const mX = 48, mY = 22, mW = 220;
    const headerY = mY + 28;
    const reelAreaY = headerY + 22;
    const reelAreaH = REEL_VISIBLE * CELL_H + 8;
    const infoY = reelAreaY + reelAreaH + 16;
    const btnY = infoY + 44;
    const btnX = mX + 16;
    const btnW = mW - 32;
    const btnH = 36;

    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;
    const levX = mX + mW + 14;
    const onLever = nx >= levX - 16 && nx <= levX + 24 && ny >= 50 && ny <= 200;

    const state = stateRef.current;
    if ((onBtn || onLever) && state === "RESULT") {
      reset();
    } else if ((onBtn || onLever) && state === "IDLE") {
      startSpin();
    }
  }, [reset, startSpin]);

  void gameState; // suppress unused warning — state drives external callbacks

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: "#e8e6d9", padding: 8 }}
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
          borderRadius: 4,
          boxShadow: "4px 4px 12px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}
