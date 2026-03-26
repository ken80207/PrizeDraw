"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimeSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineAnimeProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: AnimeSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Anime/Manga palette — bright pastels with bold outlines
// ─────────────────────────────────────────────────────────────────────────────

const AN = {
  // Background gradient stops
  bgTop:       "#ffd6e7",   // light pink
  bgBottom:    "#cce5ff",   // light blue
  // Machine body
  body:        "#fff0f5",   // near-white with pink tint
  bodyStroke:  "#222222",   // bold black outline
  bodyAccent:  "#ff88bb",   // pink accent strips
  // Reel backgrounds per slot
  reelA:       "#fff9c4",   // soft yellow
  reelB:       "#d4f1f9",   // soft blue
  reelC:       "#dcf8e6",   // soft green
  reelBg:      "#fff8fb",   // default reel bg
  // Grade colors
  gradeA:      "#f5c518",   // golden star
  gradeB:      "#4488ee",   // blue gem
  gradeC:      "#44cc77",   // green clover
  gradeD:      "#ff6688",   // pink heart
  // Text
  ink:         "#1a1a2e",   // dark manga ink
  white:       "#ffffff",
  // Lever
  leverBody:   "#ff88bb",
  leverKnob:   "#ffd700",
  // Win effects
  speedLine:   "rgba(255,220,0,0.55)",
  sparkleA:    "#ffe066",
  sparkleB:    "#ffffff",
  // Cherry blossom
  petalFill:   "#ffb3c6",
  petalStroke: "#ff88a0",
};

const GRADE_REEL_BG: Record<string, string> = {
  "A賞": AN.reelA,
  "B賞": AN.reelB,
  "C賞": AN.reelBg,
  "D賞": AN.reelBg,
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": AN.gradeA,
  "B賞": AN.gradeB,
  "C賞": AN.gradeC,
  "D賞": AN.gradeD,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 70;
const REEL_VISIBLE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Cherry blossom petal data
// ─────────────────────────────────────────────────────────────────────────────

interface Petal {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  rotation: number;
  rotSpeed: number;
}

function makePetals(count: number): Petal[] {
  const petals: Petal[] = [];
  for (let i = 0; i < count; i++) {
    petals.push({
      x: (i / count) * W * 1.4 - W * 0.2,
      y: Math.sin(i * 2.3) * H * 0.6 + Math.cos(i * 1.1) * H * 0.3 + H * 0.1,
      size: 7 + (i % 4) * 3,   // bigger: 7–16px
      speed: 0.22 + (i % 5) * 0.09,  // a little slower = more graceful
      drift: Math.sin(i * 0.7) * 0.8,
      phase: i * 0.83,
      rotation: i * 0.45,
      rotSpeed: 0.006 + (i % 3) * 0.004,
    });
  }
  return petals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particle data
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
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Bold outlined rounded rect — the core "anime" shape primitive */
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

/** Draw a 5-petal cherry blossom at (cx, cy) */
function drawPetal(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  rotation: number,
  alpha: number,
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
  // Center dot
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#ffeeaa";
  ctx.fill();
  ctx.restore();
}

/** Draw chibi-style grade symbol */
function drawGradeSymbol(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (grade === "A賞") {
    // Golden star with outline
    const spikes = 5;
    const outerR = size * 0.52;
    const innerR = size * 0.22;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = AN.gradeA;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Sparkly eyes on star (two small white circles + black dots)
    const eyeOffX = size * 0.14;
    const eyeOffY = -size * 0.06;
    for (const ex of [-eyeOffX, eyeOffX]) {
      ctx.beginPath();
      ctx.arc(cx + ex, cy + eyeOffY, size * 0.065, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + ex, cy + eyeOffY, size * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
    }
  } else if (grade === "B賞") {
    // Blue gem diamond with shine
    const d = size * 0.44;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d * 0.65, cy - d * 0.2);
    ctx.lineTo(cx + d * 0.65, cy + d * 0.2);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d * 0.65, cy + d * 0.2);
    ctx.lineTo(cx - d * 0.65, cy - d * 0.2);
    ctx.closePath();
    ctx.fillStyle = AN.gradeB;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shine highlight
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - d * 0.15, cy - d * 0.55);
    ctx.lineTo(cx + d * 0.15, cy - d * 0.35);
    ctx.lineTo(cx - d * 0.05, cy - d * 0.1);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
    ctx.restore();
  } else if (grade === "C賞") {
    // Green four-leaf clover
    const r2 = size * 0.26;
    const offsets = [
      [0, -r2 * 0.8], [r2 * 0.8, 0], [0, r2 * 0.8], [-r2 * 0.8, 0],
    ];
    for (const [ox, oy] of offsets) {
      ctx.beginPath();
      ctx.arc(cx + ox!, cy + oy!, r2, 0, Math.PI * 2);
      ctx.fillStyle = AN.gradeC;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // Small stem
    ctx.beginPath();
    ctx.moveTo(cx, cy + r2 * 0.8);
    ctx.quadraticCurveTo(cx + r2 * 0.6, cy + r2 * 1.5, cx + r2 * 0.3, cy + r2 * 1.8);
    ctx.strokeStyle = "#338855";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Pink heart
    const s = size * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.6);
    ctx.bezierCurveTo(cx - s * 1.0, cy - s * 0.4, cx - s * 1.0, cy - s * 1.0, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 1.0, cy - s * 1.0, cx + s * 1.0, cy - s * 0.4, cx, cy + s * 0.6);
    ctx.fillStyle = AN.gradeD;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Heart shine
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.arc(cx - s * 0.22, cy - s * 0.15, s * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/** Draw manga-style impact text with bold outline */
function mangaText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  fillColor: string,
  outlineColor = AN.bodyStroke,
  outlineWidth = 4,
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

/** Draw chibi face on machine top */
function drawChibiFace(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  expression: "happy" | "excited" | "surprised",
): void {
  // Face circle
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe8d6";
  ctx.fill();
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Blush
  for (const bx of [cx - size * 0.45, cx + size * 0.45]) {
    ctx.beginPath();
    ctx.ellipse(bx, cy + size * 0.15, size * 0.22, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,160,160,0.5)";
    ctx.fill();
  }

  if (expression === "happy") {
    // ^_^ eyes
    for (const ex of [cx - size * 0.3, cx + size * 0.3]) {
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.1, size * 0.16, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Smile
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.1, size * 0.22, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  } else if (expression === "excited") {
    // >_< excited eyes
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
    // Excited mouth
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.15, size * 0.18, 0, Math.PI);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // O_O surprised
    for (const ex of [cx - size * 0.3, cx + size * 0.3]) {
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.08, size * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Pupil
      ctx.beginPath();
      ctx.arc(ex, cy - size * 0.08, size * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
      // Highlight dot
      ctx.beginPath();
      ctx.arc(ex + size * 0.04, cy - size * 0.12, size * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
    }
    // Small O mouth
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.28, size * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#cc3333";
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Draw speed lines radiating from center */
function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  innerR: number, outerR: number,
  count: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const jitter = Math.sin(i * 1.73) * 0.08;
    const a2 = a + jitter;
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
// Grade index helper
// ─────────────────────────────────────────────────────────────────────────────

function gradeIndex(grade: Grade): number {
  return SYMBOL_STRIP.findLastIndex((g) => g === grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Anime({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineAnimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AnimeSlotGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<AnimeSlotGameState>("IDLE");

  const reelOffsets = useRef<number[]>([0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0]);
  const reelLocked = useRef<boolean[]>([false, false, false]);
  // Squash/stretch per reel: 1 = normal
  const reelScaleY = useRef<number[]>([1, 1, 1]);

  const leverPull = useRef(0);       // 0..1 pull amount
  const leverBounce = useRef(0);     // elastic bounce phase
  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const winPhase = useRef(0);        // drives speed lines / overlay animation
  const resultScale = useRef(0);     // 0..1 pop-in scale
  const shakeX = useRef(0);          // screen shake offset X
  const shakeY = useRef(0);          // screen shake offset Y
  const shakeTimer = useRef(0);      // remaining shake time
  const sparkles = useRef<Sparkle[]>([]);
  const petals = useRef<Petal[]>(makePetals(20));

  const changeState = useCallback((s: AnimeSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Spawn sparkle burst ──────────────────────────────────────────────────
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

  // ── Draw frame ─────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameCount.current += 1;
    const fc = frameCount.current;
    const state = stateRef.current;
    const isResult = state === "RESULT";
    const isJackpot = isResult && resultGrade === "A賞";

    // ── Screen shake ────────────────────────────────────────────────────────
    if (shakeTimer.current > 0) {
      shakeTimer.current = Math.max(0, shakeTimer.current - dt);
      const intensity = (shakeTimer.current / 400) * 5;
      shakeX.current = Math.sin(fc * 1.8) * intensity;
      shakeY.current = Math.cos(fc * 2.3) * intensity;
    } else {
      shakeX.current = 0;
      shakeY.current = 0;
    }

    ctx.save();
    ctx.translate(shakeX.current, shakeY.current);

    // ── Background: pastel gradient ─────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, AN.bgTop);
    grad.addColorStop(1, AN.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Speed lines behind machine (win state) ──────────────────────────────
    if (isResult && winPhase.current > 0) {
      const lineAlpha = Math.abs(Math.sin(winPhase.current * Math.PI * 1.5)) * (isJackpot ? 0.7 : 0.45);
      drawSpeedLines(ctx, W / 2, H / 2, 60, W * 0.85, 24, lineAlpha);

      // Dark vignette on jackpot
      if (isJackpot) {
        const vig = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.85);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ── Cherry blossom petals (background layer) ────────────────────────────
    for (const petal of petals.current) {
      const t = fc * 0.012;
      const px = petal.x + Math.sin(t * petal.drift + petal.phase) * 18;
      const py = petal.y;
      const pa = 0.5 + Math.sin(t * 0.7 + petal.phase) * 0.2;
      drawPetal(ctx, px, py, petal.size, petal.rotation + fc * petal.rotSpeed, pa);
    }

    // ── Machine body: cute rounded capsule shape ────────────────────────────
    const mX = 28, mY = 50, mW = 220, mH = H - 68;
    const bodyR = 28;

    // Shadow (soft)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.roundRect(mX + 5, mY + 7, mW, mH, bodyR);
    ctx.fillStyle = "#aa4488";
    ctx.fill();
    ctx.restore();

    // Body
    animeRoundRect(ctx, mX, mY, mW, mH, bodyR, AN.body, AN.bodyStroke, 3);

    // Pink accent band at top of body
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mX, mY, mW, 56, [bodyR, bodyR, 0, 0]);
    ctx.fillStyle = AN.bodyAccent;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Candy stripe decoration on the accent band
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 8; i++) {
      const sx = mX + i * 30 - 10;
      ctx.beginPath();
      ctx.moveTo(sx, mY);
      ctx.lineTo(sx + 20, mY + 56);
      ctx.strokeStyle = AN.white;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();

    // ── Chibi face on top of machine ───────────────────────────────────────
    const faceY = mY + 30;
    const faceX = mX + mW / 2;
    const expr = isResult ? (isJackpot ? "excited" : "happy") : "happy";
    drawChibiFace(ctx, faceX, faceY, 18, expr);

    // ── "一番賞" title text ─────────────────────────────────────────────────
    mangaText(ctx, "一番賞 SLOT", mX + mW / 2, mY + 58, 13, AN.white, AN.bodyStroke, 3.5);

    // ── Reel area: white bordered container ────────────────────────────────
    const reelAreaX = mX + 14;
    const reelAreaY = mY + 72;
    const reelAreaW = mW - 28;
    const reelAreaH = REEL_VISIBLE * CELL_H + 10;
    const reelAreaR = 16;

    animeRoundRect(ctx, reelAreaX, reelAreaY, reelAreaW, reelAreaH, reelAreaR, AN.white, AN.bodyStroke, 2.5);

    // Win row highlight
    const winRowY = reelAreaY + CELL_H + 5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(reelAreaX, winRowY, reelAreaW, CELL_H);
    ctx.clip();
    ctx.fillStyle = "rgba(255,200,220,0.18)";
    ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);
    ctx.restore();

    // Win row flash
    if (isResult && winPhase.current > 0) {
      const flash = Math.abs(Math.sin(winPhase.current * Math.PI * 3)) * 0.25;
      ctx.save();
      ctx.beginPath();
      ctx.rect(reelAreaX, winRowY, reelAreaW, CELL_H);
      ctx.clip();
      ctx.globalAlpha = flash;
      ctx.fillStyle = GRADE_COLOR[resultGrade as Grade] ?? AN.gradeA;
      ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Draw reels ──────────────────────────────────────────────────────────
    const singleReelW = Math.floor(reelAreaW / REEL_COUNT);
    for (let r = 0; r < REEL_COUNT; r++) {
      const rx = reelAreaX + r * singleReelW;
      const offset = reelOffsets.current[r] ?? 0;
      const scaleY = reelScaleY.current[r] ?? 1;

      // Reel tinted background
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.clip();
      ctx.fillStyle = GRADE_REEL_BG[resultGrade as Grade] ?? AN.reelBg;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.clip();

      // Squash/stretch: scale from center of reel vertically
      const reelCY = reelAreaY + reelAreaH / 2;
      ctx.translate(0, reelCY);
      ctx.scale(1, scaleY);
      ctx.translate(0, -reelCY);

      const startIdx = Math.floor(offset / CELL_H);
      const frac = offset % CELL_H;

      for (let v = -1; v <= REEL_VISIBLE + 1; v++) {
        const symbolIdx = ((startIdx + v) % SYMBOL_STRIP.length + SYMBOL_STRIP.length) % SYMBOL_STRIP.length;
        const grade = SYMBOL_STRIP[symbolIdx] as Grade;
        const cellY = reelAreaY + v * CELL_H - frac + 5;

        const iconCx = rx + singleReelW / 2;
        const iconCy = cellY + CELL_H * 0.45;
        drawGradeSymbol(ctx, grade, iconCx, iconCy, 20);

        // Grade label
        ctx.save();
        ctx.font = `800 9px "Impact", "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = AN.bodyStroke;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.strokeText(grade, iconCx, cellY + CELL_H - 13);
        ctx.fillStyle = GRADE_COLOR[grade] ?? AN.ink;
        ctx.fillText(grade, iconCx, cellY + CELL_H - 13);
        ctx.restore();
      }

      // Reel divider
      if (r < REEL_COUNT - 1) {
        ctx.fillStyle = AN.bodyStroke;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(rx + singleReelW - 1, reelAreaY + 5, 1, reelAreaH - 10);
      }

      ctx.restore();
    }

    // Win-row markers (pink arrow pointers)
    const arrowY = winRowY + CELL_H / 2;
    ctx.fillStyle = AN.gradeD;
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    // Left
    ctx.beginPath();
    ctx.moveTo(reelAreaX - 3, arrowY);
    ctx.lineTo(reelAreaX - 11, arrowY - 7);
    ctx.lineTo(reelAreaX - 11, arrowY + 7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right
    ctx.beginPath();
    ctx.moveTo(reelAreaX + reelAreaW + 3, arrowY);
    ctx.lineTo(reelAreaX + reelAreaW + 11, arrowY - 7);
    ctx.lineTo(reelAreaX + reelAreaW + 11, arrowY + 7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ── Lever: cute star-knob design ───────────────────────────────────────
    const levX = mX + mW + 24;
    const levBaseY = reelAreaY + reelAreaH / 2 + 14;
    const pullOffset = leverPull.current * 44;
    const bounceOffset = Math.sin(leverBounce.current) * 6 * Math.max(0, 1 - leverBounce.current / 6);
    const levTopY = levBaseY - 55 + pullOffset + bounceOffset;

    // Track
    animeRoundRect(ctx, levX - 5, levBaseY - 64, 10, 74, 5, "#e8d5f5", AN.bodyStroke, 1.8);

    // Arm
    animeRoundRect(ctx, levX - 4, levTopY, 8, levBaseY - levTopY + 12, 4, AN.leverBody, AN.bodyStroke, 2);

    // Base socket
    animeRoundRect(ctx, levX - 11, levBaseY + 7, 22, 14, 6, "#cc66aa", AN.bodyStroke, 2);

    // Star knob
    const knobCx = levX;
    const knobCy = levTopY - 10;
    const kSpikes = 5;
    const kOuter = 13;
    const kInner = 6;
    ctx.beginPath();
    for (let i = 0; i < kSpikes * 2; i++) {
      const kr = i % 2 === 0 ? kOuter : kInner;
      const ka = (i / (kSpikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(knobCx + Math.cos(ka) * kr, knobCy + Math.sin(ka) * kr);
      else ctx.lineTo(knobCx + Math.cos(ka) * kr, knobCy + Math.sin(ka) * kr);
    }
    ctx.closePath();
    ctx.fillStyle = AN.leverKnob;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Info strip ─────────────────────────────────────────────────────────
    const infoY = reelAreaY + reelAreaH + 12;
    animeRoundRect(ctx, mX + 14, infoY, mW - 28, 30, 8, "#fff0f8", AN.bodyStroke, 1.8);
    ctx.save();
    ctx.font = `700 10px "Impact", "Arial Black", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = AN.ink;
    ctx.fillText("目標:", mX + 26, infoY + 15);
    ctx.restore();
    drawGradeSymbol(ctx, resultGrade as Grade, mX + mW - 62, infoY + 15, 9);
    mangaText(ctx, resultGrade, mX + mW - 42, infoY + 15, 11, GRADE_COLOR[resultGrade as Grade] ?? AN.gradeA, AN.bodyStroke, 2.5);

    // ── PULL button ─────────────────────────────────────────────────────────
    const btnY = infoY + 44;
    const btnX = mX + 14;
    const btnW = mW - 28;
    const btnH = 40;
    const canInteract = state === "IDLE" || state === "RESULT";
    const btnFill = canInteract ? AN.bodyAccent : "rgba(255,136,187,0.4)";
    const btnLabel = state === "RESULT" ? "もう一度!" : "PULL!";

    animeRoundRect(ctx, btnX, btnY, btnW, btnH, 20, btnFill, AN.bodyStroke, 2.5);

    // Button shine
    if (canInteract) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.roundRect(btnX + 6, btnY + 5, btnW - 12, btnH / 2 - 4, [20, 20, 6, 6]);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.restore();
    }

    mangaText(ctx, btnLabel, btnX + btnW / 2, btnY + btnH / 2, 16, canInteract ? AN.white : "rgba(255,255,255,0.4)", AN.bodyStroke, 3);

    // ── Sparkle particles ──────────────────────────────────────────────────
    sparkles.current = sparkles.current.filter((s) => s.life > 0);
    for (const sp of sparkles.current) {
      const lt = sp.life / sp.maxLife;
      ctx.save();
      ctx.globalAlpha = lt * 0.9;
      ctx.translate(sp.x, sp.y);
      // Four-pointed sparkle shape
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

    // ── Result overlay ──────────────────────────────────────────────────────
    if (isResult && resultScale.current > 0) {
      const sc = resultScale.current;
      // Overshoot ease: 1.3 → 1.0
      const overshoot = sc < 0.6
        ? sc / 0.6 * 1.3
        : 1.3 - (sc - 0.6) / 0.4 * 0.3;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? AN.gradeA;

      ctx.save();
      ctx.translate(mX + mW / 2, reelAreaY + reelAreaH / 2 - 8);
      ctx.scale(overshoot, overshoot);
      ctx.globalAlpha = Math.min(sc * 2, 1);

      // Panel background
      animeRoundRect(ctx, -78, -56, 156, 112, 18, AN.white, AN.bodyStroke, 3);

      // Grade color header bar
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-78, -56, 156, 32, [18, 18, 0, 0]);
      ctx.fillStyle = gradeHex;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Jackpot: starburst lines behind panel
      if (isJackpot) {
        const burstAlpha = 0.6;
        ctx.save();
        ctx.globalAlpha = burstAlpha;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
          ctx.lineTo(Math.cos(a) * 95, Math.sin(a) * 95);
          ctx.strokeStyle = AN.sparkleA;
          ctx.lineWidth = 5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Grade symbol — large
      drawGradeSymbol(ctx, resultGrade as Grade, 0, 10, 26);

      // Grade text
      mangaText(ctx, resultGrade, 0, 38, 17, AN.ink, AN.bodyStroke, 3.5);

      // Prize name
      ctx.save();
      ctx.font = `600 9px "Hiragino Kaku Gothic ProN", "Arial", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#888";
      ctx.fillText(prizeName, 0, 52);
      ctx.restore();

      // Win text above panel
      if (isJackpot) {
        // Animated scale bounce on jackpot text
        const jackpotPulse = 1 + Math.abs(Math.sin(winPhase.current * Math.PI * 2)) * 0.18;
        ctx.save();
        ctx.scale(jackpotPulse, jackpotPulse);
        mangaText(ctx, "★ 大当たり ★", 0, -66, 24, AN.sparkleA, AN.bodyStroke, 6);
        ctx.restore();
        mangaText(ctx, "JACKPOT!!", 0, -88, 13, AN.white, "#aa4400", 3);
      } else {
        mangaText(ctx, "当たり!", 0, -62, 19, gradeHex, AN.bodyStroke, 4.5);
      }

      ctx.restore();
    }

    // ── Win phase float text "ドキドキ" ─────────────────────────────────────
    if (state === "SPINNING" && fc % 60 < 30) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(fc * 0.1)) * 0.25;
      ctx.font = `700 11px "Hiragino Kaku Gothic ProN", "Arial", sans-serif`;
      ctx.fillStyle = AN.gradeD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ドキドキ♥", mX + mW / 2, mY + 8);
      ctx.restore();
    }

    // ── Advance animation values ────────────────────────────────────────────
    if (isResult) {
      if (winPhase.current < 99) winPhase.current += dt / 380;
      if (resultScale.current < 1) resultScale.current = Math.min(1, resultScale.current + dt / 260);
    } else {
      winPhase.current = 0;
      resultScale.current = 0;
    }

    if (leverBounce.current > 0) {
      leverBounce.current += dt / 55;
      if (leverBounce.current > Math.PI * 2.5) leverBounce.current = 0;
    }

    if (leverPull.current > 0 && state !== "SPINNING") {
      leverPull.current = Math.max(0, leverPull.current - dt / 280);
    }

    // Update sparkle positions
    for (const sp of sparkles.current) {
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.06;
      sp.life = Math.max(0, sp.life - dt / (sp.maxLife * 1000));
    }

    // Animate petals
    for (const p of petals.current) {
      p.y += p.speed * dt / 16;
      if (p.y > H + 20) p.y = -20;
    }

    ctx.restore(); // end shake transform
  }, [resultGrade, prizeName, spawnSparkles]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;

    const state = stateRef.current;

    if (state === "SPINNING" || state === "STOPPING") {
      for (let r = 0; r < REEL_COUNT; r++) {
        if (reelLocked.current[r]) continue;
        const speed = reelSpeeds.current[r] ?? 0;
        reelOffsets.current[r] = (reelOffsets.current[r]! + speed * dt / 16) % (SYMBOL_STRIP.length * CELL_H);

        // Squash/stretch proportional to speed
        const targetScale = 1 + (speed / 5) * 0.12;
        reelScaleY.current[r] = reelScaleY.current[r]! + (targetScale - reelScaleY.current[r]!) * 0.15;
      }

      if (state === "STOPPING" && reelLocked.current.every((l) => l)) {
        changeState("RESULT");
        onResult?.(resultGrade);
      }
    } else {
      // Relax squash back to 1
      for (let r = 0; r < REEL_COUNT; r++) {
        reelScaleY.current[r] = (reelScaleY.current[r] ?? 1) + (1 - (reelScaleY.current[r] ?? 1)) * 0.18;
      }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, onResult, resultGrade]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Spin logic ─────────────────────────────────────────────────────────────
  const startSpin = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [5.5, 5.0, 4.5];
    reelLocked.current = [false, false, false];
    reelScaleY.current = [1, 1, 1];
    leverPull.current = 1;
    leverBounce.current = 0.1;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];
    changeState("SPINNING");

    const targetIdx = gradeIndex(resultGrade as Grade);

    [0, 1, 2].forEach((r) => {
      setTimeout(() => {
        const targetOffset = targetIdx * CELL_H + CELL_H;
        reelSpeeds.current[r] = 1.2;
        setTimeout(() => {
          reelOffsets.current[r] = (targetOffset % (SYMBOL_STRIP.length * CELL_H) + SYMBOL_STRIP.length * CELL_H) % (SYMBOL_STRIP.length * CELL_H);
          reelSpeeds.current[r] = 0;
          reelLocked.current[r] = true;
          // Pop scale on landing
          reelScaleY.current[r] = 1.18;
          if (r === REEL_COUNT - 1) {
            changeState("STOPPING");
            // Trigger sparkle burst and shake
            setTimeout(() => {
              const mX = 28, mY = 50, mW = 220;
              const reelAreaY2 = mY + 72;
              const reelAreaH2 = REEL_VISIBLE * CELL_H + 10;
              spawnSparkles(mX + mW / 2, reelAreaY2 + reelAreaH2 / 2, resultGrade === "A賞" ? 32 : 18);
              if (resultGrade === "A賞") {
                shakeTimer.current = 400;
              }
            }, 80);
          }
        }, 300);
      }, 600 + r * 480);
    });
  }, [resultGrade, changeState, spawnSparkles]);

  const reset = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [0, 0, 0];
    reelLocked.current = [false, false, false];
    reelScaleY.current = [1, 1, 1];
    leverPull.current = 0;
    leverBounce.current = 0;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];
    shakeTimer.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const mX = 28, mY = 50, mW = 220;
    const reelAreaY = mY + 72;
    const reelAreaH = REEL_VISIBLE * CELL_H + 10;
    const infoY = reelAreaY + reelAreaH + 12;
    const btnY = infoY + 44;
    const btnX = mX + 14;
    const btnW = mW - 28;
    const btnH = 40;
    const levX = mX + mW + 24;

    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;
    const onLever = Math.abs(nx - levX) <= 22 && ny >= 80 && ny <= 240;

    const state = stateRef.current;
    if ((onBtn || onLever) && state === "RESULT") reset();
    else if ((onBtn || onLever) && state === "IDLE") startSpin();
  }, [reset, startSpin]);

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
