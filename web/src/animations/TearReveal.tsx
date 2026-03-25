"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Fraction of peel distance that locks in and triggers tear-off. */
const REVEAL_THRESHOLD = 0.65;

/** Spring physics constants for snap-back animation. */
const SPRING_STIFFNESS = 0.12;
const SPRING_DAMPING = 0.70;

/** Tear-off animation: paper flies toward the top-right. */
const TEAROFF_ROT_SPEED = 5; // degrees per frame
const TEAROFF_VX = 14;       // px per frame (rightward)
const TEAROFF_VY = -10;      // px per frame (upward)
const TEAROFF_ALPHA_DEC = 0.032;

/** Paper colour stops — warm parchment. */
const PAPER_FILL = "#e8d5b7";
const PAPER_FILL_DARK = "#c8a57a";
/** The underside of the curled paper (slightly lighter/whiter). */
const PAPER_BACK_FILL = "#f5ead4";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

export interface TearRevealProps {
  prizePhotoUrl: string;
  prizeGrade?: string;
  prizeName?: string;
  onRevealed: () => void;
  onProgress?: (progress: number) => void;
}

interface TearOffState {
  rotation: number;
  tx: number;
  ty: number;
  alpha: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corner-peel geometry
// ─────────────────────────────────────────────────────────────────────────────
//
// Strategy: the paper always peels from the bottom-right corner.
// The "peel corner" starts at (W, H) and is dragged by the pointer.
// Everything to the bottom-right of a straight fold line (from the peel
// corner toward the opposite diagonal) is revealed; the rest stays covered.
//
// The fold line passes through the midpoint between the drag point and the
// original corner, perpendicular to the drag vector — exactly like folding
// a physical piece of paper.
//
// We derive two fold-line endpoints by extending that perpendicular until it
// hits the canvas edges, then clip the canvas into "covered" and "folded"
// halves using those endpoints.
//
// The "folded flap" is the mirrored paper underside shown on the peeled side.
// ─────────────────────────────────────────────────────────────────────────────

/** The fold line passes through the midpoint of [cornerPt, dragPt],
 *  perpendicular to the drag direction. Returns { midPoint, perpDir }. */
function getFoldLine(cornerPt: Point, dragPt: Point): { mid: Point; perp: Point } {
  const mid: Point = {
    x: (cornerPt.x + dragPt.x) / 2,
    y: (cornerPt.y + dragPt.y) / 2,
  };
  // Drag direction
  const dx = dragPt.x - cornerPt.x;
  const dy = dragPt.y - cornerPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { mid, perp: { x: 1, y: 0 } };
  // Perpendicular (rotate 90°)
  const perp: Point = { x: -dy / len, y: dx / len };
  return { mid, perp };
}

/** Intersect the fold line (through `pt`, direction `dir`) with all 4 canvas
 *  edges and return the (at most 2) intersection points on those edges. */
function foldLineEdgeIntersections(
  pt: Point,
  dir: Point,
  W: number,
  H: number,
): Point[] {
  const edges: [Point, Point][] = [
    [{ x: 0, y: 0 }, { x: W, y: 0 }],   // top
    [{ x: W, y: 0 }, { x: W, y: H }],   // right
    [{ x: W, y: H }, { x: 0, y: H }],   // bottom
    [{ x: 0, y: H }, { x: 0, y: 0 }],   // left
  ];
  const pts: Point[] = [];
  for (const [a, b] of edges) {
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 0.0001) continue;
    const t = ((a.x - pt.x) * ey - (a.y - pt.y) * ex) / denom;
    const s = ((a.x - pt.x) * dir.y - (a.y - pt.y) * dir.x) / denom;
    if (s >= -0.001 && s <= 1.001) {
      pts.push({ x: pt.x + t * dir.x, y: pt.y + t * dir.y });
    }
  }
  // Deduplicate near-identical points (corners)
  const unique: Point[] = [];
  for (const p of pts) {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1)) {
      unique.push(p);
    }
  }
  return unique.slice(0, 2);
}

/** Return 6 canvas-transform coefficients for reflecting through the fold line
 *  (passes through `pt`, unit normal `n`). */
function reflectMatrix(pt: Point, n: Point): [number, number, number, number, number, number] {
  const nx = n.x, ny = n.y;
  const a = 1 - 2 * nx * nx;
  const b = -2 * nx * ny;
  const c = -2 * nx * ny;
  const d = 1 - 2 * ny * ny;
  const dot2 = 2 * (pt.x * nx + pt.y * ny);
  return [a, b, c, d, dot2 * nx, dot2 * ny];
}

/** Peel progress [0..1]: ratio of drag distance to the canvas diagonal. */
function computeProgress(
  dragPt: Point,
  cornerPt: Point,
  W: number,
  H: number,
): number {
  const dist = Math.hypot(dragPt.x - cornerPt.x, dragPt.y - cornerPt.y);
  const diag = Math.hypot(W, H);
  return Math.min(dist / (diag * 0.85), 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas rendering
// ─────────────────────────────────────────────────────────────────────────────

/** Draw the full parchment paper fill across the entire canvas. */
function drawPaper(ctx: CanvasRenderingContext2D, W: number, H: number, ox = 0, oy = 0): void {
  const grad = ctx.createLinearGradient(ox, oy, ox + W * 0.7, oy + H * 0.7);
  grad.addColorStop(0, PAPER_FILL);
  grad.addColorStop(0.6, PAPER_FILL_DARK);
  grad.addColorStop(1, "#a07848");
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, W, H);

  // Subtle paper grain
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000";
  for (let y = oy; y < oy + H; y += 5) {
    for (let x = ox; x < ox + W; x += 7) {
      if (Math.sin(x * 0.31 + y * 0.77 + 42) > 0.6) ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.globalAlpha = prevAlpha;
}

/** Draw the back side of the curled paper (lighter, slightly warm white). */
function drawPaperBack(ctx: CanvasRenderingContext2D, W: number, H: number, ox = 0, oy = 0): void {
  const grad = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
  grad.addColorStop(0, PAPER_BACK_FILL);
  grad.addColorStop(1, "#ede0ca");
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, W, H);
}

/** Clip the context to the "still covered" half-plane (the side that doesn't
 *  contain the drag point). */
function clipCoveredHalf(
  ctx: CanvasRenderingContext2D,
  foldMid: Point,
  dragUnit: Point, // unit vector from corner toward drag point
  W: number,
  H: number,
): void {
  const intersections = foldLineEdgeIntersections(foldMid, { x: -dragUnit.y, y: dragUnit.x }, W, H);
  if (intersections.length < 2) {
    ctx.rect(0, 0, W, H);
    return;
  }
  // Covered half = corners where dot(corner - foldMid, dragUnit) < 0
  const coveredCorners: Point[] = [];
  for (const c of [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]) {
    const dot = (c.x - foldMid.x) * dragUnit.x + (c.y - foldMid.y) * dragUnit.y;
    if (dot <= 0) coveredCorners.push(c);
  }
  const pts = [intersections[0], ...coveredCorners, intersections[1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Clip the context to the "peeled" half-plane (the drag direction side). */
function clipPeeledHalf(
  ctx: CanvasRenderingContext2D,
  foldMid: Point,
  dragUnit: Point,
  W: number,
  H: number,
): void {
  const intersections = foldLineEdgeIntersections(foldMid, { x: -dragUnit.y, y: dragUnit.x }, W, H);
  if (intersections.length < 2) {
    ctx.rect(0, 0, W, H);
    return;
  }
  const peeledCorners: Point[] = [];
  for (const c of [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]) {
    const dot = (c.x - foldMid.x) * dragUnit.x + (c.y - foldMid.y) * dragUnit.y;
    if (dot >= 0) peeledCorners.push(c);
  }
  const pts = [intersections[0], ...peeledCorners, intersections[1]];
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

interface PeelRenderState {
  /** The drag point in canvas coordinates (where the user's finger is). */
  dragPt: Point;
  /** The anchor corner (always bottom-right). */
  cornerPt: Point;
  tearOff?: TearOffState;
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: PeelRenderState,
  progress: number,
): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  if (state.tearOff) {
    // Paper is flying off screen
    const { rotation, tx, ty, alpha } = state.tearOff;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = W / 2 + tx;
    const cy = H / 2 + ty;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    drawPaper(ctx, W, H, -W / 2, -H / 2);
    ctx.restore();
    return;
  }

  if (progress <= 0) {
    drawPaper(ctx, W, H);
    return;
  }

  const { dragPt, cornerPt } = state;
  const dx = dragPt.x - cornerPt.x;
  const dy = dragPt.y - cornerPt.y;
  const dragLen = Math.hypot(dx, dy);
  if (dragLen < 2) {
    drawPaper(ctx, W, H);
    return;
  }

  // Unit vector in the drag direction (from corner toward drag point)
  const dragUnit: Point = { x: dx / dragLen, y: dy / dragLen };

  // Fold line: perpendicular to drag, passes through the midpoint of [corner, drag]
  const { mid: foldMid, perp: foldPerp } = getFoldLine(cornerPt, dragPt);

  // ── 1. Draw the still-covered portion of the paper ────────────────────
  ctx.save();
  ctx.beginPath();
  clipCoveredHalf(ctx, foldMid, dragUnit, W, H);
  ctx.clip();
  drawPaper(ctx, W, H);
  ctx.restore();

  // ── 2. Draw the reflected (folded-back) underside in the peeled region ─
  // The underside is the mirror image of the paper through the fold line.
  ctx.save();
  ctx.beginPath();
  clipPeeledHalf(ctx, foldMid, dragUnit, W, H);
  ctx.clip();

  // Apply the reflection transform
  const [a, b, c, d, e, f] = reflectMatrix(foldMid, dragUnit);
  ctx.transform(a, b, c, d, e, f);
  drawPaperBack(ctx, W, H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();

  // ── 3. Shadow cast by the lifted paper onto the prize image ────────────
  // Draw a gradient shadow on the revealed (prize) side near the fold edge.
  {
    const intersections = foldLineEdgeIntersections(foldMid, foldPerp, W, H);
    if (intersections.length >= 2) {
      const p0 = intersections[0];
      const p1 = intersections[1];
      const shadowWidth = 36;

      ctx.save();
      ctx.beginPath();
      // Shadow falls on the "prize visible" side (same as peeled half, but we
      // want it under the paper). We clip to a strip near the fold edge.
      clipPeeledHalf(ctx, foldMid, dragUnit, W, H);
      ctx.clip();

      // Gradient goes from fold edge INTO the peeled zone (away from fold)
      const shadowGrad = ctx.createLinearGradient(
        p0.x, p0.y,
        p0.x + dragUnit.x * shadowWidth,
        p0.y + dragUnit.y * shadowWidth,
      );
      shadowGrad.addColorStop(0, "rgba(0,0,0,0.38)");
      shadowGrad.addColorStop(0.5, "rgba(0,0,0,0.12)");
      shadowGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x + dragUnit.x * shadowWidth, p1.y + dragUnit.y * shadowWidth);
      ctx.lineTo(p0.x + dragUnit.x * shadowWidth, p0.y + dragUnit.y * shadowWidth);
      ctx.closePath();
      ctx.fillStyle = shadowGrad;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── 4. Fold-edge highlight (bright crease line on the paper front) ─────
  {
    const intersections = foldLineEdgeIntersections(foldMid, foldPerp, W, H);
    if (intersections.length >= 2) {
      const p0 = intersections[0];
      const p1 = intersections[1];

      ctx.save();
      ctx.beginPath();
      clipCoveredHalf(ctx, foldMid, dragUnit, W, H);
      ctx.clip();

      // Thin highlight strip at the fold edge on the paper front side
      const hiWidth = 8;
      const hiGrad = ctx.createLinearGradient(
        p0.x, p0.y,
        p0.x - dragUnit.x * hiWidth,
        p0.y - dragUnit.y * hiWidth,
      );
      hiGrad.addColorStop(0, "rgba(255,255,255,0.60)");
      hiGrad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x - dragUnit.x * hiWidth, p1.y - dragUnit.y * hiWidth);
      ctx.lineTo(p0.x - dragUnit.x * hiWidth, p0.y - dragUnit.y * hiWidth);
      ctx.closePath();
      ctx.fillStyle = hiGrad;
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corner-peel paper reveal animation.
 *
 * The paper always peels from the bottom-right corner — the most natural and
 * universally understood gesture for peeling a sticker or label.
 *
 * Interaction:
 * - Drag from anywhere on the paper; the fold angle follows the drag direction
 *   and the peel originates from the bottom-right corner.
 * - Releasing below 65% progress: paper snaps back with spring physics.
 * - Releasing at 65% or more: paper tears off with a fly-away animation.
 *
 * Visual layers (bottom → top):
 * 1. Prize image (plain <img>)
 * 2. Canvas overlay: covered paper + reflected underside + shadow + highlight
 */
export function TearReveal({
  prizePhotoUrl,
  onRevealed,
  onProgress,
}: TearRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // All gesture state lives in refs to avoid stale-closure issues in RAF.
  const isDraggingRef = useRef(false);
  const dragPtRef = useRef<Point>({ x: 0, y: 0 });
  // The corner anchor is recomputed on resize; stored in ref.
  const cornerPtRef = useRef<Point>({ x: 0, y: 0 });
  const progressRef = useRef(0);
  const [progressState, setProgressState] = useState(0);
  const velocityRef = useRef(0);
  const tearOffRef = useRef<TearOffState | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  // Detect canvas support once at construction time via a lazy initializer so
  // we never call setState inside a useEffect body (which triggers cascading renders).
  const [canvasSupported] = useState<boolean>(() => {
    if (typeof document === "undefined") return true; // SSR — assume supported
    const probe = document.createElement("canvas");
    return typeof probe.getContext === "function";
  });

  // ── Draw ─────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderFrame(
      ctx,
      {
        dragPt: dragPtRef.current,
        cornerPt: cornerPtRef.current,
        tearOff: tearOffRef.current,
      },
      progressRef.current,
    );
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // ── Spring-back ──────────────────────────────────────────────────────────
  //
  // Use a ref to hold the latest callback so the RAF reschedule doesn't
  // require the function itself in its own dependency array (which would
  // trigger the no-forward-reference lint rule).

  const springBackRef = useRef<() => void>(() => { /* initialised below */ });

  const springBack = useCallback(() => {
    springBackRef.current();
  }, []);

  useEffect(() => {
    springBackRef.current = () => {
      if (isDraggingRef.current) return;

      velocityRef.current =
        (velocityRef.current + (0 - progressRef.current) * SPRING_STIFFNESS) * SPRING_DAMPING;
      progressRef.current += velocityRef.current;
      if (progressRef.current < 0) progressRef.current = 0;

      // Ease drag point back toward the corner
      const lerp = 0.15;
      dragPtRef.current = {
        x: dragPtRef.current.x + (cornerPtRef.current.x - dragPtRef.current.x) * lerp,
        y: dragPtRef.current.y + (cornerPtRef.current.y - dragPtRef.current.y) * lerp,
      };

      setProgressState(progressRef.current);
      onProgress?.(progressRef.current);
      draw();

      if (Math.abs(progressRef.current) < 0.002 && Math.abs(velocityRef.current) < 0.002) {
        progressRef.current = 0;
        velocityRef.current = 0;
        dragPtRef.current = { ...cornerPtRef.current };
        setProgressState(0);
        onProgress?.(0);
        draw();
        return;
      }

      rafRef.current = requestAnimationFrame(springBackRef.current);
    };
  }, [draw, onProgress]);

  // ── Tear-off animation ───────────────────────────────────────────────────

  const runTearOffRef = useRef<() => void>(() => { /* initialised below */ });

  const runTearOff = useCallback(() => {
    runTearOffRef.current();
  }, []);

  useEffect(() => {
    runTearOffRef.current = () => {
      if (!tearOffRef.current) return;
      tearOffRef.current = {
        rotation: tearOffRef.current.rotation + TEAROFF_ROT_SPEED,
        tx: tearOffRef.current.tx + TEAROFF_VX,
        ty: tearOffRef.current.ty + TEAROFF_VY,
        alpha: tearOffRef.current.alpha - TEAROFF_ALPHA_DEC,
      };
      draw();
      if (tearOffRef.current.alpha > 0) {
        rafRef.current = requestAnimationFrame(runTearOffRef.current);
      } else {
        tearOffRef.current = undefined;
        setRevealed(true);
        onRevealed();
      }
    };
  }, [draw, onRevealed]);

  // ── Pointer events ───────────────────────────────────────────────────────

  const toCanvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (revealed) return;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      isDraggingRef.current = true;
      velocityRef.current = 0;
      progressRef.current = 0;

      // Start the drag point at the corner so the fold appears naturally as
      // soon as the user moves. The actual position is updated on pointer move.
      dragPtRef.current = { ...cornerPtRef.current };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draw();
    },
    [revealed, draw],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || revealed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pt = toCanvasPoint(e.clientX, e.clientY);
      dragPtRef.current = pt;

      const p = computeProgress(pt, cornerPtRef.current, canvas.width, canvas.height);
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
      tearOffRef.current = { rotation: 0, tx: 0, ty: 0, alpha: 1 };
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runTearOff);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(springBack);
    }
  }, [runTearOff, springBack]);

  // ── Canvas setup and resize ──────────────────────────────────────────────

  useEffect(() => {
    if (!canvasSupported) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sync = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      // Anchor is always the bottom-right corner
      cornerPtRef.current = { x: canvas.width, y: canvas.height };
      // Reset drag point to the corner so the paper starts fully flat
      dragPtRef.current = { ...cornerPtRef.current };
      progressRef.current = 0;
      draw();
    };

    const ro = new ResizeObserver(sync);
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, canvasSupported]);

  // ─────────────────────────────────────────────────────────────────────────

  if (!canvasSupported) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={prizePhotoUrl} alt="Prize" className="block w-full h-full object-cover" draggable={false} />
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
        <div className="absolute inset-0 flex items-end justify-end pointer-events-none pb-4 pr-4">
          <span
            className="font-bold text-sm drop-shadow-md select-none px-3 py-1.5 rounded-full"
            style={{
              color: "#5a3a10",
              background: "rgba(255,235,180,0.70)",
              backdropFilter: "blur(2px)",
            }}
          >
            從右下角撕開
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

