"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PixelSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachinePixelProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: PixelSlotGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pixel palette & constants
// ─────────────────────────────────────────────────────────────────────────────

// Native canvas resolution — CSS will scale it up
const NATIVE_W = 220;
const NATIVE_H = 280;

// Color palette (32 colors max, retro feel)
const PAL = {
  // Machine body
  machineBody:   "#2c2c4a",
  machineDark:   "#1a1a2e",
  machineBorder: "#5a5a8a",
  machineLight:  "#7a7aaa",
  // Reel window
  reelBg:        "#0d0d1a",
  reelBorder:    "#4a4a7a",
  reelHighlight: "#6060ff",
  // Grade colors
  gradeA: "#ffd700",
  gradeB: "#4488ff",
  gradeC: "#44cc66",
  gradeD: "#aa66ff",
  // Text / misc
  white:    "#f0f0f0",
  darkText: "#1a1a2e",
  black:    "#000000",
  // Lever
  leverRod:  "#8b6914",
  leverKnob: "#cc4400",
  leverKnobLight: "#ff6622",
  // Dither
  dither1: "#3c3c5e",
  dither2: "#2a2a46",
  // Lights
  lightOn:  "#ffee44",
  lightOff: "#665500",
  // Win explosion
  explodeA: "#ffff00",
  explodeB: "#ff8800",
  explodeC: "#ff2200",
  // Screen flash
  flashWhite: "rgba(255,255,255,0.85)",
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

// Each grade has a distinct pixel icon pattern: drawn as a small 7x7 bitmask
// 1 = colored, 0 = transparent
const GRADE_ICONS: Record<Grade, number[][]> = {
  "A賞": [
    // Crown shape
    [0,1,0,1,0,1,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,1,1,1,1,1,0],
  ],
  "B賞": [
    // Star shape
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [1,1,0,1,0,1,1],
    [1,0,0,0,0,0,1],
    [0,0,0,0,0,0,0],
  ],
  "C賞": [
    // Diamond shape
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ],
  "D賞": [
    // Circle shape
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,0,0,0,1,1],
    [1,1,0,0,0,1,1],
    [1,1,0,0,0,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
  ],
};

const GRADE_COLOR: Record<Grade, string> = {
  "A賞": PAL.gradeA,
  "B賞": PAL.gradeB,
  "C賞": PAL.gradeC,
  "D賞": PAL.gradeD,
};

// Symbol strip for each reel (cycling order)
const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 36;      // native px per cell
const CELL_W = 44;      // native px per cell
const REEL_VISIBLE = 3; // cells visible

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeIndex(grade: Grade): number {
  return SYMBOL_STRIP.findLastIndex((g) => g === grade);
}

/** Draw a pixel icon (7x7) at (x,y) with given pixel size and color */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: number[][],
  x: number,
  y: number,
  px: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let row = 0; row < icon.length; row++) {
    for (let col = 0; col < icon[row]!.length; col++) {
      if (icon[row]![col]) {
        ctx.fillRect(x + col * px, y + row * px, px, px);
      }
    }
  }
}

/** Draw pixel text using a very simple 3x5 font bitmask */
const PIXEL_FONT: Record<string, number[][]> = {
  "A": [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "B": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  "C": [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  "D": [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  "P": [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  "R": [[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  "I": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "Z": [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  "E": [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "W": [[1,0,1],[1,0,1],[1,1,1],[1,1,1],[0,1,0]],
  "賞": [[1,1,1],[1,0,1],[1,1,1],[1,0,0],[1,0,0]],
  "★": [[0,1,0],[1,1,1],[0,1,0],[1,0,1],[0,0,0]],
  "!": [[0,1,0],[0,1,0],[0,1,0],[0,0,0],[0,1,0]],
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
    cx += (3 + 1) * px; // 3 wide + 1 gap
  }
}

/** Dithering pattern fill (2x2 checkerboard) */
function fillDither(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  c1: string, c2: string,
) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      ctx.fillStyle = (px + py) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Pixel({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachinePixelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PixelSlotGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<PixelSlotGameState>("IDLE");

  // Reel scroll offsets (in native px, fractional)
  const reelOffsets = useRef<number[]>([0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0]);
  const reelLocked = useRef<boolean[]>([false, false, false]);
  const leverPulled = useRef(false);
  const leverAngle = useRef(0); // 0 = up, 1 = fully pulled
  const flashAlpha = useRef(0);
  const explodeParticles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);
  const blinkTimer = useRef(0);
  const lightOn = useRef(true);
  const lastTime = useRef(0);

  const changeState = useCallback((s: PixelSlotGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw a single frame ────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // ── Background / machine body ──────────────────────────────────────────

    // Background (dark blue-purple)
    ctx.fillStyle = PAL.machineDark;
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

    // Dither border decoration (2px strips)
    fillDither(ctx, 0, 0, NATIVE_W, 2, PAL.dither1, PAL.dither2);
    fillDither(ctx, 0, NATIVE_H - 2, NATIVE_W, 2, PAL.dither1, PAL.dither2);

    // Machine outer box
    const mX = 10, mY = 8, mW = 160, mH = NATIVE_H - 16;
    ctx.fillStyle = PAL.machineBody;
    ctx.fillRect(mX, mY, mW, mH);

    // Machine border (chunky pixel border: 2px)
    ctx.fillStyle = PAL.machineBorder;
    ctx.fillRect(mX, mY, mW, 2);
    ctx.fillRect(mX, mY + mH - 2, mW, 2);
    ctx.fillRect(mX, mY, 2, mH);
    ctx.fillRect(mX + mW - 2, mY, 2, mH);

    // Inner highlight on top-left
    ctx.fillStyle = PAL.machineLight;
    ctx.fillRect(mX + 2, mY + 2, mW - 4, 1);
    ctx.fillRect(mX + 2, mY + 2, 1, mH - 4);

    // ── Blinking border lights ─────────────────────────────────────────────
    blinkTimer.current += dt;
    if (blinkTimer.current > 300) {
      blinkTimer.current = 0;
      lightOn.current = !lightOn.current;
    }
    const lightColor = lightOn.current ? PAL.lightOn : PAL.lightOff;
    const lightPositions = [16, 26, 36, 46, 56, 66, 76, 86, 96, 106, 116, 126, 136, 146, 156];
    for (const lx of lightPositions) {
      ctx.fillStyle = lightColor;
      ctx.fillRect(lx, mY + 2, 4, 4);
      ctx.fillRect(lx, mY + mH - 6, 4, 4);
    }
    // Side lights
    for (let ly = mY + 8; ly < mY + mH - 8; ly += 10) {
      ctx.fillStyle = lightColor;
      ctx.fillRect(mX + 2, ly, 4, 4);
      ctx.fillRect(mX + mW - 6, ly, 4, 4);
    }

    // ── Header text: "★ PRIZE DRAW ★" ─────────────────────────────────────
    const headerY = mY + 10;
    // Header bar
    ctx.fillStyle = PAL.reelBorder;
    ctx.fillRect(mX + 4, headerY, mW - 8, 14);
    // "★" markers
    ctx.fillStyle = PAL.gradeA;
    ctx.fillRect(mX + 6, headerY + 4, 4, 4);
    ctx.fillRect(mX + 10, headerY + 2, 4, 4);
    ctx.fillRect(mX + mW - 18, headerY + 4, 4, 4);
    ctx.fillRect(mX + mW - 14, headerY + 2, 4, 4);
    // "PRIZE" pixel text
    drawPixelText(ctx, "PRIZE", mX + 18, headerY + 3, 1, PAL.white);
    drawPixelText(ctx, "DRAW", mX + 72, headerY + 3, 1, PAL.gradeA);

    // ── Reel window area ───────────────────────────────────────────────────
    const reelAreaX = mX + 6;
    const reelAreaY = headerY + 20;
    const reelAreaW = mW - 12;
    const reelAreaH = REEL_VISIBLE * CELL_H + 4;

    // Dark reel bg
    ctx.fillStyle = PAL.reelBg;
    ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);
    // Reel area border
    ctx.fillStyle = PAL.reelBorder;
    ctx.fillRect(reelAreaX - 2, reelAreaY - 2, reelAreaW + 4, 2);
    ctx.fillRect(reelAreaX - 2, reelAreaY + reelAreaH, reelAreaW + 4, 2);
    ctx.fillRect(reelAreaX - 2, reelAreaY - 2, 2, reelAreaH + 4);
    ctx.fillRect(reelAreaX + reelAreaW, reelAreaY - 2, 2, reelAreaH + 4);

    // Center row highlight (the "winning" row — middle of 3 visible)
    const winRowY = reelAreaY + CELL_H + 2;
    ctx.fillStyle = PAL.reelHighlight;
    ctx.fillRect(reelAreaX, winRowY, reelAreaW, 1);
    ctx.fillRect(reelAreaX, winRowY + CELL_H - 1, reelAreaW, 1);

    // Arrow markers pointing to center row
    ctx.fillStyle = PAL.gradeA;
    // Left arrow
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(reelAreaX - 6 - i, winRowY + CELL_H / 2 - 2 + i, 2, 1);
      ctx.fillRect(reelAreaX - 6 - i, winRowY + CELL_H / 2 + 1 - i, 2, 1);
    }
    // Right arrow
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(reelAreaX + reelAreaW + 4 + i, winRowY + CELL_H / 2 - 2 + i, 2, 1);
      ctx.fillRect(reelAreaX + reelAreaW + 4 + i, winRowY + CELL_H / 2 + 1 - i, 2, 1);
    }

    // ── Draw each reel ─────────────────────────────────────────────────────
    const singleReelW = Math.floor(reelAreaW / REEL_COUNT);
    for (let r = 0; r < REEL_COUNT; r++) {
      const rx = reelAreaX + r * singleReelW;
      const offset = reelOffsets.current[r] ?? 0;

      // Clip to reel window
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.clip();

      // Draw visible symbols (extra 1 above and below for seamless scroll)
      const startIdx = Math.floor(offset / CELL_H);
      const frac = offset % CELL_H;
      for (let v = -1; v <= REEL_VISIBLE + 1; v++) {
        const symbolIdx = ((startIdx + v) % SYMBOL_STRIP.length + SYMBOL_STRIP.length) % SYMBOL_STRIP.length;
        const grade = SYMBOL_STRIP[symbolIdx] as Grade;
        const cellY = reelAreaY + v * CELL_H - frac + 2;

        // Cell background (alternating)
        ctx.fillStyle = v % 2 === 0 ? "#141428" : "#0d0d1a";
        ctx.fillRect(rx + 1, cellY, singleReelW - 2, CELL_H - 1);

        // Grade icon (7x7 at 3px per pixel = 21x21)
        const iconX = rx + Math.floor((singleReelW - 21) / 2);
        const iconY = cellY + Math.floor((CELL_H - 21 - 6) / 2);
        drawIcon(ctx, GRADE_ICONS[grade]!, iconX, iconY, 3, GRADE_COLOR[grade]!);

        // Grade label below icon (pixel text, 1px per pixel)
        const label = grade[0]!; // "A", "B", "C", "D"
        const labelX = rx + Math.floor((singleReelW - 3 * 2) / 2) - 2;
        drawPixelText(ctx, label, labelX, iconY + 22, 2, GRADE_COLOR[grade]!);
      }

      // Reel divider lines
      if (r < REEL_COUNT - 1) {
        ctx.fillStyle = PAL.reelBorder;
        ctx.fillRect(rx + singleReelW - 1, reelAreaY, 2, reelAreaH);
      }

      ctx.restore();
    }

    // ── Lever ──────────────────────────────────────────────────────────────
    const levX = mX + mW + 8;
    const levBaseY = reelAreaY + reelAreaH / 2;
    const levTopY = levBaseY - 40 + leverAngle.current * 35;

    // Lever rod (chunky 3px wide)
    ctx.fillStyle = PAL.leverRod;
    ctx.fillRect(levX + 2, levTopY, 3, levBaseY - levTopY + 10);

    // Lever base socket
    ctx.fillStyle = PAL.machineBorder;
    ctx.fillRect(levX, levBaseY + 8, 8, 6);
    ctx.fillStyle = PAL.machineLight;
    ctx.fillRect(levX + 1, levBaseY + 9, 6, 2);

    // Lever knob (8x8 circle-ish)
    ctx.fillStyle = PAL.leverKnob;
    ctx.fillRect(levX, levTopY - 8, 8, 8);
    ctx.fillStyle = PAL.leverKnobLight;
    ctx.fillRect(levX + 1, levTopY - 7, 3, 3);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(levX, levTopY - 8, 1, 1);
    ctx.fillRect(levX + 7, levTopY - 8, 1, 1);
    ctx.fillRect(levX, levTopY - 1, 1, 1);
    ctx.fillRect(levX + 7, levTopY - 1, 1, 1);

    // ── Grade info display ─────────────────────────────────────────────────
    const infoY = reelAreaY + reelAreaH + 8;
    ctx.fillStyle = PAL.reelBorder;
    ctx.fillRect(mX + 4, infoY, mW - 8, 14);

    // Show current target grade
    const targetGrade = resultGrade as Grade;
    const gradeTxtColor = GRADE_COLOR[targetGrade] ?? PAL.white;
    ctx.fillStyle = gradeTxtColor;
    ctx.fillRect(mX + 8, infoY + 3, 4, 4);
    ctx.fillRect(mX + 8, infoY + 7, 4, 4);
    drawPixelText(ctx, "TARGET", mX + 16, infoY + 4, 1, PAL.white);
    drawPixelText(ctx, targetGrade[0] ?? "", mX + mW - 24, infoY + 4, 2, gradeTxtColor);

    // ── PULL button ────────────────────────────────────────────────────────
    const btnY = infoY + 22;
    const btnX = mX + 4;
    const btnW = mW - 8;
    const btnH = 20;
    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canPull = isIdle || isResult;

    // Button body
    ctx.fillStyle = canPull ? "#882200" : "#442200";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    // Button highlight top
    ctx.fillStyle = canPull ? "#cc4400" : "#553300";
    ctx.fillRect(btnX, btnY, btnW, 2);
    ctx.fillRect(btnX, btnY, 2, btnH);
    // Button shadow bottom
    ctx.fillStyle = canPull ? "#551100" : "#221100";
    ctx.fillRect(btnX, btnY + btnH - 2, btnW, 2);
    ctx.fillRect(btnX + btnW - 2, btnY, 2, btnH);
    // Button text
    const btnLabel = isResult ? "RESET" : "PULL!";
    drawPixelText(ctx, btnLabel, btnX + Math.floor((btnW - btnLabel.length * 4) / 2), btnY + 7, 2, canPull ? PAL.white : "#885544");

    // ── Explode particles ──────────────────────────────────────────────────
    for (const p of explodeParticles.current) {
      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      p.life -= dt / 16;
      if (p.life > 0) {
        const alpha = Math.min(p.life / 30, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
        ctx.globalAlpha = 1;
      }
    }
    explodeParticles.current = explodeParticles.current.filter((p) => p.life > 0);

    // ── Screen flash ───────────────────────────────────────────────────────
    if (flashAlpha.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha.current})`;
      ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);
      flashAlpha.current = Math.max(0, flashAlpha.current - dt / 100);
    }

    // ── State label (small pixel status) ──────────────────────────────────
    const stateLabels: Record<PixelSlotGameState, string> = {
      IDLE: "IDLE",
      SPINNING: "SPIN",
      STOPPING: "STOP",
      RESULT: "WIN!",
    };
    const stateLabel = stateLabels[stateRef.current];
    const stateColor =
      stateRef.current === "RESULT" ? PAL.gradeA :
      stateRef.current === "SPINNING" ? PAL.gradeC :
      PAL.machineBorder;
    drawPixelText(ctx, stateLabel, mX + mW - 28, mY + mH - 14, 1, stateColor);
  }, [resultGrade]);

  // ── Animate reel scrolling ─────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100); // cap to avoid huge jumps
    lastTime.current = timestamp;

    const state = stateRef.current;

    if (state === "SPINNING" || state === "STOPPING") {
      for (let r = 0; r < REEL_COUNT; r++) {
        if (reelLocked.current[r]) continue;
        reelOffsets.current[r] = (reelOffsets.current[r]! + (reelSpeeds.current[r] ?? 0) * dt / 16) % (SYMBOL_STRIP.length * CELL_H);
      }

      // Check if all reels locked
      if (state === "STOPPING" && reelLocked.current.every((l) => l)) {
        changeState("RESULT");
        flashAlpha.current = 0.8;
        // Spawn explosion particles
        const cx = 80, cy = 100;
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2;
          const colors = [PAL.explodeA, PAL.explodeB, PAL.explodeC, PAL.gradeA, PAL.gradeC];
          explodeParticles.current.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 40 + Math.random() * 30,
            color: colors[Math.floor(Math.random() * colors.length)]!,
          });
        }
        onResult?.(resultGrade);
      }

      // Animate lever return
      if (leverAngle.current > 0) {
        leverAngle.current = Math.max(0, leverAngle.current - dt / 400);
      }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, onResult, resultGrade]);

  // ── Start/stop animation loop ──────────────────────────────────────────────
  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Handle click to pull lever ─────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_W / rect.width;
    const scaleY = NATIVE_H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    const state = stateRef.current;

    // PULL button area
    const mX = 10, mY = 8, mW = 160;
    const headerY = mY + 10;
    const reelAreaY = headerY + 20;
    const reelAreaH = REEL_VISIBLE * CELL_H + 4;
    const infoY = reelAreaY + reelAreaH + 8;
    const btnY = infoY + 22;
    const btnX = mX + 4;
    const btnW = mW - 8;
    const btnH = 20;

    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;

    // Lever click area
    const levX = mX + mW + 4;
    const onLever = nx >= levX && nx <= levX + 20 && ny >= 30 && ny <= 160;

    if ((onBtn || onLever) && (state === "IDLE" || state === "RESULT")) {
      startSpin();
    } else if ((onBtn || onLever) && state === "RESULT") {
      reset();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startSpin = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [4.5, 4.0, 3.5];
    reelLocked.current = [false, false, false];
    leverPulled.current = true;
    leverAngle.current = 1;
    changeState("SPINNING");

    // Schedule reel stopping — results slot into target grade
    const targetIdx = gradeIndex(resultGrade as Grade);

    [0, 1, 2].forEach((r) => {
      setTimeout(() => {
        // Decelerate this reel and snap to target
        const targetOffset = targetIdx * CELL_H + CELL_H; // center row
        reelSpeeds.current[r] = 1;
        setTimeout(() => {
          reelOffsets.current[r] = (targetOffset % (SYMBOL_STRIP.length * CELL_H) + SYMBOL_STRIP.length * CELL_H) % (SYMBOL_STRIP.length * CELL_H);
          reelSpeeds.current[r] = 0;
          reelLocked.current[r] = true;
          if (r === REEL_COUNT - 1) {
            changeState("STOPPING");
          }
        }, 300);
      }, 600 + r * 500);
    });
  }, [resultGrade, changeState]);

  const reset = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [0, 0, 0];
    reelLocked.current = [false, false, false];
    leverAngle.current = 0;
    flashAlpha.current = 0;
    explodeParticles.current = [];
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler needs startSpin/reset captured via closure ──────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_W / rect.width;
    const scaleY = NATIVE_H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    const mX = 10, mY = 8, mW = 160;
    const headerY = mY + 10;
    const reelAreaY = headerY + 20;
    const reelAreaH = REEL_VISIBLE * CELL_H + 4;
    const infoY = reelAreaY + reelAreaH + 8;
    const btnY = infoY + 22;
    const btnX = mX + 4;
    const btnW = mW - 8;
    const btnH = 20;

    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;
    const levX = mX + mW + 4;
    const onLever = nx >= levX && nx <= levX + 20 && ny >= 30 && ny <= 160;

    const state = stateRef.current;
    if ((onBtn || onLever) && state === "RESULT") {
      reset();
    } else if ((onBtn || onLever) && state === "IDLE") {
      startSpin();
    }
  }, [reset, startSpin]);

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
