"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClawGameState = "IDLE" | "AIMING" | "DESCENDING" | "GRABBING" | "LIFTING" | "DROPPING" | "RESULT";

export interface ClawMachineProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 340;
const CANVAS_H = 480;

// Claw geometry
const RAIL_Y = 55;
const CLAW_HOME_Y = RAIL_Y + 30;
const BALL_ZONE_Y_MIN = 280;
const BALL_ZONE_Y_MAX = 380;
const CHUTE_X = CANVAS_W - 55;
const CHUTE_Y = 160;
const DROP_ZONE_X = CANVAS_W / 2;

// Grade → color
const GRADE_BALL_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  "A賞": { fill: "#dc2626", stroke: "#fca5a5", text: "#fff" },
  "B賞": { fill: "#ea580c", stroke: "#fdba74", text: "#fff" },
  "C賞": { fill: "#2563eb", stroke: "#93c5fd", text: "#fff" },
  "D賞": { fill: "#16a34a", stroke: "#86efac", text: "#fff" },
};

const BALL_RADIUS = 22;
const BALL_COUNT = 14;

// Seed a deterministic-looking scatter of balls
function makeBalls(resultGrade: string) {
  const positions: { x: number; y: number; grade: string }[] = [];
  const grades = ["A賞", "B賞", "C賞", "D賞"];
  const cols = 7;
  let gradeIdx = 0;

  // Mark one ball as the "target" that will be grabbed
  const targetBallIndex = 6; // middle-ish

  for (let i = 0; i < BALL_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 40 + col * 38 + (row % 2 === 0 ? 0 : 19);
    const y = BALL_ZONE_Y_MIN + row * 48 + 10;
    const grade = i === targetBallIndex ? resultGrade : grades[gradeIdx % 4] ?? "D賞";
    gradeIdx++;
    positions.push({ x, y, grade });
  }
  return positions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  grade: string,
  alpha = 1,
  scale = 1,
) {
  const col = GRADE_BALL_COLOR[grade] ?? GRADE_BALL_COLOR["D賞"];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  // Ball
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, col.stroke);
  grad.addColorStop(1, col.fill);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = `${col.stroke}88`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.fillStyle = col.text;
  ctx.font = `bold ${r * 0.55}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade.charAt(0), 0, 0);

  ctx.restore();
}

function drawClaw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  open: number, // 0 = closed, 1 = fully open
  cableLen: number,
) {
  // Cable from rail
  ctx.save();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, RAIL_Y + 10);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Claw body
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;

  // Center piece
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Prongs (3)
  const prongAngles = [-0.5, 0, 0.5]; // radians offset from straight down
  for (const baseAngle of prongAngles) {
    const spread = open * 0.45;
    const angle = Math.PI / 2 + baseAngle + spread * (baseAngle < 0 ? -1 : baseAngle > 0 ? 1 : 0);
    const len = 28;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Claw tip
    const tipAngle = angle + (baseAngle < 0 ? 0.6 : baseAngle > 0 ? -0.6 : 0) * (1 - open * 0.5);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(tipAngle) * 10, ey + Math.sin(tipAngle) * 10);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine({ resultGrade, prizeName, onResult, onStateChange }: ClawMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ClawGameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  // Claw state refs
  const clawXRef = useRef(CANVAS_W / 2);
  const clawYRef = useRef(CLAW_HOME_Y);
  const clawOpenRef = useRef(1); // start open
  const clawTargetXRef = useRef(CANVAS_W / 2);
  const clawTargetYRef = useRef(CLAW_HOME_Y);
  const grabbedBallRef = useRef<null | { x: number; y: number; grade: string; scale: number }>(null);
  const resultBubbleRef = useRef<{ alpha: number; y: number } | null>(null);

  const ballsRef = useRef(makeBalls(resultGrade));
  const [gameState, setGameState] = useState<ClawGameState>("IDLE");
  const [showResult, setShowResult] = useState(false);

  const setGameStateSync = useCallback(
    (s: ClawGameState) => {
      stateRef.current = s;
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Rebuild balls when resultGrade changes
  useEffect(() => {
    ballsRef.current = makeBalls(resultGrade);
  }, [resultGrade]);

  // Handle mouse/touch move for claw aiming
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const rawX = (e.clientX - rect.left) * scaleX;
    const clamped = Math.max(40, Math.min(CANVAS_W - 40, rawX));
    clawXRef.current = clamped;
    clawTargetXRef.current = clamped;
    if (stateRef.current === "IDLE") setGameStateSync("AIMING");
  }, [setGameStateSync]);

  const handleCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      if (!touch) return;
      const scaleX = CANVAS_W / rect.width;
      const rawX = (touch.clientX - rect.left) * scaleX;
      const clamped = Math.max(40, Math.min(CANVAS_W - 40, rawX));
      clawXRef.current = clamped;
      clawTargetXRef.current = clamped;
      if (stateRef.current === "IDLE") setGameStateSync("AIMING");
    },
    [setGameStateSync],
  );

  const handleDrop = useCallback(() => {
    if (stateRef.current !== "IDLE" && stateRef.current !== "AIMING") return;

    // Find target ball (the one with resultGrade that we pre-placed at index 6)
    const targetBall = ballsRef.current[6];
    if (!targetBall) return;

    setGameStateSync("DESCENDING");
    setShowResult(false);
    grabbedBallRef.current = null;
    resultBubbleRef.current = null;

    // Phase 1: Descend to target ball Y
    const descendY = targetBall.y - BALL_RADIUS;
    clawTargetYRef.current = descendY;
    clawOpenRef.current = 1;

    const waitForDescent = setInterval(() => {
      const dy = Math.abs(clawYRef.current - descendY);
      if (dy < 3) {
        clearInterval(waitForDescent);
        setGameStateSync("GRABBING");
        clawOpenRef.current = 0; // close claw

        setTimeout(() => {
          // Grab ball — visually move ball with claw
          grabbedBallRef.current = { x: clawXRef.current, y: clawYRef.current + 28, grade: resultGrade, scale: 1 };

          // Phase 2: Lift back up
          setGameStateSync("LIFTING");
          clawTargetYRef.current = CLAW_HOME_Y;

          const waitForLift = setInterval(() => {
            const dy2 = Math.abs(clawYRef.current - CLAW_HOME_Y);
            if (dy2 < 3) {
              clearInterval(waitForLift);

              // Phase 3: Move to chute
              clawTargetXRef.current = CHUTE_X;
              setGameStateSync("DROPPING");

              const waitForChute = setInterval(() => {
                const dx = Math.abs(clawXRef.current - CHUTE_X);
                if (dx < 5) {
                  clearInterval(waitForChute);

                  // Drop: open claw, let ball fall
                  clawOpenRef.current = 1;
                  if (grabbedBallRef.current) {
                    grabbedBallRef.current = null;
                  }

                  // Show result bubble
                  resultBubbleRef.current = { alpha: 0, y: CHUTE_Y - 30 };
                  setGameStateSync("RESULT");
                  setShowResult(true);
                  onResult?.(resultGrade);
                }
              }, 100);
            }
          }, 100);
        }, 500); // grabbing pause
      }
    }, 100);
  }, [resultGrade, onResult, setGameStateSync]);

  const handleReset = useCallback(() => {
    clawXRef.current = CANVAS_W / 2;
    clawYRef.current = CLAW_HOME_Y;
    clawOpenRef.current = 1;
    clawTargetXRef.current = CANVAS_W / 2;
    clawTargetYRef.current = CLAW_HOME_Y;
    grabbedBallRef.current = null;
    resultBubbleRef.current = null;
    ballsRef.current = makeBalls(resultGrade);
    setShowResult(false);
    setGameStateSync("IDLE");
  }, [resultGrade, setGameStateSync]);

  // RAF loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    // Smooth claw movement
    const cx = clawXRef.current;
    const cy = clawYRef.current;
    const tx = clawTargetXRef.current;
    const ty = clawTargetYRef.current;
    clawXRef.current += (tx - cx) * 0.08;
    clawYRef.current += (ty - cy) * 0.08;

    // Update grabbed ball position
    if (grabbedBallRef.current) {
      grabbedBallRef.current.x = clawXRef.current;
      grabbedBallRef.current.y = clawYRef.current + 28;
    }

    // Update result bubble
    if (resultBubbleRef.current) {
      if (resultBubbleRef.current.alpha < 1) resultBubbleRef.current.alpha += 0.04;
      resultBubbleRef.current.y -= 0.3;
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Header
    const hGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    hGrad.addColorStop(0, "#0369a1");
    hGrad.addColorStop(0.5, "#0ea5e9");
    hGrad.addColorStop(1, "#0369a1");
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, CANVAS_W, 48);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🪝  夾娃娃機  CLAW MACHINE", CANVAS_W / 2, 24);

    // Machine glass frame
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#0c1a2e";
    ctx.beginPath();
    ctx.roundRect(18, 50, CANVAS_W - 36, CANVAS_H - 60, 12);
    ctx.fill();
    ctx.stroke();

    // Rail
    ctx.fillStyle = "#475569";
    ctx.fillRect(30, RAIL_Y, CANVAS_W - 60, 12);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(30, RAIL_Y, CANVAS_W - 60, 4);

    // Balls (skip grabbed one)
    for (let i = 0; i < ballsRef.current.length; i++) {
      const b = ballsRef.current[i];
      if (!b) continue;
      // If this is target ball and we grabbed it, skip
      if (i === 6 && (state === "GRABBING" || state === "LIFTING" || state === "DROPPING" || state === "RESULT")) continue;
      drawBall(ctx, b.x, b.y, BALL_RADIUS, b.grade);
    }

    // Claw
    drawClaw(ctx, clawXRef.current, clawYRef.current, clawOpenRef.current, clawYRef.current - RAIL_Y);

    // Grabbed ball
    if (grabbedBallRef.current) {
      drawBall(ctx, grabbedBallRef.current.x, grabbedBallRef.current.y, BALL_RADIUS, grabbedBallRef.current.grade);
    }

    // Chute
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CANVAS_W - 75, CHUTE_Y - 10, 50, 70, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#38bdf8aa";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("出口", CANVAS_W - 50, CHUTE_Y + 25);

    // Result bubble in chute
    if (resultBubbleRef.current && state === "RESULT") {
      const bubble = resultBubbleRef.current;
      const col = GRADE_BALL_COLOR[resultGrade] ?? GRADE_BALL_COLOR["D賞"];
      ctx.save();
      ctx.globalAlpha = Math.min(1, bubble.alpha);
      drawBall(ctx, CANVAS_W - 50, bubble.y + 55, BALL_RADIUS * 1.4, resultGrade);
      ctx.restore();

      // Prize text
      if (bubble.alpha > 0.5) {
        ctx.save();
        ctx.globalAlpha = (bubble.alpha - 0.5) * 2;
        ctx.fillStyle = col.fill;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const label = `${resultGrade}${prizeName ? ` · ${prizeName}` : ""}`;
        ctx.strokeText(label, CANVAS_W / 2, CANVAS_H - 18);
        ctx.fillText(label, CANVAS_W / 2, CANVAS_H - 18);
        ctx.restore();
      }
    }

    // Aim indicator
    if (state === "IDLE" || state === "AIMING") {
      ctx.save();
      ctx.strokeStyle = "#38bdf844";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(clawXRef.current, CLAW_HOME_Y + 30);
      ctx.lineTo(clawXRef.current, BALL_ZONE_Y_MIN);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  const isInteractable = gameState === "IDLE" || gameState === "AIMING";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-gray-700 shadow-2xl block cursor-crosshair"
        style={{ background: "#0f172a", touchAction: "none" }}
        onMouseMove={handleCanvasMouseMove}
        onTouchMove={handleCanvasTouchMove}
      />

      <div className="flex gap-3">
        <button
          onClick={handleDrop}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-sky-600 hover:bg-sky-500 active:scale-95 text-white shadow-sky-500/30 cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          下爪 DROP
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          重置
        </button>
      </div>

      <p className="text-xs text-gray-500">
        移動滑鼠/觸控來控制夾子位置，然後按「下爪」
      </p>

      <div className="text-xs text-gray-500 font-mono">
        狀態:{" "}
        <span
          className={
            gameState === "RESULT"
              ? "text-amber-400"
              : gameState === "GRABBING" || gameState === "LIFTING"
                ? "text-sky-400"
                : "text-gray-400"
          }
        >
          {gameState}
        </span>
      </div>
    </div>
  );
}
