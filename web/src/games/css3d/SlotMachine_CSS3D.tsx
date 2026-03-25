"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GameState = "IDLE" | "SPINNING" | "STOPPING" | "RESULT";

export interface SlotMachineCSS3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const GRADE_COLORS: Record<Grade, { bg: string; border: string; text: string; glow: string }> = {
  "A賞": { bg: "#78350f", border: "#f59e0b", text: "#fde68a", glow: "#f59e0b" },
  "B賞": { bg: "#1e3a5f", border: "#3b82f6", text: "#bae6fd", glow: "#3b82f6" },
  "C賞": { bg: "#064e3b", border: "#10b981", text: "#a7f3d0", glow: "#10b981" },
  "D賞": { bg: "#3b0764", border: "#a855f7", text: "#ddd6fe", glow: "#a855f7" },
};

const GRADE_EMOJIS: Record<Grade, string> = {
  "A賞": "🏆",
  "B賞": "💎",
  "C賞": "🎖️",
  "D賞": "🎀",
};

// Symbol strip — repeated for seamless scroll
const SYMBOL_STRIP: Grade[] = ["A賞", "C賞", "B賞", "D賞", "A賞", "B賞", "C賞", "D賞", "A賞", "C賞", "D賞", "B賞"];

const SYMBOL_H = 64; // px per symbol cell
const REEL_COUNT = 3;
const REEL_VISIBLE = 3; // symbols visible at once

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findSymbolIndex(grade: Grade): number {
  return SYMBOL_STRIP.lastIndexOf(grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confetti particle
// ─────────────────────────────────────────────────────────────────────────────

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
}

function Confetti({ grade }: { grade: Grade }) {
  const colors = GRADE_COLORS[grade];
  // useMemo so random sizes are stable across re-renders (no impure call in render)
  const pieces: ConfettiPiece[] = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: 5 + (i / 18) * 90,
        color: i % 2 === 0 ? colors.glow : colors.border,
        delay: (i / 18) * 0.8,
        size: 6 + ((i * 137 + 31) % 7), // deterministic pseudo-random size
      })),
    [colors.glow, colors.border],
  );

  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "-8px",
            width: p.size,
            height: p.size / 2,
            background: p.color,
            opacity: 0,
            animation: `css3d-slot-confetti 1.2s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single reel
// ─────────────────────────────────────────────────────────────────────────────

interface ReelProps {
  targetGrade: Grade;
  spinning: boolean;
  stopped: boolean;
  stopDelay: number;
  onStop: () => void;
}

function Reel({ targetGrade, spinning, stopped, stopDelay, onStop }: ReelProps) {
  const [offsetY, setOffsetY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const velocityRef = useRef(0);
  const stoppedRef = useRef(false);

  // Target position: line up so center cell shows the target grade
  const targetIndex = findSymbolIndex(targetGrade);
  // We want the center slot (index 1 of the 3 visible) to show targetIndex
  // offsetY = -(targetIndex - 1) * SYMBOL_H
  const targetOffsetY = -(targetIndex - 1) * SYMBOL_H;

  useEffect(() => {
    stoppedRef.current = false;
    if (!spinning) {
      setIsAnimating(false);
      setOffsetY(0);
      velocityRef.current = 0;
      return;
    }

    // Start spinning
    setIsAnimating(true);
    velocityRef.current = 18; // pixels per frame
    startTimeRef.current = performance.now();

    const tick = () => {
      if (stoppedRef.current) return;
      setOffsetY((prev) => {
        // Wrap around the strip
        const next = prev - velocityRef.current;
        const stripH = SYMBOL_STRIP.length * SYMBOL_H;
        return ((next % stripH) + stripH) % stripH * -1;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [spinning]);

  // Stop reel when stopped signal arrives
  useEffect(() => {
    if (!stopped || stoppedRef.current) return;

    const timer = setTimeout(() => {
      stoppedRef.current = true;
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);

      // Ease to target position
      const easeToTarget = (startVal: number, target: number, duration: number, startT: number) => {
        const tick = (now: number) => {
          const elapsed = now - startT;
          const t = Math.min(elapsed / duration, 1);
          // ease-out cubic
          const eased = 1 - Math.pow(1 - t, 3);
          setOffsetY(startVal + (target - startVal) * eased);
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            onStop();
          }
        };
        requestAnimationFrame(tick);
      };

      setOffsetY((current) => {
        easeToTarget(current, targetOffsetY, 500, performance.now());
        return current;
      });
    }, stopDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, stopDelay, targetOffsetY]);

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        width: 76,
        height: SYMBOL_H * REEL_VISIBLE,
        background: "#111827",
        border: "1px solid #374151",
        boxShadow: "inset 0 0 12px rgba(0,0,0,0.8)",
      }}
    >
      {/* Symbol strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${offsetY}px)`,
          willChange: "transform",
        }}
      >
        {SYMBOL_STRIP.map((grade, i) => {
          const colors = GRADE_COLORS[grade];
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{
                height: SYMBOL_H,
                background: colors.bg,
                borderBottom: `1px solid ${colors.border}22`,
              }}
            >
              <span style={{ fontSize: 22 }}>{GRADE_EMOJIS[grade]}</span>
              <span
                className="text-[11px] font-black"
                style={{ color: colors.text }}
              >
                {grade}
              </span>
            </div>
          );
        })}
      </div>

      {/* Highlight window — center row */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: SYMBOL_H,
          left: 0,
          right: 0,
          height: SYMBOL_H,
          border: `2px solid rgba(251,191,36,0.6)`,
          borderRadius: 4,
          boxShadow: "inset 0 0 8px rgba(251,191,36,0.15)",
        }}
      />

      {/* Top & bottom shadow masks */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: SYMBOL_H,
          background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: SYMBOL_H,
          background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      />

      {/* Blur during spin */}
      {isAnimating && !stopped && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backdropFilter: "blur(1px)",
            background: "rgba(0,0,0,0.05)",
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lever component
// ─────────────────────────────────────────────────────────────────────────────

function Lever({ pulling, onClick }: { pulling: boolean; onClick: () => void }) {
  return (
    <div
      className="absolute cursor-pointer select-none"
      style={{ right: -20, top: 60, width: 36 }}
      onClick={onClick}
    >
      {/* Lever rod */}
      <div
        className="absolute left-1/2 -translate-x-1/2 origin-top transition-transform duration-300"
        style={{
          width: 8,
          height: 80,
          background: "linear-gradient(180deg, #6b7280 0%, #374151 100%)",
          borderRadius: 4,
          transform: pulling ? "rotate(30deg)" : "rotate(-10deg)",
          boxShadow: "2px 2px 4px rgba(0,0,0,0.4)",
        }}
      />
      {/* Knob */}
      <div
        className="absolute left-1/2 -translate-x-1/2 transition-transform duration-300"
        style={{
          width: 24,
          height: 24,
          background: "radial-gradient(circle at 35% 35%, #ef4444, #7f1d1d)",
          borderRadius: "50%",
          top: pulling ? 64 : 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2)",
          transition: "top 0.3s ease",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorative lights
// ─────────────────────────────────────────────────────────────────────────────

function LightRow({ count = 8, glowPhase }: { count?: number; glowPhase: number }) {
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4"];
  return (
    <div className="flex justify-around">
      {Array.from({ length: count }, (_, i) => {
        const phase = glowPhase + (i / count) * Math.PI * 2;
        const brightness = 0.4 + 0.6 * Math.abs(Math.sin(phase));
        const color = colors[i % colors.length];
        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              background: color,
              opacity: brightness,
              boxShadow: `0 0 ${4 + brightness * 6}px ${color}`,
              transition: "opacity 0.1s, box-shadow 0.1s",
            }}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main machine
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachineCSS3D({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: SlotMachineCSS3DProps) {
  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [spinning, setSpinning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const stoppedReelsRef = useRef<boolean[]>([false, false, false]);
  const [showResult, setShowResult] = useState(false);
  const [glowPhase, setGlowPhase] = useState(0);
  const [leverPulling, setLeverPulling] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const frameRef = useRef<number | null>(null);

  const grade = (GRADES.includes(resultGrade as Grade) ? resultGrade : "A賞") as Grade;
  const colors = GRADE_COLORS[grade];

  // Glow / light animation loop
  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.04;
      setGlowPhase(t);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (gameState !== "IDLE") return;

    setGameState("SPINNING");
    onStateChange?.("SPINNING");
    setSpinning(true);
    setStopped(false);
    stoppedReelsRef.current = [false, false, false];
    setShowResult(false);
    setShowConfetti(false);
    setLeverPulling(true);

    setTimeout(() => setLeverPulling(false), 400);

    // Stop after 2s
    setTimeout(() => {
      setGameState("STOPPING");
      onStateChange?.("STOPPING");
      setStopped(true);
    }, 2000);
  }, [gameState, onStateChange]);

  const handleReelStop = useCallback(
    (index: number) => {
      stoppedReelsRef.current[index] = true;
      const allStopped = stoppedReelsRef.current.every(Boolean);
      if (allStopped) {
        // All reels done
        setTimeout(() => {
          setGameState("RESULT");
          onStateChange?.("RESULT");
          setShowResult(true);
          setShaking(true);
          setShowConfetti(true);
          onResult?.(grade);
          setTimeout(() => setShaking(false), 600);
        }, 200);
      }
    },
    [grade, onResult, onStateChange]
  );

  const handleReset = useCallback(() => {
    setGameState("IDLE");
    onStateChange?.("IDLE");
    setSpinning(false);
    setStopped(false);
    stoppedReelsRef.current = [false, false, false];
    setShowResult(false);
    setShowConfetti(false);
    setShaking(false);
  }, [onStateChange]);

  const canStart = gameState === "IDLE";

  return (
    <div className="flex flex-col items-center justify-center w-full py-6 px-4 bg-gray-950 min-h-[480px]">
      <style>{`
        @keyframes css3d-slot-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
        }
        @keyframes css3d-slot-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px) rotate(-1deg); }
          30% { transform: translateX(6px) rotate(1deg); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        @keyframes css3d-slot-result-pop {
          0% { transform: scale(0.6) translateY(10px); opacity: 0; }
          70% { transform: scale(1.1) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Machine body */}
      <div
        className="relative"
        style={{
          animation: shaking ? "css3d-slot-shake 0.6s ease-in-out" : "none",
        }}
      >
        {/* Confetti layer */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 20 }}>
            <Confetti grade={grade} />
          </div>
        )}

        {/* Main body — 3D styled with CSS box-shadow depth */}
        <div
          className="relative rounded-2xl overflow-visible"
          style={{
            width: 320,
            background: "linear-gradient(180deg, #1f2937 0%, #111827 60%, #0f172a 100%)",
            border: "2px solid #374151",
            boxShadow: `
              4px 4px 0 #0f172a,
              8px 8px 0 #0a0f1a,
              0 20px 60px rgba(0,0,0,0.8),
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,
            padding: "16px 16px 20px",
          }}
        >
          {/* Lever */}
          <Lever pulling={leverPulling} onClick={handleStart} />

          {/* Top lights */}
          <div className="mb-3 px-2">
            <LightRow count={10} glowPhase={glowPhase} />
          </div>

          {/* Title plate */}
          <div
            className="text-center mb-4 py-2 rounded-xl"
            style={{
              background: "linear-gradient(90deg, #78350f, #92400e, #78350f)",
              border: `1px solid ${colors.border}66`,
              boxShadow: `0 0 12px ${colors.glow}44`,
            }}
          >
            <span className="text-amber-300 text-base font-black tracking-widest">拉霸機</span>
            <span className="text-amber-500 text-xs ml-2">SLOT</span>
          </div>

          {/* Reels window */}
          <div
            className="relative rounded-xl p-3 mb-4"
            style={{
              background: "#0a0a0f",
              border: "2px solid #1f2937",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.9)",
            }}
          >
            <div className="flex gap-2 justify-center">
              {Array.from({ length: REEL_COUNT }, (_, i) => (
                <Reel
                  key={`${spinning}-${i}`}
                  targetGrade={grade}
                  spinning={spinning}
                  stopped={stopped}
                  stopDelay={i * 350}
                  onStop={() => handleReelStop(i)}
                />
              ))}
            </div>

            {/* Win line overlay */}
            <div
              className="absolute pointer-events-none left-3 right-3"
              style={{
                top: 3 + SYMBOL_H,
                height: SYMBOL_H,
                border: `2px solid ${colors.glow}`,
                borderRadius: 6,
                boxShadow: showResult ? `0 0 12px ${colors.glow}, inset 0 0 12px ${colors.glow}22` : "none",
                opacity: showResult ? 1 : 0.3,
                transition: "opacity 0.3s, box-shadow 0.3s",
              }}
            />
          </div>

          {/* Result display */}
          <div
            className="text-center mb-4 rounded-xl py-2.5"
            style={{
              background: showResult ? colors.bg : "#0f172a",
              border: `1px solid ${showResult ? colors.border : "#1f2937"}`,
              boxShadow: showResult ? `0 0 16px ${colors.glow}66` : "none",
              minHeight: 56,
              transition: "all 0.3s",
              animation: showResult ? "css3d-slot-result-pop 0.4s ease-out" : "none",
            }}
          >
            {showResult ? (
              <div className="flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 24 }}>{GRADE_EMOJIS[grade]}</span>
                <span className="text-lg font-black" style={{ color: colors.text }}>{grade}</span>
                <span className="text-xs opacity-80" style={{ color: colors.text }}>{prizeName}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-gray-600 text-xs">
                  {gameState === "SPINNING" ? "轉動中..." : gameState === "STOPPING" ? "停止中..." : "等待中"}
                </span>
              </div>
            )}
          </div>

          {/* Bottom lights */}
          <div className="mb-4 px-2">
            <LightRow count={10} glowPhase={glowPhase + Math.PI} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="flex-1 py-3 rounded-xl text-sm font-black transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canStart
                  ? `linear-gradient(180deg, ${colors.glow} 0%, ${colors.border} 100%)`
                  : "#374151",
                color: canStart ? "#fff" : "#6b7280",
                boxShadow: canStart ? `0 4px 12px ${colors.glow}66, 0 2px 0 ${colors.bg}` : "none",
                transform: canStart ? "translateY(0)" : "none",
              }}
            >
              {gameState === "SPINNING"
                ? "🎰 轉動中..."
                : gameState === "STOPPING"
                ? "⏹ 停止中..."
                : "🎰 開始抽獎"}
            </button>
            {gameState === "RESULT" && (
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl text-sm font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                ↺ 重置
              </button>
            )}
          </div>
        </div>

        {/* Machine base / stand */}
        <div
          className="mx-auto rounded-b-xl"
          style={{
            width: 280,
            height: 16,
            background: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)",
            boxShadow: "4px 4px 0 #0a0f1a, 0 8px 20px rgba(0,0,0,0.6)",
          }}
        />
        <div
          className="mx-auto rounded-b-xl"
          style={{
            width: 220,
            height: 10,
            background: "#0f172a",
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* State + tech badge */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="px-3 py-1 rounded-full text-xs font-mono"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid #374151",
            color: "#6b7280",
          }}
        >
          狀態: <span className="text-gray-300">{gameState}</span>
        </div>
        <div
          className="px-2 py-1 rounded text-[9px] font-mono"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid #1f2937",
            color: "#4b5563",
          }}
        >
          CSS 3D
        </div>
      </div>
    </div>
  );
}
