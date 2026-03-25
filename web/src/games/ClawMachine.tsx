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
  ear: string; text: string; glow: string
}> = {
  "A賞": { body: "#dc2626", shadow: "#991b1b", highlight: "#fca5a5", ear: "#f87171", text: "#fff", glow: "#f87171" },
  "B賞": { body: "#2563eb", shadow: "#1d4ed8", highlight: "#93c5fd", ear: "#60a5fa", text: "#fff", glow: "#60a5fa" },
  "C賞": { body: "#16a34a", shadow: "#15803d", highlight: "#86efac", ear: "#4ade80", text: "#fff", glow: "#4ade80" },
  "D賞": { body: "#7c3aed", shadow: "#6d28d9", highlight: "#c4b5fd", ear: "#a78bfa", text: "#fff", glow: "#a78bfa" },
};

const PLUSH_R = 20;
const BALL_COUNT = 14;

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

function drawMachineBody(ctx: CanvasRenderingContext2D, t: number) {
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
  ctx.shadowColor = "#0ea5e9";
  ctx.shadowBlur = 16;
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
  ctx.strokeStyle = "#0369a1";
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
  drawMachineLights(ctx, t);

  // Header panel
  drawMachineHeader(ctx);

  // Draw stand/legs
  drawLegs(ctx);
}

function drawMachineLights(ctx: CanvasRenderingContext2D, t: number) {
  const lightColors = ["#38bdf8", "#7dd3fc", "#0ea5e9", "#38bdf8", "#bae6fd"];
  // Top edge
  for (let i = 0; i < 8; i++) {
    const x = MACHINE_X + 22 + i * (MACHINE_W - 44) / 7;
    const y = MACHINE_Y + 8;
    const blink = Math.sin(t * 4 + i * 0.7) > 0;
    const col = lightColors[i % lightColors.length] ?? "#38bdf8";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
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
    const blink = Math.sin(t * 4 + i * 0.7 + Math.PI) > 0;
    const col = lightColors[i % lightColors.length] ?? "#38bdf8";
    ctx.save();
    if (blink) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
    ctx.fillStyle = blink ? col : `${col}33`;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
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

  // Glass floor (slightly lighter)
  const floorGrad = ctx.createLinearGradient(GLASS_X, GLASS_Y + GLASS_H - 20, GLASS_X, GLASS_Y + GLASS_H);
  floorGrad.addColorStop(0, "#0c1a2e");
  floorGrad.addColorStop(1, "#071020");
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.roundRect(GLASS_X + 2, GLASS_Y + GLASS_H - 18, GLASS_W - 4, 16, [0, 0, 4, 4]);
  ctx.fill();

  // Glass reflection (diagonal white streak)
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(GLASS_X + 15, GLASS_Y + 10);
  ctx.lineTo(GLASS_X + 60, GLASS_Y + GLASS_H * 0.7);
  ctx.stroke();
  ctx.globalAlpha = 0.04;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GLASS_X + 40, GLASS_Y + 5);
  ctx.lineTo(GLASS_X + 80, GLASS_Y + GLASS_H * 0.5);
  ctx.stroke();
  ctx.restore();

  // Chute / prize exit opening
  drawChute(ctx);
}

function drawChute(ctx: CanvasRenderingContext2D) {
  const chuteW = 52, chuteH = 60;
  const cx = CHUTE_X;
  const cy = CHUTE_Y;

  // Chute body (3D box)
  // Back face
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

  // Flap at bottom
  const flapGrad = ctx.createLinearGradient(cx, cy + chuteH - 16, cx, cy + chuteH);
  flapGrad.addColorStop(0, "#0369a1");
  flapGrad.addColorStop(1, "#075985");
  ctx.fillStyle = flapGrad;
  ctx.beginPath();
  ctx.roundRect(cx + 4, cy + chuteH - 18, chuteW - 8, 14, [0, 0, 4, 4]);
  ctx.fill();

  // Label
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("出口", cx + chuteW / 2, cy + chuteH - 10);
}

function drawControlPanel(ctx: CanvasRenderingContext2D, joystickX: number, joystickY: number, t: number, isInteractable: boolean) {
  // Panel body
  const panelGrad = ctx.createLinearGradient(PANEL_X, PANEL_Y, PANEL_X + PANEL_W, PANEL_Y + PANEL_H);
  panelGrad.addColorStop(0, "#0f2040");
  panelGrad.addColorStop(1, "#071830");
  ctx.fillStyle = panelGrad;
  ctx.strokeStyle = "#0369a1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
  ctx.fill();
  ctx.stroke();

  // Panel label
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("CONTROL", PANEL_X + PANEL_W / 2, PANEL_Y + 8);

  // Joystick base
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

  // Joystick base rim
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(JOYSTICK_CX, JOYSTICK_BASE_Y, JOYSTICK_BASE_R - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Stick
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

  // Stick body
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

  // Stick knob (top ball)
  const knobGrad = ctx.createRadialGradient(
    stickEndX - 4, stickEndY - 4, 2,
    stickEndX, stickEndY, 10
  );
  knobGrad.addColorStop(0, isInteractable ? "#7dd3fc" : "#6b7280");
  knobGrad.addColorStop(0.5, isInteractable ? "#0ea5e9" : "#4b5563");
  knobGrad.addColorStop(1, isInteractable ? "#0369a1" : "#374151");
  ctx.fillStyle = knobGrad;
  ctx.strokeStyle = isInteractable ? "#38bdf8" : "#4b5563";
  ctx.lineWidth = 1.5;
  if (isInteractable) {
    ctx.shadowColor = "#0ea5e9";
    ctx.shadowBlur = 10 + Math.sin(t * 3) * 4;
  }
  ctx.beginPath();
  ctx.arc(stickEndX, stickEndY, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Knob shine
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(stickEndX - 3, stickEndY - 3, 4, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Drop button below joystick
  const dropBtnX = PANEL_X + PANEL_W / 2;
  const dropBtnY = JOYSTICK_BASE_Y + 55;
  const dropBtnR = 14;

  const btnGrad = ctx.createRadialGradient(dropBtnX - 4, dropBtnY - 4, 2, dropBtnX, dropBtnY, dropBtnR);
  btnGrad.addColorStop(0, isInteractable ? "#fca5a5" : "#6b7280");
  btnGrad.addColorStop(1, isInteractable ? "#b91c1c" : "#374151");
  ctx.fillStyle = btnGrad;
  ctx.strokeStyle = isInteractable ? "#ef4444" : "#4b5563";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dropBtnX, dropBtnY, dropBtnR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DROP", dropBtnX, dropBtnY);
}

function drawPlushToy(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  grade: string,
  alpha = 1,
  scale = 1,
  wobble = 0,
) {
  const col = GRADE_PLUSH[grade] ?? GRADE_PLUSH["D賞"]!;
  const r = PLUSH_R * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + Math.sin(wobble) * 1.5);
  ctx.scale(scale, scale);

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Body — fluffy rounded shape
  const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
  bodyGrad.addColorStop(0, col.highlight);
  bodyGrad.addColorStop(0.5, col.body);
  bodyGrad.addColorStop(1, col.shadow);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // Soft blobby shape using bezier curves instead of perfect circle
  ctx.moveTo(r, 0);
  ctx.bezierCurveTo(r, -r * 0.55, r * 0.55, -r, 0, -r);
  ctx.bezierCurveTo(-r * 0.55, -r, -r, -r * 0.55, -r, 0);
  ctx.bezierCurveTo(-r, r * 0.55, -r * 0.55, r, 0, r);
  ctx.bezierCurveTo(r * 0.55, r, r, r * 0.55, r, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Ears
  ctx.fillStyle = col.ear;
  // Left ear
  ctx.beginPath();
  ctx.ellipse(-r * 0.55, -r * 0.78, r * 0.25, r * 0.32, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Right ear
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.78, r * 0.25, r * 0.32, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Inner ear
  ctx.fillStyle = col.highlight;
  ctx.globalAlpha = (alpha) * 0.6;
  ctx.beginPath();
  ctx.ellipse(-r * 0.55, -r * 0.78, r * 0.12, r * 0.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.78, r * 0.12, r * 0.2, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Face — cute eyes
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.15, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.15, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.22, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.34, -r * 0.22, r * 0.05, 0, Math.PI * 2);
  ctx.fill();

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

  // Belly patch (lighter circle)
  ctx.fillStyle = col.highlight;
  ctx.globalAlpha = alpha * 0.35;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.3, r * 0.42, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Grade tag
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${r * 0.42}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade.charAt(0), 0, r * 0.32);

  ctx.restore();
}

function drawClaw(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  openAmount: number, // 0 = closed, 1 = open
) {
  ctx.save();

  // Cable from rail
  const cableGrad = ctx.createLinearGradient(x, RAIL_Y + 20, x, y);
  cableGrad.addColorStop(0, "#6b7280");
  cableGrad.addColorStop(1, "#9ca3af");
  ctx.strokeStyle = cableGrad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, RAIL_Y + 20);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Secondary cable (adds depth)
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 2, RAIL_Y + 20);
  ctx.lineTo(x + 2, y);
  ctx.stroke();

  // Claw body hub
  const hubGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
  hubGrad.addColorStop(0, "#d1d5db");
  hubGrad.addColorStop(1, "#6b7280");
  ctx.fillStyle = hubGrad;
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hub highlight
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Three prongs with joints
  const prongData = [
    { baseOffset: -0.45, jointDir: -1 },
    { baseOffset: 0, jointDir: 0 },
    { baseOffset: 0.45, jointDir: 1 },
  ];

  for (const pd of prongData) {
    const spread = openAmount * 0.5;
    const baseAngle = Math.PI / 2 + pd.baseOffset + spread * pd.jointDir;
    const prongLen = 26;
    const jointLen = 12;

    // Upper prong segment
    const jx = x + Math.cos(baseAngle) * prongLen;
    const jy = y + Math.sin(baseAngle) * prongLen;

    const prGrad = ctx.createLinearGradient(x, y, jx, jy);
    prGrad.addColorStop(0, "#9ca3af");
    prGrad.addColorStop(1, "#6b7280");
    ctx.strokeStyle = prGrad;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(jx, jy);
    ctx.stroke();

    // Joint ball
    ctx.fillStyle = "#9ca3af";
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(jx, jy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lower prong (claw tip) — curves inward when closing
    const tipAngle = baseAngle + pd.jointDir * (0.7 - openAmount * 0.5);
    const tx = jx + Math.cos(tipAngle) * jointLen;
    const ty = jy + Math.sin(tipAngle) * jointLen;

    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jx, jy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // Tip cap
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }

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
  const resultBubbleRef = useRef<{ alpha: number; y: number } | null>(null);

  // Joystick visual state
  const joystickXRef = useRef(0);
  const joystickYRef = useRef(0);

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

    const descendY = targetPrize.y - PLUSH_R;
    clawTargetYRef.current = descendY;
    clawOpenRef.current = 1;
    joystickYRef.current = 8; // joystick pushed forward

    const waitForDescent = setInterval(() => {
      if (Math.abs(clawYRef.current - descendY) < 3) {
        clearInterval(waitForDescent);
        setGameStateSync("GRABBING");
        clawOpenRef.current = 0;
        joystickYRef.current = 0;

        setTimeout(() => {
          grabbedPrizeRef.current = { grade: resultGrade, scale: 1 };
          setGameStateSync("LIFTING");
          clawTargetYRef.current = CLAW_HOME_Y;
          joystickYRef.current = -8; // joystick pulled back

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
                  resultBubbleRef.current = { alpha: 0, y: CHUTE_Y + 20 };
                  setGameStateSync("RESULT");
                  onResult?.(resultGrade);
                }
              }, 100);
            }
          }, 100);
        }, 500);
      }
    }, 100);
  }, [resultGrade, onResult, setGameStateSync, updateJoystick]);

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

    // Result bubble float
    if (resultBubbleRef.current) {
      if (resultBubbleRef.current.alpha < 1) resultBubbleRef.current.alpha += 0.035;
      resultBubbleRef.current.y -= 0.25;
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#060d18");
    bgGrad.addColorStop(1, "#03080e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Machine body (3D)
    drawMachineBody(ctx, t);

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

    // Claw
    drawClaw(ctx, clawXRef.current, clawYRef.current, clawOpenRef.current);

    // Grabbed prize follows claw
    if (grabbedPrizeRef.current) {
      drawPlushToy(ctx, clawXRef.current, clawYRef.current + 32, grabbedPrizeRef.current.grade, 1, 0.85);
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

    // Result prize in chute
    if (resultBubbleRef.current && state === "RESULT") {
      const rb = resultBubbleRef.current;
      ctx.save();
      ctx.globalAlpha = Math.min(1, rb.alpha);
      drawPlushToy(ctx, CHUTE_X + 26, rb.y + 40, resultGrade, 1, 1.3);
      ctx.restore();

      if (rb.alpha > 0.5) {
        const col = GRADE_PLUSH[resultGrade] ?? GRADE_PLUSH["D賞"]!;
        ctx.save();
        ctx.globalAlpha = (rb.alpha - 0.5) * 2;
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = 12;
        ctx.fillStyle = col.body;
        ctx.strokeStyle = col.highlight;
        ctx.lineWidth = 2;
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const label = `${resultGrade}${prizeName ? ` · ${prizeName}` : ""}`;
        ctx.strokeText(label, CANVAS_W / 2, CANVAS_H - 24);
        ctx.fillStyle = col.highlight;
        ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 24);
        ctx.restore();
      }
    }

    // Control panel with joystick
    const isInteractable = state === "IDLE" || state === "AIMING";
    drawControlPanel(ctx, joystickXRef.current, joystickYRef.current, t, isInteractable);

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
