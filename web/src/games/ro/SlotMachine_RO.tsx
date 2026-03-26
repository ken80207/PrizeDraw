"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ROSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineROProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ROSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// RO colour palette — warm fantasy, soft watercolor-ish tones
// ─────────────────────────────────────────────────────────────────────────────

const RO = {
  // Background: sky-like soft blue-green field
  bgTop:        "#b8d4e8",
  bgBot:        "#d4e8c8",
  // Machine body — wood + stone
  body:         "#c8a878",
  bodyDark:     "#a07850",
  bodyStroke:   "#3a2010",
  metalAccent:  "#d4a840",
  metalDark:    "#a07820",
  // Reel panel
  reelPanel:    "#f5ead8",
  reelBorder:   "#8b6040",
  reelBg:       "#fff8ee",
  reelShine:    "rgba(255,255,255,0.4)",
  // Grade item colours
  gradeA:       "#f5c518",   // golden card
  gradeB:       "#5599ee",   // blue gemstone
  gradeC:       "#44aa55",   // green herb
  gradeD:       "#ff88aa",   // pink poring
  // Text
  ink:          "#2a1500",
  sysText:      "#ffee44",   // RO yellow system text
  white:        "#ffffff",
  // Poring mascot
  poringPink:   "#ffaabb",
  poringEye:    "#2a1500",
  poringBlush:  "#ff7799",
  poringLight:  "#ffd0dd",
  // Drop effect
  lightPillarA: "rgba(255,220,100,0.7)",
  lightPillarB: "rgba(120,180,255,0.6)",
  lightPillarC: "rgba(100,220,120,0.5)",
  lightPillarD: "rgba(255,255,255,0.4)",
  // Stone floor
  stoneA:       "#b8a898",
  stoneB:       "#a89888",
  stoneLine:    "#887868",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grades & symbols
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const GRADE_COLOR: Record<Grade, string> = {
  "A賞": RO.gradeA,
  "B賞": RO.gradeB,
  "C賞": RO.gradeC,
  "D賞": RO.gradeD,
};

const GRADE_PILLAR: Record<Grade, string> = {
  "A賞": RO.lightPillarA,
  "B賞": RO.lightPillarB,
  "C賞": RO.lightPillarC,
  "D賞": RO.lightPillarD,
};

const GRADE_LABEL: Record<Grade, string> = {
  "A賞": "Card",
  "B賞": "Gemstone",
  "C賞": "Green Herb",
  "D賞": "Poring",
};

const GRADE_DMG: Record<Grade, string> = {
  "A賞": "9999999!",
  "B賞": "Hit! 5000",
  "C賞": "Hit! 1000",
  "D賞": "Miss...",
};

const GRADE_DMG_COLOR: Record<Grade, string> = {
  "A賞": "#ffd700",
  "B賞": "#88bbff",
  "C賞": "#88ee99",
  "D賞": "#aaaaaa",
};

// Reel strip — cycles of grades
const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "D賞", "C賞", "B賞",
  "B賞", "A賞", "D賞", "C賞",
];

const REEL_COUNT = 3;
const CELL_H = 72;
const REEL_VISIBLE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Poring bounce data
// ─────────────────────────────────────────────────────────────────────────────

interface Poring {
  x: number;
  y: number;
  baseY: number;
  phase: number;
  bounceAmp: number;
  bounceSpeed: number;
  size: number;
  variety: Grade;  // which grade Poring this is
  excited: boolean;
  eyeType: "normal" | "excited" | "sleepy";
}

function makePortings(): Poring[] {
  const varieties: Grade[] = ["D賞", "C賞", "B賞", "A賞"];
  return [0, 1, 2, 3].map((i) => ({
    x: 50 + i * 60,
    y: 0,
    baseY: 60,
    phase: i * 1.2,
    bounceAmp: 6 + i * 2,
    bounceSpeed: 0.04 + i * 0.01,
    size: 18 + i * 2,
    variety: varieties[i]!,
    excited: false,
    eyeType: "normal",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating damage number
// ─────────────────────────────────────────────────────────────────────────────

interface DamageNum {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  isCrit: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function roRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string,
  stroke: string = RO.bodyStroke,
  lw = 1.5,
): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function roRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: string,
  stroke: string = RO.bodyStroke,
  lw = 1.5,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** Draw a classic RO-style card (A grade icon) */
function drawCardSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const hw = size * 0.38;
  const hh = size * 0.5;
  // Card body
  ctx.beginPath();
  ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, 4);
  ctx.fillStyle = "#fff8dd";
  ctx.fill();
  ctx.strokeStyle = RO.gradeA;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner border
  ctx.beginPath();
  ctx.roundRect(cx - hw + 3, cy - hh + 3, hw * 2 - 6, hh * 2 - 6, 2);
  ctx.strokeStyle = RO.gradeA;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Star in center
  ctx.save();
  ctx.translate(cx, cy);
  const spikes = 5;
  const outerR = size * 0.22;
  const innerR = size * 0.1;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = RO.gradeA;
  ctx.fill();
  ctx.restore();
  // "MVP" text at bottom
  ctx.font = `bold ${size * 0.14}px sans-serif`;
  ctx.fillStyle = RO.gradeA;
  ctx.textAlign = "center";
  ctx.fillText("MVP", cx, cy + hh - 5);
  ctx.restore();
}

/** Draw a blue gemstone (B grade icon) */
function drawGemSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const d = size * 0.42;
  // Gem shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d * 0.7, cy - d * 0.25);
  ctx.lineTo(cx + d * 0.7, cy + d * 0.15);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d * 0.7, cy + d * 0.15);
  ctx.lineTo(cx - d * 0.7, cy - d * 0.25);
  ctx.closePath();
  const grd = ctx.createLinearGradient(cx - d, cy - d, cx + d, cy + d);
  grd.addColorStop(0, "#88ccff");
  grd.addColorStop(0.5, RO.gradeB);
  grd.addColorStop(1, "#2244aa");
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = "#1133aa";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Shine
  ctx.beginPath();
  ctx.moveTo(cx - d * 0.2, cy - d * 0.6);
  ctx.lineTo(cx + d * 0.1, cy - d * 0.3);
  ctx.lineTo(cx - d * 0.05, cy - d * 0.15);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();
  ctx.restore();
}

/** Draw a green herb (C grade icon) */
function drawHerbSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Stem
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.45);
  ctx.bezierCurveTo(cx, cy + size * 0.1, cx - size * 0.25, cy - size * 0.1, cx - size * 0.1, cy - size * 0.3);
  ctx.strokeStyle = "#336633";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();
  // Leaves
  const leafPairs = [
    { ox: -0.15, oy: 0.1, angle: -0.5 },
    { ox: 0.2, oy: -0.1, angle: 0.6 },
    { ox: -0.05, oy: -0.28, angle: -0.3 },
  ];
  for (const lp of leafPairs) {
    ctx.save();
    ctx.translate(cx + lp.ox * size, cy + lp.oy * size);
    ctx.rotate(lp.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.22, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = RO.gradeC;
    ctx.fill();
    ctx.strokeStyle = "#226622";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Draw a Poring (D grade icon) */
function drawPoringSymbol(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  alpha = 1,
  eyeType: "normal" | "excited" | "sleepy" = "normal",
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Body
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.08, size * 0.42, size * 0.38, 0, 0, Math.PI * 2);
  const bodyGrd = ctx.createRadialGradient(cx - size * 0.1, cy - size * 0.05, size * 0.05, cx, cy, size * 0.42);
  bodyGrd.addColorStop(0, RO.poringLight);
  bodyGrd.addColorStop(0.6, RO.poringPink);
  bodyGrd.addColorStop(1, "#ee6688");
  ctx.fillStyle = bodyGrd;
  ctx.fill();
  ctx.strokeStyle = RO.bodyStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Blush cheeks
  ctx.globalAlpha = alpha * 0.5;
  ctx.beginPath();
  ctx.ellipse(cx - size * 0.2, cy + size * 0.12, size * 0.09, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = RO.poringBlush;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + size * 0.2, cy + size * 0.12, size * 0.09, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = RO.poringBlush;
  ctx.fill();
  ctx.globalAlpha = alpha;
  // Eyes
  const eyeY = cy - size * 0.04;
  const eyeOffX = size * 0.13;
  if (eyeType === "excited") {
    // ">_<" style — curved lines
    for (const ex of [-eyeOffX, eyeOffX]) {
      ctx.beginPath();
      ctx.arc(cx + ex, eyeY, size * 0.075, Math.PI * 0.1, Math.PI * 0.9);
      ctx.strokeStyle = RO.poringEye;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (eyeType === "sleepy") {
    // Half-closed eyes
    for (const ex of [-eyeOffX, eyeOffX]) {
      ctx.beginPath();
      ctx.arc(cx + ex, eyeY, size * 0.065, Math.PI, Math.PI * 2);
      ctx.strokeStyle = RO.poringEye;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // "z" above head
    ctx.font = `bold ${size * 0.22}px sans-serif`;
    ctx.fillStyle = RO.poringEye;
    ctx.textAlign = "center";
    ctx.fillText("z", cx + size * 0.35, cy - size * 0.42);
  } else {
    // Normal dot eyes
    for (const ex of [-eyeOffX, eyeOffX]) {
      ctx.beginPath();
      ctx.arc(cx + ex, eyeY, size * 0.065, 0, Math.PI * 2);
      ctx.fillStyle = RO.poringEye;
      ctx.fill();
      // Eye shine
      ctx.beginPath();
      ctx.arc(cx + ex - size * 0.025, eyeY - size * 0.025, size * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  }
  // Mouth
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.15, size * 0.08, 0, Math.PI);
  ctx.strokeStyle = RO.poringEye;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Antennae
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.08, cy - size * 0.38);
  ctx.bezierCurveTo(cx - size * 0.15, cy - size * 0.55, cx - size * 0.22, cy - size * 0.58, cx - size * 0.2, cy - size * 0.65);
  ctx.strokeStyle = RO.bodyStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - size * 0.2, cy - size * 0.65, size * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = RO.poringPink;
  ctx.fill();
  ctx.strokeStyle = RO.bodyStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Draw a grade symbol based on grade type */
function drawGradeSymbol(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
  alpha = 1,
): void {
  if (grade === "A賞") drawCardSymbol(ctx, cx, cy, size, alpha);
  else if (grade === "B賞") drawGemSymbol(ctx, cx, cy, size, alpha);
  else if (grade === "C賞") drawHerbSymbol(ctx, cx, cy, size, alpha);
  else drawPoringSymbol(ctx, cx, cy, size, alpha);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_RO({
  resultGrade,
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineROProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ROSlotGameState>("IDLE");

  // Reel animation state
  const reelsRef = useRef<number[]>([0, 0, 0]); // scroll offsets (px)
  const reelSpeedsRef = useRef<number[]>([0, 0, 0]);
  const reelTargetsRef = useRef<(number | null)[]>([null, null, null]);
  const reelStoppedRef = useRef<boolean[]>([false, false, false]);

  // Poring state
  const poringsRef = useRef<Poring[]>(makePortings());
  const poringsExcitedRef = useRef(false);

  // Damage numbers
  const dmgNumsRef = useRef<DamageNum[]>([]);

  // Light pillar
  const pillarRef = useRef<{ grade: Grade; life: number; maxLife: number } | null>(null);

  // System message
  const sysMsgRef = useRef<{ text: string; life: number; maxLife: number } | null>(null);

  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<ROSlotGameState>("IDLE");
  const resultGradeRef = useRef<Grade>("D賞");

  const setAndEmitState = useCallback((s: ROSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // Normalise resultGrade to a valid Grade
  const resolvedGrade = useCallback((): Grade => {
    if (resultGrade && GRADES.includes(resultGrade as Grade)) return resultGrade as Grade;
    const rand = Math.random();
    if (rand < 0.05) return "A賞";
    if (rand < 0.25) return "B賞";
    if (rand < 0.60) return "C賞";
    return "D賞";
  }, [resultGrade]);

  const spawnDamageNum = useCallback((grade: Grade) => {
    const text = GRADE_DMG[grade];
    const color = GRADE_DMG_COLOR[grade];
    const isCrit = grade === "A賞";
    dmgNumsRef.current.push({
      x: W / 2 + (Math.random() - 0.5) * 60,
      y: H * 0.35,
      vy: -1.8 - Math.random() * 0.8,
      text,
      color,
      life: 100,
      maxLife: 100,
      size: isCrit ? 22 : 15,
      isCrit,
    });
  }, []);

  const startSpin = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    const grade = resolvedGrade();
    resultGradeRef.current = grade;
    setAndEmitState("SPINNING");
    reelsRef.current = [0, 0, 0];
    reelSpeedsRef.current = [14, 14, 14];
    reelTargetsRef.current = [null, null, null];
    reelStoppedRef.current = [false, false, false];
    poringsExcitedRef.current = true;
    poringsRef.current.forEach((p) => { p.excited = true; p.eyeType = "excited"; });
    pillarRef.current = null;
    sysMsgRef.current = null;
    dmgNumsRef.current = [];
  }, [resolvedGrade, setAndEmitState]);

  // Stop reels one by one after spin
  useEffect(() => {
    if (gameState !== "SPINNING") return;
    const grade = resultGradeRef.current;
    // Find symbol index for result grade
    const gradIdx = SYMBOL_STRIP.findIndex((g) => g === grade);
    const targetOffset = gradIdx >= 0 ? gradIdx * CELL_H : 0;

    const stopTimers = [1200, 2100, 2900].map((delay, reelIdx) =>
      setTimeout(() => {
        reelTargetsRef.current[reelIdx] = targetOffset + reelIdx * CELL_H * 2;
        if (reelIdx === 2) setAndEmitState("STOPPING");
      }, delay),
    );
    return () => stopTimers.forEach(clearTimeout);
  }, [gameState, setAndEmitState]);

  // Detect all reels stopped
  useEffect(() => {
    if (gameState !== "STOPPING") return;
    const check = setInterval(() => {
      if (reelStoppedRef.current.every(Boolean)) {
        clearInterval(check);
        const grade = resultGradeRef.current;
        setAndEmitState("RESULT");
        onResult?.(grade);
        // Show light pillar
        pillarRef.current = { grade, life: 120, maxLife: 120 };
        // System message
        sysMsgRef.current = {
          text: `[系統] 恭喜獲得 ${grade}！（${GRADE_LABEL[grade]}）`,
          life: 240,
          maxLife: 240,
        };
        // Damage number
        setTimeout(() => spawnDamageNum(grade), 400);
        // Reset Porings to happy
        poringsExcitedRef.current = false;
        poringsRef.current.forEach((p) => {
          p.excited = false;
          p.eyeType = grade === "A賞" ? "excited" : "normal";
        });
      }
    }, 80);
    return () => clearInterval(check);
  }, [gameState, setAndEmitState, onResult, spawnDamageNum]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      tickRef.current += 1;
      const t = tickRef.current;

      ctx.clearRect(0, 0, W, H);

      // ── Background: RO field/town scene ─────────────────────────────────
      const bgGrd = ctx.createLinearGradient(0, 0, 0, H);
      bgGrd.addColorStop(0, RO.bgTop);
      bgGrd.addColorStop(1, RO.bgBot);
      ctx.fillStyle = bgGrd;
      ctx.fillRect(0, 0, W, H);

      // Distant trees / scenery
      for (let i = 0; i < 6; i++) {
        const tx = 20 + i * 50;
        const ty = H * 0.38;
        const tr = 14 + (i % 3) * 6;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "#88bb66" : "#66aa44";
        ctx.fill();
        ctx.strokeStyle = "#447733";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Trunk
        ctx.beginPath();
        ctx.rect(tx - 3, ty + tr - 2, 6, 10);
        ctx.fillStyle = "#886644";
        ctx.fill();
      }

      // Stone floor
      const floorY = H * 0.48;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          const sx = col * 44 - (row % 2 === 0 ? 0 : 22);
          const sy = floorY + row * 16;
          ctx.fillStyle = row % 2 === 0 && col % 2 === 0 ? RO.stoneA : RO.stoneB;
          ctx.fillRect(sx, sy, 42, 14);
          ctx.strokeStyle = RO.stoneLine;
          ctx.lineWidth = 0.6;
          ctx.strokeRect(sx, sy, 42, 14);
        }
      }

      // ── Machine body ─────────────────────────────────────────────────────
      const machX = W / 2 - 100;
      const machY = H * 0.48;
      const machW = 200;
      const machH = H * 0.48;

      // Shadow
      ctx.beginPath();
      ctx.ellipse(W / 2, machY + machH - 4, machW * 0.45, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

      // Base wood body
      roRoundRect(ctx, machX, machY, machW, machH, 8, RO.body, RO.bodyStroke, 2);

      // Metal top band
      roRect(ctx, machX + 4, machY + 4, machW - 8, 22, RO.metalAccent, RO.bodyStroke, 1.5);
      // Decorative rivets
      for (let rx = 0; rx < 5; rx++) {
        ctx.beginPath();
        ctx.arc(machX + 20 + rx * 38, machY + 15, 4, 0, Math.PI * 2);
        ctx.fillStyle = RO.metalDark;
        ctx.fill();
        ctx.strokeStyle = "#f0d060";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // "Old Blue Box" style label
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = RO.ink;
      ctx.fillText("一番賞 EVENT BOX", W / 2, machY + 16);

      // Left/right side panels (darker wood)
      roRect(ctx, machX, machY + 26, 18, machH - 26, RO.bodyDark, RO.bodyStroke, 1.5);
      roRect(ctx, machX + machW - 18, machY + 26, 18, machH - 26, RO.bodyDark, RO.bodyStroke, 1.5);

      // ── Reel panel ───────────────────────────────────────────────────────
      const reelPanelX = machX + 20;
      const reelPanelY = machY + 32;
      const reelPanelW = machW - 40;
      const reelPanelH = CELL_H * REEL_VISIBLE + 8;

      roRoundRect(ctx, reelPanelX, reelPanelY, reelPanelW, reelPanelH, 4, RO.reelPanel, RO.reelBorder, 2);

      // Individual reel columns
      const reelW = Math.floor(reelPanelW / REEL_COUNT);
      for (let ri = 0; ri < REEL_COUNT; ri++) {
        const rx = reelPanelX + ri * reelW;
        const ry = reelPanelY + 4;
        const rh = CELL_H * REEL_VISIBLE;

        // Clip to reel
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx + 2, ry, reelW - 4, rh);
        ctx.clip();

        // Draw symbols in reel
        const scrollY = reelsRef.current[ri] ?? 0;
        const startIdx = Math.floor(scrollY / CELL_H);
        const offsetY = scrollY % CELL_H;

        for (let si = -1; si <= REEL_VISIBLE + 1; si++) {
          const symbolIdx = ((startIdx + si) % SYMBOL_STRIP.length + SYMBOL_STRIP.length) % SYMBOL_STRIP.length;
          const grade = SYMBOL_STRIP[symbolIdx]!;
          const sy = ry + si * CELL_H - offsetY;

          // Cell background
          ctx.fillStyle = RO.reelBg;
          ctx.fillRect(rx + 2, sy, reelW - 4, CELL_H);
          // Grade color accent strip at top
          ctx.fillStyle = GRADE_COLOR[grade];
          ctx.globalAlpha = 0.15;
          ctx.fillRect(rx + 2, sy, reelW - 4, CELL_H);
          ctx.globalAlpha = 1;

          // Symbol
          drawGradeSymbol(ctx, grade, rx + reelW / 2, sy + CELL_H / 2, CELL_H * 0.55);

          // Grade label
          ctx.font = `bold ${9}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = GRADE_COLOR[grade];
          ctx.fillText(grade, rx + reelW / 2, sy + CELL_H - 8);

          // Cell border
          ctx.strokeStyle = RO.reelBorder;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(rx + 2, sy, reelW - 4, CELL_H);
        }

        ctx.restore();

        // Reel dividers
        if (ri < REEL_COUNT - 1) {
          ctx.beginPath();
          ctx.moveTo(rx + reelW, ry);
          ctx.lineTo(rx + reelW, ry + rh);
          ctx.strokeStyle = RO.reelBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Center win-line highlight
      const winLineY = reelPanelY + 4 + CELL_H;
      ctx.beginPath();
      ctx.rect(reelPanelX, winLineY, reelPanelW, CELL_H);
      ctx.strokeStyle = stateRef.current === "RESULT" ? RO.gradeA : "rgba(200,160,80,0.5)";
      ctx.lineWidth = stateRef.current === "RESULT" ? 3 : 1.5;
      ctx.stroke();
      // Corner triangles for win-line
      for (const cx2 of [reelPanelX - 8, reelPanelX + reelPanelW]) {
        ctx.beginPath();
        const dir = cx2 < W / 2 ? 1 : -1;
        ctx.moveTo(cx2, winLineY);
        ctx.lineTo(cx2 + dir * 8, winLineY + CELL_H / 2);
        ctx.lineTo(cx2, winLineY + CELL_H);
        ctx.closePath();
        ctx.fillStyle = stateRef.current === "RESULT" ? RO.gradeA : RO.metalAccent;
        ctx.fill();
      }

      // ── Reel scroll update ───────────────────────────────────────────────
      for (let ri = 0; ri < REEL_COUNT; ri++) {
        if (reelStoppedRef.current[ri]) continue;
        const speed = reelSpeedsRef.current[ri] ?? 0;
        const target = reelTargetsRef.current[ri];
        if (speed <= 0) continue;

        if (target !== null) {
          // Decelerating toward target
          const current = reelsRef.current[ri] ?? 0;
          const dist = target - current;
          if (Math.abs(dist) < 2 || current > target) {
            reelsRef.current[ri] = target % (SYMBOL_STRIP.length * CELL_H);
            reelSpeedsRef.current[ri] = 0;
            reelStoppedRef.current[ri] = true;
          } else {
            const decel = Math.min(speed, Math.max(2, dist * 0.12));
            reelsRef.current[ri] = (reelsRef.current[ri] ?? 0) + decel;
          }
        } else {
          reelsRef.current[ri] = ((reelsRef.current[ri] ?? 0) + speed) % (SYMBOL_STRIP.length * CELL_H);
        }
      }

      // ── Light pillar ─────────────────────────────────────────────────────
      if (pillarRef.current) {
        const pl = pillarRef.current;
        pl.life -= 1;
        if (pl.life <= 0) {
          pillarRef.current = null;
        } else {
          const alpha2 = Math.min(1, pl.life / 30) * (pl.grade === "A賞" ? 0.85 : 0.6);
          const pilColor = GRADE_PILLAR[pl.grade];
          const grad2 = ctx.createLinearGradient(0, 0, 0, H);
          grad2.addColorStop(0, pilColor.replace(")", `, ${alpha2})`).replace("rgba(", "rgba("));
          grad2.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = pilColor;
          ctx.globalAlpha = alpha2;
          ctx.fillRect(W / 2 - 30, 0, 60, H);
          ctx.globalAlpha = 1;
          // Rotating sparkles around pillar
          if (pl.grade === "A賞") {
            for (let sp = 0; sp < 8; sp++) {
              const ang = (sp / 8) * Math.PI * 2 + t * 0.06;
              const sx2 = W / 2 + Math.cos(ang) * 40;
              const sy2 = H * 0.4 + Math.sin(ang) * 20;
              ctx.beginPath();
              ctx.arc(sx2, sy2, 3, 0, Math.PI * 2);
              ctx.fillStyle = "#ffe066";
              ctx.globalAlpha = alpha2 * 0.9;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      // ── System message ───────────────────────────────────────────────────
      if (sysMsgRef.current) {
        const sm = sysMsgRef.current;
        sm.life -= 1;
        const alpha2 = Math.min(1, sm.life / 30);
        if (sm.life <= 0) sysMsgRef.current = null;
        else {
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.globalAlpha = alpha2;
          // Shadow
          ctx.fillStyle = "#000";
          ctx.fillText(sm.text, W / 2 + 1, 25);
          // Yellow RO system text
          ctx.fillStyle = RO.sysText;
          ctx.fillText(sm.text, W / 2, 24);
          ctx.globalAlpha = 1;
        }
      }

      // ── Damage numbers ───────────────────────────────────────────────────
      dmgNumsRef.current = dmgNumsRef.current.filter((dn) => dn.life > 0);
      for (const dn of dmgNumsRef.current) {
        dn.life -= 1;
        dn.y += dn.vy;
        dn.vy *= 0.97;
        const alpha2 = Math.min(1, dn.life / 20);
        ctx.save();
        ctx.globalAlpha = alpha2;
        ctx.font = `${dn.isCrit ? "bold italic" : "bold"} ${dn.isCrit ? dn.size + 4 : dn.size}px sans-serif`;
        ctx.textAlign = "center";
        // Shadow
        ctx.fillStyle = "#000";
        ctx.fillText(dn.text, dn.x + 1.5, dn.y + 1.5);
        // Main text
        ctx.fillStyle = dn.color;
        ctx.fillText(dn.text, dn.x, dn.y);
        if (dn.isCrit) {
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${dn.size * 0.4}px sans-serif`;
          ctx.fillText("CRITICAL!", dn.x, dn.y - dn.size);
        }
        ctx.restore();
      }

      // ── Poring mascots at top of machine ─────────────────────────────────
      const porings = poringsRef.current;
      for (const p of porings) {
        p.phase += p.bounceSpeed;
        const bounceY = p.baseY + Math.sin(p.phase) * p.bounceAmp * (p.excited ? 1.8 : 1);
        drawPoringSymbol(ctx, p.x + machX - 15, bounceY, p.size, 1, p.eyeType);
      }

      // Poring variety labels
      const pLabels = ["D", "C", "B", "A"];
      for (let pi = 0; pi < 4; pi++) {
        const p = porings[pi]!;
        const bounceY = p.baseY + Math.sin(p.phase) * p.bounceAmp * (p.excited ? 1.8 : 1);
        ctx.font = `bold 7px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = GRADE_COLOR[GRADES[pi]!];
        ctx.fillText(pLabels[pi]!, p.x + machX - 15, bounceY + p.size * 0.62);
      }

      // ── Pull lever (right side) ───────────────────────────────────────────
      const levX = machX + machW + 4;
      const levY = machY + 60;
      const leverPulled = stateRef.current === "SPINNING";
      const leverOffset = leverPulled ? 28 : 0;

      // Lever bar
      roRect(ctx, levX, levY + leverOffset, 12, 70 - leverOffset, RO.body, RO.bodyStroke, 1.5);
      // Lever knob
      ctx.beginPath();
      ctx.arc(levX + 6, levY + leverOffset, 10, 0, Math.PI * 2);
      ctx.fillStyle = RO.gradeD;
      ctx.fill();
      ctx.strokeStyle = RO.bodyStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("GO", levX + 6, levY + leverOffset + 3);

      // ── Bottom buttons ───────────────────────────────────────────────────
      const btnY = machY + machH - 34;
      // Start button
      const isIdle = stateRef.current === "IDLE" || stateRef.current === "RESULT";
      roRoundRect(ctx, machX + 28, btnY, machW - 56, 26, 6, isIdle ? "#ee6644" : "#997755", "#3a2010", 1.5);
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(isIdle ? "點擊 Poring 開始抽！" : "抽獎中…", W / 2, btnY + 17);

      // ── "MVP!" banner for A grade ─────────────────────────────────────────
      if (stateRef.current === "RESULT" && resultGradeRef.current === "A賞") {
        const blink = Math.floor(t / 12) % 2 === 0;
        if (blink) {
          ctx.font = "bold italic 22px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.shadowColor = RO.gradeA;
          ctx.shadowBlur = 18;
          ctx.fillText("MVP!", W / 2, machY + machH - 50);
          ctx.shadowBlur = 0;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (stateRef.current === "IDLE" || stateRef.current === "RESULT") {
      startSpin();
    }
  }, [startSpin]);

  return (
    <div className="flex flex-col items-center select-none">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleClick}
        className="cursor-pointer"
        style={{ imageRendering: "auto", maxWidth: "100%" }}
      />
      <p className="mt-2 text-xs text-center opacity-60" style={{ color: RO.sysText }}>
        {gameState === "IDLE"
          ? "點擊 Poring 或畫面開始！"
          : gameState === "SPINNING"
          ? "轉動中…"
          : gameState === "STOPPING"
          ? "停止中…"
          : `結果: ${resultGradeRef.current} — ${GRADE_LABEL[resultGradeRef.current]}`}
      </p>
    </div>
  );
}
