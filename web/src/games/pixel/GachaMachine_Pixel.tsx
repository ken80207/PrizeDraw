"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GachaPixelGameState = "IDLE" | "TURNING" | "DROPPING" | "OPENING" | "RESULT";

export interface GachaMachinePixelProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GachaPixelGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const NATIVE_W = 200;
const NATIVE_H = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

const PAL = {
  // Machine body
  bodyRed:      "#cc2222",
  bodyRedLt:    "#ee4444",
  bodyRedDk:    "#881111",
  bodyBorder:   "#ff6666",
  bodyShadow:   "#550000",
  // Dome
  domeBlue:     "#4488cc",
  domeBlueLt:   "#66aaee",
  domeBlueDk:   "#225588",
  domeBorder:   "#88ccff",
  domeShine:    "#cceeFF",
  domeInner:    "#1a3a5a",
  // Capsule dots inside dome
  capA:         "#ffdd44",
  capADk:       "#aa8800",
  capB:         "#44dd88",
  capBDk:       "#228844",
  capC:         "#dd44ff",
  capCDk:       "#882299",
  capD:         "#ff8844",
  capDDk:       "#994422",
  // Handle
  handleBar:    "#888888",
  handleBarLt:  "#aaaaaa",
  handleBarDk:  "#555555",
  handleKnob:   "#ee3333",
  handleKnobLt: "#ff6655",
  handleKnobDk: "#992222",
  // Coin slot
  coinSlotBg:   "#111111",
  coinSlotBdr:  "#888888",
  // Chute
  chuteOuter:   "#333333",
  chuteInner:   "#111111",
  // Capsule
  capsuleTop1:  "#ffdd44",
  capsuleTop2:  "#ffaa00",
  capsuleBot1:  "#4488ff",
  capsuleBot2:  "#2255cc",
  capsuleSeam:  "#ffffff",
  // Grade colors
  gradeA:       "#ffd700",
  gradeB:       "#4488ff",
  gradeC:       "#44cc66",
  gradeD:       "#aa66ff",
  // UI
  white:        "#f0f0f0",
  black:        "#000000",
  yellow:       "#ffd700",
  // Win
  explodeA:     "#ffff00",
  explodeB:     "#ff8800",
  explodeC:     "#ff2200",
  // Base
  baseDk:       "#1a0000",
  baseMd:       "#2a1010",
  // Score
  scoreBg:      "#0a0a1a",
  scoreGreen:   "#00ff44",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pixel font
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_FONT: Record<string, number[][]> = {
  "A": [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "B": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  "C": [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  "D": [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  "E": [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "G": [[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
  "H": [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "I": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "N": [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  "O": [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  "P": [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  "R": [[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  "S": [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  "T": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  "Z": [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  "1": [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "0": [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
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
// Grade types and colors
// ─────────────────────────────────────────────────────────────────────────────

type Grade = "A賞" | "B賞" | "C賞" | "D賞";

const GRADE_TOP_COLOR: Record<Grade, string> = {
  "A賞": PAL.capsuleTop1,
  "B賞": PAL.capsuleBot1,
  "C賞": PAL.gradeC,
  "D賞": PAL.gradeD,
};

const GRADE_BOT_COLOR: Record<Grade, string> = {
  "A賞": PAL.capsuleTop2,
  "B賞": PAL.capsuleBot2,
  "C賞": "#228844",
  "D賞": "#773399",
};

const GRADE_MAIN_COLOR: Record<Grade, string> = {
  "A賞": PAL.gradeA,
  "B賞": PAL.gradeB,
  "C賞": PAL.gradeC,
  "D賞": PAL.gradeD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Draw dome pixel arc (hand-drawn semi-circle using fillRect)
// No ctx.arc() allowed
// ─────────────────────────────────────────────────────────────────────────────

// Dome spans x: domeX to domeX+domeW, top Y: domeTopY, flat base at domeBaseY
// We draw the dome as a series of horizontal pixel spans forming an arch

function drawDome(
  ctx: CanvasRenderingContext2D,
  cx: number,    // center x
  baseY: number, // flat base y
  rx: number,    // horizontal radius
  ry: number,    // vertical radius (height of arch)
) {
  // Inner fill
  ctx.fillStyle = PAL.domeInner;
  // Draw row by row from base upward
  for (let dy = 0; dy <= ry; dy++) {
    const t = dy / ry;
    // half-ellipse: x_offset = rx * sqrt(1 - t^2)
    const hw = Math.round(rx * Math.sqrt(1 - t * t));
    const rowY = baseY - dy;
    if (hw > 0) {
      ctx.fillRect(cx - hw, rowY, hw * 2, 1);
    }
  }

  // Dome border (1px outside)
  ctx.fillStyle = PAL.domeBorder;
  for (let dy = 0; dy <= ry; dy++) {
    const t = dy / ry;
    const hw = Math.round(rx * Math.sqrt(1 - t * t));
    const rowY = baseY - dy;
    if (hw > 0) {
      ctx.fillRect(cx - hw - 1, rowY, 1, 1);
      ctx.fillRect(cx + hw, rowY, 1, 1);
    }
  }
  // Base border line
  ctx.fillStyle = PAL.domeBorder;
  ctx.fillRect(cx - rx - 1, baseY + 1, rx * 2 + 2, 1);

  // Dome shine (top-left arc highlight)
  ctx.fillStyle = PAL.domeShine;
  for (let dy = Math.round(ry * 0.5); dy <= ry; dy++) {
    const t = dy / ry;
    const hw = Math.round(rx * Math.sqrt(1 - t * t));
    const rowY = baseY - dy;
    const shineW = Math.max(1, Math.round(hw * 0.35));
    ctx.fillRect(cx - hw + 1, rowY, shineW, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw capsule (8x12 pixel, two-tone with seam)
// ─────────────────────────────────────────────────────────────────────────────

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  topColor: string,
  botColor: string,
  openFrame: number, // 0=closed, 1=slightly open, 2=open wide
) {
  const W = 10, H = 14;
  const halfH = Math.floor(H / 2);

  if (openFrame === 0) {
    // Closed capsule
    // Top half
    ctx.fillStyle = topColor;
    ctx.fillRect(x + 1, y, W - 2, 1);
    ctx.fillRect(x, y + 1, W, halfH - 1);
    // Bottom half
    ctx.fillStyle = botColor;
    ctx.fillRect(x, y + halfH, W, halfH - 1);
    ctx.fillRect(x + 1, y + H - 1, W - 2, 1);
    // Seam
    ctx.fillStyle = PAL.capsuleSeam;
    ctx.fillRect(x, y + halfH - 1, W, 1);
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x + 1, y + 1, 2, 4);
  } else {
    const topOffset = openFrame === 1 ? 3 : 7;
    // Top half shifted up
    ctx.fillStyle = topColor;
    ctx.fillRect(x + 1, y - topOffset, W - 2, 1);
    ctx.fillRect(x, y + 1 - topOffset, W, halfH - 1);
    // Seam top half bottom
    ctx.fillStyle = PAL.capsuleSeam;
    ctx.fillRect(x, y + halfH - 1 - topOffset, W, 1);
    // Highlight on top
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x + 1, y + 1 - topOffset, 2, 3);

    // Bottom half stays
    ctx.fillStyle = botColor;
    ctx.fillRect(x, y + halfH, W, halfH - 1);
    ctx.fillRect(x + 1, y + H - 1, W - 2, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade icon inside open capsule
// ─────────────────────────────────────────────────────────────────────────────

// Simple 5x5 prize icon shapes
const PRIZE_ICONS: Record<Grade, number[][]> = {
  "A賞": [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [1,1,1,1,1],
    [0,1,0,1,0],
  ],
  "B賞": [
    [0,0,1,0,0],
    [0,1,1,1,0],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [1,0,0,0,1],
  ],
  "C賞": [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0],
    [0,0,0,0,0],
  ],
  "D賞": [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
};

function drawPrizeIcon(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  x: number,
  y: number,
  px: number,
) {
  const icon = PRIZE_ICONS[grade]!;
  const color = GRADE_MAIN_COLOR[grade]!;
  ctx.fillStyle = color;
  for (let row = 0; row < icon.length; row++) {
    for (let col = 0; col < icon[row]!.length; col++) {
      if (icon[row]![col]) {
        ctx.fillRect(x + col * px, y + row * px, px, px);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini capsule dots inside dome
// ─────────────────────────────────────────────────────────────────────────────

interface DomeCap {
  rx: number; // relative x from dome center
  ry: number; // relative y from dome base
  colorTop: string;
  colorBot: string;
}

const DOME_CAPS: DomeCap[] = [
  { rx: -18, ry: 14, colorTop: PAL.capA,  colorBot: PAL.capADk  },
  { rx:  -6, ry: 20, colorTop: PAL.capB,  colorBot: PAL.capBDk  },
  { rx:   8, ry: 18, colorTop: PAL.capC,  colorBot: PAL.capCDk  },
  { rx:  20, ry: 12, colorTop: PAL.capD,  colorBot: PAL.capDDk  },
  { rx: -22, ry:  6, colorTop: PAL.capB,  colorBot: PAL.capBDk  },
  { rx:   0, ry:  8, colorTop: PAL.capA,  colorBot: PAL.capADk  },
  { rx:  22, ry:  4, colorTop: PAL.capC,  colorBot: PAL.capCDk  },
  { rx: -10, ry:  4, colorTop: PAL.capD,  colorBot: PAL.capDDk  },
];

function drawDomeCaps(
  ctx: CanvasRenderingContext2D,
  domeCX: number,
  domeBaseY: number,
) {
  for (const cap of DOME_CAPS) {
    const cx = domeCX + cap.rx;
    const cy = domeBaseY - cap.ry;
    // Mini capsule (4x6)
    ctx.fillStyle = cap.colorTop;
    ctx.fillRect(cx, cy - 3, 4, 3);
    ctx.fillStyle = cap.colorBot;
    ctx.fillRect(cx, cy, 4, 3);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(cx + 1, cy - 2, 1, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachinePixel({
  resultGrade = "A賞",
  prizeName: _prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachinePixelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GachaPixelGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [, setGameState] = useState<GachaPixelGameState>("IDLE");

  // Handle knob rotation: 0-3 (4 frames)
  const handleRotation = useRef(0);
  const handleAnimTimer = useRef(0);
  // Capsule drop position (Y offset below chute, 0 = in chute)
  const capsuleDropY = useRef(-999); // -999 = not visible
  const capsuleOpenFrame = useRef(0); // 0=closed, 1=half, 2=open
  const bounceDir = useRef(1); // for bounce animation
  const bounceCount = useRef(0);
  const flashAlpha = useRef(0);
  const blinkTimer = useRef(0);
  const lightOn = useRef(true);
  const explodeParticles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);

  const changeState = useCallback((s: GachaPixelGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // Machine geometry
    const bodyX = 20;
    const bodyY = 110;
    const bodyW = 160;
    const bodyH = 120;
    const domeCX = bodyX + Math.floor(bodyW / 2);
    const domeBaseY = bodyY - 1;
    const domeRX = 58;
    const domeRY = 48;

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

    // ── Base / stand ────────────────────────────────────────────────────────
    const baseX = bodyX + 20;
    const baseY = bodyY + bodyH;
    const baseW = bodyW - 40;
    ctx.fillStyle = PAL.baseMd;
    ctx.fillRect(baseX, baseY, baseW, 10);
    ctx.fillStyle = PAL.baseDk;
    ctx.fillRect(baseX, baseY + 8, baseW, 3);
    ctx.fillStyle = PAL.handleBarLt;
    ctx.fillRect(baseX, baseY, baseW, 1);
    // Foot widening
    ctx.fillStyle = PAL.baseMd;
    ctx.fillRect(baseX - 8, baseY + 3, baseW + 16, 8);
    ctx.fillStyle = PAL.baseDk;
    ctx.fillRect(baseX - 8, baseY + 9, baseW + 16, 3);

    // ── Machine body ────────────────────────────────────────────────────────
    ctx.fillStyle = PAL.bodyRed;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    // Top edge highlight
    ctx.fillStyle = PAL.bodyRedLt;
    ctx.fillRect(bodyX, bodyY, bodyW, 3);
    ctx.fillRect(bodyX, bodyY, 2, bodyH);
    // Bottom shadow
    ctx.fillStyle = PAL.bodyRedDk;
    ctx.fillRect(bodyX, bodyY + bodyH - 3, bodyW, 3);
    ctx.fillRect(bodyX + bodyW - 2, bodyY, 2, bodyH);
    // Body border (1px dark)
    ctx.fillStyle = PAL.bodyShadow;
    ctx.fillRect(bodyX - 1, bodyY - 1, bodyW + 2, 1);
    ctx.fillRect(bodyX - 1, bodyY + bodyH, bodyW + 2, 1);
    ctx.fillRect(bodyX - 1, bodyY, 1, bodyH);
    ctx.fillRect(bodyX + bodyW, bodyY, 1, bodyH);

    // ── Body decorative border strips ────────────────────────────────────────
    ctx.fillStyle = PAL.bodyBorder;
    ctx.fillRect(bodyX + 4, bodyY + 4, bodyW - 8, 2);
    ctx.fillRect(bodyX + 4, bodyY + bodyH - 6, bodyW - 8, 2);
    ctx.fillRect(bodyX + 4, bodyY + 4, 2, bodyH - 8);
    ctx.fillRect(bodyX + bodyW - 6, bodyY + 4, 2, bodyH - 8);

    // ── Blinking lights on body ──────────────────────────────────────────────
    blinkTimer.current += dt;
    if (blinkTimer.current > 400) {
      blinkTimer.current = 0;
      lightOn.current = !lightOn.current;
    }
    const lc = lightOn.current ? PAL.yellow : "#665500";
    const lightXs = [bodyX + 8, bodyX + 18, bodyX + 28, bodyX + 38, bodyX + bodyW - 38, bodyX + bodyW - 28, bodyX + bodyW - 18, bodyX + bodyW - 8];
    for (let i = 0; i < lightXs.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? lc : (lightOn.current ? "#ff4444" : "#662222");
      ctx.fillRect(lightXs[i]!, bodyY + 7, 4, 4);
    }

    // ── Body text: "GACHA PRIZE" ─────────────────────────────────────────────
    drawPixelText(ctx, "GACHA", bodyX + 14, bodyY + 18, 2, PAL.white);
    drawPixelText(ctx, "PRIZE", bodyX + 14, bodyY + 30, 2, PAL.yellow);

    // ── Coin slot ────────────────────────────────────────────────────────────
    const coinX = bodyX + 14;
    const coinY = bodyY + 48;
    ctx.fillStyle = PAL.coinSlotBdr;
    ctx.fillRect(coinX, coinY, 28, 14);
    ctx.fillStyle = PAL.coinSlotBg;
    ctx.fillRect(coinX + 1, coinY + 1, 26, 12);
    // Coin slot opening (horizontal slit)
    ctx.fillStyle = "#222222";
    ctx.fillRect(coinX + 4, coinY + 5, 18, 3);
    ctx.fillStyle = "#000000";
    ctx.fillRect(coinX + 4, coinY + 6, 18, 1);
    // "100" label
    drawPixelText(ctx, "100", coinX + 2, coinY + 15, 1, PAL.yellow);

    // ── Handle (bar + knob) ───────────────────────────────────────────────────
    const handleBarX = bodyX + bodyW - 44;
    const handleBarY = bodyY + 52;
    const handleBarW = 32;
    // Horizontal bar
    ctx.fillStyle = PAL.handleBar;
    ctx.fillRect(handleBarX, handleBarY, handleBarW, 5);
    ctx.fillStyle = PAL.handleBarLt;
    ctx.fillRect(handleBarX, handleBarY, handleBarW, 1);
    ctx.fillStyle = PAL.handleBarDk;
    ctx.fillRect(handleBarX, handleBarY + 4, handleBarW, 1);
    // Connector to body (small vertical piece)
    ctx.fillStyle = PAL.handleBarDk;
    ctx.fillRect(handleBarX, handleBarY + 5, 4, 6);

    // Knob (7x7 pixel circle-ish)
    const knobX = handleBarX + handleBarW - 6;
    const knobY = handleBarY - 1;
    // Draw knob based on rotation frame
    const rot = handleRotation.current % 4;
    ctx.fillStyle = PAL.handleKnob;
    ctx.fillRect(knobX + 1, knobY, 5, 7);
    ctx.fillRect(knobX, knobY + 1, 7, 5);
    // Highlight
    ctx.fillStyle = PAL.handleKnobLt;
    if (rot === 0) { ctx.fillRect(knobX + 1, knobY + 1, 2, 2); }
    else if (rot === 1) { ctx.fillRect(knobX + 4, knobY + 1, 2, 2); }
    else if (rot === 2) { ctx.fillRect(knobX + 4, knobY + 4, 2, 2); }
    else { ctx.fillRect(knobX + 1, knobY + 4, 2, 2); }
    // Knob shadow
    ctx.fillStyle = PAL.handleKnobDk;
    ctx.fillRect(knobX + 1, knobY + 6, 5, 1);
    ctx.fillRect(knobX + 6, knobY + 1, 1, 5);
    // Connection line knob to bar
    ctx.fillStyle = PAL.handleBarDk;
    ctx.fillRect(knobX + 2, handleBarY + 5, 3, 4);

    // ── Chute opening ─────────────────────────────────────────────────────────
    const chuteX = bodyX + Math.floor(bodyW / 2) - 10;
    const chuteY = bodyY + bodyH - 22;
    ctx.fillStyle = PAL.chuteOuter;
    ctx.fillRect(chuteX - 2, chuteY, 24, 20);
    ctx.fillStyle = PAL.chuteInner;
    ctx.fillRect(chuteX, chuteY + 2, 20, 16);
    // Chute highlight
    ctx.fillStyle = PAL.handleBarLt;
    ctx.fillRect(chuteX - 2, chuteY, 24, 1);
    ctx.fillRect(chuteX - 2, chuteY, 1, 20);
    // Arrow down into chute
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(chuteX + 8, chuteY + 4, 4, 1);
    ctx.fillRect(chuteX + 7, chuteY + 5, 6, 1);
    ctx.fillRect(chuteX + 8, chuteY + 6, 4, 1);
    ctx.fillRect(chuteX + 9, chuteY + 7, 2, 1);

    // ── Dome (drawn on top of body area) ─────────────────────────────────────
    drawDome(ctx, domeCX, domeBaseY, domeRX, domeRY);
    // Mini capsules inside dome
    drawDomeCaps(ctx, domeCX, domeBaseY);
    // Dome-body connector (neck)
    ctx.fillStyle = PAL.bodyRedDk;
    ctx.fillRect(domeCX - domeRX, domeBaseY, domeRX * 2, 4);
    ctx.fillStyle = PAL.bodyRed;
    ctx.fillRect(domeCX - domeRX + 2, domeBaseY, domeRX * 2 - 4, 2);

    // ── Dropped capsule ───────────────────────────────────────────────────────
    const state = stateRef.current;
    if (state === "DROPPING" || state === "OPENING" || state === "RESULT") {
      const capDrawX = chuteX + 5;
      const capDrawY = chuteY + bodyH - 8 + capsuleDropY.current;
      const tg = resultGrade as Grade;
      const topC = GRADE_TOP_COLOR[tg] ?? PAL.capsuleTop1;
      const botC = GRADE_BOT_COLOR[tg] ?? PAL.capsuleBot1;

      drawCapsule(ctx, capDrawX, capDrawY, topC, botC, capsuleOpenFrame.current);

      // Prize icon inside open capsule
      if (capsuleOpenFrame.current >= 2) {
        drawPrizeIcon(ctx, tg, capDrawX + 2, capDrawY + 1, 1);
      } else if (capsuleOpenFrame.current === 1) {
        drawPrizeIcon(ctx, tg, capDrawX + 2, capDrawY + 3, 1);
      }
    }

    // ── Explosion particles ───────────────────────────────────────────────────
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
      flashAlpha.current = Math.max(0, flashAlpha.current - dt / 90);
    }

    // ── Win text ──────────────────────────────────────────────────────────────
    if (state === "RESULT") {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(bodyX + 8, bodyY + 56, bodyW - 16, 20);
      drawPixelText(ctx, "GET!", bodyX + 16, bodyY + 60, 2, PAL.yellow);
      const tg = resultGrade as Grade;
      const wgColor = GRADE_MAIN_COLOR[tg] ?? PAL.white;
      ctx.fillStyle = wgColor;
      ctx.fillRect(bodyX + 80, bodyY + 60, 10, 12);
      drawPixelText(ctx, tg[0] ?? "", bodyX + 82, bodyY + 63, 1, PAL.black);
    }

    // ── Target display ────────────────────────────────────────────────────────
    const tgDispY = bodyY + bodyH + 15;
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(bodyX + 4, tgDispY, bodyW - 8, 12);
    ctx.fillStyle = "#223322";
    ctx.fillRect(bodyX + 4, tgDispY, bodyW - 8, 1);
    ctx.fillRect(bodyX + 4, tgDispY + 11, bodyW - 8, 1);
    drawPixelText(ctx, "TARGET", bodyX + 8, tgDispY + 4, 1, PAL.scoreGreen);
    const tgC = GRADE_MAIN_COLOR[resultGrade as Grade] ?? PAL.white;
    drawPixelText(ctx, resultGrade[0] ?? "", bodyX + bodyW - 20, tgDispY + 4, 1, tgC);

    // ── Start button ──────────────────────────────────────────────────────────
    const startY = tgDispY + 16;
    const isIdle = state === "IDLE";
    const isResult = state === "RESULT";
    const canStart = isIdle || isResult;
    ctx.fillStyle = canStart ? "#224422" : "#111811";
    ctx.fillRect(bodyX + 4, startY, bodyW - 8, 12);
    ctx.fillStyle = canStart ? "#44aa44" : "#334433";
    ctx.fillRect(bodyX + 4, startY, bodyW - 8, 2);
    const btnLabel = isResult ? "RESET" : "START";
    drawPixelText(ctx, btnLabel, bodyX + Math.floor((bodyW - btnLabel.length * 4) / 2) + 4, startY + 4, 1, canStart ? PAL.white : "#445544");

    // ── State label ────────────────────────────────────────────────────────────
    const stateLabels: Record<GachaPixelGameState, string> = {
      IDLE:     "IDLE",
      TURNING:  "TURN",
      DROPPING: "DROP",
      OPENING:  "OPEN",
      RESULT:   "WIN!",
    };
    const stateColors: Record<GachaPixelGameState, string> = {
      IDLE:     "#5a5a8a",
      TURNING:  PAL.gradeC,
      DROPPING: PAL.gradeB,
      OPENING:  PAL.gradeA,
      RESULT:   PAL.yellow,
    };
    drawPixelText(ctx, stateLabels[stateRef.current], bodyX + bodyW - 28, bodyY + bodyH + 4, 1, stateColors[stateRef.current]);
  }, [resultGrade]);

  // ── Animation loop ───────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    // Idle handle sway animation
    if (stateRef.current === "IDLE") {
      handleAnimTimer.current += dt;
      if (handleAnimTimer.current > 800) {
        handleAnimTimer.current = 0;
        handleRotation.current = (handleRotation.current + 1) % 4;
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

  // ── Start sequence ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "RESULT") return;

    // Reset state
    capsuleDropY.current = -999;
    capsuleOpenFrame.current = 0;
    bounceCount.current = 0;
    explodeParticles.current = [];
    flashAlpha.current = 0;

    changeState("TURNING");

    // Step 1: Spin handle (rapid rotation for 600ms)
    let spinCount = 0;
    const spinInterval = setInterval(() => {
      handleRotation.current = (handleRotation.current + 1) % 4;
      spinCount++;
      if (spinCount >= 12) {
        clearInterval(spinInterval);
        // Step 2: Capsule drop
        changeState("DROPPING");
        capsuleDropY.current = 0;
        const dropInterval = setInterval(() => {
          capsuleDropY.current += 4;
          if (capsuleDropY.current >= 40) {
            capsuleDropY.current = 40;
            clearInterval(dropInterval);
            // Bounce 1
            bounceDir.current = -1;
            const bounce1 = setInterval(() => {
              capsuleDropY.current += bounceDir.current * 3;
              if (capsuleDropY.current <= 28) { bounceDir.current = 1; }
              if (capsuleDropY.current >= 40) {
                capsuleDropY.current = 40;
                clearInterval(bounce1);
                // Bounce 2 (smaller)
                bounceDir.current = -1;
                const bounce2 = setInterval(() => {
                  capsuleDropY.current += bounceDir.current * 2;
                  if (capsuleDropY.current <= 34) { bounceDir.current = 1; }
                  if (capsuleDropY.current >= 40) {
                    capsuleDropY.current = 40;
                    clearInterval(bounce2);
                    // Step 3: Open capsule
                    changeState("OPENING");
                    setTimeout(() => { capsuleOpenFrame.current = 1; }, 150);
                    setTimeout(() => {
                      capsuleOpenFrame.current = 2;
                      flashAlpha.current = 0.8;
                      // Spawn explosion particles
                      const bodyX = 20;
                      const bodyY = 110;
                      const bodyW = 160;
                      const bodyH = 120;
                      const chuteX2 = bodyX + Math.floor(bodyW / 2) - 10;
                      const chuteY2 = bodyY + bodyH - 22;
                      const px = chuteX2 + 5 + 5;
                      const py = chuteY2 + bodyH - 8 + capsuleDropY.current;
                      for (let i = 0; i < 18; i++) {
                        const angle = (i / 18) * Math.PI * 2;
                        const speed = 1 + Math.random() * 2.5;
                        const colors = [PAL.explodeA, PAL.explodeB, PAL.explodeC, PAL.yellow, GRADE_MAIN_COLOR[resultGrade as Grade] ?? PAL.white];
                        explodeParticles.current.push({
                          x: px, y: py,
                          vx: Math.cos(angle) * speed,
                          vy: Math.sin(angle) * speed,
                          life: 30 + Math.random() * 25,
                          color: colors[Math.floor(Math.random() * colors.length)]!,
                        });
                      }
                      changeState("RESULT");
                      onResult?.(resultGrade);
                    }, 350);
                  }
                }, 30);
              }
            }, 30);
          }
        }, 30);
      }
    }, 50);
  }, [resultGrade, changeState, onResult]);

  // ── Click handler ─────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_W / rect.width;
    const scaleY = NATIVE_H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    const bodyX = 20;
    const bodyY = 110;
    const bodyW = 160;
    const bodyH = 120;
    const tgDispY = bodyY + bodyH + 15;
    const startY = tgDispY + 16;

    // Handle knob click
    const handleBarX = bodyX + bodyW - 44;
    const handleBarY = bodyY + 52;
    const handleBarW = 32;
    const knobX = handleBarX + handleBarW - 6;
    const knobY = handleBarY - 1;
    const onKnob = nx >= knobX && nx <= knobX + 7 && ny >= knobY && ny <= knobY + 7;

    // Start button
    const onStart = nx >= bodyX + 4 && nx <= bodyX + bodyW - 4 && ny >= startY && ny <= startY + 12;

    const state = stateRef.current;
    if ((onStart || onKnob) && (state === "IDLE" || state === "RESULT")) {
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
