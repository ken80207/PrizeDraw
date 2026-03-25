"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlatSlotGameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineFlatProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: FlatSlotGameState) => void;
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
  bg:          "#f8fafc",       // near-white background
  indigo:      "#6366f1",       // primary machine color
  indigoDark:  "#4f46e5",       // hover/pressed state
  indigoLight: "#818cf8",       // lighter accent
  amber:       "#f59e0b",       // A grade / accent
  blue:        "#3b82f6",       // B grade
  emerald:     "#10b981",       // C grade
  purple:      "#a855f7",       // D grade
  slate:       "#1e293b",       // text color
  slateLight:  "#64748b",       // secondary text
  gray100:     "#f1f5f9",       // reel background
  gray200:     "#e2e8f0",       // dividers
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": FL.amber,
  "B賞": FL.blue,
  "C賞": FL.emerald,
  "D賞": FL.purple,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const SYMBOL_STRIP: Grade[] = [
  "A賞", "C賞", "B賞", "D賞",
  "A賞", "B賞", "C賞", "D賞",
  "A賞", "C賞", "D賞", "B賞",
];

const REEL_COUNT = 3;
const CELL_H = 70;
const REEL_VISIBLE = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers — flat geometry only, no shadows or gradients
// ─────────────────────────────────────────────────────────────────────────────

/** Solid rounded rectangle — no shadow, no outline */
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

/** Outlined rounded rectangle — no fill, no shadow */
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

/** Draw the geometric grade symbol — pure flat fills only */
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
    // Upward-pointing triangle
    const h = size * 0.9;
    const hw = size * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.5);
    ctx.lineTo(cx + hw, cy + h * 0.45);
    ctx.lineTo(cx - hw, cy + h * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (grade === "B賞") {
    // Perfect circle
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (grade === "C賞") {
    // Perfect square
    const half = size * 0.42;
    ctx.beginPath();
    ctx.rect(cx - half, cy - half, half * 2, half * 2);
    ctx.fill();
  } else {
    // Diamond (square rotated 45°)
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

/** Flat sans-serif text — Inter/SF Pro/system-ui */
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

// ─────────────────────────────────────────────────────────────────────────────
// Grade index helper
// ─────────────────────────────────────────────────────────────────────────────

function gradeIndex(grade: Grade): number {
  return SYMBOL_STRIP.findLastIndex((g) => g === grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine_Flat({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineFlatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<FlatSlotGameState>("IDLE");
  const animRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<FlatSlotGameState>("IDLE");

  const reelOffsets = useRef<number[]>([0, 0, 0]);
  const reelSpeeds = useRef<number[]>([0, 0, 0]);
  const reelLocked = useRef<boolean[]>([false, false, false]);
  const leverPull = useRef(0);         // 0..1 pull animation
  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const winPulse = useRef(0);          // 0..1 background color pulse phase
  const resultScale = useRef(0);       // 0..1 scale-up for result overlay
  const lightToggle = useRef(0);       // oscillating 0..1 for indicator lights

  const changeState = useCallback((s: FlatSlotGameState) => {
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

    // Advance light oscillation
    lightToggle.current = (lightToggle.current + dt / 600) % 1;
    const lt = lightToggle.current;

    // ── Background: pure white ─────────────────────────────────────────────

    // Win background pulse — whole canvas tints briefly with grade color
    let bgColor = FL.white;
    if (stateRef.current === "RESULT" && winPulse.current > 0) {
      const pulseAmount = Math.abs(Math.sin(winPulse.current * Math.PI * 2)) * 0.08;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.indigo;
      // Blend white with grade color at low opacity
      ctx.fillStyle = FL.white;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = pulseAmount;
      ctx.fillStyle = gradeHex;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Machine body: large rounded rectangle, solid indigo ────────────────
    const mX = 30, mY = 20, mW = 240, mH = H - 38;
    const bodyR = 24;
    flatRoundRect(ctx, mX, mY, mW, mH, bodyR, FL.indigo);

    // ── Indicator lights row: colored circles, solid color toggle ──────────
    const lightsY = mY + 28;
    const lightColors = [FL.amber, FL.emerald, FL.blue, FL.purple, FL.amber];
    const lightsStartX = mX + 30;
    const lightSpacing = (mW - 60) / (lightColors.length - 1);
    for (let i = 0; i < lightColors.length; i++) {
      const lx = lightsStartX + i * lightSpacing;
      // Alternating on/off based on lightToggle
      const isOn = i % 2 === (lt > 0.5 ? 1 : 0);
      ctx.beginPath();
      ctx.arc(lx, lightsY, 5, 0, Math.PI * 2);
      ctx.fillStyle = isOn ? (lightColors[i] ?? FL.amber) : FL.indigoLight;
      ctx.fill();
    }

    // ── Header text: "FLAT SLOT" ───────────────────────────────────────────
    flatText(ctx, "FLAT SLOT", mX + mW / 2, mY + 58, 18, FL.white, "700");

    // Thin white divider line below header
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(mX + 24, mY + 70, mW - 48, 2);

    // ── Reel windows: white rounded rectangles cut into the indigo body ────
    const reelAreaX = mX + 16;
    const reelAreaY = mY + 82;
    const reelAreaW = mW - 32;
    const reelAreaH = REEL_VISIBLE * CELL_H + 8;
    const reelAreaR = 14;

    // White reel container
    flatRoundRect(ctx, reelAreaX, reelAreaY, reelAreaW, reelAreaH, reelAreaR, FL.white);

    // Winning row highlight — very light gray tint on center row
    const winRowY = reelAreaY + CELL_H + 4;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(reelAreaX, winRowY, reelAreaW, CELL_H, 0);
    ctx.clip();
    ctx.fillStyle = FL.gray100;
    ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);
    ctx.restore();

    // Win row flash — grade color overlay pulses on result
    if (stateRef.current === "RESULT") {
      const flashAmt = Math.abs(Math.sin(winPulse.current * Math.PI * 3.5)) * 0.18;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.indigo;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(reelAreaX, winRowY, reelAreaW, CELL_H, 0);
      ctx.clip();
      ctx.globalAlpha = flashAmt;
      ctx.fillStyle = gradeHex;
      ctx.fillRect(reelAreaX, winRowY, reelAreaW, CELL_H);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Draw reels ─────────────────────────────────────────────────────────
    const singleReelW = Math.floor(reelAreaW / REEL_COUNT);
    for (let r = 0; r < REEL_COUNT; r++) {
      const rx = reelAreaX + r * singleReelW;
      const offset = reelOffsets.current[r] ?? 0;

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, reelAreaY, singleReelW, reelAreaH);
      ctx.clip();

      const startIdx = Math.floor(offset / CELL_H);
      const frac = offset % CELL_H;

      for (let v = -1; v <= REEL_VISIBLE + 1; v++) {
        const symbolIdx = ((startIdx + v) % SYMBOL_STRIP.length + SYMBOL_STRIP.length) % SYMBOL_STRIP.length;
        const grade = SYMBOL_STRIP[symbolIdx] as Grade;
        const cellY = reelAreaY + v * CELL_H - frac + 4;

        // Symbol
        const iconCx = rx + singleReelW / 2;
        const iconCy = cellY + CELL_H * 0.42;
        drawGradeSymbol(ctx, grade, iconCx, iconCy, 22);

        // Grade label — small bold text
        flatText(ctx, grade, iconCx, cellY + CELL_H - 15, 10, GRADE_COLOR[grade] ?? FL.slate, "700");
      }

      // Reel divider — thin light-gray vertical line
      if (r < REEL_COUNT - 1) {
        ctx.fillStyle = FL.gray200;
        ctx.fillRect(rx + singleReelW - 1, reelAreaY + 4, 1, reelAreaH - 8);
      }

      ctx.restore();
    }

    // Win-row marker: two small indigo triangles pointing inward on left/right
    const arrowY = winRowY + CELL_H / 2;
    ctx.fillStyle = FL.indigo;
    // Left pointer
    ctx.beginPath();
    ctx.moveTo(reelAreaX - 2, arrowY);
    ctx.lineTo(reelAreaX - 10, arrowY - 6);
    ctx.lineTo(reelAreaX - 10, arrowY + 6);
    ctx.closePath();
    ctx.fill();
    // Right pointer
    ctx.beginPath();
    ctx.moveTo(reelAreaX + reelAreaW + 2, arrowY);
    ctx.lineTo(reelAreaX + reelAreaW + 10, arrowY - 6);
    ctx.lineTo(reelAreaX + reelAreaW + 10, arrowY + 6);
    ctx.closePath();
    ctx.fill();

    // ── Lever: simple rounded rect arm + circle knob ───────────────────────
    const levX = mX + mW + 20;
    const levBaseY = reelAreaY + reelAreaH / 2 + 10;
    const pullOffset = leverPull.current * 40;
    const levTopY = levBaseY - 52 + pullOffset;

    // Lever track slot (light bg)
    flatRoundRect(ctx, levX - 5, levBaseY - 60, 10, 70, 5, FL.gray200);

    // Lever arm — solid white rounded rect
    flatRoundRect(ctx, levX - 4, levTopY, 8, levBaseY - levTopY + 10, 4, FL.white);

    // Lever socket base
    flatRoundRect(ctx, levX - 10, levBaseY + 5, 20, 12, 6, FL.indigoLight);

    // Lever knob: colored circle (amber)
    ctx.beginPath();
    ctx.arc(levX, levTopY - 8, 11, 0, Math.PI * 2);
    ctx.fillStyle = FL.amber;
    ctx.fill();

    // ── Info display: target grade ─────────────────────────────────────────
    const infoY = reelAreaY + reelAreaH + 14;
    flatRoundRect(ctx, mX + 16, infoY, mW - 32, 32, 8, "rgba(255,255,255,0.15)");
    flatText(ctx, "目標:", mX + 38, infoY + 16, 11, "rgba(255,255,255,0.7)", "600", "left");
    const targetGrade = resultGrade as Grade;
    const targetColor = GRADE_COLOR[targetGrade] ?? FL.white;
    drawGradeSymbol(ctx, targetGrade, mX + mW - 72, infoY + 16, 10);
    flatText(ctx, targetGrade, mX + mW - 52, infoY + 16, 13, targetColor, "700", "left");

    // ── PULL button: large rounded pill, white text on indigo ──────────────
    const btnY = infoY + 48;
    const btnX = mX + 16;
    const btnW = mW - 32;
    const btnH = 40;
    const btnR = 20; // pill shape

    const isIdle = stateRef.current === "IDLE";
    const isResult = stateRef.current === "RESULT";
    const canPull = isIdle || isResult;
    const btnLabel = isResult ? "RESET" : "PULL";

    // Button — uses indigoDark when hovering (static in canvas, always indigoDark when active)
    const btnFill = canPull ? FL.indigoDark : "rgba(99,102,241,0.4)";
    flatRoundRect(ctx, btnX, btnY, btnW, btnH, btnR, btnFill);
    flatText(ctx, btnLabel, btnX + btnW / 2, btnY + btnH / 2, 16, canPull ? FL.white : "rgba(255,255,255,0.4)", "700");

    // ── Status label ───────────────────────────────────────────────────────
    const statusLabels: Record<FlatSlotGameState, string> = {
      IDLE: "Ready",
      SPINNING: "Spinning",
      STOPPING: "Stopping",
      RESULT: "Result",
    };
    flatText(
      ctx,
      statusLabels[stateRef.current],
      mX + mW - 14,
      mY + mH - 14,
      9,
      stateRef.current === "RESULT" ? FL.amber : "rgba(255,255,255,0.5)",
      "600",
      "right",
    );

    // ── Result overlay: scale-up animation, clean + large ─────────────────
    if (stateRef.current === "RESULT" && resultScale.current > 0) {
      const sc = resultScale.current;
      // Ease-in-out scale
      const eased = sc < 0.5 ? 2 * sc * sc : 1 - Math.pow(-2 * sc + 2, 2) / 2;
      const gradeHex = GRADE_COLOR[resultGrade as Grade] ?? FL.indigo;

      ctx.save();
      ctx.translate(mX + mW / 2, reelAreaY + reelAreaH / 2 - 10);
      ctx.scale(eased, eased);
      ctx.globalAlpha = Math.min(eased * 1.5, 1);

      // Clean white pill card
      flatRoundRect(ctx, -72, -52, 144, 104, 16, FL.white);

      // Grade color bar at top of card
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-72, -52, 144, 28, [16, 16, 0, 0]);
      ctx.fillStyle = gradeHex;
      ctx.fill();
      ctx.restore();

      // Large centered grade symbol
      drawGradeSymbol(ctx, resultGrade as Grade, 0, 8, 28);

      // Grade label — large bold
      flatText(ctx, resultGrade, 0, 36, 18, FL.slate, "900");

      // Prize name — small secondary
      flatText(ctx, prizeName, 0, 54, 10, FL.slateLight, "400");

      ctx.restore();
    }

    // Advance animations
    if (stateRef.current === "RESULT") {
      if (winPulse.current < 99) winPulse.current += dt / 400;
      if (resultScale.current < 1) resultScale.current = Math.min(1, resultScale.current + dt / 280);
    } else {
      winPulse.current = 0;
      resultScale.current = 0;
    }

    if (leverPull.current > 0) {
      leverPull.current = Math.max(0, leverPull.current - dt / 350);
    }

  }, [resultGrade, prizeName]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;

    const state = stateRef.current;

    if (state === "SPINNING" || state === "STOPPING") {
      for (let r = 0; r < REEL_COUNT; r++) {
        if (reelLocked.current[r]) continue;
        reelOffsets.current[r] = (reelOffsets.current[r]! + (reelSpeeds.current[r] ?? 0) * dt / 16) % (SYMBOL_STRIP.length * CELL_H);
      }

      if (state === "STOPPING" && reelLocked.current.every((l) => l)) {
        changeState("RESULT");
        onResult?.(resultGrade);
      }
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, changeState, onResult, resultGrade]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Spin logic ─────────────────────────────────────────────────────────────
  const startSpin = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [5.0, 4.5, 4.0];
    reelLocked.current = [false, false, false];
    leverPull.current = 1;
    winPulse.current = 0;
    resultScale.current = 0;
    changeState("SPINNING");

    const targetIdx = gradeIndex(resultGrade as Grade);

    [0, 1, 2].forEach((r) => {
      setTimeout(() => {
        const targetOffset = targetIdx * CELL_H + CELL_H;
        reelSpeeds.current[r] = 1;
        setTimeout(() => {
          // Snap cleanly — no bounce
          reelOffsets.current[r] = (targetOffset % (SYMBOL_STRIP.length * CELL_H) + SYMBOL_STRIP.length * CELL_H) % (SYMBOL_STRIP.length * CELL_H);
          reelSpeeds.current[r] = 0;
          reelLocked.current[r] = true;
          if (r === REEL_COUNT - 1) {
            changeState("STOPPING");
          }
        }, 320);
      }, 550 + r * 500);
    });
  }, [resultGrade, changeState]);

  const reset = useCallback(() => {
    reelOffsets.current = [0, 0, 0];
    reelSpeeds.current = [0, 0, 0];
    reelLocked.current = [false, false, false];
    leverPull.current = 0;
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

    const mX = 30, mY = 20, mW = 240;
    const reelAreaY = mY + 82;
    const reelAreaH = REEL_VISIBLE * CELL_H + 8;
    const infoY = reelAreaY + reelAreaH + 14;
    const btnY = infoY + 48;
    const btnX = mX + 16;
    const btnW = mW - 32;
    const btnH = 40;

    const levX = mX + mW + 20;
    const onBtn = nx >= btnX && nx <= btnX + btnW && ny >= btnY && ny <= btnY + btnH;
    const onLever = nx >= levX - 20 && nx <= levX + 20 && ny >= 60 && ny <= 200;

    const state = stateRef.current;
    if ((onBtn || onLever) && state === "RESULT") {
      reset();
    } else if ((onBtn || onLever) && state === "IDLE") {
      startSpin();
    }
  }, [reset, startSpin]);

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
          borderRadius: 0,
        }}
      />
    </div>
  );
}
