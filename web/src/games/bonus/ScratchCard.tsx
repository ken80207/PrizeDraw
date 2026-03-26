"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ScratchCardGameState = "IDLE" | "SCRATCHING" | "RESULT";

export interface ScratchCardProps {
  resultGrade: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ScratchCardGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 340;
const CANVAS_H = 240;

const GRID_COLS = 3;
const GRID_ROWS = 3;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const PADDING_X = 20;
const PADDING_Y = 56; // leave room for header
const CELL_GAP = 6;
const CELL_W = (CANVAS_W - PADDING_X * 2 - CELL_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CELL_H = (CANVAS_H - PADDING_Y - 20 - CELL_GAP * (GRID_ROWS - 1)) / GRID_ROWS;

// Scratch radius
const SCRATCH_R = 18;

// Grade colours
const GRADE_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  "A賞": { bg: "#b45309", text: "#fde68a", glow: "#f59e0b" },
  "B賞": { bg: "#1d4ed8", text: "#bae6fd", glow: "#3b82f6" },
  "C賞": { bg: "#065f46", text: "#a7f3d0", glow: "#10b981" },
  "D賞": { bg: "#581c87", text: "#ddd6fe", glow: "#a855f7" },
};

// Scratch-off layer colour
const SILVER_COLOR = "#9ca3af";
const SILVER_SHINE = "#d1d5db";
const SCRATCH_THRESHOLD = 0.55; // fraction of scratch layer removed to auto-complete

// ─────────────────────────────────────────────────────────────────────────────
// Grid generation
// Build a 3x3 grid ensuring the resultGrade appears exactly 3 times so it
// always constitutes a win. Other cells are random from the remaining grades.
// ─────────────────────────────────────────────────────────────────────────────

function buildGrid(resultGrade: string): string[] {
  const allGrades = ["A賞", "B賞", "C賞", "D賞"];
  const other = allGrades.filter((g) => g !== resultGrade);

  // 3 winners + 6 non-winners
  const cells: string[] = [resultGrade, resultGrade, resultGrade];
  for (let i = 0; i < 6; i++) {
    cells.push(other[Math.floor(Math.random() * other.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

function cellRect(index: number): { x: number; y: number; w: number; h: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: PADDING_X + col * (CELL_W + CELL_GAP),
    y: PADDING_Y + row * (CELL_H + CELL_GAP),
    w: CELL_W,
    h: CELL_H,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawCardBase(ctx: CanvasRenderingContext2D, grid: string[]) {
  // Card background
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, "#fdf6e3");
  bg.addColorStop(1, "#fde68a");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, CANVAS_W, CANVAS_H, 12);
  ctx.fill();

  // Header
  ctx.fillStyle = "#92400e";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("刮刮樂", CANVAS_W / 2, 20);

  ctx.fillStyle = "#b45309";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("三個相同等級即獲獎！", CANVAS_W / 2, 40);

  // Draw revealed cells
  for (let i = 0; i < CELL_COUNT; i++) {
    const { x, y, w, h } = cellRect(i);
    const grade = grid[i];
    const col = GRADE_COLORS[grade] ?? { bg: "#374151", text: "#f3f4f6", glow: "#6b7280" };

    // Cell background
    ctx.fillStyle = col.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // Grade text
    ctx.fillStyle = col.text;
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(grade, x + w / 2, y + h / 2);
  }
}

function drawSilverLayer(
  ctx: CanvasRenderingContext2D,
  scratchCanvas: HTMLCanvasElement | null,
  revealedCells: Set<number>,
) {
  if (!scratchCanvas) return;

  for (let i = 0; i < CELL_COUNT; i++) {
    if (revealedCells.has(i)) continue;
    const { x, y, w, h } = cellRect(i);

    // Silver background
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, SILVER_SHINE);
    grad.addColorStop(0.4, SILVER_COLOR);
    grad.addColorStop(1, SILVER_SHINE);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // "刮" hint text
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("刮", x + w / 2, y + h / 2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ScratchCard({
  resultGrade,
  prizeName = "獎品",
  onResult,
  onStateChange,
}: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Off-screen mask canvas per cell: tracks scratched pixels
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Per-cell pixel counters
  const scratchedPxRef = useRef<number[]>(Array(CELL_COUNT).fill(0));
  const totalPxRef = useRef<number>(0);

  const gridRef = useRef<string[]>([]);
  const [gameState, setGameState] = useState<ScratchCardGameState>("IDLE");
  const [revealedCells, setRevealedCells] = useState<Set<number>>(new Set());
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number>(0);
  const glowFrameRef = useRef<number>(0);
  const [glowAlpha, setGlowAlpha] = useState(0);

  const setState = useCallback(
    (s: ScratchCardGameState) => {
      setGameState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  // Initialise grid and mask canvas
  useEffect(() => {
    gridRef.current = buildGrid(resultGrade);
    scratchedPxRef.current = Array(CELL_COUNT).fill(0);
    setRevealedCells(new Set());

    // Create per-cell scratch mask (silver layer, destination-out painting)
    const mask = document.createElement("canvas");
    mask.width = CANVAS_W;
    mask.height = CANVAS_H;
    const mCtx = mask.getContext("2d");
    if (mCtx) {
      mCtx.fillStyle = "#fff";
      mCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    maskCanvasRef.current = mask;

    // Approximate total pixels per cell for threshold
    totalPxRef.current = Math.round(CELL_W * CELL_H);

    // Draw
    draw(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultGrade]);

  // Draw composite: base → scratch mask per cell
  function draw(revealed: Set<number>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawCardBase(ctx, gridRef.current);
    drawSilverLayer(ctx, maskCanvasRef.current, revealed);
  }

  // Result glow
  useEffect(() => {
    if (gameState !== "RESULT") return;
    let frame = 0;
    const tick = () => {
      frame++;
      const g = 0.5 + 0.5 * Math.sin(frame * 0.07);
      setGlowAlpha(g);
      glowFrameRef.current = requestAnimationFrame(tick);
    };
    glowFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(glowFrameRef.current);
  }, [gameState]);

  // Scratch helper
  function scratch(canvasX: number, canvasY: number, revealed: Set<number>): Set<number> {
    const ctx = canvasRef.current?.getContext("2d");
    const mCtx = maskCanvasRef.current?.getContext("2d");
    if (!ctx || !mCtx) return revealed;

    // Find which cell this point belongs to
    let hitCellIndex = -1;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (revealed.has(i)) continue;
      const { x, y, w, h } = cellRect(i);
      if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h) {
        hitCellIndex = i;
        break;
      }
    }
    if (hitCellIndex === -1) return revealed;

    // Erase on mask canvas
    mCtx.globalCompositeOperation = "destination-out";
    mCtx.beginPath();
    mCtx.arc(canvasX, canvasY, SCRATCH_R, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.globalCompositeOperation = "source-over";

    // Estimate scratched pixels via bounding area approximation
    scratchedPxRef.current[hitCellIndex] = Math.min(
      scratchedPxRef.current[hitCellIndex] + Math.PI * SCRATCH_R * SCRATCH_R * 0.6,
      totalPxRef.current,
    );

    let nextRevealed = revealed;
    if (scratchedPxRef.current[hitCellIndex] / totalPxRef.current >= SCRATCH_THRESHOLD) {
      nextRevealed = new Set(revealed);
      nextRevealed.add(hitCellIndex);
    }

    draw(nextRevealed);
    return nextRevealed;
  }

  function getCanvasPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (gameState === "RESULT") return;
      isDraggingRef.current = true;
      if (gameState === "IDLE") setState("SCRATCHING");
      const pos = getCanvasPos(e);
      setRevealedCells((prev) => scratch(pos.x, pos.y, prev));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState, setState],
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingRef.current || gameState === "RESULT") return;
      const pos = getCanvasPos(e);
      setRevealedCells((prev) => {
        const next = scratch(pos.x, pos.y, prev);
        // Check if all cells revealed
        if (next.size === CELL_COUNT) {
          setState("RESULT");
          onResult?.(resultGrade);
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState, resultGrade, onResult, setState],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // "Reveal all" shortcut
  const revealAll = useCallback(() => {
    if (gameState === "RESULT") return;
    const all = new Set(Array.from({ length: CELL_COUNT }, (_, i) => i));
    setRevealedCells(all);
    draw(all);
    setState("RESULT");
    onResult?.(resultGrade);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, resultGrade, onResult, setState]);

  const gradeGlow = GRADE_COLORS[resultGrade]?.glow ?? "#6366f1";

  return (
    <div className="flex flex-col items-center gap-3 p-4 select-none">
      {/* Card canvas */}
      <div
        className="rounded-xl overflow-hidden border-2 border-amber-700/40 shadow-xl"
        style={
          gameState === "RESULT"
            ? { boxShadow: `0 0 ${24 * glowAlpha}px ${gradeGlow}80` }
            : undefined
        }
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="cursor-none touch-none"
          style={{ cursor: "crosshair" }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          aria-label="刮刮樂 — 用滑鼠刮開銀色區域"
          role="application"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {gameState !== "RESULT" && (
          <button
            onClick={revealAll}
            className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 active:scale-95 text-amber-100 text-xs font-bold transition-all"
          >
            全部揭曉
          </button>
        )}
        {gameState === "RESULT" && (
          <div
            className="px-6 py-2 rounded-full text-sm font-black animate-bounce"
            style={{
              background: gradeGlow,
              color: "#fff",
              boxShadow: `0 0 20px ${gradeGlow}80`,
            }}
          >
            MATCH! {resultGrade} — {prizeName}！
          </div>
        )}
      </div>

      {gameState === "IDLE" && (
        <p className="text-xs text-gray-500">用滑鼠刮開銀色區域</p>
      )}
      {gameState === "SCRATCHING" && (
        <p className="text-xs text-amber-400 font-bold">繼續刮...</p>
      )}
    </div>
  );
}
