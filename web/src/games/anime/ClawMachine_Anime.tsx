"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimeClawGameState =
  | "IDLE"
  | "AIMING"
  | "DESCENDING"
  | "GRABBING"
  | "LIFTING"
  | "DROPPING"
  | "RESULT";

export interface ClawMachineAnimeProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: AnimeClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas dimensions
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Anime palette
// ─────────────────────────────────────────────────────────────────────────────

const AN = {
  bgTop:        "#ffd6e7",
  bgBottom:     "#cce5ff",
  body:         "#fce4f5",
  bodyStroke:   "#222222",
  bodyAccent:   "#ff88bb",
  bodyAccent2:  "#88ccff",
  glassBody:    "rgba(200,240,255,0.35)",
  glassBorder:  "rgba(120,200,255,0.8)",
  glassShine:   "rgba(255,255,255,0.55)",
  clawBody:     "#ff88bb",
  clawProng:    "#ffaacc",
  clawHub:      "#ffd700",
  controlBg:    "#fff0fb",
  btnLeft:      "#88ccff",
  btnRight:     "#ffaacc",
  btnDrop:      "#ff6699",
  btnDropStroke:"#cc2255",
  gradeA:       "#f5c518",
  gradeB:       "#4488ee",
  gradeC:       "#44cc77",
  gradeD:       "#ff6688",
  speedLine:    "rgba(255,220,0,0.55)",
  sparkleA:     "#ffe066",
  sparkleB:     "#ffffff",
  ink:          "#1a1a2e",
  white:        "#ffffff",
  petalFill:    "#ffb3c6",
  petalStroke:  "#ff88a0",
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": AN.gradeA,
  "B賞": AN.gradeB,
  "C賞": AN.gradeC,
  "D賞": AN.gradeD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cherry blossom petal data
// ─────────────────────────────────────────────────────────────────────────────

interface Petal {
  x: number; y: number; size: number; speed: number;
  drift: number; phase: number; rotation: number; rotSpeed: number;
}

function makePetals(count: number): Petal[] {
  const petals: Petal[] = [];
  for (let i = 0; i < count; i++) {
    petals.push({
      x: (i / count) * W * 1.4 - W * 0.2,
      y: Math.sin(i * 2.3) * H * 0.5 + Math.cos(i * 1.1) * H * 0.3 + H * 0.1,
      size: 5 + (i % 4) * 2,
      speed: 0.3 + (i % 5) * 0.12,
      drift: Math.sin(i * 0.7) * 0.6,
      phase: i * 0.83,
      rotation: i * 0.45,
      rotSpeed: 0.008 + (i % 3) * 0.004,
    });
  }
  return petals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particle data
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers (shared anime primitives)
// ─────────────────────────────────────────────────────────────────────────────

function animeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | number[],
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
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#ffeeaa";
  ctx.fill();
  ctx.restore();
}

function mangaText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  fontSize: number, fillColor: string,
  outlineColor = AN.bodyStroke,
  outlineWidth = 4,
  align: CanvasTextAlign = "center",
): void {
  ctx.save();
  ctx.font = `900 ${fontSize}px "Impact","Arial Black","Hiragino Kaku Gothic ProN",sans-serif`;
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

function drawChibiFace(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  expression: "happy" | "excited" | "surprised",
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe8d6";
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  for (const bx of [cx - size * 0.45, cx + size * 0.45]) {
    ctx.beginPath();
    ctx.ellipse(bx, cy + size * 0.15, size * 0.22, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,160,160,0.5)";
    ctx.fill();
  }

  if (expression === "happy") {
    // ^_^ arcs
    for (const ex of [cx - size * 0.3, cx + size * 0.3]) {
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.1, size * 0.16, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.1, size * 0.22, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (expression === "excited") {
    // >_< cross eyes
    for (const [ex, dir] of [[cx - size * 0.3, 1], [cx + size * 0.3, -1]] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.15 * dir, cy - size * 0.18);
      ctx.lineTo(ex + size * 0.08 * dir, cy + size * 0.02);
      ctx.moveTo(ex + size * 0.08 * dir, cy - size * 0.18);
      ctx.lineTo(ex - size * 0.12 * dir, cy + size * 0.02);
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.15, size * 0.18, 0, Math.PI);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // O_O wide eyes
    for (const ex of [cx - size * 0.3, cx + size * 0.3]) {
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.08, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.08, size * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + size * 0.04, cy - size * 0.12, size * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.28, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

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
    const jitter = Math.sin(i * 1.73) * 0.08;
    const a2 = a + jitter;
    void a2;
    const spreadW = (Math.PI * 2 / count) * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - spreadW) * innerR, cy + Math.sin(a - spreadW) * innerR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.lineTo(cx + Math.cos(a + spreadW) * innerR, cy + Math.sin(a + spreadW) * innerR);
    ctx.closePath();
    ctx.fillStyle = AN.speedLine;
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Chibi plushie prize characters
// ─────────────────────────────────────────────────────────────────────────────

function drawChibiPrize(
  ctx: CanvasRenderingContext2D,
  grade: string, cx: number, cy: number, size: number, alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor =
    grade === "A賞" ? "#ffd700" :
    grade === "B賞" ? "#88aaff" :
    grade === "C賞" ? "#88ddaa" :
    "#ffaabb";
  const outlineColor = AN.bodyStroke;

  // Body (big round shape — chibi proportions)
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.1, size * 0.58, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Big head (slightly overlapping body top)
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.25, size * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Face blush
  for (const bx of [cx - size * 0.22, cx + size * 0.22]) {
    ctx.beginPath();
    ctx.ellipse(bx, cy - size * 0.18, size * 0.12, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,140,140,0.55)";
    ctx.fill();
  }

  // Eyes
  for (const ex of [cx - size * 0.16, cx + size * 0.16]) {
    ctx.beginPath();
    ctx.arc(ex, cy - size * 0.28, size * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = AN.bodyStroke;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(ex + size * 0.03, cy - size * 0.32, size * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = AN.white;
    ctx.fill();
  }

  // Smile
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.14, size * 0.12, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tiny limbs
  // Left arm
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.62, cy + size * 0.06, size * 0.12, size * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.ellipse(cx + size * 0.62, cy + size * 0.06, size * 0.12, size * 0.22, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Legs
  for (const lx of [cx - size * 0.22, cx + size * 0.22]) {
    ctx.beginPath();
    ctx.ellipse(lx, cy + size * 0.56, size * 0.13, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Grade-specific decorations
  if (grade === "A賞") {
    // Crown on head
    const crownX = cx;
    const crownY = cy - size * 0.66;
    ctx.beginPath();
    ctx.moveTo(crownX - size * 0.22, crownY + size * 0.08);
    ctx.lineTo(crownX - size * 0.22, crownY - size * 0.04);
    ctx.lineTo(crownX - size * 0.1, crownY - size * 0.12);
    ctx.lineTo(crownX, crownY - size * 0.18);
    ctx.lineTo(crownX + size * 0.1, crownY - size * 0.12);
    ctx.lineTo(crownX + size * 0.22, crownY - size * 0.04);
    ctx.lineTo(crownX + size * 0.22, crownY + size * 0.08);
    ctx.closePath();
    ctx.fillStyle = "#ffd700";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Crown gems
    for (const [gx, gy] of [
      [crownX - size * 0.1, crownY - size * 0.06],
      [crownX, crownY - size * 0.13],
      [crownX + size * 0.1, crownY - size * 0.06],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(gx, gy, size * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4488";
      ctx.fill();
    }
  } else if (grade === "B賞") {
    // Bunny ears
    for (const ex of [cx - size * 0.2, cx + size * 0.2]) {
      ctx.beginPath();
      ctx.ellipse(ex, cy - size * 0.72, size * 0.1, size * 0.22, ex < cx ? -0.15 : 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "#88aaff";
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(ex, cy - size * 0.72, size * 0.05, size * 0.14, ex < cx ? -0.15 : 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "#ffccdd";
      ctx.fill();
    }
  } else if (grade === "C賞") {
    // Cat ears
    for (const ex of [cx - size * 0.22, cx + size * 0.22]) {
      ctx.beginPath();
      ctx.moveTo(ex, cy - size * 0.6);
      ctx.lineTo(ex - size * 0.12, cy - size * 0.78);
      ctx.lineTo(ex + size * 0.12, cy - size * 0.78);
      ctx.closePath();
      ctx.fillStyle = "#88ddaa";
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    // Bird wing bumps on sides
    for (const [wx, wy, sign] of [
      [cx - size * 0.54, cy - size * 0.1, -1],
      [cx + size * 0.54, cy - size * 0.1, 1],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.ellipse(wx, wy, size * 0.18, size * 0.28, sign * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffaabb";
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Claw drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawAnimeClaw(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, openAmount: number,
): void {
  // openAmount: 0 = fully closed, 1 = fully open

  // Hub: star shape
  const hubR = 9;
  const spikes = 5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? hubR : hubR * 0.45;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = AN.clawHub;
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Three prongs
  const prongAngles = [-0.45 - openAmount * 0.35, 0, 0.45 + openAmount * 0.35];
  const prongLen = 28;
  for (const baseAngle of prongAngles) {
    const angle = Math.PI / 2 + baseAngle;
    const tipX = cx + Math.cos(angle) * prongLen;
    const tipY = cy + Math.sin(angle) * prongLen;
    const hookX = tipX + Math.cos(angle + 0.8) * 10;
    const hookY = tipY + Math.sin(angle + 0.8) * 10;

    // Prong arm
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * hubR * 0.7, cy + Math.sin(angle) * hubR * 0.7);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = AN.clawBody;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hook curl
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(tipX + Math.cos(angle + 1.2) * 8, tipY + Math.sin(angle + 1.2) * 8, hookX, hookY);
    ctx.strokeStyle = AN.clawBody;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prize positions inside glass case
// ─────────────────────────────────────────────────────────────────────────────

const PRIZE_POSITIONS = [
  { x: 80,  y: 305, grade: "A賞", size: 22 },
  { x: 145, y: 310, grade: "D賞", size: 19 },
  { x: 205, y: 305, grade: "C賞", size: 20 },
  { x: 112, y: 340, grade: "B賞", size: 21 },
  { x: 175, y: 338, grade: "D賞", size: 18 },
  { x: 245, y: 310, grade: "A賞", size: 16 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine_Anime({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachineAnimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AnimeClawGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<AnimeClawGameState>("IDLE");

  const clawX = useRef(170);          // horizontal position
  const clawY = useRef(110);          // vertical position (cable attachment)
  const clawTargetX = useRef(170);
  const clawOpen = useRef(1.0);       // 0=closed 1=open
  const aimDir = useRef(1);           // auto-aim direction

  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const winPhase = useRef(0);
  const resultScale = useRef(0);
  const shakeX = useRef(0);
  const shakeY = useRef(0);
  const shakeTimer = useRef(0);
  const sparkles = useRef<Sparkle[]>([]);
  const petals = useRef<Petal[]>(makePetals(14));
  const caughtPrize = useRef(false);

  const changeState = useCallback((s: AnimeClawGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const spawnSparkles = useCallback((x: number, y: number, count = 18) => {
    const newSparkles: Sparkle[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 1.2 + Math.random() * 2.2;
      newSparkles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 0.8,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.6,
        size: 3 + Math.random() * 5,
        color: Math.random() > 0.5 ? AN.sparkleA : AN.sparkleB,
      });
    }
    sparkles.current = [...sparkles.current, ...newSparkles];
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameCount.current += 1;
    const fc = frameCount.current;
    const state = stateRef.current;
    const isResult = state === "RESULT";
    const isWin = isResult && caughtPrize.current;

    // Screen shake
    if (shakeTimer.current > 0) {
      shakeTimer.current = Math.max(0, shakeTimer.current - dt);
      const intensity = (shakeTimer.current / 350) * 4.5;
      shakeX.current = Math.sin(fc * 1.9) * intensity;
      shakeY.current = Math.cos(fc * 2.4) * intensity;
    } else {
      shakeX.current = 0; shakeY.current = 0;
    }

    ctx.save();
    ctx.translate(shakeX.current, shakeY.current);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, AN.bgTop);
    grad.addColorStop(1, AN.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Speed lines during descent
    if (state === "DESCENDING" || state === "GRABBING") {
      const lineAlpha = 0.32 + Math.abs(Math.sin(fc * 0.12)) * 0.15;
      drawSpeedLines(ctx, clawX.current, clawY.current + 20, 18, 70, 14, lineAlpha);
    }

    // Win speed lines
    if (isWin && winPhase.current > 0) {
      const lineAlpha = Math.abs(Math.sin(winPhase.current * Math.PI * 1.5)) * 0.55;
      drawSpeedLines(ctx, W / 2, H / 2, 55, W * 0.85, 22, lineAlpha);
    }

    // Cherry blossom petals (background)
    for (const petal of petals.current) {
      const t = fc * 0.012;
      const px = petal.x + Math.sin(t * petal.drift + petal.phase) * 18;
      const pa = 0.5 + Math.sin(t * 0.7 + petal.phase) * 0.2;
      drawPetal(ctx, px, petal.y, petal.size, petal.rotation + fc * petal.rotSpeed, pa);
    }

    // ── Machine body ──────────────────────────────────────────────────────────
    const mX = 24, mY = 44, mW = 292, mH = 390;
    const bodyR = 24;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.roundRect(mX + 5, mY + 8, mW, mH, bodyR);
    ctx.fillStyle = "#aa44aa";
    ctx.fill();
    ctx.restore();

    // Body
    animeRoundRect(ctx, mX, mY, mW, mH, bodyR, AN.body, AN.bodyStroke, 3);

    // Top accent band
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mX, mY, mW, 52, [bodyR, bodyR, 0, 0]);
    ctx.fillStyle = AN.bodyAccent;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Candy stripes on accent band
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mX, mY, mW, 52, [bodyR, bodyR, 0, 0]);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 10; i++) {
      const sx = mX + i * 34 - 14;
      ctx.beginPath();
      ctx.moveTo(sx, mY);
      ctx.lineTo(sx + 22, mY + 52);
      ctx.strokeStyle = AN.white;
      ctx.lineWidth = 10;
      ctx.stroke();
    }
    ctx.restore();

    // Chibi face
    const faceExpr = isResult ? (isWin ? "excited" : "surprised") : "happy";
    drawChibiFace(ctx, mX + mW / 2 - 30, mY + 28, 18, faceExpr);

    // Title text
    mangaText(ctx, "夾娃娃 CLAW", mX + mW / 2 + 20, mY + 28, 13, AN.white, AN.bodyStroke, 3.5);

    // ── Glass case ─────────────────────────────────────────────────────────────
    const gX = mX + 16, gY = mY + 60, gW = mW - 32, gH = 240;
    const glassR = 16;

    // Glass case shadow inset
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.roundRect(gX + 3, gY + 3, gW - 6, gH - 6, glassR - 2);
    ctx.fillStyle = "#002266";
    ctx.fill();
    ctx.restore();

    // Glass body
    ctx.beginPath();
    ctx.roundRect(gX, gY, gW, gH, glassR);
    ctx.fillStyle = AN.glassBody;
    ctx.fill();
    ctx.strokeStyle = AN.glassBorder;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glass sparkle reflections
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(gX, gY, gW, gH, glassR);
    ctx.clip();
    // Main shine diagonal
    const shineGrad = ctx.createLinearGradient(gX, gY, gX + gW * 0.45, gY + gH * 0.45);
    shineGrad.addColorStop(0, "rgba(255,255,255,0.28)");
    shineGrad.addColorStop(0.4, "rgba(255,255,255,0.06)");
    shineGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shineGrad;
    ctx.fillRect(gX, gY, gW, gH);
    // Small sparkle glints
    const glintAlpha = 0.35 + Math.sin(fc * 0.05) * 0.15;
    for (const [gx, gy] of [
      [gX + gW * 0.12, gY + gH * 0.09],
      [gX + gW * 0.22, gY + gH * 0.22],
      [gX + gW * 0.78, gY + gH * 0.12],
    ] as [number, number][]) {
      ctx.save();
      ctx.globalAlpha = glintAlpha;
      for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + dx, gy + dy);
        ctx.strokeStyle = AN.white;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // Floor of glass case
    animeRoundRect(ctx, gX, gY + gH - 8, gW, 8, [0, 0, glassR, glassR], "#cce8ff", AN.glassBorder, 1.5);

    // Prize chibi characters
    for (const pos of PRIZE_POSITIONS) {
      const isTargetGrade = pos.grade === resultGrade;
      const alpha = isTargetGrade ? 1 : 0.7;
      drawChibiPrize(ctx, pos.grade, pos.x, pos.y, pos.size, alpha);
    }

    // ── Claw assembly ─────────────────────────────────────────────────────────
    const cx = clawX.current;
    const cy = clawY.current;

    // Rail bar at top
    animeRoundRect(ctx, gX + 4, gY + 2, gW - 8, 12, 6, "#ffccee", AN.bodyStroke, 1.8);

    // Trolley (slides along rail)
    animeRoundRect(ctx, cx - 14, gY + 2, 28, 18, 5, AN.bodyAccent, AN.bodyStroke, 2);

    // Cable from trolley to claw hub
    ctx.beginPath();
    ctx.moveTo(cx, gY + 20);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, gY + 20);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = "#ffccee";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Draw claw
    drawAnimeClaw(ctx, cx, cy, clawOpen.current);

    // Prize being lifted (shown during LIFTING)
    if (state === "LIFTING" && caughtPrize.current) {
      const t = Math.max(0, 1 - (cy - 80) / 140);
      drawChibiPrize(ctx, resultGrade, cx, cy + 38, 20, t);
      // Sparkles following catch
      if (fc % 5 === 0) spawnSparkles(cx + (Math.random() - 0.5) * 30, cy + 30, 3);
    }

    // ── Bottom control panel ───────────────────────────────────────────────────
    const panelY = mY + gH + 68;
    animeRoundRect(ctx, mX + 12, panelY, mW - 24, 68, 18, AN.controlBg, AN.bodyStroke, 2.5);

    // Directional buttons (left / right) with ♪ icons
    const btnSize = 28;
    const leftBtnX = mX + 36;
    const rightBtnX = mX + 36 + btnSize + 14;
    const btnY2 = panelY + 20;

    for (const [bx, color, label] of [
      [leftBtnX, AN.btnLeft, "◀"],
      [rightBtnX, AN.btnRight, "▶"],
    ] as [number, string, string][]) {
      ctx.beginPath();
      ctx.arc(bx + btnSize / 2, btnY2 + btnSize / 2, btnSize / 2 + 2, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + btnSize / 2, btnY2 + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      mangaText(ctx, label, bx + btnSize / 2, btnY2 + btnSize / 2, 11, AN.white, AN.bodyStroke, 2.5);
    }

    // DROP button — big heart-shaped pink button
    const dropBtnCX = mX + mW - 68;
    const dropBtnCY = panelY + 34;
    const dropR = 24;

    const canInteract = state === "IDLE" || state === "RESULT";

    // Heart shape
    ctx.save();
    ctx.translate(dropBtnCX, dropBtnCY);
    const hs = dropR * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, hs * 0.5);
    ctx.bezierCurveTo(-hs, -hs * 0.35, -hs, -hs, 0, -hs * 0.35);
    ctx.bezierCurveTo(hs, -hs, hs, -hs * 0.35, 0, hs * 0.5);
    ctx.fillStyle = canInteract ? AN.btnDrop : "rgba(255,100,150,0.45)";
    ctx.fill();
    ctx.strokeStyle = AN.btnDropStroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Heart shine
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(-hs * 0.25, -hs * 0.35, hs * 0.18, hs * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = AN.white;
    ctx.fill();
    ctx.restore();
    ctx.restore();

    const dropLabel = state === "RESULT" ? "もう一度!" : "DROP";
    mangaText(ctx, dropLabel, dropBtnCX, dropBtnCY + 2, state === "RESULT" ? 8 : 10, AN.white, AN.bodyStroke, 2.5);

    // Sparkles on glass during grab
    if (state === "GRABBING") {
      const gAlpha = 0.5 + Math.sin(fc * 0.25) * 0.3;
      for (const [sx, sy] of [
        [cx - 18, cy + 18],
        [cx + 18, cy + 18],
        [cx, cy + 28],
      ] as [number, number][]) {
        ctx.save();
        ctx.globalAlpha = gAlpha;
        const ss = 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy - ss); ctx.lineTo(sx + ss * 0.2, sy - ss * 0.2);
        ctx.lineTo(sx + ss, sy); ctx.lineTo(sx + ss * 0.2, sy + ss * 0.2);
        ctx.lineTo(sx, sy + ss); ctx.lineTo(sx - ss * 0.2, sy + ss * 0.2);
        ctx.lineTo(sx - ss, sy); ctx.lineTo(sx - ss * 0.2, sy - ss * 0.2);
        ctx.closePath();
        ctx.fillStyle = AN.sparkleA;
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Sparkle particles ────────────────────────────────────────────────────
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
      ctx.fillStyle = sp.color;
      ctx.fill();
      ctx.restore();
    }

    // ── Result overlay ────────────────────────────────────────────────────────
    if (isResult && resultScale.current > 0) {
      const sc = resultScale.current;
      const overshoot = sc < 0.6 ? sc / 0.6 * 1.3 : 1.3 - (sc - 0.6) / 0.4 * 0.3;
      const gradeHex = GRADE_COLOR[resultGrade] ?? AN.gradeA;

      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      ctx.scale(overshoot, overshoot);
      ctx.globalAlpha = Math.min(sc * 2, 1);

      // Panel
      animeRoundRect(ctx, -82, -60, 164, 120, 20, AN.white, AN.bodyStroke, 3);

      // Header bar
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-82, -60, 164, 34, [20, 20, 0, 0]);
      ctx.fillStyle = gradeHex;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Win jackpot starburst
      if (isWin && resultGrade === "A賞") {
        ctx.save();
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
          ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96);
          ctx.strokeStyle = AN.sparkleA;
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Prize chibi in panel
      drawChibiPrize(ctx, resultGrade, 0, 12, 22);

      // Grade text
      mangaText(ctx, resultGrade, 0, 44, 16, AN.ink, AN.bodyStroke, 3);

      // Prize name
      ctx.save();
      ctx.font = `600 9px "Hiragino Kaku Gothic ProN","Arial",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#888";
      ctx.fillText(prizeName, 0, 56);
      ctx.restore();

      // Win text
      if (isWin) {
        mangaText(ctx, "ゲット！", 0, -74, 18, AN.sparkleA, AN.bodyStroke, 4);
        if (resultGrade === "A賞") {
          mangaText(ctx, "★ 大当たり ★", 0, -90, 12, AN.white, "#aa4400", 2.5);
        }
      } else {
        mangaText(ctx, "残念...", 0, -70, 14, "#aaaaaa", AN.bodyStroke, 3);
      }

      ctx.restore();
    }

    // ── "ドキドキ♥" float during aiming ────────────────────────────────────
    if (state === "AIMING" && fc % 60 < 30) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(fc * 0.1)) * 0.25;
      ctx.font = `700 11px "Hiragino Kaku Gothic ProN","Arial",sans-serif`;
      ctx.fillStyle = AN.gradeD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ドキドキ♥", W / 2, mY + 16);
      ctx.restore();
    }

    // Advance win phase
    if (isResult) {
      if (winPhase.current < 99) winPhase.current += dt / 380;
      if (resultScale.current < 1) resultScale.current = Math.min(1, resultScale.current + dt / 260);
    } else {
      winPhase.current = 0;
      resultScale.current = 0;
    }

    // Update sparkles
    for (const sp of sparkles.current) {
      sp.x += sp.vx; sp.y += sp.vy;
      sp.vy += 0.06;
      sp.life = Math.max(0, sp.life - dt / (sp.maxLife * 1000));
    }

    // Animate petals
    for (const p of petals.current) {
      p.y += p.speed * dt / 16;
      if (p.y > H + 20) p.y = -20;
    }

    ctx.restore(); // end shake
  }, [resultGrade, prizeName, spawnSparkles]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;

    const state = stateRef.current;

    // Glass case boundary for claw
    const minX = 52, maxX = 288;

    if (state === "AIMING") {
      // Auto-sweep back and forth
      clawX.current += aimDir.current * 1.2 * dt / 16;
      if (clawX.current > maxX - 10) { clawX.current = maxX - 10; aimDir.current = -1; }
      if (clawX.current < minX + 10) { clawX.current = minX + 10; aimDir.current = 1; }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [animate]);

  // ── Drop sequence ───────────────────────────────────────────────────────────
  const startDrop = useCallback(() => {
    caughtPrize.current = false;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];
    clawOpen.current = 1.0;

    // Freeze aim position, start descent
    clawTargetX.current = clawX.current;
    changeState("DESCENDING");

    const topY = 110;
    const bottomY = 270;
    const stepDown = 2.4;
    let curY = topY;

    // Descend
    const descendInterval = setInterval(() => {
      curY += stepDown;
      clawY.current = curY;
      if (curY >= bottomY) {
        clearInterval(descendInterval);
        // Grab
        changeState("GRABBING");
        clawOpen.current = 0.0;

        // Determine catch success based on proximity to prizes
        const catchable = PRIZE_POSITIONS.some(
          (p) => p.grade === resultGrade &&
            Math.abs(p.x - clawX.current) < 40 &&
            Math.abs(p.y - curY) < 50,
        );
        caughtPrize.current = catchable;

        setTimeout(() => {
          if (caughtPrize.current) spawnSparkles(clawX.current, curY, 12);

          // Lift
          changeState("LIFTING");
          const liftInterval = setInterval(() => {
            clawY.current -= 2.2;
            if (clawY.current <= topY) {
              clearInterval(liftInterval);
              clawY.current = topY;
              changeState("DROPPING");

              // Move claw to drop slot (right side)
              const dropX = 280;
              const moveInterval = setInterval(() => {
                const dx = dropX - clawX.current;
                clawX.current += dx * 0.12;
                if (Math.abs(dx) < 2) {
                  clearInterval(moveInterval);
                  // Release
                  clawOpen.current = 1.0;
                  setTimeout(() => {
                    if (caughtPrize.current) {
                      spawnSparkles(clawX.current, 320, 22);
                      shakeTimer.current = 300;
                    }
                    changeState("RESULT");
                    onResult?.(caughtPrize.current ? resultGrade : "D賞");
                  }, 400);
                }
              }, 16);
            }
          }, 16);
        }, 350);
      }
    }, 16);
  }, [resultGrade, changeState, spawnSparkles, onResult]);

  const startAiming = useCallback(() => {
    caughtPrize.current = false;
    clawX.current = 170;
    clawY.current = 110;
    clawOpen.current = 1.0;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];
    changeState("AIMING");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const mX = 24, mY = 44, mW = 292;
    const gH = 240;
    const panelY = mY + gH + 68;
    const dropBtnCX = mX + mW - 68;
    const dropBtnCY = panelY + 34;

    const onDrop = Math.hypot(nx - dropBtnCX, ny - dropBtnCY) < 30;
    const onLeft = Math.hypot(nx - (mX + 36 + 14), ny - (panelY + 20 + 14)) < 20;
    const onRight = Math.hypot(nx - (mX + 36 + 14 + 28 + 14 + 14), ny - (panelY + 20 + 14)) < 20;

    const state = stateRef.current;

    if (state === "RESULT" && onDrop) {
      startAiming();
    } else if (state === "IDLE" && onDrop) {
      startAiming();
    } else if (state === "AIMING" && onDrop) {
      startDrop();
    } else if (state === "AIMING" && onLeft) {
      clawX.current = Math.max(52, clawX.current - 20);
    } else if (state === "AIMING" && onRight) {
      clawX.current = Math.min(288, clawX.current + 20);
    }
  }, [startAiming, startDrop]);

  void gameState;

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: "linear-gradient(180deg, #ffd6e7 0%, #cce5ff 100%)", padding: 10 }}
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
          borderRadius: 12,
        }}
      />
    </div>
  );
}
