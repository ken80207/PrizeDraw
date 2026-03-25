"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Cover strip occupies the top this fraction of the ticket. */
/** Cover strip covers the ENTIRE ticket face — tearing reveals the prize underneath. */
const COVER_RATIO = 1.0;

/** Fraction of horizontal travel (relative to canvas width) that commits the tear. */
const REVEAL_THRESHOLD = 0.70;

/** Spring physics — snap-back animation when released before threshold. */
const SPRING_STIFFNESS = 0.14;
const SPRING_DAMPING = 0.68;

/** How tall (px, in canvas-space) the curl arc rises above the perforation. */
const CURL_HEIGHT = 44;

/** Shimmer animation: highlight sweeps across the cover strip edges. */
const SHIMMER_SPEED = 0.012; // 0..1 per frame

// Cover strip colours — metallic silver/gold
const COVER_COLOR_1 = "#B8B8B8";
const COVER_COLOR_2 = "#E0E0E0";
const COVER_COLOR_3 = "#F0F0F0";
const COVER_COLOR_4 = "#D0D0D0";
const COVER_COLOR_5 = "#A0A0A0";

// Ticket body colour
const TICKET_BG = "#FFF8F0";

// Grade badge colour map (matches GradeBadge.tsx)
const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  "A賞":    { bg: "#EF4444", text: "#FFFFFF" },
  "B賞":    { bg: "#F97316", text: "#FFFFFF" },
  "C賞":    { bg: "#3B82F6", text: "#FFFFFF" },
  "D賞":    { bg: "#22C55E", text: "#FFFFFF" },
  "E賞":    { bg: "#A855F7", text: "#FFFFFF" },
  "F賞":    { bg: "#EC4899", text: "#FFFFFF" },
  "Last賞": { bg: "#F59E0B", text: "#FFFFFF" },
  "LAST賞": { bg: "#F59E0B", text: "#FFFFFF" },
};
const DEFAULT_GRADE_COLOR = { bg: "#6B7280", text: "#FFFFFF" };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TearRevealProps {
  prizePhotoUrl: string;
  prizeGrade?: string;
  prizeName?: string;
  onRevealed: () => void;
  onProgress?: (progress: number) => void;
}

/** Which horizontal edge the user grabbed to start tearing. */
type TearDirection = "left" | "right";

interface TearState {
  /** 0 = cover fully on, 1 = cover fully torn off. */
  progress: number;
  /** true while the strip is flying off screen after threshold. */
  tearingOff: boolean;
  /** Translation offset for the tear-off fly animation (canvas-space px). */
  tearOffX: number;
  tearOffAlpha: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the current drag state, compute the x-coordinate where the tear
 * front currently sits (canvas px), and how far that is as a [0..1] fraction.
 *
 * When tearing from the LEFT edge:
 *   tearX starts at 0 and moves rightward → progress = tearX / W
 * When tearing from the RIGHT edge:
 *   tearX starts at W and moves leftward → progress = (W - tearX) / W
 */
function computeTearProgress(
  startClientX: number,
  currentClientX: number,
  direction: TearDirection,
  canvasW: number,
): number {
  const delta = currentClientX - startClientX;
  const travel = direction === "left" ? delta : -delta;
  return Math.min(Math.max(travel / canvasW, 0), 1);
}

function tearXFromProgress(progress: number, direction: TearDirection, W: number): number {
  return direction === "left" ? progress * W : W - progress * W;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas drawing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the full ticket background (cream card).
 * This is always the bottom layer — the prize content is composited on top via
 * the React <img> / <div> below the canvas.
 */
function drawTicketBody(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  coverH: number,
  prizeGrade: string | undefined,
  prizeName: string | undefined,
  prizeImage: HTMLImageElement | null,
): void {
  // Card background
  ctx.fillStyle = TICKET_BG;
  ctx.fillRect(0, 0, W, H);

  // Subtle card texture — very light horizontal lines
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = "#8B7355";
  ctx.lineWidth = 1;
  for (let y = coverH + 8; y < H; y += 6) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(W - 8, y);
    ctx.stroke();
  }
  ctx.restore();

  // ── Perforation line ────────────────────────────────────────────────────
  // 3D indent: dark shadow above, light highlight below
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(4, coverH - 0.5);
  ctx.lineTo(W - 4, coverH - 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.60)";
  ctx.beginPath();
  ctx.moveTo(4, coverH + 0.5);
  ctx.lineTo(W - 4, coverH + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Ticket number ────────────────────────────────────────────────────────
  const numY = coverH + 24;
  ctx.save();
  ctx.font = "bold 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = "#999080";
  ctx.textAlign = "center";
  ctx.fillText("No. 一番賞", W / 2, numY);
  ctx.restore();

  // ── Prize image ──────────────────────────────────────────────────────────
  const imgY = coverH + 38;
  const imgH = H - imgY - (prizeGrade || prizeName ? 72 : 20);
  const imgX = 12;
  const imgW = W - 24;

  if (prizeImage && prizeImage.complete && prizeImage.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, imgX, imgY, imgW, Math.max(imgH, 0), 6);
    ctx.clip();
    // Fit image with cover-fit logic
    const aspectImg = prizeImage.naturalWidth / prizeImage.naturalHeight;
    const aspectSlot = imgW / Math.max(imgH, 1);
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (aspectImg > aspectSlot) {
      drawH = imgH;
      drawW = imgH * aspectImg;
      drawX = imgX + (imgW - drawW) / 2;
      drawY = imgY;
    } else {
      drawW = imgW;
      drawH = imgW / aspectImg;
      drawX = imgX;
      drawY = imgY + (imgH - drawH) / 2;
    }
    ctx.drawImage(prizeImage, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    // Placeholder gradient
    ctx.save();
    const grad = ctx.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH);
    grad.addColorStop(0, "#E2D5C0");
    grad.addColorStop(1, "#C8B898");
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(ctx, imgX, imgY, imgW, Math.max(imgH, 0), 6);
    ctx.fill();
    // Camera icon placeholder
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.min(imgH * 0.4, 48)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎁", imgX + imgW / 2, imgY + imgH / 2);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  // ── Prize info area ──────────────────────────────────────────────────────
  if (prizeGrade || prizeName) {
    const infoY = H - 64;

    // Grade badge
    if (prizeGrade) {
      const colors = GRADE_COLORS[prizeGrade] ?? DEFAULT_GRADE_COLOR;
      ctx.save();
      ctx.font = "bold 20px 'Helvetica Neue', Arial, sans-serif";
      const badgeText = prizeGrade;
      const tw = ctx.measureText(badgeText).width;
      const bx = W / 2 - tw / 2 - 14;
      const bw = tw + 28;
      const bh = 30;
      const by = infoY;
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      roundRect(ctx, bx, by, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.textAlign = "center";
      ctx.fillText(badgeText, W / 2, by + 22);
      ctx.restore();
    }

    // Prize name
    if (prizeName) {
      ctx.save();
      ctx.font = "14px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#5C4A30";
      ctx.textAlign = "center";
      const nameY = prizeGrade ? infoY + 44 : infoY + 18;
      ctx.fillText(prizeName, W / 2, nameY);
      ctx.restore();
    }
  }
}

/** Polyfill-safe rounded rect path (no ctx.roundRect usage for compat). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw the metallic cover strip with optional horizontal clipping. */
function drawCoverStrip(
  ctx: CanvasRenderingContext2D,
  W: number,
  coverH: number,
  clipStartX: number,
  clipEndX: number,
  shimmerPhase: number,
): void {
  if (clipEndX <= clipStartX) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipStartX, 0, clipEndX - clipStartX, coverH);
  ctx.clip();

  // Base metallic gradient (horizontal)
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, COVER_COLOR_1);
  grad.addColorStop(0.20, COVER_COLOR_2);
  grad.addColorStop(0.45, COVER_COLOR_3);
  grad.addColorStop(0.70, COVER_COLOR_4);
  grad.addColorStop(1, COVER_COLOR_5);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, coverH);

  // Vertical sheen overlay (simulates metallic sheen)
  const sheen = ctx.createLinearGradient(0, 0, 0, coverH);
  sheen.addColorStop(0, "rgba(255,255,255,0.35)");
  sheen.addColorStop(0.4, "rgba(255,255,255,0.08)");
  sheen.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, coverH);

  // Shimmer sweep highlight
  const shimX = shimmerPhase * (W + 80) - 40;
  const shimGrad = ctx.createLinearGradient(shimX - 40, 0, shimX + 40, 0);
  shimGrad.addColorStop(0, "rgba(255,255,255,0)");
  shimGrad.addColorStop(0.5, "rgba(255,255,255,0.55)");
  shimGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shimGrad;
  ctx.fillRect(0, 0, W, coverH);

  // Decorative pattern — diagonal lines
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  for (let i = -coverH; i < W + coverH; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + coverH, coverH);
    ctx.stroke();
  }
  ctx.restore();

  // Cover text — "一番賞" large in center, with decorative border
  ctx.save();
  ctx.font = `bold ${Math.min(28, W * 0.08)}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = "rgba(80,70,60,0.75)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("一 番 賞", W / 2, coverH * 0.35);

  // Subtitle
  ctx.font = `${Math.min(14, W * 0.04)}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = "rgba(80,70,60,0.5)";
  ctx.fillText("← 從邊緣撕開 →", W / 2, coverH * 0.48);

  // Decorative diamond ornament
  ctx.fillStyle = "rgba(80,70,60,0.25)";
  ctx.beginPath();
  const cx = W / 2;
  const cy = coverH * 0.65;
  const sz = Math.min(24, W * 0.06);
  ctx.moveTo(cx, cy - sz);
  ctx.lineTo(cx + sz, cy);
  ctx.lineTo(cx, cy + sz);
  ctx.lineTo(cx - sz, cy);
  ctx.closePath();
  ctx.fill();

  // "?" inside diamond
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `bold ${sz}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText("?", cx, cy + sz * 0.1);

  // Bottom edge ornament line
  ctx.strokeStyle = "rgba(80,70,60,0.2)";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(W * 0.2, coverH * 0.82);
  ctx.lineTo(W * 0.8, coverH * 0.82);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.restore();

  // Thin top border highlight
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(0, 0, W, 2);

  // Thin bottom border shadow
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0, coverH - 2, W, 2);

  ctx.restore();
}

/**
 * Draw the curling torn portion.
 * The torn part of the cover peels up and away from the tear edge,
 * showing the underside (lighter color) and casting a shadow below it.
 */
function drawCurlEffect(
  ctx: CanvasRenderingContext2D,
  tearX: number,
  coverH: number,
  direction: TearDirection,
  progress: number,
): void {
  if (progress < 0.01) return;

  // The curl originates at the tear edge (tearX) along the bottom of the cover (coverH).
  // It curves upward and away in the tear direction.
  const curlSign = direction === "left" ? -1 : 1; // which way the torn part flew
  const curlExtent = Math.min(progress * 60 + 20, 80); // how far the curl extends

  ctx.save();

  // Shadow cast by the lifted curl onto the ticket below
  ctx.globalAlpha = 0.22 * Math.min(progress * 3, 1);
  const shadowGrad = ctx.createLinearGradient(
    tearX, coverH,
    tearX - curlSign * 18, coverH + 14,
  );
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.55)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.rect(
    direction === "left" ? tearX - 20 : tearX,
    coverH - 4,
    direction === "left" ? 20 : 20,
    18,
  );
  ctx.fill();

  ctx.globalAlpha = Math.min(progress * 2, 1) * 0.88;

  // Back-of-cover — lighter warm silver
  const backGrad = ctx.createLinearGradient(
    tearX, coverH,
    tearX - curlSign * curlExtent, coverH - CURL_HEIGHT,
  );
  backGrad.addColorStop(0, "#D8D8D8");
  backGrad.addColorStop(0.5, "#EFEFEF");
  backGrad.addColorStop(1, "rgba(240,240,240,0.3)");

  // Curl path using a quadratic bezier
  const cp1x = tearX - curlSign * (curlExtent * 0.4);
  const cp1y = coverH - CURL_HEIGHT * 0.6;
  const endX = tearX - curlSign * curlExtent;
  const endY = coverH - CURL_HEIGHT * 0.8;
  const stripWidth = Math.max(coverH * 0.85, 20);

  ctx.beginPath();
  ctx.moveTo(tearX, coverH);
  ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
  ctx.lineTo(endX, endY - stripWidth * 0.25);
  ctx.quadraticCurveTo(cp1x, cp1y - stripWidth * 0.3, tearX, coverH - stripWidth * 0.15);
  ctx.closePath();
  ctx.fillStyle = backGrad;
  ctx.fill();

  // Subtle edge highlight on the curl
  ctx.globalAlpha = 0.4 * Math.min(progress * 2, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tearX, coverH);
  ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Master render function. Draws one frame of the tear animation.
 *
 * Layers (bottom to top):
 *  1. Ticket body with prize info (always visible — the reveal is implicit)
 *  2. Un-torn portion of cover strip (right or left side, depending on direction)
 *  3. Curl effect at the tear edge
 */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  coverH: number,
  progress: number,
  direction: TearDirection,
  shimmerPhase: number,
  tearOffX: number,
  tearOffAlpha: number,
  isTearingOff: boolean,
  prizeGrade: string | undefined,
  prizeName: string | undefined,
  prizeImage: HTMLImageElement | null,
): void {
  ctx.clearRect(0, 0, W, H);

  // ── 1. Ticket body ──────────────────────────────────────────────────────
  drawTicketBody(ctx, W, H, coverH, prizeGrade, prizeName, prizeImage);

  if (progress >= 1 && !isTearingOff) return; // fully revealed — nothing more to draw

  // ── 2. Cover strip (un-torn portion) ────────────────────────────────────
  const tearX = tearXFromProgress(progress, direction, W);

  ctx.save();
  if (isTearingOff) {
    ctx.globalAlpha = tearOffAlpha;
    ctx.translate(tearOffX, 0);
  }

  // Clip to only the remaining (un-torn) part
  const coverStartX = direction === "left" ? tearX : 0;
  const coverEndX = direction === "left" ? W : tearX;
  drawCoverStrip(ctx, W, coverH, coverStartX, coverEndX, shimmerPhase);

  ctx.restore();

  // ── 3. Curl effect at tear edge ──────────────────────────────────────────
  if (!isTearingOff && progress > 0) {
    drawCurlEffect(ctx, tearX, coverH, direction, progress);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ichiban Kuji (一番賞) horizontal cover-strip tear reveal.
 *
 * The ticket has a metallic silver cover strip on the top ~30%.
 * The user grabs either the left or right edge of the strip and drags
 * horizontally. The strip tears along a perforation line, progressively
 * revealing the prize info underneath (grade badge, name, image).
 *
 * - Releasing before 70% progress: cover springs back horizontally.
 * - Releasing at/after 70%: remaining strip flies off and onRevealed fires.
 *
 * Visual layers (bottom to top in the DOM):
 *  1. Ticket body drawn on canvas (always visible)
 *  2. Canvas overlay: cover strip + curl effect
 */
export function TearReveal({
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  onRevealed,
  onProgress,
}: TearRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // ── Preload prize image ───────────────────────────────────────────────────
  const prizeImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!prizePhotoUrl) return;
    const img = new Image();
    // Only set crossOrigin for real URLs — data: URIs don't need CORS
    if (!prizePhotoUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      prizeImageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      prizeImageRef.current = null;
      setImageLoaded(true); // still render; drawTicketBody handles null image gracefully
    };
    img.src = prizePhotoUrl;
  }, [prizePhotoUrl]);

  // ── Interaction state (all refs to avoid stale closures in RAF) ───────────
  const isDraggingRef = useRef(false);
  const startClientXRef = useRef(0);
  const currentClientXRef = useRef(0);
  const directionRef = useRef<TearDirection>("left");
  const progressRef = useRef(0);
  const [progressState, setProgressState] = useState(0); // for hint visibility only
  const velocityRef = useRef(0); // for spring-back
  const [revealed, setRevealed] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Shimmer phase — animated continuously until first drag
  const shimmerRef = useRef(0);

  // Tear-off fly state
  const tearOffRef = useRef<TearState>({
    progress: 0,
    tearingOff: false,
    tearOffX: 0,
    tearOffAlpha: 1,
  });

  // Canvas dimensions ref
  const dimRef = useRef({ W: 0, H: 0, coverH: 0 });

  // ── Canvas support ────────────────────────────────────────────────────────
  const [canvasSupported] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return typeof document.createElement("canvas").getContext === "function";
  });

  // ── Core draw call ────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { W, H, coverH } = dimRef.current;
    if (W === 0) return;

    const ts = tearOffRef.current;
    renderFrame(
      ctx, W, H, coverH,
      ts.tearingOff ? ts.progress : progressRef.current,
      directionRef.current,
      shimmerRef.current,
      ts.tearOffX,
      ts.tearOffAlpha,
      ts.tearingOff,
      prizeGrade,
      prizeName,
      prizeImageRef.current,
    );
  }, [prizeGrade, prizeName]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // ── Shimmer loop (runs until first interaction) ───────────────────────────

  const shimmerLoopRef = useRef<() => void>(() => { /* noop placeholder */ });

  useEffect(() => {
    shimmerLoopRef.current = () => {
      if (isDraggingRef.current || progressRef.current > 0.01 || revealed) return;
      shimmerRef.current = (shimmerRef.current + SHIMMER_SPEED) % 1;
      draw();
      rafRef.current = requestAnimationFrame(shimmerLoopRef.current);
    };
  }, [draw, revealed]);

  const startShimmer = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(shimmerLoopRef.current);
  }, []);

  // ── Spring-back ───────────────────────────────────────────────────────────

  const springBackLoopRef = useRef<() => void>(() => { /* noop */ });

  useEffect(() => {
    springBackLoopRef.current = () => {
      if (isDraggingRef.current) return;

      velocityRef.current =
        (velocityRef.current + (0 - progressRef.current) * SPRING_STIFFNESS) * SPRING_DAMPING;
      progressRef.current += velocityRef.current;
      if (progressRef.current < 0) progressRef.current = 0;

      // Keep startClientX / currentClientX in sync so progress mapping stays valid
      // Just drive from progressRef directly — no need to recalc client coords.
      setProgressState(progressRef.current);
      onProgress?.(progressRef.current);
      draw();

      if (
        Math.abs(progressRef.current) < 0.002 &&
        Math.abs(velocityRef.current) < 0.002
      ) {
        progressRef.current = 0;
        velocityRef.current = 0;
        setProgressState(0);
        onProgress?.(0);
        draw();
        startShimmer();
        return;
      }

      rafRef.current = requestAnimationFrame(springBackLoopRef.current);
    };
  }, [draw, onProgress, startShimmer]);

  // ── Tear-off animation ────────────────────────────────────────────────────

  const tearOffLoopRef = useRef<() => void>(() => { /* noop */ });

  useEffect(() => {
    tearOffLoopRef.current = () => {
      const ts = tearOffRef.current;
      if (!ts.tearingOff) return;

      // Slide the strip off in the tear direction, fade out
      const slideSpeed = directionRef.current === "left" ? -22 : 22;
      tearOffRef.current = {
        ...ts,
        tearOffX: ts.tearOffX + slideSpeed,
        tearOffAlpha: ts.tearOffAlpha - 0.048,
        progress: Math.min(ts.progress + 0.07, 1),
      };

      draw();

      if (tearOffRef.current.tearOffAlpha > 0) {
        rafRef.current = requestAnimationFrame(tearOffLoopRef.current);
      } else {
        tearOffRef.current = { progress: 1, tearingOff: false, tearOffX: 0, tearOffAlpha: 0 };
        progressRef.current = 1;
        setRevealed(true);
        onRevealed();
      }
    };
  }, [draw, onRevealed]);

  // ── Pointer coordinate helper ─────────────────────────────────────────────

  const toCanvasX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (canvas.width / rect.width);
  }, []);

  // ── Edge detection: did the user touch near the left or right edge? ───────

  const detectEdgeSide = useCallback((clientX: number): TearDirection | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
    const { W } = dimRef.current;

    // 28% of canvas width from each side counts as "grabbing the edge"
    const edgeZone = W * 0.28;
    if (canvasX <= edgeZone) return "left";
    if (canvasX >= W - edgeZone) return "right";
    return null; // middle tap — no tear initiated
  }, []);

  // ── Pointer events ────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (revealed || tearOffRef.current.tearingOff) return;

      // Only start a tear if user grabs near an edge of the cover strip
      const side = detectEdgeSide(e.clientX);
      if (!side) return;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      directionRef.current = side;
      startClientXRef.current = e.clientX;
      currentClientXRef.current = e.clientX;
      isDraggingRef.current = true;
      velocityRef.current = 0;
      progressRef.current = 0;

      setHasInteracted(true);
      setProgressState(0);

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draw();
    },
    [revealed, detectEdgeSide, draw],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || revealed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      currentClientXRef.current = e.clientX;
      const p = computeTearProgress(
        startClientXRef.current,
        e.clientX,
        directionRef.current,
        dimRef.current.W,
      );
      progressRef.current = p;
      setProgressState(p);
      onProgress?.(p);
      scheduleDraw();
    },
    [revealed, scheduleDraw, onProgress],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (progressRef.current >= REVEAL_THRESHOLD) {
      // Commit: animate the remaining strip flying off
      tearOffRef.current = {
        progress: progressRef.current,
        tearingOff: true,
        tearOffX: 0,
        tearOffAlpha: 1,
      };
      rafRef.current = requestAnimationFrame(tearOffLoopRef.current);
    } else {
      // Abandon: spring back to fully covered
      rafRef.current = requestAnimationFrame(springBackLoopRef.current);
    }
  }, []);

  // ── Canvas setup and resize ───────────────────────────────────────────────

  useEffect(() => {
    if (!canvasSupported) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sync = () => {
      const { width, height } = container.getBoundingClientRect();
      const W = Math.round(width);
      const H = Math.round(height);
      canvas.width = W;
      canvas.height = H;
      dimRef.current = {
        W,
        H,
        coverH: Math.round(H * COVER_RATIO),
      };
      draw();
    };

    const ro = new ResizeObserver(sync);
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, canvasSupported]);

  // Kick off shimmer once canvas is ready and image has loaded
  useEffect(() => {
    if (canvasSupported && imageLoaded && !revealed) {
      startShimmer();
    }
  }, [canvasSupported, imageLoaded, revealed, startShimmer]);

  // Redraw when image loads (so ticket body reflects loaded image)
  useEffect(() => {
    if (imageLoaded) draw();
  }, [imageLoaded, draw]);

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
      className="relative select-none overflow-hidden rounded-xl touch-none w-full h-full"
      style={{
        cursor: revealed ? "default" : progressState > 0.05 ? "grabbing" : "grab",
        minHeight: "200px",
      }}
    >
      {/*
        Canvas is the sole visual layer. The ticket body (including prize photo,
        grade badge, and prize name) is drawn directly onto the canvas so we
        can composite the cover strip cleanly on top without z-index tricks.
      */}
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

      {/*
        Revealed state: show a plain static ticket (no canvas).
        Reuse the same ticket-like card styling so the layout doesn't jump.
      */}
      {revealed && (
        <div
          className="relative w-full h-full flex flex-col items-center justify-end pb-4"
          style={{ background: TICKET_BG }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={prizePhotoUrl}
            alt="Prize"
            className="block w-full flex-1 object-contain"
            draggable={false}
          />
          {(prizeGrade || prizeName) && (
            <div className="flex flex-col items-center gap-1 pt-2">
              {prizeGrade && (
                <span
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold"
                  style={{
                    background: (GRADE_COLORS[prizeGrade] ?? DEFAULT_GRADE_COLOR).bg,
                    color: (GRADE_COLORS[prizeGrade] ?? DEFAULT_GRADE_COLOR).text,
                  }}
                >
                  {prizeGrade}
                </span>
              )}
              {prizeName && (
                <span className="text-sm" style={{ color: "#5C4A30" }}>{prizeName}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Touch hint — shown before user has started dragging */}
      {!revealed && !hasInteracted && progressState < 0.03 && (
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-3"
        >
          <span
            className="text-xs font-bold select-none px-2 py-1 rounded-full"
            style={{
              color: "#5a3a10",
              background: "rgba(255,235,180,0.80)",
              backdropFilter: "blur(2px)",
              marginTop: "4px",
            }}
          >
            ← 從邊緣撕開封條
          </span>
          <span
            className="text-xs font-bold select-none px-2 py-1 rounded-full"
            style={{
              color: "#5a3a10",
              background: "rgba(255,235,180,0.80)",
              backdropFilter: "blur(2px)",
              marginTop: "4px",
            }}
          >
            封條撕開 →
          </span>
        </div>
      )}
    </div>
  );
}
