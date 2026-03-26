"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomAnimeProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 480;
const H = 380;

// ─────────────────────────────────────────────────────────────────────────────
// Anime palette
// ─────────────────────────────────────────────────────────────────────────────

const AN = {
  // Sky
  skyTop:    "#aaddff",
  skyBot:    "#ddf0ff",
  cloud:     "#ffffff",
  // Floor
  floorA:    "#f5d9a0",   // warm wood plank A
  floorB:    "#eecb8a",   // warm wood plank B
  floorLine: "#d4a96a",   // plank divider
  // Walls
  wallTop:   "#ffe0f0",   // pink tinted wall
  wallLine:  "#ffb3d1",   // wall stripe accent
  // Awning
  awningA:   "#ff6688",
  awningB:   "#ffffff",
  awningBorder: "#cc4466",
  // Counter
  counterFill:   "#fff0f8",
  counterTop:    "#ff88bb",
  counterBorder: "#222222",
  // Shelf
  shelfA:    "#fff8cc",   // golden shelf
  shelfB:    "#ccecff",   // blue shelf
  shelfC:    "#ccffee",   // green shelf
  shelfD:    "#f8ccff",   // purple shelf
  // Grade colors
  gradeA:    "#f5c518",
  gradeB:    "#4488ee",
  gradeC:    "#44cc77",
  gradeD:    "#ff6688",
  // Characters
  playerFill:  "#ff88bb",
  skin:        "#ffe8d6",
  hairColors:  ["#4a2800", "#cc6600", "#2244aa", "#882288", "#228844", "#cc4400"],
  // Effects
  speedLine:   "rgba(255,220,0,0.5)",
  petalFill:   "#ffb3c6",
  petalStroke: "#ff88a0",
  sparkle:     "#ffe066",
  // Text
  ink:         "#1a1a2e",
  bodyStroke:  "#222222",
  white:       "#ffffff",
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": AN.gradeA,
  "B賞": AN.gradeB,
  "C賞": AN.gradeC,
  "D賞": AN.gradeD,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const PRIZE_NAMES: Record<string, string> = {
  "A賞": "限定公仔", "B賞": "周邊商品", "C賞": "貼紙組", "D賞": "明信片",
};

const SHELF_COLORS: Record<string, string> = {
  "A賞": AN.shelfA, "B賞": AN.shelfB, "C賞": AN.shelfC, "D賞": AN.shelfD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Room layout
// ─────────────────────────────────────────────────────────────────────────────

// Sky band height
const SKY_H = 64;
// Floor top Y
const FLOOR_Y = SKY_H + 60; // wall + awning height
// Counter position
const COUNTER_X = W / 2 - 58;
const COUNTER_Y = FLOOR_Y + 18;
const COUNTER_W = 116;
const COUNTER_H = 34;
// Shelves along wall
const SHELF_TOP_Y = SKY_H + 4;
const SHELVES = [
  { x: 30,  y: SHELF_TOP_Y, w: 78, h: 42, grade: "A賞" as Grade },
  { x: 120, y: SHELF_TOP_Y, w: 78, h: 42, grade: "B賞" as Grade },
  { x: 282, y: SHELF_TOP_Y, w: 78, h: 42, grade: "C賞" as Grade },
  { x: 372, y: SHELF_TOP_Y, w: 78, h: 42, grade: "D賞" as Grade },
];
// Draw zone (in front of counter)
const DRAW_ZONE_X = COUNTER_X + COUNTER_W / 2;
const DRAW_ZONE_Y = COUNTER_Y + COUNTER_H + 24;
// Cat corner
const CAT_X = W - 44;
const CAT_Y = H - 58;

// ─────────────────────────────────────────────────────────────────────────────
// NPC data
// ─────────────────────────────────────────────────────────────────────────────

type Expression = "happy" | "excited" | "surprised";

interface NPC {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  hairColor: string;
  speed: number;
  bobPhase: number;
  expression: Expression;
  bubbleText: string | null;
  bubbleTimer: number;
  isDrawing: boolean;
  drawTimer: number;
  gradeResult: string | null;
}

function makeNPCs(count: number): NPC[] {
  const npcs: NPC[] = [];
  const startPositions = [
    [60, H - 70], [W - 80, H - 70], [80, H - 110],
    [W - 110, H - 100], [140, H - 80], [W - 160, H - 85],
  ];
  for (let i = 0; i < Math.min(count, 6); i++) {
    const [sx, sy] = startPositions[i] ?? [100 + i * 50, H - 70];
    npcs.push({
      id: i,
      x: sx!, y: sy!,
      tx: sx!, ty: sy!,
      hairColor: AN.hairColors[i % AN.hairColors.length] ?? "#4a2800",
      speed: 0.6 + i * 0.08,
      bobPhase: i * 1.3,
      expression: "happy",
      bubbleText: null,
      bubbleTimer: 0,
      isDrawing: false,
      drawTimer: 0,
      gradeResult: null,
    });
  }
  return npcs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cherry blossom petals
// ─────────────────────────────────────────────────────────────────────────────

interface Petal {
  x: number; y: number;
  size: number; speed: number;
  drift: number; phase: number;
  rotation: number; rotSpeed: number;
}

function makePetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * W,
    y: (Math.sin(i * 2.1) * 0.5 + 0.5) * H,
    size: 6 + (i % 4) * 3,   // bigger: 6–15px range
    speed: 0.18 + (i % 5) * 0.07,  // slightly slower = more graceful
    drift: Math.sin(i * 0.9) * 0.7,
    phase: i * 0.77,
    rotation: i * 0.5,
    rotSpeed: 0.005 + (i % 3) * 0.004,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particles
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function animeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: string,
  strokeColor = AN.bodyStroke,
  lineWidth = 2.5,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function mangaText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  fillColor: string,
  outlineColor = AN.bodyStroke,
  outlineWidth = 3.5,
  align: CanvasTextAlign = "center",
): void {
  ctx.save();
  ctx.font = `900 ${fontSize}px "Impact", "Arial Black", "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw a 5-petal cherry blossom */
function drawPetal(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, rotation: number, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  for (let p = 0; p < 5; p++) {
    const angle = (p / 5) * Math.PI * 2;
    const px = Math.cos(angle) * size * 0.5;
    const py = Math.sin(angle) * size * 0.5;
    ctx.beginPath();
    ctx.ellipse(px, py, size * 0.38, size * 0.22, angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = AN.petalFill;
    ctx.fill();
    ctx.strokeStyle = AN.petalStroke;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#ffeeaa";
  ctx.fill();
  ctx.restore();
}

/** Draw a chibi character at (cx, cy).
 *  headR: head radius (big head = chibi).
 *  bodyH: body+leg height.
 */
function drawChibi(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  headR: number,
  hairColor: string,
  expression: Expression,
  bobOffset: number,
  isPlayer = false,
  gradeLabel?: string,
): void {
  const bodyH = headR * 1.1;
  const legH = headR * 0.7;
  const bodyW = headR * 0.85;
  const by = cy + headR * 0.4 + bobOffset; // body top

  // Legs (thin rounded)
  for (const lx of [cx - bodyW * 0.22, cx + bodyW * 0.22]) {
    ctx.beginPath();
    ctx.moveTo(lx, by + bodyH);
    ctx.lineTo(lx, by + bodyH + legH);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = headR * 0.28;
    ctx.lineCap = "round";
    ctx.stroke();
    // Shoe
    ctx.beginPath();
    ctx.ellipse(lx, by + bodyH + legH, headR * 0.22, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = AN.bodyStroke;
    ctx.fill();
  }

  // Body
  const bodyColor = isPlayer ? AN.playerFill : "#88aaee";
  animeRoundRect(ctx, cx - bodyW / 2, by, bodyW, bodyH, headR * 0.3, bodyColor, AN.bodyStroke, 1.8);

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.3 + bobOffset, headR, 0, Math.PI * 2);
  ctx.fillStyle = AN.skin;
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hair (simple arc on top)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.3 + bobOffset, headR, -Math.PI * 1.05, -Math.PI * 0.05);
  ctx.fillStyle = hairColor;
  ctx.fill();
  // Hair sticking up (ahoge)
  ctx.beginPath();
  ctx.moveTo(cx + headR * 0.15, cy - headR * 1.25 + bobOffset);
  ctx.quadraticCurveTo(cx + headR * 0.5, cy - headR * 1.65 + bobOffset, cx + headR * 0.3, cy - headR * 1.45 + bobOffset);
  ctx.strokeStyle = hairColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Eyes based on expression
  const ey = cy - headR * 0.28 + bobOffset;
  const eyeSpacing = headR * 0.34;

  if (expression === "happy") {
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      // Large anime eye
      ctx.beginPath();
      ctx.ellipse(ex, ey, headR * 0.18, headR * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
      // White highlight
      ctx.beginPath();
      ctx.arc(ex + headR * 0.06, ey - headR * 0.08, headR * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex - headR * 0.04, ey + headR * 0.04, headR * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
    }
    // Smile
    ctx.beginPath();
    ctx.arc(cx, ey + headR * 0.38, headR * 0.22, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (expression === "excited") {
    // >_< eyes — X shapes
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      const es = headR * 0.14;
      ctx.beginPath();
      ctx.moveTo(ex - es, ey - es); ctx.lineTo(ex + es, ey + es);
      ctx.moveTo(ex + es, ey - es); ctx.lineTo(ex - es, ey + es);
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    // Open excited mouth
    ctx.beginPath();
    ctx.arc(cx, ey + headR * 0.38, headR * 0.18, 0, Math.PI);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // O_O surprised — large round eyes
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + headR * 0.05, ey - headR * 0.06, headR * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
    }
    // Small O mouth
    ctx.beginPath();
    ctx.arc(cx, ey + headR * 0.44, headR * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
  }

  // Blush
  for (const bx of [cx - headR * 0.5, cx + headR * 0.5]) {
    ctx.beginPath();
    ctx.ellipse(bx, ey + headR * 0.22, headR * 0.18, headR * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,150,150,0.45)";
    ctx.fill();
  }

  // Grade result label above head
  if (gradeLabel) {
    const labelY = cy - headR * 1.4 + bobOffset;
    const gradeHex = GRADE_COLOR[gradeLabel] ?? AN.gradeA;
    animeRoundRect(ctx, cx - 20, labelY - 10, 40, 18, 6, gradeHex, AN.bodyStroke, 1.5);
    ctx.save();
    ctx.font = `800 9px "Impact", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = AN.white;
    ctx.fillText(gradeLabel, cx, labelY - 1);
    ctx.restore();
  }
}

/** Draw manga speech bubble */
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  text: string,
  excited: boolean,
): void {
  const metrics = (() => {
    ctx.save();
    ctx.font = `700 9px "Hiragino Kaku Gothic ProN", "Arial", sans-serif`;
    const m = ctx.measureText(text);
    ctx.restore();
    return m;
  })();
  const tw = metrics.width + 14;
  const th = 18;
  const bx = cx - tw / 2;
  const by = cy - th - 6;

  if (excited) {
    // Jagged "shout" bubble
    ctx.save();
    ctx.beginPath();
    const points = 14;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = (i % 2 === 0 ? 1 : 0.78) * (Math.max(tw, th) / 2 + 6);
      const px2 = cx + Math.cos(a) * r * (tw > th ? 1 : 0.7);
      const py2 = by + th / 2 + Math.sin(a) * r * (th > tw ? 1 : 0.7);
      if (i === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.fillStyle = "#fffde0";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  } else {
    // Rounded bubble
    animeRoundRect(ctx, bx, by, tw, th, 7, AN.white, AN.bodyStroke, 1.5);
    // Tail
    ctx.beginPath();
    ctx.moveTo(cx - 4, by + th);
    ctx.lineTo(cx + 4, by + th);
    ctx.lineTo(cx, by + th + 6);
    ctx.closePath();
    ctx.fillStyle = AN.white;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.save();
  ctx.font = `700 9px "Hiragino Kaku Gothic ProN", "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = AN.ink;
  ctx.fillText(text, cx, by + th / 2);
  ctx.restore();
}

/** Draw speed lines radiating from (cx, cy) */
function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  innerR: number, outerR: number,
  count: number, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const spread = (Math.PI * 2 / count) * 0.32;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - spread) * innerR, cy + Math.sin(a - spread) * innerR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.lineTo(cx + Math.cos(a + spread) * innerR, cy + Math.sin(a + spread) * innerR);
    ctx.closePath();
    ctx.fillStyle = AN.speedLine;
    ctx.fill();
  }
  ctx.restore();
}

/** Draw prize box with chibi face on shelf */
function drawPrizeBox(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  color: string,
): void {
  animeRoundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.18, color, AN.bodyStroke, 1.8);
  // Ribbon cross
  ctx.save();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - size / 2 + 2, cy);
  ctx.lineTo(cx + size / 2 - 2, cy);
  ctx.moveTo(cx, cy - size / 2 + 2);
  ctx.lineTo(cx, cy + size / 2 - 2);
  ctx.stroke();
  ctx.restore();
  // Chibi ^_^ face
  const faceR = size * 0.14;
  const fy = cy + size * 0.08;
  for (const ex of [cx - faceR * 1.4, cx + faceR * 1.4]) {
    ctx.beginPath();
    ctx.arc(ex, fy, faceR * 0.55, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** Draw the cat NPC in corner */
function drawCat(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  fc: number,
): void {
  const tailAngle = Math.sin(fc * 0.025) * 0.5;
  // Tail
  ctx.save();
  ctx.translate(cx - 12, cy + 6);
  ctx.rotate(tailAngle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-10, -8, -16, -4);
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 12, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#cccccc";
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - 5, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#cccccc";
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ears
  for (const [ex, dir] of [[cx - 6, -1], [cx + 6, 1]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(ex, cy - 11);
    ctx.lineTo(ex + dir * 5, cy - 17);
    ctx.lineTo(ex + dir * 8, cy - 11);
    ctx.closePath();
    ctx.fillStyle = "#cccccc";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner ear
    ctx.beginPath();
    ctx.moveTo(ex + dir * 1, cy - 11);
    ctx.lineTo(ex + dir * 4, cy - 15);
    ctx.lineTo(ex + dir * 6, cy - 11);
    ctx.closePath();
    ctx.fillStyle = "#ffcccc";
    ctx.fill();
  }
  // =^.^= face
  for (const fx of [cx - 3.5, cx + 3.5]) {
    ctx.beginPath();
    ctx.arc(fx, cy - 5, 2, 0, Math.PI * 2);
    ctx.fillStyle = AN.bodyStroke;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(fx + 0.6, cy - 6, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = AN.white;
    ctx.fill();
  }
  // Nose
  ctx.beginPath();
  ctx.arc(cx, cy - 3.5, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = "#ff88aa";
  ctx.fill();
  // Whiskers
  for (const [dir, row] of [[-1, 0], [1, 0], [-1, 1], [1, 1]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 2, cy - 3 + row * 2);
    ctx.lineTo(cx + dir * 10, cy - 2 + row * 2);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // "=^.^=" label
  ctx.save();
  ctx.font = `600 8px "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#666";
  ctx.fillText("=^.^=", cx, cy + 17);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Anime({
  npcCount = 3,
  onDrawResult,
  playerNickname = "Player",
}: PrizeRoomAnimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(0);

  const npcsRef = useRef<NPC[]>(makeNPCs(npcCount));
  const petals = useRef<Petal[]>(makePetals(20));
  const sparkles = useRef<Sparkle[]>([]);

  // Player
  const playerRef = useRef({ x: W / 2, y: H - 55, tx: W / 2, ty: H - 55, bobPhase: 0 });

  // Drawing state
  const drawingActive = useRef(false);
  const drawingTimer = useRef(0);
  const counterZoom = useRef(1);     // slight scale-up on draw
  const resultPanel = useRef<{ grade: string; timer: number } | null>(null);
  const ambientSparkPhase = useRef(0);

  // NPC random draw trigger
  const npcDrawCooldown = useRef(0);

  // Spawn sparkles
  const spawnSparkles = useCallback((x: number, y: number, count = 14) => {
    const newS: Sparkle[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const spd = 1 + Math.random() * 2.5;
      newS.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 1,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.7,
        size: 3 + Math.random() * 4,
      });
    }
    sparkles.current = [...sparkles.current, ...newS];
  }, []);

  // Trigger draw for an NPC
  const triggerNPCDraw = useCallback(() => {
    const idle = npcsRef.current.filter((n) => !n.isDrawing);
    if (idle.length === 0) return;
    const npc = idle[Math.floor(Math.random() * idle.length)]!;
    npc.isDrawing = true;
    npc.tx = DRAW_ZONE_X - 8 + (npc.id % 2) * 16;
    npc.ty = DRAW_ZONE_Y;
    npc.expression = "excited";
    npc.drawTimer = 2800;
  }, []);

  // ── Draw frame ─────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fc = frameCount.current;
    ambientSparkPhase.current += dt / 1200;

    // ── Sky ─────────────────────────────────────────────────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, SKY_H);
    skyGrad.addColorStop(0, AN.skyTop);
    skyGrad.addColorStop(1, AN.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, SKY_H);

    // Clouds (simple white blobs)
    const cloudPositions = [[50, 18], [160, 12], [310, 20], [420, 14]];
    for (const [cx2, cy2] of cloudPositions) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      for (const [ox, oy, r] of [
        [0, 0, 14], [-12, 4, 10], [12, 4, 11], [-5, 7, 8], [5, 7, 8],
      ] as [number, number, number][]) {
        ctx.beginPath();
        ctx.arc(cx2! + ox, cy2! + oy, r, 0, Math.PI * 2);
        ctx.fillStyle = AN.cloud;
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Awning at top of building ──────────────────────────────────────────
    const awningY = SKY_H;
    const awningH = 22;
    // Striped awning
    for (let i = 0; i < 12; i++) {
      const stripeX = i * (W / 12);
      const nextX = (i + 1) * (W / 12);
      ctx.beginPath();
      ctx.moveTo(stripeX, awningY);
      ctx.lineTo(nextX, awningY);
      ctx.lineTo(nextX - 4, awningY + awningH);
      ctx.lineTo(stripeX - 4, awningY + awningH);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? AN.awningA : AN.awningB;
      ctx.fill();
    }
    // Awning border
    ctx.fillStyle = AN.awningBorder;
    ctx.fillRect(0, awningY, W, 2.5);
    ctx.fillRect(0, awningY + awningH - 2, W, 2.5);
    // Scalloped bottom edge
    for (let i = 0; i < 16; i++) {
      const sx = (i / 16) * W + W / 32;
      ctx.beginPath();
      ctx.arc(sx, awningY + awningH, W / 32, 0, Math.PI, true);
      ctx.fillStyle = AN.awningA;
      ctx.fill();
      ctx.strokeStyle = AN.awningBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Wall behind shelves ────────────────────────────────────────────────
    ctx.fillStyle = AN.wallTop;
    ctx.fillRect(0, awningY + awningH, W, FLOOR_Y - (awningY + awningH));
    // Decorative wall stripes
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = AN.wallLine;
      ctx.fillRect(i * (W / 8), awningY + awningH, 4, FLOOR_Y - (awningY + awningH));
    }
    ctx.restore();

    // ── Floor: warm wood planks ────────────────────────────────────────────
    const plankH = 16;
    const plankCount = Math.ceil((H - FLOOR_Y) / plankH) + 1;
    for (let i = 0; i < plankCount; i++) {
      const fy = FLOOR_Y + i * plankH;
      ctx.fillStyle = i % 2 === 0 ? AN.floorA : AN.floorB;
      ctx.fillRect(0, fy, W, plankH);
      // Plank knots
      for (let k = 0; k < 4; k++) {
        const kx = 30 + k * (W / 4) + (i * 23 % 50);
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.ellipse(kx, fy + plankH / 2, 6, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = AN.floorLine;
        ctx.fill();
        ctx.restore();
      }
    }
    // Plank dividers
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < plankCount; i++) {
      const fy = FLOOR_Y + i * plankH;
      ctx.fillStyle = AN.floorLine;
      ctx.fillRect(0, fy, W, 1.5);
    }
    ctx.restore();
    // Floor/wall seam
    ctx.fillStyle = AN.awningBorder;
    ctx.fillRect(0, FLOOR_Y, W, 2.5);

    // ── Shelves ────────────────────────────────────────────────────────────
    for (const shelf of SHELVES) {
      animeRoundRect(ctx, shelf.x, shelf.y, shelf.w, shelf.h, 6, SHELF_COLORS[shelf.grade] ?? AN.shelfA, AN.bodyStroke, 2);
      // Mini prize boxes on shelf
      const boxCount = 2;
      const boxSize = shelf.h * 0.7;
      const spacing = shelf.w / (boxCount + 1);
      for (let b = 0; b < boxCount; b++) {
        const bx2 = shelf.x + spacing * (b + 1);
        const by2 = shelf.y - boxSize * 0.55;
        drawPrizeBox(ctx, bx2, by2, boxSize, SHELF_COLORS[shelf.grade] ?? AN.shelfA);
      }
      // Grade label
      mangaText(ctx, shelf.grade, shelf.x + shelf.w / 2, shelf.y + shelf.h / 2, 9,
        GRADE_COLOR[shelf.grade] ?? AN.gradeA, AN.bodyStroke, 2);
    }

    // ── Counter with speed lines (when drawing) ────────────────────────────
    if (counterZoom.current > 1) {
      const speedAlpha = (counterZoom.current - 1) / 0.12 * 0.5;
      drawSpeedLines(ctx, COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H / 2, 20, 160, 20, speedAlpha);
    }

    ctx.save();
    ctx.translate(COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H / 2);
    ctx.scale(counterZoom.current, counterZoom.current);
    ctx.translate(-(COUNTER_X + COUNTER_W / 2), -(COUNTER_Y + COUNTER_H / 2));

    // Counter body
    animeRoundRect(ctx, COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H, 10, AN.counterFill, AN.bodyStroke, 2.5);
    // Counter top stripe
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H * 0.38, [10, 10, 0, 0]);
    ctx.fillStyle = AN.counterTop;
    ctx.fill();
    ctx.restore();
    // Bell on counter
    const bellX = COUNTER_X + COUNTER_W / 2;
    const bellY = COUNTER_Y - 9;
    ctx.beginPath();
    ctx.arc(bellX, bellY, 8, Math.PI, 0);
    ctx.lineTo(bellX + 8, bellY + 5);
    ctx.arc(bellX, bellY + 5, 8, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = AN.gradeA;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Bell handle
    ctx.beginPath();
    ctx.arc(bellX, bellY - 6, 3, 0, Math.PI * 2);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Bell clapper
    ctx.beginPath();
    ctx.arc(bellX, bellY + 7, 2, 0, Math.PI * 2);
    ctx.fillStyle = AN.bodyStroke;
    ctx.fill();
    // Counter label
    mangaText(ctx, "一番賞", COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H * 0.7, 9,
      AN.ink, AN.bodyStroke, 2);

    ctx.restore(); // end counter zoom

    // ── Ambient floating sparkles キラキラ ─────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const phase = ambientSparkPhase.current + i * 1.05;
      const ax = 60 + i * 66 + Math.sin(phase * 1.1) * 18;
      const ay = FLOOR_Y - 20 + Math.sin(phase * 0.9 + i) * 12;
      const aa = 0.3 + Math.abs(Math.sin(phase * 1.7)) * 0.4;
      ctx.save();
      ctx.globalAlpha = aa;
      ctx.fillStyle = AN.sparkle;
      const ss = 3.5;
      ctx.translate(ax, ay);
      ctx.beginPath();
      ctx.moveTo(0, -ss); ctx.lineTo(ss * 0.2, -ss * 0.2);
      ctx.lineTo(ss, 0);  ctx.lineTo(ss * 0.2, ss * 0.2);
      ctx.lineTo(0, ss);  ctx.lineTo(-ss * 0.2, ss * 0.2);
      ctx.lineTo(-ss, 0); ctx.lineTo(-ss * 0.2, -ss * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ── Cherry blossom petals ──────────────────────────────────────────────
    for (const petal of petals.current) {
      const t = fc * 0.013;
      const px = petal.x + Math.sin(t * petal.drift + petal.phase) * 16;
      const pa = 0.45 + Math.sin(t * 0.8 + petal.phase) * 0.2;
      drawPetal(ctx, px, petal.y, petal.size, petal.rotation + fc * petal.rotSpeed, pa);
    }

    // ── NPC characters ─────────────────────────────────────────────────────
    for (const npc of npcsRef.current) {
      const bobOffset = Math.sin(fc * 0.07 + npc.bobPhase) * 2.8;
      drawChibi(ctx, npc.x, npc.y, 14, npc.hairColor, npc.expression, bobOffset, false,
        npc.gradeResult ?? undefined);
      if (npc.bubbleText && npc.bubbleTimer > 0) {
        drawSpeechBubble(ctx, npc.x, npc.y - 32, npc.bubbleText, npc.expression === "excited");
      }
    }

    // ── Cat NPC ────────────────────────────────────────────────────────────
    drawCat(ctx, CAT_X, CAT_Y, fc);

    // ── Player character ───────────────────────────────────────────────────
    const pl = playerRef.current;
    const plBob = Math.sin(fc * 0.08) * 2.5;
    drawChibi(ctx, pl.x, pl.y, 15, "#cc6600", "happy", plBob, true);

    // ── ドキドキ ambient text ───────────────────────────────────────────────
    if (fc % 90 < 45) {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.abs(Math.sin(fc * 0.08)) * 0.12;
      ctx.font = `700 10px "Hiragino Kaku Gothic ProN", "Arial", sans-serif`;
      ctx.fillStyle = AN.gradeD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ドキドキ♥", W * 0.15, H * 0.6);
      ctx.fillText("キラキラ✦", W * 0.82, H * 0.55);
      ctx.restore();
    }

    // ── Sparkle particles ──────────────────────────────────────────────────
    sparkles.current = sparkles.current.filter((s) => s.life > 0);
    for (const sp of sparkles.current) {
      const lt = sp.life / sp.maxLife;
      ctx.save();
      ctx.globalAlpha = lt * 0.9;
      ctx.translate(sp.x, sp.y);
      const ss = sp.size * lt;
      ctx.beginPath();
      ctx.moveTo(0, -ss); ctx.lineTo(ss * 0.22, -ss * 0.22);
      ctx.lineTo(ss, 0);  ctx.lineTo(ss * 0.22, ss * 0.22);
      ctx.lineTo(0, ss);  ctx.lineTo(-ss * 0.22, ss * 0.22);
      ctx.lineTo(-ss, 0); ctx.lineTo(-ss * 0.22, -ss * 0.22);
      ctx.closePath();
      ctx.fillStyle = AN.sparkle;
      ctx.fill();
      ctx.restore();
    }

    // ── Result panel (manga frame with congratulations) ─────────────────────
    if (resultPanel.current && resultPanel.current.timer > 0) {
      const { grade, timer } = resultPanel.current;
      const totalDur = 2800;
      const progress2 = Math.min(1, (totalDur - timer) / 300);
      const fade = timer < 500 ? timer / 500 : 1;

      ctx.save();
      ctx.globalAlpha = progress2 * fade;

      // Manga panel frame (black border rectangle)
      const panelW = 240, panelH = 110;
      const panelX = W / 2 - panelW / 2;
      const panelY = H / 2 - panelH / 2 - 10;

      // Speed lines behind panel
      drawSpeedLines(ctx, W / 2, H / 2 - 10, 40, 260, 28, 0.45);

      // Panel background
      ctx.fillStyle = AN.white;
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(panelX, panelY, panelW, panelH);
      ctx.fill();
      ctx.stroke();

      // Inner border
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(panelX + 5, panelY + 5, panelW - 10, panelH - 10);
      ctx.stroke();

      // Grade symbol
      const gradeHex = GRADE_COLOR[grade] ?? AN.gradeA;
      const panelCX = W / 2;
      const panelCY = panelY + panelH * 0.42;

      // Draw grade-sized symbol
      ctx.save();
      ctx.font = `900 42px "Impact", "Arial Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeText(grade, panelCX - 40, panelCY);
      ctx.fillStyle = gradeHex;
      ctx.fillText(grade, panelCX - 40, panelCY);
      ctx.restore();

      // Prize name
      mangaText(ctx, PRIZE_NAMES[grade] ?? "", panelCX + 30, panelCY - 8, 13, AN.ink, AN.bodyStroke, 2.5);

      // おめでとう! text
      mangaText(ctx, "おめでとう!", panelCX, panelY + panelH - 18, 16, gradeHex, AN.bodyStroke, 3.5);

      ctx.restore();
    }

    // ── "DRAW" interaction hint (when player near counter) ─────────────────
    const pl2 = playerRef.current;
    const distToCounter = Math.hypot(pl2.x - DRAW_ZONE_X, pl2.y - DRAW_ZONE_Y);
    if (distToCounter < 60 && !drawingActive.current) {
      animeRoundRect(ctx,
        COUNTER_X + COUNTER_W / 2 - 36, COUNTER_Y - 24, 72, 18, 6,
        AN.gradeA, AN.bodyStroke, 1.8);
      mangaText(ctx, "クリックで抽選!", COUNTER_X + COUNTER_W / 2, COUNTER_Y - 15, 8,
        AN.ink, AN.bodyStroke, 2);
    }

    // ── Advance animations ──────────────────────────────────────────────────
    // Petal drift
    for (const p of petals.current) {
      p.y += p.speed * dt / 16;
      if (p.y > H + 20) p.y = -20;
    }

    // Sparkle physics
    for (const sp of sparkles.current) {
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.05;
      sp.life = Math.max(0, sp.life - dt / (sp.maxLife * 1000));
    }

    // Counter zoom decay
    if (counterZoom.current > 1) {
      counterZoom.current = Math.max(1, counterZoom.current - dt / 600);
    }

    // Result panel countdown
    if (resultPanel.current && resultPanel.current.timer > 0) {
      resultPanel.current.timer -= dt;
      if (resultPanel.current.timer <= 0) resultPanel.current = null;
    }

    // NPC movement + draw logic
    for (const npc of npcsRef.current) {
      // Move toward target
      const dx = npc.tx - npc.x;
      const dy = npc.ty - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        npc.x += (dx / dist) * npc.speed * dt / 16;
        npc.y += (dy / dist) * npc.speed * dt / 16;
      }

      // Draw timer countdown
      if (npc.isDrawing && dist < 8) {
        npc.drawTimer -= dt;
        if (npc.drawTimer <= 0) {
          // Draw result
          const grades: Grade[] = ["A賞", "B賞", "C賞", "D賞"];
          const g = grades[Math.floor(Math.random() * grades.length)] as Grade;
          npc.gradeResult = g;
          npc.expression = "excited";
          npc.bubbleText = g === "A賞" ? "大当たり！！" : "やった！";
          npc.bubbleTimer = 2000;
          npc.isDrawing = false;
          // Return to random idle position
          npc.tx = 40 + Math.random() * (W - 80);
          npc.ty = FLOOR_Y + 30 + Math.random() * (H - FLOOR_Y - 60);
          // Room effects
          counterZoom.current = 1.12;
          spawnSparkles(DRAW_ZONE_X, DRAW_ZONE_Y, 16);
          onDrawResult?.(g, PRIZE_NAMES[g] ?? "");
          resultPanel.current = { grade: g, timer: 2800 };
          // All other NPCs get surprised
          for (const other of npcsRef.current) {
            if (other.id !== npc.id) {
              other.expression = "surprised";
              setTimeout(() => { other.expression = "happy"; }, 1500);
            }
          }
        }
      }

      // Bubble timer
      if (npc.bubbleTimer > 0) {
        npc.bubbleTimer -= dt;
        if (npc.bubbleTimer <= 0) {
          npc.bubbleText = null;
          npc.expression = "happy";
          npc.gradeResult = null;
        }
      }
    }

    // NPC draw cooldown
    npcDrawCooldown.current -= dt;
    if (npcDrawCooldown.current <= 0) {
      npcDrawCooldown.current = 3500 + Math.random() * 3000;
      triggerNPCDraw();
    }

    // Player movement
    const pdx = pl2.tx - pl2.x;
    const pdy = pl2.ty - pl2.y;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist > 2) {
      pl2.x += (pdx / pdist) * 1.2 * dt / 16;
      pl2.y += (pdy / pdist) * 1.2 * dt / 16;
    }

  }, [onDrawResult, spawnSparkles, triggerNPCDraw]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;
    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    // Rebuild NPCs when count changes
    npcsRef.current = makeNPCs(npcCount);
    npcDrawCooldown.current = 1800;
  }, [npcCount]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Click: player movement + draw trigger ──────────────────────────────────
  const [, forceRender] = useState(0);
  void forceRender;

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    // Constrain to floor area
    const clampedY = Math.max(FLOOR_Y + 10, Math.min(H - 20, ny));
    playerRef.current.tx = nx;
    playerRef.current.ty = clampedY;

    // Check if clicking near counter to trigger player draw
    const distToCounter = Math.hypot(nx - DRAW_ZONE_X, ny - DRAW_ZONE_Y);
    if (distToCounter < 60 && !drawingActive.current && !resultPanel.current) {
      drawingActive.current = true;
      drawingTimer.current = 1200;
      counterZoom.current = 1.12;

      setTimeout(() => {
        const grades: Grade[] = ["A賞", "B賞", "C賞", "D賞"];
        const g = grades[Math.floor(Math.random() * grades.length)] as Grade;
        onDrawResult?.(g, PRIZE_NAMES[g] ?? "");
        resultPanel.current = { grade: g, timer: 2800 };
        spawnSparkles(DRAW_ZONE_X, DRAW_ZONE_Y, 22);
        // Surprise all NPCs
        for (const npc of npcsRef.current) {
          npc.expression = "surprised";
          setTimeout(() => { npc.expression = "happy"; }, 1500);
        }
        drawingActive.current = false;
      }, 800);
    }
  }, [onDrawResult, spawnSparkles]);

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: "#aaddff", padding: 0 }}
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
        }}
      />
    </div>
  );
}
