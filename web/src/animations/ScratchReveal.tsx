"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TouchFrame } from "@/hooks/useDrawInputSync";

interface ScratchRevealProps {
  prizePhotoUrl: string;
  onRevealed: () => void;
  /**
   * When set, the component operates in spectator mode:
   * - Local pointer events are disabled.
   * - The scratch surface is driven by the supplied remote touch frames.
   */
  remoteTouchInput?: TouchFrame | null;
  /** Set true to disable local pointer interaction (used in spectator mode). */
  isSpectatorMode?: boolean;
}

// Scratch brush radius in canvas pixels
const SCRATCH_RADIUS = 28;
// Soft-edge brush inner radius (feathering)
const BRUSH_INNER_RATIO = 0.5;
// How often to sample pixel coverage (ms)
const SAMPLE_INTERVAL_MS = 150;
// % of overlay pixels that must be cleared before auto-reveal
const REVEAL_THRESHOLD = 0.5;
// Fade-out duration for the overlay after threshold is reached (ms)
const FADE_OUT_MS = 500;
// Sparkle particle count per scratch event
const SPARKLE_COUNT = 5;

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  r: number;
}

/**
 * Canvas-based scratch-card reveal animation.
 *
 * A metallic silver overlay sits on top of the prize image. The player
 * scratches with mouse or touch to erase the overlay using the
 * `destination-out` composite operation.
 *
 * Flickering-free architecture (three separate canvas elements):
 * 1. `canvasRef`   — the scratch surface (metallic overlay, erased by pointer).
 *                    Written only by `scratchAt` (destination-out). Never
 *                    cleared or redrawn after the initial paint.
 * 2. `sparkleRef`  — transparent canvas above the scratch surface. Used
 *                    exclusively for sparkle particles so they never interfere
 *                    with the destination-out scratch layer.
 * 3. Fade-out      — handled by animating the CSS `opacity` property on
 *                    `canvasRef` directly via `requestAnimationFrame`, with no
 *                    React state updates per frame to avoid re-render flicker.
 *
 * The `revealed` React state is only set once (when the fade completes) to
 * unmount both canvas elements.
 */
export function ScratchReveal({
  prizePhotoUrl,
  onRevealed,
  remoteTouchInput = null,
  isSpectatorMode = false,
}: ScratchRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The scratch overlay canvas (destination-out erasing)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Separate canvas for sparkle particles — never mixed with destination-out
  const sparkleRef = useRef<HTMLCanvasElement>(null);

  const isDrawingRef = useRef(false);
  const lastSampleRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  // Ref to the hint overlay element so we can hide it imperatively (avoids
  // calling setState inside a useEffect for the spectator remote-touch path).
  const hintRef = useRef<HTMLDivElement>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const sparkleRafRef = useRef<number | null>(null);
  const revealedRef = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  // Detect canvas support once using a lazy initializer so we never need to
  // call setState inside a useEffect body (which triggers cascading renders).
  const [canvasSupported] = useState<boolean>(() => {
    if (typeof document === "undefined") return true; // SSR — assume supported
    const probe = document.createElement("canvas");
    return typeof probe.getContext === "function";
  });

  // ── Initialise the scratch canvas (called once on mount + on resize) ──────
  //
  // IMPORTANT: this is the ONLY place that draws the silver overlay.
  // After this point only `destination-out` operations are applied — no full
  // redraws — so the scratched holes are never accidentally filled back in.
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Metallic silver gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#e8e8e8");
    grad.addColorStop(0.2, "#d0d0d0");
    grad.addColorStop(0.4, "#c0c0c0");
    grad.addColorStop(0.55, "#b8b8b8");
    grad.addColorStop(0.7, "#c8c8c8");
    grad.addColorStop(0.85, "#d8d8d8");
    grad.addColorStop(1, "#bdbdbd");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle sheen stripe — drawn ONCE here, never redrawn
    const sheenGrad = ctx.createLinearGradient(0, 0, width * 0.6, height * 0.6);
    sheenGrad.addColorStop(0, "rgba(255,255,255,0)");
    sheenGrad.addColorStop(0.4, "rgba(255,255,255,0.18)");
    sheenGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, width, height);
  }, []);

  // ── Initialise the sparkle canvas dimensions to match the scratch canvas ──
  const syncSparkleCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const sparkle = sparkleRef.current;
    if (!canvas || !sparkle) return;
    sparkle.width = canvas.width;
    sparkle.height = canvas.height;
  }, []);

  useEffect(() => {
    initCanvas();
    syncSparkleCanvas();

    const resizeObserver = new ResizeObserver(() => {
      // On resize, only reinitialise if not yet revealed (to avoid redrawing
      // a fully-erased canvas back to silver).
      if (!revealedRef.current) {
        initCanvas();
        syncSparkleCanvas();
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (sparkleRafRef.current !== null) cancelAnimationFrame(sparkleRafRef.current);
    };
  }, [initCanvas, syncSparkleCanvas]);

  // ── Sparkle particle system — runs on the SEPARATE sparkle canvas ─────────
  const spawnSparkles = useCallback((x: number, y: number) => {
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1;
      sparklesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        r: Math.random() * 2.5 + 1,
      });
    }
  }, []);

  // Hold the latest animateSparkles implementation in a ref so the RAF
  // reschedule never needs to reference the callback before it's declared.
  const animateSparklesRef = useRef<() => void>(() => { /* initialised below */ });

  const animateSparkles = useCallback(() => {
    animateSparklesRef.current();
  }, []);

  useEffect(() => {
    animateSparklesRef.current = () => {
      const sparkle = sparkleRef.current;
      if (!sparkle) return;
      const ctx = sparkle.getContext("2d");
      if (!ctx) return;

      // Clear the sparkle canvas entirely each frame — it is transparent by
      // default and has no persistent content, so this never affects the
      // scratch layer below.
      ctx.clearRect(0, 0, sparkle.width, sparkle.height);

      sparklesRef.current = sparklesRef.current
        .map((s) => ({
          ...s,
          x: s.x + s.vx,
          y: s.y + s.vy,
          vy: s.vy + 0.15, // gravity
          alpha: s.alpha - 0.06,
        }))
        .filter((s) => s.alpha > 0);

      ctx.save();
      for (const s of sparklesRef.current) {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.fill();
      }
      ctx.restore();

      if (sparklesRef.current.length > 0) {
        sparkleRafRef.current = requestAnimationFrame(animateSparklesRef.current);
      } else {
        sparkleRafRef.current = null;
      }
    };
  }, []);

  // ── Scratch stroke renderer ───────────────────────────────────────────────
  //
  // Operates ONLY on `canvasRef` with destination-out. No full redraws.
  const scratchAt = useCallback(
    (canvas: HTMLCanvasElement, x: number, y: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, SCRATCH_RADIUS);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(BRUSH_INNER_RATIO, "rgba(0,0,0,0.95)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Draw connecting stroke between last position and current for smooth lines
      if (lastPosRef.current) {
        const { x: lx, y: ly } = lastPosRef.current;
        const dist = Math.hypot(x - lx, y - ly);
        const steps = Math.ceil(dist / (SCRATCH_RADIUS * 0.3));
        for (let i = 1; i <= steps; i++) {
          const ix = lx + ((x - lx) * i) / steps;
          const iy = ly + ((y - ly) * i) / steps;
          const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, SCRATCH_RADIUS);
          ig.addColorStop(0, "rgba(0,0,0,1)");
          ig.addColorStop(BRUSH_INNER_RATIO, "rgba(0,0,0,0.95)");
          ig.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = ig;
          ctx.beginPath();
          ctx.arc(ix, iy, SCRATCH_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Spawn sparkles on the SEPARATE sparkle canvas
      spawnSparkles(x, y);
      if (sparkleRafRef.current === null) {
        sparkleRafRef.current = requestAnimationFrame(animateSparkles);
      }
    },
    [spawnSparkles, animateSparkles],
  );

  // ── Coverage check ────────────────────────────────────────────────────────
  const checkCoverage = useCallback((canvas: HTMLCanvasElement): number => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    // Sample every 4th pixel for performance
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    const total = canvas.width * canvas.height;
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 128) cleared += 4; // each sampled pixel represents 4
    }
    return cleared / total;
  }, []);

  // ── Auto-reveal with CSS-driven fade-out ──────────────────────────────────
  //
  // We animate the canvas element's `style.opacity` directly via RAF instead
  // of using React state, which would trigger re-renders every frame and cause
  // visible flicker as the component re-paints while also fading.
  const triggerReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const scratchCanvas = canvasRef.current;
    const sparkleCanvas = sparkleRef.current;

    // Kill any ongoing sparkle animation
    if (sparkleRafRef.current !== null) {
      cancelAnimationFrame(sparkleRafRef.current);
      sparkleRafRef.current = null;
    }

    const start = performance.now();
    const fade = (now: number) => {
      const t = Math.min((now - start) / FADE_OUT_MS, 1);
      const opacity = String(1 - t);
      if (scratchCanvas) scratchCanvas.style.opacity = opacity;
      if (sparkleCanvas) sparkleCanvas.style.opacity = opacity;

      if (t < 1) {
        requestAnimationFrame(fade);
      } else {
        // Only set React state ONCE when the fade is fully complete.
        // This unmounts both canvas elements cleanly.
        setRevealed(true);
        onRevealed();
      }
    };
    requestAnimationFrame(fade);
  }, [onRevealed]);

  // ── Remote touch input (spectator mode) ──────────────────────────────────
  //
  // When isSpectatorMode=true we drive scratchAt directly from the remote
  // TouchFrame stream instead of local pointer events. This keeps the exact
  // same scratch rendering path so spectators see an identical visual result.
  const remotePosRef = useRef<{ x: number; y: number } | null>(null);
  const remoteDownRef = useRef(false);

  useEffect(() => {
    if (!isSpectatorMode || !remoteTouchInput) return;
    if (revealedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scale normalised coords to canvas pixel space
    const cx = remoteTouchInput.x * canvas.width;
    const cy = remoteTouchInput.y * canvas.height;

    if (remoteTouchInput.isDown) {
      if (!remoteDownRef.current) {
        // Finger just pressed — start a new stroke
        remoteDownRef.current = true;
        remotePosRef.current = { x: cx, y: cy };
        // Hide the hint imperatively (avoids setState-in-effect lint error).
        if (hintRef.current) hintRef.current.style.display = "none";
      }
      // Set last position so scratchAt can interpolate a continuous stroke
      lastPosRef.current = remotePosRef.current;
      remotePosRef.current = { x: cx, y: cy };
      scratchAt(canvas, cx, cy);

      // Coverage check at 150ms intervals (same as local scratch)
      const now = Date.now();
      if (now - lastSampleRef.current > SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = now;
        if (checkCoverage(canvas) >= REVEAL_THRESHOLD) triggerReveal();
      }
    } else {
      if (remoteDownRef.current) {
        // Finger lifted — end stroke
        remoteDownRef.current = false;
        remotePosRef.current = null;
        lastPosRef.current = null;
      }
    }
  }, [remoteTouchInput, isSpectatorMode, scratchAt, checkCoverage, triggerReveal]);

  // ── Pointer event helpers ─────────────────────────────────────────────────
  const toCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (revealedRef.current) return;
      isDrawingRef.current = true;
      setHintVisible(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const pos = toCanvasCoords(e, canvas);
      lastPosRef.current = pos;
      scratchAt(canvas, pos.x, pos.y);
    },
    [scratchAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || revealedRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = toCanvasCoords(e, canvas);
      scratchAt(canvas, pos.x, pos.y);
      lastPosRef.current = pos;

      const now = Date.now();
      if (now - lastSampleRef.current > SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = now;
        if (checkCoverage(canvas) >= REVEAL_THRESHOLD) triggerReveal();
      }
    },
    [scratchAt, checkCoverage, triggerReveal],
  );

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  if (!canvasSupported) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={prizePhotoUrl} alt="Prize" className="block w-full h-full object-cover" draggable={false} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative select-none overflow-hidden rounded-xl touch-none">
      {/* Prize image underneath — always rendered */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={prizePhotoUrl}
        alt="Prize"
        className="block w-full h-full object-cover"
        draggable={false}
      />

      {/* Scratch overlay canvas — receives pointer events and is erased by
          destination-out. Opacity is animated directly (not via React state)
          during the fade-out to prevent re-render flicker.
          In spectator mode pointer events are disabled — input comes from
          the remoteTouchInput prop instead. */}
      {!revealed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{
            cursor: isSpectatorMode ? "none" : "crosshair",
            pointerEvents: isSpectatorMode ? "none" : undefined,
          }}
          onPointerDown={isSpectatorMode ? undefined : handlePointerDown}
          onPointerMove={isSpectatorMode ? undefined : handlePointerMove}
          onPointerUp={isSpectatorMode ? undefined : handlePointerUp}
          onPointerCancel={isSpectatorMode ? undefined : handlePointerUp}
          onPointerLeave={isSpectatorMode ? undefined : handlePointerUp}
        />
      )}

      {/* Sparkle canvas — separate layer, never mixed with destination-out.
          pointer-events:none so it doesn't intercept scratch events. */}
      {!revealed && (
        <canvas
          ref={sparkleRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Hint text — hidden via hintRef.style.display imperatively when the
          remote touch adapter starts scratching (avoids setState-in-effect). */}
      {!revealed && hintVisible && (
        <div
          ref={hintRef}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{
            opacity: hintVisible ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <span
            className="font-bold text-xl drop-shadow-md select-none px-4 py-2 rounded-full"
            style={{
              color: "#444",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(2px)",
            }}
          >
            刮開看看！
          </span>
        </div>
      )}
    </div>
  );
}
