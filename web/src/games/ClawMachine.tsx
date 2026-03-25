"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClawGameState = "IDLE" | "AIMING" | "DESCENDING" | "GRABBING" | "LIFTING" | "DROPPING" | "RESULT";

export interface ClawMachineProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 380;
const CANVAS_H = 520;

// Machine outer box geometry
const MACHINE_X = 12;
const MACHINE_Y = 60;
const MACHINE_W = CANVAS_W - 24;
const MACHINE_H = 370;

// Glass interior (inset from outer box)
const GLASS_X = MACHINE_X + 12;
const GLASS_Y = MACHINE_Y + 50;
const GLASS_W = MACHINE_W - 80; // Leave room for right side panel
const GLASS_H = MACHINE_H - 80;

// Right side control panel
const PANEL_X = GLASS_X + GLASS_W + 4;
const PANEL_Y = MACHINE_Y + 30;
const PANEL_W = MACHINE_W - GLASS_W - 20;
const PANEL_H = MACHINE_H - 40;

// Rail geometry (inside glass)
const RAIL_Y = GLASS_Y + 20;
const CLAW_HOME_Y = RAIL_Y + 28;

// Prize zone
const PRIZE_ZONE_Y_MIN = GLASS_Y + GLASS_H - 130;
const PRIZE_ZONE_Y_MAX = GLASS_Y + GLASS_H - 30;
const PRIZE_ZONE_X_MIN = GLASS_X + 25;
const PRIZE_ZONE_X_MAX = GLASS_X + GLASS_W - 25;

// Chute opening (right side of glass, below prize zone)
const CHUTE_X = GLASS_X + GLASS_W - 5;
const CHUTE_Y = GLASS_Y + GLASS_H - 80;

// Joystick geometry
const JOYSTICK_CX = PANEL_X + PANEL_W / 2 + 2;
const JOYSTICK_BASE_Y = PANEL_Y + PANEL_H * 0.45;
const JOYSTICK_BASE_R = 26;
const JOYSTICK_STICK_LEN = 22;

// Grade palette — plush toy colors
const GRADE_PLUSH: Record<string, {
  body: string; shadow: string; highlight: string;
  ear: string; text: string; glow: string;
  cheek: string; patch: string;
}> = {
  "A賞": { body: "#dc2626", shadow: "#991b1b", highlight: "#fca5a5", ear: "#f87171", text: "#fff", glow: "#f87171", cheek: "#fda4af", patch: "#fbbf24" },
  "B賞": { body: "#2563eb", shadow: "#1d4ed8", highlight: "#93c5fd", ear: "#60a5fa", text: "#fff", glow: "#3b82f6", cheek: "#fbcfe8", patch: "#a78bfa" },
  "C賞": { body: "#16a34a", shadow: "#15803d", highlight: "#86efac", ear: "#4ade80", text: "#fff", glow: "#10b981", cheek: "#fda4af", patch: "#fcd34d" },
  "D賞": { body: "#7c3aed", shadow: "#6d28d9", highlight: "#c4b5fd", ear: "#a78bfa", text: "#fff", glow: "#a855f7", cheek: "#fbcfe8", patch: "#f9a8d4" },
};

const PLUSH_R = 20;
const BALL_COUNT = 14;

// Confetti particle type
interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  size: number;
  life: number;
}

function makePrizes(resultGrade: string) {
  const grades = ["A賞", "B賞", "C賞", "D賞"];
  const prizes: { x: number; y: number; grade: string; wobblePhase: number }[] = [];
  const cols = 7;
  let gradeIdx = 0;
  for (let i = 0; i < BALL_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PRIZE_ZONE_X_MIN + 20 + col * 36 + (row % 2 === 0 ? 0 : 18);
    const y = PRIZE_ZONE_Y_MIN + row * 45 + 20;
    const grade = i === 6 ? resultGrade : grades[gradeIdx % 4] ?? "D賞";
    gradeIdx++;
    prizes.push({ x, y, grade, wobblePhase: Math.random() * Math.PI * 2 });
  }
  return prizes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawMachineBody(ctx: CanvasRenderingContext2D, t: number, successFlash: number) {
  const sideDepth = 12;

  // Right face (3D depth)
  const rightFaceGrad = ctx.createLinearGradient(MACHINE_X + MACHINE_W, MACHINE_Y, MACHINE_X + MACHINE_W + sideDepth, MACHINE_Y + MACHINE_H);
  rightFaceGrad.addColorStop(0, "#0c1a2e");
  rightFaceGrad.addColorStop(1, "#061020");
  ctx.fillStyle = rightFaceGrad;
  ctx.beginPath();
  ctx.moveTo(MACHINE_X + MACHINE_W, MACHINE_Y + 14);
  ctx.lineTo(MACHINE_X + MACHINE_W + sideDepth, MACHINE_Y + 14 - sideDepth * 0.5);
  ctx.lineTo(MACHINE_X + MACHINE_W + sideDepth, MACHINE_Y + MACHINE_H - sideDepth * 0.5);
  ctx.lineTo(MACHINE_X + MACHINE_W, MACHINE_Y + MACHINE_H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0369a1";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Bottom face
  ctx.fillStyle = "#061828";
  ctx.beginPath();
  ctx.moveTo(MACHINE_X, MACHINE_Y + MACHINE_H);
  ctx.lineTo(MACHINE_X + MACHINE_W, MACHINE_Y + MACHINE_H);
  ctx.lineTo(MACHINE_X + MACHINE_W + sideDepth, MACHINE_Y + MACHINE_H - sideDepth * 0.5);
  ctx.lineTo(MACHINE_X + sideDepth, MACHINE_Y + MACHINE_H - sideDepth * 0.5);
  ctx.closePath();
  ctx.fill();

  // Main front body
  const bodyGrad = ctx.createLinearGradient(MACHINE_X, MACHINE_Y, MACHINE_X + MACHINE_W, MACHINE_Y + MACHINE_H);
  bodyGrad.addColorStop(0, "#0c2040");
  bodyGrad.addColorStop(0.5, "#0a1a32");
  bodyGrad.addColorStop(1, "#060e1e");
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = successFlash > 0 ? `rgba(255,200,50,${successFlash})` : "#0ea5e9";
  ctx.shadowBlur = successFlash > 0 ? 30 : 16;
  ctx.beginPath();
  ctx.roundRect(MACHINE_X, MACHINE_Y, MACHINE_W, MACHINE_H, 14);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Metallic bevel highlight
  const bevelGrad = ctx.createLinearGradient(MACHINE_X, MACHINE_Y, MACHINE_X + 50, MACHINE_Y + 50);
  bevelGrad.addColorStop(0, "rgba(14,165,233,0.2)");
  bevelGrad.addColorStop(1, "rgba(14,165,233,0)");
  ctx.fillStyle = bevelGrad;
  ctx.beginPath();
  ctx.roundRect(MACHINE_X, MACHINE_Y, MACHINE_W, MACHINE_H, 14);
  ctx.fill();

  // Outer border
  ctx.strokeStyle = successFlash > 0 ? `rgba(255,200,50,${0.5 + successFlash * 0.5})` : "#0369a1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(MACHINE_X, MACHINE_Y, MACHINE_W, MACHINE_H, 14);
  ctx.stroke();

  // Inner trim
  ctx.strokeStyle = "rgba(14,165,233,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(MACHINE_X + 4, MACHINE_Y + 4, MACHINE_W - 8, MACHINE_H - 8, 11);
  ctx.stroke();

  // Blinking edge lights
  drawMachineLights(ctx, t, successFlash);

  // Header panel
  drawMachineHeader(ctx);

  // Draw stand/legs
  drawLegs(ctx);
}

function drawMachineLights(ctx: CanvasRenderingContext2D, t: number, successFlash: number) {
  const lightColors = ["#38bdf8", "#7dd3fc", "#0ea5e9", "#38bdf8", "#bae6fd"];
  const successColors = ["#fbbf24", "#f59e0b", "#fcd34d", "#fbbf24", "#fde68a"];

  // During success: chase pattern (all lights rapid sequential)
  const isSuccess = successFlash > 0;
  const chaseSpeed = isSuccess ? 12 : 4;

  // Top edge
  for (let i = 0; i < 8; i++) {
    const x = MACHINE_X + 22 + i * (MACHINE_W - 44) / 7;
    const y = MACHINE_Y + 8;
    // Chase pattern: each light offset by index / total * 2pi
    const blink = isSuccess
      ? Math.sin(t * chaseSpeed - i * 0.9) > 0
      : Math.sin(t * 4 + i * 0.7) > 0;
    const colors = isSuccess ? successColors : lightColors;
    const col = colors[i % colors.length] ?? "#38bdf8";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = isSuccess ? 14 : 8; }
    ctx.fillStyle = blink ? col : `${col}33`;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Bottom edge
  for (let i = 0; i < 8; i++) {
    const x = MACHINE_X + 22 + i * (MACHINE_W - 44) / 7;
    const y = MACHINE_Y + MACHINE_H - 8;
    const blink = isSuccess
      ? Math.sin(t * chaseSpeed - i * 0.9 + Math.PI) > 0
      : Math.sin(t * 4 + i * 0.7 + Math.PI) > 0;
    const colors = isSuccess ? successColors : lightColors;
    const col = colors[i % colors.length] ?? "#38bdf8";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = isSuccess ? 14 : 8; }
    ctx.fillStyle = blink ? col : `${col}33`;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Left edge vertical lights
  for (let i = 0; i < 5; i++) {
    const x = MACHINE_X + 8;
    const y = MACHINE_Y + 30 + i * (MACHINE_H - 60) / 4;
    const blink = isSuccess
      ? Math.sin(t * chaseSpeed - i * 1.2) > 0
      : Math.sin(t * 3 + i * 1.1) > 0;
    const colors = isSuccess ? successColors : lightColors;
    const col = colors[i % colors.length] ?? "#38bdf8";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = isSuccess ? 12 : 6; }
    ctx.fillStyle = blink ? col : `${col}22`;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMachineHeader(ctx: CanvasRenderingContext2D) {
  const hx = MACHINE_X + 14, hy = MACHINE_Y + 10, hw = MACHINE_W - 28, hh = 34;
  const hGrad = ctx.createLinearGradient(hx, hy, hx + hw, hy);
  hGrad.addColorStop(0, "#0369a1");
  hGrad.addColorStop(0.5, "#0ea5e9");
  hGrad.addColorStop(1, "#0369a1");
  ctx.fillStyle = hGrad;
  ctx.beginPath();
  ctx.roundRect(hx, hy, hw, hh, 6);
  ctx.fill();

  // Shine
  const shineGrad = ctx.createLinearGradient(hx, hy, hx, hy + hh * 0.5);
  shineGrad.addColorStop(0, "rgba(255,255,255,0.2)");
  shineGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shineGrad;
  ctx.beginPath();
  ctx.roundRect(hx, hy, hw, hh * 0.5, [6, 6, 0, 0]);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("夾娃娃機  CLAW MACHINE", GLASS_X + GLASS_W / 2, hy + hh / 2);
}

function drawLegs(ctx: CanvasRenderingContext2D) {
  const legY = MACHINE_Y + MACHINE_H;
  const legH = 30;
  const legW = 18;
  const legs = [MACHINE_X + 20, MACHINE_X + MACHINE_W - 38];

  for (const lx of legs) {
    const legGrad = ctx.createLinearGradient(lx, legY, lx + legW, legY + legH);
    legGrad.addColorStop(0, "#1e3a5f");
    legGrad.addColorStop(1, "#0c1a2e");
    ctx.fillStyle = legGrad;
    ctx.strokeStyle = "#0369a1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, legY, legW, legH, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();

    // Foot
    ctx.fillStyle = "#0c2040";
    ctx.beginPath();
    ctx.roundRect(lx - 5, legY + legH - 6, legW + 10, 8, 3);
    ctx.fill();
  }
}

function drawGlassCase(ctx: CanvasRenderingContext2D) {
  // Left side panel (visible depth)
  const sideW = 10;
  ctx.fillStyle = "#0a1a2e88";
  ctx.strokeStyle = "#38bdf833";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(GLASS_X, GLASS_Y);
  ctx.lineTo(GLASS_X - sideW, GLASS_Y - sideW * 0.5);
  ctx.lineTo(GLASS_X - sideW, GLASS_Y + GLASS_H - sideW * 0.5);
  ctx.lineTo(GLASS_X, GLASS_Y + GLASS_H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top panel (visible depth)
  ctx.fillStyle = "#0a1a2e66";
  ctx.beginPath();
  ctx.moveTo(GLASS_X, GLASS_Y);
  ctx.lineTo(GLASS_X + GLASS_W, GLASS_Y);
  ctx.lineTo(GLASS_X + GLASS_W - sideW, GLASS_Y - sideW * 0.5);
  ctx.lineTo(GLASS_X - sideW, GLASS_Y - sideW * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top rail mechanism bar
  const railBarGrad = ctx.createLinearGradient(GLASS_X, GLASS_Y, GLASS_X, GLASS_Y + 12);
  railBarGrad.addColorStop(0, "#374151");
  railBarGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = railBarGrad;
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 10, GLASS_Y + 8, GLASS_W - 20, 12, 3);
  ctx.fill();
  ctx.stroke();

  // Rail track grooves
  for (let gx = GLASS_X + 18; gx < GLASS_X + GLASS_W - 18; gx += 24) {
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(gx - 2, GLASS_Y + 10, 4, 8, 1);
    ctx.fill();
  }

  // Glass front face (main transparent area)
  const glassGrad = ctx.createLinearGradient(GLASS_X, GLASS_Y, GLASS_X + GLASS_W, GLASS_Y);
  glassGrad.addColorStop(0, "rgba(14,165,233,0.03)");
  glassGrad.addColorStop(0.4, "rgba(14,165,233,0.06)");
  glassGrad.addColorStop(1, "rgba(14,165,233,0.02)");
  ctx.fillStyle = glassGrad;
  ctx.strokeStyle = "#38bdf866";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H, [0, 0, 6, 6]);
  ctx.fill();
  ctx.stroke();

  // Blue-green glow on glass edges
  ctx.save();
  ctx.shadowColor = "#06b6d4";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(6,182,212,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H, [0, 0, 6, 6]);
  ctx.stroke();
  ctx.restore();

  // Back wall inside the case (slightly darker, watermark)
  drawGlassBackWall(ctx);

  // Interior floor grid pattern
  drawInteriorFloor(ctx);

  // Interior vignette (dark corners to feel enclosed)
  drawInteriorVignette(ctx);

  // Glass floor bottom strip
  const floorGrad = ctx.createLinearGradient(GLASS_X, GLASS_Y + GLASS_H - 20, GLASS_X, GLASS_Y + GLASS_H);
  floorGrad.addColorStop(0, "#0c1a2e");
  floorGrad.addColorStop(1, "#071020");
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + GLASS_H - 18, GLASS_W - 4, 16, [0, 0, 4, 4]);
  ctx.fill();

  // Glass reflections — primary diagonal streak
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(GLASS_X + 15, GLASS_Y + 10);
  ctx.lineTo(GLASS_X + 60, GLASS_Y + GLASS_H * 0.7);
  ctx.stroke();
  ctx.restore();

  // Secondary curved reflection streak
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#bae6fd";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  // Gentle arc from top-right area sweeping down
  ctx.moveTo(GLASS_X + GLASS_W * 0.55, GLASS_Y + 8);
  ctx.bezierCurveTo(
    GLASS_X + GLASS_W * 0.62, GLASS_Y + GLASS_H * 0.2,
    GLASS_X + GLASS_W * 0.58, GLASS_Y + GLASS_H * 0.45,
    GLASS_X + GLASS_W * 0.5, GLASS_Y + GLASS_H * 0.65
  );
  ctx.stroke();
  ctx.restore();

  // Thin tertiary highlight near left edge
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(GLASS_X + 38, GLASS_Y + 5);
  ctx.lineTo(GLASS_X + 75, GLASS_Y + GLASS_H * 0.48);
  ctx.stroke();
  ctx.restore();

  // Chute / prize exit opening
  drawChute(ctx);
}

function drawGlassBackWall(ctx: CanvasRenderingContext2D) {
  // Slightly darker back wall
  const backGrad = ctx.createLinearGradient(GLASS_X, GLASS_Y, GLASS_X, GLASS_Y + GLASS_H);
  backGrad.addColorStop(0, "rgba(2,8,20,0.55)");
  backGrad.addColorStop(1, "rgba(4,12,28,0.65)");
  ctx.fillStyle = backGrad;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + 2, GLASS_W - 4, GLASS_H - 4, [0, 0, 5, 5]);
  ctx.fill();

  // "PrizeDraw" watermark logo on back wall
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#38bdf8";
  // Slight perspective tilt
  ctx.translate(GLASS_X + GLASS_W / 2, GLASS_Y + GLASS_H * 0.38);
  ctx.rotate(-0.04);
  ctx.fillText("PrizeDraw", 0, 0);
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText("OFFICIAL PRIZE MACHINE", 0, 22);
  ctx.restore();
}

function drawInteriorFloor(ctx: CanvasRenderingContext2D) {
  // Padded grid floor inside the case
  const floorTop = PRIZE_ZONE_Y_MAX - 10;
  const floorBot = GLASS_Y + GLASS_H - 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(GLASS_X + 2, floorTop, GLASS_W - 4, floorBot - floorTop);
  ctx.clip();

  // Base floor tone
  const floorBase = ctx.createLinearGradient(GLASS_X, floorTop, GLASS_X, floorBot);
  floorBase.addColorStop(0, "rgba(10,26,46,0.6)");
  floorBase.addColorStop(1, "rgba(4,12,24,0.8)");
  ctx.fillStyle = floorBase;
  ctx.fillRect(GLASS_X + 2, floorTop, GLASS_W - 4, floorBot - floorTop);

  // Grid lines
  const gridSize = 14;
  ctx.strokeStyle = "rgba(14,165,233,0.12)";
  ctx.lineWidth = 0.5;

  // Vertical grid
  for (let gx = GLASS_X + 2; gx < GLASS_X + GLASS_W - 2; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, floorTop);
    ctx.lineTo(gx, floorBot);
    ctx.stroke();
  }
  // Horizontal grid
  for (let gy = floorTop; gy < floorBot; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(GLASS_X + 2, gy);
    ctx.lineTo(GLASS_X + GLASS_W - 2, gy);
    ctx.stroke();
  }

  // Grid dot intersections for padded look
  ctx.fillStyle = "rgba(14,165,233,0.08)";
  for (let gx = GLASS_X + 2; gx < GLASS_X + GLASS_W - 2; gx += gridSize) {
    for (let gy = floorTop; gy < floorBot; gy += gridSize) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawInteriorVignette(ctx: CanvasRenderingContext2D) {
  // Left dark corner
  const leftVig = ctx.createLinearGradient(GLASS_X, GLASS_Y, GLASS_X + GLASS_W * 0.28, GLASS_Y);
  leftVig.addColorStop(0, "rgba(0,5,15,0.55)");
  leftVig.addColorStop(1, "rgba(0,5,15,0)");
  ctx.fillStyle = leftVig;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + 2, GLASS_W - 4, GLASS_H - 4, [0, 0, 5, 5]);
  ctx.fill();

  // Right dark corner
  const rightVig = ctx.createLinearGradient(GLASS_X + GLASS_W, GLASS_Y, GLASS_X + GLASS_W * 0.72, GLASS_Y);
  rightVig.addColorStop(0, "rgba(0,5,15,0.5)");
  rightVig.addColorStop(1, "rgba(0,5,15,0)");
  ctx.fillStyle = rightVig;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + 2, GLASS_W - 4, GLASS_H - 4, [0, 0, 5, 5]);
  ctx.fill();

  // Top dark area
  const topVig = ctx.createLinearGradient(GLASS_X, GLASS_Y, GLASS_X, GLASS_Y + GLASS_H * 0.25);
  topVig.addColorStop(0, "rgba(0,5,15,0.5)");
  topVig.addColorStop(1, "rgba(0,5,15,0)");
  ctx.fillStyle = topVig;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + 2, GLASS_W - 4, GLASS_H - 4, [0, 0, 5, 5]);
  ctx.fill();
}

function drawChute(ctx: CanvasRenderingContext2D, flapAngle = 0) {
  const chuteW = 52, chuteH = 60;
  const cx = CHUTE_X;
  const cy = CHUTE_Y;

  // Chute body (3D box)
  const chuteGrad = ctx.createLinearGradient(cx, cy, cx + chuteW, cy + chuteH);
  chuteGrad.addColorStop(0, "#0c2040");
  chuteGrad.addColorStop(1, "#061828");
  ctx.fillStyle = chuteGrad;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx, cy, chuteW, chuteH, 6);
  ctx.fill();
  ctx.stroke();

  // Opening (dark interior)
  ctx.fillStyle = "#020810";
  ctx.beginPath();
  ctx.roundRect(cx + 6, cy + 6, chuteW - 12, chuteH - 20, 3);
  ctx.fill();

  // Animated flap at bottom (rotates open when prize drops)
  ctx.save();
  ctx.translate(cx + chuteW / 2, cy + chuteH - 11);
  // flapAngle: 0 = closed, up to ~0.8 = open
  ctx.rotate(flapAngle);
  const flapGrad = ctx.createLinearGradient(-chuteW / 2 + 4, -7, -chuteW / 2 + 4, 7);
  flapGrad.addColorStop(0, "#0369a1");
  flapGrad.addColorStop(1, "#075985");
  ctx.fillStyle = flapGrad;
  ctx.beginPath();
  ctx.roundRect(-(chuteW - 8) / 2, -7, chuteW - 8, 14, [0, 0, 4, 4]);
  ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("出口", cx + chuteW / 2, cy + chuteH - 10);
}

function drawControlPanel(
  ctx: CanvasRenderingContext2D,
  joystickX: number,
  joystickY: number,
  t: number,
  isInteractable: boolean,
  countdown: number,
) {
  // Panel body — angled arcade surface look with wood-grain texture
  const panelGrad = ctx.createLinearGradient(PANEL_X, PANEL_Y, PANEL_X + PANEL_W, PANEL_Y + PANEL_H);
  panelGrad.addColorStop(0, "#1a1008");
  panelGrad.addColorStop(0.3, "#0f1a2e");
  panelGrad.addColorStop(0.7, "#0a1525");
  panelGrad.addColorStop(1, "#060e1a");
  ctx.fillStyle = panelGrad;
  ctx.strokeStyle = "#0369a1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
  ctx.fill();
  ctx.stroke();

  // Angled surface: top sheen to simulate tilt
  const panelSheen = ctx.createLinearGradient(PANEL_X, PANEL_Y, PANEL_X, PANEL_Y + PANEL_H * 0.35);
  panelSheen.addColorStop(0, "rgba(14,165,233,0.12)");
  panelSheen.addColorStop(1, "rgba(14,165,233,0)");
  ctx.fillStyle = panelSheen;
  ctx.beginPath();
  ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H * 0.35, [8, 8, 0, 0]);
  ctx.fill();

  // Wood-grain lines (subtle horizontal streaks)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PANEL_X + 2, PANEL_Y + 2, PANEL_W - 4, PANEL_H - 4, 7);
  ctx.clip();
  for (let gy = PANEL_Y + 8; gy < PANEL_Y + PANEL_H; gy += 10) {
    const grainAlpha = 0.025 + Math.sin(gy * 0.7) * 0.01;
    ctx.strokeStyle = `rgba(180,130,60,${grainAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(PANEL_X + 2, gy);
    // Slight waviness
    ctx.bezierCurveTo(
      PANEL_X + PANEL_W * 0.3, gy + 1.5,
      PANEL_X + PANEL_W * 0.7, gy - 1,
      PANEL_X + PANEL_W - 2, gy + 0.5,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Panel label
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("CONTROL", PANEL_X + PANEL_W / 2, PANEL_Y + 8);

  // Credit display — LED-style text
  drawCreditDisplay(ctx);

  // Timer display near joystick
  drawTimerDisplay(ctx, countdown, isInteractable);

  // Joystick base with rubber boot
  drawJoystickAssembly(ctx, joystickX, joystickY, t, isInteractable);

  // Drop button
  drawDropButton(ctx, t, isInteractable);
}

function drawCreditDisplay(ctx: CanvasRenderingContext2D) {
  const dx = PANEL_X + 4;
  const dy = PANEL_Y + PANEL_H * 0.12;
  const dw = PANEL_W - 8;
  const dh = 16;

  // LED display bg
  ctx.fillStyle = "#020a04";
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, 3);
  ctx.fill();
  ctx.stroke();

  // LED text
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#22c55e";
  ctx.shadowBlur = 4;
  ctx.fillText("1 CREDIT", dx + dw / 2, dy + dh / 2);
  ctx.shadowBlur = 0;
}

function drawTimerDisplay(ctx: CanvasRenderingContext2D, countdown: number, isInteractable: boolean) {
  const dx = PANEL_X + 4;
  const dy = PANEL_Y + PANEL_H * 0.23;
  const dw = PANEL_W - 8;
  const dh = 18;

  // Timer bg
  ctx.fillStyle = "#020810";
  ctx.strokeStyle = "#075985";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, 3);
  ctx.fill();
  ctx.stroke();

  // Digits
  const secs = Math.max(0, Math.ceil(countdown));
  const display = secs < 10 ? `0${secs}` : `${secs}`;
  const timerColor = isInteractable ? "#38bdf8" : (secs < 5 ? "#ef4444" : "#38bdf8");
  ctx.fillStyle = timerColor;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (isInteractable) {
    ctx.shadowColor = "#0ea5e9";
    ctx.shadowBlur = 5;
  }
  ctx.fillText(display, dx + dw / 2, dy + dh / 2);
  ctx.shadowBlur = 0;
}

function drawJoystickAssembly(
  ctx: CanvasRenderingContext2D,
  joystickX: number,
  joystickY: number,
  t: number,
  isInteractable: boolean,
) {
  // Joystick base plate
  const jbGrad = ctx.createRadialGradient(JOYSTICK_CX, JOYSTICK_BASE_Y, 2, JOYSTICK_CX, JOYSTICK_BASE_Y, JOYSTICK_BASE_R);
  jbGrad.addColorStop(0, "#374151");
  jbGrad.addColorStop(1, "#1f2937");
  ctx.fillStyle = jbGrad;
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(JOYSTICK_CX, JOYSTICK_BASE_Y, JOYSTICK_BASE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Base rim
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(JOYSTICK_CX, JOYSTICK_BASE_Y, JOYSTICK_BASE_R - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Rubber boot (accordion folds around the stick base)
  drawRubberBoot(ctx, joystickX, joystickY);

  const stickEndX = JOYSTICK_CX + joystickX;
  const stickEndY = JOYSTICK_BASE_Y + joystickY - JOYSTICK_STICK_LEN;

  // Stick shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(JOYSTICK_CX + joystickX * 0.3, JOYSTICK_BASE_Y + joystickY * 0.3);
  ctx.lineTo(stickEndX, stickEndY);
  ctx.stroke();
  ctx.restore();

  // Stick body (metallic)
  const stickGrad = ctx.createLinearGradient(JOYSTICK_CX, JOYSTICK_BASE_Y, stickEndX, stickEndY);
  stickGrad.addColorStop(0, "#6b7280");
  stickGrad.addColorStop(0.4, "#9ca3af");
  stickGrad.addColorStop(1, "#4b5563");
  ctx.strokeStyle = stickGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(JOYSTICK_CX + joystickX * 0.3, JOYSTICK_BASE_Y + joystickY * 0.3);
  ctx.lineTo(stickEndX, stickEndY);
  ctx.stroke();

  // Knob — proper sphere with lighting (highlight top-left, shadow bottom-right)
  const knobR = 10;
  // Main sphere body
  const knobGrad = ctx.createRadialGradient(
    stickEndX - 3, stickEndY - 3, 1,
    stickEndX + 2, stickEndY + 2, knobR * 1.4,
  );
  knobGrad.addColorStop(0, isInteractable ? "#bae6fd" : "#9ca3af");
  knobGrad.addColorStop(0.35, isInteractable ? "#0ea5e9" : "#4b5563");
  knobGrad.addColorStop(0.7, isInteractable ? "#0369a1" : "#374151");
  knobGrad.addColorStop(1, isInteractable ? "#082f49" : "#1f2937");
  ctx.fillStyle = knobGrad;
  ctx.strokeStyle = isInteractable ? "#38bdf8" : "#4b5563";
  ctx.lineWidth = 1.5;
  if (isInteractable) {
    ctx.shadowColor = "#0ea5e9";
    ctx.shadowBlur = 10 + Math.sin(t * 3) * 4;
  }
  ctx.beginPath();
  ctx.arc(stickEndX, stickEndY, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Specular highlight (top-left bright spot)
  const specGrad = ctx.createRadialGradient(
    stickEndX - 3.5, stickEndY - 3.5, 0.5,
    stickEndX - 3, stickEndY - 3, knobR * 0.65,
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.75)");
  specGrad.addColorStop(0.4, "rgba(255,255,255,0.3)");
  specGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(stickEndX, stickEndY, knobR, 0, Math.PI * 2);
  ctx.fill();

  // Bottom-right shadow on knob surface
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(stickEndX + 3, stickEndY + 3, knobR * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRubberBoot(ctx: CanvasRenderingContext2D, joystickX: number, joystickY: number) {
  // Accordion-like rubber boot around stick base
  const bootCX = JOYSTICK_CX + joystickX * 0.2;
  const bootCY = JOYSTICK_BASE_Y + joystickY * 0.2;
  const bootFolds = 3;
  const bootBaseR = 10;

  ctx.save();
  for (let f = 0; f < bootFolds; f++) {
    const t2 = f / bootFolds;
    const foldR = bootBaseR * (1 - t2 * 0.55);
    const foldY = bootCY - f * 5.5;
    const alpha = 0.35 - t2 * 0.1;
    const foldGrad = ctx.createRadialGradient(bootCX - 1, foldY - 1, 1, bootCX, foldY, foldR);
    foldGrad.addColorStop(0, `rgba(80,80,85,${alpha + 0.15})`);
    foldGrad.addColorStop(1, `rgba(30,30,35,${alpha})`);
    ctx.fillStyle = foldGrad;
    ctx.strokeStyle = `rgba(75,85,99,${0.4 - t2 * 0.1})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(bootCX, foldY, foldR, foldR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawDropButton(ctx: CanvasRenderingContext2D, t: number, isInteractable: boolean) {
  const dropBtnX = PANEL_X + PANEL_W / 2;
  const dropBtnY = JOYSTICK_BASE_Y + 55;
  const dropBtnR = 14;

  // Outer ring (button housing)
  const housingGrad = ctx.createRadialGradient(dropBtnX, dropBtnY, dropBtnR * 0.6, dropBtnX, dropBtnY, dropBtnR + 5);
  housingGrad.addColorStop(0, "#1f2937");
  housingGrad.addColorStop(1, "#111827");
  ctx.fillStyle = housingGrad;
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR + 5, 0, Math.PI * 2);
  ctx.stroke();

  // Button dome base
  const btnBaseGrad = ctx.createRadialGradient(dropBtnX, dropBtnY, 2, dropBtnX, dropBtnY, dropBtnR);
  btnBaseGrad.addColorStop(0, isInteractable ? "#b91c1c" : "#374151");
  btnBaseGrad.addColorStop(1, isInteractable ? "#7f1d1d" : "#1f2937");
  ctx.fillStyle = btnBaseGrad;
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR, 0, Math.PI * 2);
  ctx.fill();

  // 3D dome shape — top highlight hemisphere
  const domeHighlight = ctx.createRadialGradient(
    dropBtnX - 4, dropBtnY - 5, 1,
    dropBtnX - 2, dropBtnY - 3, dropBtnR * 0.95,
  );
  domeHighlight.addColorStop(0, isInteractable ? "rgba(252,165,165,0.9)" : "rgba(156,163,175,0.5)");
  domeHighlight.addColorStop(0.4, isInteractable ? "rgba(239,68,68,0.5)" : "rgba(75,85,99,0.3)");
  domeHighlight.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = domeHighlight;
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR, 0, Math.PI * 2);
  ctx.fill();

  // Rim highlight ring
  ctx.strokeStyle = isInteractable ? "#ef4444" : "#4b5563";
  ctx.lineWidth = 2;
  if (isInteractable) {
    ctx.shadowColor = "#dc2626";
    ctx.shadowBlur = 8 + Math.sin(t * 4) * 3;
  }
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DROP", dropBtnX, dropBtnY + 1);
}

function drawPlushToy(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  grade: string,
  alpha = 1,
  scale = 1,
  wobble = 0,
  squish = 0, // 0 = normal, 1 = fully squished (claw grab)
) {
  const col = GRADE_PLUSH[grade] ?? GRADE_PLUSH["D賞"]!;
  const r = PLUSH_R * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + Math.sin(wobble) * 1.5);
  // Squish: compress vertically, expand horizontally
  const scaleX = 1 + squish * 0.18;
  const scaleY = 1 - squish * 0.14;
  ctx.scale(scaleX, scaleY);

  // Shadow on floor
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  const shadowGrad = ctx.createRadialGradient(0, r * 0.9, 0, 0, r * 0.9, r * 0.7);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.35)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.9, r * 0.65, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body shadow beneath
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Body — fluffy rounded shape (slightly taller than wide for plush look)
  const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
  bodyGrad.addColorStop(0, col.highlight);
  bodyGrad.addColorStop(0.5, col.body);
  bodyGrad.addColorStop(1, col.shadow);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // Distinct silhouette: round body, slightly indented sides for waist
  ctx.moveTo(r * 0.85, 0);
  ctx.bezierCurveTo(r * 0.85, -r * 0.5, r * 0.5, -r * 0.92, 0, -r * 0.92);
  ctx.bezierCurveTo(-r * 0.5, -r * 0.92, -r * 0.85, -r * 0.5, -r * 0.85, 0);
  ctx.bezierCurveTo(-r * 0.85, r * 0.55, -r * 0.55, r, 0, r);
  ctx.bezierCurveTo(r * 0.55, r, r * 0.85, r * 0.55, r * 0.85, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Small arms (limbs)
  // Left arm
  ctx.fillStyle = col.body;
  ctx.beginPath();
  ctx.ellipse(-r * 0.88, r * 0.1, r * 0.2, r * 0.32, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Right arm
  ctx.beginPath();
  ctx.ellipse(r * 0.88, r * 0.1, r * 0.2, r * 0.32, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Small legs/feet at bottom
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, r * 0.98, r * 0.24, r * 0.16, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.38, r * 0.98, r * 0.24, r * 0.16, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Ears — floppy, angled outward
  ctx.fillStyle = col.ear;
  // Left ear (floppy drooping)
  ctx.beginPath();
  ctx.ellipse(-r * 0.52, -r * 0.8, r * 0.22, r * 0.34, -0.55, 0, Math.PI * 2);
  ctx.fill();
  // Right ear (floppy drooping)
  ctx.beginPath();
  ctx.ellipse(r * 0.52, -r * 0.8, r * 0.22, r * 0.34, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Inner ear
  ctx.fillStyle = col.highlight;
  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.ellipse(-r * 0.52, -r * 0.8, r * 0.1, r * 0.2, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.52, -r * 0.8, r * 0.1, r * 0.2, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Belly patch — heart or star depending on grade
  const isAGrade = grade === "A賞";
  const isStarGrade = grade === "C賞";
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  if (isAGrade || isStarGrade) {
    drawBellyPatch(ctx, 0, r * 0.3, r * 0.3, col.patch, isStarGrade);
  } else {
    // Lighter circle patch for other grades
    ctx.fillStyle = col.highlight;
    ctx.globalAlpha = alpha * 0.28;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.38, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = alpha;

  // Stitch lines — dashed curved lines on body
  drawStitchLines(ctx, r, col.shadow, alpha);

  // Button eyes with highlight dot
  drawButtonEyes(ctx, r, alpha);

  // Rosy cheeks
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = col.cheek;
  ctx.beginPath();
  ctx.ellipse(-r * 0.48, r * 0.1, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.48, r * 0.1, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Nose
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = r * 0.08;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r * 0.22, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Grade tag
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${r * 0.38}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade.charAt(0), 0, r * 0.72);

  ctx.restore();
}

function drawBellyPatch(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  color: string,
  isStar: boolean,
) {
  ctx.fillStyle = color;
  if (isStar) {
    // 5-pointed star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const outerR = size * 0.55;
      const innerR = size * 0.22;
      const outerX = cx + Math.cos(angle) * outerR;
      const outerY = cy + Math.sin(angle) * outerR;
      const innerAngle = angle + (2 * Math.PI) / 10;
      const innerX = cx + Math.cos(innerAngle) * innerR;
      const innerY = cy + Math.sin(innerAngle) * innerR;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // Heart shape
    const hs = size * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx, cy + hs * 0.35);
    ctx.bezierCurveTo(cx, cy, cx - hs, cy, cx - hs, cy - hs * 0.45);
    ctx.bezierCurveTo(cx - hs, cy - hs, cx, cy - hs, cx, cy - hs * 0.45);
    ctx.bezierCurveTo(cx, cy - hs, cx + hs, cy - hs, cx + hs, cy - hs * 0.45);
    ctx.bezierCurveTo(cx + hs, cy, cx, cy, cx, cy + hs * 0.35);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStitchLines(
  ctx: CanvasRenderingContext2D,
  r: number,
  shadowColor: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.3;
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2.5]);
  ctx.lineCap = "round";

  // Head-body seam arc (top of body)
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.68, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.stroke();

  // Belly stitch (curved horizontal)
  ctx.beginPath();
  ctx.arc(0, r * 0.45, r * 0.5, -Math.PI * 0.6, -Math.PI * 0.4 + Math.PI);
  ctx.stroke();

  // Left side stitch
  ctx.beginPath();
  ctx.arc(-r * 0.7, r * 0.05, r * 0.35, -0.6, 0.6);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

function drawButtonEyes(ctx: CanvasRenderingContext2D, r: number, alpha: number) {
  const eyePositions = [
    { x: -r * 0.28, y: -r * 0.15 },
    { x: r * 0.28, y: -r * 0.15 },
  ];

  for (const ep of eyePositions) {
    // Eye outer ring (button rim)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, r * 0.17, 0, Math.PI * 2);
    ctx.fill();

    // Eye main (dark with slight sheen)
    const eyeGrad = ctx.createRadialGradient(ep.x, ep.y, 0.5, ep.x, ep.y, r * 0.14);
    eyeGrad.addColorStop(0, "#334155");
    eyeGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, r * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Button stitch ring (4 holes around eye)
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 1.5]);
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, r * 0.19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Main highlight dot (top-left)
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(ep.x - r * 0.05, ep.y - r * 0.05, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Secondary tiny sparkle
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(ep.x + r * 0.06, ep.y + r * 0.02, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClaw(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  openAmount: number, // 0 = closed, 1 = open
  swingOffset = 0, // lateral swing during descent
  grabStep = 0, // 0 = smooth, 1 or 2 = snap steps
) {
  ctx.save();
  ctx.translate(swingOffset, 0);

  // Cable with metallic wire rope texture (alternating light/dark segments)
  drawMetallicCable(ctx, x, y);

  // Claw body hub — mechanical assembly
  drawClawHub(ctx, x, y);

  // Three prongs with finger ridges
  const prongData = [
    { baseOffset: -0.45, jointDir: -1 },
    { baseOffset: 0, jointDir: 0 },
    { baseOffset: 0.45, jointDir: 1 },
  ];

  for (const pd of prongData) {
    let effectiveOpen = openAmount;
    // Snap close: two distinct steps instead of smooth
    if (grabStep === 1) effectiveOpen = 0.45;
    if (grabStep === 2) effectiveOpen = 0;

    const spread = effectiveOpen * 0.5;
    const baseAngle = Math.PI / 2 + pd.baseOffset + spread * pd.jointDir;
    const prongLen = 26;
    const jointLen = 12;

    // Upper prong segment
    const jx = x + Math.cos(baseAngle) * prongLen;
    const jy = y + Math.sin(baseAngle) * prongLen;

    const prGrad = ctx.createLinearGradient(x, y, jx, jy);
    prGrad.addColorStop(0, "#b0b8c4");
    prGrad.addColorStop(0.5, "#9ca3af");
    prGrad.addColorStop(1, "#6b7280");
    ctx.strokeStyle = prGrad;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(jx, jy);
    ctx.stroke();

    // Joint ball
    const jointGrad = ctx.createRadialGradient(jx - 1, jy - 1, 0.5, jx, jy, 4);
    jointGrad.addColorStop(0, "#d1d5db");
    jointGrad.addColorStop(1, "#6b7280");
    ctx.fillStyle = jointGrad;
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(jx, jy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lower prong (claw tip) — curves inward when closing
    const tipAngle = baseAngle + pd.jointDir * (0.7 - effectiveOpen * 0.5);
    const tx = jx + Math.cos(tipAngle) * jointLen;
    const ty = jy + Math.sin(tipAngle) * jointLen;

    // Lower prong with ridges
    const tipGrad = ctx.createLinearGradient(jx, jy, tx, ty);
    tipGrad.addColorStop(0, "#9ca3af");
    tipGrad.addColorStop(1, "#6b7280");
    ctx.strokeStyle = tipGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jx, jy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Finger-like ridges (2-3 notches on inner grip surface)
    if (pd.jointDir !== 0) {
      drawProngRidges(ctx, jx, jy, tx, ty, pd.jointDir, tipAngle);
    }

    // Tip cap
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMetallicCable(ctx: CanvasRenderingContext2D, x: number, cableEndY: number) {
  const cableStartY = RAIL_Y + 20;
  const cableLen = cableEndY - cableStartY;
  const segCount = Math.max(1, Math.floor(cableLen / 7));

  // Background cable (dark shadow)
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 4;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x + 1.5, cableStartY);
  ctx.lineTo(x + 1.5, cableEndY);
  ctx.stroke();

  // Alternating light/dark segments for braided wire rope look
  for (let i = 0; i < segCount; i++) {
    const segY1 = cableStartY + (i / segCount) * cableLen;
    const segY2 = cableStartY + ((i + 1) / segCount) * cableLen;
    const isLight = i % 2 === 0;

    ctx.strokeStyle = isLight ? "#9ca3af" : "#4b5563";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x, segY1);
    ctx.lineTo(x, segY2);
    ctx.stroke();

    // Twist highlight on light segments
    if (isLight && segY2 - segY1 > 4) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 0.8, segY1);
      ctx.lineTo(x - 0.8, segY2);
      ctx.stroke();
    }
  }
}

function drawClawHub(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Hub outer shell
  const hubGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10);
  hubGrad.addColorStop(0, "#e2e8f0");
  hubGrad.addColorStop(0.4, "#94a3b8");
  hubGrad.addColorStop(1, "#475569");
  ctx.fillStyle = hubGrad;
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner ring (mechanical bearing look)
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.stroke();

  // Visible screws at cardinal positions
  const screwPositions = [
    { dx: 0, dy: -8 },
    { dx: 8, dy: 0 },
    { dx: 0, dy: 8 },
    { dx: -8, dy: 0 },
  ];
  for (const sp of screwPositions) {
    const sx = x + sp.dx;
    const sy = y + sp.dy;
    // Screw head
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Screw slot
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx - 1.2, sy);
    ctx.lineTo(sx + 1.2, sy);
    ctx.stroke();
  }

  // Hub highlight
  const hubHighlight = ctx.createRadialGradient(x - 3, y - 3, 0, x - 2, y - 2, 5);
  hubHighlight.addColorStop(0, "rgba(255,255,255,0.5)");
  hubHighlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hubHighlight;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawProngRidges(
  ctx: CanvasRenderingContext2D,
  jx: number, jy: number,
  tx: number, ty: number,
  jointDir: number,
  tipAngle: number,
) {
  // Draw 2-3 small notches on the inner (gripping) face of each prong
  const ridgeCount = 3;
  ctx.save();
  ctx.strokeStyle = "rgba(30,41,59,0.6)";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";

  for (let i = 0; i < ridgeCount; i++) {
    const t2 = (i + 0.5) / ridgeCount;
    const rx = jx + (tx - jx) * t2;
    const ry = jy + (ty - jy) * t2;
    // Perpendicular direction to the prong
    const perpAngle = tipAngle - Math.PI / 2;
    const inward = jointDir < 0 ? 1 : -1;
    const ridgeLen = 2.5 - i * 0.3;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(
      rx + Math.cos(perpAngle) * ridgeLen * inward,
      ry + Math.sin(perpAngle) * ridgeLen * inward,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D, particles: ConfettiParticle[]) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    // Alternating rectangles and circles
    if (p.size > 4) {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawGetText(ctx: CanvasRenderingContext2D, scale: number, grade: string) {
  if (scale <= 0) return;
  const col = GRADE_PLUSH[grade] ?? GRADE_PLUSH["D賞"]!;
  ctx.save();
  ctx.translate(CHUTE_X + 26, CHUTE_Y - 20);
  ctx.scale(scale, scale);
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GET!", 2, 2);
  // Main text
  ctx.fillStyle = col.glow;
  ctx.shadowColor = col.glow;
  ctx.shadowBlur = 12;
  ctx.fillText("GET!", 0, 0);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine({ resultGrade, prizeName, onResult, onStateChange }: ClawMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ClawGameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  const clawXRef = useRef(GLASS_X + GLASS_W / 2);
  const clawYRef = useRef(CLAW_HOME_Y);
  const clawOpenRef = useRef(1);
  const clawTargetXRef = useRef(GLASS_X + GLASS_W / 2);
  const clawTargetYRef = useRef(CLAW_HOME_Y);
  const grabbedPrizeRef = useRef<null | { grade: string; scale: number }>(null);
  const resultBubbleRef = useRef<{ alpha: number; y: number; bounceV: number; bounceCount: number } | null>(null);

  // Joystick visual state
  const joystickXRef = useRef(0);
  const joystickYRef = useRef(0);

  // Enhanced claw state
  const clawSwingRef = useRef(0); // lateral swing offset during descent
  const clawSwingDirRef = useRef(1);
  const grabStepRef = useRef(0); // 0=smooth, 1=snap1, 2=snap2(closed)
  const grabStepTimerRef = useRef(0);

  // Prize drop physics
  const prizeDropYRef = useRef(0);
  const prizeDropVRef = useRef(0);
  const prizeDropBounceRef = useRef(0);
  const flapAngleRef = useRef(0);

  // Celebration
  const confettiRef = useRef<ConfettiParticle[]>([]);
  const getTextScaleRef = useRef(0);
  const successFlashRef = useRef(0); // 0..1, fades after success

  // Countdown timer (30s for aiming)
  const countdownRef = useRef(30);

  const prizesRef = useRef(makePrizes(resultGrade));
  const timeRef = useRef(0);
  const [gameState, setGameState] = useState<ClawGameState>("IDLE");

  const setGameStateSync = useCallback((s: ClawGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  useEffect(() => {
    prizesRef.current = makePrizes(resultGrade);
  }, [resultGrade]);

  // Move joystick to follow claw X position
  const updateJoystick = useCallback((targetClawX: number) => {
    const normalizedX = (targetClawX - (GLASS_X + GLASS_W / 2)) / (GLASS_W / 2);
    joystickXRef.current = Math.max(-1, Math.min(1, normalizedX)) * (JOYSTICK_BASE_R - 8);
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const rawX = (e.clientX - rect.left) * scaleX;
    const clamped = Math.max(GLASS_X + 20, Math.min(GLASS_X + GLASS_W - 20, rawX));
    clawXRef.current = clamped;
    clawTargetXRef.current = clamped;
    updateJoystick(clamped);
    if (stateRef.current === "IDLE") setGameStateSync("AIMING");
  }, [setGameStateSync, updateJoystick]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    if (!touch) return;
    const scaleX = CANVAS_W / rect.width;
    const rawX = (touch.clientX - rect.left) * scaleX;
    const clamped = Math.max(GLASS_X + 20, Math.min(GLASS_X + GLASS_W - 20, rawX));
    clawXRef.current = clamped;
    clawTargetXRef.current = clamped;
    updateJoystick(clamped);
    if (stateRef.current === "IDLE") setGameStateSync("AIMING");
  }, [setGameStateSync, updateJoystick]);

  const handleDrop = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;
    const targetPrize = prizesRef.current[6];
    if (!targetPrize) return;

    setGameStateSync("DESCENDING");
    grabbedPrizeRef.current = null;
    resultBubbleRef.current = null;
    grabStepRef.current = 0;
    confettiRef.current = [];
    getTextScaleRef.current = 0;
    flapAngleRef.current = 0;

    const descendY = targetPrize.y - PLUSH_R;
    clawTargetYRef.current = descendY;
    clawOpenRef.current = 1;
    joystickYRef.current = 8;

    const waitForDescent = setInterval(() => {
      if (Math.abs(clawYRef.current - descendY) < 3) {
        clearInterval(waitForDescent);
        setGameStateSync("GRABBING");

        // Two-step snap close
        grabStepRef.current = 1;
        setTimeout(() => {
          grabStepRef.current = 2;
          clawOpenRef.current = 0;
          joystickYRef.current = 0;

          setTimeout(() => {
            grabbedPrizeRef.current = { grade: resultGrade, scale: 1 };
            setGameStateSync("LIFTING");
            clawTargetYRef.current = CLAW_HOME_Y;
            joystickYRef.current = -8;
            grabStepRef.current = 0;

            const waitForLift = setInterval(() => {
              if (Math.abs(clawYRef.current - CLAW_HOME_Y) < 3) {
                clearInterval(waitForLift);
                clawTargetXRef.current = CHUTE_X - 20;
                setGameStateSync("DROPPING");
                joystickYRef.current = 0;
                updateJoystick(CHUTE_X - 20);

                const waitForChute = setInterval(() => {
                  if (Math.abs(clawXRef.current - (CHUTE_X - 20)) < 8) {
                    clearInterval(waitForChute);
                    clawOpenRef.current = 1;
                    grabbedPrizeRef.current = null;

                    // Initialize prize drop physics — bouncing into chute
                    prizeDropYRef.current = clawYRef.current + 32;
                    prizeDropVRef.current = 0;
                    prizeDropBounceRef.current = 0;
                    flapAngleRef.current = 0;

                    resultBubbleRef.current = {
                      alpha: 0,
                      y: CHUTE_Y + 15,
                      bounceV: 0,
                      bounceCount: 0,
                    };
                    setGameStateSync("RESULT");
                    onResult?.(resultGrade);

                    // Trigger celebration for A-grade
                    if (resultGrade === "A賞") {
                      spawnConfetti();
                    }
                    // GET! text pop
                    getTextScaleRef.current = 0.1;
                    // Machine frame success flash
                    successFlashRef.current = 1.0;
                  }
                }, 100);
              }
            }, 100);
          }, 200);
        }, 180);
      }
    }, 100);
  }, [resultGrade, onResult, setGameStateSync, updateJoystick]);

  const spawnConfetti = useCallback(() => {
    const colors = ["#fbbf24", "#f87171", "#34d399", "#60a5fa", "#c084fc", "#fb923c", "#f472b6"];
    const particles: ConfettiParticle[] = [];
    const originX = CHUTE_X + 26;
    const originY = CHUTE_Y;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particles.push({
        x: originX + (Math.random() - 0.5) * 20,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#fbbf24",
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        size: 3 + Math.random() * 5,
        life: 1,
      });
    }
    confettiRef.current = particles;
  }, []);

  const handleReset = useCallback(() => {
    clawXRef.current = GLASS_X + GLASS_W / 2;
    clawYRef.current = CLAW_HOME_Y;
    clawOpenRef.current = 1;
    clawTargetXRef.current = GLASS_X + GLASS_W / 2;
    clawTargetYRef.current = CLAW_HOME_Y;
    grabbedPrizeRef.current = null;
    resultBubbleRef.current = null;
    joystickXRef.current = 0;
    joystickYRef.current = 0;
    clawSwingRef.current = 0;
    grabStepRef.current = 0;
    confettiRef.current = [];
    getTextScaleRef.current = 0;
    successFlashRef.current = 0;
    flapAngleRef.current = 0;
    countdownRef.current = 30;
    prizesRef.current = makePrizes(resultGrade);
    setGameStateSync("IDLE");
  }, [resultGrade, setGameStateSync]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    timeRef.current += 0.016;
    const t = timeRef.current;
    const state = stateRef.current;

    // Smooth claw movement
    clawXRef.current += (clawTargetXRef.current - clawXRef.current) * 0.09;
    clawYRef.current += (clawTargetYRef.current - clawYRef.current) * 0.09;

    // Claw swing during descent
    if (state === "DESCENDING") {
      clawSwingRef.current += clawSwingDirRef.current * 0.25;
      if (Math.abs(clawSwingRef.current) > 4) clawSwingDirRef.current *= -1;
    } else {
      // Dampen swing
      clawSwingRef.current *= 0.88;
    }

    // Countdown timer during IDLE/AIMING
    if (state === "AIMING") {
      countdownRef.current = Math.max(0, countdownRef.current - 0.016);
    } else if (state === "IDLE") {
      countdownRef.current = 30;
    }

    // Result bubble bounce physics
    if (resultBubbleRef.current && state === "RESULT") {
      const rb = resultBubbleRef.current;
      if (rb.alpha < 1) rb.alpha += 0.035;

      // Flap opens
      if (flapAngleRef.current < 0.75) {
        flapAngleRef.current += 0.04;
      }

      // Bounce physics
      if (rb.bounceCount < 3) {
        rb.bounceV += 0.6; // gravity
        rb.y += rb.bounceV;
        const floorY = CHUTE_Y + 40;
        if (rb.y >= floorY) {
          rb.y = floorY;
          rb.bounceV *= -(0.45 - rb.bounceCount * 0.12);
          rb.bounceCount++;
        }
      } else {
        // Settled — gentle float
        rb.y -= 0.18;
      }
    }

    // Confetti physics
    confettiRef.current = confettiRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.15,
        vx: p.vx * 0.98,
        rotation: p.rotation + p.rotSpeed,
        life: p.life - 0.012,
      }))
      .filter(p => p.life > 0);

    // GET! text scale-up pop
    if (getTextScaleRef.current > 0 && getTextScaleRef.current < 1.2) {
      getTextScaleRef.current = Math.min(1.2, getTextScaleRef.current + 0.07);
    } else if (getTextScaleRef.current >= 1.2) {
      getTextScaleRef.current = Math.max(1.0, getTextScaleRef.current - 0.01);
    }

    // Success flash fade
    if (successFlashRef.current > 0) {
      successFlashRef.current = Math.max(0, successFlashRef.current - 0.008);
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#060d18");
    bgGrad.addColorStop(1, "#03080e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Machine body (3D) with success flash
    drawMachineBody(ctx, t, successFlashRef.current);

    // Glass case (transparent front with 3D sides)
    drawGlassCase(ctx);

    // Prizes inside glass
    for (let i = 0; i < prizesRef.current.length; i++) {
      const p = prizesRef.current[i];
      if (!p) continue;
      const skipGrabbed = i === 6 && (
        state === "GRABBING" || state === "LIFTING" || state === "DROPPING" || state === "RESULT"
      );
      if (skipGrabbed) continue;
      drawPlushToy(ctx, p.x, p.y, p.grade, 1, 1, t + p.wobblePhase);
    }

    // Claw (with swing and grab snap)
    drawClaw(
      ctx,
      clawXRef.current,
      clawYRef.current,
      clawOpenRef.current,
      state === "DESCENDING" ? clawSwingRef.current : 0,
      grabStepRef.current,
    );

    // Grabbed prize follows claw (with squish on grab)
    if (grabbedPrizeRef.current) {
      const squish = state === "GRABBING" ? 0.8 : 0;
      drawPlushToy(ctx, clawXRef.current, clawYRef.current + 32, grabbedPrizeRef.current.grade, 1, 0.85, 0, squish);
    }

    // Aim guide
    if (state === "IDLE" || state === "AIMING") {
      ctx.save();
      ctx.strokeStyle = "rgba(56,189,248,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(clawXRef.current, CLAW_HOME_Y + 30);
      ctx.lineTo(clawXRef.current, PRIZE_ZONE_Y_MIN);
      ctx.stroke();
      ctx.setLineDash([]);
      // Crosshair
      ctx.strokeStyle = "rgba(56,189,248,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(clawXRef.current, PRIZE_ZONE_Y_MIN + 30, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Result: prize in chute with bounce animation
    if (resultBubbleRef.current && state === "RESULT") {
      const rb = resultBubbleRef.current;
      ctx.save();
      ctx.globalAlpha = Math.min(1, rb.alpha);
      drawPlushToy(ctx, CHUTE_X + 26, rb.y + 14, resultGrade, 1, 1.1);
      ctx.restore();

      // Prize name label
      if (rb.alpha > 0.5) {
        const col = GRADE_PLUSH[resultGrade] ?? GRADE_PLUSH["D賞"]!;
        ctx.save();
        ctx.globalAlpha = (rb.alpha - 0.5) * 2;
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = 12;
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const label = `${resultGrade}${prizeName ? ` · ${prizeName}` : ""}`;
        ctx.strokeStyle = col.highlight;
        ctx.lineWidth = 2;
        ctx.strokeText(label, CANVAS_W / 2, CANVAS_H - 24);
        ctx.fillStyle = col.highlight;
        ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 24);
        ctx.restore();
      }
    }

    // Confetti burst
    drawConfetti(ctx, confettiRef.current);

    // GET! text pop
    if (state === "RESULT" && getTextScaleRef.current > 0) {
      drawGetText(ctx, getTextScaleRef.current, resultGrade);
    }

    // Chute flap (drawn on top, animated open)
    if (state === "RESULT" || state === "DROPPING") {
      drawChute(ctx, flapAngleRef.current);
    } else {
      drawChute(ctx, 0);
    }

    // Control panel with joystick
    const isInteractable = state === "IDLE" || state === "AIMING";
    drawControlPanel(ctx, joystickXRef.current, joystickYRef.current, t, isInteractable, countdownRef.current);

    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  const isInteractable = gameState === "IDLE" || gameState === "AIMING";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-sky-900/60 shadow-2xl block cursor-crosshair"
        style={{ background: "#060d18", touchAction: "none", maxWidth: "100%" }}
        onMouseMove={handleCanvasMouseMove}
        onTouchMove={handleCanvasTouchMove}
      />

      <div className="flex gap-3">
        <button
          onClick={handleDrop}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-sky-600 hover:bg-sky-500 active:scale-95 text-white shadow-sky-500/30 cursor-pointer"
              : "bg-gray-800 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          下爪 DROP
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          重置
        </button>
      </div>

      <p className="text-xs text-gray-500">移動滑鼠/觸控控制夾子位置，按「下爪」抓取</p>

      <div className="text-xs text-gray-500 font-mono">
        狀態:{" "}
        <span className={
          gameState === "RESULT" ? "text-amber-400"
            : gameState === "GRABBING" || gameState === "LIFTING" ? "text-sky-400"
            : "text-gray-400"
        }>
          {gameState}
        </span>
      </div>
    </div>
  );
}
