"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClawGameState = "IDLE" | "PLAYING" | "RESULT";

export interface ClawMachineCSS3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: ClawGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const GRADE_COLORS: Record<Grade, { bg: string; border: string; text: string; glow: string; toy: string }> = {
  "A賞": { bg: "#78350f", border: "#f59e0b", text: "#fde68a", glow: "#f59e0b", toy: "#fbbf24" },
  "B賞": { bg: "#1e3a5f", border: "#3b82f6", text: "#bae6fd", glow: "#3b82f6", toy: "#60a5fa" },
  "C賞": { bg: "#064e3b", border: "#10b981", text: "#a7f3d0", glow: "#10b981", toy: "#34d399" },
  "D賞": { bg: "#3b0764", border: "#a855f7", text: "#ddd6fe", glow: "#a855f7", toy: "#c084fc" },
};

// Toy configurations inside the machine (positional + color data)
interface ToyDef {
  grade: Grade;
  x: number;
  y: number;
  color: string;
  eyeColor: string;
  label: string;
}

const TOYS: ToyDef[] = [
  { grade: "A賞", x: 18, y: 62, color: "#fbbf24", eyeColor: "#78350f", label: "A" },
  { grade: "B賞", x: 48, y: 68, color: "#60a5fa", eyeColor: "#1e3a5f", label: "B" },
  { grade: "C賞", x: 74, y: 64, color: "#34d399", eyeColor: "#064e3b", label: "C" },
  { grade: "D賞", x: 31, y: 75, color: "#c084fc", eyeColor: "#3b0764", label: "D" },
  { grade: "B賞", x: 60, y: 77, color: "#93c5fd", eyeColor: "#1e40af", label: "B" },
  { grade: "C賞", x: 12, y: 80, color: "#6ee7b7", eyeColor: "#065f46", label: "C" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isGrade(g: string): g is Grade {
  return GRADES.includes(g as Grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confetti
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
  const pieces: ConfettiPiece[] = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 4 + (i / 20) * 92,
        color: i % 2 === 0 ? colors.glow : colors.border,
        delay: (i / 20) * 1.0,
        size: 5 + ((i * 113 + 17) % 8),
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
            animation: `claw-confetti 1.4s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toy figure
// ─────────────────────────────────────────────────────────────────────────────

function Toy({
  toy,
  grabbed,
  dim,
}: {
  toy: ToyDef;
  grabbed: boolean;
  dim: boolean;
}) {
  return (
    <div
      className="absolute transition-all duration-300"
      style={{
        left: `${toy.x}%`,
        bottom: `${100 - toy.y}%`,
        width: 36,
        height: 36,
        transform: "translate(-50%, 50%)",
        opacity: dim ? 0.25 : grabbed ? 0 : 1,
        transition: "opacity 0.4s",
      }}
    >
      {/* Body */}
      <div
        className="absolute inset-0 rounded-[40%]"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${toy.color}, ${toy.color}bb)`,
          boxShadow: `0 3px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)`,
        }}
      />
      {/* Left eye */}
      <div
        className="absolute rounded-full"
        style={{
          width: 7,
          height: 7,
          background: toy.eyeColor,
          top: "28%",
          left: "22%",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5)",
        }}
      />
      {/* Right eye */}
      <div
        className="absolute rounded-full"
        style={{
          width: 7,
          height: 7,
          background: toy.eyeColor,
          top: "28%",
          right: "22%",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5)",
        }}
      />
      {/* Smile */}
      <div
        className="absolute"
        style={{
          width: 12,
          height: 6,
          borderBottom: `2px solid ${toy.eyeColor}`,
          borderRadius: "0 0 8px 8px",
          bottom: "28%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      {/* Grade badge */}
      <div
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black rounded px-0.5"
        style={{
          background: toy.color,
          color: toy.eyeColor,
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        {toy.label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Claw assembly
// ─────────────────────────────────────────────────────────────────────────────

function Claw({
  x,
  y,
  open,
  grabbing,
}: {
  x: number;
  y: number;
  open: boolean;
  grabbing: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: y,
        transform: "translateX(-50%)",
        transition: "left 0.35s ease, top 1.1s cubic-bezier(0.25,0.46,0.45,0.94)",
        zIndex: 10,
      }}
    >
      {/* Cable */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: 3,
          height: 28,
          background: "linear-gradient(180deg, #9ca3af 0%, #6b7280 100%)",
          borderRadius: 2,
          top: -28,
          boxShadow: "1px 0 2px rgba(0,0,0,0.3)",
        }}
      />
      {/* Hub */}
      <div
        className="relative"
        style={{
          width: 18,
          height: 18,
          background: "radial-gradient(circle at 35% 35%, #e5e7eb, #6b7280)",
          borderRadius: "50%",
          left: "50%",
          transform: "translateX(-50%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)",
          zIndex: 2,
        }}
      />
      {/* Left prong */}
      <div
        className="absolute"
        style={{
          width: 5,
          height: 24,
          background: "linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%)",
          borderRadius: "0 0 4px 4px",
          bottom: -22,
          left: "50%",
          transformOrigin: "top center",
          transform: open
            ? "translateX(calc(-50% - 10px)) rotate(-35deg)"
            : grabbing
            ? "translateX(calc(-50% - 3px)) rotate(-10deg)"
            : "translateX(calc(-50% - 2px)) rotate(-8deg)",
          transition: "transform 0.35s ease",
          boxShadow: "1px 2px 4px rgba(0,0,0,0.3)",
        }}
      />
      {/* Center prong */}
      <div
        className="absolute"
        style={{
          width: 5,
          height: 26,
          background: "linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%)",
          borderRadius: "0 0 4px 4px",
          bottom: -24,
          left: "50%",
          transformOrigin: "top center",
          transform: "translateX(-50%) rotate(0deg)",
          transition: "transform 0.35s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        }}
      />
      {/* Right prong */}
      <div
        className="absolute"
        style={{
          width: 5,
          height: 24,
          background: "linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%)",
          borderRadius: "0 0 4px 4px",
          bottom: -22,
          left: "50%",
          transformOrigin: "top center",
          transform: open
            ? "translateX(calc(-50% + 10px)) rotate(35deg)"
            : grabbing
            ? "translateX(calc(-50% + 3px)) rotate(10deg)"
            : "translateX(calc(-50% + 2px)) rotate(8deg)",
          transition: "transform 0.35s ease",
          boxShadow: "-1px 2px 4px rgba(0,0,0,0.3)",
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
              width: 7,
              height: 7,
              background: color,
              opacity: brightness,
              boxShadow: `0 0 ${3 + brightness * 5}px ${color}`,
              transition: "opacity 0.1s, box-shadow 0.1s",
            }}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Arrow button
// ─────────────────────────────────────────────────────────────────────────────

function ArrowBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-black transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed select-none"
      style={{
        background: disabled
          ? "#1f2937"
          : "linear-gradient(180deg, #374151 0%, #1f2937 100%)",
        border: "1px solid #4b5563",
        color: "#d1d5db",
        boxShadow: disabled ? "none" : "0 2px 0 #111, 0 3px 6px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachineCSS3D({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: ClawMachineCSS3DProps) {
  const grade = (isGrade(resultGrade) ? resultGrade : "A賞") as Grade;
  const colors = GRADE_COLORS[grade];

  // Claw horizontal position in % (0–100 of glass width)
  const [clawX, setClawX] = useState(50);
  // Claw vertical position in px from top of glass area
  const [clawY, setClawY] = useState(8);
  const [clawOpen, setClawOpen] = useState(true);
  const [clawGrabbing, setClawGrabbing] = useState(false);
  const [grabbedToyIndex, setGrabbedToyIndex] = useState<number | null>(null);

  const [gameState, setGameState] = useState<ClawGameState>("IDLE");
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [glowPhase, setGlowPhase] = useState(0);
  const [shaking, setShaking] = useState(false);

  const frameRef = useRef<number | null>(null);
  const dropSequenceRef = useRef(false);

  // The toy index matching the target grade
  const targetToyIndex = useMemo(
    () => TOYS.findIndex((t) => t.grade === grade),
    [grade],
  );

  // Glow animation loop
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

  const moveLeft = useCallback(() => {
    if (gameState !== "IDLE") return;
    setClawX((x) => Math.max(10, x - 10));
  }, [gameState]);

  const moveRight = useCallback(() => {
    if (gameState !== "IDLE") return;
    setClawX((x) => Math.min(90, x + 10));
  }, [gameState]);

  const handleDrop = useCallback(() => {
    if (gameState !== "IDLE" || dropSequenceRef.current) return;
    dropSequenceRef.current = true;

    setGameState("PLAYING");
    onStateChange?.("PLAYING");
    setClawOpen(false);

    // Phase 1: descend
    setClawY(145);

    // Phase 2: close and grab after descent
    setTimeout(() => {
      setClawGrabbing(true);
      setGrabbedToyIndex(targetToyIndex);
    }, 1150);

    // Phase 3: ascend
    setTimeout(() => {
      setClawY(8);
    }, 1600);

    // Phase 4: move claw to chute (right side)
    setTimeout(() => {
      setClawX(88);
    }, 2800);

    // Phase 5: release at chute
    setTimeout(() => {
      setClawOpen(true);
      setClawGrabbing(false);
      setGrabbedToyIndex(null);
    }, 3400);

    // Phase 6: show result
    setTimeout(() => {
      setGameState("RESULT");
      onStateChange?.("RESULT");
      setShowResult(true);
      setShowConfetti(true);
      setShaking(true);
      onResult?.(grade);
      setTimeout(() => setShaking(false), 600);
    }, 3800);
  }, [gameState, grade, onResult, onStateChange, targetToyIndex]);

  const handleReset = useCallback(() => {
    dropSequenceRef.current = false;
    setGameState("IDLE");
    onStateChange?.("IDLE");
    setClawX(50);
    setClawY(8);
    setClawOpen(true);
    setClawGrabbing(false);
    setGrabbedToyIndex(null);
    setShowResult(false);
    setShowConfetti(false);
    setShaking(false);
  }, [onStateChange]);

  const isIdle = gameState === "IDLE";
  const isAWin = grade === "A賞";

  return (
    <div className="flex flex-col items-center justify-center w-full py-6 px-4 bg-gray-950 min-h-[520px]">
      <style>{`
        @keyframes claw-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(140px) rotate(720deg); opacity: 0; }
        }
        @keyframes claw-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-7px) rotate(-1deg); }
          30% { transform: translateX(7px) rotate(1deg); }
          50% { transform: translateX(-4px); }
          70% { transform: translateX(4px); }
          90% { transform: translateX(-2px); }
        }
        @keyframes claw-pop-in {
          0% { transform: scale(0.5) translateY(8px); opacity: 0; }
          65% { transform: scale(1.12) translateY(-3px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes claw-get {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      {/* Machine outer wrapper (shake on win) */}
      <div
        style={{
          animation: shaking ? "claw-shake 0.6s ease-in-out" : "none",
        }}
        className="relative"
      >
        {/* Confetti layer */}
        {showConfetti && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: 30 }}
          >
            <Confetti grade={grade} />
          </div>
        )}

        {/* Cabinet */}
        <div
          className="relative rounded-2xl"
          style={{
            width: 320,
            background: "linear-gradient(180deg, #1e1b4b 0%, #312e81 25%, #1e1b4b 60%, #0f0e1a 100%)",
            border: isAWin && showResult
              ? `2px solid ${colors.glow}`
              : "2px solid #3730a3",
            boxShadow: isAWin && showResult
              ? `4px 4px 0 #0a0a14, 8px 8px 0 #060610, 0 20px 60px rgba(0,0,0,0.8), 0 0 30px ${colors.glow}66, inset 0 1px 0 rgba(255,255,255,0.08)`
              : "4px 4px 0 #0a0a14, 8px 8px 0 #060610, 0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
            padding: "14px 14px 18px",
            transition: "border-color 0.4s, box-shadow 0.4s",
          }}
        >
          {/* Top lights */}
          <div className="mb-3 px-1">
            <LightRow count={10} glowPhase={glowPhase} />
          </div>

          {/* Title plate */}
          <div
            className="text-center mb-3 py-2 rounded-xl"
            style={{
              background: "linear-gradient(90deg, #1e1b4b, #312e81, #1e1b4b)",
              border: `1px solid ${colors.border}55`,
              boxShadow: `0 0 10px ${colors.glow}33`,
            }}
          >
            <span className="text-indigo-200 text-base font-black tracking-widest">夾娃娃機</span>
            <span className="text-indigo-400 text-xs ml-2">CLAW</span>
          </div>

          {/* Glass case */}
          <div
            className="relative rounded-xl overflow-hidden mb-3"
            style={{
              height: 220,
              background: "rgba(200,210,255,0.04)",
              border: "2px solid #4338ca",
              backdropFilter: "blur(2px)",
              boxShadow: "inset 0 0 24px rgba(0,0,0,0.7), 0 0 8px rgba(67,56,202,0.3)",
            }}
          >
            {/* Rail (top horizontal bar) */}
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: 10,
                background: "linear-gradient(180deg, #6b7280 0%, #374151 50%, #1f2937 100%)",
                borderBottom: "1px solid #111",
                boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                zIndex: 5,
              }}
            />

            {/* Back wall gradient */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, #0f0e20 0%, #1a1840 50%, #0f0e20 100%)",
                zIndex: 0,
              }}
            />

            {/* Floor highlight */}
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: 20,
                background: "linear-gradient(180deg, transparent, rgba(99,102,241,0.15))",
                zIndex: 1,
              }}
            />

            {/* Toys */}
            {TOYS.map((toy, i) => (
              <Toy
                key={i}
                toy={toy}
                grabbed={grabbedToyIndex === i}
                dim={showResult && grabbedToyIndex !== i}
              />
            ))}

            {/* Chute opening — bottom right */}
            <div
              className="absolute bottom-0 right-0 rounded-tl-lg"
              style={{
                width: 36,
                height: 28,
                background: "#0a0a14",
                border: "1px solid #312e81",
                borderRight: "none",
                borderBottom: "none",
                boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.8)",
                zIndex: 3,
              }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center text-[8px] text-indigo-400 font-mono"
              >
                出口
              </div>
            </div>

            {/* Claw */}
            <Claw x={clawX} y={clawY} open={clawOpen} grabbing={clawGrabbing} />
          </div>

          {/* Result display */}
          <div
            className="text-center mb-3 rounded-xl py-2.5 relative overflow-hidden"
            style={{
              minHeight: 58,
              background: showResult ? colors.bg : "#0f0e1a",
              border: `1px solid ${showResult ? colors.border : "#312e81"}`,
              boxShadow: showResult ? `0 0 16px ${colors.glow}55` : "none",
              transition: "all 0.35s",
              animation: showResult ? "claw-pop-in 0.45s ease-out" : "none",
            }}
          >
            {showResult ? (
              <div className="flex flex-col items-center gap-0.5">
                {/* GET! badge */}
                <div
                  className="text-sm font-black mb-0.5"
                  style={{
                    color: colors.glow,
                    textShadow: `0 0 10px ${colors.glow}`,
                    animation: "claw-get 0.5s ease-out 0.1s both",
                  }}
                >
                  GET!
                </div>
                <span className="text-lg font-black" style={{ color: colors.text }}>
                  {grade}
                </span>
                <span className="text-xs opacity-80" style={{ color: colors.text }}>
                  {prizeName}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-indigo-400 text-xs">
                  {gameState === "PLAYING" ? "夾取中..." : "等待操作"}
                </span>
              </div>
            )}
          </div>

          {/* Control panel */}
          <div
            className="rounded-xl p-3"
            style={{
              background: "linear-gradient(180deg, #1e1b4b 0%, #0f0e1a 100%)",
              border: "1px solid #312e81",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between">
              {/* Arrow buttons */}
              <div className="flex gap-2">
                <ArrowBtn onClick={moveLeft} disabled={!isIdle}>
                  ◀
                </ArrowBtn>
                <ArrowBtn onClick={moveRight} disabled={!isIdle}>
                  ▶
                </ArrowBtn>
              </div>

              {/* DROP button */}
              <button
                onClick={handleDrop}
                disabled={!isIdle}
                className="relative transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: isIdle
                    ? "radial-gradient(circle at 35% 35%, #ef4444, #991b1b)"
                    : "#374151",
                  boxShadow: isIdle
                    ? "0 4px 0 #7f1d1d, 0 6px 16px rgba(239,68,68,0.5), inset 0 2px 4px rgba(255,255,255,0.2)"
                    : "0 2px 0 #1f2937",
                  border: "2px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                  transition: "all 0.15s",
                }}
              >
                DROP
              </button>

              {/* Reset */}
              {gameState === "RESULT" ? (
                <button
                  onClick={handleReset}
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  ↺
                </button>
              ) : (
                <div className="w-[52px]" />
              )}
            </div>

            {/* Joystick label */}
            <div className="text-center mt-2">
              <span className="text-indigo-400 text-[10px] font-mono">◀ ▶ 移動  DROP 放下</span>
            </div>
          </div>
        </div>

        {/* Machine base */}
        <div
          className="mx-auto rounded-b-xl"
          style={{
            width: 280,
            height: 14,
            background: "linear-gradient(180deg, #1e1b4b 0%, #0f0e1a 100%)",
            boxShadow: "4px 4px 0 #06060f, 0 8px 20px rgba(0,0,0,0.6)",
          }}
        />
        <div
          className="mx-auto rounded-b-xl"
          style={{
            width: 220,
            height: 10,
            background: "#0a0a14",
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* Status badge */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="px-3 py-1 rounded-full text-xs font-mono"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid #312e81",
            color: "#6b7280",
          }}
        >
          狀態: <span className="text-indigo-300">{gameState}</span>
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
