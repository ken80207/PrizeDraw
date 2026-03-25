"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScratchRevealProps {
  prizePhotoUrl: string;
  onRevealed: () => void;
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
 * `destination-out` composite operation. Sparkle particles appear at the
 * scratch point. When >= 50% of the surface is cleared the overlay fades
 * out and onRevealed() is called.
 */
export function ScratchReveal({ prizePhotoUrl, onRevealed }: ScratchRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDrawingRef = useRef(false);
  const lastSampleRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const sparkleRafRef = useRef<number | null>(null);
  const revealedRef = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [overlayAlpha, setOverlayAlpha] = useState(1);
  const [canvasSupported, setCanvasSupported] = useState(true);

  // ── Initialise canvas with silver metallic gradient ─────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!canvas.getContext) {
      setCanvasSupported(false);
      return;
    }
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

    // Subtle sheen stripe
    const sheenGrad = ctx.createLinearGradient(0, 0, width * 0.6, height * 0.6);
    sheenGrad.addColorStop(0, "rgba(255,255,255,0)");
    sheenGrad.addColorStop(0.4, "rgba(255,255,255,0.18)");
    sheenGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    initCanvas();

    const resizeObserver = new ResizeObserver(() => {
      if (!revealedRef.current) initCanvas();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (sparkleRafRef.current !== null) cancelAnimationFrame(sparkleRafRef.current);
    };
  }, [initCanvas]);

  // ── Sparkle particle system ─────────────────────────────────────────────
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

  const animateSparkles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sparkles are drawn on an offscreen layer then composited — but since
    // we're using destination-out on the main canvas we instead draw sparkles
    // via a separate overlay div trick. We render them to the canvas in
    // source-over mode AFTER the scratch layer; they'll appear on the grey.
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
    ctx.globalCompositeOperation = "source-over";
    for (const s of sparklesRef.current) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
      ctx.fill();
    }
    ctx.restore();

    if (sparklesRef.current.length > 0) {
      sparkleRafRef.current = requestAnimationFrame(animateSparkles);
    } else {
      sparkleRafRef.current = null;
    }
  }, []);

  // ── Scratch stroke renderer ─────────────────────────────────────────────
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

      spawnSparkles(x, y);
      if (sparkleRafRef.current === null) {
        sparkleRafRef.current = requestAnimationFrame(animateSparkles);
      }
    },
    [spawnSparkles, animateSparkles],
  );

  // ── Coverage check ──────────────────────────────────────────────────────
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

  // ── Auto-reveal with fade-out ───────────────────────────────────────────
  const triggerReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const start = performance.now();
    const fade = (now: number) => {
      const t = Math.min((now - start) / FADE_OUT_MS, 1);
      setOverlayAlpha(1 - t);
      if (t < 1) {
        requestAnimationFrame(fade);
      } else {
        setRevealed(true);
        onRevealed();
      }
    };
    requestAnimationFrame(fade);
  }, [onRevealed]);

  // ── Pointer event helpers ───────────────────────────────────────────────
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
      {/* Prize image underneath */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={prizePhotoUrl}
        alt="Prize"
        className="block w-full h-full object-cover"
        draggable={false}
      />

      {/* Canvas scratch overlay */}
      {!revealed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{
            cursor: "crosshair",
            opacity: overlayAlpha,
            transition: overlayAlpha < 1 ? "none" : undefined,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      )}

      {/* Hint text */}
      {!revealed && hintVisible && (
        <div
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
