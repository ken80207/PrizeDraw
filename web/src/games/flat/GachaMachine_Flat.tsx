"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlatGachaGameState = "IDLE" | "TURNING" | "DROPPING" | "OPENING" | "RESULT";

export interface GachaMachineFlatProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: FlatGachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────────────────────

const W = 300;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Flat palette — zero gradients, zero shadows
// ─────────────────────────────────────────────────────────────────────────────

const FL = {
  white:       "#ffffff",
  bg:          "#f8fafc",
  red:         "#ef4444",   // machine body
  redDark:     "#dc2626",   // machine body accent panels
  amber:       "#f59e0b",
  amberDark:   "#d97706",
  blue:        "#3b82f6",
  emerald:     "#10b981",
  purple:      "#a855f7",
  indigo:      "#6366f1",
  indigoDark:  "#4f46e5",
  slate:       "#1e293b",
  slateLight:  "#64748b",
  gray100:     "#f1f5f9",
  gray200:     "#e2e8f0",
  gray700:     "#374151",
  domeLightFill: "#f0f9ff",  // light blue-white for dome
  domeBorder:    "#bfdbfe",  // soft blue border on dome
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": FL.amber,
  "B賞": FL.blue,
  "C賞": FL.emerald,
  "D賞": FL.purple,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

// Capsule color pairs: [top, bottom (darker shade)]
const CAPSULE_COLORS: [string, string][] = [
  ["#f59e0b", "#d97706"],
  ["#3b82f6", "#1d4ed8"],
  ["#10b981", "#059669"],
  ["#a855f7", "#7c3aed"],
  ["#ef4444", "#b91c1c"],
  ["#ec4899", "#be185d"],
];

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────

const BODY_X = 30;
const BODY_Y = 10;
const BODY_W = 240;
const BODY_H = 370;
const BODY_R = 28;

// Dome: large circle centered horizontally on body top
const DOME_CX = BODY_X + BODY_W / 2;
const DOME_CY = BODY_Y + 72;
const DOME_R  = 82;

// Handle: right side of body
const HANDLE_Y = BODY_Y + BODY_H * 0.55;
const HANDLE_X_LEFT  = BODY_X + BODY_W;
const HANDLE_X_RIGHT = HANDLE_X_LEFT + 36;

// Coin slot: left side of body (lower)
const COIN_X = BODY_X - 14;
const COIN_Y = BODY_Y + BODY_H * 0.65;
const COIN_W = 28;
const COIN_H = 18;

// Chute: bottom center of body
const CHUTE_X = BODY_X + BODY_W / 2 - 28;
const CHUTE_Y = BODY_Y + BODY_H - 44;
const CHUTE_W = 56;
const CHUTE_H = 36;

// ─────────────────────────────────────────────────────────────────────────────
// Capsule positions inside dome (scattered)
// ─────────────────────────────────────────────────────────────────────────────

interface DomeCapsule {
  cx: number;
  cy: number;
  r: number;
  colorIdx: number;
}

function buildDomeCapsules(): DomeCapsule[] {
  // Place capsules scattered inside the dome circle
  return [
    { cx: DOME_CX - 38, cy: DOME_CY - 12, r: 15, colorIdx: 0 },
    { cx: DOME_CX + 30, cy: DOME_CY - 20, r: 13, colorIdx: 1 },
    { cx: DOME_CX - 10, cy: DOME_CY + 22, r: 14, colorIdx: 2 },
    { cx: DOME_CX + 46, cy: DOME_CY + 10, r: 12, colorIdx: 3 },
    { cx: DOME_CX - 52, cy: DOME_CY + 20, r: 13, colorIdx: 4 },
    { cx: DOME_CX + 8,  cy: DOME_CY - 42, r: 12, colorIdx: 5 },
    { cx: DOME_CX - 24, cy: DOME_CY - 42, r: 11, colorIdx: 0 },
    { cx: DOME_CX + 52, cy: DOME_CY - 38, r: 11, colorIdx: 2 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Easing
// ─────────────────────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function flatRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  stroke: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function flatText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  color: string,
  weight: "400" | "600" | "700" | "900" = "600",
  align: CanvasTextAlign = "center",
  baseline: CanvasTextBaseline = "middle",
): void {
  ctx.save();
  ctx.font = `${weight} ${fontSize}px "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGradeSymbol(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
  alpha = 1,
): void {
  const color = GRADE_COLOR[grade] ?? FL.slate;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;

  if (grade === "A賞") {
    const h = size * 0.9;
    const hw = size * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.5);
    ctx.lineTo(cx + hw, cy + h * 0.45);
    ctx.lineTo(cx - hw, cy + h * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (grade === "B賞") {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (grade === "C賞") {
    const half = size * 0.42;
    ctx.beginPath();
    ctx.rect(cx - half, cy - half, half * 2, half * 2);
    ctx.fill();
  } else {
    const d = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d * 0.7, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d * 0.7, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Draw a two-tone capsule at cx,cy with radius r */
function drawCapsule(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  topColor: string, bottomColor: string,
  topOpenOffset = 0,   // top half slides up by this amount (for open animation)
): void {
  // Bottom half
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = bottomColor;
  ctx.fill();

  // Top half (may slide up)
  ctx.beginPath();
  ctx.arc(cx, cy - topOpenOffset, r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine_Flat({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachineFlatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<FlatGachaGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<FlatGachaGameState>("IDLE");
  const lastTime = useRef(0);

  // Handle rotation angle (0..2π per full turn)
  const handleAngle = useRef(0);
  // Dispensed capsule: position (starts at chute, slides to tray)
  const capsuleY = useRef(0);          // offset from chute — 0 = in chute, 1 = in tray
  const capsuleVisible = useRef(false);
  // Capsule open: top offset (0 = closed, 1 = fully open)
  const openProgress = useRef(0);

  // Win pulse + result card scale
  const winPulse = useRef(0);
  const resultScale = useRef(0);

  // Static dome capsules
  const domeCapsules = useRef<DomeCapsule[]>(buildDomeCapsules());

  const changeState = useCallback((s: FlatGachaGameState) => {
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

    const state = stateRef.current;

    // ── Background ─────────────────────────────────────────────────────────
    ctx.fillStyle = FL.white;
    ctx.fillRect(0, 0, W, H);

    // Win tint
    if (state === "RESULT" && winPulse.current > 0) {
      const amt = Math.abs(Math.sin(winPulse.current * Math.PI * 2)) * 0.07;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.indigo;
      ctx.globalAlpha = amt;
      ctx.fillStyle = gradeHex;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // ── Machine body: tall coral/red rounded rect ──────────────────────────
    flatRoundRect(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, BODY_R, FL.red);

    // Subtle darker accent band (middle section)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(BODY_X, BODY_Y + BODY_H * 0.42, BODY_W, BODY_H * 0.16, 0);
    ctx.clip();
    ctx.fillStyle = FL.redDark;
    ctx.fillRect(BODY_X, BODY_Y + BODY_H * 0.42, BODY_W, BODY_H * 0.16);
    ctx.restore();

    // ── Dome: large circle on top area of body ─────────────────────────────
    // Dome border (slightly larger circle)
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R + 4, 0, Math.PI * 2);
    ctx.fillStyle = FL.domeBorder;
    ctx.fill();

    // Dome fill
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
    ctx.fillStyle = FL.domeLightFill;
    ctx.fill();

    // ── Capsules inside dome ───────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R - 2, 0, Math.PI * 2);
    ctx.clip();

    for (const cap of domeCapsules.current) {
      const colors = CAPSULE_COLORS[cap.colorIdx % CAPSULE_COLORS.length];
      if (!colors) continue;
      drawCapsule(ctx, cap.cx, cap.cy, cap.r, colors[0], colors[1]);
    }

    ctx.restore();

    // ── Machine label ──────────────────────────────────────────────────────
    flatText(ctx, "GACHA", BODY_X + BODY_W / 2, BODY_Y + BODY_H * 0.42 + BODY_H * 0.08, 18, FL.white, "700");

    // ── Handle: horizontal line + amber circle (rotates) ──────────────────
    const handleAngleVal = handleAngle.current;
    const knobR = 14;
    const armLength = 30;

    ctx.save();
    ctx.translate(HANDLE_X_LEFT, HANDLE_Y);
    ctx.rotate(handleAngleVal);

    // Arm
    ctx.fillStyle = FL.gray700;
    ctx.fillRect(0, -3, armLength, 6);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = FL.gray700;
    ctx.fill();

    // Knob
    ctx.beginPath();
    ctx.arc(armLength, 0, knobR, 0, Math.PI * 2);
    ctx.fillStyle = FL.amber;
    ctx.fill();

    ctx.restore();

    // ── Coin slot: dark rounded rect with ¥ ──────────────────────────────
    flatRoundRect(ctx, COIN_X, COIN_Y, COIN_W, COIN_H, 4, FL.gray700);
    // Coin slit
    ctx.fillStyle = FL.slate;
    ctx.fillRect(COIN_X + 4, COIN_Y + COIN_H / 2 - 1, COIN_W - 8, 2);
    flatText(ctx, "¥", COIN_X + COIN_W / 2, COIN_Y - 9, 10, "rgba(255,255,255,0.7)", "700");

    // ── Chute: dark rounded rect opening ──────────────────────────────────
    flatRoundRect(ctx, CHUTE_X, CHUTE_Y, CHUTE_W, CHUTE_H, 8, FL.gray700);
    // Chute inner opening
    flatRoundRect(ctx, CHUTE_X + 6, CHUTE_Y + 6, CHUTE_W - 12, CHUTE_H - 12, 5, FL.slate);

    // ── Dispensed capsule ─────────────────────────────────────────────────
    if (capsuleVisible.current) {
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.amber;
      const capColors = CAPSULE_COLORS.find((c) => c[0] === gradeHex) ??
        (GRADE_COLOR[resultGrade as Grade] === FL.amber ? CAPSULE_COLORS[0] :
         GRADE_COLOR[resultGrade as Grade] === FL.blue  ? CAPSULE_COLORS[1] :
         GRADE_COLOR[resultGrade as Grade] === FL.emerald ? CAPSULE_COLORS[2] :
         CAPSULE_COLORS[3]);

      // Interpolate position: from chute center down to tray
      const capsuleStartY = CHUTE_Y + CHUTE_H / 2;
      const capsuleEndY   = CHUTE_Y + CHUTE_H + 34;
      const capY = capsuleStartY + (capsuleEndY - capsuleStartY) * capsuleY.current;
      const capCX = CHUTE_X + CHUTE_W / 2;
      const capR = 18;

      // Open animation: top half slides up
      const openOffset = openProgress.current * capR * 1.6;

      drawCapsule(ctx, capCX, capY, capR, capColors[0], capColors[1], openOffset);

      // If opened, show grade symbol inside
      if (openProgress.current > 0.5) {
        const alpha = Math.min((openProgress.current - 0.5) * 2, 1);
        drawGradeSymbol(ctx, resultGrade as Grade, capCX, capY, 14, alpha);
      }
    }

    // ── Instruction / status text ──────────────────────────────────────────
    const instrY = BODY_Y + BODY_H - 22;
    const stateLabels: Record<FlatGachaGameState, string> = {
      IDLE:     "轉動把手 →",
      TURNING:  "Turning...",
      DROPPING: "Dropping",
      OPENING:  "Opening",
      RESULT:   "Result",
    };
    flatText(
      ctx,
      stateLabels[state],
      BODY_X + BODY_W / 2,
      instrY,
      11,
      state === "RESULT" ? FL.amber : "rgba(255,255,255,0.65)",
      "600",
    );

    // ── Grade target ───────────────────────────────────────────────────────
    const targetColor = GRADE_COLOR[resultGrade as Grade] ?? FL.white;
    flatText(ctx, "目標:", BODY_X + 16, instrY - 18, 10, "rgba(255,255,255,0.6)", "600", "left");
    drawGradeSymbol(ctx, resultGrade as Grade, BODY_X + BODY_W - 48, instrY - 18, 10);
    flatText(ctx, resultGrade, BODY_X + BODY_W - 28, instrY - 18, 12, targetColor, "700", "left");

    // ── RESET button (only in RESULT state) ───────────────────────────────
    if (state === "RESULT") {
      const btnX = W / 2 - 50;
      const btnY = BODY_Y + BODY_H + 18;
      const btnW = 100;
      const btnH = 36;
      flatRoundRect(ctx, btnX, btnY, btnW, btnH, 18, FL.indigoDark);
      flatText(ctx, "RESET", btnX + btnW / 2, btnY + btnH / 2, 14, FL.white, "700");
    }

    // ── Result overlay ────────────────────────────────────────────────────
    if (state === "RESULT" && resultScale.current > 0) {
      const sc = resultScale.current;
      const eased = sc < 0.5 ? 2 * sc * sc : 1 - Math.pow(-2 * sc + 2, 2) / 2;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.indigo;

      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      ctx.scale(eased, eased);
      ctx.globalAlpha = Math.min(eased * 1.5, 1);

      flatRoundRect(ctx, -72, -52, 144, 104, 16, FL.white);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-72, -52, 144, 28, [16, 16, 0, 0]);
      ctx.fillStyle = gradeHex;
      ctx.fill();
      ctx.restore();

      drawGradeSymbol(ctx, resultGrade as Grade, 0, 8, 28);
      flatText(ctx, resultGrade, 0, 36, 18, FL.slate, "900");
      flatText(ctx, prizeName, 0, 54, 10, FL.slateLight, "400");

      ctx.restore();
    }

    // ── Advance animation values ──────────────────────────────────────────
    if (state === "RESULT") {
      if (winPulse.current < 99) winPulse.current += dt / 400;
      if (resultScale.current < 1) resultScale.current = Math.min(1, resultScale.current + dt / 280);
    } else {
      winPulse.current = 0;
      resultScale.current = 0;
    }

  }, [resultGrade, prizeName]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Turn sequence ─────────────────────────────────────────────────────────
  const startTurn = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    changeState("TURNING");
    capsuleVisible.current = false;
    openProgress.current = 0;
    capsuleY.current = 0;

    // Phase 1: handle rotates 360° (smooth ease-in-out, 700ms)
    const startAngle = handleAngle.current;
    const endAngle = startAngle + Math.PI * 2;
    const turnStart = performance.now();
    const turnDuration = 700;

    const doTurn = (now: number) => {
      const elapsed = now - turnStart;
      const t = Math.min(elapsed / turnDuration, 1);
      handleAngle.current = startAngle + (endAngle - startAngle) * easeInOut(t);

      if (t < 1) {
        requestAnimationFrame(doTurn);
        return;
      }

      // Normalize angle to [0, 2π]
      handleAngle.current = endAngle % (Math.PI * 2);

      // Phase 2: capsule drops smoothly into chute (500ms)
      changeState("DROPPING");
      capsuleVisible.current = true;
      capsuleY.current = 0;

      const dropStart = performance.now();
      const dropDuration = 500;

      const doDrop = (now2: number) => {
        const el2 = now2 - dropStart;
        const t2 = Math.min(el2 / dropDuration, 1);
        capsuleY.current = easeInOut(t2);

        if (t2 < 1) {
          requestAnimationFrame(doDrop);
          return;
        }

        capsuleY.current = 1;

        // Phase 3: capsule opens (top slides up), 600ms
        changeState("OPENING");
        openProgress.current = 0;

        const openStart = performance.now();
        const openDuration = 600;

        const doOpen = (now3: number) => {
          const el3 = now3 - openStart;
          const t3 = Math.min(el3 / openDuration, 1);
          openProgress.current = easeInOut(t3);

          if (t3 < 1) {
            requestAnimationFrame(doOpen);
            return;
          }

          openProgress.current = 1;
          changeState("RESULT");
          onResult?.(resultGrade);
        };

        requestAnimationFrame(doOpen);
      };

      requestAnimationFrame(doDrop);
    };

    requestAnimationFrame(doTurn);
  }, [changeState, onResult, resultGrade]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    capsuleVisible.current = false;
    capsuleY.current = 0;
    openProgress.current = 0;
    winPulse.current = 0;
    resultScale.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const state = stateRef.current;

    if (state === "RESULT") {
      // RESET button
      const btnX = W / 2 - 50;
      const btnY = BODY_Y + BODY_H + 18;
      const btnW = 100;
      const btnH = 36;
      if (nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH) {
        reset();
      }
      return;
    }

    if (state !== "IDLE") return;

    // Handle knob — generous hit area around handle position
    const distToHandle = Math.hypot(nx - (HANDLE_X_LEFT + 30), ny - HANDLE_Y);
    if (distToHandle < 40) {
      startTurn();
      return;
    }

    // Also allow clicking anywhere on the body to trigger
    if (
      nx >= BODY_X && nx <= BODY_X + BODY_W &&
      ny >= BODY_Y && ny <= BODY_Y + BODY_H
    ) {
      startTurn();
    }
  }, [reset, startTurn]);

  void gameState;

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: FL.bg, padding: 12 }}
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
