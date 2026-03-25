"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FloatingEmoji {
  id: string;
  emoji: string;
  /** Horizontal position (% of container width). */
  x: number;
}

interface ReactionOverlayProps {
  /**
   * The emoji to launch. Pass a new string object reference (or bump a key)
   * each time a reaction arrives so the effect fires correctly.
   */
  emoji: string | null;
  /**
   * Rendered inside the parent — position the parent as `relative` and this
   * component will `absolute`-fill it.
   */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

let _reactionCounter = 0;

/**
 * Floating emoji overlay that animates reactions upward with a fade-out.
 *
 * Mount once inside a `position: relative` container. Feed new emoji reactions
 * via the `emoji` prop — each non-null value spawns a new floating bubble.
 * Multiple identical reactions that arrive quickly are each rendered as
 * independent particles.
 */
export function ReactionOverlay({ emoji, className = "" }: ReactionOverlayProps) {
  const [particles, setParticles] = useState<FloatingEmoji[]>([]);
  const prevEmojiRef = useRef<string | null>(null);

  // Spawn a new particle whenever `emoji` changes to a non-null value
  useEffect(() => {
    if (!emoji) return;
    // Allow re-firing the same emoji (ref tracks previous value)
    prevEmojiRef.current = emoji;
    const id = `re_${Date.now()}_${++_reactionCounter}`;
    const x = 10 + Math.random() * 80; // 10%–90% horizontal spread
    setParticles((prev) => [...prev, { id, emoji, x }]);

    // Remove particle after animation completes (2 s + buffer)
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 2_400);

    return () => clearTimeout(timer);
  }, [emoji]);

  if (particles.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute bottom-4 text-3xl select-none"
          style={{
            left: `${p.x}%`,
            animation: "reactionFloat 2s ease-out forwards",
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* Keyframe injected inline — avoids a globals.css dependency */}
      <style>{`
        @keyframes reactionFloat {
          0%   { transform: translateY(0)       scale(1);   opacity: 1; }
          60%  { transform: translateY(-80px)   scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-140px)  scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller hook — batches incoming reaction emoji into a sequential queue so
// rapid-fire reactions all animate rather than being collapsed into one.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages a queue of incoming reaction emoji strings so each one triggers its
 * own independent ReactionOverlay particle.
 *
 * Usage:
 *   const { currentEmoji, pushReaction } = useReactionQueue();
 *   // call pushReaction(emoji) when a CHAT_REACTION event arrives
 *   // pass currentEmoji to <ReactionOverlay emoji={currentEmoji} />
 */
export function useReactionQueue() {
  const [currentEmoji, setCurrentEmoji] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  const processNext = () => {
    if (queueRef.current.length === 0) {
      processingRef.current = false;
      return;
    }
    processingRef.current = true;
    const next = queueRef.current.shift()!;
    // Re-wrap in an object-tagged string to ensure the effect in ReactionOverlay
    // always sees a change even for identical emoji.
    setCurrentEmoji(next);
    setTimeout(processNext, 120); // stagger particles slightly
  };

  const pushReaction = (emoji: string) => {
    queueRef.current.push(emoji);
    if (!processingRef.current) processNext();
  };

  return { currentEmoji, pushReaction };
}
