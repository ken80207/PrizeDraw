"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClawPixelGameState = "IDLE" | "MOVING" | "GRABBING" | "LIFTING" | "RESULT";

export interface ClawMachinePixelProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ClawPixelGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const NATIVE_W = 240;
const NATIVE_H = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

const PAL = {
  // Machine frame
  frameDark:   "#1a1a2e",
  frameBody:   "#2c2c4a",
  frameBorder: "#5a5a8a",
  frameLight:  "#7a7aaa",
  frameShine:  "#9090cc",
  // Glass area
  glassBg:     "#0d1a2e",
  glassFloor:  "#1a2a3e",
  glassBorder: "#3a5a7a",
  // Rail
  rail:        "#8a8aaa",
  railDark:    "#4a4a6a",
  // Claw
  clawHub:     "#ccaa44",
  clawHubDark: "#887722",
  clawProng:   "#aaaacc",
  clawProngDk: "#6666aa",
  cable:       "#888888",
  // Toy colors
  toyRed:      "#ee4444",
  toyRedDk:    "#aa2222",
  toyBlue:     "#4488ee",
  toyBlueDk:   "#2255aa",
  toyGreen:    "#44cc66",
  toyGreenDk:  "#228844",
  toyPurple:   "#bb66ee",
  toyPurpleDk: "#773399",
  toyShadow:   "#000000",
  // Grade colors
  gradeA: "#ffd700",
  gradeB: "#4488ff",
  gradeC: "#44cc66",
  gradeD: "#aa66ff",
  // Buttons
  btnRed:      "#cc3322",
  btnRedLt:    "#ff5544",
  btnRedDk:    "#882211",
  btnBlue:     "#2244cc",
  btnBlueLt:   "#4466ff",
  btnBlueDk:   "#112288",
  btnGray:     "#446644",
  btnGrayLt:   "#66aa66",
  btnGrayDk:   "#224422",
  // UI
  white:       "#f0f0f0",
  yellow:      "#ffd700",
  black:       "#000000",
  // Lights
  lightOn:     "#ffee44",
  lightOff:    "#665500",
  lightRed:    "#ff4444",
  lightRedOff: "#662222",
  // Win
  explodeA:    "#ffff00",
  explodeB:    "#ff8800",
  explodeC:    "#ff2200",
  // Score display
  scoreBg:     "#0a1a0a",
  scoreGreen:  "#00ff44",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pixel font (shared pattern from SlotMachine_Pixel)
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_FONT: Record<string, number[][]> = {
  "A": [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "B": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  "C": [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  "D": [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  "E": [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "G": [[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
  "L": [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  "M": [[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
  "N": [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  "O": [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  "P": [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  "R": [[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  "S": [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  "T": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  "W": [[1,0,1],[1,0,1],[1,1,1],[1,1,1],[0,1,0]],
  "!": [[0,1,0],[0,1,0],[0,1,0],[0,0,0],[0,1,0]],
  "★": [[0,1,0],[1,1,1],[0,1,0],[1,0,1],[0,0,0]],
  "賞": [[1,1,1],[1,0,1],[1,1,1],[1,0,0],[1,0,0]],
  " ": [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
};

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  color: string,
) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = PIXEL_FONT[ch] ?? PIXEL_FONT[" "]!;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row]?.[col]) {
          ctx.fillRect(cx + col * px, y + row * px, px, px);
        }
      }
    }
    cx += (3 + 1) * px;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade icons (8x8 pixel sprites)
// ─────────────────────────────────────────────────────────────────────────────

type Grade = "A賞" | "B賞" | "C賞" | "D賞";

// Crown (A), Star (B), Heart (C), Circle (D)
const TOY_SHAPES: Record<Grade, number[][]> = {
  "A賞": [
    [0,1,0,0,0,1,0,0],
    [1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,0,0],
    [0,0,1,1,1,0,0,0],
    [0,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0,0],
  ],
  "B賞": [
    [0,0,1,0,0,0,0,0],
    [0,1,1,1,0,0,0,0],
    [1,1,1,1,1,0,0,0],
    [0,1,1,1,0,0,0,0],
    [1,1,0,1,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  "C賞": [
    [0,1,0,0,1,0,0,0],
    [1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,0,0],
    [0,1,1,1,1,0,0,0],
    [0,0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
  "D賞": [
    [0,1,1,1,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [0,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0],
  ],
};

const GRADE_MAIN_COLOR: Record<Grade, string> = {
  "A賞": PAL.gradeA,
  "B賞": PAL.gradeB,
  "C賞": PAL.gradeC,
  "D賞": PAL.gradeD,
};

const GRADE_DARK_COLOR: Record<Grade, string> = {
  "A賞": "#aa8800",
  "B賞": "#2255aa",
  "C賞": "#228844",
  "D賞": "#773399",
};

// Toy data: position (in glass area, native px), which grade color
interface Toy {
  x: number;
  y: number;
  grade: Grade;
  grabbed: boolean;
}

function buildToys(): Toy[] {
  return [
    { x: 14,  y: 44, grade: "A賞", grabbed: false },
    { x: 36,  y: 44, grade: "B賞", grabbed: false },
    { x: 58,  y: 44, grade: "C賞", grabbed: false },
    { x: 80,  y: 44, grade: "D賞", grabbed: false },
    { x: 102, y: 44, grade: "A賞", grabbed: false },
    { x: 14,  y: 62, grade: "D賞", grabbed: false },
    { x: 36,  y: 62, grade: "C賞", grabbed: false },
    { x: 58,  y: 62, grade: "B賞", grabbed: false },
    { x: 80,  y: 62, grade: "A賞", grabbed: false },
    { x: 102, y: 62, grade: "D賞", grabbed: false },
    { x: 25,  y: 80, grade: "B賞", grabbed: false },
    { x: 47,  y: 80, grade: "A賞", grabbed: false },
    { x: 69,  y: 80, grade: "C賞", grabbed: false },
    { x: 91,  y: 80, grade: "D賞", grabbed: false },
  ];
}

function drawToy(
  ctx: CanvasRenderingContext2D,
  toy: Toy,
  offX: number,
  offY: number,
) {
  if (toy.grabbed) return;
  const shape = TOY_SHAPES[toy.grade]!;
  const mainColor = GRADE_MAIN_COLOR[toy.grade]!;
  const darkColor = GRADE_DARK_COLOR[toy.grade]!;
  const px = 2;
  const tx = offX + toy.x;
  const ty = offY + toy.y;
  // Shadow pixel
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(tx + 1, ty + shape.length * px, shape[0]!.length * px, 1);
  // Main shape
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row]!.length; col++) {
      if (shape[row]![col]) {
        // Top half lighter, bottom darker
        ctx.fillStyle = row < Math.floor(shape.length / 2) ? mainColor : darkColor;
        ctx.fillRect(tx + col * px, ty + row * px, px, px);
      }
    }
  }
  // Eyes (small dots)
  ctx.fillStyle = PAL.black;
  ctx.fillRect(tx + 2, ty + 2, 1, 1);
  ctx.fillRect(tx + 6, ty + 2, 1, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachinePixel({
  resultGrade = "A賞",
  prizeName: _prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachinePixelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ClawPixelGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [, setGameState] = useState<ClawPixelGameState>("IDLE");

  // Claw position in glass area (native px)
  // Glass area starts at glassX=16, glassY=36 inside the frame
  // Rail Y is at glassY+4 (top of glass)
  const clawX = useRef(60);          // horizontal position (snapped to 4px grid)
  const clawY = useRef(8);           // cable length (how far claw has descended)
  const _clawOpen = useRef(true);     // true = open prongs (tracked for future use)
  const grabFrame = useRef(0);       // 0=open 1=half 2=closed
  const flashAlpha = useRef(0);
  const blinkTimer = useRef(0);
  const lightOn = useRef(true);
  const explodeParticles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);
  const toys = useRef<Toy[]>(buildToys());
  const grabbedGrade = useRef<Grade | null>(null);

  // Animation phase timers
  const moveTimer = useRef(0);
  const moveDir = useRef(1); // 1 = right, -1 = left (idle oscillation)

  const changeState = useCallback((s: ClawPixelGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // Machine geometry
    const mX = 8, mY = 6;
    const mW = 168, mH = NATIVE_H - 12;
    // Glass area inside frame
    const gX = mX + 8;
    const gY = mY + 36;
    const gW = mW - 16;
    const gH = 100;
    // Rail Y (inside glass, from top)
    const railY = gY + 4;

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = PAL.frameDark;
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

    // ── Machine body ────────────────────────────────────────────────────────
    ctx.fillStyle = PAL.frameBody;
    ctx.fillRect(mX, mY, mW, mH);

    // Border (chunky 2px)
    ctx.fillStyle = PAL.frameBorder;
    ctx.fillRect(mX, mY, mW, 2);
    ctx.fillRect(mX, mY + mH - 2, mW, 2);
    ctx.fillRect(mX, mY, 2, mH);
    ctx.fillRect(mX + mW - 2, mY, 2, mH);

    // Inner highlight
    ctx.fillStyle = PAL.frameLight;
    ctx.fillRect(mX + 2, mY + 2, mW - 4, 1);
    ctx.fillRect(mX + 2, mY + 2, 1, mH - 4);

    // Corner decorations (4x4 pixel squares)
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(mX + 3, mY + 3, 4, 4);
    ctx.fillRect(mX + mW - 7, mY + 3, 4, 4);
    ctx.fillRect(mX + 3, mY + mH - 7, 4, 4);
    ctx.fillRect(mX + mW - 7, mY + mH - 7, 4, 4);

    // ── Blinking border lights ───────────────────────────────────────────────
    blinkTimer.current += dt;
    if (blinkTimer.current > 350) {
      blinkTimer.current = 0;
      lightOn.current = !lightOn.current;
    }
    const lc = lightOn.current ? PAL.lightOn : PAL.lightOff;
    const lrc = lightOn.current ? PAL.lightRed : PAL.lightRedOff;
    const lightXs = [20, 34, 48, 62, 76, 90, 104, 118, 132, 146, 158];
    for (let i = 0; i < lightXs.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? lc : lrc;
      ctx.fillRect(lightXs[i]!, mY + 3, 4, 3);
    }

    // ── Header ──────────────────────────────────────────────────────────────
    ctx.fillStyle = "#1a1a3e";
    ctx.fillRect(mX + 4, mY + 10, mW - 8, 20);
    ctx.fillStyle = PAL.frameBorder;
    ctx.fillRect(mX + 4, mY + 10, mW - 8, 1);
    ctx.fillRect(mX + 4, mY + 30, mW - 8, 1);

    // Star decorations
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(mX + 8, mY + 16, 3, 3);
    ctx.fillRect(mX + 12, mY + 14, 3, 3);
    ctx.fillRect(mX + 8, mY + 20, 3, 1);
    ctx.fillRect(mX + mW - 18, mY + 16, 3, 3);
    ctx.fillRect(mX + mW - 22, mY + 14, 3, 3);

    drawPixelText(ctx, "CLAW", mX + 22, mY + 14, 1, PAL.white);
    drawPixelText(ctx, "GAME", mX + 74, mY + 14, 1, PAL.yellow);

    // ── Glass area ───────────────────────────────────────────────────────────
    ctx.fillStyle = PAL.glassBg;
    ctx.fillRect(gX, gY, gW, gH);
    // Glass border
    ctx.fillStyle = PAL.glassBorder;
    ctx.fillRect(gX - 2, gY - 2, gW + 4, 2);
    ctx.fillRect(gX - 2, gY + gH, gW + 4, 2);
    ctx.fillRect(gX - 2, gY - 2, 2, gH + 4);
    ctx.fillRect(gX + gW, gY - 2, 2, gH + 4);
    // Glass floor line
    ctx.fillStyle = PAL.glassFloor;
    ctx.fillRect(gX, gY + gH - 4, gW, 4);
    // Glass shine (top-left 1px highlight)
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(gX, gY, gW, 1);
    ctx.fillRect(gX, gY, 1, gH);

    // ── Rail ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = PAL.rail;
    ctx.fillRect(gX + 2, railY, gW - 4, 2);
    ctx.fillStyle = PAL.railDark;
    ctx.fillRect(gX + 2, railY + 2, gW - 4, 1);

    // Rail end caps
    ctx.fillStyle = PAL.frameShine;
    ctx.fillRect(gX + 2, railY - 2, 4, 6);
    ctx.fillRect(gX + gW - 6, railY - 2, 4, 6);

    // ── Toys (draw inside glass) ──────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(gX, gY, gW, gH);
    ctx.clip();
    for (const toy of toys.current) {
      drawToy(ctx, toy, gX, gY);
    }
    ctx.restore();

    // ── Claw ──────────────────────────────────────────────────────────────────
    const cx = gX + clawX.current;  // claw hub center X
    const cy = railY + 2 + clawY.current; // claw hub top Y

    // Cable from rail to hub
    ctx.fillStyle = PAL.cable;
    ctx.fillRect(cx + 1, railY + 2, 1, clawY.current + 1);

    // Hub (4x4 pixel square)
    ctx.fillStyle = PAL.clawHub;
    ctx.fillRect(cx - 1, cy, 4, 4);
    ctx.fillStyle = PAL.clawHubDark;
    ctx.fillRect(cx + 2, cy + 2, 2, 2);

    // Prongs — 3 prongs arranged left, center, right
    // grabFrame: 0=open (spread), 1=half, 2=closed (together)
    const gf = grabFrame.current;
    const spread = [8, 4, 0][gf] ?? 0; // how far prongs spread out
    const prongH = 6;

    // Left prong
    ctx.fillStyle = PAL.clawProng;
    ctx.fillRect(cx - 2 - spread, cy + 4, 2, prongH);
    ctx.fillRect(cx - 2 - spread, cy + 4 + prongH - 2, 2 + spread, 2);
    ctx.fillStyle = PAL.clawProngDk;
    ctx.fillRect(cx - 1 - spread, cy + 4, 1, prongH);

    // Center prong
    ctx.fillStyle = PAL.clawProng;
    ctx.fillRect(cx + 1, cy + 4, 2, prongH + 2);
    ctx.fillStyle = PAL.clawProngDk;
    ctx.fillRect(cx + 2, cy + 4, 1, prongH + 1);

    // Right prong
    ctx.fillStyle = PAL.clawProng;
    ctx.fillRect(cx + 2 + spread, cy + 4, 2, prongH);
    ctx.fillRect(cx + spread, cy + 4 + prongH - 2, 2 + spread, 2);
    ctx.fillStyle = PAL.clawProngDk;
    ctx.fillRect(cx + 3 + spread, cy + 4, 1, prongH);

    // Grabbed toy indicator (if closed and grabbed)
    if (gf === 2 && grabbedGrade.current) {
      const gc = GRADE_MAIN_COLOR[grabbedGrade.current] ?? PAL.yellow;
      ctx.fillStyle = gc;
      ctx.fillRect(cx - 1, cy + 10, 4, 4);
    }

    // ── Chute (right side) ────────────────────────────────────────────────────
    const chuteX = mX + mW - 14;
    const chuteY = gY + gH + 4;
    ctx.fillStyle = PAL.frameBorder;
    ctx.fillRect(chuteX, chuteY, 10, 16);
    ctx.fillStyle = PAL.frameDark;
    ctx.fillRect(chuteX + 2, chuteY + 2, 6, 12);
    // Chute label arrow
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(chuteX + 4, chuteY - 3, 2, 2);
    ctx.fillRect(chuteX + 3, chuteY - 5, 4, 2);
    ctx.fillRect(chuteX + 2, chuteY - 7, 6, 2);

    // ── Control buttons ───────────────────────────────────────────────────────
    const btnAreaY = gY + gH + 10;
    const btns = [
      { x: mX + 12, label: "L", color: PAL.btnBlue, colorLt: PAL.btnBlueLt, colorDk: PAL.btnBlueDk },
      { x: mX + 32, label: "D", color: PAL.btnRed, colorLt: PAL.btnRedLt, colorDk: PAL.btnRedDk },
      { x: mX + 52, label: "R", color: PAL.btnBlue, colorLt: PAL.btnBlueLt, colorDk: PAL.btnBlueDk },
    ];
    for (const btn of btns) {
      // Button body (12x12)
      ctx.fillStyle = btn.color;
      ctx.fillRect(btn.x, btnAreaY, 12, 12);
      // Highlight top
      ctx.fillStyle = btn.colorLt;
      ctx.fillRect(btn.x, btnAreaY, 12, 2);
      ctx.fillRect(btn.x, btnAreaY, 2, 12);
      // Shadow bottom
      ctx.fillStyle = btn.colorDk;
      ctx.fillRect(btn.x, btnAreaY + 10, 12, 2);
      ctx.fillRect(btn.x + 10, btnAreaY, 2, 12);
      // Arrow symbol (pixel art)
      ctx.fillStyle = PAL.white;
      if (btn.label === "L") {
        // Left arrow
        ctx.fillRect(btn.x + 3, btnAreaY + 5, 1, 1);
        ctx.fillRect(btn.x + 4, btnAreaY + 4, 1, 3);
        ctx.fillRect(btn.x + 5, btnAreaY + 3, 1, 5);
        ctx.fillRect(btn.x + 6, btnAreaY + 4, 3, 1);
        ctx.fillRect(btn.x + 6, btnAreaY + 6, 3, 1);
      } else if (btn.label === "R") {
        // Right arrow
        ctx.fillRect(btn.x + 8, btnAreaY + 5, 1, 1);
        ctx.fillRect(btn.x + 7, btnAreaY + 4, 1, 3);
        ctx.fillRect(btn.x + 6, btnAreaY + 3, 1, 5);
        ctx.fillRect(btn.x + 3, btnAreaY + 4, 3, 1);
        ctx.fillRect(btn.x + 3, btnAreaY + 6, 3, 1);
      } else {
        // Down arrow
        ctx.fillRect(btn.x + 5, btnAreaY + 8, 1, 1);
        ctx.fillRect(btn.x + 4, btnAreaY + 7, 3, 1);
        ctx.fillRect(btn.x + 3, btnAreaY + 6, 5, 1);
        ctx.fillRect(btn.x + 4, btnAreaY + 3, 1, 3);
        ctx.fillRect(btn.x + 6, btnAreaY + 3, 1, 3);
        ctx.fillRect(btn.x + 5, btnAreaY + 3, 1, 3);
      }
    }

    // ── START / RESET button ──────────────────────────────────────────────────
    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canStart = isIdle || isResult;
    const startBtnX = mX + 76;
    const startBtnY = btnAreaY;
    const startBtnW = mW - 76 - 12;

    ctx.fillStyle = canStart ? "#226622" : "#112211";
    ctx.fillRect(startBtnX, startBtnY, startBtnW, 12);
    ctx.fillStyle = canStart ? PAL.btnGrayLt : "#334433";
    ctx.fillRect(startBtnX, startBtnY, startBtnW, 2);
    ctx.fillStyle = canStart ? PAL.btnGrayDk : "#111811";
    ctx.fillRect(startBtnX, startBtnY + 10, startBtnW, 2);
    const label = isResult ? "RESET" : "START";
    drawPixelText(ctx, label, startBtnX + Math.floor((startBtnW - label.length * 4) / 2), startBtnY + 4, 1, canStart ? PAL.white : "#445544");

    // ── Score/grade display ───────────────────────────────────────────────────
    const scoreY = btnAreaY + 18;
    ctx.fillStyle = PAL.scoreBg;
    ctx.fillRect(mX + 4, scoreY, mW - 8, 14);
    ctx.fillStyle = "#226622";
    ctx.fillRect(mX + 4, scoreY, mW - 8, 1);
    ctx.fillRect(mX + 4, scoreY + 13, mW - 8, 1);

    const tg = resultGrade as Grade;
    const tgColor = GRADE_MAIN_COLOR[tg] ?? PAL.white;
    drawPixelText(ctx, "TARGET", mX + 8, scoreY + 5, 1, PAL.scoreGreen);
    ctx.fillStyle = tgColor;
    ctx.fillRect(mX + mW - 30, scoreY + 4, 4, 6);
    ctx.fillRect(mX + mW - 26, scoreY + 2, 4, 10);
    drawPixelText(ctx, tg[0] ?? "", mX + mW - 20, scoreY + 5, 1, tgColor);

    // ── State label (small) ───────────────────────────────────────────────────
    const stateLabels: Record<ClawPixelGameState, string> = {
      IDLE: "IDLE",
      MOVING: "MOVE",
      GRABBING: "GRAB",
      LIFTING: "LIFT",
      RESULT: "WIN!",
    };
    const stateColors: Record<ClawPixelGameState, string> = {
      IDLE: PAL.frameBorder,
      MOVING: PAL.gradeC,
      GRABBING: PAL.gradeA,
      LIFTING: PAL.gradeB,
      RESULT: PAL.gradeA,
    };
    drawPixelText(ctx, stateLabels[stateRef.current], mX + mW - 28, mY + mH - 12, 1, stateColors[stateRef.current]);

    // ── Explosion particles ────────────────────────────────────────────────────
    for (const p of explodeParticles.current) {
      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      p.life -= dt / 16;
      if (p.life > 0) {
        ctx.globalAlpha = Math.min(p.life / 30, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.globalAlpha = 1;
      }
    }
    explodeParticles.current = explodeParticles.current.filter((p) => p.life > 0);

    // ── Flash ─────────────────────────────────────────────────────────────────
    if (flashAlpha.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha.current})`;
      ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);
      flashAlpha.current = Math.max(0, flashAlpha.current - dt / 80);
    }

    // ── "GET!" win text ────────────────────────────────────────────────────────
    if (stateRef.current === "RESULT") {
      const winY = 80;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(mX + 20, winY - 4, 90, 18);
      drawPixelText(ctx, "GET!", mX + 28, winY, 3, PAL.yellow);
      // Grade color block
      const wg = grabbedGrade.current ?? (resultGrade as Grade);
      const wgColor = GRADE_MAIN_COLOR[wg] ?? PAL.white;
      ctx.fillStyle = wgColor;
      ctx.fillRect(mX + 90, winY + 1, 14, 12);
      drawPixelText(ctx, wg[0] ?? "", mX + 92, winY + 4, 1, PAL.black);
    }
  }, [resultGrade]);

  // ── Animation logic ──────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;

    const state = stateRef.current;

    if (state === "IDLE") {
      // Oscillate claw left/right gently
      moveTimer.current += dt;
      if (moveTimer.current > 40) {
        moveTimer.current = 0;
        clawX.current = clawX.current + moveDir.current * 4;
        if (clawX.current >= 96 || clawX.current <= 8) {
          moveDir.current *= -1;
        }
        // Keep claw up in IDLE
        clawY.current = 8;
        grabFrame.current = 0;
      }
    }

    draw(dt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    animRef.current = requestAnimationFrame(animate as FrameRequestCallback);
  }, [draw]); // animate intentionally references itself via rAF

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [animate]);

  // ── Start game sequence ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;

    // Reset toys if needed
    if (stateRef.current === "RESULT") {
      toys.current = buildToys();
      grabbedGrade.current = null;
      clawY.current = 8;
      clawX.current = 60;
      grabFrame.current = 0;
      explodeParticles.current = [];
    }

    changeState("MOVING");

    // Step 1: Move claw to target X
    const targetGrade = resultGrade as Grade;
    // Find a toy matching the target grade
    const targetToy = toys.current.find((t) => t.grade === targetGrade && !t.grabbed);
    const targetX = targetToy ? targetToy.x + 4 : 60;

    let currentX = clawX.current;
    const moveStep = 4;
    const moveInterval = setInterval(() => {
      if (Math.abs(currentX - targetX) <= moveStep) {
        currentX = targetX;
        clawX.current = currentX;
        clearInterval(moveInterval);
        // Step 2: Descend
        changeState("GRABBING");
        const targetY = targetToy ? targetToy.y + 2 : 60;
        const descendInterval = setInterval(() => {
          clawY.current = clawY.current + 4;
          if (clawY.current >= targetY) {
            clawY.current = targetY;
            clearInterval(descendInterval);
            // Step 3: Close prongs (3 frames)
            grabFrame.current = 0;
            setTimeout(() => { grabFrame.current = 1; }, 100);
            setTimeout(() => {
              grabFrame.current = 2;
              // Mark toy as grabbed
              if (targetToy) {
                targetToy.grabbed = true;
                grabbedGrade.current = targetToy.grade;
              }
              // Step 4: Lift
              changeState("LIFTING");
              const liftInterval = setInterval(() => {
                clawY.current = Math.max(8, clawY.current - 4);
                if (clawY.current <= 8) {
                  clearInterval(liftInterval);
                  // Step 5: Slide to chute
                  const slideInterval = setInterval(() => {
                    clawX.current = clawX.current + 4;
                    if (clawX.current >= 110) {
                      clawX.current = 110;
                      clearInterval(slideInterval);
                      // Drop
                      grabFrame.current = 0;
                      // Result
                      flashAlpha.current = 0.85;
                      const gX2 = 8 + 8;
                      const gY2 = 6 + 36;
                      for (let i = 0; i < 20; i++) {
                        const angle = (i / 20) * Math.PI * 2;
                        const speed = 1 + Math.random() * 2.5;
                        const colors = [PAL.explodeA, PAL.explodeB, PAL.explodeC, PAL.yellow, PAL.gradeC];
                        explodeParticles.current.push({
                          x: gX2 + 110, y: gY2 + 40,
                          vx: Math.cos(angle) * speed,
                          vy: Math.sin(angle) * speed,
                          life: 35 + Math.random() * 25,
                          color: colors[Math.floor(Math.random() * colors.length)]!,
                        });
                      }
                      changeState("RESULT");
                      onResult?.(resultGrade);
                    }
                  }, 40);
                }
              }, 40);
            }
            , 200);
          }
        }, 40);
      } else {
        currentX += currentX < targetX ? moveStep : -moveStep;
        clawX.current = currentX;
      }
    }, 40);
  }, [resultGrade, changeState, onResult]);

  // ── Handle click ──────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_W / rect.width;
    const scaleY = NATIVE_H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    const mX = 8, mY = 6, mW = 168;
    const gY = mY + 36;
    const gH = 100;
    const btnAreaY = gY + gH + 10;
    const startBtnX = mX + 76;
    const startBtnY = btnAreaY;
    const startBtnW = mW - 76 - 12;

    const onStart = nx >= startBtnX && nx <= startBtnX + startBtnW && ny >= startBtnY && ny <= startBtnY + 12;
    const state = stateRef.current;

    if (onStart && (state === "IDLE" || state === "RESULT")) {
      startGame();
    }
  }, [startGame]);

  return (
    <div className="flex items-center justify-center w-full" style={{ background: "#0d0d1a", padding: 8 }}>
      <canvas
        ref={canvasRef}
        width={NATIVE_W}
        height={NATIVE_H}
        onClick={handleClick}
        style={{
          imageRendering: "pixelated",
          width: "100%",
          maxWidth: NATIVE_W * 2,
          cursor: "pointer",
          display: "block",
        }}
      />
    </div>
  );
}
