"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FlipRevealProps {
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  onRevealed: () => void;
}

const FLIP_DURATION_MS = 650;
const PERSPECTIVE_PX = 900;
// How far the mouse can tilt the card (degrees)
const MAX_TILT = 12;

/**
 * CSS 3D card-flip reveal animation.
 *
 * Front face: decorative card back with pattern + "?" mark.
 * Back face: prize image + grade badge + prize name.
 * The user taps/clicks to trigger the flip. While hovering (before click)
 * a subtle parallax tilt tracks the mouse position for a 3D feel.
 * `onRevealed` is called once the flip animation completes.
 *
 * Key implementation notes:
 * - The PERSPECTIVE must be on a PARENT element, not the card itself.
 * - Both faces need backfaceVisibility + WebkitBackfaceVisibility: "hidden"
 *   so Safari (which requires the vendor prefix) hides the correct face.
 * - The back face is pre-rotated 180deg so it is hidden initially and
 *   becomes visible when the container rotates 180deg.
 */
export function FlipReveal({ prizePhotoUrl, prizeGrade, prizeName, onRevealed }: FlipRevealProps) {
  const [flipped, setFlipped] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flip trigger ────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (flipped) return;
    setTiltX(0);
    setTiltY(0);
    setFlipped(true);
    timerRef.current = setTimeout(() => {
      onRevealed();
    }, FLIP_DURATION_MS);
  }, [flipped, onRevealed]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Mouse parallax tilt (front face only) ───────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (flipped) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setTiltX(-dy * MAX_TILT);
      setTiltY(dx * MAX_TILT);
    },
    [flipped],
  );

  const handleMouseLeave = useCallback(() => {
    setTiltX(0);
    setTiltY(0);
  }, []);

  const cardTransform = flipped
    ? "rotateY(180deg)"
    : `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

  const cardTransition = flipped
    ? `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
    : "transform 0.12s ease-out";

  // Dynamic shadow while flipping
  const shadowOpacity = flipped ? 0.15 : 0.3 + Math.abs(tiltY) / MAX_TILT * 0.15;

  // Shared style applied to BOTH faces to ensure Safari hides the rear face.
  // WebkitBackfaceVisibility is required for Safari — the un-prefixed property
  // alone is not honoured by WebKit-based browsers.
  const faceBaseStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    position: "absolute",
    inset: 0,
  };

  return (
    // Perspective lives on a PARENT of the card so that the 3D space is
    // established before the card's own transform is applied.
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ perspective: `${PERSPECTIVE_PX}px` }}
    >
      <div
        ref={cardRef}
        className="relative"
        style={{
          width: "min(280px, 80vw)",
          height: "min(400px, 70vh)",
          transformStyle: "preserve-3d",
          transform: cardTransform,
          transition: cardTransition,
          cursor: flipped ? "default" : "pointer",
          filter: `drop-shadow(0 ${4 + Math.abs(tiltX) * 0.5}px ${16 + Math.abs(tiltY)}px rgba(0,0,0,${shadowOpacity}))`,
        }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="button"
        aria-label="點擊翻牌"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
      >
        {/* ── Front face (card back pattern) ──────────────────────────── */}
        {/* Visible when the card has NOT been flipped (transform = 0deg).  */}
        {/* backfaceVisibility:hidden hides this face once the card rotates  */}
        {/* past 90deg, so the back face (below) becomes visible.            */}
        <div
          className="rounded-2xl overflow-hidden"
          style={faceBaseStyle}
        >
          {/* Background gradient */}
          <div
            className="w-full h-full relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 40%, #9333EA 70%, #A855F7 100%)",
            }}
          >
            {/* Decorative diagonal grid lines */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="card-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 24" stroke="white" strokeWidth="0.8" fill="none" />
                  <path d="M 0 0 L 24 24" stroke="white" strokeWidth="0.8" fill="none" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#card-grid)" />
            </svg>

            {/* Corner ornaments */}
            {(["top-3 left-3", "top-3 right-3 rotate-90", "bottom-3 left-3 -rotate-90", "bottom-3 right-3 rotate-180"] as const).map(
              (pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-8 h-8 opacity-40`}
                  style={{
                    borderTop: "2px solid rgba(255,255,255,0.8)",
                    borderLeft: "2px solid rgba(255,255,255,0.8)",
                    borderRadius: "3px 0 0 0",
                  }}
                />
              ),
            )}

            {/* Center diamond */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 100,
                  height: 100,
                  background: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.25)",
                  backdropFilter: "blur(4px)",
                  transform: "rotate(45deg)",
                }}
              >
                <span
                  className="text-white font-black text-4xl select-none"
                  style={{ transform: "rotate(-45deg)" }}
                >
                  ?
                </span>
              </div>
            </div>

            {/* Bottom label */}
            <div className="absolute bottom-4 inset-x-0 text-center">
              <span className="text-white text-opacity-60 text-xs font-semibold tracking-widest uppercase select-none">
                點擊翻牌
              </span>
            </div>
          </div>
        </div>

        {/* ── Back face (prize reveal) ─────────────────────────────────── */}
        {/* Pre-rotated 180deg so it faces away initially (hidden by          */}
        {/* backfaceVisibility). When the container flips 180deg this face    */}
        {/* ends up at 360deg = 0deg (front-facing) and the front face is now */}
        {/* at 180deg (rear-facing, hidden). Net result: correct reveal.      */}
        <div
          className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900"
          style={{
            ...faceBaseStyle,
            // Pre-rotate so this face starts hidden and becomes visible on flip
            transform: "rotateY(180deg)",
          }}
        >
          {/* Prize image — top portion */}
          <div className="relative h-3/5 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prizePhotoUrl}
              alt={prizeName}
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Gradient overlay into content area */}
            <div
              className="absolute bottom-0 inset-x-0 h-12"
              style={{
                background: "linear-gradient(to bottom, transparent, white)",
              }}
            />
          </div>

          {/* Prize info */}
          <div className="h-2/5 flex flex-col items-center justify-center p-4 gap-2">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white"
              style={{
                background: "linear-gradient(90deg, #f59e0b, #f97316)",
              }}
            >
              {prizeGrade}
            </span>
            <p
              className="text-center font-bold text-gray-900 dark:text-gray-100 leading-tight"
              style={{ fontSize: "clamp(0.8rem, 3vw, 1rem)" }}
            >
              {prizeName}
            </p>
            <div className="mt-1 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-amber-400 text-xs">
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
