"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GachaGameState = "IDLE" | "TURNING" | "DISPENSING" | "BOUNCING" | "READY_TO_OPEN" | "OPENING" | "RESULT";

export interface GachaMachineProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 340;
const CANVAS_H = 480;

// Machine geometry
const MACHINE_CX = CANVAS_W / 2;
const DOME_CX = MACHINE_CX;
const DOME_CY = 175;
const DOME_R = 110;
const NECK_Y = DOME_CY + DOME_R - 5;
const NECK_H = 35;
const NECK_W = 40;
const CHUTE_Y = NECK_Y + NECK_H;
const CHUTE_H = 50;
const CHUTE_W = 60;
const HANDLE_CX = DOME_CX + DOME_R + 20;
const HANDLE_CY = DOME_CY + 20;
const HANDLE_R = 22;

// Capsule bounce area
const CAPSULE_LAND_X = MACHINE_CX;
const CAPSULE_LAND_Y = CHUTE_Y + CHUTE_H + 35;

// Grade colors for capsules
const GRADE_CAPSULE: Record<string, { top: string; bottom: string; glow: string }> = {
  "A賞": { top: "#fbbf24", bottom: "#92400e", glow: "#f59e0b" },
  "B賞": { top: "#38bdf8", bottom: "#1e40af", glow: "#0ea5e9" },
  "C賞": { top: "#34d399", bottom: "#065f46", glow: "#10b981" },
  "D賞": { top: "#c084fc", bottom: "#4c1d95", glow: "#a855f7" },
};

// Mini capsules inside dome
const MINI_CAPSULE_POSITIONS = [
  { x: -60, y: -40, grade: "B賞" }, { x: -20, y: -55, grade: "C賞" }, { x: 30, y: -45, grade: "A賞" },
  { x: 60, y: -30, grade: "D賞" }, { x: -50, y: -5, grade: "C賞" }, { x: 0, y: -10, grade: "B賞" },
  { x: 45, y: 5, grade: "A賞" }, { x: -70, y: 25, grade: "D賞" }, { x: -30, y: 30, grade: "C賞" },
  { x: 20, y: 35, grade: "B賞" }, { x: 65, y: 30, grade: "A賞" }, { x: -55, y: 60, grade: "D賞" },
  { x: 5, y: 65, grade: "C賞" }, { x: 50, y: 55, grade: "B賞" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  grade: string,
  alpha = 1,
  openFraction = 0, // 0 = closed, 1 = fully open
) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"];

  ctx.save();
  ctx.globalAlpha = alpha;

  if (openFraction < 0.01) {
    // Closed capsule
    // Bottom half
    ctx.fillStyle = col.bottom;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Top half
    ctx.fillStyle = col.top;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Equator line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();

    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.4, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Opening animation: top half moves up, bottom half stays
    const topOffY = -openFraction * r * 2.5;

    // Bottom half
    ctx.fillStyle = col.bottom;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Top half (moves up)
    ctx.fillStyle = col.top;
    ctx.beginPath();
    ctx.arc(cx, cy + topOffY, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Prize inside (revealed as it opens)
    if (openFraction > 0.3) {
      const prizeAlpha = (openFraction - 0.3) / 0.7;
      ctx.save();
      ctx.globalAlpha = alpha * prizeAlpha;
      const prizeCol = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"];
      // Glow
      ctx.shadowColor = prizeCol.glow;
      ctx.shadowBlur = 20 * openFraction;
      ctx.fillStyle = prizeCol.top;
      ctx.font = `bold ${r * 0.8}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grade.charAt(0), cx, cy + r * 0.3);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawMiniCapsule(ctx: CanvasRenderingContext2D, cx: number, cy: number, grade: string, wobble: number) {
  const col = GRADE_CAPSULE[grade] ?? GRADE_CAPSULE["D賞"];
  const r = 9;
  const wx = Math.sin(wobble) * 1.5;
  const wy = Math.cos(wobble * 0.7) * 1;

  ctx.save();
  ctx.fillStyle = col.bottom;
  ctx.beginPath();
  ctx.arc(cx + wx, cy + wy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = col.top;
  ctx.beginPath();
  ctx.arc(cx + wx, cy + wy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx + wx - r, cy + wy);
  ctx.lineTo(cx + wx + r, cy + wy);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine({ resultGrade, prizeName, onResult, onStateChange }: GachaMachineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GachaGameState>("IDLE");
  const rafRef = useRef<number | null>(null);

  // Animation state refs
  const handleAngleRef = useRef(0);      // degrees, 0 = rest position
  const handleVelocityRef = useRef(0);
  const totalRotationRef = useRef(0);    // cumulative degrees turned
  const isDraggingHandleRef = useRef(false);
  const dragStartAngleRef = useRef(0);
  const prevHandleAngleRef = useRef(0);

  // Capsule animation
  const capsuleRef = useRef({
    x: MACHINE_CX,
    y: CHUTE_Y - 20,
    vy: 0,
    bounces: 0,
    openFraction: 0,
    visible: false,
    phase: "hidden" as "hidden" | "falling" | "bouncing" | "settled" | "opening" | "open",
  });

  const wobbleTimeRef = useRef(0);
  const [gameState, setGameState] = useState<GachaGameState>("IDLE");

  const setGameStateSync = useCallback(
    (s: GachaGameState) => {
      stateRef.current = s;
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Handle pointer events on the handle
  const getAngleFromHandle = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    return Math.atan2(py - HANDLE_CY, px - HANDLE_CX) * (180 / Math.PI);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (stateRef.current !== "IDLE") return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const angle = getAngleFromHandle(e.clientX, e.clientY, rect);
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const dist = Math.hypot(px - HANDLE_CX, py - HANDLE_CY);
      if (dist < HANDLE_R + 15) {
        isDraggingHandleRef.current = true;
        dragStartAngleRef.current = angle - handleAngleRef.current;
        prevHandleAngleRef.current = handleAngleRef.current;
      }
    },
    [getAngleFromHandle],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingHandleRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const angle = getAngleFromHandle(e.clientX, e.clientY, rect);
      const newHandleAngle = angle - dragStartAngleRef.current;
      const delta = newHandleAngle - prevHandleAngleRef.current;
      // Only count rotation in the clockwise direction (positive delta)
      if (delta > 0) totalRotationRef.current += delta;
      prevHandleAngleRef.current = newHandleAngle;
      handleAngleRef.current = newHandleAngle;
      handleVelocityRef.current = delta;

      // After 360° of cumulative rotation, dispense
      if (totalRotationRef.current >= 360 && stateRef.current === "IDLE") {
        isDraggingHandleRef.current = false;
        triggerDispense();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAngleFromHandle],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingHandleRef.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (stateRef.current !== "IDLE") return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      if (!touch) return;
      const angle = getAngleFromHandle(touch.clientX, touch.clientY, rect);
      isDraggingHandleRef.current = true;
      dragStartAngleRef.current = angle - handleAngleRef.current;
      prevHandleAngleRef.current = handleAngleRef.current;
    },
    [getAngleFromHandle],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDraggingHandleRef.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.touches[0];
      if (!touch) return;
      const angle = getAngleFromHandle(touch.clientX, touch.clientY, rect);
      const newHandleAngle = angle - dragStartAngleRef.current;
      const delta = newHandleAngle - prevHandleAngleRef.current;
      if (delta > 0) totalRotationRef.current += delta;
      prevHandleAngleRef.current = newHandleAngle;
      handleAngleRef.current = newHandleAngle;

      if (totalRotationRef.current >= 360 && stateRef.current === "IDLE") {
        isDraggingHandleRef.current = false;
        triggerDispense();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAngleFromHandle],
  );

  const triggerDispense = useCallback(() => {
    setGameStateSync("DISPENSING");
    // Continue spinning handle automatically
    const startTime = performance.now();
    const spinDuration = 800;

    const spinInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / spinDuration;
      handleAngleRef.current += 15 * (1 - progress * 0.5);
      totalRotationRef.current = 0; // reset for next time
      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
        // Start capsule fall
        capsuleRef.current = {
          x: MACHINE_CX,
          y: CHUTE_Y - 20,
          vy: 0,
          bounces: 0,
          openFraction: 0,
          visible: true,
          phase: "falling",
        };
        setGameStateSync("BOUNCING");
      }
    }, 16);
  }, [setGameStateSync]);

  const handleAutoTurn = useCallback(() => {
    if (stateRef.current !== "IDLE") return;
    triggerDispense();
  }, [triggerDispense]);

  const handleOpenCapsule = useCallback(() => {
    if (stateRef.current !== "READY_TO_OPEN") return;
    setGameStateSync("OPENING");
  }, [setGameStateSync]);

  const handleReset = useCallback(() => {
    handleAngleRef.current = 0;
    handleVelocityRef.current = 0;
    totalRotationRef.current = 0;
    isDraggingHandleRef.current = false;
    capsuleRef.current = {
      x: MACHINE_CX,
      y: CHUTE_Y - 20,
      vy: 0,
      bounces: 0,
      openFraction: 0,
      visible: false,
      phase: "hidden",
    };
    setGameStateSync("IDLE");
  }, [setGameStateSync]);

  // RAF loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    wobbleTimeRef.current += 0.03;
    const t = wobbleTimeRef.current;
    const state = stateRef.current;

    // Capsule physics
    const cap = capsuleRef.current;
    if (cap.phase === "falling") {
      cap.vy += 0.7; // gravity
      cap.y += cap.vy;
      if (cap.y >= CAPSULE_LAND_Y) {
        cap.y = CAPSULE_LAND_Y;
        cap.vy = -cap.vy * 0.55; // bounce
        cap.bounces++;
        if (cap.bounces >= 4 || Math.abs(cap.vy) < 1.5) {
          cap.phase = "settled";
          cap.vy = 0;
          cap.y = CAPSULE_LAND_Y;
          setGameStateSync("READY_TO_OPEN");
        }
      }
    } else if (cap.phase === "settled") {
      // Gentle wobble
      cap.y = CAPSULE_LAND_Y + Math.sin(t * 3) * 1.5;
    } else if (cap.phase === "opening") {
      if (stateRef.current === "OPENING" || stateRef.current === "RESULT") {
        cap.openFraction = Math.min(1, cap.openFraction + 0.025);
        if (cap.openFraction >= 1 && stateRef.current !== "RESULT") {
          setGameStateSync("RESULT");
          onResult?.(resultGrade);
        }
      }
    }

    if (state === "OPENING" && cap.phase === "settled") {
      cap.phase = "opening";
    }

    // Handle inertia
    if (!isDraggingHandleRef.current && state === "IDLE") {
      handleVelocityRef.current *= 0.88;
      if (Math.abs(handleVelocityRef.current) > 0.1) {
        handleAngleRef.current += handleVelocityRef.current;
        if (handleVelocityRef.current > 0) totalRotationRef.current += handleVelocityRef.current;
        if (totalRotationRef.current >= 360) {
          totalRotationRef.current = 0;
          triggerDispense();
        }
      }
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Header
    const hGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    hGrad.addColorStop(0, "#7e22ce");
    hGrad.addColorStop(0.5, "#ec4899");
    hGrad.addColorStop(1, "#7e22ce");
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, CANVAS_W, 48);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥚  扭蛋機  GACHA MACHINE", CANVAS_W / 2, 24);

    // Machine body (bottom part)
    ctx.fillStyle = "#c2410c";
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(DOME_CX - DOME_R * 0.65, DOME_CY + DOME_R * 0.55, DOME_R * 1.3, 55, [0, 0, 8, 8]);
    ctx.fill();
    ctx.stroke();

    // Dome base / neck
    ctx.fillStyle = "#9a3412";
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(DOME_CX - NECK_W / 2 - 10, DOME_CY + DOME_R - 20, NECK_W + 20, NECK_H + 10, 4);
    ctx.fill();
    ctx.stroke();

    // Chute
    ctx.fillStyle = "#7c2d12";
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(DOME_CX - CHUTE_W / 2, CHUTE_Y, CHUTE_W, CHUTE_H, [0, 0, 6, 6]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.roundRect(DOME_CX - CHUTE_W / 2 + 6, CHUTE_Y + 8, CHUTE_W - 12, CHUTE_H - 16, 4);
    ctx.fill();
    ctx.fillStyle = "#f97316aa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("出口", DOME_CX, CHUTE_Y + CHUTE_H / 2);

    // Dome (glass sphere)
    // Outer glow
    const domeGlow = ctx.createRadialGradient(DOME_CX, DOME_CY, DOME_R * 0.9, DOME_CX, DOME_CY, DOME_R * 1.05);
    domeGlow.addColorStop(0, "rgba(56,189,248,0)");
    domeGlow.addColorStop(1, "rgba(56,189,248,0.12)");
    ctx.fillStyle = domeGlow;
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Dome background (translucent)
    const domeGrad = ctx.createRadialGradient(DOME_CX - 30, DOME_CY - 40, 10, DOME_CX, DOME_CY, DOME_R);
    domeGrad.addColorStop(0, "rgba(186,230,253,0.15)");
    domeGrad.addColorStop(1, "rgba(14,165,233,0.05)");
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
    ctx.fill();

    // Mini capsules inside dome (clip to dome)
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R - 6, 0, Math.PI * 2);
    ctx.clip();
    for (const mc of MINI_CAPSULE_POSITIONS) {
      drawMiniCapsule(ctx, DOME_CX + mc.x, DOME_CY + mc.y, mc.grade, t + mc.x * 0.1);
    }
    ctx.restore();

    // Dome glass rim
    ctx.strokeStyle = "rgba(186,230,253,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(DOME_CX, DOME_CY, DOME_R, 0, Math.PI * 2);
    ctx.stroke();

    // Dome highlight
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(DOME_CX - DOME_R * 0.3, DOME_CY - DOME_R * 0.45, DOME_R * 0.3, DOME_R * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Handle
    const handleRad = (handleAngleRef.current * Math.PI) / 180;
    const hkx = HANDLE_CX + Math.cos(handleRad) * HANDLE_R;
    const hky = HANDLE_CY + Math.sin(handleRad) * HANDLE_R;

    // Handle arm
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(HANDLE_CX, HANDLE_CY);
    ctx.lineTo(hkx, hky);
    ctx.stroke();

    // Handle hub
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(HANDLE_CX, HANDLE_CY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Handle knob
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hkx, hky, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotation progress indicator (arc around handle)
    if (state === "IDLE" && totalRotationRef.current > 0) {
      const progress = Math.min(1, totalRotationRef.current / 360);
      ctx.strokeStyle = `rgba(251,191,36,${0.4 + progress * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(HANDLE_CX, HANDLE_CY, HANDLE_R + 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }

    // Handle label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("旋轉把手", HANDLE_CX, HANDLE_CY + HANDLE_R + 12);

    // Capsule
    if (cap.visible) {
      drawCapsule(ctx, cap.x, cap.y, 26, resultGrade, 1, cap.openFraction);

      // Click hint
      if (state === "READY_TO_OPEN") {
        ctx.save();
        const pulse = 0.7 + Math.sin(t * 4) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("點擊扭蛋打開！", cap.x, cap.y - 35);
        ctx.restore();
      }

      // Result text
      if (state === "RESULT" && cap.openFraction > 0.7) {
        const resultAlpha = (cap.openFraction - 0.7) / 0.3;
        const col = GRADE_CAPSULE[resultGrade] ?? GRADE_CAPSULE["D賞"];
        ctx.save();
        ctx.globalAlpha = resultAlpha;
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = 20;
        ctx.fillStyle = col.top;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          `✨ ${resultGrade}${prizeName ? ` — ${prizeName}` : ""} ✨`,
          CANVAS_W / 2,
          cap.y - 45,
        );
        ctx.restore();
      }
    }

    // Instructions overlay (idle)
    if (state === "IDLE") {
      ctx.fillStyle = "#38bdf8aa";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("拖曳把手旋轉 360°，或按「自動旋轉」", CANVAS_W / 2, CANVAS_H - 16);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [resultGrade, prizeName, onResult, setGameStateSync, triggerDispense]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  // Handle capsule click to open
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (stateRef.current !== "READY_TO_OPEN") return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const cap = capsuleRef.current;
      const dist = Math.hypot(px - cap.x, py - cap.y);
      if (dist < 40) {
        handleOpenCapsule();
      }
    },
    [handleOpenCapsule],
  );

  const isInteractable = gameState === "IDLE";

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-gray-700 shadow-2xl block"
        style={{
          background: "#0f172a",
          touchAction: "none",
          cursor: gameState === "IDLE" ? "grab" : gameState === "READY_TO_OPEN" ? "pointer" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onClick={handleCanvasClick}
      />

      <div className="flex gap-3">
        <button
          onClick={handleAutoTurn}
          disabled={!isInteractable}
          className={[
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg",
            isInteractable
              ? "bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-purple-500/30 cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed",
          ].join(" ")}
        >
          自動旋轉
        </button>
        {gameState === "READY_TO_OPEN" && (
          <button
            onClick={handleOpenCapsule}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 active:scale-95 text-white shadow-lg shadow-amber-500/30 transition-all cursor-pointer"
          >
            打開扭蛋！
          </button>
        )}
        <button
          onClick={handleReset}
          className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          重置
        </button>
      </div>

      <div className="text-xs text-gray-500 font-mono">
        狀態:{" "}
        <span
          className={
            gameState === "RESULT"
              ? "text-amber-400"
              : gameState === "READY_TO_OPEN"
                ? "text-emerald-400"
                : gameState === "DISPENSING" || gameState === "BOUNCING"
                  ? "text-purple-400"
                  : "text-gray-400"
          }
        >
          {gameState}
        </span>
      </div>
    </div>
  );
}
