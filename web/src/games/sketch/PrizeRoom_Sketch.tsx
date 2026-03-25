"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomSketchProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 480;
const H = 360;

// ─────────────────────────────────────────────────────────────────────────────
// Sketch palette
// ─────────────────────────────────────────────────────────────────────────────

const SK = {
  paper:        "#faf8f0",
  pencil:       "#333333",
  pencilLight:  "#555555",
  pencilFaint:  "#999999",
  notebookLine: "rgba(100,140,220,0.22)",
  marginLine:   "rgba(200,60,60,0.30)",
  redPen:       "#cc3333",
  bluePen:      "#3355cc",
  greenPen:     "#228833",
  yellowHL:     "rgba(255,255,0,0.28)",
  brickLine:    "rgba(100,80,60,0.20)",
  floorLine:    "rgba(100,90,70,0.18)",
  shadow:       "rgba(60,50,40,0.10)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Room layout
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_TOP = 90;
const FLOOR_BOTTOM = H - 20;
const FLOOR_LEFT = 40;
const FLOOR_RIGHT = W - 10;

const COUNTER_X = W / 2 - 55;
const COUNTER_Y = 108;
const COUNTER_W = 110;
const COUNTER_H = 26;

const SHELVES = [
  { x: 44, y: 96, w: 58, h: 18, grades: ["A賞", "B賞"] },
  { x: 44, y: 148, w: 58, h: 18, grades: ["C賞", "D賞"] },
  { x: W - 102, y: 96, w: 58, h: 18, grades: ["B賞", "C賞"] },
  { x: W - 102, y: 148, w: 58, h: 18, grades: ["A賞", "D賞"] },
];

const DRAW_ZONE_X = COUNTER_X + COUNTER_W / 2;
const DRAW_ZONE_Y = COUNTER_Y + COUNTER_H + 18;

const GRADE_COLOR: Record<string, string> = {
  "A賞": "#b8860b",
  "B賞": "#1a3a8c",
  "C賞": "#1a6b3a",
  "D賞": "#6b1a8c",
};

const NPC_COLORS = [SK.bluePen, SK.greenPen, SK.redPen, "#8833aa", "#cc6600", "#007788"];

const GRADES = ["A賞", "B賞", "C賞", "D賞"];
const PRIZE_NAMES: Record<string, string> = {
  "A賞": "限定公仔", "B賞": "周邊商品", "C賞": "貼紙組", "D賞": "明信片",
};

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic wobble — sin-based
// ─────────────────────────────────────────────────────────────────────────────

function w(fc: number, idx: number, amt = 1.8): number {
  return Math.sin(fc * 0.07 + idx * 1.7) * amt;
}

function wobblyLineTo(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  fc: number, vb: number, wobble = 1.8,
): void {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(Math.ceil(dist / 10), 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ctx.lineTo(
      x1 + (x2 - x1) * t + w(fc, vb + i * 2, wobble),
      y1 + (y2 - y1) * t + w(fc, vb + i * 2 + 1, wobble),
    );
  }
}

function wobblyRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, ww: number, hh: number,
  fc: number, vb: number, wobble = 1.8,
): void {
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb, wobble), y + w(fc, vb + 1, wobble));
  wobblyLineTo(ctx, x, y, x + ww, y, fc, vb + 10, wobble);
  wobblyLineTo(ctx, x + ww, y, x + ww, y + hh, fc, vb + 30, wobble);
  wobblyLineTo(ctx, x + ww, y + hh, x, y + hh, fc, vb + 50, wobble);
  wobblyLineTo(ctx, x, y + hh, x, y, fc, vb + 70, wobble);
  ctx.closePath();
}

function crossHatch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, ww: number, hh: number,
  density = 7, alpha = 0.10,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = SK.pencil;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = -hh; i < ww + hh; i += density) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + hh, y + hh);
  }
  ctx.stroke();
  ctx.restore();
}

function wobblyCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fc: number, vb: number, wobble = 1.5,
): void {
  const steps = 20;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const px = cx + Math.cos(angle) * r + w(fc, vb + i * 2, wobble);
    const py = cy + Math.sin(angle) * r + w(fc, vb + i * 2 + 1, wobble);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawWobblyStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fc: number, vb: number,
  color: string,
): void {
  const rays = 8;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const endX = cx + Math.cos(angle) * r + w(fc, vb + i * 3, 2);
    const endY = cy + Math.sin(angle) * r + w(fc, vb + i * 3 + 1, 2);
    ctx.beginPath();
    ctx.moveTo(cx + w(fc, vb + i * 3 + 2, 1), cy + w(fc, vb + i * 3 + 3, 1));
    wobblyLineTo(ctx, cx, cy, endX, endY, fc, vb + 100 + i * 5, 2);
    ctx.stroke();
  }
  ctx.restore();
}

function handText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  fontSize: number, color: string,
  align: CanvasTextAlign = "center",
  tiltDeg = 0,
): void {
  ctx.save();
  ctx.font = `${fontSize}px "Segoe Script", "Comic Sans MS", cursive`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
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
// Stick figure drawing
// ─────────────────────────────────────────────────────────────────────────────

type StickPose = "idle" | "walk" | "celebrate";

function drawStickFigure(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  fc: number,
  vb: number,
  pose: StickPose = "idle",
  hasHat = false,
  hasGlasses = false,
  scale = 1,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * scale;

  const headR = 7 * scale;
  const bodyLen = 20 * scale;
  const legLen = 16 * scale;
  const armLen = 12 * scale;

  // Walk cycle: limb angles oscillate with frameCount
  let legAngle = 0;
  let armAngle = 0;
  if (pose === "walk") {
    legAngle = Math.sin(fc * 0.15 + vb) * 0.5;
    armAngle = Math.sin(fc * 0.15 + vb + Math.PI) * 0.4;
  } else if (pose === "celebrate") {
    legAngle = Math.sin(fc * 0.25 + vb) * 0.3;
    armAngle = -0.8 + Math.sin(fc * 0.2 + vb) * 0.3;
  }

  // Head (wobbly circle)
  wobblyCircle(ctx, x, y - bodyLen - headR, headR, fc, vb, 1.2 * scale);
  ctx.stroke();

  // Hat (if applicable)
  if (hasHat) {
    const hy = y - bodyLen - headR * 2 - 2;
    ctx.beginPath();
    ctx.moveTo(x - headR - 2 + w(fc, vb + 50, 1), hy + w(fc, vb + 51, 1));
    wobblyLineTo(ctx, x - headR - 2, hy, x + headR + 2, hy, fc, vb + 52, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.7 + w(fc, vb + 55, 1), hy + w(fc, vb + 56, 1));
    wobblyLineTo(ctx, x - headR * 0.7, hy, x - headR * 0.7, hy - headR * 1.4, fc, vb + 57, 1);
    wobblyLineTo(ctx, x - headR * 0.7, hy - headR * 1.4, x + headR * 0.7, hy - headR * 1.4, fc, vb + 65, 1);
    wobblyLineTo(ctx, x + headR * 0.7, hy - headR * 1.4, x + headR * 0.7, hy, fc, vb + 73, 1);
    ctx.stroke();
  }

  // Glasses
  if (hasGlasses) {
    const gy = y - bodyLen - headR;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    // Left lens
    wobblyCircle(ctx, x - 4 * scale, gy, 3.5 * scale, fc, vb + 80, 0.8);
    ctx.stroke();
    // Right lens
    wobblyCircle(ctx, x + 4 * scale, gy, 3.5 * scale, fc, vb + 90, 0.8);
    ctx.stroke();
    // Bridge
    ctx.beginPath();
    ctx.moveTo(x - 0.5 * scale, gy);
    ctx.lineTo(x + 0.5 * scale, gy);
    ctx.stroke();
    ctx.restore();
  }

  // Body
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb + 100, 1), y - bodyLen + w(fc, vb + 101, 1));
  wobblyLineTo(ctx, x, y - bodyLen, x, y, fc, vb + 102, 1.2 * scale);
  ctx.stroke();

  // Left arm
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb + 110, 1), y - bodyLen * 0.65 + w(fc, vb + 111, 1));
  wobblyLineTo(
    ctx,
    x, y - bodyLen * 0.65,
    x - armLen * Math.cos(armAngle + 0.7),
    y - bodyLen * 0.65 + armLen * Math.sin(armAngle + 0.7),
    fc, vb + 112, 1.5 * scale,
  );
  ctx.stroke();

  // Right arm
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb + 120, 1), y - bodyLen * 0.65 + w(fc, vb + 121, 1));
  wobblyLineTo(
    ctx,
    x, y - bodyLen * 0.65,
    x + armLen * Math.cos(armAngle + 0.7),
    y - bodyLen * 0.65 + armLen * Math.sin(armAngle + 0.7),
    fc, vb + 122, 1.5 * scale,
  );
  ctx.stroke();

  // Left leg
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb + 130, 1), y + w(fc, vb + 131, 1));
  wobblyLineTo(
    ctx,
    x, y,
    x - legLen * Math.sin(-legAngle),
    y + legLen * Math.cos(-legAngle),
    fc, vb + 132, 1.5 * scale,
  );
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(x + w(fc, vb + 140, 1), y + w(fc, vb + 141, 1));
  wobblyLineTo(
    ctx,
    x, y,
    x + legLen * Math.sin(legAngle),
    y + legLen * Math.cos(legAngle),
    fc, vb + 142, 1.5 * scale,
  );
  ctx.stroke();

  ctx.restore();
}

/** Draw a cloud-style speech bubble */
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fc: number, vb: number,
): void {
  const w2 = Math.max(text.length * 6.5 + 12, 45);
  const h2 = 22;
  const bx = x - w2 / 2;
  const by = y - h2 - 12;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = SK.pencil;
  ctx.lineWidth = 1.2;
  wobblyRect(ctx, bx, by, w2, h2, fc, vb, 1.2);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x - 4 + w(fc, vb + 200, 1), by + h2 + w(fc, vb + 201, 0.5));
  wobblyLineTo(ctx, x - 4, by + h2, x + 2, by + h2 + 10, fc, vb + 202, 1.5);
  wobblyLineTo(ctx, x + 2, by + h2 + 10, x + 8, by + h2, fc, vb + 210, 1.5);
  ctx.stroke();

  handText(ctx, text, x, by + h2 / 2, 9, SK.pencil);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Character / NPC state types
// ─────────────────────────────────────────────────────────────────────────────

interface CharState {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  name: string;
  pose: StickPose;
  hasHat: boolean;
  hasGlasses: boolean;
  state: "idle" | "walking" | "queuing" | "drawing" | "celebrating";
  bubble: string | null;
  bubbleTimer: number;
  prizeGrade: string | null;
}

const NPC_NAMES = ["小明", "小華", "阿美", "大雄", "靜香", "技安"];

function makeNpc(id: number, npcCount: number): CharState {
  const spawnX = FLOOR_LEFT + 20 + Math.random() * (FLOOR_RIGHT - FLOOR_LEFT - 60);
  const spawnY = FLOOR_TOP + 60 + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP - 80);
  return {
    id,
    x: spawnX,
    y: spawnY,
    targetX: spawnX,
    targetY: spawnY,
    color: NPC_COLORS[id % NPC_COLORS.length] ?? SK.bluePen,
    name: NPC_NAMES[id % NPC_NAMES.length] ?? `NPC${id}`,
    pose: "idle",
    hasHat: id === 0 || id === 3,
    hasGlasses: id === 1 || id === 4,
    state: "idle",
    bubble: null,
    bubbleTimer: 0,
    prizeGrade: null,
  };
  void npcCount;
}

function makePlayer(): CharState {
  return {
    id: -1,
    x: W / 2,
    y: FLOOR_BOTTOM - 40,
    targetX: W / 2,
    targetY: FLOOR_BOTTOM - 40,
    color: SK.redPen,
    name: "你",
    pose: "idle",
    hasHat: false,
    hasGlasses: false,
    state: "idle",
    bubble: null,
    bubbleTimer: 0,
    prizeGrade: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Sketch({
  npcCount = 3,
  onDrawResult,
  resultGrade,
  playerNickname = "你",
}: PrizeRoomSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(0);

  const playerRef = useRef<CharState>(makePlayer());
  const npcsRef = useRef<CharState[]>([]);
  const drawQueueRef = useRef<number[]>([]); // npc ids queued to draw
  const activeDrawerRef = useRef<number | null>(null);
  const npcTimersRef = useRef<number[]>([]);
  const prizeRevealRef = useRef<{ grade: string; alpha: number } | null>(null);

  // Initialize / re-initialize NPCs when npcCount changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    npcsRef.current = Array.from({ length: npcCount }, (_, i) => makeNpc(i, npcCount));
    drawQueueRef.current = [];
    activeDrawerRef.current = null;
    prizeRevealRef.current = null;
    forceUpdate((n) => n + 1);
  }, [npcCount]);

  useEffect(() => {
    if (playerNickname) {
      playerRef.current.name = playerNickname;
    }
  }, [playerNickname]);

  // React to external resultGrade (when it changes, show reveal on player)
  useEffect(() => {
    if (resultGrade) {
      prizeRevealRef.current = { grade: resultGrade, alpha: 0 };
    }
  }, [resultGrade]);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fc = frameCount.current;

    // ── Notebook paper background ──────────────────────────────────────────
    ctx.fillStyle = SK.paper;
    ctx.fillRect(0, 0, W, H);

    // Static paper texture
    ctx.globalAlpha = 0.025;
    for (let row = 0; row < H; row += 4) {
      for (let col = 0; col < W; col += 4) {
        const noise = (Math.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1;
        if (Math.abs(noise) > 0.5) {
          ctx.fillStyle = "#999";
          ctx.fillRect(col, row, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Notebook horizontal lines
    ctx.strokeStyle = SK.notebookLine;
    ctx.lineWidth = 0.7;
    for (let ly = 24; ly < H; ly += 24) {
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(W, ly);
      ctx.stroke();
    }

    // Red margin line
    ctx.strokeStyle = SK.marginLine;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.lineTo(38, H);
    ctx.stroke();

    // ── Wall (back) ────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(230,225,210,0.5)";
    ctx.fillRect(FLOOR_LEFT, 0, FLOOR_RIGHT - FLOOR_LEFT, FLOOR_TOP);

    // Sketchy brick pattern on back wall (static — no fc dependency)
    ctx.strokeStyle = SK.brickLine;
    ctx.lineWidth = 0.7;
    const brickH = 14, brickW = 32;
    for (let row2 = 0; row2 < FLOOR_TOP; row2 += brickH) {
      ctx.beginPath();
      ctx.moveTo(FLOOR_LEFT, row2);
      ctx.lineTo(FLOOR_RIGHT, row2);
      ctx.stroke();
      const offset = (Math.floor(row2 / brickH) % 2) * (brickW / 2);
      for (let col2 = FLOOR_LEFT + offset; col2 < FLOOR_RIGHT; col2 += brickW) {
        ctx.beginPath();
        ctx.moveTo(col2, row2);
        ctx.lineTo(col2, row2 + brickH);
        ctx.stroke();
      }
    }

    // Floor / ground area
    ctx.fillStyle = "rgba(215,210,190,0.30)";
    ctx.fillRect(FLOOR_LEFT, FLOOR_TOP, FLOOR_RIGHT - FLOOR_LEFT, FLOOR_BOTTOM - FLOOR_TOP);

    // Floor wobbly horizontal lines (depth lines)
    ctx.strokeStyle = SK.floorLine;
    ctx.lineWidth = 0.6;
    for (let fy = FLOOR_TOP + 20; fy < FLOOR_BOTTOM; fy += 18) {
      ctx.beginPath();
      ctx.moveTo(FLOOR_LEFT, fy);
      ctx.lineTo(FLOOR_RIGHT, fy);
      ctx.stroke();
    }
    // Cross-hatch shadow on floor corners
    crossHatch(ctx, FLOOR_LEFT, FLOOR_TOP, 30, FLOOR_BOTTOM - FLOOR_TOP, 8, 0.07);
    crossHatch(ctx, FLOOR_RIGHT - 30, FLOOR_TOP, 30, FLOOR_BOTTOM - FLOOR_TOP, 8, 0.07);

    // ── Shelves ────────────────────────────────────────────────────────────
    for (const shelf of SHELVES) {
      // Shelf shadow
      crossHatch(ctx, shelf.x + 6, shelf.y + 4, shelf.w, shelf.h + 20, 5, 0.09);

      // Shelf surface (wobbly 3D box)
      ctx.strokeStyle = SK.pencil;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = "rgba(220,215,200,0.6)";
      wobblyRect(ctx, shelf.x, shelf.y, shelf.w, shelf.h, fc, 2000 + shelf.x, 1.2);
      ctx.fill();
      ctx.stroke();

      // Top face (isometric-ish)
      ctx.beginPath();
      ctx.moveTo(shelf.x + w(fc, 2100 + shelf.x, 1), shelf.y + w(fc, 2101 + shelf.x, 1));
      wobblyLineTo(ctx, shelf.x, shelf.y, shelf.x + shelf.w, shelf.y, fc, 2102 + shelf.x, 1);
      wobblyLineTo(ctx, shelf.x + shelf.w, shelf.y, shelf.x + shelf.w + 5, shelf.y - 5, fc, 2110 + shelf.x, 1);
      wobblyLineTo(ctx, shelf.x + shelf.w + 5, shelf.y - 5, shelf.x + 5, shelf.y - 5, fc, 2120 + shelf.x, 1);
      wobblyLineTo(ctx, shelf.x + 5, shelf.y - 5, shelf.x, shelf.y, fc, 2130 + shelf.x, 1);
      ctx.fillStyle = "rgba(240,235,215,0.7)";
      ctx.fill();
      ctx.stroke();

      // Prize box sketches on shelf
      for (let gi = 0; gi < shelf.grades.length; gi++) {
        const grade = shelf.grades[gi] ?? "A賞";
        const bx = shelf.x + gi * (shelf.w / 2) + 6;
        const by = shelf.y - 16;
        const bw = shelf.w / 2 - 10;
        const bh = 14;
        ctx.strokeStyle = GRADE_COLOR[grade] ?? SK.pencil;
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        wobblyRect(ctx, bx, by, bw, bh, fc, 2200 + shelf.x + gi * 30, 1);
        ctx.fill();
        ctx.stroke();
        handText(ctx, grade[0] ?? "", bx + bw / 2, by + bh / 2, 8, GRADE_COLOR[grade] ?? SK.pencil);
      }

      // Label arrow annotation
      const isLeft = shelf.x < W / 2;
      const annotX = isLeft ? shelf.x - 14 : shelf.x + shelf.w + 14;
      ctx.save();
      ctx.font = `9px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.pencilFaint;
      ctx.textAlign = isLeft ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText("展架", annotX, shelf.y + shelf.h / 2);
      ctx.restore();
    }

    // ── Counter (3D wobbly box) ────────────────────────────────────────────
    crossHatch(ctx, COUNTER_X + 8, COUNTER_Y + 8, COUNTER_W, COUNTER_H + 10, 5, 0.10);

    // Front face
    ctx.strokeStyle = SK.pencil;
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(210,205,185,0.70)";
    wobblyRect(ctx, COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H, fc, 3000, 1.5);
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.beginPath();
    ctx.moveTo(COUNTER_X + w(fc, 3100, 1.2), COUNTER_Y + w(fc, 3101, 1.2));
    wobblyLineTo(ctx, COUNTER_X, COUNTER_Y, COUNTER_X + COUNTER_W, COUNTER_Y, fc, 3102, 1.5);
    wobblyLineTo(ctx, COUNTER_X + COUNTER_W, COUNTER_Y, COUNTER_X + COUNTER_W + 8, COUNTER_Y - 8, fc, 3110, 1.2);
    wobblyLineTo(ctx, COUNTER_X + COUNTER_W + 8, COUNTER_Y - 8, COUNTER_X + 8, COUNTER_Y - 8, fc, 3120, 1.2);
    wobblyLineTo(ctx, COUNTER_X + 8, COUNTER_Y - 8, COUNTER_X, COUNTER_Y, fc, 3130, 1.2);
    ctx.fillStyle = "rgba(235,230,210,0.80)";
    ctx.fill();
    ctx.stroke();

    // Counter label
    handText(ctx, "抽獎台", COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H / 2 + 1, 10, SK.pencil);

    // Draw button (wobbly circle with text)
    const btnCX = COUNTER_X + COUNTER_W / 2;
    const btnCY = COUNTER_Y + COUNTER_H + 20;
    ctx.strokeStyle = SK.redPen;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(255,200,200,0.35)";
    wobblyCircle(ctx, btnCX, btnCY, 15, fc, 3200, 1.5);
    ctx.fill();
    ctx.stroke();
    handText(ctx, "DRAW!", btnCX, btnCY, 8.5, SK.redPen);

    // ── Characters (NPCs + player) ─────────────────────────────────────────
    const allChars: CharState[] = [...npcsRef.current, playerRef.current];
    // Sort by y (painter's order)
    const sorted = [...allChars].sort((a, b) => a.y - b.y);

    for (const char of sorted) {
      const vb = 5000 + Math.abs(char.id) * 300;
      const pose: StickPose =
        char.state === "walking" ? "walk" :
        char.state === "celebrating" ? "celebrate" : "idle";

      // Name label
      handText(ctx, char.name, char.x, char.y + 6, 8.5, char.color);

      // Draw stick figure
      drawStickFigure(ctx, char.x, char.y - 4, char.color, fc, vb, pose, char.hasHat, char.hasGlasses);

      // Speech bubble
      if (char.bubble) {
        drawSpeechBubble(ctx, char.bubble, char.x, char.y - 55, fc, vb + 1000);
      }

      // Prize grade badge (if celebrating)
      if (char.prizeGrade && char.state === "celebrating") {
        const g = char.prizeGrade;
        const gColor = GRADE_COLOR[g] ?? SK.pencil;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = SK.yellowHL;
        ctx.beginPath();
        ctx.ellipse(char.x, char.y - 70, 24, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = gColor;
        ctx.lineWidth = 1.2;
        wobblyCircle(ctx, char.x, char.y - 70, 14, fc, vb + 2000, 1.5);
        ctx.stroke();
        handText(ctx, g, char.x, char.y - 70, 9, gColor);
      }
    }

    // ── Prize reveal overlay ───────────────────────────────────────────────
    const pr = prizeRevealRef.current;
    if (pr) {
      if (pr.alpha < 1) pr.alpha = Math.min(1, pr.alpha + 0.02);
      const cx2 = W / 2, cy2 = H / 2;

      ctx.save();
      ctx.globalAlpha = pr.alpha * 0.9;

      // White oval behind burst
      ctx.fillStyle = "rgba(255,255,255,0.80)";
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, 85, 65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = pr.alpha;

      // Starburst
      drawWobblyStarburst(ctx, cx2, cy2, 70, fc, 6000, SK.redPen);

      // Grade text
      const gColor = GRADE_COLOR[pr.grade] ?? SK.pencil;
      ctx.globalAlpha = pr.alpha;
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(w(fc, 6100, 0.05));
      ctx.font = `bold 26px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = gColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pr.grade, 0, 0);
      ctx.restore();

      // "!! 當選 !!" text above grade
      ctx.globalAlpha = pr.alpha * 0.9;
      ctx.save();
      ctx.translate(cx2, cy2 - 30);
      ctx.rotate(w(fc, 6110, 0.04));
      ctx.font = `14px "Segoe Script", "Comic Sans MS", cursive`;
      ctx.fillStyle = SK.redPen;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!! 當選 !!", 0, 0);
      ctx.restore();

      // Red pen underline
      ctx.globalAlpha = pr.alpha;
      ctx.strokeStyle = SK.redPen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx2 - 35 + w(fc, 6200, 2), cy2 + 18 + w(fc, 6201, 1.5));
      wobblyLineTo(ctx, cx2 - 35, cy2 + 18, cx2 + 35, cy2 + 18, fc, 6202, 2);
      ctx.stroke();

      ctx.restore();

      // Click-to-dismiss hint
      handText(ctx, "(點擊繼續)", cx2, cy2 + 50, 9, SK.pencilFaint);
    }

    // ── Margin annotations (decorative) ───────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.28;

    // "← 排隊在這" annotation pointing to counter
    handText(ctx, "← 排隊在這", 78, COUNTER_Y + COUNTER_H / 2, 9, SK.pencilFaint, "left");

    // "抽獎台 →" annotation
    handText(ctx, "抽獎台 →", COUNTER_X - 60, COUNTER_Y + 6, 8.5, SK.pencilFaint, "right");

    // Small decorative doodles in left margin
    // Star
    ctx.strokeStyle = SK.pencilFaint;
    ctx.lineWidth = 1;
    const starCX = 20, starCY = 50;
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(starCX + Math.cos(a1) * 8, starCY + Math.sin(a1) * 8);
      }
      ctx.lineTo(starCX + Math.cos(a2) * 8, starCY + Math.sin(a2) * 8);
    }
    ctx.stroke();

    // Heart
    ctx.beginPath();
    ctx.moveTo(20, 120);
    ctx.bezierCurveTo(14, 114, 8, 120, 8, 126);
    ctx.bezierCurveTo(8, 134, 20, 142, 20, 142);
    ctx.bezierCurveTo(20, 142, 32, 134, 32, 126);
    ctx.bezierCurveTo(32, 120, 26, 114, 20, 120);
    ctx.stroke();

    // Swirl
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 4; a += 0.2) {
      const r = a * 1.8;
      const px = 20 + Math.cos(a) * r;
      const py = H - 60 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();

  }, []);

  // ── Update character positions ─────────────────────────────────────────────
  const updateChars = useCallback((dt: number) => {
    const speed = 0.09 * dt;

    // Player movement
    const p = playerRef.current;
    const pdx = p.targetX - p.x;
    const pdy = p.targetY - p.y;
    const pdist = Math.hypot(pdx, pdy);
    if (pdist > 2) {
      p.x += (pdx / pdist) * speed;
      p.y += (pdy / pdist) * speed;
      p.pose = "walk";
      p.state = "walking";
    } else {
      p.pose = "idle";
      if (p.state === "walking") p.state = "idle";
    }

    // NPC bubble timer decay
    for (const npc of npcsRef.current) {
      if (npc.bubbleTimer > 0) {
        npc.bubbleTimer -= dt;
        if (npc.bubbleTimer <= 0) npc.bubble = null;
      }
    }
    if (p.bubbleTimer > 0) {
      p.bubbleTimer -= dt;
      if (p.bubbleTimer <= 0) p.bubble = null;
    }
  }, []);

  // ── NPC AI: periodically wander and queue for drawing ─────────────────────
  useEffect(() => {
    const scheduleNpcAction = (id: number) => {
      const delay = 1200 + Math.random() * 3000;
      const timer = window.setTimeout(() => {
        const npcs = npcsRef.current;
        const npc = npcs.find((n) => n.id === id);
        if (!npc) return;

        if (npc.state === "idle") {
          // 30% chance to queue for drawing
          if (Math.random() < 0.30 && activeDrawerRef.current === null && drawQueueRef.current.length < 2) {
            npc.state = "queuing";
            npc.targetX = DRAW_ZONE_X + (drawQueueRef.current.length * 16 - 10);
            npc.targetY = DRAW_ZONE_Y + 25;
            drawQueueRef.current.push(id);
            npc.bubble = "輪到我了!";
            npc.bubbleTimer = 2000;
          } else {
            // Random wander
            npc.targetX = FLOOR_LEFT + 30 + Math.random() * (FLOOR_RIGHT - FLOOR_LEFT - 60);
            npc.targetY = FLOOR_TOP + 50 + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP - 70);
            npc.state = "walking";
          }
        } else if (npc.state === "queuing") {
          // Check if first in queue and no active drawer
          if (drawQueueRef.current[0] === id && activeDrawerRef.current === null) {
            drawQueueRef.current.shift();
            activeDrawerRef.current = id;
            npc.state = "drawing";
            npc.targetX = DRAW_ZONE_X;
            npc.targetY = DRAW_ZONE_Y;
            npc.bubble = "抽籤中...";
            npc.bubbleTimer = 1500;

            // After drawing delay, reveal prize
            window.setTimeout(() => {
              const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "A賞";
              const prizeName = PRIZE_NAMES[grade] ?? "";
              npc.prizeGrade = grade;
              npc.state = "celebrating";
              npc.bubble = `${grade}!!`;
              npc.bubbleTimer = 3000;
              npc.pose = "celebrate";
              activeDrawerRef.current = null;
              onDrawResult?.(grade, prizeName);

              // Return to idle after celebration
              window.setTimeout(() => {
                npc.state = "idle";
                npc.prizeGrade = null;
                npc.bubble = null;
                npc.targetX = FLOOR_LEFT + 30 + Math.random() * (FLOOR_RIGHT - FLOOR_LEFT - 60);
                npc.targetY = FLOOR_TOP + 60 + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP - 80);
                scheduleNpcAction(id);
              }, 3500);
            }, 1800);
          }
        }

        if (npc.state !== "drawing" && npc.state !== "celebrating") {
          scheduleNpcAction(id);
        }
      }, delay);
      npcTimersRef.current[id] = timer;
    };

    npcsRef.current.forEach((npc) => scheduleNpcAction(npc.id));

    return () => {
      npcTimersRef.current.forEach((t) => window.clearTimeout(t));
      npcTimersRef.current = [];
    };
  }, [npcCount, onDrawResult]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;

    updateChars(dt);
    draw();

    animRef.current = requestAnimationFrame(animate);
  }, [draw, updateChars]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    // Dismiss prize reveal
    if (prizeRevealRef.current) {
      prizeRevealRef.current = null;
      return;
    }

    // Click on DRAW button
    const btnCX = COUNTER_X + COUNTER_W / 2;
    const btnCY = COUNTER_Y + COUNTER_H + 20;
    if (Math.hypot(nx - btnCX, ny - btnCY) < 20) {
      // Player draws
      const p = playerRef.current;
      p.targetX = DRAW_ZONE_X;
      p.targetY = DRAW_ZONE_Y + 30;
      p.state = "walking";
      p.bubble = "我要抽!";
      p.bubbleTimer = 1500;
      window.setTimeout(() => {
        const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "A賞";
        const prizeName = PRIZE_NAMES[grade] ?? "";
        p.prizeGrade = grade;
        p.state = "celebrating";
        p.bubble = `${grade}!!`;
        p.bubbleTimer = 3000;
        prizeRevealRef.current = { grade, alpha: 0 };
        onDrawResult?.(grade, prizeName);
        window.setTimeout(() => {
          p.state = "idle";
          p.prizeGrade = null;
        }, 4000);
      }, 1800);
      return;
    }

    // Click on floor: move player
    if (ny > FLOOR_TOP && ny < FLOOR_BOTTOM && nx > FLOOR_LEFT && nx < FLOOR_RIGHT) {
      const p = playerRef.current;
      p.targetX = nx;
      p.targetY = ny;
      p.state = "walking";
    }
  }, [onDrawResult]);

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
