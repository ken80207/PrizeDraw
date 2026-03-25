"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SketchGachaGameState = "IDLE" | "TURNING" | "DROPPING" | "OPENING" | "RESULT";

export interface GachaMachineSketchProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: SketchGachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 300;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Sketch palette
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
// Wobble helpers — deterministic sin-based, NEVER Math.random()
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

// Static cross-hatch shadow
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
// Wobbly dome (semi-circle approximated by short wobbly segments)
// ─────────────────────────────────────────────────────────────────────────────

function wobblyArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
  fc: number,
  vBase: number,
  wobble = 1.5,
): void {
  const steps = 32;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    const wx = wobbleOffset(fc, vBase + i * 3, wobble);
    const wy = wobbleOffset(fc, vBase + i * 3 + 1, wobble);
    const px = cx + Math.cos(angle) * r + wx;
    const py = cy + Math.sin(angle) * r + wy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prize doodle icons inside opened capsule
// ─────────────────────────────────────────────────────────────────────────────

function drawPrizeDoodle(
  ctx: CanvasRenderingContext2D,
  grade: string,
  cx: number, cy: number,
  fc: number, vBase: number,
): void {
  const color = GRADE_COLOR[grade] ?? SK.pencil;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;

  if (grade === "A賞") {
    // Crown: three bumps on top
    const hw = 10; const bh = 6;
    ctx.beginPath();
    ctx.moveTo(cx - hw + wobbleOffset(fc, vBase, 1), cy + bh * 0.5 + wobbleOffset(fc, vBase + 1, 1));
    wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx + hw, cy + bh * 0.5, fc, vBase + 10, 1);
    wobblyLineTo(ctx, cx + hw, cy + bh * 0.5, cx + hw, cy + bh * 1.8, fc, vBase + 20, 1);
    wobblyLineTo(ctx, cx + hw, cy + bh * 1.8, cx - hw, cy + bh * 1.8, fc, vBase + 30, 1);
    wobblyLineTo(ctx, cx - hw, cy + bh * 1.8, cx - hw, cy + bh * 0.5, fc, vBase + 40, 1);
    ctx.moveTo(cx - hw + wobbleOffset(fc, vBase + 50, 1), cy + bh * 0.5 + wobbleOffset(fc, vBase + 51, 1));
    wobblyLineTo(ctx, cx - hw, cy + bh * 0.5, cx - hw * 0.3, cy - 8, fc, vBase + 52, 1.2);
    wobblyLineTo(ctx, cx - hw * 0.3, cy - 8, cx, cy - 12, fc, vBase + 62, 1.2);
    wobblyLineTo(ctx, cx, cy - 12, cx + hw * 0.3, cy - 8, fc, vBase + 72, 1.2);
    wobblyLineTo(ctx, cx + hw * 0.3, cy - 8, cx + hw, cy + bh * 0.5, fc, vBase + 82, 1.2);
    ctx.stroke();
  } else if (grade === "B賞") {
    // 5-point star
    const r = 11; const inner = 4.5;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : inner;
      const wx = wobbleOffset(fc, vBase + i * 3, 1.2);
      const wy = wobbleOffset(fc, vBase + i * 3 + 1, 1.2);
      const px = cx + Math.cos(angle) * rad + wx;
      const py = cy + Math.sin(angle) * rad + wy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (grade === "C賞") {
    // Heart
    ctx.beginPath();
    ctx.moveTo(cx + wobbleOffset(fc, vBase, 1), cy - 5 + wobbleOffset(fc, vBase + 1, 1));
    ctx.bezierCurveTo(
      cx - 6 + wobbleOffset(fc, vBase + 10, 1.2), cy - 12,
      cx - 12 + wobbleOffset(fc, vBase + 11, 1.2), cy - 3,
      cx + wobbleOffset(fc, vBase + 12, 1), cy + 8,
    );
    ctx.bezierCurveTo(
      cx + 12 + wobbleOffset(fc, vBase + 20, 1.2), cy - 3,
      cx + 6 + wobbleOffset(fc, vBase + 21, 1.2), cy - 12,
      cx + wobbleOffset(fc, vBase + 22, 1), cy - 5,
    );
    ctx.stroke();
  } else {
    // Smiley face (D賞)
    wobblyCircle(ctx, cx, cy, 10, fc, vBase, 1.2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx - 3.5, cy - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 3.5, cy - 2.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 3.5 + wobbleOffset(fc, vBase + 70, 0.8), cy + 3 + wobbleOffset(fc, vBase + 71, 0.8));
    wobblyLineTo(ctx, cx - 3.5, cy + 3, cx, cy + 6, fc, vBase + 72, 0.8);
    wobblyLineTo(ctx, cx, cy + 6, cx + 3.5, cy + 3, fc, vBase + 82, 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine_Sketch({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachineSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SketchGachaGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<SketchGachaGameState>("IDLE");

  const frameCount = useRef(0);
  const lastTime = useRef(0);

  // Animation state
  const knobAngle = useRef(0);          // knob rotation in radians (0 = rest)
  const knobSpinning = useRef(false);
  const capsuleDrop = useRef(0);        // 0..1 — capsule fall progress
  const capsuleOpen = useRef(0);        // 0..1 — top half shifting up
  const winAlpha = useRef(0);

  const changeState = useCallback((s: SketchGachaGameState) => {
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

    // ── Notebook paper background ──────────────────────────────────────────
    ctx.fillStyle = SK.paper;
    ctx.fillRect(0, 0, W, H);

    // Paper texture (static, position-seeded)
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

    // Red margin line at x=36
    ctx.strokeStyle = SK.marginLine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(36, 0);
    ctx.lineTo(36, H);
    ctx.stroke();

    // ── Machine body ───────────────────────────────────────────────────────
    const mX = 44, mY = 16, mW = 200, mH = H - 36;

    // Cross-hatch shadow on right and bottom (static)
    crossHatch(ctx, mX + mW - 12, mY + 8, 12, mH, 6, 0.10);
    crossHatch(ctx, mX + 8, mY + mH - 12, mW - 8, 12, 6, 0.10);

    // Machine body outline
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2.2;
    ctx.fillStyle = "rgba(240,236,218,0.65)";
    wobblyRect(ctx, mX, mY, mW, mH, fc, 100, 2);
    ctx.fill();
    ctx.stroke();

    // Inner inset line (decorative)
    ctx.strokeStyle = SK.pencilLight;
    ctx.lineWidth = 0.8;
    wobblyRect(ctx, mX + 5, mY + 5, mW - 10, mH - 10, fc, 200, 1.5);
    ctx.stroke();

    // ── Title text ─────────────────────────────────────────────────────────
    const titleY = mY + 22;
    ctx.save();
    ctx.translate(mX + mW / 2, titleY);
    ctx.rotate((-1 * Math.PI) / 180);
    ctx.font = `bold 17px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencil;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GACHA", 0, 0);
    ctx.restore();
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(mX + mW / 2 - 28 + wobbleOffset(fc, 300, 1.5), titleY + 11 + wobbleOffset(fc, 301, 1));
    wobblyLineTo(ctx, mX + mW / 2 - 28, titleY + 11, mX + mW / 2 + 28, titleY + 11, fc, 302, 1.8);
    ctx.stroke();

    // ── Dome (semi-circle) over glass sphere area ──────────────────────────
    const domeR = mW * 0.38;
    const domeCX = mX + mW / 2;
    const domeCY = titleY + 30 + domeR;
    const domeTopY = titleY + 30;

    // Dome fill (slightly glassy)
    ctx.save();
    ctx.beginPath();
    wobblyArc(ctx, domeCX, domeCY, domeR, -Math.PI, 0, fc, 400, 1.5);
    ctx.lineTo(domeCX + domeR, domeCY);
    ctx.lineTo(domeCX - domeR, domeCY);
    ctx.closePath();
    ctx.fillStyle = "rgba(220,240,255,0.45)";
    ctx.fill();
    ctx.restore();

    // Dome outline (wobbly arc)
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2;
    wobblyArc(ctx, domeCX, domeCY, domeR, -Math.PI, 0, fc, 400, 1.5);
    ctx.stroke();
    // Dome base flat line
    ctx.beginPath();
    ctx.moveTo(domeCX - domeR + wobbleOffset(fc, 500, 1.5), domeCY + wobbleOffset(fc, 501, 1));
    wobblyLineTo(ctx, domeCX - domeR, domeCY, domeCX + domeR, domeCY, fc, 502, 1.5);
    ctx.stroke();

    // Glass shine (two faint arcs — static)
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(domeCX - domeR * 0.3, domeCY - domeR * 0.4, domeR * 0.22, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    ctx.restore();

    // ── Capsules inside dome ───────────────────────────────────────────────
    // Draw several small capsule doodles inside the dome sphere
    // Capsule positions fixed relative to dome center (static, position-seeded)
    const capPositions = [
      { cx: domeCX - 24, cy: domeCY - 18, r: 10, vb: 1000 },
      { cx: domeCX + 18, cy: domeCY - 22, r: 9,  vb: 1040 },
      { cx: domeCX - 8,  cy: domeCY - 36, r: 8,  vb: 1080 },
      { cx: domeCX + 30, cy: domeCY - 8,  r: 7,  vb: 1120 },
      { cx: domeCX - 30, cy: domeCY - 4,  r: 8,  vb: 1160 },
    ];

    // Clip to dome area
    ctx.save();
    ctx.beginPath();
    ctx.arc(domeCX, domeCY, domeR - 2, 0, Math.PI * 2);
    ctx.clip();

    for (const cap of capPositions) {
      // Capsule: wobbly circle with horizontal equator line (pencil doodle)
      ctx.strokeStyle = SK.pencilLight;
      ctx.lineWidth = 1.2;
      wobblyCircle(ctx, cap.cx, cap.cy, cap.r, fc, cap.vb, 1);
      ctx.stroke();
      // Equator line
      ctx.beginPath();
      ctx.moveTo(cap.cx - cap.r + wobbleOffset(fc, cap.vb + 30, 0.8), cap.cy + wobbleOffset(fc, cap.vb + 31, 0.8));
      wobblyLineTo(ctx, cap.cx - cap.r, cap.cy, cap.cx + cap.r, cap.cy, fc, cap.vb + 32, 0.8);
      ctx.stroke();
      // Tiny color dot
      ctx.fillStyle = SK.pencilFaint;
      ctx.beginPath();
      ctx.arc(cap.cx, cap.cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── Machine lower body section ─────────────────────────────────────────
    const bodyTopY = domeCY;
    const handleBarY = bodyTopY + 28;
    const coinSlotY = handleBarY + 30;
    const chuteY = mY + mH - 58;

    // ── Handle bar (horizontal, wobbly) ───────────────────────────────────
    const hbX1 = mX + 24;
    const hbX2 = mX + mW - 24;
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hbX1 + wobbleOffset(fc, 600, 1.5), handleBarY + wobbleOffset(fc, 601, 1));
    wobblyLineTo(ctx, hbX1, handleBarY, hbX2, handleBarY, fc, 602, 1.5);
    ctx.stroke();

    // ── Handle knob (right end, wobbly circle) ────────────────────────────
    const knobX = hbX2 + 16;
    const knobY = handleBarY;

    // Knob spin affects visual rotation lines when turning
    const isSpinning = knobSpinning.current;
    // Frame-dependent wobble only for motion
    const knobWobble = isSpinning ? fc : 0; // static when idle

    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = "rgba(200,185,160,0.65)";
    wobblyCircle(ctx, knobX, knobY, 12, knobWobble, 700, isSpinning ? 2 : 1);
    ctx.fill();
    ctx.stroke();
    // Cross-hatch inside knob
    crossHatch(ctx, knobX - 10, knobY - 10, 20, 20, 5, 0.10);

    // Motion lines when spinning (manga-style short parallel dashes)
    if (isSpinning) {
      ctx.save();
      ctx.strokeStyle = SK.pencilFaint;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 5; i++) {
        const angle = (fc * 0.2 + (i / 5) * Math.PI * 2) % (Math.PI * 2);
        const r1 = 15; const r2 = 22;
        ctx.beginPath();
        ctx.moveTo(knobX + Math.cos(angle) * r1, knobY + Math.sin(angle) * r1);
        ctx.lineTo(knobX + Math.cos(angle) * r2, knobY + Math.sin(angle) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // "turn!" annotation arrow near knob
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    // Small curved annotation: arc + arrowhead
    ctx.beginPath();
    ctx.arc(knobX, knobY, 18, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();
    // Arrowhead tip
    ctx.beginPath();
    ctx.moveTo(knobX + Math.cos(Math.PI * 0.1) * 18, knobY + Math.sin(Math.PI * 0.1) * 18);
    ctx.lineTo(knobX + Math.cos(Math.PI * 0.1) * 18 - 5, knobY + Math.sin(Math.PI * 0.1) * 18 + 2);
    ctx.stroke();
    // "turn!" text
    ctx.font = `7px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("turn!", knobX + 26, knobY - 4);
    ctx.restore();

    // ── Coin slot ─────────────────────────────────────────────────────────
    const csX = mX + mW / 2 - 16;
    const csW = 32; const csH = 14;
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(160,155,140,0.4)";
    wobblyRect(ctx, csX, coinSlotY, csW, csH, fc, 800, 1);
    ctx.fill();
    ctx.stroke();
    // Slot opening (thin dark rectangle inside)
    ctx.fillStyle = "rgba(40,35,30,0.5)";
    ctx.fillRect(csX + csW * 0.3, coinSlotY + csH * 0.25, csW * 0.4, csH * 0.5);
    // "¥" label in pencil
    drawHandwrittenText(ctx, "¥", csX + csW / 2, coinSlotY + csH + 9, 9, SK.pencilFaint);

    // ── Chute (wobbly rectangle opening at bottom) ─────────────────────────
    const chuteW = 44; const chuteH = 22;
    const chuteCX = mX + mW / 2;
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = "rgba(140,130,110,0.35)";
    wobblyRect(ctx, chuteCX - chuteW / 2, chuteY, chuteW, chuteH, fc, 900, 1.2);
    ctx.fill();
    ctx.stroke();
    crossHatch(ctx, chuteCX - chuteW / 2 + 3, chuteY + 3, chuteW - 6, chuteH - 6, 5, 0.08);

    // ── Falling capsule animation ──────────────────────────────────────────
    const isTurning  = stateRef.current === "TURNING";
    const isDropping = stateRef.current === "DROPPING";
    const isOpening  = stateRef.current === "OPENING";
    const isResult   = stateRef.current === "RESULT";

    if (isDropping || isOpening || isResult) {
      const dropT = capsuleDrop.current;
      const openT = capsuleOpen.current;

      // Capsule falls from dome bottom to chute
      const capStartY = domeCY + 4;
      const capEndY = chuteY + chuteH / 2;
      const capY = capStartY + (capEndY - capStartY) * Math.min(dropT, 1);
      const capX = chuteCX;
      const capR = 14;

      // Motion lines behind falling capsule (when dropping)
      if (isDropping) {
        ctx.save();
        ctx.strokeStyle = SK.pencilFaint;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.4;
        for (let i = 1; i <= 4; i++) {
          const dashY = capY - i * 6;
          const dashHw = capR * 0.6;
          ctx.beginPath();
          ctx.moveTo(capX - dashHw + wobbleOffset(fc, 1400 + i, 1), dashY);
          ctx.lineTo(capX + dashHw + wobbleOffset(fc, 1410 + i, 1), dashY);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Capsule body: wobbly circle with equator line
      // When opening: top half shifts upward by openT * capR
      const topHalfOffsetY = openT * capR * 1.4;

      // Bottom half
      ctx.save();
      ctx.beginPath();
      ctx.arc(capX, capY, capR, 0, Math.PI);
      ctx.clip();
      ctx.strokeStyle = SK.pencilLight;
      ctx.lineWidth = 2;
      wobblyCircle(ctx, capX, capY, capR, fc, 1500, 1.5);
      ctx.stroke();
      ctx.restore();

      // Top half (shifts up when opening)
      ctx.save();
      ctx.beginPath();
      ctx.arc(capX, capY - topHalfOffsetY, capR, -Math.PI, 0);
      ctx.clip();
      ctx.strokeStyle = SK.pencilLight;
      ctx.lineWidth = 2;
      wobblyCircle(ctx, capX, capY - topHalfOffsetY, capR, fc, 1550, 1.5);
      ctx.stroke();
      ctx.restore();

      // Equator line (between halves)
      ctx.strokeStyle = SK.pencil;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(capX - capR + wobbleOffset(fc, 1600, 1), capY + wobbleOffset(fc, 1601, 1));
      wobblyLineTo(ctx, capX - capR, capY, capX + capR, capY, fc, 1602, 1.2);
      ctx.stroke();

      // Prize inside capsule when opened
      if (isOpening || isResult) {
        const prizeAlpha = openT;
        ctx.save();
        ctx.globalAlpha = prizeAlpha;
        drawPrizeDoodle(ctx, resultGrade, capX, capY - topHalfOffsetY * 0.3 + 4, fc, 1700);
        ctx.restore();
      }
    }

    // Knob spin motion marks (only when TURNING state)
    if (isTurning) {
      // Already handled above in knob drawing with motion lines
    }

    // ── Win celebration ────────────────────────────────────────────────────
    if (isResult) {
      if (winAlpha.current < 1) winAlpha.current = Math.min(1, winAlpha.current + 0.025);
      const wa = winAlpha.current;

      // Yellow highlighter background patch
      ctx.save();
      ctx.globalAlpha = wa * 0.38;
      ctx.fillStyle = SK.yellowHL;
      ctx.fillRect(mX + mW * 0.08, mY + mH - 70, mW * 0.84, 36);
      ctx.restore();

      // Large hand-drawn star
      ctx.save();
      ctx.globalAlpha = wa * 0.75;
      ctx.strokeStyle = SK.redPen;
      ctx.lineWidth = 1.8;
      const starCX = mX + mW / 2;
      const starCY = mY + mH - 52;
      const starR = 18;
      const starInner = 7;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? starR : starInner;
        const wx = wobbleOffset(fc, 2000 + i * 4, 2);
        const wy = wobbleOffset(fc, 2001 + i * 4, 2);
        const px = starCX + Math.cos(angle) * rad + wx;
        const py = starCY + Math.sin(angle) * rad + wy;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // "!!" text
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.font = `bold 14px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(mX + mW / 2 + starR + 8, mY + mH - 52);
      ctx.rotate(wobbleOffset(fc, 2100, 0.05));
      ctx.fillText("!!", 0, 0);
      ctx.restore();

      // Grade text in red pen
      ctx.save();
      ctx.globalAlpha = wa;
      drawHandwrittenText(ctx, resultGrade, mX + mW / 2, mY + mH - 28, 12, GRADE_COLOR[resultGrade] ?? SK.redPen, -2);
      ctx.restore();
    } else {
      winAlpha.current = 0;
    }

    // ── Coin insert button / TURN button ───────────────────────────────────
    const isIdle = stateRef.current === "IDLE";
    const canTurn = isIdle || isResult;
    const btnLabel = isResult ? "RESET!" : "INSERT¥";

    const turnBtnX = mX + mW / 2;
    const turnBtnY = mY + mH - 14;

    crossHatch(ctx, turnBtnX - 34 + 4, turnBtnY - 14 + 4, 68, 28, 7, 0.09);
    ctx.strokeStyle = canTurn ? SK.pencil : SK.pencilFaint;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = canTurn ? "rgba(215,235,205,0.50)" : "rgba(200,200,200,0.2)";
    wobblyRect(ctx, turnBtnX - 34, turnBtnY - 14, 68, 28, fc, 2200, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(turnBtnX, turnBtnY);
    ctx.rotate((-1 * Math.PI) / 180);
    ctx.font = `bold 10px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = canTurn ? SK.redPen : SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btnLabel, 0, 0);
    ctx.restore();

    // ── Margin annotations ─────────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.24;

    // "扭一扭 →" annotation pointing to handle bar
    ctx.save();
    ctx.font = `7px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("扭一扭 →", 32, handleBarY + 4);
    ctx.restore();

    // Arrow pointing toward knob
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, handleBarY);
    ctx.lineTo(38, handleBarY);
    ctx.stroke();

    // "capsule!" annotation near dome
    ctx.save();
    ctx.font = `7px "Segoe Script", "Comic Sans MS", cursive`;
    ctx.fillStyle = SK.pencilFaint;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("capsule!", 20, domeTopY + 10);
    ctx.restore();
    // Small arrow pointing right toward dome
    ctx.beginPath();
    ctx.moveTo(28, domeTopY + 6);
    ctx.lineTo(34, domeTopY + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(31, domeTopY + 3);
    ctx.lineTo(34, domeTopY + 6);
    ctx.lineTo(31, domeTopY + 9);
    ctx.stroke();

    // Small spiral doodle at bottom margin
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 4; a += 0.2) {
      const rr = a * 1.8;
      const px = 18 + Math.cos(a) * rr;
      const py = H - 44 + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();

    // ── State label ────────────────────────────────────────────────────────
    const stateLabels: Record<SketchGachaGameState, string> = {
      IDLE:     "idle...",
      TURNING:  "turning!",
      DROPPING: "drop!",
      OPENING:  "open!",
      RESULT:   "tada!",
    };
    const stateColor =
      stateRef.current === "RESULT"   ? SK.redPen :
      stateRef.current === "TURNING"  ? SK.bluePen :
      stateRef.current === "DROPPING" ? SK.gradeB :
      SK.pencilFaint;
    drawHandwrittenText(ctx, stateLabels[stateRef.current], mX + mW - 22, mY + mH - 80, 8, stateColor);

  }, [resultGrade]);

  // ── Animation loop ──────────────────────────────────────────────────────────
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

  // ── Turn sequence ───────────────────────────────────────────────────────────
  const startTurn = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;

    capsuleDrop.current = 0;
    capsuleOpen.current = 0;
    winAlpha.current = 0;
    knobSpinning.current = true;
    changeState("TURNING");

    // Phase 1: knob turns for 800ms
    setTimeout(() => {
      knobSpinning.current = false;
      changeState("DROPPING");

      // Phase 2: capsule drops over 800ms (driven by interval)
      let dropProgress = 0;
      const dropTimer = setInterval(() => {
        dropProgress = Math.min(1, dropProgress + 0.035);
        capsuleDrop.current = dropProgress;
        if (dropProgress >= 1) {
          clearInterval(dropTimer);
          changeState("OPENING");

          // Phase 3: capsule opens over 600ms
          let openProgress = 0;
          const openTimer = setInterval(() => {
            openProgress = Math.min(1, openProgress + 0.04);
            capsuleOpen.current = openProgress;
            if (openProgress >= 1) {
              clearInterval(openTimer);
              changeState("RESULT");
              onResult?.(resultGrade);
            }
          }, 24);
        }
      }, 24);
    }, 800);
  }, [changeState, onResult, resultGrade]);

  const reset = useCallback(() => {
    capsuleDrop.current = 0;
    capsuleOpen.current = 0;
    winAlpha.current = 0;
    knobSpinning.current = false;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ───────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const mX = 44, mY = 16, mW = 200, mH = H - 36;
    const titleY = mY + 22;
    const domeCY = titleY + 30 + mW * 0.38;
    const handleBarY = domeCY + 28;
    const turnBtnY = mY + mH - 14;
    const turnBtnX = mX + mW / 2;

    const knobX = mX + mW - 24 + 16;
    const knobY = handleBarY;

    const distTurnBtn = Math.hypot(nx - turnBtnX, ny - turnBtnY);
    const distKnob = Math.hypot(nx - knobX, ny - knobY);

    if (stateRef.current === "RESULT") {
      reset();
      return;
    }

    if (stateRef.current === "IDLE") {
      if (distTurnBtn < 36 || distKnob < 18) {
        startTurn();
      }
    }
  }, [reset, startTurn]);

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
