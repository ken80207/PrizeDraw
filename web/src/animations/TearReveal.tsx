"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Fraction of revealed area that locks in the peel and triggers tear-off. */
const REVEAL_THRESHOLD = 0.7;

/** Spring physics constants for snap-back animation. */
const SPRING_STIFFNESS = 0.14;
const SPRING_DAMPING = 0.72;

/** Tear-off animation velocities per frame. */
const TEAROFF_ROT_SPEED = 6; // degrees per frame
const TEAROFF_VX = 12; // px per frame
const TEAROFF_VY = -9; // px per frame
const TEAROFF_ALPHA_DEC = 0.035;

/** Maximum curl width drawn on the folded-back section (px). */
const CURL_WIDTH = 28;

/** Paper colour stops — warm parchment. */
const PAPER_COLOURS = ["#e8d5b7", "#d9bc93", "#c8a57a", "#b08d61", "#8B6914"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

export interface TearRevealProps {
  prizePhotoUrl: string;
  prizeGrade?: string;
  prizeName?: string;
  onRevealed: () => void;
  onProgress?: (progress: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reflect point P across the line defined by a point on it (linePoint) and
 *  a unit normal (lineNormal). */
function reflectPoint(p: Point, linePoint: Point, lineNormal: Point): Point {
  // Project (p - linePoint) onto lineNormal then reflect
  const dx = p.x - linePoint.x;
  const dy = p.y - linePoint.y;
  const dot = dx * lineNormal.x + dy * lineNormal.y;
  return {
    x: p.x - 2 * dot * lineNormal.x,
    y: p.y - 2 * dot * lineNormal.y,
  };
}

/** Return the normalised perpendicular to the drag vector (fold-line direction). */
function foldNormal(dragVec: Point): Point {
  // Perpendicular: rotate 90° → (-dy, dx), then normalise
  const len = Math.hypot(dragVec.x, dragVec.y);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: -dragVec.y / len, y: dragVec.x / len };
}

/** Progress [0..1]: fraction of canvas area on the "peeled" side of the fold line. */
function computeProgress(
  start: Point,
  current: Point,
  canvasW: number,
  canvasH: number,
): number {
  const drag = { x: current.x - start.x, y: current.y - start.y };
  const dragLen = Math.hypot(drag.x, drag.y);
  if (dragLen < 1) return 0;

  // Count canvas corner samples that are on the "peeled" side
  const normal = foldNormal(drag);
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: canvasW, y: 0 },
    { x: canvasW, y: canvasH },
    { x: 0, y: canvasH },
  ];
  // Drag direction unit vector (towards peel)
  const dragUnit = { x: drag.x / dragLen, y: drag.y / dragLen };

  // The fold line passes through `current`. A corner is peeled if the vector
  // from current→corner is on the same half-plane as the drag direction.
  let peeled = 0;
  for (const c of corners) {
    const cx = c.x - current.x;
    const cy = c.y - current.y;
    if (cx * dragUnit.x + cy * dragUnit.y > 0) peeled++;
  }

  // Blend between geometric corner count and continuous drag distance
  const cornerFraction = peeled / 4;
  // Also factor in drag distance relative to the canvas diagonal
  const diag = Math.hypot(canvasW, canvasH);
  const distFraction = Math.min(dragLen / (diag * 0.75), 1);
  return Math.min(cornerFraction * 0.6 + distFraction * 0.4, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas rendering
// ─────────────────────────────────────────────────────────────────────────────

interface RenderState {
  startPoint: Point;
  currentPoint: Point;
  /** Tear-off overlay transform — only used when tearing off. */
  tearOff?: {
    rotation: number; // degrees
    tx: number;
    ty: number;
    alpha: number;
  };
}

function renderPeel(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  progress: number,
): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  if (progress <= 0) {
    // Full paper cover
    drawPaper(ctx, W, H, 1);
    return;
  }

  const drag = {
    x: state.currentPoint.x - state.startPoint.x,
    y: state.currentPoint.y - state.startPoint.y,
  };
  const dragLen = Math.hypot(drag.x, drag.y);
  if (dragLen < 1) {
    drawPaper(ctx, W, H, 1);
    return;
  }

  const normal = foldNormal(drag); // unit vector along fold line
  const dragUnit = { x: drag.x / dragLen, y: drag.y / dragLen };
  const foldPoint = state.currentPoint; // fold line passes through cursor

  // ── 1. Build the un-peeled clipping region ────────────────────────────────
  // Everything where dot(corner - foldPoint, dragUnit) <= 0 is still covered.
  ctx.save();
  ctx.beginPath();
  buildHalfPlaneClip(ctx, foldPoint, dragUnit, W, H, false);
  ctx.clip();
  drawPaper(ctx, W, H, 1);
  ctx.restore();

  // ── 2. Draw the folded-back ghost (mirror of peeled region) ───────────────
  ctx.save();
  // Clip to the peeled region to keep the ghost inside its own zone
  ctx.beginPath();
  buildHalfPlaneClip(ctx, foldPoint, dragUnit, W, H, true);
  ctx.clip();
  ctx.globalAlpha = 0.28;

  // Reflect the canvas drawing through the fold line to simulate the flipped paper back
  const [a, b, c, d, e, f] = reflectTransform(foldPoint, normal);
  ctx.transform(a, b, c, d, e, f);
  drawPaper(ctx, W, H, 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── 3. Fold-line shadow / curl gradient ───────────────────────────────────
  drawFoldShadow(ctx, foldPoint, normal, dragUnit, W, H);
}

function renderTearOff(
  ctx: CanvasRenderingContext2D,
  tearOff: NonNullable<RenderState["tearOff"]>,
): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2 + tearOff.tx;
  const cy = H / 2 + tearOff.ty;
  const rad = (tearOff.rotation * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = tearOff.alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  drawPaper(ctx, W, H, 1, -W / 2, -H / 2);
  ctx.restore();
}

/** Draw the full parchment paper fill. offsetX/Y default to 0 for normal use. */
function drawPaper(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  _alpha: number,
  offsetX = 0,
  offsetY = 0,
): void {
  const grad = ctx.createLinearGradient(offsetX, offsetY, offsetX + W * 0.7, offsetY + H * 0.7);
  PAPER_COLOURS.forEach((c, i) => grad.addColorStop(i / (PAPER_COLOURS.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(offsetX, offsetY, W, H);

  // Subtle paper grain
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = "#000";
  const seed = 42;
  for (let y = offsetY; y < offsetY + H; y += 5) {
    for (let x = offsetX; x < offsetX + W; x += 7) {
      if (Math.sin(x * 0.31 + y * 0.77 + seed) > 0.6) ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** Build a half-plane clip path. peeled=true clips to the drag-forward side. */
function buildHalfPlaneClip(
  ctx: CanvasRenderingContext2D,
  foldPoint: Point,
  dragUnit: Point,
  W: number,
  H: number,
  peeled: boolean,
): void {
  // We need to define a polygon that covers the desired half of the canvas.
  // Strategy: collect the 4 canvas corners, split them by which side they're on,
  // and build a polygon through the two fold-line intersection points + corners.

  const sign = peeled ? 1 : -1;
  const eps = 0.5;

  // Compute intersections of the fold line with canvas edges
  const intersections = foldLineCanvasIntersections(foldPoint, dragUnit, W, H);

  // Corners on the desired side
  const corners: Point[] = [];
  for (const c of [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ]) {
    const side = (c.x - foldPoint.x) * dragUnit.x + (c.y - foldPoint.y) * dragUnit.y;
    if (sign * side >= -eps) corners.push(c);
  }

  if (intersections.length < 2) {
    // Degenerate: cover entire canvas for safe fallback
    ctx.rect(0, 0, W, H);
    return;
  }

  // Build winding polygon: intersection[0] → corners on desired side → intersection[1]
  const pts: Point[] = [intersections[0], ...corners, intersections[1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Compute where the fold line (through foldPoint, direction = dragUnit rotated 90°)
 *  intersects the four canvas edges. Returns 0-2 points. */
function foldLineCanvasIntersections(
  foldPoint: Point,
  dragUnit: Point,
  W: number,
  H: number,
): Point[] {
  // Fold line direction is the normal to dragUnit
  const fd = { x: -dragUnit.y, y: dragUnit.x };
  const pts: Point[] = [];
  const edges: [Point, Point][] = [
    [{ x: 0, y: 0 }, { x: W, y: 0 }], // top
    [{ x: W, y: 0 }, { x: W, y: H }], // right
    [{ x: W, y: H }, { x: 0, y: H }], // bottom
    [{ x: 0, y: H }, { x: 0, y: 0 }], // left
  ];

  for (const [a, b] of edges) {
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = fd.x * ey - fd.y * ex;
    if (Math.abs(denom) < 0.0001) continue;
    const t = ((a.x - foldPoint.x) * ey - (a.y - foldPoint.y) * ex) / denom;
    const s = ((a.x - foldPoint.x) * fd.y - (a.y - foldPoint.y) * fd.x) / denom;
    if (s >= 0 && s <= 1) {
      pts.push({ x: foldPoint.x + t * fd.x, y: foldPoint.y + t * fd.y });
    }
  }
  return pts;
}

/** Return the 6 canvas transform coefficients for reflection across a line
 *  through `pt` with unit normal `n`. */
function reflectTransform(pt: Point, n: Point): [number, number, number, number, number, number] {
  // Reflection matrix across line with normal n:
  //   [ 1-2nx²   -2nxny ]   + translation to account for line offset
  //   [ -2nxny  1-2ny²  ]
  const nx = n.x;
  const ny = n.y;
  const a = 1 - 2 * nx * nx;
  const b = -2 * nx * ny;
  const c = -2 * nx * ny;
  const d = 1 - 2 * ny * ny;
  // Translation: T = 2 * dot(pt, n) * n
  const dot2 = 2 * (pt.x * nx + pt.y * ny);
  const e = dot2 * nx;
  const f = dot2 * ny;
  return [a, b, c, d, e, f];
}

/** Draw the fold-edge shadow/curl to give 3D depth. */
function drawFoldShadow(
  ctx: CanvasRenderingContext2D,
  foldPoint: Point,
  foldDir: Point, // unit vector along the fold line (normal to drag)
  dragUnit: Point,
  W: number,
  H: number,
): void {
  const intersections = foldLineCanvasIntersections(foldPoint, dragUnit, W, H);
  if (intersections.length < 2) return;

  const p0 = intersections[0];
  const p1 = intersections[1];

  // Shadow sweeps CURL_WIDTH px into the covered region (opposite to drag)
  const shadowDir = { x: -dragUnit.x, y: -dragUnit.y };

  ctx.save();
  ctx.beginPath();
  buildHalfPlaneClip(ctx, foldPoint, dragUnit, W, H, false);
  ctx.clip();

  const grad = ctx.createLinearGradient(
    foldPoint.x,
    foldPoint.y,
    foldPoint.x + shadowDir.x * CURL_WIDTH,
    foldPoint.y + shadowDir.y * CURL_WIDTH,
  );
  grad.addColorStop(0, "rgba(0,0,0,0.45)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");

  // Draw a quad strip along the fold edge
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p1.x + shadowDir.x * CURL_WIDTH, p1.y + shadowDir.y * CURL_WIDTH);
  ctx.lineTo(p0.x + shadowDir.x * CURL_WIDTH, p0.y + shadowDir.y * CURL_WIDTH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Highlight on the folded side (thin bright strip along the crease)
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  buildHalfPlaneClip(ctx, foldPoint, dragUnit, W, H, true);
  ctx.clip();

  const hiGrad = ctx.createLinearGradient(
    p0.x,
    p0.y,
    p0.x + dragUnit.x * 6,
    p0.y + dragUnit.y * 6,
  );
  hiGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  hiGrad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p1.x + dragUnit.x * 6, p1.y + dragUnit.y * 6);
  ctx.lineTo(p0.x + dragUnit.x * 6, p0.y + dragUnit.y * 6);
  ctx.closePath();
  ctx.fillStyle = hiGrad;
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physics-based reversible paper-peel reveal animation.
 *
 * The paper peels from wherever the user starts dragging, following the finger
 * in real time. Releasing below 70% snaps the paper back with spring physics.
 * Releasing above 70% tears the paper off with a dramatic fly-away animation.
 * The folded-back portion is rendered as a semi-transparent mirrored ghost with
 * a 3D shadow along the fold crease.
 *
 * Supports mouse and touch via the Pointer Events API. Properly cleans up all
 * RAF handles and event captures on unmount.
 */
export function TearReveal({
  prizePhotoUrl,
  onRevealed,
  onProgress,
}: TearRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Drag state — all stored in refs to avoid stale closures in RAF callbacks
  const isDraggingRef = useRef(false);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });
  const currentPointRef = useRef<Point>({ x: 0, y: 0 });

  // Peel progress [0..1], stored in ref for RAF and in state for cursor styling
  const progressRef = useRef(0);
  const [progressState, setProgressState] = useState(0);

  // Spring-back velocity
  const velocityRef = useRef(0);

  // Tear-off overlay state
  const tearOffRef = useRef<RenderState["tearOff"]>(undefined);

  const [revealed, setRevealed] = useState(false);
  const [canvasSupported, setCanvasSupported] = useState(true);

  // ── Draw helpers ───────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tearOffRef.current) {
      renderTearOff(ctx, tearOffRef.current);
      return;
    }

    const progress = progressRef.current;
    const state: RenderState = {
      startPoint: startPointRef.current,
      currentPoint: currentPointRef.current,
    };
    renderPeel(ctx, state, progress);
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // ── Spring-back animation ──────────────────────────────────────────────────

  const springBack = useCallback(() => {
    if (isDraggingRef.current) return; // user grabbed again — stop

    const target = 0;
    velocityRef.current =
      (velocityRef.current + (target - progressRef.current) * SPRING_STIFFNESS) * SPRING_DAMPING;
    progressRef.current += velocityRef.current;

    if (progressRef.current < 0) progressRef.current = 0;

    // Ease the start/current points back toward the start
    const lerp = 0.18;
    currentPointRef.current = {
      x: currentPointRef.current.x + (startPointRef.current.x - currentPointRef.current.x) * lerp,
      y: currentPointRef.current.y + (startPointRef.current.y - currentPointRef.current.y) * lerp,
    };

    setProgressState(progressRef.current);
    onProgress?.(progressRef.current);
    draw();

    if (
      Math.abs(progressRef.current - target) < 0.002 &&
      Math.abs(velocityRef.current) < 0.002
    ) {
      progressRef.current = 0;
      velocityRef.current = 0;
      currentPointRef.current = { ...startPointRef.current };
      setProgressState(0);
      onProgress?.(0);
      draw();
      return;
    }

    rafRef.current = requestAnimationFrame(springBack);
  }, [draw, onProgress]);

  // ── Tear-off animation ─────────────────────────────────────────────────────

  const runTearOff = useCallback(() => {
    if (!tearOffRef.current) return;
    tearOffRef.current = {
      rotation: tearOffRef.current.rotation + TEAROFF_ROT_SPEED,
      tx: tearOffRef.current.tx + TEAROFF_VX,
      ty: tearOffRef.current.ty + TEAROFF_VY,
      alpha: tearOffRef.current.alpha - TEAROFF_ALPHA_DEC,
    };

    draw();

    if (tearOffRef.current.alpha > 0) {
      rafRef.current = requestAnimationFrame(runTearOff);
    } else {
      tearOffRef.current = undefined;
      setRevealed(true);
      onRevealed();
    }
  }, [draw, onRevealed]);

  // ── Pointer event handlers ─────────────────────────────────────────────────

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      // Scale from CSS pixels to canvas buffer pixels
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (revealed) return;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      isDraggingRef.current = true;
      velocityRef.current = 0;

      const pt = toCanvasPoint(e.clientX, e.clientY);
      startPointRef.current = pt;
      currentPointRef.current = pt;
      progressRef.current = 0;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [revealed, toCanvasPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || revealed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pt = toCanvasPoint(e.clientX, e.clientY);
      currentPointRef.current = pt;

      const p = computeProgress(
        startPointRef.current,
        currentPointRef.current,
        canvas.width,
        canvas.height,
      );
      progressRef.current = p;
      setProgressState(p);
      onProgress?.(p);
      scheduleDraw();
    },
    [revealed, toCanvasPoint, scheduleDraw, onProgress],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (progressRef.current >= REVEAL_THRESHOLD) {
      // Tear off
      tearOffRef.current = { rotation: 0, tx: 0, ty: 0, alpha: 1 };
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runTearOff);
    } else {
      // Spring back
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(springBack);
    }
  }, [runTearOff, springBack]);

  // ── Canvas setup and resize ────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (!canvas.getContext) {
      setCanvasSupported(false);
      return;
    }

    const sync = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      // Reset to fully covered when resized to avoid stale geometry
      currentPointRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
      startPointRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
      progressRef.current = 0;
      draw();
    };

    const ro = new ResizeObserver(sync);
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // ─────────────────────────────────────────────────────────────────────────

  if (!canvasSupported) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={prizePhotoUrl}
          alt="Prize"
          className="block w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl touch-none"
      style={{ cursor: revealed ? "default" : progressState > 0.05 ? "grabbing" : "grab" }}
    >
      {/* Prize image on the bottom layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={prizePhotoUrl}
        alt="Prize"
        className="block w-full h-full object-cover"
        draggable={false}
      />

      {/* Hint — shown only before the user has started dragging */}
      {!revealed && progressState < 0.04 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="font-bold text-lg drop-shadow-md select-none px-4 py-2 rounded-full"
            style={{
              color: "#5a3a10",
              background: "rgba(255,235,180,0.55)",
              backdropFilter: "blur(2px)",
            }}
          >
            撕開紙張揭曉
          </span>
        </div>
      )}

      {/* Paper overlay canvas */}
      {!revealed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      )}
    </div>
  );
}
