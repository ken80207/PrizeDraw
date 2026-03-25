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

const REEL_SYMBOLS = ["A賞", "C賞", "B賞", "D賞", "A賞", "B賞", "C賞", "D賞"];

const CANVAS_W = 380;
const CANVAS_H = 520;

// Reel geometry — inset into machine body
const REEL_COUNT = 3;
const REEL_W = 78;
const REEL_H = 220;
const REEL_GAP = 8;
const REEL_AREA_X = 42;   // left edge of reel window
const REEL_Y = 130;       // top of reel window
const SYMBOL_H = REEL_H / 5;
const SYMBOL_W = REEL_W;
const STRIP_H = SYMBOL_H * REEL_SYMBOLS.length;

// Machine body geometry
const BODY_X = 18;
const BODY_Y = 80;
const BODY_W = CANVAS_W - 36;
const BODY_H = CANVAS_H - 110;

// Lever geometry
const LEVER_BASE_X = CANVAS_W - 28;
const LEVER_BASE_Y = 190;
const LEVER_ARM_LEN = 80;
const LEVER_KNOB_R = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawMachineBody(ctx: CanvasRenderingContext2D, t: number) {
  // ── Isometric-style 3D machine ──
  // We simulate depth by drawing right face and bottom face offset

  const sideDepth = 14; // how deep the right/bottom faces appear

  // Right side face (darker)
  const rightFaceGrad = ctx.createLinearGradient(BODY_X + BODY_W, BODY_Y, BODY_X + BODY_W + sideDepth, BODY_Y + BODY_H);
  rightFaceGrad.addColorStop(0, "#1a1035");
  rightFaceGrad.addColorStop(1, "#0d0820");
  ctx.fillStyle = rightFaceGrad;
  ctx.beginPath();
  ctx.moveTo(BODY_X + BODY_W, BODY_Y + 12); // top-right of front
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_Y + 12 - sideDepth * 0.5); // top-right of side
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

  // Main front face body with metallic gradient
  const bodyGrad = ctx.createLinearGradient(BODY_X, BODY_Y, BODY_X + BODY_W, BODY_Y + BODY_H);
  bodyGrad.addColorStop(0, "#2d1f5e");
  bodyGrad.addColorStop(0.3, "#1e1245");
  bodyGrad.addColorStop(0.7, "#1a0f3d");
  bodyGrad.addColorStop(1, "#0f0825");
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = "#6d28d9";
  ctx.shadowBlur = 20;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Metallic edge highlight (top-left bevel)
  const bevelGrad = ctx.createLinearGradient(BODY_X, BODY_Y, BODY_X + 60, BODY_Y + 60);
  bevelGrad.addColorStop(0, "rgba(180,150,255,0.25)");
  bevelGrad.addColorStop(1, "rgba(180,150,255,0)");
  ctx.fillStyle = bevelGrad;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.fill();

  // Frame border
  ctx.strokeStyle = "#4c1d95";
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, 16);
  ctx.stroke();

  // Inner metallic trim lines
  ctx.strokeStyle = "rgba(139,92,246,0.3)";
  ctx.lineWidth = 1;
  drawRoundedRectPath(ctx, BODY_X + 4, BODY_Y + 4, BODY_W - 8, BODY_H - 8, 13);
  ctx.stroke();

  // Blinking lights around the frame
  drawFrameLights(ctx, t);

  // ── Top panel — JACKPOT display ──
  drawJackpotDisplay(ctx, t);

  // ── Coin slot at top ──
  drawCoinSlot(ctx);

  // ── Reel window frame (3D inset) ──
  drawReelWindowFrame(ctx);
}

function drawFrameLights(ctx: CanvasRenderingContext2D, t: number) {
  const lightColors = ["#f59e0b", "#ec4899", "#38bdf8", "#34d399", "#a78bfa", "#fb923c"];
  const positions: { x: number; y: number }[] = [];

  // Top edge lights
  for (let i = 0; i < 8; i++) {
    positions.push({ x: BODY_X + 20 + i * (BODY_W - 40) / 7, y: BODY_Y + 8 });
  }
  // Bottom edge lights
  for (let i = 0; i < 8; i++) {
    positions.push({ x: BODY_X + 20 + i * (BODY_W - 40) / 7, y: BODY_Y + BODY_H - 8 });
  }
  // Left edge lights
  for (let i = 0; i < 4; i++) {
    positions.push({ x: BODY_X + 8, y: BODY_Y + 30 + i * (BODY_H - 60) / 3 });
  }

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (!pos) continue;
    const color = lightColors[i % lightColors.length] ?? "#fbbf24";
    // Staggered blink: each light has its own phase
    const phase = (t * 3 + i * 0.4) % (Math.PI * 2);
    const brightness = 0.5 + Math.sin(phase) * 0.5;
    const isOn = brightness > 0.4;

    ctx.save();
    if (isOn) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = isOn ? color : `${color}44`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawJackpotDisplay(ctx: CanvasRenderingContext2D, t: number) {
  const dispX = BODY_X + 20;
  const dispY = BODY_Y + 18;
  const dispW = BODY_W - 40;
  const dispH = 44;

  // Display background (dark screen)
  const screenGrad = ctx.createLinearGradient(dispX, dispY, dispX, dispY + dispH);
  screenGrad.addColorStop(0, "#0a0520");
  screenGrad.addColorStop(1, "#05010f");
  ctx.fillStyle = screenGrad;
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 1.5;
  drawRoundedRectPath(ctx, dispX, dispY, dispW, dispH, 6);
  ctx.fill();
  ctx.stroke();

  // 3D inset shadow on display
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

  // PRIZE DRAW text with scroll effect
  const pulse = 0.7 + Math.sin(t * 4) * 0.3;
  ctx.save();
  ctx.globalAlpha = pulse;

  const textGrad = ctx.createLinearGradient(dispX, dispY, dispX + dispW, dispY);
  textGrad.addColorStop(0, "#f59e0b");
  textGrad.addColorStop(0.5, "#fde68a");
  textGrad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = textGrad;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 10;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PRIZE DRAW", CANVAS_W / 2, dispY + dispH * 0.38);
  ctx.restore();

  ctx.fillStyle = "#a78bfa";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("一番賞  SLOT MACHINE", CANVAS_W / 2, dispY + dispH * 0.72);
}

function drawCoinSlot(ctx: CanvasRenderingContext2D) {
  // Coin slot at top of machine
  const slotX = CANVAS_W / 2 - 18;
  const slotY = BODY_Y - 22;
  const slotW = 36;
  const slotH = 20;

  // Slot housing
  const slotGrad = ctx.createLinearGradient(slotX, slotY, slotX + slotW, slotY + slotH);
  slotGrad.addColorStop(0, "#374151");
  slotGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = slotGrad;
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1.5;
  drawRoundedRectPath(ctx, slotX, slotY, slotW, slotH, 4);
  ctx.fill();
  ctx.stroke();

  // Coin slot opening
  ctx.fillStyle = "#030712";
  ctx.beginPath();
  ctx.roundRect(slotX + 8, slotY + 7, slotW - 16, 6, 2);
  ctx.fill();

  // Coin slot label
  ctx.fillStyle = "#9ca3af";
  ctx.font = "7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COIN", CANVAS_W / 2, slotY + 3);
}

function drawReelWindowFrame(ctx: CanvasRenderingContext2D) {
  const frameX = REEL_AREA_X - 8;
  const frameY = REEL_Y - 8;
  const frameW = REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 16;
  const frameH = REEL_H + 16;

  // Outer shadow / inset border (3D inset effect)
  // Dark shadow on top-left = pressed inward
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#080414";
  drawRoundedRectPath(ctx, frameX, frameY, frameW, frameH, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Dark inset lines (top/left = shadow, bottom/right = highlight)
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frameX + 2, frameY + frameH - 2);
  ctx.lineTo(frameX + 2, frameY + 2);
  ctx.lineTo(frameX + frameW - 2, frameY + 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(139,92,246,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frameX + 2, frameY + frameH - 2);
  ctx.lineTo(frameX + frameW - 2, frameY + frameH - 2);
  ctx.lineTo(frameX + frameW - 2, frameY + 2);
  ctx.stroke();

  // Frame border glow
  ctx.strokeStyle = "#4c1d95";
  ctx.lineWidth = 1.5;
  drawRoundedRectPath(ctx, frameX, frameY, frameW, frameH, 8);
  ctx.stroke();
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  x: number, y: number, w: number, h: number,
  highlighted: boolean,
  alpha = 1,
) {
  if (!GRADE_COLORS[symbol]) return;
  const col = GRADE_COLORS[symbol]!;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Symbol background
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, highlighted ? lightenHex(col.bg, 40) : col.bg);
  bgGrad.addColorStop(1, col.bg);
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 8);
  ctx.fill();

  // Highlight shine inside
  if (highlighted) {
    const shineGrad = ctx.createLinearGradient(x + 3, y + 3, x + 3, y + (h - 6) * 0.5);
    shineGrad.addColorStop(0, "rgba(255,255,255,0.15)");
    shineGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, (h - 6) * 0.5, [8, 8, 0, 0]);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = highlighted ? col.border : `${col.border}44`;
  ctx.lineWidth = highlighted ? 2 : 0.8;
  if (highlighted) {
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 14;
  }
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grade label
  ctx.fillStyle = highlighted ? col.text : `${col.text}99`;
  ctx.font = `bold ${highlighted ? 16 : 14}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x + w / 2, y + h / 2);

  ctx.restore();
}

function drawReel(
  ctx: CanvasRenderingContext2D,
  reelIndex: number,
  offset: number,
  stopped: boolean,
  resultSymbol: string,
) {
  const rx = REEL_AREA_X + reelIndex * (REEL_W + REEL_GAP);
  const ry = REEL_Y;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, REEL_W, REEL_H);
  ctx.clip();

  // Reel background
  ctx.fillStyle = "#070314";
  ctx.fillRect(rx, ry, REEL_W, REEL_H);

  const normalizedOffset = ((offset % STRIP_H) + STRIP_H) % STRIP_H;
  const startSymbolFloat = normalizedOffset / SYMBOL_H;
  const startSymbol = Math.floor(startSymbolFloat);
  const subOffset = (startSymbolFloat - startSymbol) * SYMBOL_H;

  for (let i = -1; i <= 6; i++) {
    const symIdx = ((startSymbol + i) % REEL_SYMBOLS.length + REEL_SYMBOLS.length) % REEL_SYMBOLS.length;
    const sym = REEL_SYMBOLS[symIdx] ?? "D賞";
    const symY = ry + i * SYMBOL_H - subOffset;
    const localY = symY - ry;
    const edge = SYMBOL_H * 0.55;
    let alpha = 1;
    if (localY < edge) alpha = Math.max(0.15, localY / edge);
    if (localY > REEL_H - edge) alpha = Math.max(0.15, (REEL_H - localY) / edge);
    const isCenter = i === 2 && stopped && Math.abs(subOffset) < 3;
    drawSymbol(ctx, sym, rx, symY, SYMBOL_W, SYMBOL_H, isCenter, alpha);
  }

  // Win line highlight on center row
  if (stopped) {
    const centerY = ry + SYMBOL_H * 2;
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(rx + 3, centerY + 3, REEL_W - 6, SYMBOL_H - 6);
    ctx.stroke();
  }

  ctx.restore();

  // Motion blur lines when spinning
  if (!stopped && offset > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, REEL_W, REEL_H);
    ctx.clip();
    const blur = ctx.createLinearGradient(rx, ry, rx, ry + REEL_H);
    blur.addColorStop(0, "rgba(0,0,0,0)");
    blur.addColorStop(0.5, "rgba(0,0,0,0.15)");
    blur.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blur;
    ctx.fillRect(rx, ry, REEL_W, REEL_H);
    ctx.restore();
  }

  // Top/bottom fade gradients
  const topGrad = ctx.createLinearGradient(rx, ry, rx, ry + SYMBOL_H * 0.8);
  topGrad.addColorStop(0, "#070314ee");
  topGrad.addColorStop(1, "#07031400");
  ctx.fillStyle = topGrad;
  ctx.fillRect(rx, ry, REEL_W, SYMBOL_H * 0.8);

  const botGrad = ctx.createLinearGradient(rx, ry + REEL_H - SYMBOL_H * 0.8, rx, ry + REEL_H);
  botGrad.addColorStop(0, "#07031400");
  botGrad.addColorStop(1, "#070314ee");
  ctx.fillStyle = botGrad;
  ctx.fillRect(rx, ry + REEL_H - SYMBOL_H * 0.8, REEL_W, SYMBOL_H * 0.8);
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

  // Win line arrow indicators on sides
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

function drawLever(
  ctx: CanvasRenderingContext2D,
  leverAngle: number, // radians, 0 = straight up, positive = pulled down
  t: number,
  isInteractable: boolean,
) {
  const baseX = LEVER_BASE_X;
  const baseY = LEVER_BASE_Y;

  // Lever mount bracket
  const mountGrad = ctx.createLinearGradient(baseX - 12, baseY - 6, baseX + 2, baseY + 6);
  mountGrad.addColorStop(0, "#4b5563");
  mountGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = mountGrad;
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(baseX - 14, baseY - 8, 16, 16, 3);
  ctx.fill();
  ctx.stroke();

  // Lever pivot pin
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(baseX - 6, baseY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Arm end point
  const armAngle = -Math.PI / 2 + leverAngle; // default points up
  const armEndX = baseX - 6 + Math.cos(armAngle) * LEVER_ARM_LEN;
  const armEndY = baseY + Math.sin(armAngle) * LEVER_ARM_LEN;

  // Arm shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX - 6 + 2, baseY + 2);
  ctx.lineTo(armEndX + 2, armEndY + 2);
  ctx.stroke();
  ctx.restore();

  // Arm chrome gradient
  const armGrad = ctx.createLinearGradient(baseX - 6, baseY, armEndX, armEndY);
  armGrad.addColorStop(0, "#dc2626");
  armGrad.addColorStop(0.3, "#ef4444");
  armGrad.addColorStop(0.6, "#b91c1c");
  armGrad.addColorStop(1, "#7f1d1d");
  ctx.strokeStyle = armGrad;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.lineTo(armEndX, armEndY);
  ctx.stroke();

  // Arm highlight
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX - 6, baseY);
  ctx.lineTo(armEndX, armEndY);
  ctx.stroke();

  // Knob (sphere-like with radial gradient)
  const knobGrad = ctx.createRadialGradient(
    armEndX - LEVER_KNOB_R * 0.35, armEndY - LEVER_KNOB_R * 0.35, LEVER_KNOB_R * 0.1,
    armEndX, armEndY, LEVER_KNOB_R
  );
  knobGrad.addColorStop(0, "#fca5a5");
  knobGrad.addColorStop(0.4, "#ef4444");
  knobGrad.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = knobGrad;
  ctx.strokeStyle = "#450a0a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(armEndX, armEndY, LEVER_KNOB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Knob shine
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(
    armEndX - LEVER_KNOB_R * 0.3, armEndY - LEVER_KNOB_R * 0.3,
    LEVER_KNOB_R * 0.4, LEVER_KNOB_R * 0.25, -0.5, 0, Math.PI * 2
  );
  ctx.fill();

  // Glow when interactable
  if (isInteractable) {
    const glowPulse = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.save();
    ctx.globalAlpha = glowPulse;
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(armEndX, armEndY, LEVER_KNOB_R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // PULL label
  ctx.fillStyle = isInteractable ? "#fca5a5" : "#6b7280";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("PULL", baseX - 6, baseY + 12);
}

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
  const bannerH = 48;

  // Glow behind banner
  ctx.save();
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = 20 + Math.sin(t * 4) * 6;

  const bannerGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX + bannerW, bannerY);
  bannerGrad.addColorStop(0, col.bg);
  bannerGrad.addColorStop(0.4, lightenHex(col.bg, 25));
  bannerGrad.addColorStop(0.6, lightenHex(col.bg, 25));
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

  // Shine overlay
  const shineGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH * 0.5);
  shineGrad.addColorStop(0, "rgba(255,255,255,0.12)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.roundRect(bannerX, bannerY, bannerW, bannerH * 0.5, [10, 10, 0, 0]);
  ctx.fill();

  // Result text
  ctx.fillStyle = col.text;
  ctx.font = `bold ${resultGrade === "A賞" ? 18 : 16}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = resultGrade === "A賞"
    ? `JACKPOT  ${resultGrade}  ${prizeName ?? "大獎"}`
    : `${resultGrade}  ${prizeName ?? ""}`;
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = 8;
  ctx.fillText(label, CANVAS_W / 2, bannerY + bannerH / 2);
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Particles
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; rotation: number;
}

function spawnParticles(count: number): Particle[] {
  const colors = ["#f59e0b", "#fde68a", "#fbbf24", "#fff", "#fb923c", "#f472b6"];
  return Array.from({ length: count }, () => ({
    x: CANVAS_W / 2 + (Math.random() - 0.5) * 180,
    y: REEL_Y + REEL_H / 2 + (Math.random() - 0.5) * 100,
    vx: (Math.random() - 0.5) * 7,
    vy: -Math.random() * 10 - 3,
    life: 1,
    maxLife: 0.5 + Math.random() * 0.8,
    size: 3 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)] ?? "#f59e0b",
    rotation: Math.random() * Math.PI * 2,
  }));
}

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

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
  const leverAngleRef = useRef(0);       // 0 = up, +1.4 = fully pulled down
  const leverVelocityRef = useRef(0);
  const leverPulledRef = useRef(false);

  // Pointer drag state for lever
  const isDraggingLeverRef = useRef(false);
  const leverDragStartYRef = useRef(0);
  const leverDragStartAngleRef = useRef(0);

  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const flashRef = useRef(0);
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

  // Get lever knob screen position
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
    if (dist < LEVER_KNOB_R + 20) {
      isDraggingLeverRef.current = true;
      leverDragStartYRef.current = py;
      leverDragStartAngleRef.current = leverAngleRef.current;
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
    const newAngle = Math.max(0, Math.min(1.4, leverDragStartAngleRef.current + dy * 0.018));
    leverAngleRef.current = newAngle;

    // If fully pulled down and state allows, trigger spin
    if (newAngle >= 1.3 && !leverPulledRef.current && (stateRef.current === "IDLE" || stateRef.current === "RESULT")) {
      leverPulledRef.current = true;
      leverVelocityRef.current = -0.06; // spring back velocity
      startSpin();
    }
  }, [startSpin]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingLeverRef.current) {
      isDraggingLeverRef.current = false;
      leverPulledRef.current = false;
      leverVelocityRef.current = -0.05; // spring back
    }
  }, []);

  const handleReset = useCallback(() => {
    reelOffsetsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [0, 0, 0];
    reelStoppedRef.current = [false, false, false];
    reelTargetOffsetRef.current = [0, 0, 0];
    particlesRef.current = [];
    flashRef.current = 0;
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    leverAngleRef.current = 0;
    leverVelocityRef.current = 0;
    leverPulledRef.current = false;
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

    // Lever spring-back physics
    if (!isDraggingLeverRef.current && leverAngleRef.current > 0) {
      leverVelocityRef.current -= leverAngleRef.current * 0.08; // spring force
      leverVelocityRef.current *= 0.75; // damping
      leverAngleRef.current = Math.max(0, leverAngleRef.current + leverVelocityRef.current);
    }

    // Shake decay
    if (shakeRef.current.intensity > 0) {
      shakeRef.current.intensity *= 0.86;
      shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity;
      if (shakeRef.current.intensity < 0.3) shakeRef.current = { x: 0, y: 0, intensity: 0 };
    }

    ctx.save();
    ctx.translate(shakeRef.current.x, shakeRef.current.y);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#0f0825");
    bgGrad.addColorStop(1, "#06030f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Reel update
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
            shakeRef.current.intensity = resultGrade === "A賞" ? 18 : 6;
            flashRef.current = resultGrade === "A賞" ? 1 : 0;
            if (resultGrade === "A賞") particlesRef.current = spawnParticles(100);
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

    // Draw machine body (3D)
    drawMachineBody(ctx, t);

    // Draw reels
    for (let i = 0; i < REEL_COUNT; i++) {
      drawReel(ctx, i, offsets[i] ?? 0, stopped[i] ?? false, resultGrade);
    }

    // Win line
    drawWinLine(ctx, t);

    // Lever
    const isInteractable = state === "IDLE" || state === "RESULT";
    drawLever(ctx, leverAngleRef.current, t, isInteractable);

    // Flash
    if (flashRef.current > 0) {
      flashRef.current -= 0.018;
      ctx.fillStyle = `rgba(251,191,36,${flashRef.current * 0.28})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Particles
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life -= 0.016 / p.maxLife;
      p.rotation = (p.rotation ?? 0) + 0.1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -p.size * p.life);
      ctx.lineTo(p.size * p.life * 0.5, 0);
      ctx.lineTo(0, p.size * p.life);
      ctx.lineTo(-p.size * p.life * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Result banner
    if (state === "RESULT") drawResultBanner(ctx, resultGrade, prizeName, t);

    // Jackpot overlay for A賞
    if (state === "RESULT" && resultGrade === "A賞") {
      const jackpotPulse = 0.7 + Math.sin(t * 6) * 0.3;
      ctx.save();
      ctx.globalAlpha = jackpotPulse;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("JACKPOT!", CANVAS_W / 2, REEL_Y - 40);
      ctx.restore();
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
