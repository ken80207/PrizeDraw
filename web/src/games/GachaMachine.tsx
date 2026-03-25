"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GachaGameState = "IDLE" | "COIN_INSERT" | "TURNING" | "DISPENSING" | "BOUNCING" | "READY_TO_OPEN" | "OPENING" | "RESULT";

export interface GachaMachineProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 380;
const CANVAS_H = 520;

// Machine center
const MACHINE_CX = CANVAS_W / 2;
const BODY_BOTTOM_Y = 420;

// Dome (hemisphere)
const DOME_CX = MACHINE_CX;
const DOME_CY = 190;
const DOME_R = 108;

// Machine body below dome
const BODY_TOP_Y = DOME_CY + DOME_R * 0.85;
const BODY_W = DOME_R * 1.5;
const BODY_H = BODY_BOTTOM_Y - BODY_TOP_Y;
const BODY_X = MACHINE_CX - BODY_W / 2;

// Neck connecting dome to body
const NECK_W = DOME_R * 0.55;
const NECK_Y = DOME_CY + DOME_R * 0.6;
const NECK_H = BODY_TOP_Y - NECK_Y + 8;

// Chute
const CHUTE_W = 58;
const CHUTE_H = 48;
const CHUTE_X = MACHINE_CX - CHUTE_W / 2;
const CHUTE_Y = BODY_TOP_Y + BODY_H * 0.25;

// Handle (on right side of body)
const HANDLE_CX = BODY_X + BODY_W + 28;
const HANDLE_CY = BODY_TOP_Y + BODY_H * 0.38;
const HANDLE_R = 24;
const HANDLE_ARM_LEN = 28;

// Coin slot (top of body)
const COIN_SLOT_X = MACHINE_CX - 14;
const COIN_SLOT_Y = BODY_TOP_Y + 14;

// Capsule landing spot
const CAPSULE_LAND_X = MACHINE_CX;
const CAPSULE_LAND_Y = 460;

// Grade colors for capsules (with 3D shading data)
const GRADE_CAPSULE: Record<string, { topLight: string; topDark: string; bottomLight: string; bottomDark: string; glow: string }> = {
  "A賞": { topLight: "#fde68a", topDark: "#d97706", bottomLight: "#92400e", bottomDark: "#451a03", glow: "#f59e0b" },
  "B賞": { topLight: "#bae6fd", topDark: "#0369a1", bottomLight: "#1e40af", bottomDark: "#1e3a5f", glow: "#0ea5e9" },
  "C賞": { topLight: "#a7f3d0", topDark: "#059669", bottomLight: "#065f46", bottomDark: "#022c22", glow: "#10b981" },
  "D賞": { topLight: "#ddd6fe", topDark: "#7c3aed", bottomLight: "#4c1d95", bottomDark: "#2e1065", glow: "#a855f7" },
};

const MINI_CAPSULE_POSITIONS = [
  { x: -58, y: -45, grade: "B賞" }, { x: -18, y: -58, grade: "C賞" }, { x: 28, y: -48, grade: "A賞" },
  { x: 58, y: -32, grade: "D賞" }, { x: -48, y: -8, grade: "C賞" }, { x: 2, y: -12, grade: "B賞" },
  { x: 42, y: 4, grade: "A賞" }, { x: -68, y: 22, grade: "D賞" }, { x: -28, y: 28, grade: "C賞" },
  { x: 22, y: 32, grade: "B賞" }, { x: 62, y: 28, grade: "A賞" }, { x: -52, y: 58, grade: "D賞" },
  { x: 4, y: 62, grade: "C賞" }, { x: 48, y: 52, grade: "B賞" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3D Capsule drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawCapsule3D(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  r: number,
  grade: string,
  alpha = 1,
  openFraction = 0,
  rotation = 0, // tilt angle in radians
) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"]!;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  if (openFraction < 0.01) {
    // ── Closed capsule with 3D shading ──

    // Bottom half
    const botGrad = ctx.createLinearGradient(-r, 0, r, 0);
    botGrad.addColorStop(0, col.bottomLight);
    botGrad.addColorStop(0.35, col.bottomLight);
    botGrad.addColorStop(0.7, col.bottomDark);
    botGrad.addColorStop(1, col.bottomDark);
    ctx.fillStyle = botGrad;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Top half
    const topGrad = ctx.createLinearGradient(-r, -r, r, 0);
    topGrad.addColorStop(0, col.topLight);
    topGrad.addColorStop(0.4, col.topLight);
    topGrad.addColorStop(0.8, col.topDark);
    topGrad.addColorStop(1, col.topDark);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Equator band (seam)
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();

    // 3D sphere highlight (white dot, top-left)
    const hlGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.1, -r * 0.2, r * 0.45);
    hlGrad.addColorStop(0, "rgba(255,255,255,0.55)");
    hlGrad.addColorStop(0.5, "rgba(255,255,255,0.15)");
    hlGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Second smaller highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.42, r * 0.22, r * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // ── Opening animation ──
    const topOffY = -openFraction * r * 2.8;

    // Bottom half (stays)
    const botGrad = ctx.createLinearGradient(-r, 0, r, 0);
    botGrad.addColorStop(0, col.bottomLight);
    botGrad.addColorStop(0.7, col.bottomDark);
    ctx.fillStyle = botGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Inner light (revealed)
    if (openFraction > 0.15) {
      const innerAlpha = Math.min(1, (openFraction - 0.15) / 0.35);
      const innerGlow = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.8);
      innerGlow.addColorStop(0, `${col.glow}cc`);
      innerGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalAlpha = alpha * innerAlpha;
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.45, 0, 0, Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // Top half (moves up)
    ctx.save();
    ctx.translate(0, topOffY);
    const topGrad = ctx.createLinearGradient(-r, -r, r, 0);
    topGrad.addColorStop(0, col.topLight);
    topGrad.addColorStop(0.8, col.topDark);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Highlight on top half
    const topHlGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r * 0.7);
    topHlGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    topHlGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = topHlGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    // Prize text revealed
    if (openFraction > 0.4) {
      const prizeAlpha = (openFraction - 0.4) / 0.6;
      ctx.save();
      ctx.globalAlpha = alpha * prizeAlpha;
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 16 * openFraction;
      ctx.fillStyle = col.topLight;
      ctx.font = `bold ${r * 0.75}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grade.charAt(0), 0, r * 0.28);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawMiniCapsule3D(ctx: CanvasRenderingContext2D, cx: number, cy: number, grade: string, wobble: number) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"]!;
  const r = 10;
  const wx = Math.sin(wobble) * 1.8;
  const wy = Math.cos(wobble * 0.8) * 1.2;

  ctx.save();
  ctx.translate(cx + wx, cy + wy);

  // Bottom half
  const botGrad = ctx.createLinearGradient(-r, 0, r, 0);
  botGrad.addColorStop(0, col.bottomLight);
  botGrad.addColorStop(1, col.bottomDark);
  ctx.fillStyle = botGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Top half
  const topGrad = ctx.createLinearGradient(-r, -r, r, 0);
  topGrad.addColorStop(0, col.topLight);
  topGrad.addColorStop(1, col.topDark);
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Seam
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.38, r * 0.25, r * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine body drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawMachineBody3D(ctx: CanvasRenderingContext2D, t: number) {
  const sideDepth = 10;

  // ── Legs / base platform ──
  const baseY = BODY_BOTTOM_Y;
  const baseW = BODY_W + 30;
  const baseX = MACHINE_CX - baseW / 2;

  // Base shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX + baseW, baseY + 20);
  baseGrad.addColorStop(0, "#3d1f0a");
  baseGrad.addColorStop(1, "#1f0f04");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.roundRect(baseX, baseY - 8, baseW, 30, [0, 0, 8, 8]);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(baseX, baseY - 8, baseW, 30, [0, 0, 8, 8]);
  ctx.stroke();

  // Legs
  const legW = 18, legH = 28;
  const legPositions = [baseX + 16, baseX + baseW - 34];
  for (const lx of legPositions) {
    // Right face
    ctx.fillStyle = "#1f0f04";
    ctx.beginPath();
    ctx.moveTo(lx + legW, baseY + 20);
    ctx.lineTo(lx + legW + sideDepth * 0.7, baseY + 20 - sideDepth * 0.35);
    ctx.lineTo(lx + legW + sideDepth * 0.7, baseY + 20 + legH - sideDepth * 0.35);
    ctx.lineTo(lx + legW, baseY + 20 + legH);
    ctx.closePath();
    ctx.fill();

    const legGrad = ctx.createLinearGradient(lx, baseY + 20, lx + legW, baseY + 20 + legH);
    legGrad.addColorStop(0, "#7c2d12");
    legGrad.addColorStop(1, "#431407");
    ctx.fillStyle = legGrad;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, baseY + 20, legW, legH, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();
  }

  // ── Body main cylinder / box — visible side ──
  // Right face (depth)
  const rightFGrad = ctx.createLinearGradient(BODY_X + BODY_W, BODY_TOP_Y, BODY_X + BODY_W + sideDepth, BODY_TOP_Y + BODY_H);
  rightFGrad.addColorStop(0, "#431407");
  rightFGrad.addColorStop(1, "#1f0f04");
  ctx.fillStyle = rightFGrad;
  ctx.beginPath();
  ctx.moveTo(BODY_X + BODY_W, BODY_TOP_Y + 10);
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_TOP_Y + 10 - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W + sideDepth, BODY_BOTTOM_Y - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W, BODY_BOTTOM_Y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ea580c33";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Front face
  const bodyGrad = ctx.createLinearGradient(BODY_X, BODY_TOP_Y, BODY_X + BODY_W, BODY_BOTTOM_Y);
  bodyGrad.addColorStop(0, "#9a3412");
  bodyGrad.addColorStop(0.3, "#c2410c");
  bodyGrad.addColorStop(0.7, "#b91c1c");
  bodyGrad.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = "#ea580c";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(BODY_X, BODY_TOP_Y, BODY_W, BODY_H, [4, 4, 8, 8]);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Metallic bevel
  const bevelGrad = ctx.createLinearGradient(BODY_X, BODY_TOP_Y, BODY_X + 40, BODY_TOP_Y + 40);
  bevelGrad.addColorStop(0, "rgba(253,186,116,0.25)");
  bevelGrad.addColorStop(1, "rgba(253,186,116,0)");
  ctx.fillStyle = bevelGrad;
  ctx.beginPath();
  ctx.roundRect(BODY_X, BODY_TOP_Y, BODY_W, BODY_H, [4, 4, 8, 8]);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(BODY_X, BODY_TOP_Y, BODY_W, BODY_H, [4, 4, 8, 8]);
  ctx.stroke();

  // Inner trim line
  ctx.strokeStyle = "rgba(251,146,60,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(BODY_X + 4, BODY_TOP_Y + 4, BODY_W - 8, BODY_H - 8, [2, 2, 5, 5]);
  ctx.stroke();

  // ── Neck connecting dome to body ──
  const neckX = MACHINE_CX - NECK_W / 2;
  const neckGrad = ctx.createLinearGradient(neckX, NECK_Y, neckX + NECK_W, NECK_Y + NECK_H);
  neckGrad.addColorStop(0, "#7c2d12");
  neckGrad.addColorStop(1, "#9a3412");
  ctx.fillStyle = neckGrad;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(neckX - 4, NECK_Y, NECK_W + 8, NECK_H, 4);
  ctx.fill();
  ctx.stroke();

  // Blinking lights on body
  drawBodyLights(ctx, t);

  // ── Decorative label panel ──
  drawBodyLabel(ctx, t);

  // ── Price/coin display ──
  drawCoinSlot(ctx, t);

  // ── Chute with depth ──
  drawChute3D(ctx);
}

function drawBodyLights(ctx: CanvasRenderingContext2D, t: number) {
  const lightColors = ["#f59e0b", "#fb923c", "#fbbf24", "#f97316"];
  // Ring of lights around body top
  for (let i = 0; i < 8; i++) {
    const lx = BODY_X + 16 + i * (BODY_W - 32) / 7;
    const ly = BODY_TOP_Y + 8;
    const blink = Math.sin(t * 5 + i * 0.8) > 0;
    const col = lightColors[i % lightColors.length] ?? "#f59e0b";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
    ctx.fillStyle = blink ? col : `${col}33`;
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBodyLabel(ctx: CanvasRenderingContext2D, t: number) {
  const lbX = BODY_X + 8;
  const lbY = BODY_TOP_Y + 20;
  const lbW = BODY_W - 16;
  const lbH = 32;

  const lbGrad = ctx.createLinearGradient(lbX, lbY, lbX + lbW, lbY + lbH);
  lbGrad.addColorStop(0, "#431407");
  lbGrad.addColorStop(1, "#1f0f04");
  ctx.fillStyle = lbGrad;
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(lbX, lbY, lbW, lbH, 4);
  ctx.fill();
  ctx.stroke();

  const pulse = 0.75 + Math.sin(t * 3) * 0.25;
  ctx.save();
  ctx.globalAlpha = pulse;

  const textGrad = ctx.createLinearGradient(lbX, lbY, lbX + lbW, lbY);
  textGrad.addColorStop(0, "#fbbf24");
  textGrad.addColorStop(0.5, "#fde68a");
  textGrad.addColorStop(1, "#fbbf24");
  ctx.fillStyle = textGrad;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 8;
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GACHA  扭蛋機", MACHINE_CX, lbY + lbH / 2);
  ctx.restore();
}

function drawCoinSlot(ctx: CanvasRenderingContext2D, _t: number) {
  const slotW = 36, slotH = 18;
  const slotX = COIN_SLOT_X;
  const slotY = COIN_SLOT_Y + 62;

  ctx.fillStyle = "#431407";
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(slotX, slotY, slotW, slotH, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#020810";
  ctx.beginPath();
  ctx.roundRect(slotX + 6, slotY + 6, slotW - 12, 6, 2);
  ctx.fill();

  ctx.fillStyle = "#f97316aa";
  ctx.font = "7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("投幣口", slotX + slotW / 2, slotY + 3);
}

function drawChute3D(ctx: CanvasRenderingContext2D) {
  const cW = CHUTE_W, cH = CHUTE_H;
  const cx = CHUTE_X;
  const cy = CHUTE_Y;
  const sideD = 8;

  // Right face
  ctx.fillStyle = "#431407";
  ctx.beginPath();
  ctx.moveTo(cx + cW, cy + 4);
  ctx.lineTo(cx + cW + sideD, cy + 4 - sideD * 0.4);
  ctx.lineTo(cx + cW + sideD, cy + cH - sideD * 0.4);
  ctx.lineTo(cx + cW, cy + cH);
  ctx.closePath();
  ctx.fill();

  // Front face
  const chuteGrad = ctx.createLinearGradient(cx, cy, cx + cW, cy + cH);
  chuteGrad.addColorStop(0, "#7c2d12");
  chuteGrad.addColorStop(1, "#431407");
  ctx.fillStyle = chuteGrad;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx, cy, cW, cH, [0, 0, 6, 6]);
  ctx.fill();
  ctx.stroke();

  // Opening (dark hole)
  ctx.fillStyle = "#050205";
  ctx.beginPath();
  ctx.roundRect(cx + 6, cy + 6, cW - 12, cH - 20, 3);
  ctx.fill();

  // Flap
  const flapGrad = ctx.createLinearGradient(cx, cy + cH - 16, cx, cy + cH);
  flapGrad.addColorStop(0, "#9a3412");
  flapGrad.addColorStop(1, "#7c2d12");
  ctx.fillStyle = flapGrad;
  ctx.beginPath();
  ctx.roundRect(cx + 4, cy + cH - 18, cW - 8, 14, [0, 0, 5, 5]);
  ctx.fill();

  ctx.fillStyle = "#fb923caa";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("出口", cx + cW / 2, cy + cH - 10);
}

function drawHemisphereDome(ctx: CanvasRenderingContext2D, t: number) {
  // ── Dome base ring ──
  const ringGrad = ctx.createLinearGradient(
    DOME_CX - DOME_R, DOME_CY + DOME_R * 0.85,
    DOME_CX + DOME_R, DOME_CY + DOME_R * 0.85
  );
  ringGrad.addColorStop(0, "#431407");
  ringGrad.addColorStop(0.5, "#9a3412");
  ringGrad.addColorStop(1, "#431407");
  ctx.fillStyle = ringGrad;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY + DOME_R * 0.88, DOME_R * 0.7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ── Outer dome glow (atmospheric scattering) ──
  const outerGlow = ctx.createRadialGradient(DOME_CX, DOME_CY, DOME_R * 0.85, DOME_CX, DOME_CY, DOME_R * 1.1);
  outerGlow.addColorStop(0, "rgba(56,189,248,0)");
  outerGlow.addColorStop(1, "rgba(56,189,248,0.10)");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // ── Main dome glass ──
  // Back of dome (slightly darker — depth illusion)
  const domeBackGrad = ctx.createRadialGradient(DOME_CX + 30, DOME_CY + 30, DOME_R * 0.3, DOME_CX, DOME_CY, DOME_R);
  domeBackGrad.addColorStop(0, "rgba(186,230,253,0.08)");
  domeBackGrad.addColorStop(0.6, "rgba(14,165,233,0.04)");
  domeBackGrad.addColorStop(1, "rgba(7,89,133,0.12)");
  ctx.fillStyle = domeBackGrad;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // Mini capsules (clip inside dome)
  ctx.save();
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R - 5, 0, Math.PI * 2);
  ctx.clip();
  for (const mc of MINI_CAPSULE_POSITIONS) {
    drawMiniCapsule3D(ctx, DOME_CX + mc.x, DOME_CY + mc.y, mc.grade, t + mc.x * 0.08);
  }
  ctx.restore();

  // ── Glass rim ──
  ctx.save();
  ctx.shadowColor = "rgba(186,230,253,0.5)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(186,230,253,0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ── Primary glass highlight (top-left reflection) ──
  const hlGrad = ctx.createRadialGradient(
    DOME_CX - DOME_R * 0.38, DOME_CY - DOME_R * 0.42, 0,
    DOME_CX - DOME_R * 0.2, DOME_CY - DOME_R * 0.25, DOME_R * 0.5
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.22)");
  hlGrad.addColorStop(0.5, "rgba(255,255,255,0.08)");
  hlGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // ── Secondary streak highlight ──
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(DOME_CX - DOME_R * 0.5, DOME_CY - DOME_R * 0.6);
  ctx.lineTo(DOME_CX - DOME_R * 0.15, DOME_CY + DOME_R * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(DOME_CX - DOME_R * 0.2, DOME_CY - DOME_R * 0.7);
  ctx.lineTo(DOME_CX + DOME_R * 0.1, DOME_CY + DOME_R * 0.1);
  ctx.stroke();
  ctx.restore();

  // ── Equator band (glass meets frame) ──
  const equatorGrad = ctx.createLinearGradient(DOME_CX - DOME_R, DOME_CY + DOME_R * 0.82, DOME_CX + DOME_R, DOME_CY + DOME_R * 0.82);
  equatorGrad.addColorStop(0, "#ea580c");
  equatorGrad.addColorStop(0.5, "#fb923c");
  equatorGrad.addColorStop(1, "#ea580c");
  ctx.strokeStyle = equatorGrad;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY, DOME_R * 1.01, DOME_R * 0.85, 0, Math.PI * 0.06, Math.PI * 0.94);
  ctx.stroke();
}

function drawHandle3D(ctx: CanvasRenderingContext2D, handleAngle: number, t: number, isInteractable: boolean) {
  const hcx = HANDLE_CX;
  const hcy = HANDLE_CY;

  // Mount plate on body
  const mountGrad = ctx.createLinearGradient(hcx - 16, hcy - 8, hcx + 4, hcy + 8);
  mountGrad.addColorStop(0, "#7c2d12");
  mountGrad.addColorStop(1, "#431407");
  ctx.fillStyle = mountGrad;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hcx - 16, hcy - 10, 18, 20, 3);
  ctx.fill();
  ctx.stroke();

  // Central hub (raised 3D knob base)
  const hubGrad = ctx.createRadialGradient(hcx - 3, hcy - 3, 2, hcx, hcy, 12);
  hubGrad.addColorStop(0, "#fb923c");
  hubGrad.addColorStop(0.5, "#ea580c");
  hubGrad.addColorStop(1, "#7c2d12");
  ctx.fillStyle = hubGrad;
  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hcx, hcy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hub center mark
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(hcx, hcy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Arm — knob rotates around hub
  const armRad = (handleAngle * Math.PI) / 180;
  const knobX = hcx + Math.cos(armRad) * HANDLE_ARM_LEN;
  const knobY = hcy + Math.sin(armRad) * HANDLE_ARM_LEN;

  // Arm shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hcx + 2, hcy + 2);
  ctx.lineTo(knobX + 2, knobY + 2);
  ctx.stroke();
  ctx.restore();

  // Arm body
  const armGrad = ctx.createLinearGradient(hcx, hcy, knobX, knobY);
  armGrad.addColorStop(0, "#ea580c");
  armGrad.addColorStop(0.5, "#f97316");
  armGrad.addColorStop(1, "#c2410c");
  ctx.strokeStyle = armGrad;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hcx, hcy);
  ctx.lineTo(knobX, knobY);
  ctx.stroke();

  // Arm highlight
  ctx.strokeStyle = "rgba(253,186,116,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hcx, hcy);
  ctx.lineTo(knobX, knobY);
  ctx.stroke();

  // Knob (3D sphere effect)
  const knobGrad = ctx.createRadialGradient(
    knobX - HANDLE_R * 0.35, knobY - HANDLE_R * 0.35, HANDLE_R * 0.1,
    knobX, knobY, HANDLE_R
  );
  knobGrad.addColorStop(0, "#fde68a");
  knobGrad.addColorStop(0.4, "#f59e0b");
  knobGrad.addColorStop(1, "#78350f");
  ctx.fillStyle = knobGrad;
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  if (isInteractable) {
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 14 + Math.sin(t * 3) * 5;
  }
  ctx.beginPath();
  ctx.arc(knobX, knobY, HANDLE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Knob highlight
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(knobX - HANDLE_R * 0.3, knobY - HANDLE_R * 0.3, HANDLE_R * 0.38, HANDLE_R * 0.24, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Rotation progress arc
  if (isInteractable) {
    const progressRad = Math.PI * 2 * 0; // will be filled by caller using totalRotation
    ctx.strokeStyle = `rgba(251,191,36,0.4)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hcx, hcy, HANDLE_R + 10, -Math.PI / 2, -Math.PI / 2 + progressRad);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("旋轉", hcx, hcy + HANDLE_R + 14);
}

function drawCoinAnimation(
  ctx: CanvasRenderingContext2D,
  progress: number, // 0 → 1
) {
  // Coin falls from top into coin slot
  const startX = COIN_SLOT_X + 18;
  const startY = DOME_CY - DOME_R - 40;
  const endX = COIN_SLOT_X + 18;
  const endY = COIN_SLOT_Y + 80;

  const cx = startX + (endX - startX) * progress;
  const cy = startY + (endY - startY) * progress;
  const spin = progress * Math.PI * 8; // coin spins as it falls
  const coinW = 22 * Math.abs(Math.cos(spin));
  const coinH = 22;

  ctx.save();

  // Coin glow
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 12;

  // Coin body
  const coinGrad = ctx.createLinearGradient(cx - coinW, cy - coinH / 2, cx + coinW, cy + coinH / 2);
  coinGrad.addColorStop(0, "#fde68a");
  coinGrad.addColorStop(0.5, "#f59e0b");
  coinGrad.addColorStop(1, "#92400e");
  ctx.fillStyle = coinGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, coinW / 2), coinH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin rim
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, coinW / 2), coinH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Coin symbol
  if (Math.abs(Math.cos(spin)) > 0.3) {
    ctx.fillStyle = "#92400e";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", cx, cy);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine({ resultGrade, prizeName, onResult, onStateChange }: GachaMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GachaGameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  const handleAngleRef = useRef(0);
  const handleVelocityRef = useRef(0);
  const totalRotationRef = useRef(0);
  const isDraggingHandleRef = useRef(false);
  const dragStartAngleRef = useRef(0);
  const prevHandleAngleRef = useRef(0);

  // Coin insert animation
  const coinProgressRef = useRef(-1); // -1 = not animating

  const capsuleRef = useRef({
    x: CAPSULE_LAND_X,
    y: CHUTE_Y + CHUTE_H - 10,
    vy: 0,
    bounces: 0,
    openFraction: 0,
    visible: false,
    rotation: 0,
    rotVelocity: 0,
    phase: "hidden" as "hidden" | "falling" | "bouncing" | "settled" | "opening" | "open",
  });

  const wobbleTimeRef = useRef(0);
  const [gameState, setGameState] = useState<GachaGameState>("IDLE");

  const setGameStateSync = useCallback((s: GachaGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const getAngleFromPointer = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    return Math.atan2(py - HANDLE_CY, px - HANDLE_CX) * (180 / Math.PI);
  }, []);

  const triggerDispense = useCallback(() => {
    // Start coin insert animation first
    setGameStateSync("COIN_INSERT");
    coinProgressRef.current = 0;

    const coinInterval = setInterval(() => {
      coinProgressRef.current = Math.min(1, coinProgressRef.current + 0.025);
      if (coinProgressRef.current >= 1) {
        clearInterval(coinInterval);
        coinProgressRef.current = -1;
        setGameStateSync("DISPENSING");

        // Spin handle automatically
        const startTime = performance.now();
        const spinDuration = 900;
        const spinInterval = setInterval(() => {
          const elapsed = performance.now() - startTime;
          const progress = elapsed / spinDuration;
          handleAngleRef.current += 16 * (1 - progress * 0.6);
          totalRotationRef.current = 0;
          if (elapsed >= spinDuration) {
            clearInterval(spinInterval);
            // Release capsule
            capsuleRef.current = {
              x: MACHINE_CX,
              y: CHUTE_Y + CHUTE_H - 15,
              vy: 0,
              bounces: 0,
              openFraction: 0,
              visible: true,
              rotation: 0,
              rotVelocity: (Math.random() - 0.5) * 0.2,
              phase: "falling",
            };
            setGameStateSync("BOUNCING");
          }
        }, 16);
      }
    }, 16);
  }, [setGameStateSync]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== "IDLE") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const angle = getAngleFromPointer(e.clientX, e.clientY, rect);
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const dist = Math.hypot(px - HANDLE_CX, py - HANDLE_CY);
    if (dist < HANDLE_R + 18) {
      isDraggingHandleRef.current = true;
      dragStartAngleRef.current = angle - handleAngleRef.current;
      prevHandleAngleRef.current = handleAngleRef.current;
    }
  }, [getAngleFromPointer]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingHandleRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const angle = getAngleFromPointer(e.clientX, e.clientY, rect);
    const newAngle = angle - dragStartAngleRef.current;
    const delta = newAngle - prevHandleAngleRef.current;
    if (delta > 0) totalRotationRef.current += delta;
    prevHandleAngleRef.current = newAngle;
    handleAngleRef.current = newAngle;
    handleVelocityRef.current = delta;
    if (totalRotationRef.current >= 360 && stateRef.current === "IDLE") {
      isDraggingHandleRef.current = false;
      triggerDispense();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAngleFromPointer]);

  const handleMouseUp = useCallback(() => { isDraggingHandleRef.current = false; }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (stateRef.current !== "IDLE") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    if (!touch) return;
    const angle = getAngleFromPointer(touch.clientX, touch.clientY, rect);
    isDraggingHandleRef.current = true;
    dragStartAngleRef.current = angle - handleAngleRef.current;
    prevHandleAngleRef.current = handleAngleRef.current;
  }, [getAngleFromPointer]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDraggingHandleRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    if (!touch) return;
    const angle = getAngleFromPointer(touch.clientX, touch.clientY, rect);
    const newAngle = angle - dragStartAngleRef.current;
    const delta = newAngle - prevHandleAngleRef.current;
    if (delta > 0) totalRotationRef.current += delta;
    prevHandleAngleRef.current = newAngle;
    handleAngleRef.current = newAngle;
    if (totalRotationRef.current >= 360 && stateRef.current === "IDLE") {
      isDraggingHandleRef.current = false;
      triggerDispense();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAngleFromPointer]);

  const handleAutoTurn = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    triggerDispense();
  }, [triggerDispense]);

  const handleOpenCapsule = useCallback(() => {
    if (stateRef.current !== "READY_TO_OPEN") return;
    setGameStateSync("OPENING");
  }, [setGameStateSync]);

  const handleReset = useCallback(() => {
    handleAngleRef.current = 0;
    handleVelocityRef.current = 0;
    totalRotationRef.current = 0;
    isDraggingHandleRef.current = false;
    coinProgressRef.current = -1;
    capsuleRef.current = {
      x: CAPSULE_LAND_X, y: CHUTE_Y + CHUTE_H - 15,
      vy: 0, bounces: 0, openFraction: 0, visible: false,
      rotation: 0, rotVelocity: 0, phase: "hidden",
    };
    setGameStateSync("IDLE");
  }, [setGameStateSync]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== "READY_TO_OPEN") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const cap = capsuleRef.current;
    if (Math.hypot(px - cap.x, py - cap.y) < 45) handleOpenCapsule();
  }, [handleOpenCapsule]);

  // RAF loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    wobbleTimeRef.current += 0.03;
    const t = wobbleTimeRef.current;
    const state = stateRef.current;

    // Capsule physics
    const cap = capsuleRef.current;
    if (cap.phase === "falling") {
      cap.vy += 0.65;
      cap.y += cap.vy;
      cap.rotation += cap.rotVelocity;
      if (cap.y >= CAPSULE_LAND_Y) {
        cap.y = CAPSULE_LAND_Y;
        cap.vy = -cap.vy * 0.5;
        cap.rotVelocity *= -0.4;
        cap.bounces++;
        if (cap.bounces >= 4 || Math.abs(cap.vy) < 1.5) {
          cap.phase = "settled";
          cap.vy = 0;
          cap.rotVelocity = 0;
          cap.y = CAPSULE_LAND_Y;
          cap.rotation = 0;
          setGameStateSync("READY_TO_OPEN");
        }
      }
    } else if (cap.phase === "settled") {
      cap.y = CAPSULE_LAND_Y + Math.sin(t * 2.5) * 2;
      cap.rotation = Math.sin(t * 1.5) * 0.05;
    } else if (cap.phase === "opening") {
      if (stateRef.current === "OPENING" || stateRef.current === "RESULT") {
        cap.openFraction = Math.min(1, cap.openFraction + 0.022);
        if (cap.openFraction >= 1 && stateRef.current !== "RESULT") {
          setGameStateSync("RESULT");
          onResult?.(resultGrade);
        }
      }
    }

    if (state === "OPENING" && cap.phase === "settled") cap.phase = "opening";

    // Handle inertia
    if (!isDraggingHandleRef.current && state === "IDLE") {
      handleVelocityRef.current *= 0.86;
      if (Math.abs(handleVelocityRef.current) > 0.1) {
        handleAngleRef.current += handleVelocityRef.current;
        if (handleVelocityRef.current > 0) totalRotationRef.current += handleVelocityRef.current;
        if (totalRotationRef.current >= 360) {
          totalRotationRef.current = 0;
          triggerDispense();
        }
      }
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#100a00");
    bgGrad.addColorStop(1, "#06030a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw order: body → dome → capsule → handle → coin anim → UI

    // Machine body (3D)
    drawMachineBody3D(ctx, t);

    // Hemisphere dome with capsules inside
    drawHemisphereDome(ctx, t);

    // Handle (3D knob)
    const isInteractable = state === "IDLE";
    drawHandle3D(ctx, handleAngleRef.current, t, isInteractable);

    // Rotation arc
    if (state === "IDLE" && totalRotationRef.current > 0) {
      const progress = Math.min(1, totalRotationRef.current / 360);
      ctx.strokeStyle = `rgba(251,191,36,${0.4 + progress * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(HANDLE_CX, HANDLE_CY, HANDLE_R + 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }

    // Capsule (main)
    if (cap.visible) {
      ctx.save();
      if (state === "READY_TO_OPEN") {
        ctx.shadowColor = GRADE_CAPSULE[resultGrade]?.glow ?? "#f59e0b";
        ctx.shadowBlur = 16 + Math.sin(t * 4) * 6;
      }
      drawCapsule3D(ctx, cap.x, cap.y, 28, resultGrade, 1, cap.openFraction, cap.rotation);
      ctx.restore();

      // Click hint
      if (state === "READY_TO_OPEN") {
        const pulse = 0.65 + Math.sin(t * 5) * 0.35;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 10;
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("點擊扭蛋打開！", cap.x, cap.y - 38);
        ctx.restore();
      }

      // Result text
      if (state === "RESULT" && cap.openFraction > 0.65) {
        const resultAlpha = (cap.openFraction - 0.65) / 0.35;
        const col = GRADE_CAPSULE[resultGrade] ?? GRADE_CAPSULE["D賞"]!;
        ctx.save();
        ctx.globalAlpha = resultAlpha;
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = 22;
        const resGrad = ctx.createLinearGradient(0, cap.y - 65, CANVAS_W, cap.y - 65);
        resGrad.addColorStop(0, col.topDark);
        resGrad.addColorStop(0.5, col.topLight);
        resGrad.addColorStop(1, col.topDark);
        ctx.fillStyle = resGrad;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          `✨ ${resultGrade}${prizeName ? ` — ${prizeName}` : ""} ✨`,
          CANVAS_W / 2, cap.y - 50,
        );
        ctx.restore();
      }
    }

    // Coin insert animation
    if (coinProgressRef.current >= 0 && coinProgressRef.current <= 1) {
      drawCoinAnimation(ctx, coinProgressRef.current);
    }

    // Idle instruction
    if (state === "IDLE") {
      ctx.fillStyle = "#f9a95baa";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("拖曳把手旋轉 360°，或按「自動旋轉」", CANVAS_W / 2, CANVAS_H - 16);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName, onResult, setGameStateSync, triggerDispense]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  const isInteractable = gameState === "IDLE";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-orange-900/60 shadow-2xl block"
        style={{
          background: "#100a00",
          touchAction: "none",
          maxWidth: "100%",
          cursor: gameState === "IDLE" ? "grab" : gameState === "READY_TO_OPEN" ? "pointer" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onClick={handleCanvasClick}
      />

      <div className="flex gap-3">
        <button
          onClick={handleAutoTurn}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-orange-600 hover:bg-orange-500 active:scale-95 text-white shadow-orange-500/30 cursor-pointer"
              : "bg-gray-800 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          自動旋轉
        </button>
        {gameState === "READY_TO_OPEN" && (
          <button
            onClick={handleOpenCapsule}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 active:scale-95 text-white shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
          >
            打開扭蛋！
          </button>
        )}
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
            : gameState === "READY_TO_OPEN" ? "text-emerald-400"
            : gameState === "DISPENSING" || gameState === "BOUNCING" || gameState === "COIN_INSERT" ? "text-orange-400"
            : "text-gray-400"
        }>
          {gameState}
        </span>
      </div>
    </div>
  );
}
