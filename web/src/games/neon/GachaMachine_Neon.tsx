"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NeonGachaGameState =
  | "IDLE"
  | "COIN_INSERT"
  | "TURNING"
  | "DISPENSING"
  | "BOUNCING"
  | "READY_TO_OPEN"
  | "OPENING"
  | "RESULT";

export interface GachaMachineNeonProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: NeonGachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas dimensions
// ─────────────────────────────────────────────────────────────────────────────

const W = 300;
const H = 440;

// ─────────────────────────────────────────────────────────────────────────────
// Neon palette
// ─────────────────────────────────────────────────────────────────────────────

const NEO = {
  bg:       "#0a0a1a",
  bgMid:    "#0d0d22",
  pink:     "#ff00ff",
  cyan:     "#00ffff",
  green:    "#00ff66",
  yellow:   "#ffff00",
  orange:   "#ff6600",
  red:      "#ff3300",
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
// Machine geometry
// ─────────────────────────────────────────────────────────────────────────────

const MCX = W / 2;          // machine center X

// Dome (drawn as neon arc segments for stroke look)
const DOME_CY = 145;
const DOME_R  = 90;

// Body below dome
const BODY_TOP_Y    = DOME_CY + DOME_R * 0.8;
const BODY_BOTTOM_Y = 360;
const BODY_W        = DOME_R * 1.5;
const BODY_H        = BODY_BOTTOM_Y - BODY_TOP_Y;
const BODY_X        = MCX - BODY_W / 2;

// Neck
const NECK_W = DOME_R * 0.4;
const NECK_H = 14;
const NECK_X = MCX - NECK_W / 2;
const NECK_Y = DOME_CY + DOME_R - 4;

// Coin slot
const SLOT_W = 40;
const SLOT_H = 14;
const SLOT_X = MCX - SLOT_W / 2;
const SLOT_Y = BODY_TOP_Y + 20;

// Handle
const HANDLE_X  = BODY_X + BODY_W + 4;
const HANDLE_Y  = BODY_TOP_Y + BODY_H * 0.25;
const HANDLE_W  = 28;
const HANDLE_H  = 10;
const KNOB_CX   = HANDLE_X + HANDLE_W + 8;
const KNOB_CY   = HANDLE_Y + HANDLE_H / 2;
const KNOB_R    = 11;

// Chute (output opening at bottom)
const CHUTE_W = 50;
const CHUTE_H = 30;
const CHUTE_X = MCX - CHUTE_W / 2;
const CHUTE_Y = BODY_BOTTOM_Y - 8;

// ─────────────────────────────────────────────────────────────────────────────
// Capsule colours per grade
// ─────────────────────────────────────────────────────────────────────────────

// Each capsule has a top and bottom colour
const CAPSULE_PALETTE: Record<string, [string, string]> = {
  "A賞": [NEO.gradeA,  "#ff8c00"],
  "B賞": [NEO.gradeB,  "#0066ff"],
  "C賞": [NEO.gradeC,  "#006633"],
  "D賞": [NEO.gradeD,  "#660066"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Capsules inside dome (decorative)
// ─────────────────────────────────────────────────────────────────────────────

interface DomeCapsule {
  x: number;
  y: number;
  r: number;
  grade: string;
}

function buildDomeCapsules(): DomeCapsule[] {
  const grades = ["A賞", "B賞", "C賞", "D賞", "B賞", "C賞", "D賞", "A賞", "C賞", "D賞"];
  return grades.map((grade, i) => {
    const angle = (i / grades.length) * Math.PI * 2;
    const dist = DOME_R * 0.52;
    return {
      x: MCX + Math.cos(angle) * dist * 0.85,
      y: DOME_CY + Math.sin(angle) * dist * 0.55,
      r: 9 + (i % 3) * 2,
      grade,
    };
  });
}

const DOME_CAPSULES = buildDomeCapsules();

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers (same idiom as SlotMachine_Neon)
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

// Draw dome as small neon line segments to keep the neon stroke look
function drawNeonArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  color: string,
  blur: number,
  lw = 2,
  segments = 48,
) {
  ctx.save();
  setNeonStroke(ctx, color, blur, lw);
  ctx.beginPath();
  const span = endAngle - startAngle;
  const step = span / segments;
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + i * step;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

// Draw a small 2-tone neon capsule
function drawNeonCapsule(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  topColor: string,
  bottomColor: string,
  blur: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Top half arc
  setNeonStroke(ctx, topColor, blur, 1.5);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.stroke();

  // Bottom half arc
  setNeonStroke(ctx, bottomColor, blur, 1.5);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.stroke();

  // Equator line
  neonLine(ctx, cx - r, cy, cx + r, cy, topColor, blur * 0.3, 1);

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = NEO.gridLine;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  const GRID = 24;
  for (let x = 0; x <= W; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
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

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine_Neon({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachineNeonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<NeonGachaGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<NeonGachaGameState>("IDLE");

  // Handle rotation
  const knobAngle = useRef(0);          // current rotation angle (radians)
  const knobTargetAngle = useRef(0);
  const knobGlowExtra = useRef(0);      // extra glow brightness during turn

  // Dropping capsule
  const dropY = useRef(0);
  const dropX = useRef(MCX);
  const dropVY = useRef(0);
  const dropBounceCount = useRef(0);
  const dropOpen = useRef(0);           // 0=closed 1=top half shifted up (open)

  // Coin insert
  const coinY = useRef(0);
  const coinVisible = useRef(false);

  // Trailing arc effect (knob rotation trail)
  const trailArcs = useRef<{ angle: number; alpha: number }[]>([]);

  // Win ring particles
  const ringParticles = useRef<
    { x: number; y: number; r: number; maxR: number; alpha: number; color: string }[]
  >([]);

  // Floating burst particles (win)
  const burstParticles = useRef<
    { x: number; y: number; vx: number; vy: number; alpha: number; color: string; size: number }[]
  >([]);

  // Ambient float dots
  const floatDots = useRef<
    { x: number; y: number; vx: number; vy: number; color: string; alpha: number; size: number }[]
  >([]);

  const pulseT = useRef(0);
  const scanOffset = useRef(0);
  const lastTime = useRef(0);
  const flashAlpha = useRef(0);
  const flashColor = useRef(NEO.pink);
  const readyToOpenScheduled = useRef(false);

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
    (s: NeonGachaGameState) => {
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
      const state = stateRef.current;

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

      // ── Machine body outline (neon red/orange)
      const bodyColor = NEO.red;
      const bodyGlow = 10 + 5 * Math.sin(pt);
      ctx.fillStyle = "rgba(12,4,4,0.9)";
      ctx.fillRect(BODY_X, BODY_TOP_Y, BODY_W, BODY_H);
      neonRect(ctx, BODY_X, BODY_TOP_Y, BODY_W, BODY_H, bodyColor, bodyGlow, 2);
      neonRect(ctx, BODY_X + 3, BODY_TOP_Y + 3, BODY_W - 6, BODY_H - 6, NEO.orange, 4, 1);

      // ── Neck
      ctx.fillStyle = "rgba(12,4,4,0.9)";
      ctx.fillRect(NECK_X, NECK_Y, NECK_W, NECK_H);
      neonRect(ctx, NECK_X, NECK_Y, NECK_W, NECK_H, bodyColor, 6, 1.5);

      // ── Dome (neon arc segments, cyan glow)
      // Fill dome with very dark tinted background first
      ctx.save();
      ctx.fillStyle = "rgba(0,6,14,0.88)";
      ctx.beginPath();
      ctx.ellipse(MCX, DOME_CY, DOME_R, DOME_R * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Dome neon arc (full ellipse, cyan)
      const domeGlow = 12 + 6 * Math.sin(pt * 1.3);
      drawNeonArc(ctx, MCX, DOME_CY, DOME_R, DOME_R * 0.78, 0, Math.PI * 2, NEO.cyan, domeGlow, 2, 64);
      // Inner accent arc
      drawNeonArc(ctx, MCX, DOME_CY, DOME_R - 5, (DOME_R - 5) * 0.78, 0, Math.PI * 2, NEO.cyan, domeGlow * 0.3, 1, 64);

      // ── Capsules inside dome
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(MCX, DOME_CY, DOME_R - 3, (DOME_R - 3) * 0.78, 0, 0, Math.PI * 2);
      ctx.clip();

      for (const cap of DOME_CAPSULES) {
        const palette = CAPSULE_PALETTE[cap.grade] ?? [NEO.pink, NEO.pink];
        const [topCol, botCol] = palette;
        // Pulse individual capsules slightly
        const capPulse = 0.5 + 0.5 * Math.sin(pt * 1.5 + cap.x * 0.1);
        drawNeonCapsule(ctx, cap.x, cap.y, cap.r, topCol!, botCol!, 8 * capPulse, 0.6 + 0.3 * capPulse);
      }
      ctx.restore();

      // ── Coin slot (neon yellow outline)
      neonRect(ctx, SLOT_X, SLOT_Y, SLOT_W, SLOT_H, NEO.yellow, 10, 2);
      neonText(ctx, "100", MCX, SLOT_Y + SLOT_H / 2, NEO.yellow, 8, 12);

      // ── Coin animation
      if (coinVisible.current) {
        const coinR = 7;
        neonCircle(ctx, MCX, coinY.current, coinR, NEO.yellow, 14, 2);
        neonLine(ctx, MCX - 3, coinY.current - 3, MCX + 3, coinY.current + 3, NEO.yellow, 6, 1);
        neonLine(ctx, MCX - 3, coinY.current + 3, MCX + 3, coinY.current - 3, NEO.yellow, 6, 1);
      }

      // ── Handle (neon orange bar)
      neonLine(ctx, HANDLE_X, HANDLE_Y + HANDLE_H / 2, HANDLE_X + HANDLE_W, HANDLE_Y + HANDLE_H / 2, NEO.orange, 10, 5);
      // Handle groove marks
      for (let gx = HANDLE_X + 4; gx < HANDLE_X + HANDLE_W; gx += 5) {
        neonLine(ctx, gx, HANDLE_Y, gx, HANDLE_Y + HANDLE_H, NEO.orange, 3, 1);
      }

      // ── Knob
      const isTurning = state === "TURNING";
      const knobGlow = isTurning
        ? 18 + 10 * Math.sin(pt * 8) + knobGlowExtra.current * 20
        : 8 + 4 * Math.sin(pt * 2);
      const knobColor = isTurning ? NEO.yellow : NEO.orange;

      // Trail arcs
      for (const arc of trailArcs.current) {
        arc.alpha -= dt * 0.003;
        if (arc.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = arc.alpha * 0.4;
          setNeonStroke(ctx, NEO.orange, 8, 1);
          ctx.beginPath();
          ctx.arc(KNOB_CX, KNOB_CY, KNOB_R - 2, arc.angle - 0.3, arc.angle + 0.3);
          ctx.stroke();
          ctx.restore();
        }
      }
      trailArcs.current = trailArcs.current.filter((a) => a.alpha > 0);

      // Knob circle
      neonCircle(ctx, KNOB_CX, KNOB_CY, KNOB_R, knobColor, knobGlow, 2.5);
      neonCircle(ctx, KNOB_CX, KNOB_CY, KNOB_R - 4, knobColor, knobGlow * 0.3, 1);

      // Knob indicator line (rotates)
      const kAngle = knobAngle.current;
      ctx.save();
      setNeonStroke(ctx, NEO.white, 6, 1.5);
      ctx.beginPath();
      ctx.moveTo(KNOB_CX, KNOB_CY);
      ctx.lineTo(
        KNOB_CX + Math.cos(kAngle) * (KNOB_R - 3),
        KNOB_CY + Math.sin(kAngle) * (KNOB_R - 3),
      );
      ctx.stroke();
      ctx.restore();

      // ── Chute (dark opening with neon edge)
      ctx.fillStyle = "rgba(0,0,0,0.95)";
      ctx.fillRect(CHUTE_X, CHUTE_Y, CHUTE_W, CHUTE_H);
      neonRect(ctx, CHUTE_X, CHUTE_Y, CHUTE_W, CHUTE_H, NEO.red, 8, 1.5);
      // Inner edge glow
      ctx.save();
      ctx.globalAlpha = 0.3;
      neonRect(ctx, CHUTE_X + 3, CHUTE_Y + 3, CHUTE_W - 6, CHUTE_H - 6, NEO.orange, 4, 1);
      ctx.restore();

      // ── Dropping / bouncing capsule
      const shouldShowDropCap =
        state === "DISPENSING" ||
        state === "BOUNCING" ||
        state === "READY_TO_OPEN" ||
        state === "OPENING" ||
        state === "RESULT";

      if (shouldShowDropCap) {
        const capR = 16;
        const palette = CAPSULE_PALETTE[resultGrade] ?? [NEO.pink, NEO.pink];
        const [topCol, botCol] = palette;
        const openOffset = dropOpen.current * 14;
        const capX = dropX.current;
        const capY = dropY.current;

        // Glow trail during drop
        if (state === "DISPENSING" || state === "BOUNCING") {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = topCol!;
          ctx.shadowColor = topCol!;
          ctx.shadowBlur = 18;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(capX, capY - capR - 5);
          ctx.lineTo(capX, capY - capR - 5 - 30 * dropVY.current * 0.1);
          ctx.stroke();
          ctx.restore();
        }

        if (state === "OPENING" || state === "RESULT") {
          // Top half shifts up with inner glow
          const innerCol = topCol!;
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = innerCol;
          ctx.shadowColor = innerCol;
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.arc(capX, capY, capR - 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Top half (shifted up)
          setNeonStroke(ctx, topCol!, 20, 2);
          ctx.beginPath();
          ctx.arc(capX, capY - openOffset, capR, Math.PI, 0);
          ctx.stroke();

          // Bottom half stays
          setNeonStroke(ctx, botCol!, 14, 2);
          ctx.beginPath();
          ctx.arc(capX, capY, capR, 0, Math.PI);
          ctx.stroke();

          neonLine(ctx, capX - capR, capY, capX + capR, capY, botCol!, 8, 1);
        } else {
          // Normal closed capsule
          drawNeonCapsule(ctx, capX, capY, capR, topCol!, botCol!, 16, 1);
        }
      }

      // ── Result text
      if (state === "RESULT") {
        const targetCol = GRADE_COLOR[resultGrade] ?? NEO.pink;
        const jt = pt * 2;
        const jackpotColors = [NEO.pink, NEO.cyan, NEO.yellow, NEO.green];
        const jCol = jackpotColors[Math.floor(jt / 0.8) % jackpotColors.length]!;
        const textY = dropY.current - 50;
        neonText(ctx, "GET!", MCX, Math.max(60, textY), jCol, 24, 34);
        neonText(ctx, resultGrade, MCX, Math.max(85, textY + 28), targetCol, 13, 20);
        neonText(ctx, prizeName, MCX, Math.max(104, textY + 46), NEO.white, 8, 10);
      }

      // ── Win ring particles
      for (const p of ringParticles.current) {
        p.r += (dt * 0.13);
        p.alpha -= dt * 0.006;
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

      // ── Burst particles
      for (const bp of burstParticles.current) {
        bp.x += (bp.vx * dt) / 16;
        bp.y += (bp.vy * dt) / 16;
        bp.alpha -= dt * 0.005;
        if (bp.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, bp.alpha);
          ctx.fillStyle = bp.color;
          ctx.shadowColor = bp.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      burstParticles.current = burstParticles.current.filter((p) => p.alpha > 0);

      // ── PLAY/RESET button
      const isResult = state === "RESULT";
      const isIdle = state === "IDLE";
      const btnLabel = isResult ? "RESET" : isIdle ? "INSERT COIN" : "...";
      const btnCol = isResult ? NEO.cyan : isIdle ? NEO.green : NEO.dimGreen;
      const btnPulse = isResult || isIdle ? 0.7 + 0.3 * Math.sin(pt * 4) : 0.3;
      const btnY = H - 34;
      const btnX = 20;
      const btnW = W - 40;
      const btnH = 24;

      ctx.save();
      ctx.globalAlpha = btnPulse;
      neonRect(ctx, btnX, btnY, btnW, btnH, btnCol, isResult || isIdle ? 16 : 4, 2);
      ctx.restore();
      neonText(ctx, btnLabel, W / 2, btnY + btnH / 2, btnCol, 9, isResult || isIdle ? 14 : 4);

      // ── Screen flash
      if (flashAlpha.current > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha.current;
        ctx.fillStyle = flashColor.current;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        flashAlpha.current = Math.max(0, flashAlpha.current - dt / 130);
      }

      // ── State label
      const stateLabels: Record<NeonGachaGameState, string> = {
        IDLE: "IDLE",
        COIN_INSERT: "COIN",
        TURNING: "TURN",
        DISPENSING: "DROP",
        BOUNCING: "BNCE",
        READY_TO_OPEN: "OPEN?",
        OPENING: "OPEN",
        RESULT: "WIN!",
      };
      const stateCol =
        state === "RESULT"
          ? NEO.yellow
          : state === "IDLE"
          ? NEO.dimCyan
          : NEO.green;
      neonText(ctx, stateLabels[state], W - 22, H - 10, stateCol, 8, 8);

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

      if (state === "COIN_INSERT") {
        // Animate coin sliding into slot
        coinY.current += (2 * dt) / 16;
        if (coinY.current >= SLOT_Y) {
          coinVisible.current = false;
          changeState("TURNING");
          // Set up a full rotation
          knobTargetAngle.current = knobAngle.current + Math.PI * 4;
          knobGlowExtra.current = 1;
        }
      }

      if (state === "TURNING") {
        const turnSpeed = 0.06;
        knobAngle.current += (turnSpeed * dt) / 16;
        knobGlowExtra.current = Math.max(0, knobGlowExtra.current - dt * 0.001);

        // Emit trail arcs
        if (Math.random() < 0.25) {
          trailArcs.current.push({ angle: knobAngle.current, alpha: 0.8 });
        }

        if (knobAngle.current >= knobTargetAngle.current) {
          knobAngle.current = knobTargetAngle.current % (Math.PI * 2);
          changeState("DISPENSING");
          // Set capsule start position (from neck/chute opening)
          dropX.current = MCX;
          dropY.current = NECK_Y + NECK_H + 5;
          dropVY.current = 1;
          dropOpen.current = 0;
          dropBounceCount.current = 0;
        }
      }

      if (state === "DISPENSING") {
        dropVY.current += (0.18 * dt) / 16; // gravity
        dropY.current += (dropVY.current * dt) / 16;

        // When it reaches the chute
        if (dropY.current >= CHUTE_Y + CHUTE_H / 2) {
          dropY.current = CHUTE_Y + CHUTE_H / 2;
          dropVY.current = -dropVY.current * 0.45;
          dropBounceCount.current += 1;
          changeState("BOUNCING");
        }
      }

      if (state === "BOUNCING") {
        dropVY.current += (0.18 * dt) / 16;
        dropY.current += (dropVY.current * dt) / 16;

        if (dropY.current >= CHUTE_Y + CHUTE_H / 2) {
          dropY.current = CHUTE_Y + CHUTE_H / 2;
          dropBounceCount.current += 1;

          if (dropBounceCount.current >= 3) {
            dropVY.current = 0;
            changeState("READY_TO_OPEN");
          } else {
            dropVY.current = -dropVY.current * 0.4;
          }
        }
      }

      if (state === "READY_TO_OPEN") {
        if (!readyToOpenScheduled.current) {
          readyToOpenScheduled.current = true;
          setTimeout(() => {
            readyToOpenScheduled.current = false;
            if (stateRef.current === "READY_TO_OPEN") {
              changeState("OPENING");
            }
          }, 500);
        }
      }

      if (state === "OPENING") {
        dropOpen.current = Math.min(1, dropOpen.current + (1.5 * dt) / 1000);
        if (dropOpen.current >= 1) {
          // Trigger win
          changeState("RESULT");
          flashAlpha.current = 0.5;
          flashColor.current = GRADE_COLOR[resultGrade] ?? NEO.pink;

          const cx = dropX.current;
          const cy = dropY.current;
          const ringColors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow];
          for (let i = 0; i < 5; i++) {
            ringParticles.current.push({
              x: cx + (Math.random() - 0.5) * 40,
              y: cy + (Math.random() - 0.5) * 30,
              r: 4 + i * 5,
              maxR: 60 + i * 16,
              alpha: 0.9 - i * 0.12,
              color: ringColors[i % ringColors.length]!,
            });
          }
          // Burst particles
          const burstColors = [
            GRADE_COLOR[resultGrade] ?? NEO.pink,
            NEO.white,
            NEO.cyan,
            NEO.yellow,
          ];
          for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2;
            burstParticles.current.push({
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              alpha: 1,
              color: burstColors[i % burstColors.length]!,
              size: 2 + Math.random() * 3,
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
    coinY.current = SLOT_Y - 40;
    coinVisible.current = true;
    dropOpen.current = 0;
    dropBounceCount.current = 0;
    ringParticles.current = [];
    burstParticles.current = [];
    trailArcs.current = [];
    flashAlpha.current = 0;
    knobGlowExtra.current = 0;
    changeState("COIN_INSERT");
  }, [changeState]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    coinVisible.current = false;
    dropOpen.current = 0;
    dropBounceCount.current = 0;
    ringParticles.current = [];
    burstParticles.current = [];
    trailArcs.current = [];
    flashAlpha.current = 0;
    knobAngle.current = 0;
    knobTargetAngle.current = 0;
    knobGlowExtra.current = 0;
    readyToOpenScheduled.current = false;
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

      // Play/Reset button
      const btnY = H - 34;
      const onBtn =
        nx >= 20 && nx <= W - 20 && ny >= btnY && ny <= btnY + 24;

      // Knob click
      const onKnob = Math.hypot(nx - KNOB_CX, ny - KNOB_CY) < KNOB_R + 6;

      if (state === "RESULT" && (onBtn || onKnob)) {
        reset();
      } else if (state === "IDLE" && (onBtn || onKnob)) {
        startGame();
      }
    },
    [reset, startGame],
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
