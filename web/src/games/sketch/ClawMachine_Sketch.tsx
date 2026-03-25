"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SketchClawGameState = "IDLE" | "MOVING" | "DROPPING" | "GRABBING" | "LIFTING" | "RESULT";

export interface ClawMachineSketchProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: SketchClawGameState) => void;
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
  paper:        "#faf8f0",
  pencil:       "#333333",
  pencilLight:  "#555555",
  pencilFaint:  "#888888",
  notebookLine: "rgba(100,140,220,0.25)",
  marginLine:   "rgba(200,60,60,0.35)",
  redPen:       "#cc3333",
  bluePen:      "#3355cc",
  yellowHL:     "rgba(255,255,0,0.30)",
  gradeA:       "#b8860b",
  gradeB:       "#1a3a8c",
  gradeC:       "#1a6b3a",
  gradeD:       "#6b1a8c",
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": SK.gradeA,
  "B賞": SK.gradeB,
  "C賞": SK.gradeC,
  "D賞": SK.gradeD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic wobble helpers — sin-based, NEVER Math.random()
// ─────────────────────────────────────────────────────────────────────────────

function wobbleOffset(frameCount: number, vertexIndex: number, amount = 2): number {
  return Math.sin(frameCount * 0.08 + vertexIndex * 1.7) * amount;
}

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

// Static cross-hatch shadow — position-seeded, not frame-dependent
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
  ctx.beginPath();
  for (let i = -h; i < w + h; i += density * 1.4) {
    ctx.moveTo(x + i + h, y);
    ctx.lineTo(x + i, y + h);
  }
  ctx.stroke();
  ctx.restore();
}

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
// Toy doodle drawing — static per cell, position-seeded wobble only
// ─────────────────────────────────────────────────────────────────────────────

// Crown doodle for grade A
function drawCrownDoodle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  fc: number, vBase: number,
): void {
  const hw = size * 0.45;
  const bh = size * 0.3;
  ctx.save();
  ctx.strokeStyle = SK.gradeA;
  ctx.lineWidth = 1.6;
  // Base rectangle
  ctx.beginPath();
  ctx.moveTo(cx - hw + wobbleOffset(fc, vBase, 1.2), cy + bh * 0.5 + wobbleOffset(fc, vBase + 1, 1.2));
  wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx + hw, cy + bh * 0.5, fc, vBase + 10, 1.2);
  wobblyLineTo(ctx, cx + hw, cy + bh * 0.5, cx + hw, cy + bh * 1.8, fc, vBase + 20, 1.2);
  wobblyLineTo(ctx, cx + hw, cy + bh * 1.8, cx - hw, cy + bh * 1.8, fc, vBase + 30, 1.2);
  wobblyLineTo(ctx, cx - hw, cy + bh * 1.8, cx - hw, cy + bh * 0.5, fc, vBase + 40, 1.2);
  // Three spikes upward
  ctx.moveTo(cx - hw + wobbleOffset(fc, vBase + 50, 1), cy + bh * 0.5 + wobbleOffset(fc, vBase + 51, 1));
  wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx - hw * 0.3, cy - size * 0.3, fc, vBase + 52, 1.5);
  wobblyLineTo(ctx, cx - hw * 0.3, cy - size * 0.3, cx, cy - size * 0.45, fc, vBase + 62, 1.5);
  wobblyLineTo(ctx, cx, cy - size * 0.45, cx + hw * 0.3, cy - size * 0.3, fc, vBase + 72, 1.5);
  wobblyLineTo(ctx, cx + hw * 0.3, cy - size * 0.3, cx + hw, cy + bh * 0.5, fc, vBase + 82, 1.5);
  ctx.stroke();
  ctx.restore();
}

// Star doodle for grade B
function drawStarDoodle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fc: number, vBase: number,
): void {
  const pts = 5;
  const inner = r * 0.42;
  ctx.save();
  ctx.strokeStyle = SK.gradeB;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= pts * 2; i++) {
    const angle = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    const wx = wobbleOffset(fc, vBase + i * 3, 1.5);
    const wy = wobbleOffset(fc, vBase + i * 3 + 1, 1.5);
    const px = cx + Math.cos(angle) * rad + wx;
    const py = cy + Math.sin(angle) * rad + wy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Heart doodle for grade C
function drawHeartDoodle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  fc: number, vBase: number,
): void {
  const s = size * 0.5;
  const w0 = wobbleOffset(fc, vBase, 1.2);
  const w1 = wobbleOffset(fc, vBase + 1, 1.2);
  ctx.save();
  ctx.strokeStyle = SK.gradeC;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx + w0, cy - s * 0.3 + w1);
  // Left bump
  ctx.bezierCurveTo(
    cx - s * 0.5 + wobbleOffset(fc, vBase + 10, 1.5), cy - s + wobbleOffset(fc, vBase + 11, 1.5),
    cx - s + wobbleOffset(fc, vBase + 12, 1.5), cy - s * 0.2 + wobbleOffset(fc, vBase + 13, 1.5),
    cx + wobbleOffset(fc, vBase + 14, 1.2), cy + s * 0.6 + wobbleOffset(fc, vBase + 15, 1.2),
  );
  // Right bump
  ctx.bezierCurveTo(
    cx + s + wobbleOffset(fc, vBase + 20, 1.5), cy - s * 0.2 + wobbleOffset(fc, vBase + 21, 1.5),
    cx + s * 0.5 + wobbleOffset(fc, vBase + 22, 1.5), cy - s + wobbleOffset(fc, vBase + 23, 1.5),
    cx + wobbleOffset(fc, vBase + 24, 1.2), cy - s * 0.3 + wobbleOffset(fc, vBase + 25, 1.2),
  );
  ctx.stroke();
  ctx.restore();
}

// Smiley face doodle for grade D
function drawSmileyDoodle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fc: number, vBase: number,
): void {
  ctx.save();
  ctx.strokeStyle = SK.gradeD;
  ctx.lineWidth = 1.6;
  // Outer circle
  wobblyCircle(ctx, cx, cy, r, fc, vBase, 1.5);
  ctx.stroke();
  // Eyes — small filled dots via wobble circles
  ctx.fillStyle = SK.gradeD;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3 + wobbleOffset(fc, vBase + 60, 0.8), cy - r * 0.2 + wobbleOffset(fc, vBase + 61, 0.8), 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.3 + wobbleOffset(fc, vBase + 62, 0.8), cy - r * 0.2 + wobbleOffset(fc, vBase + 63, 0.8), 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Smile arc
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35 + wobbleOffset(fc, vBase + 70, 1), cy + r * 0.1 + wobbleOffset(fc, vBase + 71, 1));
  wobblyLineTo(ctx, cx - r * 0.35, cy + r * 0.1, cx, cy + r * 0.45, fc, vBase + 72, 1.2);
  wobblyLineTo(ctx, cx, cy + r * 0.45, cx + r * 0.35, cy + r * 0.1, fc, vBase + 82, 1.2);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Toy layout inside glass case
// ─────────────────────────────────────────────────────────────────────────────

interface ToyDef {
  grade: string;
  drawFn: (ctx: CanvasRenderingContext2D, cx: number, cy: number, fc: number, vBase: number) => void;
  cx: number;
  cy: number;
  vBase: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine_Sketch({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachineSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SketchClawGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<SketchClawGameState>("IDLE");

  const frameCount = useRef(0);
  const lastTime = useRef(0);

  // Claw animation state
  const clawX = useRef(0);         // 0..1 normalized position along rail
  const clawY = useRef(0);         // 0..1 — 0=top, 1=bottom of glass case
  const prongSpread = useRef(1);   // 1=open, 0=closed
  const winAlpha = useRef(0);
  const hasGrab = useRef(false);

  const changeState = useCallback((s: SketchClawGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw frame ─────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    void dt;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fc = frameCount.current;

    // ── Background: notebook paper ─────────────────────────────────────────
    ctx.fillStyle = SK.paper;
    ctx.fillRect(0, 0, W, H);

    // Subtle paper texture (static, position-seeded)
    ctx.globalAlpha = 0.03;
    for (let row = 0; row < H; row += 4) {
      for (let col = 0; col < W; col += 4) {
        const noise = (Math.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1;
        if (Math.abs(noise) > 0.5) {
          ctx.fillStyle = "#aaa";
          ctx.fillRect(col, row, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Blue horizontal notebook lines (static)
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

    // ── Machine frame ──────────────────────────────────────────────────────
    // Frame outer bounds
    const fX = 52, fY = 18, fW = 222, fH = H - 36;

    // Cross-hatch shadow on right and bottom (static)
    crossHatch(ctx, fX + fW - 14, fY + 10, 14, fH, 6, 0.10);
    crossHatch(ctx, fX + 10, fY + fH - 14, fW - 10, 14, 6, 0.10);

    // Frame outline — wobbly pencil rect, lightly filled
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2.4;
    ctx.fillStyle = "rgba(240,235,210,0.6)";
    wobblyRect(ctx, fX, fY, fW, fH, fc, 100, 2);
    ctx.fill();
    ctx.stroke();

    // Inner frame inset line (decorative)
    ctx.strokeStyle = SK.pencilLight;
    ctx.lineWidth = 0.8;
    wobblyRect(ctx, fX + 6, fY + 6, fW - 12, fH - 12, fc, 200, 1.5);
    ctx.stroke();

    // ── Title label ────────────────────────────────────────────────────────
    const titleY = fY + 22;
    ctx.save();
    ctx.translate(fX + fW / 2, titleY);
    ctx.rotate((-1.2 * Math.PI) / 180);
    ctx.font = `bold 18px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencil;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLAW", 0, 0);
    ctx.restore();
    // Underline
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(fX + fW / 2 - 22 + wobbleOffset(fc, 300, 1.5), titleY + 12 + wobbleOffset(fc, 301, 1));
    wobblyLineTo(ctx, fX + fW / 2 - 22, titleY + 12, fX + fW / 2 + 22, titleY + 12, fc, 302, 1.8);
    ctx.stroke();

    // ── Glass case area ────────────────────────────────────────────────────
    const glX = fX + 14;
    const glY = titleY + 18;
    const glW = fW - 28;
    const glH = 220;

    // Slightly lighter glass interior
    ctx.fillStyle = "rgba(255,253,245,0.75)";
    ctx.fillRect(glX, glY, glW, glH);

    // Floor cross-hatch inside glass case
    crossHatch(ctx, glX + 4, glY + glH - 20, glW - 8, 18, 6, 0.08);

    // Glass case wobbly border
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2;
    wobblyRect(ctx, glX, glY, glW, glH, fc, 400, 1.8);
    ctx.stroke();

    // Glass shine — two faint diagonal lines (static)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(glX + 12, glY + 4);
    ctx.lineTo(glX + 30, glY + glH * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(glX + 20, glY + 4);
    ctx.lineTo(glX + 36, glY + glH * 0.28);
    ctx.stroke();
    ctx.restore();

    // ── Toys inside glass case ─────────────────────────────────────────────
    // Fixed positions: 2 rows × 2 cols, slightly above floor
    const toySize = 22;
    const TOYS: ToyDef[] = [
      { grade: "A賞", drawFn: (c, cx, cy, f, v) => drawCrownDoodle(c, cx, cy, toySize, f, v), cx: glX + glW * 0.22, cy: glY + glH * 0.55, vBase: 1000 },
      { grade: "B賞", drawFn: (c, cx, cy, f, v) => drawStarDoodle(c, cx, cy, toySize * 0.5, f, v), cx: glX + glW * 0.5,  cy: glY + glH * 0.52, vBase: 1100 },
      { grade: "C賞", drawFn: (c, cx, cy, f, v) => drawHeartDoodle(c, cx, cy, toySize, f, v), cx: glX + glW * 0.75, cy: glY + glH * 0.56, vBase: 1200 },
      { grade: "D賞", drawFn: (c, cx, cy, f, v) => drawSmileyDoodle(c, cx, cy, toySize * 0.5, f, v), cx: glX + glW * 0.35, cy: glY + glH * 0.76, vBase: 1300 },
    ];

    // If winning (grab happened), hide the grabbed toy
    const grabbedGrade = hasGrab.current ? resultGrade : null;

    for (const toy of TOYS) {
      if (toy.grade === grabbedGrade && stateRef.current !== "RESULT") continue;

      // Small shadow below toy (cross-hatch)
      crossHatch(ctx, toy.cx - toySize * 0.5, toy.cy + toySize * 0.3, toySize, 5, 5, 0.09);

      // Draw the doodle
      toy.drawFn(ctx, toy.cx, toy.cy, fc, toy.vBase);

      // Grade label in tiny pencil text
      ctx.save();
      ctx.font = `8px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = GRADE_COLOR[toy.grade] ?? SK.pencilFaint;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(toy.grade, toy.cx, toy.cy + toySize * 0.5);
      ctx.restore();
    }

    // ── Rail ───────────────────────────────────────────────────────────────
    const railY = glY + 14;
    const railX1 = glX + 12;
    const railX2 = glX + glW - 12;

    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(railX1 + wobbleOffset(fc, 500, 1.5), railY + wobbleOffset(fc, 501, 1.5));
    wobblyLineTo(ctx, railX1, railY, railX2, railY, fc, 502, 1.5);
    ctx.stroke();

    // Rail end caps (small wobbly circles)
    ctx.strokeStyle = SK.pencilLight;
    ctx.lineWidth = 1.2;
    wobblyCircle(ctx, railX1, railY, 4, fc, 510, 1);
    ctx.stroke();
    wobblyCircle(ctx, railX2, railY, 4, fc, 520, 1);
    ctx.stroke();

    // ── Claw position ──────────────────────────────────────────────────────
    const cxPos = railX1 + clawX.current * (railX2 - railX1);
    const cableTopY = railY;
    const glassFloorY = glY + glH - 22;
    const cableLen = clawY.current * (glassFloorY - railY - 30);
    const cableBottomY = railY + cableLen + 28;

    // Cable — thin wobbly vertical line
    ctx.strokeStyle = SK.pencilLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cxPos + wobbleOffset(fc, 600, 1), cableTopY + wobbleOffset(fc, 601, 1));
    wobblyLineTo(ctx, cxPos, cableTopY, cxPos, cableBottomY, fc, 602, 1);
    ctx.stroke();

    // Hub (small wobbly circle at cable end)
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(200,195,180,0.7)";
    wobblyCircle(ctx, cxPos, cableBottomY, 5, fc, 610, 1);
    ctx.fill();
    ctx.stroke();

    // ── Three prongs ───────────────────────────────────────────────────────
    // spread 1=fully open, 0=fully closed
    const spread = prongSpread.current;
    const prongLen = 18;
    const prongBaseY = cableBottomY + 4;
    // Angles: left prong, center prong, right prong
    // Fully open: ±40°, 90°; fully closed: ±10°, 90°
    const leftAngle  = (Math.PI / 2) + (spread * 38 * Math.PI / 180);
    const rightAngle = (Math.PI / 2) - (spread * 38 * Math.PI / 180);
    const midAngle   = Math.PI / 2;

    const prongs = [
      { angle: leftAngle,  vb: 620 },
      { angle: midAngle,   vb: 640 },
      { angle: rightAngle, vb: 660 },
    ];

    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.8;
    for (const p of prongs) {
      const ex = cxPos + Math.cos(p.angle) * prongLen;
      const ey = prongBaseY + Math.sin(p.angle) * prongLen;
      ctx.beginPath();
      ctx.moveTo(cxPos + wobbleOffset(fc, p.vb, 1), prongBaseY + wobbleOffset(fc, p.vb + 1, 1));
      wobblyLineTo(ctx, cxPos, prongBaseY, ex, ey, fc, p.vb + 2, 1.2);
      ctx.stroke();
      // Slight hook at tip
      const hookAngle = p.angle + (p.angle > Math.PI / 2 ? 0.4 : p.angle < Math.PI / 2 ? -0.4 : 0);
      const hx = ex + Math.cos(hookAngle) * 5;
      const hy = ey + Math.sin(hookAngle) * 5;
      ctx.beginPath();
      ctx.moveTo(ex + wobbleOffset(fc, p.vb + 10, 0.8), ey + wobbleOffset(fc, p.vb + 11, 0.8));
      wobblyLineTo(ctx, ex, ey, hx, hy, fc, p.vb + 12, 0.8);
      ctx.stroke();
    }

    // ── Grabbed toy (lifted up with claw) ─────────────────────────────────
    if (hasGrab.current && (stateRef.current === "LIFTING" || stateRef.current === "RESULT")) {
      const toy = TOYS.find((t) => t.grade === resultGrade);
      if (toy) {
        const toyDrawY = prongBaseY + 16;
        toy.drawFn(ctx, cxPos, toyDrawY, fc, toy.vBase + 500);
      }
    }

    // ── Control buttons ────────────────────────────────────────────────────
    const btnAreaY = glY + glH + 16;

    // Left arrow button (◀)
    const lBtnX = fX + fW * 0.18;
    const rBtnX = fX + fW * 0.42;
    const dropBtnX = fX + fW * 0.72;
    const btnY = btnAreaY + 16;

    // Arrow buttons — wobbly circles with hand-drawn arrows
    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canControl = isIdle || isResult;

    // Left arrow button
    crossHatch(ctx, lBtnX - 14 + 4, btnY - 14 + 4, 28, 28, 7, 0.08);
    ctx.strokeStyle = canControl ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = canControl ? "rgba(220,230,210,0.45)" : "rgba(200,200,200,0.2)";
    wobblyCircle(ctx, lBtnX, btnY, 14, fc, 700, 1.2);
    ctx.fill();
    ctx.stroke();
    // Arrow ◀ inside
    ctx.strokeStyle = canControl ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(lBtnX + 4 + wobbleOffset(fc, 710, 0.8), btnY + wobbleOffset(fc, 711, 0.8));
    wobblyLineTo(ctx, lBtnX + 4, btnY, lBtnX - 4, btnY, fc, 712, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lBtnX + wobbleOffset(fc, 720, 0.8), btnY - 5 + wobbleOffset(fc, 721, 0.8));
    wobblyLineTo(ctx, lBtnX, btnY - 5, lBtnX - 5, btnY, fc, 722, 0.8);
    wobblyLineTo(ctx, lBtnX - 5, btnY, lBtnX, btnY + 5, fc, 730, 0.8);
    ctx.stroke();

    // Right arrow button (▶)
    crossHatch(ctx, rBtnX - 14 + 4, btnY - 14 + 4, 28, 28, 7, 0.08);
    ctx.strokeStyle = canControl ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = canControl ? "rgba(220,230,210,0.45)" : "rgba(200,200,200,0.2)";
    wobblyCircle(ctx, rBtnX, btnY, 14, fc, 750, 1.2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = canControl ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(rBtnX - 4 + wobbleOffset(fc, 760, 0.8), btnY + wobbleOffset(fc, 761, 0.8));
    wobblyLineTo(ctx, rBtnX - 4, btnY, rBtnX + 4, btnY, fc, 762, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rBtnX + wobbleOffset(fc, 770, 0.8), btnY - 5 + wobbleOffset(fc, 771, 0.8));
    wobblyLineTo(ctx, rBtnX, btnY - 5, rBtnX + 5, btnY, fc, 772, 0.8);
    wobblyLineTo(ctx, rBtnX + 5, btnY, rBtnX, btnY + 5, fc, 780, 0.8);
    ctx.stroke();

    // DROP button — wobbly circle with cross-hatch fill + red "DROP!" text
    crossHatch(ctx, dropBtnX - 22 + 4, btnY - 22 + 4, 44, 44, 7, 0.10);
    ctx.strokeStyle = canControl ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 2;
    ctx.fillStyle = canControl ? "rgba(255,210,190,0.5)" : "rgba(200,200,200,0.2)";
    wobblyCircle(ctx, dropBtnX, btnY, 22, fc, 800, 1.5);
    ctx.fill();
    ctx.stroke();
    // "DROP!" text in red pen
    ctx.save();
    ctx.translate(dropBtnX, btnY);
    ctx.rotate((-1.5 * Math.PI) / 180);
    ctx.font = `bold 11px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = canControl ? SK.redPen : SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DROP!", 0, 0);
    ctx.restore();

    // Button labels in pencil (below buttons)
    ctx.font = `8px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("◀", lBtnX, btnY + 18);
    ctx.fillText("▶", rBtnX, btnY + 18);

    // ── Win celebration ────────────────────────────────────────────────────
    if (stateRef.current === "RESULT") {
      if (winAlpha.current < 1) winAlpha.current = Math.min(1, winAlpha.current + 0.02);
      const wa = winAlpha.current;

      // Yellow highlighter over prize name area
      ctx.save();
      ctx.globalAlpha = wa * 0.4;
      ctx.fillStyle = SK.yellowHL;
      ctx.fillRect(fX + fW * 0.1, fY + fH - 48, fW * 0.8, 28);
      ctx.restore();

      // "GET!" in red pen
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.translate(fX + fW / 2, fY + fH - 34);
      ctx.rotate(wobbleOffset(fc, 1400, 0.04) * 0.5);
      ctx.font = `bold 18px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GET!", 0, 0);
      ctx.restore();

      // Exclamation doodles around win area
      ctx.save();
      ctx.globalAlpha = wa * 0.9;
      ctx.font = `bold 16px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      const excPos = [
        [fX + 16, fY + fH - 38],
        [fX + fW - 16, fY + fH - 38],
        [fX + fW * 0.25, fY + fH - 22],
        [fX + fW * 0.75, fY + fH - 22],
      ] as [number, number][];
      for (const [ex, ey] of excPos) {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(wobbleOffset(fc, 1500 + ex, 0.4));
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // Wobbly starburst behind win text
      ctx.save();
      ctx.globalAlpha = wa * 0.6;
      ctx.strokeStyle = SK.redPen;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const innerR = 12;
        const outerR = 24 + wobbleOffset(fc, 1600 + i * 5, 4);
        ctx.beginPath();
        ctx.moveTo(
          fX + fW / 2 + Math.cos(angle) * innerR,
          fY + fH - 34 + Math.sin(angle) * innerR,
        );
        ctx.lineTo(
          fX + fW / 2 + Math.cos(angle) * outerR,
          fY + fH - 34 + Math.sin(angle) * outerR,
        );
        ctx.stroke();
      }
      ctx.restore();
    } else {
      winAlpha.current = 0;
    }

    // ── Prize name display at bottom ───────────────────────────────────────
    const prizeY = fY + fH - 50;
    ctx.strokeStyle = SK.bluePen;
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(200,215,255,0.12)";
    wobblyRect(ctx, fX + 18, prizeY, fW - 36, 26, fc, 900, 1);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.font = `9px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilLight;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("次賞:", fX + 26, prizeY + 13);
    ctx.restore();
    drawHandwrittenText(ctx, resultGrade, fX + fW - 42, prizeY + 13, 10, GRADE_COLOR[resultGrade] ?? SK.pencil);
    ctx.save();
    ctx.font = `8px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(prizeName, fX + fW / 2 + 12, prizeY + 13);
    ctx.restore();

    // ── Margin doodles (decorative) ────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.22;

    // Sketchy game controller near top margin
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    // Controller body (small oval)
    ctx.beginPath();
    ctx.ellipse(20, 60, 11, 7, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    // D-pad nub left
    ctx.beginPath();
    ctx.moveTo(13, 60); ctx.lineTo(10, 60);
    ctx.moveTo(20, 67); ctx.lineTo(20, 70);
    ctx.stroke();
    // Two small buttons on right
    ctx.beginPath();
    ctx.arc(25, 58, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(28, 62, 2, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow pointing to prize area
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 200);
    ctx.lineTo(20, 230);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, 225); ctx.lineTo(20, 232); ctx.lineTo(25, 225);
    ctx.stroke();
    // Small label
    ctx.save();
    ctx.font = `7px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("prize!", 20, 234);
    ctx.restore();

    ctx.restore();

    // ── State indicator ────────────────────────────────────────────────────
    const stateLabels: Record<SketchClawGameState, string> = {
      IDLE:     "idle...",
      MOVING:   "moving!",
      DROPPING: "drop!",
      GRABBING: "grab!",
      LIFTING:  "lift!",
      RESULT:   "got it!",
    };
    const stateColor =
      stateRef.current === "RESULT"   ? SK.redPen :
      stateRef.current === "DROPPING" ? SK.bluePen :
      stateRef.current === "GRABBING" ? SK.gradeA :
      SK.pencilFaint;
    drawHandwrittenText(ctx, stateLabels[stateRef.current], fX + fW - 28, fY + fH - 12, 8, stateColor);

  }, [resultGrade]);

  // ── Animation logic ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Grab sequence ───────────────────────────────────────────────────────────
  const startGrab = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;

    hasGrab.current = false;
    winAlpha.current = 0;
    clawX.current = 0.2;
    clawY.current = 0;
    prongSpread.current = 1;
    changeState("MOVING");

    // Phase 1: move rail horizontally to target (0.5 center)
    const targetX = 0.45 + (Math.sin(Date.now() * 0.001) * 0.2);
    let moveProgress = 0;
    const startX = clawX.current;

    const moveTimer = setInterval(() => {
      moveProgress = Math.min(1, moveProgress + 0.05);
      clawX.current = startX + (targetX - startX) * moveProgress;
      if (moveProgress >= 1) {
        clearInterval(moveTimer);

        // Phase 2: drop down
        changeState("DROPPING");
        let dropProgress = 0;
        const dropTimer = setInterval(() => {
          dropProgress = Math.min(1, dropProgress + 0.04);
          clawY.current = dropProgress;
          if (dropProgress >= 1) {
            clearInterval(dropTimer);

            // Phase 3: close prongs
            changeState("GRABBING");
            let closeProgress = 0;
            const closeTimer = setInterval(() => {
              closeProgress = Math.min(1, closeProgress + 0.06);
              prongSpread.current = 1 - closeProgress;
              if (closeProgress >= 1) {
                clearInterval(closeTimer);
                hasGrab.current = true;

                // Phase 4: lift back up
                changeState("LIFTING");
                let liftProgress = 0;
                const liftTimer = setInterval(() => {
                  liftProgress = Math.min(1, liftProgress + 0.04);
                  clawY.current = 1 - liftProgress;
                  if (liftProgress >= 1) {
                    clearInterval(liftTimer);
                    clawY.current = 0;
                    prongSpread.current = 0.2;
                    changeState("RESULT");
                    onResult?.(resultGrade);
                  }
                }, 30);
              }
            }, 30);
          }
        }, 30);
      }
    }, 30);
  }, [changeState, onResult, resultGrade]);

  const reset = useCallback(() => {
    clawX.current = 0.2;
    clawY.current = 0;
    prongSpread.current = 1;
    hasGrab.current = false;
    winAlpha.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ───────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    // Machine frame bounds
    const fX = 52, fY = 18, fW = 222, fH = H - 36;
    const titleY = fY + 22;
    const glY = titleY + 18;
    const glH = 220;
    const btnAreaY = glY + glH + 16;
    const btnY = btnAreaY + 16;

    const lBtnX = fX + fW * 0.18;
    const rBtnX = fX + fW * 0.42;
    const dropBtnX = fX + fW * 0.72;

    const dist = (ax: number, ay: number) => Math.hypot(nx - ax, ny - ay);

    if (stateRef.current === "RESULT") {
      reset();
      return;
    }

    if (stateRef.current === "IDLE") {
      if (dist(dropBtnX, btnY) < 24) {
        startGrab();
        return;
      }
      if (dist(lBtnX, btnY) < 18) {
        clawX.current = Math.max(0, clawX.current - 0.15);
        return;
      }
      if (dist(rBtnX, btnY) < 18) {
        clawX.current = Math.min(1, clawX.current + 0.15);
        return;
      }
    }
  }, [reset, startGrab]);

  void gameState;

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
