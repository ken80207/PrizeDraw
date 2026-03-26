"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimeGachaGameState =
  | "IDLE"
  | "COIN_INSERT"
  | "TURNING"
  | "DISPENSING"
  | "BOUNCING"
  | "READY_TO_OPEN"
  | "OPENING"
  | "RESULT";

export interface GachaMachineAnimeProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: AnimeGachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas dimensions
// ─────────────────────────────────────────────────────────────────────────────

const W = 300;
const H = 480;

// Machine geometry
const MCX = W / 2;   // machine center X

// ─────────────────────────────────────────────────────────────────────────────
// Anime palette
// ─────────────────────────────────────────────────────────────────────────────

const AN = {
  bgTop:        "#ffd6e7",
  bgBottom:     "#cce5ff",
  body:         "#ffd6f5",
  bodyStroke:   "#222222",
  bodyAccent:   "#ff88bb",
  bodyAccent2:  "#88ccff",
  dome:         "rgba(200,240,255,0.30)",
  domeBorder:   "rgba(120,200,255,0.85)",
  domeShine:    "rgba(255,255,255,0.60)",
  capsuleTop:   "#ff88bb",
  capsuleBot:   "#88ccff",
  capsuleFace:  "#ffe8d6",
  handle:       "#ff88bb",
  handleKnob:   "#ffd700",
  handleStripe: ["#ff88bb", "#ffaacc", "#88ccff", "#aaddff", "#aaffcc"],
  slot:         "#ff6699",
  slotLabel:    "#ff88bb",
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
// Sparkle particles
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capsule inside dome — each has a tiny face
// ─────────────────────────────────────────────────────────────────────────────

interface DomeCapsule {
  x: number; y: number; angle: number; colorTop: string; colorBot: string;
}

const DOME_CAPSULES: DomeCapsule[] = [
  { x: MCX - 42, y: 148, angle:  0.2, colorTop: "#ff88bb", colorBot: "#88ccff" },
  { x: MCX + 8,  y: 132, angle: -0.15, colorTop: "#ffd700", colorBot: "#ff88bb" },
  { x: MCX - 14, y: 158, angle:  0.05, colorTop: "#88ccff", colorBot: "#88ddaa" },
  { x: MCX + 38, y: 152, angle:  0.3,  colorTop: "#aaddff", colorBot: "#ffccdd" },
  { x: MCX - 30, y: 172, angle: -0.1,  colorTop: "#ffeeaa", colorBot: "#ff88bb" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
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
    // O_O
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

/** Draw a cute two-tone capsule with a tiny face */
function drawCapsule(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  angle: number,
  topColor: string,
  botColor: string,
  alpha = 1,
  faceExpr: "dot" | "happy" | "surprised" = "dot",
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const hw = w / 2, hh = h / 2;
  const cr = hw; // cap radius

  // Bottom half
  ctx.beginPath();
  ctx.ellipse(0, hh - cr, hw, cr, 0, 0, Math.PI, false);
  ctx.rect(-hw, -hh * 0.1, w, hh - cr + hh * 0.1);
  ctx.fillStyle = botColor;
  ctx.fill();

  // Top half
  ctx.beginPath();
  ctx.ellipse(0, -(hh - cr), hw, cr, 0, Math.PI, 0, false);
  ctx.rect(-hw, -(hh - cr), w, hh * 0.8);
  ctx.fillStyle = topColor;
  ctx.fill();

  // Dividing line
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(hw, 0);
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Outline
  ctx.beginPath();
  ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
  ctx.strokeStyle = AN.bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Shine
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath();
  ctx.ellipse(-hw * 0.28, -hh * 0.45, hw * 0.22, hh * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = AN.white;
  ctx.fill();
  ctx.restore();

  // Face on capsule
  if (faceExpr === "dot") {
    for (const ex of [-hw * 0.22, hw * 0.22]) {
      ctx.beginPath();
      ctx.arc(ex, hh * 0.15, hw * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
    }
    // Tiny smile
    ctx.beginPath();
    ctx.arc(0, hh * 0.3, hw * 0.14, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (faceExpr === "happy") {
    for (const ex of [-hw * 0.22, hw * 0.22]) {
      ctx.beginPath();
      ctx.arc(ex, hh * 0.1, hw * 0.09, Math.PI * 0.1, Math.PI * 0.9);
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, hh * 0.3, hw * 0.16, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // surprised — O_O
    for (const ex of [-hw * 0.22, hw * 0.22]) {
      ctx.beginPath();
      ctx.arc(ex, hh * 0.1, hw * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, hh * 0.1, hw * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = AN.bodyStroke;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, hh * 0.32, hw * 0.09, 0, Math.PI * 2);
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine_Anime({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachineAnimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AnimeGachaGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<AnimeGachaGameState>("IDLE");

  const handleAngle = useRef(0);       // 0..1 turn progress
  const knobSparkleTrail = useRef<{ x: number; y: number; alpha: number }[]>([]);
  const capsuleY = useRef(0);          // dispensed capsule Y (0 = at chute top)
  const capsuleVY = useRef(0);
  const capsuleScaleY = useRef(1);     // squash/stretch
  const capsuleAngle = useRef(0);
  const capsuleBounces = useRef(0);
  const capsuleX = useRef(MCX);
  const openTop = useRef(0);           // 0..1 cap pop-off
  const coinY = useRef(0);             // coin animation Y
  const coinAlpha = useRef(0);
  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const winPhase = useRef(0);
  const resultScale = useRef(0);
  const shakeX = useRef(0);
  const shakeY = useRef(0);
  const shakeTimer = useRef(0);
  const sparkles = useRef<Sparkle[]>([]);
  const petals = useRef<Petal[]>(makePetals(14));

  const changeState = useCallback((s: AnimeGachaGameState) => {
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
    const isJackpot = isResult && resultGrade === "A賞";

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

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, AN.bgTop);
    grad.addColorStop(1, AN.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Win speed lines
    if (isResult && winPhase.current > 0) {
      const lineAlpha = Math.abs(Math.sin(winPhase.current * Math.PI * 1.5)) * (isJackpot ? 0.65 : 0.42);
      drawSpeedLines(ctx, W / 2, H / 2, 55, W * 0.88, 22, lineAlpha);
    }

    // Cherry blossoms
    for (const petal of petals.current) {
      const t = fc * 0.012;
      const px = petal.x + Math.sin(t * petal.drift + petal.phase) * 18;
      const pa = 0.5 + Math.sin(t * 0.7 + petal.phase) * 0.2;
      drawPetal(ctx, px, petal.y, petal.size, petal.rotation + fc * petal.rotSpeed, pa);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Machine body
    // ─────────────────────────────────────────────────────────────────────────

    const bodyTopY = 195;
    const bodyBotY = 405;
    const bodyW = 190;
    const bodyX = MCX - bodyW / 2;
    const bodyH = bodyBotY - bodyTopY;
    const bodyR = 28;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.roundRect(bodyX + 5, bodyTopY + 8, bodyW, bodyH, bodyR);
    ctx.fillStyle = "#aa44aa";
    ctx.fill();
    ctx.restore();

    // Body
    animeRoundRect(ctx, bodyX, bodyTopY, bodyW, bodyH, bodyR, AN.body, AN.bodyStroke, 3);

    // Candy accent strip at top of body
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyTopY, bodyW, 46, [bodyR, bodyR, 0, 0]);
    ctx.fillStyle = AN.bodyAccent;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Candy stripes
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyTopY, bodyW, 46, [bodyR, bodyR, 0, 0]);
    ctx.clip();
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 8; i++) {
      const sx = bodyX + i * 28 - 10;
      ctx.beginPath();
      ctx.moveTo(sx, bodyTopY);
      ctx.lineTo(sx + 18, bodyTopY + 46);
      ctx.strokeStyle = AN.white;
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    ctx.restore();

    // Chibi face on body (expression changes)
    const faceExpr = state === "OPENING" || state === "RESULT"
      ? (isJackpot ? "excited" : "surprised")
      : (state === "TURNING" || state === "DISPENSING" || state === "BOUNCING" ? "surprised" : "happy");
    drawChibiFace(ctx, MCX, bodyTopY + 26, 18, faceExpr as "happy" | "excited" | "surprised");

    // ─────────────────────────────────────────────────────────────────────────
    // Dome (crystal ball with capsules inside)
    // ─────────────────────────────────────────────────────────────────────────

    const domeCX = MCX;
    const domeCY = 138;
    const domeRX = 88;
    const domeRY = 82;

    // Dome shadow
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.ellipse(domeCX + 4, domeCY + 6, domeRX, domeRY, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#002266";
    ctx.fill();
    ctx.restore();

    // Dome body
    ctx.beginPath();
    ctx.ellipse(domeCX, domeCY, domeRX, domeRY, 0, 0, Math.PI * 2);
    ctx.fillStyle = AN.dome;
    ctx.fill();
    ctx.strokeStyle = AN.domeBorder;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Dome collar (connects dome to machine body)
    animeRoundRect(ctx, MCX - 78, bodyTopY - 6, 156, 18, 8, "#ffccee", AN.bodyStroke, 2);

    // Capsules inside dome
    for (const cap of DOME_CAPSULES) {
      drawCapsule(ctx, cap.x, cap.y, 22, 30, cap.angle, cap.colorTop, cap.colorBot, 0.85, "dot");
    }

    // Dome crystal sparkle reflections
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(domeCX, domeCY, domeRX, domeRY, 0, 0, Math.PI * 2);
    ctx.clip();
    // Main shine gradient
    const domeShineGrad = ctx.createRadialGradient(
      domeCX - domeRX * 0.35, domeCY - domeRY * 0.42, 0,
      domeCX, domeCY, domeRX * 1.1,
    );
    domeShineGrad.addColorStop(0, "rgba(255,255,255,0.38)");
    domeShineGrad.addColorStop(0.35, "rgba(255,255,255,0.06)");
    domeShineGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = domeShineGrad;
    ctx.fillRect(domeCX - domeRX, domeCY - domeRY, domeRX * 2, domeRY * 2);
    // Glint stars
    const glintAlpha = 0.5 + Math.sin(fc * 0.055) * 0.2;
    for (const [gx, gy, gs] of [
      [domeCX - 52, domeCY - 44, 7],
      [domeCX - 24, domeCY - 60, 5],
      [domeCX + 44, domeCY - 35, 6],
    ] as [number, number, number][]) {
      ctx.save();
      ctx.globalAlpha = glintAlpha;
      for (const [dx, dy] of [[0, -gs], [gs, 0], [0, gs], [-gs, 0]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + dx, gy + dy);
        ctx.strokeStyle = AN.white;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // ─────────────────────────────────────────────────────────────────────────
    // Handle (star-topped knob, rainbow arm)
    // ─────────────────────────────────────────────────────────────────────────

    const handlePivotX = bodyX + bodyW + 4;
    const handlePivotY = bodyTopY + 68;
    const handleArmLen = 46;
    // Pull angle: 0 = up-right rest, turns clockwise during TURNING
    const handlePullAngle = -0.35 + handleAngle.current * 1.6;
    const knobX = handlePivotX + Math.cos(handlePullAngle) * handleArmLen;
    const knobY = handlePivotY + Math.sin(handlePullAngle) * handleArmLen;

    // Rainbow arm (striped)
    ctx.save();
    ctx.translate(handlePivotX, handlePivotY);
    ctx.rotate(handlePullAngle);
    const stripeW = handleArmLen / AN.handleStripe.length;
    for (let i = 0; i < AN.handleStripe.length; i++) {
      animeRoundRect(
        ctx,
        i * stripeW, -5,
        stripeW + 1, 10,
        i === 0 ? [5, 0, 0, 5] : i === AN.handleStripe.length - 1 ? [0, 5, 5, 0] : 0,
        AN.handleStripe[i]!,
        AN.bodyStroke,
        1.5,
      );
    }
    ctx.restore();

    // Knob sparkle trail during turning
    if (state === "TURNING") {
      const trail = knobSparkleTrail.current;
      trail.push({ x: knobX, y: knobY, alpha: 0.7 });
      if (trail.length > 12) trail.shift();
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i]!;
        ctx.save();
        ctx.globalAlpha = t.alpha * (i / trail.length);
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3 + (i / trail.length) * 3, 0, Math.PI * 2);
        ctx.fillStyle = AN.sparkleA;
        ctx.fill();
        ctx.restore();
      }
    } else {
      knobSparkleTrail.current = [];
    }

    // Handle pivot socket
    animeRoundRect(ctx, handlePivotX - 8, handlePivotY - 8, 16, 16, 5, "#cc66aa", AN.bodyStroke, 2);

    // Star-topped knob
    const kSpikes = 5;
    const kOuter = 13;
    const kInner = 5.5;
    ctx.beginPath();
    for (let i = 0; i < kSpikes * 2; i++) {
      const kr = i % 2 === 0 ? kOuter : kInner;
      const ka = (i / (kSpikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(knobX + Math.cos(ka) * kr, knobY + Math.sin(ka) * kr);
      else ctx.lineTo(knobX + Math.cos(ka) * kr, knobY + Math.sin(ka) * kr);
    }
    ctx.closePath();
    ctx.fillStyle = AN.handleKnob;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ─────────────────────────────────────────────────────────────────────────
    // Coin slot (heart-shaped with ♥ label)
    // ─────────────────────────────────────────────────────────────────────────

    const slotX = MCX - 22;
    const slotY = bodyTopY + 60;
    const slotW = 44;
    const slotH = 18;

    // Slot surround
    animeRoundRect(ctx, slotX - 4, slotY - 4, slotW + 8, slotH + 8, 10, "#ffccee", AN.bodyStroke, 2);

    // Heart-shaped slot opening
    ctx.save();
    ctx.translate(MCX, slotY + slotH / 2);
    const hs = 7;
    ctx.beginPath();
    ctx.moveTo(0, hs * 0.5);
    ctx.bezierCurveTo(-hs, -hs * 0.35, -hs, -hs, 0, -hs * 0.35);
    ctx.bezierCurveTo(hs, -hs, hs, -hs * 0.35, 0, hs * 0.5);
    ctx.fillStyle = AN.slot;
    ctx.fill();
    ctx.strokeStyle = AN.bodyStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // "♥" label
    ctx.save();
    ctx.font = `700 9px "Hiragino Kaku Gothic ProN","Arial",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = AN.slot;
    ctx.fillText("♥ コインを入れてね", MCX, slotY + slotH + 10);
    ctx.restore();

    // Coin animation during COIN_INSERT
    if (state === "COIN_INSERT" && coinAlpha.current > 0) {
      ctx.save();
      ctx.globalAlpha = coinAlpha.current;
      ctx.beginPath();
      ctx.arc(MCX, coinY.current, 8, 0, Math.PI * 2);
      ctx.fillStyle = AN.handleKnob;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Coin shine
      ctx.save();
      ctx.globalAlpha = coinAlpha.current * 0.5;
      ctx.beginPath();
      ctx.arc(MCX - 2, coinY.current - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Chute / exit slot
    // ─────────────────────────────────────────────────────────────────────────

    const chuteX = bodyX + bodyW * 0.22;
    const chuteW = bodyW * 0.56;
    const chuteTop = bodyBotY - 52;
    const chuteH = 50;

    animeRoundRect(ctx, chuteX, chuteTop, chuteW, chuteH, 10, "#fff0fb", AN.bodyStroke, 2);
    // Chute label
    ctx.save();
    ctx.font = `700 9px "Hiragino Kaku Gothic ProN","Arial",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = AN.bodyAccent;
    ctx.fillText("カプセル出口", chuteX + chuteW / 2, chuteTop + chuteH / 2);
    ctx.restore();

    // ─────────────────────────────────────────────────────────────────────────
    // PULL button at bottom
    // ─────────────────────────────────────────────────────────────────────────

    const btnX = bodyX + 14;
    const btnY = bodyBotY + 16;
    const btnW = bodyW - 28;
    const btnH = 40;
    const canInteract = state === "IDLE" || state === "RESULT";
    const btnFill = canInteract ? AN.bodyAccent : "rgba(255,136,187,0.4)";
    const btnLabel = state === "RESULT" ? "もう一度!" : "ガチャ!";

    animeRoundRect(ctx, btnX, btnY, btnW, btnH, 20, btnFill, AN.bodyStroke, 2.5);
    if (canInteract) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.roundRect(btnX + 6, btnY + 5, btnW - 12, btnH / 2 - 4, [20, 20, 6, 6]);
      ctx.fillStyle = AN.white;
      ctx.fill();
      ctx.restore();
    }
    mangaText(ctx, btnLabel, btnX + btnW / 2, btnY + btnH / 2, 15, canInteract ? AN.white : "rgba(255,255,255,0.4)", AN.bodyStroke, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // Dispensed capsule (bouncing / ready to open)
    // ─────────────────────────────────────────────────────────────────────────

    if (state === "DISPENSING" || state === "BOUNCING" || state === "READY_TO_OPEN" || state === "OPENING") {
      const gradeHex = GRADE_COLOR[resultGrade] ?? AN.gradeA;
      const capCY = chuteTop + 28 + capsuleY.current;
      const capFaceExpr = state === "OPENING" ? "surprised" : state === "BOUNCING" ? "happy" : "dot";

      ctx.save();
      ctx.translate(capsuleX.current, capCY);
      ctx.scale(1, capsuleScaleY.current);
      ctx.translate(-capsuleX.current, -capCY);

      if (state === "OPENING" && openTop.current > 0.1) {
        // Pop top half off
        const topOffset = -openTop.current * 28;
        const topAlpha = 1 - openTop.current * 0.5;
        // Draw bottom half
        ctx.save();
        ctx.translate(capsuleX.current, capCY);
        ctx.rotate(capsuleAngle.current);
        // Bottom portion
        ctx.beginPath();
        ctx.ellipse(0, 8, 14, 8, 0, 0, Math.PI, false);
        ctx.rect(-14, 0, 28, 8);
        ctx.fillStyle = AN.capsuleBot;
        ctx.fill();
        ctx.strokeStyle = AN.bodyStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Top portion floating away
        ctx.save();
        ctx.globalAlpha = topAlpha;
        ctx.translate(capsuleX.current + openTop.current * 8, capCY + topOffset);
        ctx.rotate(capsuleAngle.current + openTop.current * 0.8);
        ctx.beginPath();
        ctx.ellipse(0, -8, 14, 8, 0, Math.PI, 0, false);
        ctx.rect(-14, -8, 28, 8);
        ctx.fillStyle = gradeHex;
        ctx.fill();
        ctx.strokeStyle = AN.bodyStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
        // "パカッ！" pop text
        mangaText(ctx, "パカッ！", 0, -22, 11, AN.white, AN.bodyStroke, 2.8);
        ctx.restore();

        // Sparkle burst from opening
        if (openTop.current > 0.3 && openTop.current < 0.6) {
          spawnSparkles(capsuleX.current, capCY, 3);
        }
      } else {
        // Intact capsule
        drawCapsule(
          ctx, capsuleX.current, capCY,
          28, 40, capsuleAngle.current,
          gradeHex, AN.capsuleBot,
          1, capFaceExpr as "dot" | "happy" | "surprised",
        );
      }
      ctx.restore();

      // Manga motion lines below bouncing capsule
      if (state === "BOUNCING" && capsuleVY.current < 0) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(capsuleX.current + i * 8, capCY + 24);
          ctx.lineTo(capsuleX.current + i * 8, capCY + 38);
          ctx.strokeStyle = AN.bodyStroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sparkle particles
    // ─────────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────────
    // Result overlay
    // ─────────────────────────────────────────────────────────────────────────

    if (isResult && resultScale.current > 0) {
      const sc = resultScale.current;
      const overshoot = sc < 0.6 ? sc / 0.6 * 1.3 : 1.3 - (sc - 0.6) / 0.4 * 0.3;
      const gradeHex = GRADE_COLOR[resultGrade] ?? AN.gradeA;

      ctx.save();
      ctx.translate(W / 2, H / 2 - 18);
      ctx.scale(overshoot, overshoot);
      ctx.globalAlpha = Math.min(sc * 2, 1);

      // Manga panel frame
      animeRoundRect(ctx, -82, -62, 164, 124, 20, AN.white, AN.bodyStroke, 3);

      // Header
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-82, -62, 164, 34, [20, 20, 0, 0]);
      ctx.fillStyle = gradeHex;
      ctx.fill();
      ctx.strokeStyle = AN.bodyStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // Jackpot starburst
      if (isJackpot) {
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

      // Result capsule in panel
      const gradeClr = GRADE_COLOR[resultGrade] ?? AN.gradeA;
      drawCapsule(ctx, 0, 12, 30, 42, 0, gradeClr, AN.capsuleBot, 1, "happy");

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

      // おめでとう text
      mangaText(ctx, "おめでとう！", 0, -76, 14, gradeHex, AN.bodyStroke, 3.5);
      if (isJackpot) {
        mangaText(ctx, "★ 大当たり ★", 0, -92, 10, AN.white, "#aa4400", 2.5);
      }

      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // "ドキドキ♥" anticipation text during TURNING / DISPENSING
    // ─────────────────────────────────────────────────────────────────────────

    if ((state === "TURNING" || state === "DISPENSING") && fc % 70 < 35) {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.abs(Math.sin(fc * 0.1)) * 0.28;
      ctx.font = `700 12px "Hiragino Kaku Gothic ProN","Arial",sans-serif`;
      ctx.fillStyle = AN.gradeD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ドキドキ♥", W / 2, 20);
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

    // Sparkle physics
    for (const sp of sparkles.current) {
      sp.x += sp.vx; sp.y += sp.vy;
      sp.vy += 0.06;
      sp.life = Math.max(0, sp.life - dt / (sp.maxLife * 1000));
    }

    // Petal fall
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

    if (state === "TURNING") {
      handleAngle.current = Math.min(1, handleAngle.current + dt / 600);
    } else if (state !== "OPENING" && state !== "RESULT") {
      // Relax handle back
      if (handleAngle.current > 0) {
        handleAngle.current = Math.max(0, handleAngle.current - dt / 400);
      }
    }

    if (state === "COIN_INSERT") {
      coinY.current += dt / 10;
      coinAlpha.current = Math.max(0, 1 - (coinY.current - 80) / 30);
    }

    if (state === "DISPENSING") {
      capsuleY.current += capsuleVY.current * dt / 16;
      capsuleVY.current += 0.5;
      capsuleAngle.current += 0.03 * dt / 16;
      capsuleScaleY.current = 1 + Math.sin(capsuleVY.current * 0.3) * 0.06;

      // Arrived at chute floor
      if (capsuleY.current >= 0) {
        capsuleY.current = 0;
        capsuleVY.current = -capsuleVY.current * 0.55;
        capsuleScaleY.current = 0.72; // squash on landing
        spawnSparkles(capsuleX.current, 420, 6);
        if (Math.abs(capsuleVY.current) < 0.8) {
          capsuleVY.current = 0;
          capsuleScaleY.current = 1;
          changeState("BOUNCING");
        }
      }
    }

    if (state === "BOUNCING") {
      capsuleScaleY.current += (1 - capsuleScaleY.current) * 0.18;
      capsuleAngle.current += 0.01 * dt / 16;
    }

    if (state === "OPENING") {
      openTop.current = Math.min(1, openTop.current + dt / 600);
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, spawnSparkles]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [animate]);

  // ── Gacha sequence ─────────────────────────────────────────────────────────
  const startGacha = useCallback(() => {
    handleAngle.current = 0;
    openTop.current = 0;
    capsuleY.current = -60;
    capsuleVY.current = 0;
    capsuleScaleY.current = 1;
    capsuleAngle.current = 0;
    capsuleBounces.current = 0;
    capsuleX.current = MCX;
    coinY.current = 80;
    coinAlpha.current = 1;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];

    // 1. Insert coin
    changeState("COIN_INSERT");

    setTimeout(() => {
      // 2. Turn handle
      handleAngle.current = 0;
      changeState("TURNING");

      setTimeout(() => {
        // 3. Dispense
        capsuleVY.current = 2;
        changeState("DISPENSING");

        setTimeout(() => {
          // 4. Bounce (already transitions in animate loop when velocity near zero)
          // Ensure we reach BOUNCING
          changeState("BOUNCING");
          capsuleScaleY.current = 1;

          setTimeout(() => {
            // 5. Ready to open
            changeState("READY_TO_OPEN");

            setTimeout(() => {
              // 6. Open with パカッ！
              openTop.current = 0;
              changeState("OPENING");
              spawnSparkles(MCX, 400, 16);
              if (resultGrade === "A賞") shakeTimer.current = 350;

              setTimeout(() => {
                // 7. Result
                changeState("RESULT");
                onResult?.(resultGrade);
              }, 900);
            }, 500);
          }, 800);
        }, 900);
      }, 800);
    }, 500);
  }, [resultGrade, changeState, spawnSparkles, onResult]);

  const reset = useCallback(() => {
    handleAngle.current = 0;
    openTop.current = 0;
    capsuleY.current = -60;
    capsuleVY.current = 0;
    capsuleScaleY.current = 1;
    capsuleAngle.current = 0;
    winPhase.current = 0;
    resultScale.current = 0;
    sparkles.current = [];
    shakeTimer.current = 0;
    knobSparkleTrail.current = [];
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (state === "IDLE") startGacha();
    else if (state === "RESULT") reset();
  }, [startGacha, reset]);

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
