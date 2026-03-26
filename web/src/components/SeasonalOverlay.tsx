"use client";

import { useEffect, useRef, useState } from "react";
import type { SeasonalTheme } from "@/lib/seasonal";

interface Particle {
  id: number;
  emoji: string;
  x: number;           // vw %
  delay: number;       // animation delay in seconds
  duration: number;    // total drift duration in seconds
  size: number;        // font-size in px
  amplitude: number;   // horizontal sine wave amplitude in px
}

interface SeasonalOverlayProps {
  theme: SeasonalTheme;
  enabled?: boolean;
}

const PARTICLE_COUNT = 18;
let _particleId = 0;

function buildParticles(theme: SeasonalTheme): Particle[] {
  const sources = theme.particles;
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: ++_particleId,
    emoji: sources[i % sources.length],
    x: Math.random() * 90 + 5,        // 5% – 95% across viewport
    delay: Math.random() * 10,         // up to 10 s stagger
    duration: 12 + Math.random() * 10, // 12 – 22 s to drift to bottom
    size: 14 + Math.random() * 12,     // 14 – 26 px
    amplitude: 20 + Math.random() * 40,// 20 – 60 px horizontal swing
  }));
}

/**
 * Renders floating emoji particles for the current seasonal theme.
 * Very subtle — opacity capped at 0.45 so it never obstructs gameplay.
 */
export function SeasonalOverlay({ theme, enabled = true }: SeasonalOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>(() =>
    enabled && theme.id !== "default" ? buildParticles(theme) : [],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Defer the setState to a microtask so it is not synchronous within the effect body
    const id = setTimeout(() => {
      setParticles(enabled && theme.id !== "default" ? buildParticles(theme) : []);
    }, 0);
    return () => clearTimeout(id);
  }, [theme, enabled]);

  if (!enabled || particles.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-10 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes seasonalDrift {
          0% {
            transform: translateY(-60px) translateX(0px);
            opacity: 0;
          }
          5% {
            opacity: 0.45;
          }
          50% {
            transform: translateY(50vh) translateX(var(--amp));
          }
          95% {
            opacity: 0.35;
          }
          100% {
            transform: translateY(105vh) translateX(0px);
            opacity: 0;
          }
        }
      `}</style>

      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: 0,
            fontSize: p.size,
            lineHeight: 1,
            // CSS custom property for per-particle sine amplitude
            ["--amp" as string]: `${p.amplitude}px`,
            animationName: "seasonalDrift",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationFillMode: "both",
            willChange: "transform, opacity",
          }}
          role="presentation"
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
