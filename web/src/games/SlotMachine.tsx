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
  "B賞": { bg: "#1e3a5f", border: "#3b82f6", text: "#bae6fd", glow: "#3b82f6" },
  "C賞": { bg: "#064e3b", border: "#10b981", text: "#a7f3d0", glow: "#10b981" },
  "D賞": { bg: "#3b0764", border: "#a855f7", text: "#ddd6fe", glow: "#a855f7" },
};

const REEL_SYMBOLS = ["A賞", "C賞", "B賞", "D賞", "A賞", "B賞", "C賞", "D賞"];

const CANVAS_W = 420;
const CANVAS_H = 560;

// Reel geometry — inset into machine body
const REEL_COUNT = 3;
const REEL_W = 82;
const REEL_H = 224;
const REEL_GAP = 8;
const REEL_AREA_X = 46;   // left edge of reel window
const REEL_Y = 138;       // top of reel window
const SYMBOL_H = REEL_H / 5;
const SYMBOL_W = REEL_W;
const STRIP_H = SYMBOL_H * REEL_SYMBOLS.length;

// Machine body geometry
const BODY_X = 18;
const BODY_Y = 80;
const BODY_W = CANVAS_W - 36;
const BODY_H = CANVAS_H - 110;

// Lever geometry
const LEVER_BASE_X = CANVAS_W - 24;
const LEVER_BASE_Y = 195;
const LEVER_ARM_LEN = 82;
const LEVER_KNOB_R = 14;

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Reel Drum 3D Effect
// ─────────────────────────────────────────────────────────────────────────────

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  x: number, y: number, w: number, h: number,
  highlighted: boolean,
  alpha = 1,
  // foreshortening: 0=center (no compress), 1=edge (max compress)
  foreshorten = 0,
) {
  if (!GRADE_COLORS[symbol]) return;
  const col = GRADE_COLORS[symbol]!;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Foreshortening: compress symbol vertically like a cylinder surface
  // Symbols near top/bottom edges appear squished
  const scaleY = 1 - foreshorten * 0.38;
  const centerY = y + h / 2;
  ctx.transform(1, 0, 0, scaleY, 0, centerY * (1 - scaleY));

  // Symbol background
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, highlighted ? lightenHex(col.bg, 40) : lightenHex(col.bg, 10));
  bgGrad.addColorStop(0.5, highlighted ? lightenHex(col.bg, 20) : col.bg);
  bgGrad.addColorStop(1, col.bg);
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 3, w - 8, h - 6, 8);
  ctx.fill();

  // Gloss shine on top half
  const shineGrad = ctx.createLinearGradient(x + 4, y + 3, x + 4, y + (h - 6) * 0.55);
  shineGrad.addColorStop(0, highlighted ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 3, w - 8, (h - 6) * 0.55, [8, 8, 0, 0]);
  ctx.fill();

  // Border
  ctx.strokeStyle = highlighted ? col.border : `${col.border}55`;
  ctx.lineWidth = highlighted ? 2 : 0.8;
  if (highlighted) {
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 16;
  }
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 3, w - 8, h - 6, 8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grade label
  ctx.fillStyle = highlighted ? col.text : `${col.text}99`;
  ctx.shadowColor = highlighted ? col.glow : "transparent";
  ctx.shadowBlur = highlighted ? 8 : 0;
  ctx.font = `bold ${highlighted ? 17 : 14}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x + w / 2, y + h / 2);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawReel(
  ctx: CanvasRenderingContext2D,
  reelIndex: number,
  offset: number,
  stopped: boolean,
  resultSymbol: string,
  t: number,
  isResult: boolean,
  flashPhase: number,
) {
  const rx = REEL_AREA_X + reelIndex * (REEL_W + REEL_GAP);
  const ry = REEL_Y;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, REEL_W, REEL_H);
  ctx.clip();

  // Reel background — deep dark with subtle blue tint
  const reelBg = ctx.createLinearGradient(rx, ry, rx + REEL_W, ry);
  reelBg.addColorStop(0, "#08031a");
  reelBg.addColorStop(0.5, "#0d0525");
  reelBg.addColorStop(1, "#08031a");
  ctx.fillStyle = reelBg;
  ctx.fillRect(rx, ry, REEL_W, REEL_H);

  const normalizedOffset = ((offset % STRIP_H) + STRIP_H) % STRIP_H;
  const startSymbolFloat = normalizedOffset / SYMBOL_H;
  const startSymbol = Math.floor(startSymbolFloat);
  const subOffset = (startSymbolFloat - startSymbol) * SYMBOL_H;

  // Center of the reel window (for foreshortening calculation)
  const reelCenterY = ry + REEL_H / 2;

  for (let i = -1; i <= 6; i++) {
    const symIdx = ((startSymbol + i) % REEL_SYMBOLS.length + REEL_SYMBOLS.length) % REEL_SYMBOLS.length;
    const sym = REEL_SYMBOLS[symIdx] ?? "D賞";
    const symY = ry + i * SYMBOL_H - subOffset;
    const localY = symY - ry;
    const symCenterY = symY + SYMBOL_H / 2;

    // Alpha fade at top/bottom edges
    const edge = SYMBOL_H * 0.55;
    let alpha = 1;
    if (localY < edge) alpha = Math.max(0.1, localY / edge);
    if (localY > REEL_H - edge) alpha = Math.max(0.1, (REEL_H - localY) / edge);

    // Foreshortening: distance of symbol center from reel center, normalized 0-1
    const distFromCenter = Math.abs(symCenterY - reelCenterY) / (REEL_H * 0.5);
    const foreshorten = Math.min(1, distFromCenter * 1.1);

    const isCenter = i === 2 && stopped && Math.abs(subOffset) < 3;
    drawSymbol(ctx, sym, rx, symY, SYMBOL_W, SYMBOL_H, isCenter, alpha, foreshorten);
  }

  // Win row flash effect (alternating color strobe)
  if (isResult && stopped && flashPhase > 0) {
    const strobeOn = Math.sin(t * 18) > 0;
    const centerRowY = ry + SYMBOL_H * 2;
    if (strobeOn) {
      ctx.fillStyle = `rgba(251,191,36,${flashPhase * 0.25})`;
      ctx.fillRect(rx, centerRowY, REEL_W, SYMBOL_H);
    } else {
      ctx.fillStyle = `rgba(255,255,255,${flashPhase * 0.08})`;
      ctx.fillRect(rx, centerRowY, REEL_W, SYMBOL_H);
    }
  }

  ctx.restore();

  // Motion blur vertical lines when spinning fast
  if (!stopped && offset > 30) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, REEL_W, REEL_H);
    ctx.clip();
    // Vertical streak lines for motion blur effect
    for (let li = 0; li < 5; li++) {
      const lx = rx + (REEL_W / 5) * li + REEL_W / 10;
      const blurGrad = ctx.createLinearGradient(lx, ry, lx, ry + REEL_H);
      blurGrad.addColorStop(0, "rgba(180,150,255,0)");
      blurGrad.addColorStop(0.3, "rgba(180,150,255,0.04)");
      blurGrad.addColorStop(0.5, "rgba(180,150,255,0.07)");
      blurGrad.addColorStop(0.7, "rgba(180,150,255,0.04)");
      blurGrad.addColorStop(1, "rgba(180,150,255,0)");
      ctx.fillStyle = blurGrad;
      ctx.fillRect(lx - 1, ry, 2, REEL_H);
    }
    ctx.restore();
  }

  // Drum curvature overlay gradient (darker at top/bottom edges, bright at center)
  // This is the KEY 3D drum effect — simulates a curved cylindrical surface
  const drumGrad = ctx.createLinearGradient(rx, ry, rx, ry + REEL_H);
  drumGrad.addColorStop(0,    "rgba(0,0,0,0.62)");
  drumGrad.addColorStop(0.12, "rgba(0,0,0,0.32)");
  drumGrad.addColorStop(0.28, "rgba(0,0,0,0.08)");
  drumGrad.addColorStop(0.45, "rgba(255,255,255,0.03)");
  drumGrad.addColorStop(0.5,  "rgba(255,255,255,0.06)");  // brightest at center
  drumGrad.addColorStop(0.55, "rgba(255,255,255,0.03)");
  drumGrad.addColorStop(0.72, "rgba(0,0,0,0.08)");
  drumGrad.addColorStop(0.88, "rgba(0,0,0,0.32)");
  drumGrad.addColorStop(1,    "rgba(0,0,0,0.62)");
  ctx.fillStyle = drumGrad;
  ctx.fillRect(rx, ry, REEL_W, REEL_H);

  // Center active row highlight strip — glowing line above and below the win row
  if (stopped) {
    const centerRowY = ry + SYMBOL_H * 2;
    // Top bright line
    const topLineGrad = ctx.createLinearGradient(rx, centerRowY - 1, rx + REEL_W, centerRowY - 1);
    topLineGrad.addColorStop(0, "rgba(251,191,36,0)");
    topLineGrad.addColorStop(0.2, "rgba(251,191,36,0.6)");
    topLineGrad.addColorStop(0.5, "rgba(255,255,200,0.9)");
    topLineGrad.addColorStop(0.8, "rgba(251,191,36,0.6)");
    topLineGrad.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = topLineGrad;
    ctx.fillRect(rx, centerRowY - 1, REEL_W, 2);
    // Bottom bright line
    ctx.fillStyle = topLineGrad;
    ctx.fillRect(rx, centerRowY + SYMBOL_H - 1, REEL_W, 2);
  }

  // Idle reel window hum glow: pulsing inner shadow (ambient life)
  if (!stopped) {
    const humPhase = 0.04 + Math.sin(t * 1.8 + reelIndex * 1.1) * 0.02;
    const humGrad = ctx.createLinearGradient(rx, ry, rx + REEL_W, ry);
    humGrad.addColorStop(0, `rgba(109,40,217,${humPhase})`);
    humGrad.addColorStop(0.5, "rgba(109,40,217,0)");
    humGrad.addColorStop(1, `rgba(109,40,217,${humPhase})`);
    ctx.fillStyle = humGrad;
    ctx.fillRect(rx, ry, REEL_W, REEL_H);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Machine Chrome Details
// ─────────────────────────────────────────────────────────────────────────────

function drawChromeRivet(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Outer chrome ring
  const ringGrad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 8);
  ringGrad.addColorStop(0, "#d1d5db");
  ringGrad.addColorStop(0.4, "#9ca3af");
  ringGrad.addColorStop(0.7, "#4b5563");
  ringGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();

  // Inner recess
  const innerGrad = ctx.createRadialGradient(cx + 1.5, cy + 1.5, 0.5, cx, cy, 4.5);
  innerGrad.addColorStop(0, "#6b7280");
  innerGrad.addColorStop(0.5, "#374151");
  innerGrad.addColorStop(1, "#111827");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight dot
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(cx - 1.5, cy - 1.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawChromeReelWindowFrame(ctx: CanvasRenderingContext2D) {
  const frameX = REEL_AREA_X - 10;
  const frameY = REEL_Y - 10;
  const frameW = REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 20;
  const frameH = REEL_H + 20;

  // Deep inset shadow behind frame
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#04020e";
  drawRoundedRectPath(ctx, frameX, frameY, frameW, frameH, 10);
  ctx.fill();
  ctx.restore();

  // Chrome frame — reflective metallic gradient border
  // Top edge: brightest (catches overhead light)
  const chromeBorder = 6;

  // Top chrome strip
  const topChrome = ctx.createLinearGradient(frameX, frameY, frameX, frameY + chromeBorder);
  topChrome.addColorStop(0, "#e5e7eb");
  topChrome.addColorStop(0.4, "#9ca3af");
  topChrome.addColorStop(1, "#4b5563");
  ctx.fillStyle = topChrome;
  ctx.fillRect(frameX, frameY, frameW, chromeBorder);

  // Bottom chrome strip (slightly darker)
  const botChrome = ctx.createLinearGradient(frameX, frameY + frameH - chromeBorder, frameX, frameY + frameH);
  botChrome.addColorStop(0, "#374151");
  botChrome.addColorStop(0.6, "#6b7280");
  botChrome.addColorStop(1, "#9ca3af");
  ctx.fillStyle = botChrome;
  ctx.fillRect(frameX, frameY + frameH - chromeBorder, frameW, chromeBorder);

  // Left chrome strip
  const leftChrome = ctx.createLinearGradient(frameX, frameY, frameX + chromeBorder, frameY);
  leftChrome.addColorStop(0, "#d1d5db");
  leftChrome.addColorStop(1, "#4b5563");
  ctx.fillStyle = leftChrome;
  ctx.fillRect(frameX, frameY, chromeBorder, frameH);

  // Right chrome strip
  const rightChrome = ctx.createLinearGradient(frameX + frameW - chromeBorder, frameY, frameX + frameW, frameY);
  rightChrome.addColorStop(0, "#4b5563");
  rightChrome.addColorStop(1, "#d1d5db");
  ctx.fillStyle = rightChrome;
  ctx.fillRect(frameX + frameW - chromeBorder, frameY, chromeBorder, frameH);

  // Chrome inset highlight line (top-left inner edge catches light)
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(frameX + chromeBorder, frameY + frameH - chromeBorder);
  ctx.lineTo(frameX + chromeBorder, frameY + chromeBorder);
  ctx.lineTo(frameX + frameW - chromeBorder, frameY + chromeBorder);
  ctx.stroke();

  // Dark shadow line (bottom-right inner)
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(frameX + chromeBorder, frameY + frameH - chromeBorder);
  ctx.lineTo(frameX + frameW - chromeBorder, frameY + frameH - chromeBorder);
  ctx.lineTo(frameX + frameW - chromeBorder, frameY + chromeBorder);
  ctx.stroke();
}

function drawVentGrills(ctx: CanvasRenderingContext2D) {
  // Left side panel vent grills
  const ventX = BODY_X + 6;
  const ventStartY = REEL_Y + REEL_H + 36;
  const ventW = 22;
  const ventLines = 5;

  for (let i = 0; i < ventLines; i++) {
    const vy = ventStartY + i * 9;
    // Vent slot shadow (top edge)
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ventX + 2, vy + 1);
    ctx.lineTo(ventX + ventW - 2, vy + 1);
    ctx.stroke();
    // Vent slot highlight (bottom edge)
    ctx.strokeStyle = "rgba(120,100,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ventX + 2, vy + 3);
    ctx.lineTo(ventX + ventW - 2, vy + 3);
    ctx.stroke();
  }

  // Right side panel vent grills
  const rightVentX = BODY_X + BODY_W - 28;
  for (let i = 0; i < ventLines; i++) {
    const vy = ventStartY + i * 9;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightVentX + 2, vy + 1);
    ctx.lineTo(rightVentX + ventW - 2, vy + 1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,100,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightVentX + 2, vy + 3);
    ctx.lineTo(rightVentX + ventW - 2, vy + 3);
    ctx.stroke();
  }
}

function drawManufacturerPlate(ctx: CanvasRenderingContext2D) {
  const plateW = 140;
  const plateH = 18;
  const plateX = CANVAS_W / 2 - plateW / 2;
  const plateY = BODY_Y + BODY_H - 30;

  // Plate background — brushed metal
  const plateGrad = ctx.createLinearGradient(plateX, plateY, plateX, plateY + plateH);
  plateGrad.addColorStop(0, "#374151");
  plateGrad.addColorStop(0.3, "#4b5563");
  plateGrad.addColorStop(0.7, "#374151");
  plateGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = plateGrad;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 3);
  ctx.fill();

  // Plate border
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 3);
  ctx.stroke();

  // Tiny rivet dots on plate
  const plateDotColor = "#9ca3af";
  for (const dotX of [plateX + 5, plateX + plateW - 5]) {
    ctx.fillStyle = plateDotColor;
    ctx.beginPath();
    ctx.arc(dotX, plateY + plateH / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(dotX - 0.5, plateY + plateH / 2 - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Plate text
  ctx.fillStyle = "#d1d5db";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PrizeDraw Co. Ltd.", CANVAS_W / 2, plateY + plateH / 2);
}

function drawMachineBody(ctx: CanvasRenderingContext2D, t: number) {
  const sideDepth = 16;

  // Right side face
  const rightFaceGrad = ctx.createLinearGradient(BODY_X + BODY_W, BODY_Y, BODY_X + BODY_W + sideDepth, BODY_Y + BODY_H);
  rightFaceGrad.addColorStop(0, "#1a1035");
  rightFaceGrad.addColorStop(1, "#0d0820");
  ctx.fillStyle = rightFaceGrad;
  ctx.beginPath();
  ctx.moveTo(BODY_X + BODY_W, BODY_Y + 12);
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_Y + 12 - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_Y + BODY_H - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W, BODY_Y + BODY_H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3730a3";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bottom face
  const bottomFaceGrad = ctx.createLinearGradient(BODY_X, BODY_Y + BODY_H, BODY_X, BODY_Y + BODY_H + sideDepth);
  bottomFaceGrad.addColorStop(0, "#160e30");
  bottomFaceGrad.addColorStop(1, "#0a0618");
  ctx.fillStyle = bottomFaceGrad;
  ctx.beginPath();
  ctx.moveTo(BODY_X, BODY_Y + BODY_H);
  ctx.lineTo(BODY_X + BODY_W, BODY_Y + BODY_H);
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_Y + BODY_H - sideDepth * 0.5);
  ctx.lineTo(BODY_X + sideDepth, BODY_Y + BODY_H - sideDepth * 0.5);
  ctx.closePath();
  ctx.fill();

  // Main front face body
  const bodyGrad = ctx.createLinearGradient(BODY_X, BODY_Y, BODY_X + BODY_W, BODY_Y + BODY_H);
  bodyGrad.addColorStop(0, "#2d1f5e");
  bodyGrad.addColorStop(0.3, "#1e1245");
  bodyGrad.addColorStop(0.7, "#1a0f3d");
  bodyGrad.addColorStop(1, "#0f0825");
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = "#6d28d9";
  ctx.shadowBlur = 22;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Bevel highlight (top-left)
  const bevelGrad = ctx.createLinearGradient(BODY_X, BODY_Y, BODY_X + 70, BODY_Y + 70);
  bevelGrad.addColorStop(0, "rgba(180,150,255,0.28)");
  bevelGrad.addColorStop(1, "rgba(180,150,255,0)");
  ctx.fillStyle = bevelGrad;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.fill();

  // Frame border
  ctx.strokeStyle = "#4c1d95";
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.stroke();

  // Inner trim line
  ctx.strokeStyle = "rgba(139,92,246,0.3)";
  ctx.lineWidth = 1;
  drawRoundedRectPath(ctx, BODY_X + 4, BODY_Y + 4, BODY_W - 8, BODY_H - 8, 13);
  ctx.stroke();

  // 2. Chrome corner rivets at 4 corners of machine face
  const rivetInset = 16;
  drawChromeRivet(ctx, BODY_X + rivetInset, BODY_Y + rivetInset);
  drawChromeRivet(ctx, BODY_X + BODY_W - rivetInset, BODY_Y + rivetInset);
  drawChromeRivet(ctx, BODY_X + rivetInset, BODY_Y + BODY_H - rivetInset);
  drawChromeRivet(ctx, BODY_X + BODY_W - rivetInset, BODY_Y + BODY_H - rivetInset);

  // Frame lights (animated chase pattern)
  drawFrameLights(ctx, t);

  // Jackpot display
  drawJackpotDisplay(ctx, t);

  // Coin slot
  drawCoinSlot(ctx);

  // Chrome reel window frame
  drawChromeReelWindowFrame(ctx);

  // Vent grills on sides
  drawVentGrills(ctx);

  // Manufacturer plate
  drawManufacturerPlate(ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame lights — slow idle chase + rapid chase on win
// ─────────────────────────────────────────────────────────────────────────────

function drawFrameLights(ctx: CanvasRenderingContext2D, t: number, winMode = false) {
  const lightColors = ["#f59e0b", "#ec4899", "#38bdf8", "#34d399", "#a78bfa", "#fb923c"];
  const positions: { x: number; y: number }[] = [];

  // Top edge
  for (let i = 0; i < 9; i++) {
    positions.push({ x: BODY_X + 18 + i * (BODY_W - 36) / 8, y: BODY_Y + 8 });
  }
  // Right edge
  for (let i = 1; i < 5; i++) {
    positions.push({ x: BODY_X + BODY_W - 8, y: BODY_Y + 20 + i * (BODY_H - 40) / 5 });
  }
  // Bottom edge (reversed so chase goes around)
  for (let i = 8; i >= 0; i--) {
    positions.push({ x: BODY_X + 18 + i * (BODY_W - 36) / 8, y: BODY_Y + BODY_H - 8 });
  }
  // Left edge (reversed)
  for (let i = 4; i >= 1; i--) {
    positions.push({ x: BODY_X + 8, y: BODY_Y + 20 + i * (BODY_H - 40) / 5 });
  }

  const totalLights = positions.length;
  // Chase speed: slow idle = 0.6 lights/s, win mode = 6 lights/s
  const chaseSpeed = winMode ? 14 : 0.7;
  const chasePos = (t * chaseSpeed) % totalLights;
  // Width of the bright "hot spot" in the chase
  const hotWidth = winMode ? 3 : 2;

  for (let i = 0; i < totalLights; i++) {
    const pos = positions[i];
    if (!pos) continue;
    const color = lightColors[i % lightColors.length] ?? "#fbbf24";

    // Distance of this light from the hot spot (circular)
    const dist = Math.min(
      Math.abs(i - chasePos),
      Math.abs(i - chasePos + totalLights),
      Math.abs(i - chasePos - totalLights),
    );

    // Brightness: bright near hot spot, dim elsewhere
    const brightness = Math.max(0, 1 - dist / hotWidth);
    // Base ambient glow even when not in hot spot
    const ambient = winMode ? 0.25 : 0.18;
    const finalBrightness = ambient + brightness * (1 - ambient);

    ctx.save();
    if (finalBrightness > 0.5) {
      ctx.shadowColor = color;
      ctx.shadowBlur = winMode ? 12 : 8;
    }
    ctx.globalAlpha = finalBrightness;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Extra bright center dot for hot lights
    if (finalBrightness > 0.8) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jackpot display — ambient scroll/fade cycle
// ─────────────────────────────────────────────────────────────────────────────

function drawJackpotDisplay(ctx: CanvasRenderingContext2D, t: number) {
  const dispX = BODY_X + 20;
  const dispY = BODY_Y + 18;
  const dispW = BODY_W - 40;
  const dispH = 46;

  // Dark screen background
  const screenGrad = ctx.createLinearGradient(dispX, dispY, dispX, dispY + dispH);
  screenGrad.addColorStop(0, "#0a0520");
  screenGrad.addColorStop(1, "#05010f");
  ctx.fillStyle = screenGrad;
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 1.5;
  drawRoundedRectPath(ctx, dispX, dispY, dispW, dispH, 6);
  ctx.fill();
  ctx.stroke();

  // Inset shadow lines
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dispX + 2, dispY + dispH - 2);
  ctx.lineTo(dispX + 2, dispY + 2);
  ctx.lineTo(dispX + dispW - 2, dispY + 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(dispX + 2, dispY + dispH - 2);
  ctx.lineTo(dispX + dispW - 2, dispY + dispH - 2);
  ctx.lineTo(dispX + dispW - 2, dispY + 2);
  ctx.stroke();

  // PRIZE DRAW text — scrolling marquee effect with shimmer sweep
  // Shimmer: a bright vertical band sweeps left-to-right periodically
  const shimmerX = ((t * 0.4) % 1.6) * (dispW + 40) - 20; // sweeps across every ~4s

  ctx.save();
  ctx.beginPath();
  drawRoundedRectPath(ctx, dispX + 2, dispY + 2, dispW - 4, dispH - 4, 4);
  ctx.clip();

  // Base text gradient
  const textGrad = ctx.createLinearGradient(dispX, dispY, dispX + dispW, dispY);
  textGrad.addColorStop(0, "#d97706");
  textGrad.addColorStop(0.35, "#f59e0b");
  textGrad.addColorStop(0.5, "#fde68a");
  textGrad.addColorStop(0.65, "#f59e0b");
  textGrad.addColorStop(1, "#d97706");

  const pulse = 0.78 + Math.sin(t * 3.2) * 0.22;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = textGrad;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 10;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PRIZE DRAW", CANVAS_W / 2, dispY + dispH * 0.37);

  // Shimmer band overlay
  ctx.globalAlpha = 0.35;
  const shimmerGrad = ctx.createLinearGradient(shimmerX - 15, dispY, shimmerX + 15, dispY);
  shimmerGrad.addColorStop(0, "rgba(255,255,255,0)");
  shimmerGrad.addColorStop(0.5, "rgba(255,255,255,0.9)");
  shimmerGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shimmerGrad;
  ctx.fillRect(shimmerX - 15, dispY, 30, dispH);

  ctx.restore();

  // Subtitle with fade cycle
  const subFade = 0.5 + Math.sin(t * 1.5 + 1.0) * 0.3;
  ctx.globalAlpha = subFade;
  ctx.fillStyle = "#a78bfa";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("一番賞  SLOT MACHINE", CANVAS_W / 2, dispY + dispH * 0.72);
  ctx.globalAlpha = 1;
}

function drawCoinSlot(ctx: CanvasRenderingContext2D) {
  const slotX = CANVAS_W / 2 - 18;
  const slotY = BODY_Y - 22;
  const slotW = 36;
  const slotH = 20;

  const slotGrad = ctx.createLinearGradient(slotX, slotY, slotX + slotW, slotY + slotH);
  slotGrad.addColorStop(0, "#374151");
  slotGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = slotGrad;
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1.5;
  drawRoundedRectPath(ctx, slotX, slotY, slotW, slotH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#030712";
  ctx.beginPath();
  ctx.roundRect(slotX + 8, slotY + 7, slotW - 16, 6, 2);
  ctx.fill();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COIN", CANVAS_W / 2, slotY + 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lever — chrome shaft, 3D ball, motion blur
// ─────────────────────────────────────────────────────────────────────────────

function drawLever(
  ctx: CanvasRenderingContext2D,
  leverAngle: number,
  leverVelocity: number,
  t: number,
  isInteractable: boolean,
) {
  const baseX = LEVER_BASE_X;
  const baseY = LEVER_BASE_Y;

  // Mount bracket — chrome
  const mountGrad = ctx.createLinearGradient(baseX - 14, baseY - 8, baseX + 2, baseY + 8);
  mountGrad.addColorStop(0, "#9ca3af");
  mountGrad.addColorStop(0.3, "#d1d5db");
  mountGrad.addColorStop(0.6, "#6b7280");
  mountGrad.addColorStop(1, "#374151");
  ctx.fillStyle = mountGrad;
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(baseX - 16, baseY - 9, 18, 18, 4);
  ctx.fill();
  ctx.stroke();

  // Mount highlight
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.roundRect(baseX - 15, baseY - 8, 8, 4, 2);
  ctx.fill();

  // Pivot pin
  const pinGrad = ctx.createRadialGradient(baseX - 7, baseY - 1, 1, baseX - 6, baseY, 5);
  pinGrad.addColorStop(0, "#f3f4f6");
  pinGrad.addColorStop(0.4, "#9ca3af");
  pinGrad.addColorStop(1, "#374151");
  ctx.fillStyle = pinGrad;
  ctx.beginPath();
  ctx.arc(baseX - 6, baseY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.stroke();

  const armAngle = -Math.PI / 2 + leverAngle;
  const armEndX = baseX - 6 + Math.cos(armAngle) * LEVER_ARM_LEN;
  const armEndY = baseY + Math.sin(armAngle) * LEVER_ARM_LEN;

  // Motion blur when moving fast (lever in motion)
  const absVel = Math.abs(leverVelocity);
  if (absVel > 0.03) {
    const blurSteps = 4;
    for (let b = 1; b <= blurSteps; b++) {
      const blurAngle = armAngle + (leverVelocity * b * 0.9);
      const blurEndX = baseX - 6 + Math.cos(blurAngle) * LEVER_ARM_LEN;
      const blurEndY = baseY + Math.sin(blurAngle) * LEVER_ARM_LEN;
      ctx.save();
      ctx.globalAlpha = (absVel * 3) * (1 - b / (blurSteps + 1)) * 0.25;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 6 - b;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(baseX - 6, baseY);
      ctx.lineTo(blurEndX, blurEndY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Arm drop shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX - 6 + 2.5, baseY + 2.5);
  ctx.lineTo(armEndX + 2.5, armEndY + 2.5);
  ctx.stroke();
  ctx.restore();

  // Arm — chrome metallic gradient (not flat red)
  // The perpendicular gradient across the arm gives it a tubular look
  const armLen = Math.hypot(armEndX - (baseX - 6), armEndY - baseY);
  const perpAngle = armAngle + Math.PI / 2;
  const chromeMidX = (baseX - 6 + armEndX) / 2;
  const chromeMidY = (baseY + armEndY) / 2;
  const armChromeGrad = ctx.createLinearGradient(
    chromeMidX + Math.cos(perpAngle) * 5, chromeMidY + Math.sin(perpAngle) * 5,
    chromeMidX - Math.cos(perpAngle) * 5, chromeMidY - Math.sin(perpAngle) * 5,
  );
  armChromeGrad.addColorStop(0, "#b91c1c");
  armChromeGrad.addColorStop(0.2, "#ef4444");
  armChromeGrad.addColorStop(0.45, "#fca5a5");
  armChromeGrad.addColorStop(0.55, "#fca5a5");
  armChromeGrad.addColorStop(0.8, "#dc2626");
  armChromeGrad.addColorStop(1, "#7f1d1d");
  ctx.strokeStyle = armChromeGrad;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.lineTo(armEndX, armEndY);
  ctx.stroke();

  // Specular highlight along the arm
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.lineTo(armEndX, armEndY);
  ctx.stroke();

  // Ball handle — large 3D sphere with proper highlight, shadow, and reflection
  const knobR = LEVER_KNOB_R;
  // Shadow beneath the ball
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#7f1d1d";
  ctx.beginPath();
  ctx.arc(armEndX, armEndY, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main sphere fill — deep red to dark
  const sphereGrad = ctx.createRadialGradient(
    armEndX - knobR * 0.3, armEndY - knobR * 0.3, knobR * 0.05,
    armEndX + knobR * 0.1, armEndY + knobR * 0.2, knobR * 1.1,
  );
  sphereGrad.addColorStop(0, "#fee2e2");  // bright top-left catch light
  sphereGrad.addColorStop(0.18, "#f87171");
  sphereGrad.addColorStop(0.45, "#ef4444");
  sphereGrad.addColorStop(0.72, "#b91c1c");
  sphereGrad.addColorStop(0.88, "#7f1d1d");
  sphereGrad.addColorStop(1, "#450a0a");
  ctx.fillStyle = sphereGrad;
  ctx.strokeStyle = "#450a0a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(armEndX, armEndY, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Primary specular highlight (bright spot)
  const hiGrad = ctx.createRadialGradient(
    armEndX - knobR * 0.35, armEndY - knobR * 0.38, 0.5,
    armEndX - knobR * 0.25, armEndY - knobR * 0.28, knobR * 0.52,
  );
  hiGrad.addColorStop(0, "rgba(255,255,255,0.92)");
  hiGrad.addColorStop(0.5, "rgba(255,255,255,0.4)");
  hiGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hiGrad;
  ctx.beginPath();
  ctx.arc(armEndX, armEndY, knobR, 0, Math.PI * 2);
  ctx.fill();

  // Secondary reflected light (bottom rim, simulates floor bounce)
  const reflectGrad = ctx.createRadialGradient(
    armEndX + knobR * 0.3, armEndY + knobR * 0.55, 0.5,
    armEndX + knobR * 0.2, armEndY + knobR * 0.45, knobR * 0.5,
  );
  reflectGrad.addColorStop(0, "rgba(255,160,160,0.35)");
  reflectGrad.addColorStop(1, "rgba(255,160,160,0)");
  ctx.fillStyle = reflectGrad;
  ctx.beginPath();
  ctx.arc(armEndX, armEndY, knobR, 0, Math.PI * 2);
  ctx.fill();

  // Glow ring when interactable (pulsing)
  if (isInteractable) {
    const glowPulse = 0.45 + Math.sin(t * 3.2) * 0.35;
    ctx.save();
    ctx.globalAlpha = glowPulse;
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(armEndX, armEndY, knobR + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // PULL label
  ctx.fillStyle = isInteractable ? "#fca5a5" : "#6b7280";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("PULL", baseX - 6, baseY + 14);
}

function drawWinLine(ctx: CanvasRenderingContext2D, t: number) {
  const winY = REEL_Y + SYMBOL_H * 2;
  const lineX = REEL_AREA_X - 12;
  const lineW = REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 24;

  const pulse = 0.4 + Math.sin(t * 5) * 0.2;
  ctx.strokeStyle = `rgba(251,191,36,${pulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lineX, winY);
  ctx.lineTo(lineX + lineW, winY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lineX, winY + SYMBOL_H);
  ctx.lineTo(lineX + lineW, winY + SYMBOL_H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = `rgba(251,191,36,${pulse})`;
  ctx.beginPath();
  ctx.moveTo(lineX - 4, winY + SYMBOL_H / 2 - 6);
  ctx.lineTo(lineX + 4, winY + SYMBOL_H / 2);
  ctx.lineTo(lineX - 4, winY + SYMBOL_H / 2 + 6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(lineX + lineW + 4, winY + SYMBOL_H / 2 - 6);
  ctx.lineTo(lineX + lineW - 4, winY + SYMBOL_H / 2);
  ctx.lineTo(lineX + lineW + 4, winY + SYMBOL_H / 2 + 6);
  ctx.closePath();
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Win Celebration — strobe, chase lights, rays, coin waterfall
// ─────────────────────────────────────────────────────────────────────────────

function drawResultBanner(
  ctx: CanvasRenderingContext2D,
  resultGrade: string,
  prizeName: string | undefined,
  t: number,
) {
  const col = GRADE_COLORS[resultGrade] ?? GRADE_COLORS["D賞"]!;
  const bannerY = REEL_Y + REEL_H + 18;
  const bannerW = BODY_W - 40;
  const bannerX = BODY_X + 20;
  const bannerH = 50;

  ctx.save();
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = 22 + Math.sin(t * 4) * 7;

  const bannerGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY);
  bannerGrad.addColorStop(0, col.bg);
  bannerGrad.addColorStop(0.4, lightenHex(col.bg, 28));
  bannerGrad.addColorStop(0.6, lightenHex(col.bg, 28));
  bannerGrad.addColorStop(1, col.bg);
  ctx.fillStyle = bannerGrad;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = col.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
  ctx.stroke();

  const shineGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH * 0.5);
  shineGrad.addColorStop(0, "rgba(255,255,255,0.14)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH * 0.5, [10, 10, 0, 0]);
  ctx.fill();

  ctx.fillStyle = col.text;
  ctx.font = `bold ${resultGrade === "A賞" ? 19 : 16}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = resultGrade === "A賞"
    ? `JACKPOT  ${resultGrade}  ${prizeName ?? "大獎"}`
    : `${resultGrade}  ${prizeName ?? ""}`;
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = 10;
  ctx.fillText(label, CANVAS_W / 2, bannerY + bannerH / 2);
  ctx.shadowBlur = 0;
}

// Gold rays emanating from center (A賞 jackpot only)
function drawJackpotRays(ctx: CanvasRenderingContext2D, t: number) {
  const cx = CANVAS_W / 2;
  const cy = REEL_Y + REEL_H / 2;
  const rayCount = 18;
  const rayLen = 180;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + t * 0.4;
    const brightness = 0.04 + Math.sin(t * 2 + i * 0.7) * 0.02;
    const rayGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
    rayGrad.addColorStop(0, `rgba(251,191,36,${brightness * 6})`);
    rayGrad.addColorStop(0.5, `rgba(251,191,36,${brightness * 2})`);
    rayGrad.addColorStop(1, "rgba(251,191,36,0)");
    ctx.strokeStyle = rayGrad;
    ctx.lineWidth = 6 + Math.sin(t * 3 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
    ctx.stroke();
  }
  ctx.restore();
}

// JACKPOT text — pulsing scale animation
function drawJackpotOverlay(ctx: CanvasRenderingContext2D, t: number) {
  const cx = CANVAS_W / 2;
  const cy = REEL_Y - 42;
  const scalePulse = 1 + Math.sin(t * 6) * 0.12;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scalePulse, scalePulse);

  const alpha = 0.75 + Math.sin(t * 6) * 0.25;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 25;

  const jackGrad = ctx.createLinearGradient(-70, -16, 70, 16);
  jackGrad.addColorStop(0, "#d97706");
  jackGrad.addColorStop(0.3, "#fde68a");
  jackGrad.addColorStop(0.5, "#ffffff");
  jackGrad.addColorStop(0.7, "#fde68a");
  jackGrad.addColorStop(1, "#d97706");
  ctx.fillStyle = jackGrad;
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("JACKPOT!", 0, 0);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Particles — confetti + coin waterfall
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; rotation: number;
  type: "confetti" | "coin";
  label?: string;
}

function spawnConfetti(count: number): Particle[] {
  const colors = ["#f59e0b", "#fde68a", "#fbbf24", "#fff", "#fb923c", "#f472b6"];
  return Array.from({ length: count }, () => ({
    x: CANVAS_W / 2 + (Math.random() - 0.5) * 200,
    y: REEL_Y + REEL_H / 2 + (Math.random() - 0.5) * 120,
    vx: (Math.random() - 0.5) * 7,
    vy: -Math.random() * 10 - 3,
    life: 1,
    maxLife: 0.5 + Math.random() * 0.9,
    size: 3 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)] ?? "#f59e0b",
    rotation: Math.random() * Math.PI * 2,
    type: "confetti" as const,
  }));
}

function spawnCoins(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: BODY_X + 30 + Math.random() * (BODY_W - 60),
    y: BODY_Y + BODY_H - 10,
    vx: (Math.random() - 0.5) * 3,
    vy: -(Math.random() * 5 + 4),
    life: 1,
    maxLife: 0.6 + Math.random() * 0.8,
    size: 6 + Math.random() * 5,
    color: "#f59e0b",
    rotation: Math.random() * Math.PI * 2,
    type: "coin" as const,
    label: Math.random() > 0.5 ? "P" : "$",
  }));
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;

    if (p.type === "coin") {
      // Gold coin: ellipse (foreshortened circle) with "$"/"P"
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 8;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Coin body
      const coinGrad = ctx.createRadialGradient(-p.size * 0.25, -p.size * 0.25, 1, 0, 0, p.size);
      coinGrad.addColorStop(0, "#fde68a");
      coinGrad.addColorStop(0.5, "#f59e0b");
      coinGrad.addColorStop(1, "#92400e");
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Coin rim
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Coin label
      ctx.fillStyle = "#92400e";
      ctx.font = `bold ${Math.max(6, p.size * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label ?? "P", 0, 0);

      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(-p.size * 0.2, -p.size * 0.2, p.size * 0.3, p.size * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Confetti diamond
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      const s = p.size * p.life;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ambient sparkles on chrome
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number; life: number; size: number; angle: number;
}

function drawSparkles(ctx: CanvasRenderingContext2D, sparkles: Sparkle[]) {
  for (const sp of sparkles) {
    const alpha = Math.sin(sp.life * Math.PI);
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sp.angle);
    // 4-pointed star sparkle
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#d1d5db";
    ctx.shadowBlur = 4;
    const s = sp.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.15, -s * 0.15);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.15, s * 0.15);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.15, s * 0.15);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.15, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Chrome surface points where sparkles can appear
const CHROME_SPARKLE_POINTS = [
  // Rivet areas
  { x: BODY_X + 16, y: BODY_Y + 16 },
  { x: BODY_X + BODY_W - 16, y: BODY_Y + 16 },
  { x: BODY_X + 16, y: BODY_Y + BODY_H - 16 },
  { x: BODY_X + BODY_W - 16, y: BODY_Y + BODY_H - 16 },
  // Reel window frame edges
  { x: REEL_AREA_X - 8, y: REEL_Y - 8 },
  { x: REEL_AREA_X + REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 8, y: REEL_Y - 8 },
  { x: REEL_AREA_X - 8, y: REEL_Y + REEL_H + 8 },
  { x: REEL_AREA_X + REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 8, y: REEL_Y + REEL_H + 8 },
  // Manufacturer plate area
  { x: CANVAS_W / 2 - 50, y: BODY_Y + BODY_H - 30 },
  { x: CANVAS_W / 2 + 50, y: BODY_Y + BODY_H - 30 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine({ resultGrade, prizeName, onResult, onStateChange }: SlotMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  const reelOffsetsRef = useRef([0, 0, 0]);
  const reelSpeedsRef = useRef([0, 0, 0]);
  const reelStoppedRef = useRef([false, false, false]);
  const reelTargetOffsetRef = useRef([0, 0, 0]);

  // Lever animation
  const leverAngleRef = useRef(0);
  const leverVelocityRef = useRef(0);
  const leverPulledRef = useRef(false);
  // Track if lever hit the bottom click-stop
  const leverClickedRef = useRef(false);

  // Pointer drag state
  const isDraggingLeverRef = useRef(false);
  const leverDragStartYRef = useRef(0);
  const leverDragStartAngleRef = useRef(0);

  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const flashRef = useRef(0);          // 0-1 flash intensity
  const winFlashRef = useRef(0);       // separate win-row flash countdown
  const coinWaterfallActiveRef = useRef<number | false>(false);
  const coinSpawnTimerRef = useRef(0);
  const sparklesRef = useRef<Sparkle[]>([]);
  const sparkleTimerRef = useRef(0);
  const timeRef = useRef(0);

  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [spinCount, setSpinCount] = useState(0);

  const setGameStateSync = useCallback((s: GameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const calcTargetOffset = useCallback((reelIndex: number) => {
    const targetIdx = REEL_SYMBOLS.findIndex((s) => s === resultGrade);
    const safeIdx = targetIdx >= 0 ? targetIdx : 0;
    const centeredIdx = ((safeIdx - 2) % REEL_SYMBOLS.length + REEL_SYMBOLS.length) % REEL_SYMBOLS.length;
    const currentOffset = reelOffsetsRef.current[reelIndex] ?? 0;
    const extraRotations = (3 + reelIndex) * STRIP_H;
    const normalizedCurrent = ((currentOffset % STRIP_H) + STRIP_H) % STRIP_H;
    const targetNorm = centeredIdx * SYMBOL_H;
    let delta = targetNorm - normalizedCurrent;
    if (delta <= 0) delta += STRIP_H;
    return currentOffset + extraRotations + delta;
  }, [resultGrade]);

  const startSpin = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;
    reelOffsetsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [0, 0, 0];
    reelStoppedRef.current = [false, false, false];
    particlesRef.current = [];
    flashRef.current = 0;
    winFlashRef.current = 0;
    coinWaterfallActiveRef.current = false;
    coinSpawnTimerRef.current = 0;
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    setGameStateSync("SPINNING");
    setSpinCount((c) => c + 1);

    setTimeout(() => {
      reelTargetOffsetRef.current = [0, 1, 2].map((i) => calcTargetOffset(i));
      setGameStateSync("STOPPING");
      const realTargets = reelTargetOffsetRef.current.slice();
      reelTargetOffsetRef.current[1] = (reelOffsetsRef.current[1] ?? 0) + STRIP_H * 2;
      reelTargetOffsetRef.current[2] = (reelOffsetsRef.current[2] ?? 0) + STRIP_H * 3;
      setTimeout(() => { reelTargetOffsetRef.current[1] = realTargets[1] ?? 0; }, 900);
      setTimeout(() => { reelTargetOffsetRef.current[2] = realTargets[2] ?? 0; }, 1800);
    }, 1400);
  }, [calcTargetOffset, setGameStateSync]);

  const getLeverKnobPos = useCallback(() => {
    const baseX = LEVER_BASE_X - 6;
    const baseY = LEVER_BASE_Y;
    const armAngle = -Math.PI / 2 + leverAngleRef.current;
    return {
      x: baseX + Math.cos(armAngle) * LEVER_ARM_LEN,
      y: baseY + Math.sin(armAngle) * LEVER_ARM_LEN,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const knob = getLeverKnobPos();
    const dist = Math.hypot(px - knob.x, py - knob.y);
    if (dist < LEVER_KNOB_R + 22) {
      isDraggingLeverRef.current = true;
      leverDragStartYRef.current = py;
      leverDragStartAngleRef.current = leverAngleRef.current;
      leverClickedRef.current = false;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  }, [getLeverKnobPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingLeverRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleY = CANVAS_H / rect.height;
    const py = (e.clientY - rect.top) * scaleY;
    const dy = py - leverDragStartYRef.current;
    const newAngle = Math.max(0, Math.min(1.45, leverDragStartAngleRef.current + dy * 0.018));
    leverAngleRef.current = newAngle;

    // Click-stop feedback at ~90% pull
    if (newAngle >= 1.25 && !leverClickedRef.current) {
      leverClickedRef.current = true;
      // Brief resistance bounce: slight reverse velocity on the lever
      leverVelocityRef.current = 0.02;
    }

    // Trigger spin at full pull
    if (newAngle >= 1.35 && !leverPulledRef.current && (stateRef.current === "IDLE" || stateRef.current === "RESULT")) {
      leverPulledRef.current = true;
      leverVelocityRef.current = -0.07;
      startSpin();
    }
  }, [startSpin]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingLeverRef.current) {
      isDraggingLeverRef.current = false;
      leverPulledRef.current = false;
      leverClickedRef.current = false;
      leverVelocityRef.current = -0.055;
    }
  }, []);

  const handleReset = useCallback(() => {
    reelOffsetsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [0, 0, 0];
    reelStoppedRef.current = [false, false, false];
    reelTargetOffsetRef.current = [0, 0, 0];
    particlesRef.current = [];
    flashRef.current = 0;
    winFlashRef.current = 0;
    coinWaterfallActiveRef.current = false;
    coinSpawnTimerRef.current = 0;
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    leverAngleRef.current = 0;
    leverVelocityRef.current = 0;
    leverPulledRef.current = false;
    leverClickedRef.current = false;
    setGameStateSync("IDLE");
  }, [setGameStateSync]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    timeRef.current += 0.016;
    const t = timeRef.current;
    const state = stateRef.current;

    // ── Lever spring-back physics with overshoot ──
    if (!isDraggingLeverRef.current && leverAngleRef.current > 0) {
      // Spring constant and damping tuned for a satisfying overshoot bounce
      leverVelocityRef.current -= leverAngleRef.current * 0.095;
      leverVelocityRef.current *= 0.72;
      leverAngleRef.current = Math.max(0, leverAngleRef.current + leverVelocityRef.current);
      // Allow slight overshoot into negative (bounce past center), clamp gently
      if (leverAngleRef.current < 0) {
        leverAngleRef.current *= -0.3; // bounces back from 0
        leverVelocityRef.current *= -0.3;
      }
    }

    // ── Shake decay ──
    if (shakeRef.current.intensity > 0) {
      shakeRef.current.intensity *= 0.85;
      shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity;
      if (shakeRef.current.intensity < 0.3) shakeRef.current = { x: 0, y: 0, intensity: 0 };
    }

    // ── Win flash countdown ──
    if (winFlashRef.current > 0) winFlashRef.current -= 0.012;

    // ── Coin waterfall spawner ──
    const isWinResult = state === "RESULT";
    if (isWinResult && coinWaterfallActiveRef.current) {
      coinSpawnTimerRef.current += 0.016;
      if (coinSpawnTimerRef.current > 0.06) {
        coinSpawnTimerRef.current = 0;
        particlesRef.current.push(...spawnCoins(2));
      }
      // Stop waterfall after 3.5s
      if (t - coinWaterfallActiveRef.current > 3.5) {
        coinWaterfallActiveRef.current = false;
      }
    }

    // ── Ambient sparkle spawner ──
    sparkleTimerRef.current += 0.016;
    if (sparkleTimerRef.current > (isWinResult ? 0.05 : 0.35) + Math.random() * 0.4) {
      sparkleTimerRef.current = 0;
      const pt = CHROME_SPARKLE_POINTS[Math.floor(Math.random() * CHROME_SPARKLE_POINTS.length)];
      if (pt) {
        sparklesRef.current.push({
          x: pt.x + (Math.random() - 0.5) * 10,
          y: pt.y + (Math.random() - 0.5) * 8,
          life: 1,
          size: 2.5 + Math.random() * 2.5,
          angle: Math.random() * Math.PI / 4,
        });
      }
    }

    // Update sparkles
    sparklesRef.current = sparklesRef.current.filter((sp) => sp.life > 0);
    for (const sp of sparklesRef.current) {
      sp.life -= 0.04;
    }

    ctx.save();
    ctx.translate(shakeRef.current.x, shakeRef.current.y);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#0f0825");
    bgGrad.addColorStop(1, "#06030f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Reel physics
    const speeds = reelSpeedsRef.current;
    const offsets = reelOffsetsRef.current;
    const targets = reelTargetOffsetRef.current;
    const stopped = reelStoppedRef.current;

    if (state === "SPINNING") {
      for (let i = 0; i < REEL_COUNT; i++) {
        offsets[i] = (offsets[i] ?? 0) + (speeds[i] ?? 0);
        if ((speeds[i] ?? 0) < 20) speeds[i] = (speeds[i] ?? 0) + 1.8;
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
          if (i === REEL_COUNT - 1) {
            // All reels stopped — trigger celebration
            const isJackpot = resultGrade === "A賞";
            shakeRef.current.intensity = isJackpot ? 20 : 7;
            flashRef.current = isJackpot ? 1.2 : 0;
            winFlashRef.current = isJackpot ? 4.0 : 2.0;
            if (isJackpot) {
              particlesRef.current = spawnConfetti(120);
              coinWaterfallActiveRef.current = t; // stores start time for duration check
            } else {
              particlesRef.current = spawnConfetti(40);
            }
          }
        } else {
          offsets[i] = current + Math.max(2, diff * 0.11);
        }
      }
      if (allStopped && stateRef.current === "STOPPING") {
        setGameStateSync("RESULT");
        onResult?.(resultGrade);
      }
    }

    // ── Draw machine body ──
    drawMachineBody(ctx, t);

    // ── Draw reels ──
    const isResultState = state === "RESULT";
    const winFlash = Math.max(0, winFlashRef.current);
    for (let i = 0; i < REEL_COUNT; i++) {
      drawReel(ctx, i, offsets[i] ?? 0, stopped[i] ?? false, resultGrade, t, isResultState, winFlash);
    }

    // ── Win line ──
    drawWinLine(ctx, t);

    // ── Lever ──
    const isInteractable = state === "IDLE" || state === "RESULT";
    drawLever(ctx, leverAngleRef.current, leverVelocityRef.current, t, isInteractable);

    // ── Frame light override: win chase mode ──
    if (isResultState && winFlash > 0.2) {
      // Redraw frame lights in rapid chase mode on top
      drawFrameLights(ctx, t, true);
    }

    // ── Jackpot rays ──
    if (isResultState && resultGrade === "A賞") {
      drawJackpotRays(ctx, t);
    }

    // ── Flash overlay ──
    if (flashRef.current > 0) {
      flashRef.current -= 0.016;
      const col = resultGrade === "A賞" ? "251,191,36" : "255,255,255";
      ctx.fillStyle = `rgba(${col},${Math.max(0, flashRef.current) * 0.22})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── Particles ──
    const dt = 0.016;
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.type === "coin" ? 0.22 : 0.18;  // gravity
      p.vx *= 0.99;  // air resistance
      p.life -= dt / p.maxLife;
      p.rotation = (p.rotation ?? 0) + (p.type === "coin" ? 0.08 : 0.12);
    }
    drawParticles(ctx, particlesRef.current);

    // ── Chrome sparkles ──
    drawSparkles(ctx, sparklesRef.current);

    // ── Result banner ──
    if (state === "RESULT") drawResultBanner(ctx, resultGrade, prizeName, t);

    // ── Jackpot text overlay ──
    if (state === "RESULT" && resultGrade === "A賞") {
      drawJackpotOverlay(ctx, t);
    }

    ctx.restore();
    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName, onResult, setGameStateSync]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  const isInteractable = gameState === "IDLE" || gameState === "RESULT";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-purple-900/60 shadow-2xl block"
        style={{ background: "#0f0825", touchAction: "none", maxWidth: "100%" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="flex gap-3">
        <button
          onClick={startSpin}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-red-600 hover:bg-red-500 active:scale-95 text-white shadow-red-500/30 cursor-pointer"
              : "bg-gray-800 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          拉桿 PULL
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          重置
        </button>
      </div>

      <div className="text-xs text-gray-500 font-mono">
        狀態:{" "}
        <span className={
          gameState === "RESULT" ? "text-amber-400"
            : gameState === "SPINNING" ? "text-emerald-400"
            : "text-gray-400"
        }>
          {gameState}
        </span>
        {spinCount > 0 && <span className="ml-3 text-gray-600">第 {spinCount} 次</span>}
      </div>
    </div>
  );
}
