"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NeonClawGameState =
  | "IDLE"
  | "AIMING"
  | "DESCENDING"
  | "GRABBING"
  | "LIFTING"
  | "DROPPING"
  | "RESULT";

export interface ClawMachineNeonProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: NeonClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas dimensions
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 440;

// ─────────────────────────────────────────────────────────────────────────────
// Neon palette (same tokens as SlotMachine_Neon)
// ─────────────────────────────────────────────────────────────────────────────

const NEO = {
  bg:       "#0a0a1a",
  bgMid:    "#0d0d22",
  pink:     "#ff00ff",
  cyan:     "#00ffff",
  green:    "#00ff66",
  yellow:   "#ffff00",
  orange:   "#ff6600",
  white:    "#ffffff",
  dimCyan:  "#006666",
  dimGreen: "#006633",
  gridLine: "rgba(0,255,255,0.06)",
  gradeA:   "#ffd700",
  gradeB:   "#00ffff",
  gradeC:   "#00ff66",
  gradeD:   "#ff00ff",
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": NEO.gradeA,
  "B賞": NEO.gradeB,
  "C賞": NEO.gradeC,
  "D賞": NEO.gradeD,
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────

// Machine frame
const FRAME_X = 10;
const FRAME_Y = 8;
const FRAME_W = 220;
const FRAME_H = H - 16;

// Glass interior
const GLASS_X = FRAME_X + 8;
const GLASS_Y = FRAME_Y + 44;
const GLASS_W = FRAME_W - 16;
const GLASS_H = FRAME_H - 90;

// Floor inside glass
const FLOOR_Y = GLASS_Y + GLASS_H - 1;

// Rail for claw to slide along (near top of glass)
const RAIL_Y = GLASS_Y + 18;
const RAIL_X1 = GLASS_X + 6;
const RAIL_X2 = GLASS_X + GLASS_W - 6;

// Control panel (right of glass)
const PANEL_X = FRAME_X + FRAME_W + 4;
const PANEL_Y = FRAME_Y + 30;
const PANEL_W = 84;
const PANEL_H = FRAME_H - 30;

// ─────────────────────────────────────────────────────────────────────────────
// Toy positions (static decorative capsules inside glass)
// ─────────────────────────────────────────────────────────────────────────────

interface Toy {
  x: number;
  y: number;
  grade: string;
  size: number;
}

const INITIAL_TOYS: Toy[] = [
  { x: GLASS_X + 22,  y: FLOOR_Y - 18, grade: "D賞", size: 14 },
  { x: GLASS_X + 50,  y: FLOOR_Y - 16, grade: "C賞", size: 13 },
  { x: GLASS_X + 80,  y: FLOOR_Y - 20, grade: "B賞", size: 16 },
  { x: GLASS_X + 112, y: FLOOR_Y - 15, grade: "D賞", size: 12 },
  { x: GLASS_X + 140, y: FLOOR_Y - 19, grade: "A賞", size: 15 },
  { x: GLASS_X + 170, y: FLOOR_Y - 16, grade: "C賞", size: 13 },
  { x: GLASS_X + 36,  y: FLOOR_Y - 40, grade: "B賞", size: 12 },
  { x: GLASS_X + 96,  y: FLOOR_Y - 38, grade: "A賞", size: 14 },
  { x: GLASS_X + 155, y: FLOOR_Y - 37, grade: "D賞", size: 11 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Neon draw helpers (mirrored from SlotMachine_Neon)
// ─────────────────────────────────────────────────────────────────────────────

function setNeonStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  width = 2,
) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineWidth = width;
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function neonRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  blur = 15,
  lw = 2,
) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = blur * 0.3;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function neonLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  blur = 12,
  lw = 2,
) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function neonCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  blur = 12,
  lw = 2,
) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function neonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
  blur = 18,
  align: CanvasTextAlign = "center",
) {
  ctx.save();
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur * 0.4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = NEO.gridLine;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  const GRID = 24;
  for (let x = 0; x <= W; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#000";
  for (let y = offset % 3; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Draw a neon toy shape per grade
function drawToy(
  ctx: CanvasRenderingContext2D,
  toy: Toy,
  blur: number,
  alpha = 1,
) {
  const col = GRADE_COLOR[toy.grade] ?? NEO.pink;
  const { x, y, size } = toy;
  ctx.save();
  ctx.globalAlpha = alpha;
  switch (toy.grade) {
    case "A賞": {
      // Gold crown outline
      setNeonStroke(ctx, col, blur, 1.5);
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x - size, y - size * 0.6);
      ctx.lineTo(x - size * 0.5, y - size * 0.2);
      ctx.lineTo(x, y - size);
      ctx.lineTo(x + size * 0.5, y - size * 0.2);
      ctx.lineTo(x + size, y - size * 0.6);
      ctx.lineTo(x + size, y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "B賞": {
      // Cyan star
      setNeonStroke(ctx, col, blur, 1.5);
      ctx.beginPath();
      const pts5 = 5;
      for (let i = 0; i < pts5 * 2; i++) {
        const angle = (i * Math.PI) / pts5 - Math.PI / 2;
        const r = i % 2 === 0 ? size : size * 0.4;
        const px = x + Math.cos(angle) * r;
        const py = y - size * 0.5 + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "C賞": {
      // Green diamond
      setNeonStroke(ctx, col, blur, 1.5);
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.7, y - size * 0.4);
      ctx.lineTo(x + size * 0.7, y + size * 0.4);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.7, y + size * 0.4);
      ctx.lineTo(x - size * 0.7, y - size * 0.4);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    default: {
      // Magenta circle (D賞)
      neonCircle(ctx, x, y - size * 0.4, size * 0.6, col, blur, 1.5);
      break;
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Claw geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawClaw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cabletopY: number,
  cableBottomY: number,
  openFrac: number, // 0=closed 1=fully open
  color: string,
  blur: number,
) {
  // Cable
  neonLine(ctx, cx, cabletopY, cx, cableBottomY, color, blur * 0.6, 1);

  // Hub
  neonCircle(ctx, cx, cableBottomY, 5, color, blur, 1.5);

  // 3 prongs
  const hubY = cableBottomY + 5;
  const spread = openFrac * 14;
  const prongLength = 22;

  const prongs: [number, number, number, number][] = [
    [cx, hubY, cx - spread, hubY + prongLength],
    [cx, hubY, cx, hubY + prongLength * 1.05],
    [cx, hubY, cx + spread, hubY + prongLength],
  ];

  ctx.save();
  setNeonStroke(ctx, color, blur, 1.5);
  ctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of prongs) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine_Neon({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachineNeonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<NeonClawGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<NeonClawGameState>("IDLE");

  // Claw position
  const clawX = useRef((RAIL_X1 + RAIL_X2) / 2);
  const clawCableTop = useRef(RAIL_Y);
  const clawCableBottom = useRef(RAIL_Y + 28);
  const clawOpen = useRef(1); // 1=open, 0=closed
  const grabFlash = useRef(0); // flash alpha on grab

  // Aiming state
  const aimDir = useRef(0); // -1 left, 0 still, 1 right
  const aimSpeed = 1.4;

  // Drop trail particles
  const trailParticles = useRef<
    { x: number; y: number; alpha: number; vy: number }[]
  >([]);

  // Win ring particles
  const ringParticles = useRef<
    { x: number; y: number; r: number; maxR: number; alpha: number; color: string }[]
  >([]);

  // Floating ambient dots
  const floatDots = useRef<
    { x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]
  >([]);

  // Animation bookkeeping
  const pulseT = useRef(0);
  const scanOffset = useRef(0);
  const lastTime = useRef(0);
  const flashAlpha = useRef(0);
  const flashColor = useRef(NEO.pink);

  // Toys inside machine (remove the target toy on grab)
  const toysRef = useRef<Toy[]>(INITIAL_TOYS.map((t) => ({ ...t })));
  const grabbedToy = useRef<Toy | null>(null);

  useEffect(() => {
    const colors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow, NEO.orange];
    floatDots.current = Array.from({ length: 16 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.3,
      color: colors[i % colors.length]!,
      alpha: 0.25 + Math.random() * 0.45,
      size: 1 + Math.random() * 1.8,
    }));
  }, []);

  const changeState = useCallback(
    (s: NeonClawGameState) => {
      stateRef.current = s;
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(
    (dt: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      pulseT.current += dt * 0.003;
      scanOffset.current += dt * 0.05;

      const pt = pulseT.current;

      // ── Background
      ctx.fillStyle = NEO.bg;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx);

      // ── Floating dots
      for (const dot of floatDots.current) {
        dot.x += (dot.vx * dt) / 16;
        dot.y += (dot.vy * dt) / 16;
        if (dot.y < -4) { dot.y = H + 4; dot.x = Math.random() * W; }
        if (dot.x < -4) dot.x = W + 4;
        if (dot.x > W + 4) dot.x = -4;
        ctx.save();
        ctx.globalAlpha = dot.alpha * (0.6 + 0.4 * Math.sin(pt * 2 + dot.x));
        ctx.fillStyle = dot.color;
        ctx.shadowColor = dot.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Machine frame (magenta outline)
      ctx.fillStyle = NEO.bgMid;
      ctx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
      const frameGlow = 12 + 5 * Math.sin(pt);
      neonRect(ctx, FRAME_X, FRAME_Y, FRAME_W, FRAME_H, NEO.pink, frameGlow, 2);
      neonRect(ctx, FRAME_X + 3, FRAME_Y + 3, FRAME_W - 6, FRAME_H - 6, NEO.cyan, 5, 1);

      // ── Header label
      neonText(ctx, "CLAW", FRAME_X + FRAME_W / 2 - 22, FRAME_Y + 20, NEO.pink, 14, 20);
      neonText(ctx, "MACHINE", FRAME_X + FRAME_W / 2 + 30, FRAME_Y + 20, NEO.cyan, 10, 14);

      // ── Glass case (cyan tinted border, dark interior)
      ctx.fillStyle = "rgba(0,12,20,0.92)";
      ctx.fillRect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
      neonRect(ctx, GLASS_X, GLASS_Y, GLASS_W, GLASS_H, NEO.cyan, 10, 1.5);

      // ── Floor grid lines inside glass
      ctx.save();
      ctx.beginPath();
      ctx.rect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
      ctx.clip();
      ctx.strokeStyle = "rgba(0,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      const gridSpacing = 20;
      for (let gx = GLASS_X; gx <= GLASS_X + GLASS_W; gx += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(gx, GLASS_Y);
        ctx.lineTo(gx, FLOOR_Y);
        ctx.stroke();
      }
      for (let gy = GLASS_Y; gy <= FLOOR_Y; gy += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(GLASS_X, gy);
        ctx.lineTo(GLASS_X + GLASS_W, gy);
        ctx.stroke();
      }
      ctx.restore();

      // ── Floor neon line
      neonLine(ctx, GLASS_X + 2, FLOOR_Y, GLASS_X + GLASS_W - 2, FLOOR_Y, NEO.cyan, 8, 1);

      // ── Toys
      ctx.save();
      ctx.beginPath();
      ctx.rect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
      ctx.clip();
      for (const toy of toysRef.current) {
        const isTarget =
          toy.grade === resultGrade && toy === toysRef.current.find((t) => t.grade === resultGrade);
        const toyBlur = isTarget ? 16 : 8;
        const toyAlpha = isTarget ? 1 : 0.65;
        drawToy(ctx, toy, toyBlur, toyAlpha);
      }
      // Grabbed toy follows claw up
      if (grabbedToy.current) {
        const gt = grabbedToy.current;
        const col = GRADE_COLOR[gt.grade] ?? NEO.pink;
        const offsetY = clawCableBottom.current + 28 - FLOOR_Y;
        drawToy(
          ctx,
          { ...gt, y: FLOOR_Y + offsetY },
          18,
          1,
        );
        // Glow trail behind grabbed toy during lift
        if (stateRef.current === "LIFTING") {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.shadowColor = col;
          ctx.shadowBlur = 20;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(gt.x, FLOOR_Y + offsetY + gt.size);
          ctx.lineTo(gt.x, FLOOR_Y + offsetY + gt.size + 30);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();

      // ── Rail (neon cyan horizontal line)
      neonLine(ctx, RAIL_X1, RAIL_Y, RAIL_X2, RAIL_Y, NEO.cyan, 12, 2);
      // Rail end caps
      neonCircle(ctx, RAIL_X1, RAIL_Y, 3, NEO.cyan, 8, 1.5);
      neonCircle(ctx, RAIL_X2, RAIL_Y, 3, NEO.cyan, 8, 1.5);

      // ── Trail particles
      for (const tp of trailParticles.current) {
        tp.alpha -= dt * 0.004;
        tp.y += (tp.vy * dt) / 16;
        if (tp.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = tp.alpha;
          ctx.fillStyle = NEO.cyan;
          ctx.shadowColor = NEO.cyan;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      trailParticles.current = trailParticles.current.filter((p) => p.alpha > 0);

      // ── Claw
      const clawCol = stateRef.current === "GRABBING" ? NEO.yellow : NEO.cyan;
      const clawBlur =
        stateRef.current === "GRABBING"
          ? 22 + 8 * Math.sin(pt * 6)
          : 12 + 4 * Math.sin(pt * 2);
      drawClaw(
        ctx,
        clawX.current,
        clawCableTop.current,
        clawCableBottom.current,
        clawOpen.current,
        clawCol,
        clawBlur,
      );

      // ── Control panel background
      ctx.fillStyle = NEO.bgMid;
      ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
      neonRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, NEO.pink, 8, 1.5);

      // ── Arrow buttons (left / right)
      const arrowY = PANEL_Y + 30;
      const arrowSize = 14;
      const arrowPulse = 0.7 + 0.3 * Math.sin(pt * 3);
      const canAim = stateRef.current === "IDLE" || stateRef.current === "AIMING";

      // Left arrow button
      ctx.save();
      ctx.globalAlpha = canAim ? arrowPulse : 0.2;
      neonRect(ctx, PANEL_X + 4, arrowY, arrowSize * 2, arrowSize * 2, NEO.cyan, 10, 1.5);
      ctx.strokeStyle = NEO.cyan;
      ctx.shadowColor = NEO.cyan;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PANEL_X + 4 + arrowSize * 2 - 4, arrowY + arrowSize - 5);
      ctx.lineTo(PANEL_X + 4 + 6, arrowY + arrowSize);
      ctx.lineTo(PANEL_X + 4 + arrowSize * 2 - 4, arrowY + arrowSize + 5);
      ctx.stroke();
      ctx.restore();

      // Right arrow button
      ctx.save();
      ctx.globalAlpha = canAim ? arrowPulse : 0.2;
      neonRect(ctx, PANEL_X + 4 + arrowSize * 2 + 6, arrowY, arrowSize * 2, arrowSize * 2, NEO.cyan, 10, 1.5);
      ctx.strokeStyle = NEO.cyan;
      ctx.shadowColor = NEO.cyan;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PANEL_X + 4 + arrowSize * 2 + 6 + 4, arrowY + arrowSize - 5);
      ctx.lineTo(PANEL_X + 4 + arrowSize * 2 + 6 + arrowSize * 2 - 6, arrowY + arrowSize);
      ctx.lineTo(PANEL_X + 4 + arrowSize * 2 + 6 + 4, arrowY + arrowSize + 5);
      ctx.stroke();
      ctx.restore();

      // ── Drop button (pulsing neon red circle outline)
      const dropBtnCX = PANEL_X + PANEL_W / 2;
      const dropBtnCY = arrowY + arrowSize * 2 + 28;
      const dropBtnR = 18;
      const dropPulse = canAim
        ? 0.6 + 0.4 * Math.sin(pt * 5)
        : 0.15;
      const dropBlur = canAim ? 16 + 8 * Math.sin(pt * 5) : 4;
      ctx.save();
      ctx.globalAlpha = dropPulse;
      neonCircle(ctx, dropBtnCX, dropBtnCY, dropBtnR, "#ff2244", dropBlur, 2.5);
      neonCircle(ctx, dropBtnCX, dropBtnCY, dropBtnR - 5, "#ff2244", dropBlur * 0.4, 1);
      ctx.restore();
      neonText(ctx, "DROP", dropBtnCX, dropBtnCY, "#ff2244", 8, canAim ? 10 : 4);

      // ── Target grade display
      const targetCol = GRADE_COLOR[resultGrade] ?? NEO.pink;
      const tgY = PANEL_Y + PANEL_H - 60;
      neonRect(ctx, PANEL_X + 4, tgY, PANEL_W - 8, 22, targetCol, 8, 1);
      neonText(ctx, resultGrade, PANEL_X + PANEL_W / 2, tgY + 11, targetCol, 9, 12);

      // ── PLAY/RESET button at bottom of panel
      const isResult = stateRef.current === "RESULT";
      const isIdle = stateRef.current === "IDLE";
      const btnLabel = isResult ? "RESET" : isIdle ? "PLAY" : "...";
      const btnCol = isResult ? NEO.cyan : isIdle ? NEO.green : NEO.dimGreen;
      const btnPulse = isResult || isIdle ? 0.7 + 0.3 * Math.sin(pt * 4) : 0.3;
      const btnY2 = PANEL_Y + PANEL_H - 30;

      ctx.save();
      ctx.globalAlpha = btnPulse;
      neonRect(ctx, PANEL_X + 4, btnY2, PANEL_W - 8, 22, btnCol, isResult || isIdle ? 16 : 4, 2);
      ctx.restore();
      neonText(ctx, btnLabel, PANEL_X + PANEL_W / 2, btnY2 + 11, btnCol, 9, isResult || isIdle ? 14 : 4);

      // ── Win result overlay
      if (stateRef.current === "RESULT") {
        const jt = pt * 2;
        const jackpotColors = [NEO.pink, NEO.cyan, NEO.yellow, NEO.green];
        const jCol = jackpotColors[Math.floor(jt / 0.8) % jackpotColors.length]!;
        const cx = FRAME_X + FRAME_W / 2;
        const cy = FRAME_Y + FRAME_H / 2 - 10;
        neonText(ctx, "GET!", cx, cy, jCol, 26, 36);
        neonText(ctx, resultGrade, cx, cy + 32, targetCol, 15, 22);
        neonText(ctx, prizeName, cx, cy + 52, NEO.white, 9, 10);
      }

      // ── Win ring particles
      for (const p of ringParticles.current) {
        p.r += (dt * 0.14);
        p.alpha -= dt * 0.007;
        if (p.alpha > 0 && p.r < p.maxR) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.strokeStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 20;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      ringParticles.current = ringParticles.current.filter(
        (p) => p.alpha > 0 && p.r < p.maxR,
      );

      // ── Grab flash
      if (grabFlash.current > 0) {
        ctx.save();
        ctx.globalAlpha = grabFlash.current * 0.5;
        ctx.fillStyle = NEO.cyan;
        ctx.fillRect(GLASS_X, GLASS_Y, GLASS_W, GLASS_H);
        ctx.restore();
        grabFlash.current = Math.max(0, grabFlash.current - dt / 100);
      }

      // ── Screen flash
      if (flashAlpha.current > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha.current;
        ctx.fillStyle = flashColor.current;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        flashAlpha.current = Math.max(0, flashAlpha.current - dt / 130);
      }

      // ── State label (bottom right of frame)
      const stateLabels: Record<NeonClawGameState, string> = {
        IDLE: "IDLE",
        AIMING: "AIM",
        DESCENDING: "DOWN",
        GRABBING: "GRAB",
        LIFTING: "LIFT",
        DROPPING: "DROP",
        RESULT: "WIN!",
      };
      const stateCol =
        stateRef.current === "RESULT"
          ? NEO.yellow
          : stateRef.current === "IDLE"
          ? NEO.dimCyan
          : NEO.green;
      neonText(
        ctx,
        stateLabels[stateRef.current],
        FRAME_X + FRAME_W - 18,
        FRAME_Y + FRAME_H - 10,
        stateCol,
        8,
        8,
      );

      drawScanlines(ctx, scanOffset.current);
      clearGlow(ctx);
    },
    [resultGrade, prizeName],
  );

  // ── Animation loop ───────────────────────────────────────────────────────
  const animate = useCallback(
    (timestamp: number) => {
      const dt = Math.min(timestamp - lastTime.current, 100);
      lastTime.current = timestamp;

      const state = stateRef.current;

      if (state === "AIMING") {
        // Move claw left/right
        clawX.current = Math.max(
          RAIL_X1 + 12,
          Math.min(RAIL_X2 - 12, clawX.current + aimDir.current * aimSpeed * dt / 16),
        );
      }

      if (state === "DESCENDING") {
        // Lower cable
        clawCableBottom.current += (1.6 * dt) / 16;

        // Emit trail particles
        if (Math.random() < 0.3) {
          trailParticles.current.push({
            x: clawX.current + (Math.random() - 0.5) * 8,
            y: clawCableBottom.current,
            alpha: 0.8,
            vy: 0.4,
          });
        }

        // When we reach grab depth, transition to GRABBING
        const maxDescend = FLOOR_Y - 32;
        if (clawCableBottom.current >= maxDescend) {
          clawCableBottom.current = maxDescend;
          changeState("GRABBING");
          clawOpen.current = 1;
          grabFlash.current = 1;
        }
      }

      if (state === "GRABBING") {
        // Prongs close
        clawOpen.current = Math.max(0, clawOpen.current - (2.5 * dt) / 1000);
        if (clawOpen.current <= 0) {
          // Find the toy closest to claw X
          const targetToy = toysRef.current.find((t) => t.grade === resultGrade);
          if (targetToy) {
            grabbedToy.current = { ...targetToy };
            toysRef.current = toysRef.current.filter((t) => t !== targetToy);
          }
          changeState("LIFTING");
        }
      }

      if (state === "LIFTING") {
        // Raise cable
        clawCableBottom.current -= (1.8 * dt) / 16;
        if (clawCableBottom.current <= RAIL_Y + 28) {
          clawCableBottom.current = RAIL_Y + 28;
          // Move claw to drop chute (right side of glass)
          changeState("DROPPING");
        }
      }

      if (state === "DROPPING") {
        // Slide claw to drop chute on the right
        const chuteX = GLASS_X + GLASS_W - 14;
        if (clawX.current < chuteX) {
          clawX.current = Math.min(chuteX, clawX.current + (2 * dt) / 16);
        } else {
          // Release
          grabbedToy.current = null;
          clawOpen.current = 1;

          // Win!
          changeState("RESULT");
          flashAlpha.current = 0.55;
          flashColor.current = GRADE_COLOR[resultGrade] ?? NEO.pink;

          const cx = FRAME_X + FRAME_W / 2;
          const cy = FRAME_Y + FRAME_H / 2;
          const ringColors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow];
          for (let i = 0; i < 5; i++) {
            ringParticles.current.push({
              x: cx + (Math.random() - 0.5) * 50,
              y: cy + (Math.random() - 0.5) * 40,
              r: 4 + i * 5,
              maxR: 70 + i * 18,
              alpha: 0.85 - i * 0.1,
              color: ringColors[i % ringColors.length]!,
            });
          }
          onResult?.(resultGrade);
        }
      }

      draw(dt);
      animRef.current = requestAnimationFrame(animate);
    },
    [draw, changeState, onResult, resultGrade],
  );

  // ── Loop start/stop ──────────────────────────────────────────────────────
  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // Reset toys
    toysRef.current = INITIAL_TOYS.map((t) => ({ ...t }));
    grabbedToy.current = null;
    clawX.current = (RAIL_X1 + RAIL_X2) / 2;
    clawCableTop.current = RAIL_Y;
    clawCableBottom.current = RAIL_Y + 28;
    clawOpen.current = 1;
    aimDir.current = 0;
    trailParticles.current = [];
    ringParticles.current = [];
    grabFlash.current = 0;
    flashAlpha.current = 0;
    changeState("AIMING");

    // Auto aim toward the target toy
    const targetToy = INITIAL_TOYS.find((t) => t.grade === resultGrade);
    if (targetToy) {
      const targetX = targetToy.x;
      aimDir.current = targetX > clawX.current ? 1 : -1;
      // Stop aiming when we're close enough
      const aimDuration = Math.abs(targetX - clawX.current) / aimSpeed / (16 / 1000);
      setTimeout(() => {
        aimDir.current = 0;
        setTimeout(() => {
          if (stateRef.current === "AIMING") {
            changeState("DESCENDING");
          }
        }, 400);
      }, aimDuration * 16 + 100);
    } else {
      setTimeout(() => {
        changeState("DESCENDING");
      }, 800);
    }
  }, [resultGrade, changeState]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    toysRef.current = INITIAL_TOYS.map((t) => ({ ...t }));
    grabbedToy.current = null;
    clawX.current = (RAIL_X1 + RAIL_X2) / 2;
    clawCableBottom.current = RAIL_Y + 28;
    clawOpen.current = 1;
    aimDir.current = 0;
    trailParticles.current = [];
    ringParticles.current = [];
    grabFlash.current = 0;
    flashAlpha.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * W;
      const ny = ((e.clientY - rect.top) / rect.height) * H;

      const state = stateRef.current;

      // Drop button
      const dropBtnCX = PANEL_X + PANEL_W / 2;
      const arrowY = PANEL_Y + 30;
      const arrowSize = 14;
      const dropBtnCY = arrowY + arrowSize * 2 + 28;
      const onDropBtn = Math.hypot(nx - dropBtnCX, ny - dropBtnCY) < 20;

      // Play/Reset button
      const btnY2 = PANEL_Y + PANEL_H - 30;
      const onPlayBtn =
        nx >= PANEL_X + 4 &&
        nx <= PANEL_X + PANEL_W - 4 &&
        ny >= btnY2 &&
        ny <= btnY2 + 22;

      // Left arrow
      const onLeftArrow =
        nx >= PANEL_X + 4 &&
        nx <= PANEL_X + 4 + arrowSize * 2 &&
        ny >= arrowY &&
        ny <= arrowY + arrowSize * 2;

      // Right arrow
      const onRightArrow =
        nx >= PANEL_X + 4 + arrowSize * 2 + 6 &&
        nx <= PANEL_X + 4 + arrowSize * 4 + 6 &&
        ny >= arrowY &&
        ny <= arrowY + arrowSize * 2;

      if (state === "RESULT" && onPlayBtn) {
        reset();
      } else if (state === "IDLE" && onPlayBtn) {
        startGame();
      } else if (state === "AIMING") {
        if (onDropBtn) {
          aimDir.current = 0;
          changeState("DESCENDING");
        } else if (onLeftArrow) {
          aimDir.current = -1;
          setTimeout(() => { aimDir.current = 0; }, 500);
        } else if (onRightArrow) {
          aimDir.current = 1;
          setTimeout(() => { aimDir.current = 0; }, 500);
        }
      }
    },
    [reset, startGame, changeState],
  );

  void gameState;

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: NEO.bg, padding: 8 }}
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
