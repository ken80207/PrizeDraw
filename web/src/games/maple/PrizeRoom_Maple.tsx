"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomMapleProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 520;
const H = 380;

// ─────────────────────────────────────────────────────────────────────────────
// MapleStory palette
// ─────────────────────────────────────────────────────────────────────────────

const MP = {
  // Sky (sunset gradient)
  skyTop:       "#6ab0e0",
  skyMid:       "#f5b8a0",
  skyBot:       "#fddbc0",
  // Clouds
  cloudFill:    "#ffffff",
  cloudEdge:    "#ffe8d8",
  // Hill silhouette
  hillA:        "#4a8a58",
  hillB:        "#3a7a46",
  // Shop walls (warm wood interior)
  wallFill:     "#f0d8a8",
  wallStripe:   "#e0c890",
  wallDark:     "#c8a060",
  wallTop:      "#8b5e1a",
  // Floor
  floorA:       "#c8a060",
  floorB:       "#b89050",
  floorLine:    "#a07840",
  // Counter
  counterFill:  "#8b5e1a",
  counterTop:   "#c8a060",
  counterLight: "#e0c080",
  // Shelves
  shelfWood:    "#8b5e1a",
  shelfLight:   "#c8a060",
  // Grade colors
  gradeA:       "#ffd700",
  gradeB:       "#5599ff",
  gradeC:       "#44cc77",
  gradeD:       "#cc7744",
  // Characters
  skin:         "#ffe8cc",
  hairColors:   ["#cc2200", "#2255cc", "#22aa44", "#cc8822", "#882299", "#cc4488"],
  outfitColors: ["#cc3322", "#3355cc", "#33aa55", "#cc8833", "#993399", "#cc5599"],
  playerHair:   "#ffd700",
  playerOutfit: "#ee4422",
  // NPC shopkeeper
  keeperHair:   "#4a2800",
  keeperOutfit: "#3355aa",
  keeperApron:  "#ffffff",
  // Effects
  sparkleA:     "#ffe066",
  sparkleB:     "#ff88cc",
  sparkleC:     "#88ddff",
  leafRed:      "#e83222",
  leafOrange:   "#f07020",
  leafYellow:   "#f0c820",
  // Text
  ink:          "#1a0a00",
  white:        "#ffffff",
  // Name tag
  nameBg:       "#ffffff",
  nameText:     "#1a0a00",
  // Chat bubble
  bubbleBg:     "#ffffff",
  bubbleText:   "#1a0a00",
  // Lantern
  lanternBody:  "#e83222",
  lanternGlow:  "#ff8844",
  lanternLine:  "#8b0000",
};

// ─────────────────────────────────────────────────────────────────────────────
// Scene layout constants
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_Y = H - 90;        // Y where characters stand
const GROUND_Y = FLOOR_Y + 2;  // platform top line
const WALL_TOP = 0;
const WALL_BOT = FLOOR_Y;
const COUNTER_X = W / 2 - 55;
const COUNTER_Y = FLOOR_Y - 58;
const COUNTER_W = 110;
const COUNTER_H = 60;
const SHELF_Y = 30;
const SHELVES = [
  { x: 20,  w: 90,  grade: "A賞", color: MP.gradeA },
  { x: 120, w: 90,  grade: "B賞", color: MP.gradeB },
  { x: 310, w: 90,  grade: "C賞", color: MP.gradeC },
  { x: 410, w: 90,  grade: "D賞", color: MP.gradeD },
];

// ─────────────────────────────────────────────────────────────────────────────
// NPC / Character types
// ─────────────────────────────────────────────────────────────────────────────

type Expression = "happy" | "excited" | "surprised" | "sparkle";

interface Character {
  id: number;
  x: number;
  y: number;
  tx: number;  // target x
  hairColor: string;
  outfitColor: string;
  bobPhase: number;
  expression: Expression;
  bubbleText: string | null;
  bubbleTimer: number;
  isPlayer: boolean;
  walkDir: number;  // -1 left, 1 right, 0 still
  walkPhase: number;
  isDrawing: boolean;
  drawTimer: number;
  gradeResult: string | null;
  name: string;
}

const NPC_NAMES = ["楓楓", "小紅", "冒險者", "獵人", "魔法師", "弓箭手"];

function makeCharacters(npcCount: number): Character[] {
  const result: Character[] = [];

  // Player character
  result.push({
    id: 0,
    x: W - 80, y: FLOOR_Y,
    tx: W - 80,
    hairColor: MP.playerHair,
    outfitColor: MP.playerOutfit,
    bobPhase: 0,
    expression: "happy",
    bubbleText: null,
    bubbleTimer: 0,
    isPlayer: true,
    walkDir: 0,
    walkPhase: 0,
    isDrawing: false,
    drawTimer: 0,
    gradeResult: null,
    name: "你",
  });

  // NPCs
  const positions = [60, 120, 160, 360, 410, 450];
  for (let i = 0; i < Math.min(npcCount, 6); i++) {
    result.push({
      id: i + 1,
      x: positions[i] ?? 60 + i * 50,
      y: FLOOR_Y,
      tx: positions[i] ?? 60 + i * 50,
      hairColor: MP.hairColors[i % MP.hairColors.length] ?? "#cc2200",
      outfitColor: MP.outfitColors[i % MP.outfitColors.length] ?? "#cc3322",
      bobPhase: i * 1.2,
      expression: "happy",
      bubbleText: null,
      bubbleTimer: 0,
      isPlayer: false,
      walkDir: 0,
      walkPhase: 0,
      isDrawing: false,
      drawTimer: 0,
      gradeResult: null,
      name: NPC_NAMES[i] ?? `NPC${i + 1}`,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maple leaf particle
// ─────────────────────────────────────────────────────────────────────────────

interface MapleLeaf {
  x: number; y: number;
  size: number; speed: number;
  drift: number; phase: number;
  rotation: number; rotSpeed: number;
  color: string;
}

function makeLeaves(count: number): MapleLeaf[] {
  const colors = [MP.leafRed, MP.leafOrange, MP.leafYellow];
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * (W + 60) - 30,
    y: (Math.sin(i * 2.3) * 0.5 + 0.5) * H,
    size: 6 + (i % 4) * 3,
    speed: 0.3 + (i % 5) * 0.1,
    drift: Math.sin(i * 0.9) * 1.0,
    phase: i * 0.77,
    rotation: i * 0.5,
    rotSpeed: 0.008 + (i % 3) * 0.005,
    color: colors[i % colors.length] ?? MP.leafRed,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particle
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Float text (damage number style)
// ─────────────────────────────────────────────────────────────────────────────

interface FloatText {
  text: string;
  x: number; y: number;
  vy: number;
  life: number; maxLife: number;
  size: number; color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item drop
// ─────────────────────────────────────────────────────────────────────────────

interface ItemDrop {
  x: number; y: number;
  vy: number; sway: number; swayPhase: number;
  grade: string;
  landed: boolean;
  sparkleTimer: number;
  life: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud
// ─────────────────────────────────────────────────────────────────────────────

interface Cloud {
  x: number; y: number;
  scale: number; speed: number;
}

function makeClouds(): Cloud[] {
  return [
    { x: 80,  y: 22, scale: 1.1, speed: 0.25 },
    { x: 260, y: 36, scale: 0.8, speed: 0.15 },
    { x: 430, y: 15, scale: 0.95, speed: 0.2 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapleRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, fill: string,
  stroke = MP.ink, lw = 2,
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
  text: string, x: number, y: number,
  size: number, color: string,
  outline = MP.ink, outlineW = 3.5,
): void {
  ctx.save();
  ctx.font = `900 ${size}px "Impact", "Arial Black", "Hiragino Kaku Gothic ProN", sans-serif`;
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

function drawMapleLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, rotation: number,
  color: string, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.5;

  const s = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.3, -s * 1.1, s * 0.8, -s * 0.5, s * 0.5, 0);
  ctx.bezierCurveTo(s * 1.1, -s * 0.3, s * 1.1, s * 0.3, s * 0.3, s * 0.2);
  ctx.bezierCurveTo(s * 0.8, s * 0.8, s * 0.3, s * 0.9, 0, s * 1.0);
  ctx.bezierCurveTo(-s * 0.3, s * 0.9, -s * 0.8, s * 0.8, -s * 0.3, s * 0.2);
  ctx.bezierCurveTo(-s * 1.1, s * 0.3, -s * 1.1, -s * 0.3, -s * 0.5, 0);
  ctx.bezierCurveTo(-s * 0.8, -s * 0.5, -s * 0.3, -s * 1.1, 0, -s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Draw item icon (grade symbol) at position */
function drawGradeItem(
  ctx: CanvasRenderingContext2D,
  grade: string,
  cx: number, cy: number,
  size: number,
): void {
  ctx.save();
  if (grade === "A賞") {
    // Gold scroll
    const w = size * 0.65;
    const h = size * 0.82;
    mapleRoundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4, "#fff9cc", "#c8a000", 1.5);
    ctx.beginPath();
    ctx.ellipse(cx, cy - h / 2, w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8d060"; ctx.fill();
    ctx.strokeStyle = "#8a6000"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + h / 2, w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8d060"; ctx.fill(); ctx.stroke();
    // Star
    ctx.fillStyle = MP.gradeA; ctx.strokeStyle = "#8a6000"; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size * 0.2 : size * 0.09;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * r; const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (grade === "B賞") {
    // Blue crystal
    ctx.fillStyle = MP.gradeB; ctx.strokeStyle = "#2244aa"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.48);
    ctx.lineTo(cx + size * 0.33, cy - size * 0.14);
    ctx.lineTo(cx + size * 0.33, cy + size * 0.18);
    ctx.lineTo(cx, cy + size * 0.48);
    ctx.lineTo(cx - size * 0.33, cy + size * 0.18);
    ctx.lineTo(cx - size * 0.33, cy - size * 0.14);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.1, cy - size * 0.36);
    ctx.lineTo(cx + size * 0.05, cy - size * 0.26);
    ctx.lineTo(cx - size * 0.04, cy);
    ctx.closePath(); ctx.fill();
  } else if (grade === "C賞") {
    // Green potion
    const bw = size * 0.42; const bh = size * 0.68;
    mapleRoundRect(ctx, cx - bw / 2, cy - bh * 0.28, bw, bh, bw * 0.5, MP.gradeC, "#227744", 1.5);
    mapleRoundRect(ctx, cx - bw * 0.26, cy - bh * 0.28 - bh * 0.24, bw * 0.52, bh * 0.24, 3, "#44aa66", "#227744", 1);
    mapleRoundRect(ctx, cx - bw * 0.18, cy - bh * 0.28 - bh * 0.34, bw * 0.36, bh * 0.11, 2, "#c8843a", "#8b5e1a", 1);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.14, cy, bw * 0.09, bh * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Brown mushroom
    ctx.fillStyle = "#cc7733"; ctx.strokeStyle = "#884411"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy - size * 0.08, size * 0.44, size * 0.35, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    for (const [dx, dy] of [[-0.16, -0.14], [0.16, -0.18], [0, -0.26]]) {
      ctx.beginPath();
      ctx.arc(cx + size * dx, cy - size * 0.08 + size * dy, size * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
    }
    mapleRoundRect(ctx, cx - size * 0.18, cy - size * 0.12, size * 0.36, size * 0.42, size * 0.09, "#f5e8c0", "#884411", 1.2);
    for (const ex of [cx - size * 0.07, cx + size * 0.07]) {
      ctx.beginPath(); ctx.arc(ex, cy + size * 0.1, size * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = MP.ink; ctx.fill();
    }
  }
  ctx.restore();
}

/** Draw MapleStory chibi character */
function drawMapleChar(
  ctx: CanvasRenderingContext2D,
  char: Character,
  bobOffset: number,
  t: number,
): void {
  const cx = char.x;
  const cy = char.y;
  const headR = 20;
  const bodyH = headR * 0.95;
  const bodyW = headR * 0.82;
  const by = cy - headR * 1.7 + bobOffset; // body top
  const headCy = cy - headR * 2.6 + bobOffset; // head center

  // Walk animation: leg alternation
  const walkCycle = Math.sin(t * 8 + char.bobPhase) * (char.walkDir !== 0 ? 1 : 0);

  // Legs
  for (let li = 0; li < 2; li++) {
    const lx = cx + (li === 0 ? -bodyW * 0.22 : bodyW * 0.22);
    const legAngle = li === 0 ? walkCycle * 0.3 : -walkCycle * 0.3;
    const legLen = headR * 0.68;
    const footX = lx + Math.sin(legAngle) * legLen;
    const footY = by + bodyH + Math.cos(legAngle) * legLen;

    ctx.beginPath();
    ctx.moveTo(lx, by + bodyH);
    ctx.lineTo(footX, footY);
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = headR * 0.3;
    ctx.lineCap = "round";
    ctx.stroke();

    // Shoe
    ctx.beginPath();
    ctx.ellipse(footX, footY, headR * 0.2, headR * 0.09, legAngle, 0, Math.PI * 2);
    ctx.fillStyle = char.isPlayer ? "#333" : MP.ink;
    ctx.fill();
  }

  // Body
  const bodyColor = char.outfitColor;
  mapleRoundRect(ctx, cx - bodyW / 2, by, bodyW, bodyH, headR * 0.28, bodyColor, MP.ink, 1.8);

  // Arms
  const armSwing = Math.sin(t * 8 + char.bobPhase) * (char.walkDir !== 0 ? 0.35 : 0.1);
  ctx.save();
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = headR * 0.24;
  ctx.lineCap = "round";
  // Left arm
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, by + bodyH * 0.3);
  ctx.lineTo(
    cx - bodyW / 2 - headR * 0.4 - Math.cos(armSwing) * headR * 0.2,
    by + bodyH * 0.3 + headR * 0.6 + Math.sin(armSwing) * headR * 0.3,
  );
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(cx + bodyW / 2, by + bodyH * 0.3);
  ctx.lineTo(
    cx + bodyW / 2 + headR * 0.4 + Math.cos(armSwing) * headR * 0.2,
    by + bodyH * 0.3 + headR * 0.6 - Math.sin(armSwing) * headR * 0.3,
  );
  ctx.stroke();
  ctx.restore();

  // Head
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fillStyle = MP.skin;
  ctx.fill();
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hair (spiky MapleStory style)
  ctx.save();
  ctx.fillStyle = char.hairColor;
  ctx.strokeStyle = MP.ink;
  ctx.lineWidth = 1.5;

  // Hair cap
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, -Math.PI * 1.08, -Math.PI * 0.02);
  ctx.fill();

  // Hair spikes
  const spikeCount = char.isPlayer ? 5 : 4;
  for (let sp = 0; sp < spikeCount; sp++) {
    const sa = -Math.PI * 0.95 + (sp / (spikeCount - 1)) * Math.PI * 0.9;
    const tipX = cx + Math.cos(sa) * headR * 1.5;
    const tipY = headCy + Math.sin(sa) * headR * 1.5;
    const baseX1 = cx + Math.cos(sa - 0.22) * headR * 0.92;
    const baseY1 = headCy + Math.sin(sa - 0.22) * headR * 0.92;
    const baseX2 = cx + Math.cos(sa + 0.22) * headR * 0.92;
    const baseY2 = headCy + Math.sin(sa + 0.22) * headR * 0.92;
    ctx.beginPath();
    ctx.moveTo(baseX1, baseY1);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX2, baseY2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Eyes (MapleStory: big round with 2 white sparkle dots each)
  const ey = headCy + headR * 0.12;
  const eSpacing = headR * 0.35;

  for (const ex of [cx - eSpacing, cx + eSpacing]) {
    if (char.expression === "excited" || char.expression === "sparkle") {
      // Star eyes
      ctx.fillStyle = MP.gradeA;
      ctx.strokeStyle = MP.ink;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? headR * 0.2 : headR * 0.09;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const px = ex + Math.cos(a) * r; const py = ey + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (char.expression === "surprised") {
      // O_O eyes
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
      ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = MP.ink; ctx.fill();
      // Double sparkle
      ctx.beginPath(); ctx.arc(ex - headR * 0.05, ey - headR * 0.07, headR * 0.045, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + headR * 0.03, ey - headR * 0.02, headR * 0.025, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
    } else {
      // Normal happy eyes
      ctx.beginPath();
      ctx.ellipse(ex, ey, headR * 0.18, headR * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
      ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.2; ctx.stroke();
      // Pupil
      ctx.beginPath();
      ctx.ellipse(ex, ey + headR * 0.04, headR * 0.1, headR * 0.13, 0, 0, Math.PI * 2);
      ctx.fillStyle = MP.ink; ctx.fill();
      // TWO sparkle dots (MapleStory signature)
      ctx.beginPath(); ctx.arc(ex - headR * 0.05, ey - headR * 0.06, headR * 0.042, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + headR * 0.03, ey - headR * 0.01, headR * 0.023, 0, Math.PI * 2);
      ctx.fillStyle = MP.white; ctx.fill();
    }
  }

  // Mouth
  if (char.expression === "surprised") {
    ctx.beginPath();
    ctx.arc(cx, ey + headR * 0.28, headR * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = MP.ink; ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, ey + headR * 0.26, headR * 0.14, 0, Math.PI);
    ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Blush circles
  for (const bx of [cx - headR * 0.54, cx + headR * 0.54]) {
    ctx.beginPath();
    ctx.ellipse(bx, ey + headR * 0.18, headR * 0.14, headR * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,140,140,0.42)"; ctx.fill();
  }

  // Name tag (white rounded rect below character)
  const nameTagY = cy + 4;
  const nameW = Math.max(40, char.name.length * 8 + 14);
  mapleRoundRect(ctx, cx - nameW / 2, nameTagY, nameW, 14, 4, MP.nameBg, MP.ink, 1);
  ctx.font = `700 9px "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = char.isPlayer ? "#c82000" : MP.nameText;
  ctx.fillText(char.name, cx, nameTagY + 10);

  // Chat bubble
  if (char.bubbleText && char.bubbleTimer > 0) {
    const bw = Math.max(60, char.bubbleText.length * 9 + 18);
    const bh = 22;
    const bby = headCy - headR - bh - 10;
    const bbx = cx - bw / 2;

    // Bubble body
    mapleRoundRect(ctx, bbx, bby, bw, bh, 6, MP.bubbleBg, MP.ink, 1.5);
    // Pointer triangle at bottom
    ctx.beginPath();
    ctx.moveTo(cx - 5, bby + bh);
    ctx.lineTo(cx + 5, bby + bh);
    ctx.lineTo(cx, bby + bh + 7);
    ctx.closePath();
    ctx.fillStyle = MP.bubbleBg; ctx.fill();
    ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = `600 10px "Arial", "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = MP.bubbleText;
    ctx.fillText(char.bubbleText, cx, bby + bh / 2 + 4);
  }
}

/** Draw the NPC shopkeeper behind the counter */
function drawShopkeeper(
  ctx: CanvasRenderingContext2D,
  t: number,
): void {
  const cx = COUNTER_X + COUNTER_W / 2;
  const cy = COUNTER_Y - 2;
  const headR = 18;
  const bodyH = headR * 0.9;
  const bodyW = headR * 0.78;
  const bobOff = Math.sin(t * 2.2) * 1.5;
  const by = cy - headR * 1.6 + bobOff;
  const headCy = cy - headR * 2.5 + bobOff;

  // Body (blue outfit with white apron)
  mapleRoundRect(ctx, cx - bodyW / 2, by, bodyW, bodyH, headR * 0.28, MP.keeperOutfit, MP.ink, 1.5);
  // Apron
  mapleRoundRect(ctx, cx - bodyW * 0.35, by + bodyH * 0.1, bodyW * 0.7, bodyH * 0.8, 4, MP.keeperApron, "#ccc", 1);

  // Head
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fillStyle = MP.skin; ctx.fill();
  ctx.strokeStyle = MP.ink; ctx.lineWidth = 2; ctx.stroke();

  // Dark hair
  ctx.save();
  ctx.fillStyle = MP.keeperHair;
  ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, -Math.PI * 1.05, -Math.PI * 0.05);
  ctx.fill();
  ctx.restore();

  // Simple eyes
  const ey = headCy + headR * 0.1;
  const eSpacing = headR * 0.32;
  for (const ex of [cx - eSpacing, cx + eSpacing]) {
    ctx.beginPath();
    ctx.ellipse(ex, ey, headR * 0.14, headR * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = MP.white; ctx.fill();
    ctx.strokeStyle = MP.ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(ex, ey + headR * 0.03, headR * 0.08, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = MP.ink; ctx.fill();
    // Sparkle dots
    ctx.beginPath(); ctx.arc(ex - headR * 0.04, ey - headR * 0.05, headR * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = MP.white; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + headR * 0.02, ey - headR * 0.01, headR * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = MP.white; ctx.fill();
  }

  // Smile
  ctx.beginPath();
  ctx.arc(cx, ey + headR * 0.24, headR * 0.12, 0, Math.PI);
  ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.5; ctx.stroke();

  // Blush
  for (const bx of [cx - headR * 0.5, cx + headR * 0.5]) {
    ctx.beginPath();
    ctx.ellipse(bx, ey + headR * 0.15, headR * 0.12, headR * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,140,140,0.4)"; ctx.fill();
  }

  // Speech bubble "歡迎光臨！"
  const msg = "歡迎光臨！";
  const bw = 76; const bh = 20;
  const bby = headCy - headR - bh - 10;
  mapleRoundRect(ctx, cx - bw / 2, bby, bw, bh, 5, MP.bubbleBg, MP.ink, 1.5);
  ctx.beginPath();
  ctx.moveTo(cx - 5, bby + bh); ctx.lineTo(cx + 5, bby + bh); ctx.lineTo(cx, bby + bh + 6);
  ctx.closePath(); ctx.fillStyle = MP.bubbleBg; ctx.fill();
  ctx.strokeStyle = MP.ink; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = `600 10px "Arial", "Microsoft JhengHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = MP.bubbleText;
  ctx.fillText(msg, cx, bby + bh / 2 + 4);

  // Name tag
  const nameTagY = cy + 6;
  mapleRoundRect(ctx, cx - 28, nameTagY, 56, 13, 4, MP.nameBg, MP.ink, 1);
  ctx.font = `700 9px "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = MP.nameText;
  ctx.fillText("店長", cx, nameTagY + 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Background / Scene layers
// ─────────────────────────────────────────────────────────────────────────────

function drawParallaxSky(ctx: CanvasRenderingContext2D, scrollX: number, t: number, clouds: Cloud[]): void {
  // Layer 0: sky gradient (sunset)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, WALL_BOT);
  skyGrad.addColorStop(0, MP.skyTop);
  skyGrad.addColorStop(0.55, MP.skyMid);
  skyGrad.addColorStop(1, MP.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, WALL_TOP, W, WALL_BOT);

  // Layer 0.5: slowly scrolling clouds
  for (const cloud of clouds) {
    const cx = ((cloud.x + scrollX * 0.08) % (W + 120)) - 60;
    const cy = cloud.y;
    const cs = cloud.scale;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const [ox, oy, r] of [
      [0, 0, 20 * cs], [-26 * cs, 7 * cs, 14 * cs], [26 * cs, 6 * cs, 16 * cs],
      [-12 * cs, 10 * cs, 15 * cs], [12 * cs, 11 * cs, 14 * cs],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fillStyle = MP.cloudFill;
      ctx.fill();
    }
    ctx.restore();
  }

  // Layer 1: hill silhouette (mid parallax)
  ctx.save();
  ctx.globalAlpha = 0.85;
  const hillScrollX = (scrollX * 0.25) % W;
  // Draw two hill cycles for seamless scroll
  for (let rep = -1; rep <= 1; rep++) {
    const hx = -hillScrollX + rep * W;
    ctx.fillStyle = MP.hillA;
    ctx.beginPath();
    ctx.moveTo(hx, WALL_BOT);
    ctx.bezierCurveTo(hx + 60, WALL_BOT - 55, hx + 120, WALL_BOT - 70, hx + 180, WALL_BOT - 35);
    ctx.bezierCurveTo(hx + 240, WALL_BOT - 10, hx + 300, WALL_BOT - 48, hx + 380, WALL_BOT - 42);
    ctx.bezierCurveTo(hx + 440, WALL_BOT - 22, hx + W, WALL_BOT - 55, hx + W, WALL_BOT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = MP.hillB;
    ctx.beginPath();
    ctx.moveTo(hx, WALL_BOT);
    ctx.bezierCurveTo(hx + 40, WALL_BOT - 30, hx + 100, WALL_BOT - 42, hx + 160, WALL_BOT - 22);
    ctx.bezierCurveTo(hx + 220, WALL_BOT - 8, hx + 290, WALL_BOT - 35, hx + 360, WALL_BOT - 30);
    ctx.bezierCurveTo(hx + 420, WALL_BOT - 18, hx + W, WALL_BOT - 28, hx + W, WALL_BOT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Layer 2: shop interior — warm wooden walls
  ctx.fillStyle = MP.wallFill;
  ctx.fillRect(0, WALL_TOP, W, WALL_BOT - WALL_TOP);

  // Wall vertical stripes
  for (let sx = 0; sx < W; sx += 36) {
    ctx.fillStyle = sx % 72 === 0 ? MP.wallStripe : "rgba(224,200,144,0.4)";
    ctx.fillRect(sx, WALL_TOP, 18, WALL_BOT - WALL_TOP);
  }

  // Top beam/border
  ctx.fillStyle = MP.wallTop;
  ctx.fillRect(0, WALL_TOP, W, 18);

  // Hanging lanterns
  const lanternPositions = [W * 0.12, W * 0.5, W * 0.88];
  for (const lx of lanternPositions) {
    // String
    ctx.beginPath();
    ctx.moveTo(lx, WALL_TOP + 18);
    ctx.lineTo(lx, WALL_TOP + 42);
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lantern body
    const lg = ctx.createRadialGradient(lx, WALL_TOP + 50, 2, lx, WALL_TOP + 50, 14);
    lg.addColorStop(0, MP.lanternGlow);
    lg.addColorStop(1, MP.lanternBody);
    mapleRoundRect(ctx, lx - 10, WALL_TOP + 42, 20, 26, 5, MP.lanternBody, MP.lanternLine, 1.5);
    // Glow
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * 2.5 + lx) * 0.15;
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, WALL_TOP + 55, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lantern tassel
    ctx.beginPath();
    ctx.moveTo(lx - 3, WALL_TOP + 68);
    ctx.lineTo(lx - 3, WALL_TOP + 76);
    ctx.moveTo(lx, WALL_TOP + 68);
    ctx.lineTo(lx, WALL_TOP + 78);
    ctx.moveTo(lx + 3, WALL_TOP + 68);
    ctx.lineTo(lx + 3, WALL_TOP + 76);
    ctx.strokeStyle = MP.lanternGlow;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function drawShelfRow(ctx: CanvasRenderingContext2D, t: number): void {
  for (const shelf of SHELVES) {
    // Shelf board
    mapleRoundRect(ctx, shelf.x, SHELF_Y + 55, shelf.w, 12, 4, MP.shelfWood, MP.ink, 2);
    mapleRoundRect(ctx, shelf.x - 2, SHELF_Y + 55, shelf.w + 4, 5, 3, MP.shelfLight, MP.ink, 1);

    // Items on shelf
    const numItems = 2;
    for (let ii = 0; ii < numItems; ii++) {
      const itemX = shelf.x + shelf.w / 2 + (ii - 0.5) * 28;
      const itemY = SHELF_Y + 38 + Math.sin(t * 1.2 + ii + shelf.x * 0.1) * 2;
      drawGradeItem(ctx, shelf.grade, itemX, itemY, 28);
    }

    // Grade label below shelf
    ctx.font = `700 10px "Arial", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = shelf.color;
    ctx.strokeStyle = MP.ink;
    ctx.lineWidth = 2;
    ctx.strokeText(shelf.grade, shelf.x + shelf.w / 2, SHELF_Y + 82);
    ctx.fillText(shelf.grade, shelf.x + shelf.w / 2, SHELF_Y + 82);

    // Maple leaf decoration on shelf edge
    drawMapleLeaf(ctx, shelf.x + shelf.w / 2, SHELF_Y + 57, 8, t * 0.3, MP.leafRed, 0.8);
  }
}

function drawCounter(ctx: CanvasRenderingContext2D): void {
  // Counter body
  mapleRoundRect(ctx, COUNTER_X, COUNTER_Y + 12, COUNTER_W, COUNTER_H - 12, 8, MP.counterFill, MP.ink, 2.5);
  // Counter top surface
  mapleRoundRect(ctx, COUNTER_X - 4, COUNTER_Y + 8, COUNTER_W + 8, 14, 5, MP.counterTop, MP.ink, 2);
  // Counter top highlight
  mapleRoundRect(ctx, COUNTER_X, COUNTER_Y + 10, COUNTER_W, 6, 3, MP.counterLight, "transparent", 0);

  // Maple leaf emblem on counter front
  drawMapleLeaf(ctx, COUNTER_X + COUNTER_W / 2, COUNTER_Y + 40, 14, 0, MP.leafRed, 0.85);
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  // Floor planks
  for (let fx = 0; fx < W; fx += 32) {
    const alt = Math.floor(fx / 32) % 2 === 0;
    ctx.fillStyle = alt ? MP.floorA : MP.floorB;
    ctx.fillRect(fx, GROUND_Y, 32, H - GROUND_Y);
    // Plank divider
    ctx.beginPath();
    ctx.moveTo(fx, GROUND_Y);
    ctx.lineTo(fx, H);
    ctx.strokeStyle = MP.floorLine;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Floor highlight stripe at ground level
  ctx.fillStyle = "rgba(255,220,140,0.35)";
  ctx.fillRect(0, GROUND_Y, W, 5);

  // Platform edge shadow
  const shadow = ctx.createLinearGradient(0, GROUND_Y - 8, 0, GROUND_Y + 6);
  shadow.addColorStop(0, "rgba(0,0,0,0.18)");
  shadow.addColorStop(1, "transparent");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, GROUND_Y - 8, W, 14);

  // Ground tile row (decorative brick pattern below floor)
  ctx.fillStyle = "#a07050";
  ctx.fillRect(0, H - 28, W, 28);
  for (let bx = 0; bx < W; bx += 40) {
    ctx.strokeStyle = "#886040";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, H - 28, 40, 14);
    ctx.strokeRect(bx + 20, H - 14, 40, 14);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade helpers
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"];
const PRIZE_NAMES: Record<string, string> = {
  "A賞": "限定公仔", "B賞": "周邊商品", "C賞": "貼紙組", "D賞": "明信片",
};
const GRADE_COLOR: Record<string, string> = {
  "A賞": MP.gradeA, "B賞": MP.gradeB, "C賞": MP.gradeC, "D賞": MP.gradeD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Maple({
  npcCount = 3,
  onDrawResult,
  playerNickname = "你",
}: PrizeRoomMapleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  const chars = useRef<Character[]>(makeCharacters(npcCount));
  const leaves = useRef<MapleLeaf[]>(makeLeaves(16));
  const clouds = useRef<Cloud[]>(makeClouds());
  const sparkles = useRef<Sparkle[]>([]);
  const floatTexts = useRef<FloatText[]>([]);
  const itemDrops = useRef<ItemDrop[]>([]);
  const scrollX = useRef(0);
  const winFlash = useRef(0);

  // NPC auto-draw timer
  const npcDrawTimerRef = useRef(0);
  const npcDrawCooldownRef = useRef(180 + Math.random() * 120);

  // Update player name
  useEffect(() => {
    const player = chars.current.find((c) => c.isPlayer);
    if (player) player.name = playerNickname;
  }, [playerNickname]);

  // Rebuild characters when npcCount changes
  useEffect(() => {
    chars.current = makeCharacters(npcCount);
    const player = chars.current.find((c) => c.isPlayer);
    if (player) player.name = playerNickname;
  }, [npcCount, playerNickname]);

  const triggerDraw = useCallback((charId: number) => {
    const char = chars.current.find((c) => c.id === charId);
    if (!char || char.isDrawing) return;

    char.isDrawing = true;
    char.drawTimer = 90;
    char.expression = "excited";

    // Walk to counter
    char.tx = COUNTER_X + COUNTER_W / 2 + (Math.random() - 0.5) * 40;

    const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "D賞";
    const prize = PRIZE_NAMES[grade] ?? "獎品";

    setTimeout(() => {
      char.gradeResult = grade;
      char.expression = "sparkle";
      char.bubbleText = `${grade}！`;
      char.bubbleTimer = 150;

      // Drop item from top
      itemDrops.current.push({
        x: char.x + (Math.random() - 0.5) * 30,
        y: -50,
        vy: 2.5,
        sway: 1.2,
        swayPhase: Math.random() * Math.PI * 2,
        grade,
        landed: false,
        sparkleTimer: 0,
        life: 220,
      });

      // Float grade text
      floatTexts.current.push({
        text: `${grade}!!!`,
        x: char.x, y: char.y - 80,
        vy: -2, life: 100, maxLife: 100,
        size: 26, color: GRADE_COLOR[grade] ?? MP.gradeA,
      });

      // Sparkle burst
      winFlash.current = 0.7;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const sp = 2.5 + Math.random() * 4;
        sparkles.current.push({
          x: char.x, y: char.y - 40,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
          life: 35 + Math.floor(Math.random() * 25),
          maxLife: 60,
          size: 4 + Math.random() * 5,
          color: [MP.sparkleA, MP.sparkleB, MP.sparkleC, MP.leafRed][Math.floor(Math.random() * 4)] ?? MP.sparkleA,
        });
      }

      onDrawResult?.(grade, prize);

      setTimeout(() => {
        char.isDrawing = false;
        char.gradeResult = null;
        char.expression = "happy";
      }, 3000);
    }, 1500);
  }, [onDrawResult]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);

    // Check counter click → trigger player draw
    if (
      mx > COUNTER_X && mx < COUNTER_X + COUNTER_W &&
      my > COUNTER_Y && my < COUNTER_Y + COUNTER_H
    ) {
      const player = chars.current.find((c) => c.isPlayer);
      if (player && !player.isDrawing) {
        player.bubbleText = "我要抽！";
        player.bubbleTimer = 80;
        triggerDraw(0);
      }
      return;
    }

    // Click on floor → move player
    if (my > GROUND_Y - 30 && my < GROUND_Y + 10) {
      const player = chars.current.find((c) => c.isPlayer);
      if (player && !player.isDrawing) {
        player.tx = Math.max(20, Math.min(W - 20, mx));
        player.expression = "happy";
      }
    }
  }, [triggerDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      tRef.current += 0.016;
      const t = tRef.current;

      // Scroll (slow ambient)
      scrollX.current = t * 8;

      // Update NPC auto-draw
      npcDrawTimerRef.current++;
      if (npcDrawTimerRef.current >= npcDrawCooldownRef.current) {
        npcDrawTimerRef.current = 0;
        npcDrawCooldownRef.current = 200 + Math.random() * 180;
        const npcs = chars.current.filter((c) => !c.isPlayer && !c.isDrawing);
        if (npcs.length > 0) {
          const npc = npcs[Math.floor(Math.random() * npcs.length)];
          if (npc) {
            npc.bubbleText = ["來抽獎！", "好期待！", "我要A賞！"][Math.floor(Math.random() * 3)] ?? "來抽獎！";
            npc.bubbleTimer = 60;
            triggerDraw(npc.id);
          }
        }
      }

      // Update characters
      for (const char of chars.current) {
        // Move towards target
        const dx = char.tx - char.x;
        if (Math.abs(dx) > 1.5) {
          const spd = 1.8;
          char.x += dx > 0 ? Math.min(spd, dx) : Math.max(-spd, dx);
          char.walkDir = dx > 0 ? 1 : -1;
          char.walkPhase += 0.15;
        } else {
          char.walkDir = 0;
        }

        // Bob offset
        const bobOffset = Math.sin(t * 2.8 + char.bobPhase) * 1.8;
        (char as Character & { _bob: number })._bob = bobOffset;

        // Bubble timer
        if (char.bubbleTimer > 0) char.bubbleTimer--;
        else char.bubbleText = null;

        // Draw timer
        if (char.drawTimer > 0) char.drawTimer--;

        // Random idle chatter
        if (!char.bubbleText && Math.random() < 0.002) {
          const lines = ["✨", "わあ！", "好棒！", "加油！", "(^_^)"];
          char.bubbleText = lines[Math.floor(Math.random() * lines.length)] ?? "✨";
          char.bubbleTimer = 80;
        }

        // NPC random wander
        if (!char.isPlayer && !char.isDrawing && Math.random() < 0.005) {
          char.tx = 30 + Math.random() * (W - 60);
        }
      }

      // Update leaves
      for (const leaf of leaves.current) {
        leaf.y += leaf.speed;
        leaf.x += Math.sin(t * 1.1 + leaf.phase) * leaf.drift * 0.4;
        leaf.rotation += leaf.rotSpeed;
        if (leaf.y > H + 15) { leaf.y = -15; leaf.x = Math.random() * W; }
      }

      // Update sparkles
      sparkles.current = sparkles.current.filter((sp) => {
        sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.09; sp.life--;
        return sp.life > 0;
      });

      // Update float texts
      floatTexts.current = floatTexts.current.filter((ft) => {
        ft.y += ft.vy; ft.life--;
        return ft.life > 0;
      });

      // Update item drops
      itemDrops.current = itemDrops.current.filter((id) => {
        if (!id.landed) {
          id.vy = Math.min(id.vy + 0.35, 9);
          id.y += id.vy;
          id.x += Math.sin(t * 3.5 + id.swayPhase) * id.sway;
          const landY = GROUND_Y - 30;
          if (id.y >= landY) {
            id.y = landY;
            id.landed = true;
            // Sparkle burst on land
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2;
              sparkles.current.push({
                x: id.x, y: id.y,
                vx: Math.cos(a) * (2 + Math.random() * 2),
                vy: Math.sin(a) * (2 + Math.random() * 2) - 2,
                life: 25 + Math.floor(Math.random() * 15),
                maxLife: 40, size: 3 + Math.random() * 4,
                color: [MP.sparkleA, MP.sparkleB, MP.leafRed][Math.floor(Math.random() * 3)] ?? MP.sparkleA,
              });
            }
          }
        } else {
          id.sparkleTimer++;
        }
        id.life--;
        return id.life > 0;
      });

      // Update win flash
      if (winFlash.current > 0) winFlash.current = Math.max(0, winFlash.current - 0.025);

      // ── DRAW ──────────────────────────────────────────────────────────────

      ctx.clearRect(0, 0, W, H);

      // Parallax sky / interior background
      drawParallaxSky(ctx, scrollX.current, t, clouds.current);

      // Shelf row
      drawShelfRow(ctx, t);

      // Counter
      drawCounter(ctx);

      // Shopkeeper behind counter
      drawShopkeeper(ctx, t);

      // Floor
      drawFloor(ctx);

      // Falling maple leaves
      for (const leaf of leaves.current) {
        const alpha = 0.55 + Math.sin(leaf.phase + t) * 0.25;
        drawMapleLeaf(ctx, leaf.x, leaf.y, leaf.size, leaf.rotation, leaf.color, alpha);
      }

      // Win flash
      if (winFlash.current > 0) {
        ctx.save();
        ctx.globalAlpha = winFlash.current * 0.6;
        ctx.fillStyle = "rgba(255,255,200,1)";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Item drops (behind characters)
      for (const id of itemDrops.current) {
        const alpha = id.landed
          ? Math.min(1, id.life / 120)
          : 1;
        // Trail while falling
        if (!id.landed) {
          for (let tr = 0; tr < 4; tr++) {
            ctx.save();
            ctx.globalAlpha = 0.35 - tr * 0.08;
            ctx.fillStyle = MP.sparkleA;
            ctx.beginPath();
            ctx.arc(id.x, id.y + tr * 12, 3.5 - tr * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        drawGradeItem(ctx, id.grade, id.x, id.y, 36);
        // Glow when landed
        if (id.landed) {
          const glowR = 24 + Math.sin(id.sparkleTimer * 0.12) * 4;
          const glow = ctx.createRadialGradient(id.x, id.y, 0, id.x, id.y, glowR);
          glow.addColorStop(0, `${GRADE_COLOR[id.grade] ?? MP.gradeA}60`);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(id.x, id.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Characters (sort by x so overlaps look right)
      const sortedChars = [...chars.current].sort((a, b) => a.x - b.x);
      for (const char of sortedChars) {
        const bob = (char as Character & { _bob?: number })._bob ?? 0;
        drawMapleChar(ctx, char, bob, t);
      }

      // Sparkles
      for (const sp of sparkles.current) {
        const alpha = sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = sp.color;
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

      // Floating damage texts
      for (const ft of floatTexts.current) {
        const alpha = Math.min(1, ft.life / (ft.maxLife * 0.35));
        ctx.globalAlpha = alpha;
        mapleDamageText(ctx, ft.text, ft.x, ft.y, ft.size, ft.color);
        ctx.globalAlpha = 1;
      }

      // Instruction hint
      ctx.font = `700 10px "Arial", sans-serif`;
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(80,40,0,0.6)";
      ctx.fillText("點擊櫃台抽獎 | 點擊地板移動", W - 8, H - 8);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [triggerDraw]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleCanvasClick}
      style={{ display: "block", cursor: "pointer", imageRendering: "auto" }}
    />
  );
}
