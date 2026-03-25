"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlatClawGameState = "IDLE" | "MOVING" | "DROPPING" | "GRABBING" | "LIFTING" | "RESULT";

export interface ClawMachineFlatProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: FlatClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 340;
const H = 480;

// ─────────────────────────────────────────────────────────────────────────────
// Flat design palette — zero gradients, zero shadows
// ─────────────────────────────────────────────────────────────────────────────

const FL = {
  white:       "#ffffff",
  bg:          "#f8fafc",
  indigo:      "#6366f1",
  indigoDark:  "#4f46e5",
  indigoLight: "#818cf8",
  indigoFaint: "#e0e7ff",
  amber:       "#f59e0b",
  blue:        "#3b82f6",
  emerald:     "#10b981",
  purple:      "#a855f7",
  slate:       "#1e293b",
  slateLight:  "#64748b",
  gray100:     "#f1f5f9",
  gray200:     "#e2e8f0",
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": FL.amber,
  "B賞": FL.blue,
  "C賞": FL.emerald,
  "D賞": FL.purple,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Prize grid layout inside the glass case
// ─────────────────────────────────────────────────────────────────────────────

interface Prize {
  grade: Grade;
  col: number;  // 0-based column
  row: number;  // 0-based row
  grabbed: boolean;
}

function buildPrizeGrid(): Prize[] {
  const layout: Grade[] = [
    "A賞", "B賞", "C賞", "D賞",
    "C賞", "A賞", "D賞", "B賞",
    "B賞", "D賞", "A賞", "C賞",
  ];
  return layout.map((grade, i) => ({
    grade,
    col: i % 4,
    row: Math.floor(i / 4),
    grabbed: false,
  }));
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

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────

// Machine body
const BODY_X = 20;
const BODY_Y = 16;
const BODY_W = 300;
const BODY_H = 370;
const BODY_R = 24;

// Glass case (inside the indigo body)
const GLASS_X = BODY_X + 12;
const GLASS_Y = BODY_Y + 44;
const GLASS_W = BODY_W - 24;
const GLASS_H = 220;
const GLASS_R = 14;

// Rail (horizontal line at top of glass)
const RAIL_Y = GLASS_Y + 22;

// Prize grid inside glass
const PRIZE_AREA_X = GLASS_X + 16;
const PRIZE_AREA_Y = GLASS_Y + 60;
const PRIZE_AREA_W = GLASS_W - 32;
const PRIZE_AREA_H = GLASS_H - 76;
const PRIZE_COLS = 4;
const PRIZE_ROWS = 3;
const PRIZE_CELL_W = PRIZE_AREA_W / PRIZE_COLS;
const PRIZE_CELL_H = PRIZE_AREA_H / PRIZE_ROWS;

// Controls area
const CTRL_Y = BODY_Y + BODY_H - 72;

// ─────────────────────────────────────────────────────────────────────────────
// Easing
// ─────────────────────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine_Flat({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachineFlatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<FlatClawGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<FlatClawGameState>("IDLE");
  const lastTime = useRef(0);

  // Claw position — x moves horizontally along rail, y is cable extension
  const clawX = useRef(GLASS_X + GLASS_W / 2);   // starts centered
  const clawY = useRef(RAIL_Y + 8);               // resting at rail
  const clawOpen = useRef(true);                   // prong spread state

  // Target positions for smooth transitions
  const targetClawX = useRef(GLASS_X + GLASS_W / 2);
  const targetClawY = useRef(RAIL_Y + 8);

  // Animation progress refs (0..1)
  const moveProgress = useRef(0);
  const dropProgress = useRef(0);
  const liftProgress = useRef(0);

  // Start/end positions for interpolation
  const moveStartX = useRef(GLASS_X + GLASS_W / 2);
  const dropStartY = useRef(RAIL_Y + 8);
  const liftStartY = useRef(RAIL_Y + 8);

  // Grabbed prize
  const grabbedPrize = useRef<Prize | null>(null);
  const prizes = useRef<Prize[]>(buildPrizeGrid());

  // Win pulse + result card scale
  const winPulse = useRef(0);
  const resultScale = useRef(0);

  // Move direction (left/right button held)
  const moveDir = useRef<-1 | 0 | 1>(0);

  const changeState = useCallback((s: FlatClawGameState) => {
    stateRef.current = s;
    setGameState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  // ── Find target prize for current claw X position ─────────────────────────
  const findTargetPrize = useCallback((): Prize | null => {
    // Find prize column closest to claw X
    const cx = clawX.current;
    let best: Prize | null = null;
    let bestDist = Infinity;
    for (const p of prizes.current) {
      if (p.grabbed) continue;
      const px = PRIZE_AREA_X + p.col * PRIZE_CELL_W + PRIZE_CELL_W / 2;
      const dist = Math.abs(cx - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best;
  }, []);

  // ── Find target prize matching resultGrade ─────────────────────────────────
  const findGradePrize = useCallback((): Prize | null => {
    return prizes.current.find(
      (p) => p.grade === resultGrade && !p.grabbed
    ) ?? prizes.current.find((p) => !p.grabbed) ?? null;
  }, [resultGrade]);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    // ── Advance movement if MOVING (manual) ────────────────────────────────
    if (state === "IDLE") {
      const dir = moveDir.current;
      if (dir !== 0) {
        const speed = 120; // px/s
        const newX = clawX.current + dir * speed * (dt / 1000);
        clawX.current = Math.max(
          GLASS_X + 24,
          Math.min(GLASS_X + GLASS_W - 24, newX),
        );
      }
    }

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

    // ── Machine body: solid indigo rounded rect ────────────────────────────
    flatRoundRect(ctx, BODY_X, BODY_Y, BODY_W, BODY_H, BODY_R, FL.indigo);

    // ── Header label ───────────────────────────────────────────────────────
    flatText(ctx, "FLAT CLAW", BODY_X + BODY_W / 2, BODY_Y + 26, 16, FL.white, "700");

    // ── Glass case: white rounded rect ────────────────────────────────────
    flatRoundRect(ctx, GLASS_X, GLASS_Y, GLASS_W, GLASS_H, GLASS_R, FL.white);
    // Thin indigo border around glass
    strokeRoundRect(ctx, GLASS_X, GLASS_Y, GLASS_W, GLASS_H, GLASS_R, FL.indigoLight, 2);

    // ── Rail: thin horizontal indigo line ─────────────────────────────────
    ctx.fillStyle = FL.indigo;
    ctx.fillRect(GLASS_X + 8, RAIL_Y - 3, GLASS_W - 16, 6);
    // Rail end caps
    ctx.beginPath();
    ctx.arc(GLASS_X + 8, RAIL_Y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(GLASS_X + GLASS_W - 8, RAIL_Y, 4, 0, Math.PI * 2);
    ctx.fill();

    // ── Prizes in grid ────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(GLASS_X + 2, GLASS_Y + 2, GLASS_W - 4, GLASS_H - 4, GLASS_R - 2);
    ctx.clip();

    for (const prize of prizes.current) {
      if (prize.grabbed) continue;
      // If this is the grabbed prize being carried by claw, skip static render
      if (grabbedPrize.current === prize && state === "LIFTING") continue;

      const px = PRIZE_AREA_X + prize.col * PRIZE_CELL_W + PRIZE_CELL_W / 2;
      const py = PRIZE_AREA_Y + prize.row * PRIZE_CELL_H + PRIZE_CELL_H * 0.45;

      drawGradeSymbol(ctx, prize.grade, px, py, 14);
      flatText(ctx, prize.grade, px, py + 16, 8, GRADE_COLOR[prize.grade] ?? FL.slate, "700");
    }
    ctx.restore();

    // ── Claw ──────────────────────────────────────────────────────────────
    const cx = clawX.current;
    const cy = clawY.current;
    const isOpen = clawOpen.current;

    // Clip claw to glass area (partial — cable can be above)
    ctx.save();

    // Cable: thin vertical line from rail to hub
    ctx.strokeStyle = FL.indigo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, RAIL_Y);
    ctx.lineTo(cx, cy - 6);
    ctx.stroke();

    // Hub: small indigo circle
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = FL.indigo;
    ctx.fill();

    // 3 prongs from hub
    const prongLength = 16;
    const openAngles  = [Math.PI * 0.55, Math.PI * 0.9, Math.PI * 1.25]; // spread
    const closedAngles = [Math.PI * 0.7, Math.PI * 0.95, Math.PI * 1.2]; // together
    const angles = isOpen ? openAngles : closedAngles;

    ctx.strokeStyle = FL.indigo;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    for (const angle of angles) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(
        cx + Math.cos(angle) * prongLength,
        cy + 4 + Math.sin(angle) * prongLength,
      );
      ctx.stroke();
    }

    ctx.restore();

    // ── Draw grabbed prize with claw when LIFTING ──────────────────────────
    if (state === "LIFTING" && grabbedPrize.current) {
      const gp = grabbedPrize.current;
      drawGradeSymbol(ctx, gp.grade, cx, cy + 26, 14);
    }

    // ── Controls: left pill, right pill, drop pill ────────────────────────
    const btnH = 36;
    const btnR = 18;

    // Left "◀"
    const btnLX = BODY_X + 20;
    const btnLW = 64;
    const isIdle = state === "IDLE";
    const isResult = state === "RESULT";
    const canMove = isIdle;

    flatRoundRect(ctx, btnLX, CTRL_Y, btnLW, btnH, btnR, canMove ? FL.indigoDark : "rgba(99,102,241,0.35)");
    flatText(ctx, "◀", btnLX + btnLW / 2, CTRL_Y + btnH / 2, 16, canMove ? FL.white : "rgba(255,255,255,0.3)", "700");

    // Right "▶"
    const btnRX = btnLX + btnLW + 10;
    const btnRW = 64;
    flatRoundRect(ctx, btnRX, CTRL_Y, btnRW, btnH, btnR, canMove ? FL.indigoDark : "rgba(99,102,241,0.35)");
    flatText(ctx, "▶", btnRX + btnRW / 2, CTRL_Y + btnH / 2, 16, canMove ? FL.white : "rgba(255,255,255,0.3)", "700");

    // Drop "DROP" / "RESET" amber pill
    const btnDX = btnRX + btnRW + 10;
    const btnDW = BODY_X + BODY_W - 20 - btnDX;
    const canDrop = isIdle;
    const canReset = isResult;
    const dropColor = (canDrop || canReset) ? FL.amber : "rgba(245,158,11,0.35)";
    const dropLabel = isResult ? "RESET" : "DROP";
    flatRoundRect(ctx, btnDX, CTRL_Y, btnDW, btnH, btnR, dropColor);
    flatText(ctx, dropLabel, btnDX + btnDW / 2, CTRL_Y + btnH / 2, 14, (canDrop || canReset) ? FL.white : "rgba(255,255,255,0.3)", "700");

    // ── Grade target display (bottom of machine, inside body) ─────────────
    const infoY = CTRL_Y + btnH + 10;
    flatText(ctx, "目標:", BODY_X + 28, infoY + 8, 10, "rgba(255,255,255,0.65)", "600", "left");
    const targetColor = GRADE_COLOR[resultGrade as Grade] ?? FL.white;
    drawGradeSymbol(ctx, resultGrade as Grade, BODY_X + BODY_W - 60, infoY + 8, 10);
    flatText(ctx, resultGrade, BODY_X + BODY_W - 38, infoY + 8, 12, targetColor, "700", "left");

    // ── Status label ──────────────────────────────────────────────────────
    const stateLabels: Record<FlatClawGameState, string> = {
      IDLE: "Ready",
      MOVING: "Moving",
      DROPPING: "Dropping",
      GRABBING: "Grabbing",
      LIFTING: "Lifting",
      RESULT: "Result",
    };
    flatText(
      ctx,
      stateLabels[state],
      BODY_X + BODY_W - 14,
      BODY_Y + BODY_H - 10,
      9,
      state === "RESULT" ? FL.amber : "rgba(255,255,255,0.45)",
      "600",
      "right",
    );

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

      // Grade color bar at top
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

  // ── Drop sequence ─────────────────────────────────────────────────────────
  const startDrop = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    changeState("DROPPING");
    clawOpen.current = true;

    // Find the prize to grab — prefer resultGrade, aim claw at it
    const target = findGradePrize();
    if (target) {
      const targetPx = PRIZE_AREA_X + target.col * PRIZE_CELL_W + PRIZE_CELL_W / 2;
      const startX = clawX.current;
      moveStartX.current = startX;
      targetClawX.current = targetPx;
      moveProgress.current = 0;

      // Phase 1: move claw horizontally to prize column (500ms)
      const moveStart = performance.now();
      const moveDuration = 500;

      const doMove = (now: number) => {
        const elapsed = now - moveStart;
        const t = Math.min(elapsed / moveDuration, 1);
        const te = easeInOut(t);
        clawX.current = startX + (targetPx - startX) * te;

        if (t < 1) {
          requestAnimationFrame(doMove);
          return;
        }

        // Phase 2: drop claw down (600ms)
        clawX.current = targetPx;
        const dropStartYVal = RAIL_Y + 8;
        const prizeRowY = PRIZE_AREA_Y + target.row * PRIZE_CELL_H + PRIZE_CELL_H * 0.45;
        const dropTargetY = prizeRowY - 10;
        const dropStart = performance.now();
        const dropDuration = 600;

        changeState("DROPPING");

        const doDrop = (now2: number) => {
          const el2 = now2 - dropStart;
          const t2 = Math.min(el2 / dropDuration, 1);
          clawY.current = dropStartYVal + (dropTargetY - dropStartYVal) * easeInOut(t2);

          if (t2 < 1) {
            requestAnimationFrame(doDrop);
            return;
          }

          // Phase 3: grab (close prongs, 300ms pause)
          clawY.current = dropTargetY;
          clawOpen.current = false;
          changeState("GRABBING");

          setTimeout(() => {
            // Phase 4: lift back up (600ms)
            grabbedPrize.current = target;
            target.grabbed = true;
            changeState("LIFTING");

            const liftStartYVal = clawY.current;
            const liftTargetY = RAIL_Y + 8;
            const liftStart = performance.now();
            const liftDuration = 600;

            const doLift = (now3: number) => {
              const el3 = now3 - liftStart;
              const t3 = Math.min(el3 / liftDuration, 1);
              clawY.current = liftStartYVal + (liftTargetY - liftStartYVal) * easeInOut(t3);

              if (t3 < 1) {
                requestAnimationFrame(doLift);
                return;
              }

              // Done — show result
              clawY.current = liftTargetY;
              clawOpen.current = true;
              changeState("RESULT");
              onResult?.(resultGrade);
            };

            requestAnimationFrame(doLift);
          }, 300);
        };

        requestAnimationFrame(doDrop);
      };

      requestAnimationFrame(doMove);
    } else {
      // No prizes left — still do a drop animation then result
      const dropStartYVal = RAIL_Y + 8;
      const dropTargetY = PRIZE_AREA_Y + PRIZE_CELL_H;
      const dropStart = performance.now();
      const dropDuration = 600;

      const doDrop = (now: number) => {
        const el = now - dropStart;
        const t = Math.min(el / dropDuration, 1);
        clawY.current = dropStartYVal + (dropTargetY - dropStartYVal) * easeInOut(t);
        if (t < 1) {
          requestAnimationFrame(doDrop);
          return;
        }
        clawOpen.current = false;
        setTimeout(() => {
          clawOpen.current = true;
          const liftStart = performance.now();
          const liftDuration = 500;
          const liftStartYVal = clawY.current;
          const liftTarget = RAIL_Y + 8;
          const doLift = (now2: number) => {
            const el2 = now2 - liftStart;
            const t2 = Math.min(el2 / liftDuration, 1);
            clawY.current = liftStartYVal + (liftTarget - liftStartYVal) * easeInOut(t2);
            if (t2 < 1) { requestAnimationFrame(doLift); return; }
            clawY.current = liftTarget;
            changeState("RESULT");
            onResult?.(resultGrade);
          };
          requestAnimationFrame(doLift);
        }, 300);
      };
      requestAnimationFrame(doDrop);
    }
  }, [changeState, findGradePrize, onResult, resultGrade]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    prizes.current = buildPrizeGrid();
    grabbedPrize.current = null;
    clawX.current = GLASS_X + GLASS_W / 2;
    clawY.current = RAIL_Y + 8;
    clawOpen.current = true;
    winPulse.current = 0;
    resultScale.current = 0;
    moveDir.current = 0;
    changeState("IDLE");
  }, [changeState]);

  // ── Click/pointer handler ──────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    const btnH = 36;
    const btnLX = BODY_X + 20;
    const btnLW = 64;
    const btnRX = btnLX + btnLW + 10;
    const btnRW = 64;
    const btnDX = btnRX + btnRW + 10;
    const btnDW = BODY_X + BODY_W - 20 - btnDX;

    const inBtn = (bx: number, bw: number) =>
      nx >= bx && nx <= bx + bw && ny >= CTRL_Y && ny <= CTRL_Y + btnH;

    const state = stateRef.current;

    if (state === "RESULT") {
      if (inBtn(btnDX, btnDW)) reset();
      return;
    }

    if (state === "IDLE") {
      if (inBtn(btnLX, btnLW)) moveDir.current = -1;
      else if (inBtn(btnRX, btnRW)) moveDir.current = 1;
      else if (inBtn(btnDX, btnDW)) startDrop();
    }
  }, [reset, startDrop]);

  const handlePointerUp = useCallback(() => {
    moveDir.current = 0;
  }, []);

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
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: "100%",
          maxWidth: W,
          cursor: "pointer",
          display: "block",
          touchAction: "none",
        }}
      />
    </div>
  );
}
