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
const HANDLE_R = 26;
const HANDLE_ARM_LEN = 30;

// Coin slot (top of body)
const COIN_SLOT_X = MACHINE_CX - 14;
const COIN_SLOT_Y = BODY_TOP_Y + 14;

// Capsule landing spot
const CAPSULE_LAND_X = MACHINE_CX;
const CAPSULE_LAND_Y = 460;

// Screw positions (corners of body)
const BODY_SCREWS = [
  { x: BODY_X + 10,          y: BODY_TOP_Y + 10 },
  { x: BODY_X + BODY_W - 10, y: BODY_TOP_Y + 10 },
  { x: BODY_X + 10,          y: BODY_BOTTOM_Y - 10 },
  { x: BODY_X + BODY_W - 10, y: BODY_BOTTOM_Y - 10 },
];

// Grade colors for capsules (with 3D shading data)
const GRADE_CAPSULE: Record<string, { topLight: string; topDark: string; bottomLight: string; bottomDark: string; glow: string }> = {
  "A賞": { topLight: "#fde68a", topDark: "#d97706", bottomLight: "#92400e", bottomDark: "#451a03", glow: "#f59e0b" },
  "B賞": { topLight: "#bae6fd", topDark: "#0369a1", bottomLight: "#1e40af", bottomDark: "#1e3a5f", glow: "#3b82f6" },
  "C賞": { topLight: "#a7f3d0", topDark: "#059669", bottomLight: "#065f46", bottomDark: "#022c22", glow: "#10b981" },
  "D賞": { topLight: "#ddd6fe", topDark: "#7c3aed", bottomLight: "#4c1d95", bottomDark: "#2e1065", glow: "#a855f7" },
};

// Mini capsule positions with depth (z: -1=back, 0=mid, 1=front)
const MINI_CAPSULE_POSITIONS: Array<{ x: number; y: number; grade: string; z: number }> = [
  { x: -58, y: -45, grade: "B賞", z: -0.8 },
  { x: -18, y: -58, grade: "C賞", z: -0.5 },
  { x: 28,  y: -48, grade: "A賞", z:  0.3 },
  { x: 58,  y: -32, grade: "D賞", z:  0.7 },
  { x: -48, y:  -8, grade: "C賞", z: -0.6 },
  { x:   2, y: -12, grade: "B賞", z:  0.1 },
  { x:  42, y:   4, grade: "A賞", z:  0.9 },
  { x: -68, y:  22, grade: "D賞", z: -0.9 },
  { x: -28, y:  28, grade: "C賞", z: -0.2 },
  { x:  22, y:  32, grade: "B賞", z:  0.5 },
  { x:  62, y:  28, grade: "A賞", z:  0.8 },
  { x: -52, y:  58, grade: "D賞", z: -0.7 },
  { x:   4, y:  62, grade: "C賞", z:  0.4 },
  { x:  48, y:  52, grade: "B賞", z:  0.6 },
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
  rotation = 0,
) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"]!;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  if (openFraction < 0.01) {
    // ── Closed capsule ──

    // Drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    // Bottom half — two-tone with side shading
    const botGrad = ctx.createLinearGradient(-r, 0, r, r * 0.9);
    botGrad.addColorStop(0,   col.bottomLight);
    botGrad.addColorStop(0.4, col.bottomLight);
    botGrad.addColorStop(0.75, col.bottomDark);
    botGrad.addColorStop(1,   col.bottomDark);
    ctx.fillStyle = botGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Top half — contrasting lighter color
    const topGrad = ctx.createLinearGradient(-r, -r * 0.9, r, 0);
    topGrad.addColorStop(0,   col.topLight);
    topGrad.addColorStop(0.45, col.topLight);
    topGrad.addColorStop(0.85, col.topDark);
    topGrad.addColorStop(1,   col.topDark);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Seam line (prominent physical divide)
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    // Seam highlight
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r, -1);
    ctx.lineTo(r, -1);
    ctx.stroke();

    // Side rim darkening (adds spherical feel)
    const rimGrad = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
    rimGrad.addColorStop(0,   "rgba(0,0,0,0)");
    rimGrad.addColorStop(0.7, "rgba(0,0,0,0)");
    rimGrad.addColorStop(1,   "rgba(0,0,0,0.35)");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight (shifts up for higher positions — simulated by alpha driven externally)
    const hlGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.38, 0, -r * 0.1, -r * 0.2, r * 0.52);
    hlGrad.addColorStop(0,   "rgba(255,255,255,0.65)");
    hlGrad.addColorStop(0.45,"rgba(255,255,255,0.22)");
    hlGrad.addColorStop(1,   "rgba(255,255,255,0)");
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Small secondary glint
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.26, -r * 0.44, r * 0.2, r * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // ── Opening animation: spring separation ──
    // Spring easing: top half overshoots slightly then settles
    const spring = openFraction < 0.5
      ? openFraction * 2
      : 1 + Math.sin((openFraction - 0.5) * Math.PI * 3) * (1 - openFraction) * 0.3;
    const topOffY = -spring * r * 2.6;

    // Bottom half stays
    const botGrad = ctx.createLinearGradient(-r, 0, r, r * 0.9);
    botGrad.addColorStop(0,   col.bottomLight);
    botGrad.addColorStop(0.75, col.bottomDark);
    ctx.fillStyle = botGrad;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Inner glow revealed (pulsing)
    if (openFraction > 0.12) {
      const innerAlpha = Math.min(1, (openFraction - 0.12) / 0.3);
      const pulseScale = 1 + Math.sin(openFraction * Math.PI * 6) * 0.08 * (1 - openFraction);
      const innerGlow = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.9 * pulseScale);
      innerGlow.addColorStop(0,   `${col.glow}ee`);
      innerGlow.addColorStop(0.5, `${col.glow}88`);
      innerGlow.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalAlpha = alpha * innerAlpha;
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.5, 0, 0, Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // Top half lifts up with spring
    ctx.save();
    ctx.translate(0, topOffY);
    const topGrad = ctx.createLinearGradient(-r, -r * 0.9, r, 0);
    topGrad.addColorStop(0,   col.topLight);
    topGrad.addColorStop(0.85, col.topDark);
    ctx.fillStyle = topGrad;
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 8 * openFraction;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Seam on lifted top
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.stroke();

    // Highlight on top half
    const topHlGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.32, 0, 0, 0, r * 0.72);
    topHlGrad.addColorStop(0, "rgba(255,255,255,0.55)");
    topHlGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = topHlGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    // Prize grade letter rises from inside
    if (openFraction > 0.38) {
      const prizeAlpha = Math.min(1, (openFraction - 0.38) / 0.45);
      const prizeRise = (openFraction - 0.38) * r * 1.4;
      ctx.save();
      ctx.globalAlpha = alpha * prizeAlpha;
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 18 * openFraction;
      ctx.fillStyle = col.topLight;
      ctx.font = `bold ${r * 0.78}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grade.charAt(0), 0, r * 0.3 - prizeRise * 0.4);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawMiniCapsule3D(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  grade: string,
  wobble: number,
  depthZ: number,   // -1..1, affects size/brightness
  tumbleAngle: number,
) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"]!;
  // Depth scaling: back capsules smaller/darker, front ones larger/brighter
  const depthScale = 0.72 + (depthZ + 1) * 0.14; // 0.72..1.0
  const r = 10 * depthScale;
  const depthAlpha = 0.55 + (depthZ + 1) * 0.22; // dimmer at back

  const wx = Math.sin(wobble) * 1.8;
  const wy = Math.cos(wobble * 0.8) * 1.2;

  ctx.save();
  ctx.globalAlpha = depthAlpha;
  ctx.translate(cx + wx, cy + wy);
  ctx.rotate(tumbleAngle);

  // Bottom half
  const botGrad = ctx.createLinearGradient(-r, 0, r, r * 0.9);
  botGrad.addColorStop(0, col.bottomLight);
  botGrad.addColorStop(0.7, col.bottomDark);
  ctx.fillStyle = botGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Top half
  const topGrad = ctx.createLinearGradient(-r, -r * 0.9, r, 0);
  topGrad.addColorStop(0, col.topLight);
  topGrad.addColorStop(1, col.topDark);
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Seam
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-r, -0.7); ctx.lineTo(r, -0.7);
  ctx.stroke();

  // Specular highlight (brighter for front capsules)
  const hlAlpha = 0.25 + (depthZ + 1) * 0.15;
  ctx.fillStyle = `rgba(255,255,255,${hlAlpha})`;
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.38, r * 0.25, r * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine body drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawScrew(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Screw head
  const screwGrad = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5);
  screwGrad.addColorStop(0,  "#e2e8f0");
  screwGrad.addColorStop(0.4,"#94a3b8");
  screwGrad.addColorStop(1,  "#334155");
  ctx.fillStyle = screwGrad;
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cross slot
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 2.5, y); ctx.lineTo(x + 2.5, y);
  ctx.moveTo(x, y - 2.5); ctx.lineTo(x, y + 2.5);
  ctx.stroke();
  // Highlight on slot
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - 2.2, y - 0.4); ctx.lineTo(x + 2.2, y - 0.4);
  ctx.stroke();
}

function drawMachineBody3D(ctx: CanvasRenderingContext2D, t: number) {
  const sideDepth = 10;

  // ── Legs / base platform — wider at bottom for stability ──
  const baseY = BODY_BOTTOM_Y;
  const baseW = BODY_W + 40;  // wider than body
  const baseX = MACHINE_CX - baseW / 2;
  const base2W = baseW + 16;  // even wider second tier
  const base2X = MACHINE_CX - base2W / 2;

  // Deep ground shadow
  ctx.save();
  const groundShadow = ctx.createRadialGradient(MACHINE_CX, baseY + 50, 10, MACHINE_CX, baseY + 50, 90);
  groundShadow.addColorStop(0, "rgba(0,0,0,0.55)");
  groundShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = groundShadow;
  ctx.beginPath();
  ctx.ellipse(MACHINE_CX, baseY + 44, 95, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Second tier base (wider, darker)
  const base2Grad = ctx.createLinearGradient(base2X, baseY + 18, base2X + base2W, baseY + 38);
  base2Grad.addColorStop(0, "#1f0f04");
  base2Grad.addColorStop(1, "#0d0702");
  ctx.fillStyle = base2Grad;
  ctx.strokeStyle = "#7c3409";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(base2X, baseY + 18, base2W, 18, [0, 0, 6, 6]);
  ctx.fill();
  ctx.stroke();

  // First tier base
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX + baseW, baseY + 22);
  baseGrad.addColorStop(0, "#3d1f0a");
  baseGrad.addColorStop(0.5, "#4a2510");
  baseGrad.addColorStop(1, "#1f0f04");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.roundRect(baseX, baseY - 6, baseW, 26, [0, 0, 8, 8]);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(baseX, baseY - 6, baseW, 26, [0, 0, 8, 8]);
  ctx.stroke();

  // Legs
  const legW = 18, legH = 28;
  const legPositions = [baseX + 18, baseX + baseW - 36];
  for (const lx of legPositions) {
    // Right face depth
    ctx.fillStyle = "#1f0f04";
    ctx.beginPath();
    ctx.moveTo(lx + legW,               baseY + 18);
    ctx.lineTo(lx + legW + sideDepth * 0.7, baseY + 18 - sideDepth * 0.35);
    ctx.lineTo(lx + legW + sideDepth * 0.7, baseY + 18 + legH - sideDepth * 0.35);
    ctx.lineTo(lx + legW,               baseY + 18 + legH);
    ctx.closePath();
    ctx.fill();

    const legGrad = ctx.createLinearGradient(lx, baseY + 18, lx + legW, baseY + 18 + legH);
    legGrad.addColorStop(0, "#7c2d12");
    legGrad.addColorStop(1, "#431407");
    ctx.fillStyle = legGrad;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, baseY + 18, legW, legH, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();
  }

  // ── Body main front face ──
  // Right face (depth)
  const rightFGrad = ctx.createLinearGradient(BODY_X + BODY_W, BODY_TOP_Y, BODY_X + BODY_W + sideDepth, BODY_TOP_Y + BODY_H);
  rightFGrad.addColorStop(0, "#431407");
  rightFGrad.addColorStop(1, "#1f0f04");
  ctx.fillStyle = rightFGrad;
  ctx.beginPath();
  ctx.moveTo(BODY_X + BODY_W,              BODY_TOP_Y + 10);
  ctx.lineTo(BODY_X + BODY_W + sideDepth,  BODY_TOP_Y + 10 - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W + sideDepth,  BODY_BOTTOM_Y - sideDepth * 0.5);
  ctx.lineTo(BODY_X + BODY_W,              BODY_BOTTOM_Y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ea580c33";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Front face
  const bodyGrad = ctx.createLinearGradient(BODY_X, BODY_TOP_Y, BODY_X + BODY_W, BODY_BOTTOM_Y);
  bodyGrad.addColorStop(0,   "#9a3412");
  bodyGrad.addColorStop(0.3, "#c2410c");
  bodyGrad.addColorStop(0.7, "#b91c1c");
  bodyGrad.addColorStop(1,   "#7f1d1d");
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

  // ── Corner screws ──
  for (const screw of BODY_SCREWS) {
    drawScrew(ctx, screw.x, screw.y);
  }

  // Blinking lights on body
  drawBodyLights(ctx, t);

  // ── Manufacturer sticker ──
  drawManufacturerSticker(ctx, t);

  // ── Coin slot with metallic housing ──
  drawCoinSlot(ctx, t);

  // ── Last prize display window ──
  drawLastPrizeWindow(ctx);

  // ── Chute with depth ──
  drawChute3D(ctx);
}

function drawBodyLights(ctx: CanvasRenderingContext2D, t: number) {
  const lightColors = ["#f59e0b", "#fb923c", "#fbbf24", "#f97316"];
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

function drawManufacturerSticker(ctx: CanvasRenderingContext2D, t: number) {
  // Label panel at top of body
  const lbX = BODY_X + 8;
  const lbY = BODY_TOP_Y + 18;
  const lbW = BODY_W - 16;
  const lbH = 30;

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

  // Sticker inner shine
  const stickerShine = ctx.createLinearGradient(lbX, lbY, lbX, lbY + lbH);
  stickerShine.addColorStop(0, "rgba(255,255,255,0.06)");
  stickerShine.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = stickerShine;
  ctx.beginPath();
  ctx.roundRect(lbX, lbY, lbW, lbH, 4);
  ctx.fill();

  const pulse = 0.75 + Math.sin(t * 3) * 0.25;
  ctx.save();
  ctx.globalAlpha = pulse;

  const textGrad = ctx.createLinearGradient(lbX, lbY, lbX + lbW, lbY);
  textGrad.addColorStop(0,   "#fbbf24");
  textGrad.addColorStop(0.5, "#fde68a");
  textGrad.addColorStop(1,   "#fbbf24");
  ctx.fillStyle = textGrad;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 8;
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GACHA  扭蛋機", MACHINE_CX, lbY + lbH * 0.45);
  ctx.restore();

  // Small "PrizeDraw Corp." sub-label
  ctx.fillStyle = "rgba(251,146,60,0.55)";
  ctx.font = "6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PrizeDraw Corp.  Model GX-100", MACHINE_CX, lbY + lbH * 0.78);
}

function drawCoinSlot(ctx: CanvasRenderingContext2D, _t: number) {
  const slotW = 46, slotH = 22;
  const slotX = COIN_SLOT_X - 5;
  const slotY = COIN_SLOT_Y + 60;

  // Metallic housing outer
  const housingGrad = ctx.createLinearGradient(slotX, slotY, slotX + slotW, slotY + slotH);
  housingGrad.addColorStop(0,   "#64748b");
  housingGrad.addColorStop(0.3, "#94a3b8");
  housingGrad.addColorStop(0.6, "#475569");
  housingGrad.addColorStop(1,   "#1e293b");
  ctx.fillStyle = housingGrad;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(slotX, slotY, slotW, slotH, 4);
  ctx.fill();
  ctx.stroke();

  // Housing bevel highlight
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(slotX + 1, slotY + 1, slotW - 2, slotH * 0.5, 3);
  ctx.stroke();

  // Coin opening slit
  ctx.fillStyle = "#020810";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(slotX + 8, slotY + 7, slotW - 16, 6, 2);
  ctx.fill();
  ctx.stroke();

  // Slit glint
  ctx.strokeStyle = "rgba(148,163,184,0.4)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(slotX + 9, slotY + 7.5);
  ctx.lineTo(slotX + slotW - 9, slotY + 7.5);
  ctx.stroke();

  // "INSERT COIN" label
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("INSERT COIN  投幣", slotX + slotW / 2, slotY + 1.5);

  // Price tag
  ctx.fillStyle = "rgba(251,146,60,0.8)";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("¥100", slotX + slotW / 2, slotY + slotH - 1);
}

function drawLastPrizeWindow(ctx: CanvasRenderingContext2D) {
  // Small display window on body lower section
  const winX = BODY_X + 10;
  const winY = BODY_TOP_Y + BODY_H * 0.56;
  const winW = BODY_W - 20;
  const winH = 28;

  // Window frame
  const frameGrad = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH);
  frameGrad.addColorStop(0,   "#1e293b");
  frameGrad.addColorStop(0.5, "#334155");
  frameGrad.addColorStop(1,   "#0f172a");
  ctx.fillStyle = frameGrad;
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(winX, winY, winW, winH, 4);
  ctx.fill();
  ctx.stroke();

  // Screen tint (dark LCD look)
  const screenGrad = ctx.createLinearGradient(winX + 3, winY + 3, winX + 3, winY + winH - 3);
  screenGrad.addColorStop(0,   "rgba(16,185,129,0.08)");
  screenGrad.addColorStop(1,   "rgba(16,185,129,0.03)");
  ctx.fillStyle = screenGrad;
  ctx.beginPath();
  ctx.roundRect(winX + 3, winY + 3, winW - 6, winH - 6, 2);
  ctx.fill();

  // Label
  ctx.fillStyle = "rgba(52,211,153,0.5)";
  ctx.font = "5px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("LAST PRIZE", winX + 5, winY + 4);

  // Prize value area
  ctx.fillStyle = "rgba(52,211,153,0.8)";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("-- PLAY NOW --", winX + winW / 2, winY + winH * 0.66);

  // Screen glare
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.beginPath();
  ctx.roundRect(winX + 3, winY + 3, winW - 6, (winH - 6) * 0.4, [2, 2, 0, 0]);
  ctx.fill();
}

function drawChute3D(ctx: CanvasRenderingContext2D) {
  const cW = CHUTE_W, cH = CHUTE_H;
  const cx = CHUTE_X;
  const cy = CHUTE_Y;
  const sideD = 8;

  // Right face depth
  ctx.fillStyle = "#431407";
  ctx.beginPath();
  ctx.moveTo(cx + cW,          cy + 4);
  ctx.lineTo(cx + cW + sideD,  cy + 4 - sideD * 0.4);
  ctx.lineTo(cx + cW + sideD,  cy + cH - sideD * 0.4);
  ctx.lineTo(cx + cW,          cy + cH);
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

  // Channel/rail guides inside chute (visible track the capsule rolls through)
  ctx.strokeStyle = "rgba(251,146,60,0.35)";
  ctx.lineWidth = 1;
  const railInset = 10;
  ctx.beginPath();
  ctx.moveTo(cx + railInset, cy + 6);
  ctx.lineTo(cx + railInset, cy + cH - 18);
  ctx.moveTo(cx + cW - railInset, cy + 6);
  ctx.lineTo(cx + cW - railInset, cy + cH - 18);
  ctx.stroke();

  // Opening (dark hole)
  ctx.fillStyle = "#050205";
  ctx.beginPath();
  ctx.roundRect(cx + 6, cy + 6, cW - 12, cH - 22, 3);
  ctx.fill();

  // Chute interior glow hint
  const chuteGlow = ctx.createLinearGradient(cx + 6, cy + 6, cx + 6, cy + cH - 22);
  chuteGlow.addColorStop(0, "rgba(251,146,60,0.08)");
  chuteGlow.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = chuteGlow;
  ctx.beginPath();
  ctx.roundRect(cx + 6, cy + 6, cW - 12, cH - 22, 3);
  ctx.fill();

  // Flap at bottom
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

function drawHemisphereDome(
  ctx: CanvasRenderingContext2D,
  t: number,
  handleAngle: number,
  isTurning: boolean,
) {
  // ── Dome base ring ──
  const ringGrad = ctx.createLinearGradient(
    DOME_CX - DOME_R, DOME_CY + DOME_R * 0.85,
    DOME_CX + DOME_R, DOME_CY + DOME_R * 0.85
  );
  ringGrad.addColorStop(0,   "#431407");
  ringGrad.addColorStop(0.5, "#9a3412");
  ringGrad.addColorStop(1,   "#431407");
  ctx.fillStyle = ringGrad;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY + DOME_R * 0.88, DOME_R * 0.7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ── Outer dome glow ──
  const outerGlow = ctx.createRadialGradient(DOME_CX, DOME_CY, DOME_R * 0.85, DOME_CX, DOME_CY, DOME_R * 1.1);
  outerGlow.addColorStop(0, "rgba(56,189,248,0)");
  outerGlow.addColorStop(1, "rgba(56,189,248,0.10)");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // ── Sphere depth layers (multi-layer radial for true hemisphere feel) ──
  // Layer 1: dark rim
  const rimDepth = ctx.createRadialGradient(DOME_CX, DOME_CY, DOME_R * 0.62, DOME_CX, DOME_CY, DOME_R);
  rimDepth.addColorStop(0,   "rgba(7,89,133,0)");
  rimDepth.addColorStop(0.65,"rgba(7,89,133,0.03)");
  rimDepth.addColorStop(1,   "rgba(2,30,60,0.22)");
  ctx.fillStyle = rimDepth;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // Layer 2: bright centre-top (light entering from top of sphere)
  const centreLight = ctx.createRadialGradient(
    DOME_CX - DOME_R * 0.1, DOME_CY - DOME_R * 0.35, 0,
    DOME_CX, DOME_CY, DOME_R * 0.85
  );
  centreLight.addColorStop(0,   "rgba(186,230,253,0.14)");
  centreLight.addColorStop(0.4, "rgba(186,230,253,0.05)");
  centreLight.addColorStop(1,   "rgba(186,230,253,0)");
  ctx.fillStyle = centreLight;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // Layer 3: bottom interior ambient (slightly warmer from machine body)
  const bottomAmbient = ctx.createRadialGradient(DOME_CX, DOME_CY + DOME_R * 0.5, 0, DOME_CX, DOME_CY + DOME_R * 0.5, DOME_R * 0.7);
  bottomAmbient.addColorStop(0,   "rgba(234,88,12,0.05)");
  bottomAmbient.addColorStop(1,   "rgba(234,88,12,0)");
  ctx.fillStyle = bottomAmbient;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // ── Caustic light pattern (wavy bright spots — refraction through glass) ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R - 4, 0, Math.PI * 2);
  ctx.clip();
  const causticCount = 5;
  for (let ci = 0; ci < causticCount; ci++) {
    const ca = (t * 0.4 + ci * (Math.PI * 2 / causticCount));
    const cr = DOME_R * (0.25 + 0.3 * Math.abs(Math.sin(t * 0.3 + ci)));
    const ccx = DOME_CX + Math.cos(ca) * cr * 0.6;
    const ccy = DOME_CY - DOME_R * 0.1 + Math.sin(ca * 1.3) * cr * 0.35;
    const cSize = 12 + 8 * Math.abs(Math.sin(t * 0.7 + ci * 1.1));
    const causticG = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cSize);
    causticG.addColorStop(0,   "rgba(255,255,255,0.07)");
    causticG.addColorStop(0.5, "rgba(186,230,253,0.03)");
    causticG.addColorStop(1,   "rgba(255,255,255,0)");
    ctx.fillStyle = causticG;
    ctx.beginPath();
    ctx.ellipse(ccx, ccy, cSize, cSize * 0.55, ca * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── Mini capsules (depth-sorted: back first) ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R - 5, 0, Math.PI * 2);
  ctx.clip();

  // Sort by z so back capsules draw first, front ones on top
  const sortedCapsules = [...MINI_CAPSULE_POSITIONS].sort((a, b) => a.z - b.z);

  // Handle rotation shifts capsule positions (tumbling physics)
  const tumbleBase = isTurning ? handleAngle * 0.012 : t * 0.18;
  for (const mc of sortedCapsules) {
    // Tumble: each capsule shifts slightly when handle rotates
    const tumbleOffset = Math.sin(tumbleBase + mc.x * 0.06) * (isTurning ? 5 : 1.5);
    const tumbleAngle = tumbleBase * 0.8 + mc.y * 0.04;
    const shiftX = isTurning ? Math.cos(tumbleBase + mc.y * 0.05) * 4 : 0;
    const shiftY = isTurning ? Math.sin(tumbleBase + mc.x * 0.07) * 3 : 0;
    drawMiniCapsule3D(
      ctx,
      DOME_CX + mc.x + shiftX + tumbleOffset * Math.sign(mc.x || 1),
      DOME_CY + mc.y + shiftY,
      mc.grade,
      t + mc.x * 0.08,
      mc.z,
      tumbleAngle,
    );
  }
  ctx.restore();

  // ── Chrome rim where dome meets body ──
  ctx.save();
  // Thick chrome ring
  const chromeRimGrad = ctx.createLinearGradient(
    DOME_CX - DOME_R, DOME_CY + DOME_R * 0.82,
    DOME_CX + DOME_R, DOME_CY + DOME_R * 0.82
  );
  chromeRimGrad.addColorStop(0,    "#1e293b");
  chromeRimGrad.addColorStop(0.12, "#94a3b8");
  chromeRimGrad.addColorStop(0.28, "#e2e8f0");
  chromeRimGrad.addColorStop(0.5,  "#f8fafc");
  chromeRimGrad.addColorStop(0.72, "#cbd5e1");
  chromeRimGrad.addColorStop(0.88, "#475569");
  chromeRimGrad.addColorStop(1,    "#1e293b");
  ctx.strokeStyle = chromeRimGrad;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY, DOME_R * 1.0, DOME_R * 0.84, 0, Math.PI * 0.04, Math.PI * 0.96);
  ctx.stroke();
  // Chrome rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY - 2, DOME_R * 1.0, DOME_R * 0.84, 0, Math.PI * 0.05, Math.PI * 0.5);
  ctx.stroke();
  // Chrome rim shadow
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(DOME_CX, DOME_CY + 2, DOME_R * 1.0, DOME_R * 0.84, 0, Math.PI * 0.5, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();

  // ── Glass outer rim glow ──
  ctx.save();
  ctx.shadowColor = "rgba(186,230,253,0.5)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(186,230,253,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ── Primary glass highlight (top-left reflection) ──
  const hlGrad = ctx.createRadialGradient(
    DOME_CX - DOME_R * 0.38, DOME_CY - DOME_R * 0.42, 0,
    DOME_CX - DOME_R * 0.2,  DOME_CY - DOME_R * 0.25, DOME_R * 0.5
  );
  hlGrad.addColorStop(0,   "rgba(255,255,255,0.24)");
  hlGrad.addColorStop(0.5, "rgba(255,255,255,0.09)");
  hlGrad.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
  ctx.fill();

  // ── Secondary streak highlights ──
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(DOME_CX - DOME_R * 0.5,  DOME_CY - DOME_R * 0.6);
  ctx.lineTo(DOME_CX - DOME_R * 0.15, DOME_CY + DOME_R * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(DOME_CX - DOME_R * 0.2, DOME_CY - DOME_R * 0.7);
  ctx.lineTo(DOME_CX + DOME_R * 0.1, DOME_CY + DOME_R * 0.1);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawHandle3D(
  ctx: CanvasRenderingContext2D,
  handleAngle: number,
  t: number,
  isInteractable: boolean,
  totalRotation: number,
  justCompleted: boolean,
) {
  const hcx = HANDLE_CX;
  const hcy = HANDLE_CY;

  // Mount plate on body
  const mountGrad = ctx.createLinearGradient(hcx - 18, hcy - 10, hcx + 6, hcy + 10);
  mountGrad.addColorStop(0,   "#64748b");
  mountGrad.addColorStop(0.3, "#94a3b8");
  mountGrad.addColorStop(0.7, "#475569");
  mountGrad.addColorStop(1,   "#1e293b");
  ctx.fillStyle = mountGrad;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hcx - 18, hcy - 12, 20, 24, 4);
  ctx.fill();
  ctx.stroke();
  // Mount highlight
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(hcx - 17, hcy - 11, 18, 10, 3);
  ctx.stroke();

  // ── Gear teeth visible near pivot ──
  const gearR = 13;
  const teethCount = 10;
  ctx.save();
  ctx.translate(hcx, hcy);
  ctx.rotate((handleAngle * Math.PI) / 180);
  for (let gi = 0; gi < teethCount; gi++) {
    const ga = (gi / teethCount) * Math.PI * 2;
    const tx1 = Math.cos(ga) * gearR;
    const ty1 = Math.sin(ga) * gearR;
    const tx2 = Math.cos(ga) * (gearR + 4);
    const ty2 = Math.sin(ga) * (gearR + 4);
    const toothW = 0.18;
    const tx3 = Math.cos(ga + toothW) * (gearR + 4);
    const ty3 = Math.sin(ga + toothW) * (gearR + 4);
    const tx4 = Math.cos(ga + toothW) * gearR;
    const ty4 = Math.sin(ga + toothW) * gearR;

    const gearTeethGrad = ctx.createLinearGradient(tx1, ty1, tx2, ty2);
    gearTeethGrad.addColorStop(0, "#64748b");
    gearTeethGrad.addColorStop(1, "#334155");
    ctx.fillStyle = gearTeethGrad;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.lineTo(tx3, ty3);
    ctx.lineTo(tx4, ty4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Central hub (chrome 3D)
  const hubGrad = ctx.createRadialGradient(hcx - 4, hcy - 4, 1, hcx, hcy, 13);
  hubGrad.addColorStop(0,   "#e2e8f0");
  hubGrad.addColorStop(0.35,"#94a3b8");
  hubGrad.addColorStop(0.7, "#475569");
  hubGrad.addColorStop(1,   "#1e293b");
  ctx.fillStyle = hubGrad;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hcx, hcy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hub centre dot
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.arc(hcx, hcy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.arc(hcx, hcy, 2, 0, Math.PI * 2);
  ctx.fill();

  // ── Arm rotation with notch pauses ──
  const armRad = (handleAngle * Math.PI) / 180;
  const knobX = hcx + Math.cos(armRad) * HANDLE_ARM_LEN;
  const knobY = hcy + Math.sin(armRad) * HANDLE_ARM_LEN;

  // Arm shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hcx + 2, hcy + 2);
  ctx.lineTo(knobX + 2, knobY + 2);
  ctx.stroke();
  ctx.restore();

  // Arm body — chrome metallic
  const armGrad = ctx.createLinearGradient(hcx, hcy - 4, hcx, hcy + 4);
  armGrad.addColorStop(0,   "#e2e8f0");
  armGrad.addColorStop(0.35,"#94a3b8");
  armGrad.addColorStop(0.65,"#64748b");
  armGrad.addColorStop(1,   "#334155");
  ctx.strokeStyle = armGrad;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hcx, hcy);
  ctx.lineTo(knobX, knobY);
  ctx.stroke();

  // Arm highlight streak
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hcx, hcy);
  ctx.lineTo(knobX, knobY);
  ctx.stroke();

  // Arm edge shadow
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hcx, hcy + 4);
  ctx.lineTo(knobX, knobY + 4);
  ctx.stroke();

  // ── Knob: large 3D marble-sphere with swirl ──
  const completedGlow = justCompleted ? (0.6 + Math.sin(t * 12) * 0.4) : 0;

  // Knob glow when interactable or just completed
  if (isInteractable) {
    ctx.shadowColor = justCompleted ? "#fde68a" : "#f59e0b";
    ctx.shadowBlur = justCompleted
      ? 24 + Math.sin(t * 10) * 10
      : 14 + Math.sin(t * 3) * 5;
  }

  // Knob base gradient (marble look)
  const knobGrad = ctx.createRadialGradient(
    knobX - HANDLE_R * 0.38, knobY - HANDLE_R * 0.38, HANDLE_R * 0.08,
    knobX, knobY, HANDLE_R
  );
  knobGrad.addColorStop(0,   "#fef9c3");
  knobGrad.addColorStop(0.25,"#fde68a");
  knobGrad.addColorStop(0.55,"#f59e0b");
  knobGrad.addColorStop(0.8, "#b45309");
  knobGrad.addColorStop(1,   "#78350f");
  ctx.fillStyle = knobGrad;
  ctx.strokeStyle = justCompleted ? "#fde68a" : "#fbbf24";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(knobX, knobY, HANDLE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Swirl lines (marble pattern)
  ctx.save();
  ctx.beginPath();
  ctx.arc(knobX, knobY, HANDLE_R - 1, 0, Math.PI * 2);
  ctx.clip();
  const swirlOffset = handleAngle * 0.008;
  for (let si = 0; si < 3; si++) {
    const sa = swirlOffset + si * (Math.PI * 2 / 3);
    ctx.strokeStyle = `rgba(254,243,199,${0.18 - si * 0.04})`;
    ctx.lineWidth = 2.5 - si * 0.5;
    ctx.beginPath();
    ctx.moveTo(
      knobX + Math.cos(sa) * HANDLE_R * 0.1,
      knobY + Math.sin(sa) * HANDLE_R * 0.1,
    );
    ctx.bezierCurveTo(
      knobX + Math.cos(sa + 1.2) * HANDLE_R * 0.6,
      knobY + Math.sin(sa + 0.8) * HANDLE_R * 0.6,
      knobX + Math.cos(sa + 2.1) * HANDLE_R * 0.5,
      knobY + Math.sin(sa + 1.9) * HANDLE_R * 0.5,
      knobX + Math.cos(sa + 2.8) * HANDLE_R * 0.85,
      knobY + Math.sin(sa + 2.6) * HANDLE_R * 0.85,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Rim darkening
  const knobRimGrad = ctx.createRadialGradient(knobX, knobY, HANDLE_R * 0.5, knobX, knobY, HANDLE_R);
  knobRimGrad.addColorStop(0, "rgba(0,0,0,0)");
  knobRimGrad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = knobRimGrad;
  ctx.beginPath();
  ctx.arc(knobX, knobY, HANDLE_R, 0, Math.PI * 2);
  ctx.fill();

  // Knob specular highlight
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.beginPath();
  ctx.ellipse(
    knobX - HANDLE_R * 0.3, knobY - HANDLE_R * 0.3,
    HANDLE_R * 0.4, HANDLE_R * 0.24, -0.5, 0, Math.PI * 2
  );
  ctx.fill();

  // Secondary tiny glint
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(knobX - HANDLE_R * 0.18, knobY - HANDLE_R * 0.42, HANDLE_R * 0.1, HANDLE_R * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // ── Completion snap glow ring ──
  if (justCompleted && completedGlow > 0) {
    ctx.save();
    ctx.globalAlpha = completedGlow * 0.7;
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(hcx, hcy, HANDLE_R + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Rotation progress arc ──
  if (isInteractable && totalRotation > 0) {
    const progress = Math.min(1, totalRotation / 360);
    ctx.strokeStyle = `rgba(251,191,36,${0.4 + progress * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hcx, hcy, HANDLE_R + 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("旋轉", hcx, hcy + HANDLE_R + 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// Coin insert animation
// ─────────────────────────────────────────────────────────────────────────────

function drawCoinAnimation(ctx: CanvasRenderingContext2D, progress: number) {
  const startX = COIN_SLOT_X + 18;
  const startY = DOME_CY - DOME_R - 40;
  const endX = COIN_SLOT_X + 18;
  const endY = COIN_SLOT_Y + 74;

  // Foreshortening: coin flips as it falls — width varies sinusoidally
  const flip = progress * Math.PI * 6;
  const cx = startX + (endX - startX) * progress;
  const cy = startY + (endY - startY) * (progress * progress * 0.3 + progress * 0.7); // slight arc
  const coinW = 22 * Math.abs(Math.cos(flip));
  const coinH = 22;
  const tilt = Math.sin(flip) * 0.4; // slight tilt during flip

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Coin glow
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 14;

  // Coin body
  const coinGrad = ctx.createLinearGradient(-coinW, -coinH / 2, coinW, coinH / 2);
  coinGrad.addColorStop(0,   "#fde68a");
  coinGrad.addColorStop(0.35,"#fbbf24");
  coinGrad.addColorStop(0.6, "#f59e0b");
  coinGrad.addColorStop(1,   "#92400e");
  ctx.fillStyle = coinGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(1, coinW / 2), coinH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin edge rim
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(1, coinW / 2), coinH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Coin surface detail (visible only when facing front)
  if (Math.abs(Math.cos(flip)) > 0.35) {
    const facing = Math.cos(flip) > 0; // heads vs tails
    ctx.fillStyle = facing ? "#92400e" : "#78350f";
    ctx.font = `bold ${Math.max(6, 11 * Math.abs(Math.cos(flip)))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(facing ? "$" : "¥", 0, 0);
  }

  // Specular glint on edge
  if (coinW > 4) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(-coinW * 0.25, -coinH * 0.28, coinW * 0.18, coinH * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Capsule rolling through chute
// ─────────────────────────────────────────────────────────────────────────────

function drawCapsuleInChute(
  ctx: CanvasRenderingContext2D,
  chuteProgress: number, // 0=top, 1=exit
  grade: string,
) {
  if (chuteProgress < 0 || chuteProgress > 1.15) return;
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"]!;

  // Path: capsule rolls down the chute channel
  const cx = CHUTE_X + CHUTE_W / 2;
  const topY = CHUTE_Y + 8;
  const exitY = CHUTE_Y + CHUTE_H - 16;
  const cy = topY + (exitY - topY) * Math.min(1, chuteProgress);

  // Roll angle as it descends
  const rollAngle = chuteProgress * Math.PI * 3;

  ctx.save();
  ctx.globalAlpha = Math.min(1, chuteProgress < 0.1 ? chuteProgress * 10 : 1);

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;

  // Capsule in chute
  const r = 11;
  ctx.translate(cx, cy);
  ctx.rotate(rollAngle);

  // Bottom half
  const botG = ctx.createLinearGradient(-r, 0, r, r * 0.9);
  botG.addColorStop(0, col.bottomLight);
  botG.addColorStop(1, col.bottomDark);
  ctx.fillStyle = botG;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Top half
  const topG = ctx.createLinearGradient(-r, -r * 0.9, r, 0);
  topG.addColorStop(0, col.topLight);
  topG.addColorStop(1, col.topDark);
  ctx.fillStyle = topG;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Seam
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.stroke();

  // Specular
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.38, r * 0.22, r * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Glow hint at exit
  if (chuteProgress > 0.85) {
    const exitAlpha = (chuteProgress - 0.85) / 0.15;
    ctx.globalAlpha = exitAlpha * 0.5;
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = col.glow + "44";
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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

  // Notch/click state: track last 90° mark crossed
  const lastNotchRef = useRef(0);
  // Completion snap timer
  const justCompletedRef = useRef(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coin insert animation
  const coinProgressRef = useRef(-1);

  // Chute roll animation
  const chuteFractionRef = useRef(-1); // -1 = not animating

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

            // Start chute roll animation
            chuteFractionRef.current = 0;
            const chuteInterval = setInterval(() => {
              chuteFractionRef.current = Math.min(1.1, chuteFractionRef.current + 0.032);
              if (chuteFractionRef.current >= 1.0) {
                clearInterval(chuteInterval);
                chuteFractionRef.current = -1;

                // Brief hang then release capsule
                setTimeout(() => {
                  capsuleRef.current = {
                    x: MACHINE_CX,
                    y: CHUTE_Y + CHUTE_H - 4,
                    vy: 1.2, // slight initial velocity from chute exit
                    bounces: 0,
                    openFraction: 0,
                    visible: true,
                    rotation: 0.15,
                    rotVelocity: (Math.random() - 0.5) * 0.22 + 0.08,
                    phase: "falling",
                  };
                  setGameStateSync("BOUNCING");
                }, 180);
              }
            }, 16);
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
    if (dist < HANDLE_R + 20) {
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
    if (delta > 0) {
      totalRotationRef.current += delta;

      // Notch feel: brief pause at 90°/180°/270° marks
      const notch = Math.floor(totalRotationRef.current / 90);
      if (notch > lastNotchRef.current && totalRotationRef.current < 360) {
        lastNotchRef.current = notch;
        // Visual notch feedback (handled in draw via gear snap)
        handleVelocityRef.current = Math.min(handleVelocityRef.current, delta * 0.3);
      }
    }
    prevHandleAngleRef.current = newAngle;
    handleAngleRef.current = newAngle;
    handleVelocityRef.current = delta;
    if (totalRotationRef.current >= 360 && stateRef.current === "IDLE") {
      isDraggingHandleRef.current = false;
      justCompletedRef.current = true;
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
      completedTimerRef.current = setTimeout(() => { justCompletedRef.current = false; }, 1200);
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
    lastNotchRef.current = 0;
    isDraggingHandleRef.current = false;
    coinProgressRef.current = -1;
    chuteFractionRef.current = -1;
    justCompletedRef.current = false;
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
      cap.vy += 0.68;
      cap.y += cap.vy;
      cap.rotation += cap.rotVelocity;
      cap.rotVelocity *= 0.995;
      if (cap.y >= CAPSULE_LAND_Y) {
        cap.y = CAPSULE_LAND_Y;
        cap.vy = -cap.vy * 0.48;
        cap.rotVelocity *= -0.35;
        cap.bounces++;
        if (cap.bounces >= 3 || Math.abs(cap.vy) < 1.8) {
          // Two clear bounces then wobble to settle
          if (cap.bounces >= 2 && Math.abs(cap.vy) < 4) {
            cap.phase = "settled";
            cap.vy = 0;
            cap.rotVelocity = 0;
            cap.y = CAPSULE_LAND_Y;
            cap.rotation = 0;
            setGameStateSync("READY_TO_OPEN");
          }
        }
      }
    } else if (cap.phase === "settled") {
      // Wobble settle: decreasing oscillation
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

    const isTurning = state === "DISPENSING" || state === "TURNING";

    // ── Draw ──────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#100a00");
    bgGrad.addColorStop(1, "#06030a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw order: body → dome → chute capsule → main capsule → handle → coin anim → UI

    drawMachineBody3D(ctx, t);
    drawHemisphereDome(ctx, t, handleAngleRef.current, isTurning);
    drawHandle3D(ctx, handleAngleRef.current, t, state === "IDLE", totalRotationRef.current, justCompletedRef.current);

    // Capsule rolling through chute
    if (chuteFractionRef.current >= 0) {
      drawCapsuleInChute(ctx, chuteFractionRef.current, resultGrade);
    }

    // Main capsule
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
        ctx.fillText("點擊扭蛋打開！", cap.x, cap.y - 40);
        ctx.restore();
      }

      // Result text rises with prize glow
      if (state === "RESULT" && cap.openFraction > 0.62) {
        const resultAlpha = Math.min(1, (cap.openFraction - 0.62) / 0.38);
        const resultRise = (cap.openFraction - 0.62) * 28;
        const col = GRADE_CAPSULE[resultGrade] ?? GRADE_CAPSULE["D賞"]!;
        ctx.save();
        ctx.globalAlpha = resultAlpha;
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = 24;
        const resGrad = ctx.createLinearGradient(0, cap.y - 68 - resultRise, CANVAS_W, cap.y - 68 - resultRise);
        resGrad.addColorStop(0,   col.topDark);
        resGrad.addColorStop(0.5, col.topLight);
        resGrad.addColorStop(1,   col.topDark);
        ctx.fillStyle = resGrad;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          `✨ ${resultGrade}${prizeName ? ` — ${prizeName}` : ""} ✨`,
          CANVAS_W / 2, cap.y - 52 - resultRise,
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
