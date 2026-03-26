"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MapleSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineMapleProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: MapleSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// MapleStory palette — warm, colorful, saturated
// ─────────────────────────────────────────────────────────────────────────────

const MP = {
  // Sky background
  skyTop:       "#87ceeb",
  skyMid:       "#b0dff5",
  skyBot:       "#d4eefc",
  // Buildings/town silhouette
  buildingA:    "#5c8ba3",
  buildingB:    "#4a7a92",
  buildingC:    "#6699aa",
  // Ground
  groundTop:    "#5aaa3a",
  groundBot:    "#3d8a22",
  // Machine frame — wooden brown
  frameOuter:   "#8b5e1a",
  frameInner:   "#c8843a",
  frameDark:    "#5a3a0a",
  frameLight:   "#f0c870",
  // Maple leaf red/orange
  mapleRed:     "#e83222",
  mapleOrange:  "#f07020",
  mapleYellow:  "#f0c820",
  // Reel background
  reelBg:       "#fff8ee",
  reelBorder:   "#c8843a",
  reelShadow:   "#8b5e1a",
  // Grade colors / item icons
  gradeA:       "#ffd700",   // golden scroll
  gradeB:       "#5599ff",   // blue crystal
  gradeC:       "#44cc77",   // green potion
  gradeD:       "#cc7744",   // brown mushroom
  // Text
  ink:          "#1a0a00",
  white:        "#ffffff",
  // Lever
  leverWood:    "#8b5e1a",
  leverKnob:    "#e83222",
  // Win effects
  winFlash:     "rgba(255,255,200,0.95)",
  sparkleA:     "#ffe066",
  sparkleB:     "#ff88cc",
  sparkleC:     "#88ddff",
  // Skin / mascot
  skin:         "#ffe8cc",
  mascotHair:   "#ee4422",
  mascotBody:   "#cc2222",
  // Falling leaves bg
  leaf1:        "#e83222",
  leaf2:        "#f07020",
  leaf3:        "#f0c820",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grade data
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const GRADE_COLOR: Record<string, string> = {
  "A賞": MP.gradeA,
  "B賞": MP.gradeB,
  "C賞": MP.gradeC,
  "D賞": MP.gradeD,
};

const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 72;
const REEL_VISIBLE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Maple leaf particle
// ─────────────────────────────────────────────────────────────────────────────

interface MapleLeaf {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  rotation: number;
  rotSpeed: number;
  color: string;
}

function makeLeaves(count: number): MapleLeaf[] {
  const colors = [MP.leaf1, MP.leaf2, MP.leaf3];
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * W * 1.3 - W * 0.15,
    y: (Math.sin(i * 2.1) * 0.5 + 0.5) * H,
    size: 8 + (i % 4) * 4,
    speed: 0.35 + (i % 5) * 0.12,
    drift: Math.sin(i * 0.9) * 1.2,
    phase: i * 0.77,
    rotation: i * 0.5,
    rotSpeed: 0.01 + (i % 3) * 0.006,
    color: colors[i % colors.length] ?? MP.leaf1,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particle
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating damage-number text
// ─────────────────────────────────────────────────────────────────────────────

interface FloatText {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item drop particle (falls from top)
// ─────────────────────────────────────────────────────────────────────────────

interface ItemDrop {
  x: number;
  y: number;
  vy: number;
  sway: number;
  swayPhase: number;
  grade: Grade;
  landed: boolean;
  sparkle: number;
  life: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapleRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: string,
  stroke = MP.frameDark,
  lw = 2.5,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function mapleDamageText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  size: number,
  color: string,
  outline = MP.ink,
  outlineW = 4,
): void {
  ctx.save();
  ctx.font = `900 ${size}px "Impact", "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = outline;
  ctx.lineWidth = outlineW;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw a maple leaf shape (simplified 3-lobe outline) */
function drawMapleLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  rotation: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.strokeStyle = MP.frameDark;
  ctx.lineWidth = 0.6;

  // Draw 5-pointed maple leaf using bezier approximation
  ctx.beginPath();
  const s = size * 0.5;
  // Top lobe
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.3, -s * 1.1, s * 0.8, -s * 0.5, s * 0.5, 0);
  // Right upper lobe
  ctx.bezierCurveTo(s * 1.1, -s * 0.3, s * 1.1, s * 0.3, s * 0.3, s * 0.2);
  // Right lower
  ctx.bezierCurveTo(s * 0.8, s * 0.8, s * 0.3, s * 0.9, 0, s * 1.0);
  // Left lower
  ctx.bezierCurveTo(-s * 0.3, s * 0.9, -s * 0.8, s * 0.8, -s * 0.3, s * 0.2);
  // Left upper lobe
  ctx.bezierCurveTo(-s * 1.1, s * 0.3, -s * 1.1, -s * 0.3, -s * 0.5, 0);
  // Back to top
  ctx.bezierCurveTo(-s * 0.8, -s * 0.5, -s * 0.3, -s * 1.1, 0, -s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stem
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.lineTo(0, s * 1.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/** Draw MapleStory-style chibi mascot on top of machine */
function drawMascot(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  bobOffset: number,
): void {
  const headR = 18;
  const by = cy + headR * 0.6 + bobOffset;
  const bodyH = headR * 1.0;
  const bodyW = headR * 0.8;

  // Legs
  for (const lx of [cx - bodyW * 0.2, cx + bodyW * 0.2]) {
    ctx.beginPath();
    ctx.moveTo(lx, by + bodyH);
    ctx.lineTo(lx, by + bodyH + headR * 0.65);
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = headR * 0.3;
    ctx.lineCap = "round";
    ctx.stroke();
    // Shoe
    ctx.beginPath();
    ctx.ellipse(lx, by + bodyH + headR * 0.65, headR * 0.22, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = MP.ink;
    ctx.fill();
  }

  // Body (red outfit)
  mapleRoundRect(ctx, cx - bodyW / 2, by, bodyW, bodyH, headR * 0.3, MP.mascotBody, MP.ink, 1.5);

  // Maple leaf emblem on body
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = MP.mapleYellow;
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  // Tiny star for emblem
  const es = 4;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? es : es * 0.4;
    const px = cx + Math.cos(a) * r;
    const py = by + bodyH * 0.4 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head (large)
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.4 + bobOffset, headR, 0, Math.PI * 2);
  ctx.fillStyle = MP.skin;
  ctx.fill();
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hair (spiky red, MapleStory style)
  ctx.save();
  ctx.fillStyle = MP.mascotHair;
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 1.5;
  const hcy = cy - headR * 0.4 + bobOffset;
  // Main hair cap
  ctx.beginPath();
  ctx.arc(cx, hcy, headR, -Math.PI * 1.1, -Math.PI * 0.0);
  ctx.fill();
  // Spiky bits
  for (let sp = 0; sp < 4; sp++) {
    const sa = -Math.PI * 0.9 + (sp / 3) * Math.PI * 0.8;
    const tipX = cx + Math.cos(sa) * headR * 1.45;
    const tipY = hcy + Math.sin(sa) * headR * 1.45;
    const baseX1 = cx + Math.cos(sa - 0.25) * headR * 0.95;
    const baseY1 = hcy + Math.sin(sa - 0.25) * headR * 0.95;
    const baseX2 = cx + Math.cos(sa + 0.25) * headR * 0.95;
    const baseY2 = hcy + Math.sin(sa + 0.25) * headR * 0.95;
    ctx.beginPath();
    ctx.moveTo(baseX1, baseY1);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX2, baseY2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Eyes — big round MapleStory eyes
  const ey = cy - headR * 0.38 + bobOffset;
  const eSpacing = headR * 0.36;
  for (const ex of [cx - eSpacing, cx + eSpacing]) {
    // Eye white
    ctx.beginPath();
    ctx.ellipse(ex, ey, headR * 0.19, headR * 0.23, 0, 0, Math.PI * 2);
    ctx.fillStyle = MP.white;
    ctx.fill();
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Pupil
    ctx.beginPath();
    ctx.ellipse(ex, ey + headR * 0.04, headR * 0.11, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = MP.ink;
    ctx.fill();
    // Sparkle 1
    ctx.beginPath();
    ctx.arc(ex - headR * 0.05, ey - headR * 0.06, headR * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = MP.white;
    ctx.fill();
    // Sparkle 2
    ctx.beginPath();
    ctx.arc(ex + headR * 0.03, ey - headR * 0.02, headR * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = MP.white;
    ctx.fill();
  }

  // Mouth (happy curve)
  ctx.beginPath();
  ctx.arc(cx, ey + headR * 0.25, headR * 0.16, 0, Math.PI);
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Blush circles
  for (const bx of [cx - headR * 0.55, cx + headR * 0.55]) {
    ctx.beginPath();
    ctx.ellipse(bx, ey + headR * 0.14, headR * 0.14, headR * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,150,150,0.45)";
    ctx.fill();
  }

  // Arms waving
  ctx.save();
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = headR * 0.24;
  ctx.lineCap = "round";
  // Left arm (raised with bobbing)
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, by + bodyH * 0.3);
  ctx.quadraticCurveTo(
    cx - bodyW * 1.1,
    by - headR * 0.3 + bobOffset * 2,
    cx - bodyW * 0.8,
    by - headR * 0.6 + bobOffset * 2,
  );
  ctx.stroke();
  // Right arm down
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2, by + bodyH * 0.3);
  ctx.quadraticCurveTo(
    cx + bodyW * 0.9,
    by + bodyH * 0.5,
    cx + bodyW * 0.7,
    by + bodyH * 0.8,
  );
  ctx.stroke();
  ctx.restore();
}

/** Draw MapleStory-style item icon for a grade */
function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (grade === "A賞") {
    // Golden scroll — rolled parchment
    const w = size * 0.7;
    const h = size * 0.85;
    // Main scroll body
    mapleRoundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4, "#fff9cc", "#c8a000", 2);
    // Scroll end rolls
    ctx.beginPath();
    ctx.ellipse(cx, cy - h / 2, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8d060";
    ctx.fill();
    ctx.strokeStyle = "#8a6000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + h / 2, w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8d060";
    ctx.fill();
    ctx.stroke();
    // Gold star on scroll
    ctx.fillStyle = MP.gradeA;
    ctx.strokeStyle = "#8a6000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size * 0.22 : size * 0.1;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // "A" text
    mapleDamageText(ctx, "A", cx, cy, size * 0.3, MP.white, "#8a6000", 2);
  } else if (grade === "B賞") {
    // Blue crystal
    ctx.fillStyle = MP.gradeB;
    ctx.strokeStyle = "#2244aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.15);
    ctx.lineTo(cx + size * 0.35, cy + size * 0.2);
    ctx.lineTo(cx, cy + size * 0.5);
    ctx.lineTo(cx - size * 0.35, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.35, cy - size * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Crystal shine
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.12, cy - size * 0.38);
    ctx.lineTo(cx + size * 0.06, cy - size * 0.28);
    ctx.lineTo(cx - size * 0.04, cy - size * 0.0);
    ctx.closePath();
    ctx.fill();
    mapleDamageText(ctx, "B", cx, cy + size * 0.1, size * 0.28, MP.white, "#2244aa", 2);
  } else if (grade === "C賞") {
    // Green potion bottle
    const bw = size * 0.45;
    const bh = size * 0.72;
    // Bottle body
    mapleRoundRect(ctx, cx - bw / 2, cy - bh * 0.3, bw, bh, bw * 0.5, MP.gradeC, "#227744", 2);
    // Bottle neck
    mapleRoundRect(ctx, cx - bw * 0.28, cy - bh * 0.3 - bh * 0.25, bw * 0.56, bh * 0.25, 3, "#44aa66", "#227744", 1.5);
    // Cork
    mapleRoundRect(ctx, cx - bw * 0.2, cy - bh * 0.3 - bh * 0.35, bw * 0.4, bh * 0.12, 2, "#c8843a", "#8b5e1a", 1);
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.15, cy + bh * 0.05, bw * 0.1, bh * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    mapleDamageText(ctx, "C", cx, cy + bh * 0.15, size * 0.28, MP.white, "#227744", 2);
  } else {
    // Brown mushroom (MapleStory orange mushroom)
    // Cap
    ctx.fillStyle = "#cc7733";
    ctx.strokeStyle = "#884411";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - size * 0.1, size * 0.48, size * 0.38, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // White spots on cap
    for (const [dx, dy] of [[-0.18, -0.15], [0.18, -0.2], [0, -0.28]]) {
      ctx.beginPath();
      ctx.arc(cx + size * dx, cy - size * 0.1 + size * dy, size * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = MP.white;
      ctx.fill();
    }
    // Stem
    mapleRoundRect(ctx, cx - size * 0.2, cy - size * 0.15, size * 0.4, size * 0.45, size * 0.1, "#f5e8c0", "#884411", 1.5);
    // Face on stem
    // Eyes
    for (const ex of [cx - size * 0.08, cx + size * 0.08]) {
      ctx.beginPath();
      ctx.arc(ex, cy + size * 0.1, size * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = MP.ink;
      ctx.fill();
    }
    // Smile
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.18, size * 0.07, 0, Math.PI);
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    mapleDamageText(ctx, "D", cx, cy + size * 0.38, size * 0.24, MP.ink, "#f5e8c0", 2);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Town background
// ─────────────────────────────────────────────────────────────────────────────

function drawTownBackground(ctx: CanvasRenderingContext2D, t: number): void {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  skyGrad.addColorStop(0, MP.skyTop);
  skyGrad.addColorStop(0.6, MP.skyMid);
  skyGrad.addColorStop(1, MP.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.55);

  // Fluffy clouds
  const cloudPositions = [
    { x: (W * 0.15 + t * 0.08) % (W + 80) - 40, y: 25, s: 1.0 },
    { x: (W * 0.55 + t * 0.05) % (W + 80) - 40, y: 40, s: 0.75 },
    { x: (W * 0.82 + t * 0.1) % (W + 80) - 40, y: 18, s: 0.85 },
  ];
  for (const c of cloudPositions) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = MP.white;
    const cs = c.s;
    const cx = c.x;
    const cy = c.y;
    for (const [ox, oy, r] of [
      [0, 0, 18 * cs], [-22 * cs, 6 * cs, 13 * cs], [22 * cs, 5 * cs, 15 * cs],
      [-10 * cs, 8 * cs, 14 * cs], [10 * cs, 9 * cs, 13 * cs],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Town silhouette (buildings)
  const buildings = [
    { x: 0,   w: 38, h: 60, c: MP.buildingA },
    { x: 35,  w: 25, h: 45, c: MP.buildingC },
    { x: 57,  w: 40, h: 72, c: MP.buildingB },
    { x: 94,  w: 30, h: 50, c: MP.buildingA },
    { x: 220, w: 35, h: 65, c: MP.buildingB },
    { x: 252, w: 28, h: 48, c: MP.buildingC },
    { x: 277, w: 42, h: 70, c: MP.buildingA },
    { x: 316, w: 30, h: 52, c: MP.buildingB },
  ];
  const groundY = H * 0.52;
  for (const b of buildings) {
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
    // Simple window grid
    ctx.fillStyle = "rgba(255,255,180,0.6)";
    for (let wy = groundY - b.h + 8; wy < groundY - 8; wy += 14) {
      for (let wx = b.x + 5; wx < b.x + b.w - 8; wx += 10) {
        ctx.fillRect(wx, wy, 5, 6);
      }
    }
  }

  // Ground strip
  const gGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 30);
  gGrad.addColorStop(0, MP.groundTop);
  gGrad.addColorStop(1, MP.groundBot);
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, W, 30);

  // Ground tiles row
  ctx.fillStyle = "#4aaa30";
  for (let tx = 0; tx < W; tx += 20) {
    ctx.strokeStyle = "#3a9a20";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(tx, groundY, 20, 28);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine wooden frame
// ─────────────────────────────────────────────────────────────────────────────

const MACHINE_X = 48;
const MACHINE_Y = 108;
const MACHINE_W = W - 96;
const MACHINE_H = H - 160;
const REEL_X = MACHINE_X + 22;
const REEL_Y = MACHINE_Y + 80;
const REEL_W = (MACHINE_W - 44) / REEL_COUNT;
const REEL_INNER_W = REEL_W - 10;
const REEL_H = CELL_H * REEL_VISIBLE;

function drawMachineFrame(ctx: CanvasRenderingContext2D): void {
  // Outer wooden border
  mapleRoundRect(ctx, MACHINE_X - 8, MACHINE_Y - 8, MACHINE_W + 16, MACHINE_H + 16, 18, MP.frameOuter, MP.frameDark, 4);
  // Inner panel
  mapleRoundRect(ctx, MACHINE_X, MACHINE_Y, MACHINE_W, MACHINE_H, 14, MP.frameInner, MP.frameDark, 2.5);

  // Decorative maple leaves on top corners
  drawMapleLeaf(ctx, MACHINE_X + 12, MACHINE_Y + 14, 18, 0.3, MP.mapleRed, 0.9);
  drawMapleLeaf(ctx, MACHINE_X + MACHINE_W - 12, MACHINE_Y + 14, 18, -0.3, MP.mapleRed, 0.9);

  // Machine title plate
  mapleRoundRect(ctx, MACHINE_X + 12, MACHINE_Y + 8, MACHINE_W - 24, 34, 8, MP.frameLight, MP.frameDark, 2);
  mapleDamageText(ctx, "🍁 楓葉抽獎機 🍁", MACHINE_X + MACHINE_W / 2, MACHINE_Y + 25, 13, MP.mapleRed, MP.ink, 2.5);

  // Reel window frame
  mapleRoundRect(
    ctx,
    REEL_X - 4, REEL_Y - 4,
    (REEL_W * REEL_COUNT) + 8, REEL_H + 8,
    8, MP.frameDark, MP.frameDark, 0,
  );

  // Bottom deco strip
  mapleRoundRect(
    ctx,
    MACHINE_X + 10, MACHINE_Y + MACHINE_H - 44,
    MACHINE_W - 20, 36,
    8, MP.frameDark, MP.frameDark, 0,
  );
  mapleDamageText(
    ctx, "PULL TO WIN!", MACHINE_X + MACHINE_W / 2, MACHINE_Y + MACHINE_H - 26,
    12, MP.mapleYellow, MP.ink, 2.5,
  );

  // Side bolts
  for (const [bx, by] of [
    [MACHINE_X + 4, MACHINE_Y + 4],
    [MACHINE_X + MACHINE_W - 4, MACHINE_Y + 4],
    [MACHINE_X + 4, MACHINE_Y + MACHINE_H - 4],
    [MACHINE_X + MACHINE_W - 4, MACHINE_Y + MACHINE_H - 4],
  ] as [number, number][]) {
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = MP.frameDark;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#aaa";
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lever
// ─────────────────────────────────────────────────────────────────────────────

function drawLever(ctx: CanvasRenderingContext2D, pullProgress: number): void {
  const lx = MACHINE_X + MACHINE_W + 12;
  const ly = MACHINE_Y + 60;
  const leverAngle = pullProgress * (Math.PI * 0.6);

  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(leverAngle);

  // Stick
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 70);
  ctx.strokeStyle = MP.leverWood;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.stroke();
  // Stick grain lines
  ctx.strokeStyle = MP.frameDark;
  ctx.lineWidth = 1;
  for (let g = 10; g < 65; g += 12) {
    ctx.beginPath();
    ctx.moveTo(-3, g);
    ctx.lineTo(3, g);
    ctx.stroke();
  }

  // Knob (maple leaf red ball)
  ctx.beginPath();
  ctx.arc(0, 72, 11, 0, Math.PI * 2);
  ctx.fillStyle = MP.leverKnob;
  ctx.fill();
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Knob shine
  ctx.beginPath();
  ctx.arc(-3, 67, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fill();

  ctx.restore();

  // Pivot base
  ctx.beginPath();
  ctx.arc(lx, ly, 8, 0, Math.PI * 2);
  ctx.fillStyle = MP.frameDark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#aaa";
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// Reel rendering
// ─────────────────────────────────────────────────────────────────────────────

function drawReels(
  ctx: CanvasRenderingContext2D,
  reelOffsets: number[],
  reelSpeeds: number[],
): void {
  for (let ri = 0; ri < REEL_COUNT; ri++) {
    const rx = REEL_X + ri * REEL_W;
    const ry = REEL_Y;
    const rw = REEL_INNER_W;

    // Reel clip region
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, REEL_H, 5);
    ctx.clip();

    // Reel background
    ctx.fillStyle = MP.reelBg;
    ctx.fillRect(rx, ry, rw, REEL_H);

    // Cells
    const offset = reelOffsets[ri] ?? 0;
    const startIdx = Math.floor(offset / CELL_H);
    const startY = ry - (offset % CELL_H);

    for (let ci = 0; ci < REEL_VISIBLE + 2; ci++) {
      const symIdx = (startIdx + ci) % SYMBOL_STRIP.length;
      const grade = SYMBOL_STRIP[(symIdx + SYMBOL_STRIP.length) % SYMBOL_STRIP.length] ?? "D賞";
      const cellY = startY + ci * CELL_H;

      // Cell background stripe
      ctx.fillStyle = ci % 2 === 0 ? "rgba(255,240,200,0.3)" : "rgba(255,255,255,0.1)";
      ctx.fillRect(rx, cellY, rw, CELL_H);

      // Draw item icon
      const alpha = Math.abs(reelSpeeds[ri] ?? 0) > 2 ? 0.5 : 1;
      drawItemIcon(ctx, grade as Grade, rx + rw / 2, cellY + CELL_H / 2, CELL_H * 0.68, alpha);

      // Grade label
      if ((reelSpeeds[ri] ?? 0) < 1) {
        ctx.font = `700 10px "Arial", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = GRADE_COLOR[grade] ?? MP.gradeD;
        ctx.fillText(grade, rx + rw / 2, cellY + CELL_H - 7);
      }
    }

    // Horizontal dividers
    ctx.strokeStyle = "rgba(200,132,58,0.4)";
    ctx.lineWidth = 1;
    for (let d = 0; d <= REEL_VISIBLE; d++) {
      ctx.beginPath();
      ctx.moveTo(rx, ry + d * CELL_H);
      ctx.lineTo(rx + rw, ry + d * CELL_H);
      ctx.stroke();
    }

    // Motion blur overlay when spinning fast
    if (Math.abs(reelSpeeds[ri] ?? 0) > 4) {
      const blur = ctx.createLinearGradient(rx, ry, rx, ry + REEL_H);
      blur.addColorStop(0, "rgba(255,248,238,0.55)");
      blur.addColorStop(0.5, "rgba(255,248,238,0.0)");
      blur.addColorStop(1, "rgba(255,248,238,0.55)");
      ctx.fillStyle = blur;
      ctx.fillRect(rx, ry, rw, REEL_H);
    }

    ctx.restore();

    // Reel border
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, REEL_H, 5);
    ctx.strokeStyle = MP.reelBorder;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Win line highlight
  const winY = REEL_Y + CELL_H * Math.floor(REEL_VISIBLE / 2);
  ctx.beginPath();
  ctx.moveTo(REEL_X - 2, winY + CELL_H / 2);
  ctx.lineTo(REEL_X + REEL_W * REEL_COUNT - 4, winY + CELL_H / 2);
  ctx.strokeStyle = "rgba(255, 220, 0, 0.6)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Maple({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineMapleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MapleSlotGameState>("IDLE");
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  // Reel physics
  const reelOffsets = useRef([0, 0, 0]);
  const reelSpeeds = useRef([0, 0, 0]);
  const reelTarget = useRef([-1, -1, -1]);
  const reelStopped = useRef([false, false, false]);
  const pullProgress = useRef(0);

  // Mascot
  const mascotBob = useRef(0);

  // Particles
  const leaves = useRef<MapleLeaf[]>(makeLeaves(14));
  const sparkles = useRef<Sparkle[]>([]);
  const floatTexts = useRef<FloatText[]>([]);
  const itemDrops = useRef<ItemDrop[]>([]);
  const winFlash = useRef(0);
  const [gameState, setGameState] = useState<MapleSlotGameState>("IDLE");

  const changeState = useCallback((s: MapleSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // Compute reel stop position for a grade
  const getStopOffset = useCallback((grade: string): number => {
    const idx = SYMBOL_STRIP.findIndex((g) => g === grade);
    const targetIdx = idx < 0 ? 0 : idx;
    const midCell = Math.floor(REEL_VISIBLE / 2);
    return targetIdx * CELL_H - midCell * CELL_H + SYMBOL_STRIP.length * CELL_H * 4;
  }, []);

  const handleSpin = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    changeState("SPINNING");
    pullProgress.current = 1;

    // Randomize which index per reel (but ultimately end on resultGrade)
    reelTarget.current = [
      getStopOffset(resultGrade) + SYMBOL_STRIP.length * CELL_H * (6 + Math.floor(Math.random() * 4)),
      getStopOffset(resultGrade) + SYMBOL_STRIP.length * CELL_H * (8 + Math.floor(Math.random() * 4)),
      getStopOffset(resultGrade) + SYMBOL_STRIP.length * CELL_H * (10 + Math.floor(Math.random() * 4)),
    ];
    reelSpeeds.current = [22, 22, 22];
    reelStopped.current = [false, false, false];

    // Float text
    floatTexts.current.push({
      text: "SPIN!", x: W / 2, y: REEL_Y + REEL_H / 2,
      vy: -1.5, life: 60, maxLife: 60,
      size: 22, color: MP.mapleYellow,
    });
  }, [resultGrade, getStopOffset, changeState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      tRef.current += 0.016;
      const t = tRef.current;
      const state = stateRef.current;

      // Update mascot bob
      mascotBob.current = Math.sin(t * 3.5) * 4;

      // Update leaves
      for (const leaf of leaves.current) {
        leaf.y += leaf.speed;
        leaf.x += Math.sin(t * 1.1 + leaf.phase) * leaf.drift * 0.5;
        leaf.rotation += leaf.rotSpeed;
        if (leaf.y > H + 20) {
          leaf.y = -20;
          leaf.x = Math.random() * W;
        }
      }

      // Update sparkles
      sparkles.current = sparkles.current.filter((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.08;
        sp.life--;
        return sp.life > 0;
      });

      // Update float texts
      floatTexts.current = floatTexts.current.filter((ft) => {
        ft.y += ft.vy;
        ft.life--;
        return ft.life > 0;
      });

      // Update item drops
      itemDrops.current = itemDrops.current.filter((id) => {
        if (!id.landed) {
          id.y += id.vy;
          id.vy = Math.min(id.vy + 0.4, 8);
          id.x += Math.sin(t * 3 + id.swayPhase) * id.sway;
          if (id.y >= REEL_Y + REEL_H * 0.5) {
            id.landed = true;
            // Spawn sparkle burst on landing
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              const sp = 2 + Math.random() * 3;
              sparkles.current.push({
                x: id.x, y: id.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
                life: 30 + Math.floor(Math.random() * 20),
                maxLife: 50, size: 4 + Math.random() * 4,
                color: [MP.sparkleA, MP.sparkleB, MP.sparkleC][Math.floor(Math.random() * 3)] ?? MP.sparkleA,
              });
            }
          }
        } else {
          id.sparkle++;
        }
        id.life--;
        return id.life > 0;
      });

      // Update win flash
      if (winFlash.current > 0) winFlash.current -= 0.04;

      // Pull lever return
      if (state !== "SPINNING" && pullProgress.current > 0) {
        pullProgress.current = Math.max(0, pullProgress.current - 0.05);
      }

      // Reel physics
      if (state === "SPINNING" || state === "STOPPING") {
        let allStopped = true;
        for (let ri = 0; ri < REEL_COUNT; ri++) {
          if (reelStopped.current[ri]) continue;
          allStopped = false;

          const spd = reelSpeeds.current[ri] ?? 0;
          const target = reelTarget.current[ri] ?? 0;
          const offset = reelOffsets.current[ri] ?? 0;

          if (state === "STOPPING" || offset > target - 60) {
            const dist = target - offset;
            if (dist < 2) {
              // Snap to grid
              const snapped = Math.round(target / CELL_H) * CELL_H;
              reelOffsets.current[ri] = snapped % (SYMBOL_STRIP.length * CELL_H);
              reelSpeeds.current[ri] = 0;
              reelStopped.current[ri] = true;
            } else {
              reelSpeeds.current[ri] = Math.max(dist * 0.2, 0.5);
              reelOffsets.current[ri] = offset + (reelSpeeds.current[ri] ?? 0);
            }
          } else {
            reelOffsets.current[ri] = (offset + spd) % (SYMBOL_STRIP.length * CELL_H);
          }
        }

        // Auto-stop reels sequentially
        if (state === "SPINNING") {
          const spinTime = t;
          if (spinTime > 0 && (reelOffsets.current[0] ?? 0) > (reelTarget.current[0] ?? 0) - 200) {
            changeState("STOPPING");
          }
        }

        if (allStopped && state === "STOPPING") {
          changeState("RESULT");
          onResult?.(resultGrade);

          // Win flash and level-up effect
          winFlash.current = 1;
          // Big item drop from top
          itemDrops.current.push({
            x: W / 2 + (Math.random() - 0.5) * 60,
            y: -40,
            vy: 2,
            sway: 1.5,
            swayPhase: Math.random() * Math.PI * 2,
            grade: resultGrade as Grade,
            landed: false,
            sparkle: 0,
            life: 200,
          });
          // Damage number result
          floatTexts.current.push({
            text: `${resultGrade}!!!`,
            x: W / 2, y: REEL_Y - 20,
            vy: -2, life: 120, maxLife: 120,
            size: 32, color: GRADE_COLOR[resultGrade] ?? MP.gradeA,
          });
          // Level-up style NICE text
          floatTexts.current.push({
            text: "LEVEL UP!",
            x: W / 2, y: REEL_Y - 50,
            vy: -1.5, life: 100, maxLife: 100,
            size: 20, color: MP.mapleYellow,
          });
          // Sparkle burst
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            const sp = 3 + Math.random() * 5;
            sparkles.current.push({
              x: W / 2, y: REEL_Y + REEL_H / 2,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
              life: 40 + Math.floor(Math.random() * 30),
              maxLife: 70,
              size: 5 + Math.random() * 6,
              color: [MP.sparkleA, MP.sparkleB, MP.sparkleC, MP.mapleRed][Math.floor(Math.random() * 4)] ?? MP.sparkleA,
            });
          }
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────

      // Background
      drawTownBackground(ctx, t * 12);

      // Machine BG area
      const bgGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      bgGrad.addColorStop(0, "#f5e8d0");
      bgGrad.addColorStop(1, "#e8d0a8");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);

      // Falling maple leaves
      for (const leaf of leaves.current) {
        const alpha = 0.65 + Math.sin(leaf.phase + t) * 0.2;
        drawMapleLeaf(ctx, leaf.x, leaf.y, leaf.size, leaf.rotation, leaf.color, alpha);
      }

      // Win flash overlay
      if (winFlash.current > 0) {
        ctx.save();
        ctx.globalAlpha = winFlash.current * 0.85;
        ctx.fillStyle = MP.winFlash;
        ctx.fillRect(0, 0, W, H);
        // Expanding ring effect
        const ringR = (1 - winFlash.current) * W;
        ctx.globalAlpha = winFlash.current * 0.4;
        ctx.strokeStyle = MP.sparkleA;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Machine frame
      drawMachineFrame(ctx);

      // Mascot on top of machine
      drawMascot(
        ctx,
        MACHINE_X + MACHINE_W / 2,
        MACHINE_Y - 40,
        mascotBob.current,
      );

      // Reels
      drawReels(ctx, reelOffsets.current, reelSpeeds.current);

      // Lever
      drawLever(ctx, pullProgress.current);

      // Item drops
      for (const id of itemDrops.current) {
        const alpha = id.landed
          ? Math.min(1, (id.life / 200) * 1.4)
          : 1;
        // Sparkle trail when falling
        if (!id.landed) {
          for (let tr = 0; tr < 3; tr++) {
            ctx.save();
            ctx.globalAlpha = 0.4 - tr * 0.12;
            ctx.fillStyle = MP.sparkleA;
            ctx.beginPath();
            ctx.arc(id.x, id.y + tr * 10, 4 - tr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        drawItemIcon(ctx, id.grade, id.x, id.y, 44, 1);
        // Glow around landed item
        if (id.landed) {
          const glowR = 28 + Math.sin(id.sparkle * 0.15) * 5;
          const glow = ctx.createRadialGradient(id.x, id.y, 0, id.x, id.y, glowR);
          glow.addColorStop(0, `${GRADE_COLOR[id.grade] ?? MP.gradeA}55`);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(id.x, id.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Sparkles
      for (const sp of sparkles.current) {
        const alpha = sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = sp.color;
        // 4-pointed star sparkle
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? sp.size : sp.size * 0.3;
          const a = (i / 8) * Math.PI * 2;
          const px = sp.x + Math.cos(a) * r;
          const py = sp.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Float texts (damage numbers)
      for (const ft of floatTexts.current) {
        const alpha = Math.min(1, ft.life / (ft.maxLife * 0.4));
        ctx.globalAlpha = alpha;
        mapleDamageText(ctx, ft.text, ft.x, ft.y, ft.size, ft.color);
        ctx.globalAlpha = 1;
      }

      // Idle instruction
      if (state === "IDLE") {
        mapleDamageText(ctx, "點擊或拉桿 開始!", W / 2, H - 20, 13, MP.frameLight, MP.ink, 2);
      }

      // Result badge
      if (state === "RESULT") {
        const badgeW = 160;
        const badgeH = 38;
        const bx = W / 2 - badgeW / 2;
        const by = REEL_Y + REEL_H + 10;
        mapleRoundRect(ctx, bx, by, badgeW, badgeH, 10, MP.frameDark, GRADE_COLOR[resultGrade] ?? MP.gradeA, 3);
        mapleDamageText(
          ctx, `${resultGrade} — ${prizeName}`,
          W / 2, by + badgeH / 2 + 1,
          14, GRADE_COLOR[resultGrade] ?? MP.gradeA,
        );
        // Tap to reset hint
        mapleDamageText(ctx, "再來一次 Click!", W / 2, H - 20, 12, MP.mapleYellow, MP.ink, 2);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [resultGrade, prizeName, changeState, onResult, getStopOffset]);

  const handleClick = useCallback(() => {
    if (gameState === "IDLE") {
      handleSpin();
    } else if (gameState === "RESULT") {
      // Reset
      stateRef.current = "IDLE";
      setGameState("IDLE");
      onStateChange?.("IDLE");
      reelOffsets.current = [0, 0, 0];
      reelSpeeds.current = [0, 0, 0];
      reelStopped.current = [false, false, false];
      winFlash.current = 0;
      itemDrops.current = [];
      floatTexts.current = [];
    }
  }, [gameState, handleSpin, onStateChange]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      style={{ display: "block", cursor: gameState === "IDLE" || gameState === "RESULT" ? "pointer" : "default", imageRendering: "auto" }}
    />
  );
}
