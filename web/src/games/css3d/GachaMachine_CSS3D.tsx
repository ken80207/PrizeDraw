"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GachaGameState = "IDLE" | "PLAYING" | "RESULT";

export interface GachaMachineCSS3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: GachaGameState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const GRADE_COLORS: Record<Grade, { bg: string; border: string; text: string; glow: string; capsuleTop: string; capsuleBot: string }> = {
  "A賞": {
    bg: "#78350f",
    border: "#f59e0b",
    text: "#fde68a",
    glow: "#f59e0b",
    capsuleTop: "#fbbf24",
    capsuleBot: "#f97316",
  },
  "B賞": {
    bg: "#1e3a5f",
    border: "#3b82f6",
    text: "#bae6fd",
    glow: "#3b82f6",
    capsuleTop: "#60a5fa",
    capsuleBot: "#2563eb",
  },
  "C賞": {
    bg: "#064e3b",
    border: "#10b981",
    text: "#a7f3d0",
    glow: "#10b981",
    capsuleTop: "#34d399",
    capsuleBot: "#059669",
  },
  "D賞": {
    bg: "#3b0764",
    border: "#a855f7",
    text: "#ddd6fe",
    glow: "#a855f7",
    capsuleTop: "#c084fc",
    capsuleBot: "#7c3aed",
  },
};

// Decorative capsule defs inside the dome
interface DomeCapsule {
  x: number;
  y: number;
  size: number;
  top: string;
  bot: string;
  rotation: number;
}

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
            animation: `gacha-confetti 1.4s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini capsule for inside dome
// ─────────────────────────────────────────────────────────────────────────────

function MiniCapsule({ cap }: { cap: DomeCapsule }) {
  return (
    <div
      className="absolute"
      style={{
        left: cap.x,
        top: cap.y,
        width: cap.size,
        height: cap.size * 1.4,
        borderRadius: cap.size * 0.5,
        background: `linear-gradient(to bottom, ${cap.top} 50%, ${cap.bot} 50%)`,
        transform: `rotate(${cap.rotation}deg)`,
        boxShadow: `inset -${cap.size * 0.15}px -${cap.size * 0.1}px ${cap.size * 0.2}px rgba(0,0,0,0.3), inset ${cap.size * 0.1}px ${cap.size * 0.1}px ${cap.size * 0.15}px rgba(255,255,255,0.3)`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivered capsule (bounces from chute)
// ─────────────────────────────────────────────────────────────────────────────

function DeliveredCapsule({
  grade,
  visible,
  opened,
  onClick,
}: {
  grade: Grade;
  visible: boolean;
  opened: boolean;
  onClick: () => void;
}) {
  const colors = GRADE_COLORS[grade];
  const capsuleW = 56;
  const capsuleH = 80;

  if (!visible) return null;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{
        width: capsuleW,
        height: capsuleH,
        animation: "gacha-drop-bounce 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
      }}
      onClick={onClick}
    >
      {/* Bottom half — fixed */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: capsuleH / 2,
          borderRadius: `0 0 ${capsuleW / 2}px ${capsuleW / 2}px`,
          background: `radial-gradient(circle at 35% 30%, ${colors.capsuleBot}ee, ${colors.capsuleBot})`,
          boxShadow: `inset -4px -3px 8px rgba(0,0,0,0.3), inset 3px 3px 6px rgba(255,255,255,0.15), 0 4px 12px ${colors.glow}55`,
        }}
      >
        {/* Grade label inside bottom */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: 13, fontWeight: 900, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          {grade}
        </div>
      </div>

      {/* Top half — slides up when opened */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: capsuleH / 2 + 4,
          borderRadius: `${capsuleW / 2}px ${capsuleW / 2}px 0 0`,
          background: `radial-gradient(circle at 35% 30%, ${colors.capsuleTop}ee, ${colors.capsuleTop})`,
          boxShadow: `inset -4px -3px 8px rgba(0,0,0,0.2), inset 3px 3px 6px rgba(255,255,255,0.25)`,
          transform: opened ? "translateY(-34px)" : "translateY(0)",
          transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          zIndex: 2,
        }}
      />

      {/* Prize glow inside when opened */}
      {opened && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 1,
            animation: "gacha-prize-reveal 0.4s ease-out 0.3s both",
          }}
        >
          <div
            className="rounded-full flex items-center justify-center text-[10px] font-black"
            style={{
              width: 36,
              height: 36,
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              color: colors.text,
              boxShadow: `0 0 12px ${colors.glow}88`,
              marginTop: 12,
            }}
          >
            {grade[0]}賞
          </div>
        </div>
      )}

      {/* Hint text */}
      {!opened && (
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap"
          style={{ color: colors.glow, opacity: 0.8 }}
        >
          點擊開啟
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorative light dots along machine edge
// ─────────────────────────────────────────────────────────────────────────────

function MachineLights({ count = 6, glowPhase }: { count?: number; glowPhase: number }) {
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];
  return (
    <div className="flex flex-col gap-2 items-center">
      {Array.from({ length: count }, (_, i) => {
        const phase = glowPhase + (i / count) * Math.PI * 2;
        const brightness = 0.3 + 0.7 * Math.abs(Math.sin(phase));
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
            }}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachineCSS3D({
  resultGrade = "A賞",
  prizeName = "限定公仔",
  onResult,
  onStateChange,
}: GachaMachineCSS3DProps) {
  const grade = (isGrade(resultGrade) ? resultGrade : "A賞") as Grade;
  const colors = GRADE_COLORS[grade];

  const [gameState, setGameState] = useState<GachaGameState>("IDLE");
  const [handleRotating, setHandleRotating] = useState(false);
  const [showCapsule, setShowCapsule] = useState(false);
  const [capsuleOpened, setCapsuleOpened] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [glowPhase, setGlowPhase] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [handleAngle, setHandleAngle] = useState(0);

  const frameRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  // Dome capsules — decorative, stable across renders
  const domeCapsules: DomeCapsule[] = useMemo(
    () => [
      { x: 18, y: 22, size: 18, top: "#fbbf24", bot: "#f97316", rotation: 30 },
      { x: 54, y: 10, size: 14, top: "#60a5fa", bot: "#2563eb", rotation: -20 },
      { x: 80, y: 30, size: 16, top: "#c084fc", bot: "#7c3aed", rotation: 50 },
      { x: 38, y: 40, size: 12, top: "#34d399", bot: "#059669", rotation: -10 },
      { x: 65, y: 55, size: 14, top: "#f87171", bot: "#dc2626", rotation: 25 },
      { x: 10, y: 55, size: 12, top: "#fde68a", bot: "#d97706", rotation: -40 },
      { x: 84, y: 62, size: 10, top: "#a5f3fc", bot: "#0891b2", rotation: 15 },
      { x: 44, y: 65, size: 16, top: "#fca5a5", bot: "#ef4444", rotation: -30 },
    ],
    [],
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

  // Handle knob rotation
  useEffect(() => {
    if (!handleRotating) return;
    let angle = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      angle = t * 360;
      setHandleAngle(angle);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [handleRotating]);

  const handleTurn = useCallback(() => {
    if (gameState !== "IDLE" || playingRef.current) return;
    playingRef.current = true;

    setGameState("PLAYING");
    onStateChange?.("PLAYING");
    setHandleRotating(true);
    setHandleAngle(0);

    // After rotation completes — drop capsule
    setTimeout(() => {
      setHandleRotating(false);
      setHandleAngle(0);
    }, 950);

    setTimeout(() => {
      setShowCapsule(true);
    }, 1100);
  }, [gameState, onStateChange]);

  const handleCapsuleClick = useCallback(() => {
    if (capsuleOpened || gameState !== "PLAYING") return;
    setCapsuleOpened(true);

    setTimeout(() => {
      setGameState("RESULT");
      onStateChange?.("RESULT");
      setShowResult(true);
      setShowConfetti(true);
      setShaking(true);
      onResult?.(grade);
      setTimeout(() => setShaking(false), 600);
    }, 600);
  }, [capsuleOpened, gameState, grade, onResult, onStateChange]);

  const handleReset = useCallback(() => {
    playingRef.current = false;
    setGameState("IDLE");
    onStateChange?.("IDLE");
    setHandleRotating(false);
    setHandleAngle(0);
    setShowCapsule(false);
    setCapsuleOpened(false);
    setShowResult(false);
    setShowConfetti(false);
    setShaking(false);
  }, [onStateChange]);

  const isIdle = gameState === "IDLE";
  const domeGlowIntensity = 0.5 + 0.5 * Math.sin(glowPhase * 0.7);

  return (
    <div className="flex flex-col items-center justify-center w-full py-6 px-4 bg-gray-950 min-h-[520px]">
      <style>{`
        @keyframes gacha-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(140px) rotate(720deg); opacity: 0; }
        }
        @keyframes gacha-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-7px) rotate(-1deg); }
          30% { transform: translateX(7px) rotate(1deg); }
          50% { transform: translateX(-4px); }
          70% { transform: translateX(4px); }
          90% { transform: translateX(-2px); }
        }
        @keyframes gacha-drop-bounce {
          0%   { transform: translateY(-80px); opacity: 0; }
          35%  { transform: translateY(0);     opacity: 1; }
          52%  { transform: translateY(-22px); }
          68%  { transform: translateY(0);     }
          80%  { transform: translateY(-8px);  }
          100% { transform: translateY(0);     }
        }
        @keyframes gacha-prize-reveal {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gacha-pop-in {
          0%   { transform: scale(0.5) translateY(8px); opacity: 0; }
          65%  { transform: scale(1.1) translateY(-3px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes gacha-dome-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>

      {/* Outer wrapper (shake) */}
      <div
        className="relative"
        style={{ animation: shaking ? "gacha-shake 0.6s ease-in-out" : "none" }}
      >
        {/* Confetti layer */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
            <Confetti grade={grade} />
          </div>
        )}

        {/* Machine body */}
        <div
          className="relative rounded-3xl"
          style={{
            width: 240,
            background: "linear-gradient(180deg, #dc2626 0%, #b91c1c 40%, #991b1b 70%, #7f1d1d 100%)",
            border: "3px solid #ef4444",
            boxShadow:
              "6px 6px 0 #450a0a, 10px 10px 0 #2a0505, 0 20px 60px rgba(0,0,0,0.8), inset 2px 0 0 rgba(255,255,255,0.12), inset -2px 0 0 rgba(0,0,0,0.3)",
            padding: "0 0 16px",
            overflow: "visible",
          }}
        >
          {/* Side light strips */}
          <div className="absolute left-2 top-40 bottom-16" style={{ zIndex: 5 }}>
            <MachineLights count={5} glowPhase={glowPhase} />
          </div>
          <div className="absolute right-2 top-40 bottom-16" style={{ zIndex: 5 }}>
            <MachineLights count={5} glowPhase={glowPhase + Math.PI} />
          </div>

          {/* Title strip at top of body */}
          <div
            className="rounded-t-3xl text-center py-2 mb-1"
            style={{
              background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)",
              borderBottom: "2px solid #f59e0b",
            }}
          >
            <span className="text-red-900 text-sm font-black tracking-widest">扭蛋機</span>
            <span className="text-red-700 text-xs ml-2">GACHA</span>
          </div>

          {/* ── Dome ── */}
          <div className="flex justify-center mt-2 mb-2 px-4">
            <div
              className="relative"
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, rgba(200,230,255,0.08) 40%, rgba(100,150,200,0.05) 100%)`,
                border: `3px solid rgba(200,220,255,0.4)`,
                backdropFilter: "blur(2px)",
                boxShadow: `inset 0 0 30px rgba(0,0,0,0.5), 0 0 ${10 + domeGlowIntensity * 15}px rgba(200,220,255,0.25)`,
                overflow: "hidden",
                animation: "gacha-dome-float 3s ease-in-out infinite",
              }}
            >
              {/* Dome interior background */}
              <div
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse at 50% 60%, #1a2540 0%, #0f172a 100%)",
                }}
              />

              {/* Mini capsules */}
              {domeCapsules.map((cap, i) => (
                <MiniCapsule key={i} cap={cap} />
              ))}

              {/* Dome highlight shine */}
              <div
                className="absolute"
                style={{
                  top: 10,
                  left: 20,
                  width: 60,
                  height: 50,
                  borderRadius: "50%",
                  background: "radial-gradient(ellipse, rgba(255,255,255,0.2) 0%, transparent 70%)",
                  transform: "rotate(-30deg)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* ── Machine mid section (coin + handle) ── */}
          <div
            className="mx-4 rounded-xl px-3 py-2 mb-2"
            style={{
              background: "linear-gradient(180deg, #b91c1c 0%, #7f1d1d 100%)",
              border: "1px solid #ef444455",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
            }}
          >
            {/* Coin slot row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Coin slot */}
                <div
                  className="rounded"
                  style={{
                    width: 28,
                    height: 14,
                    background: "#0f172a",
                    border: "1px solid #374151",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.8)",
                  }}
                />
                <span className="text-red-200 text-[9px] font-mono">投幣口</span>
              </div>

              {/* Coin icon */}
              <div
                className="rounded-full flex items-center justify-center text-[10px] font-black"
                style={{
                  width: 22,
                  height: 22,
                  background: "radial-gradient(circle at 35% 35%, #fbbf24, #d97706)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)",
                  color: "#78350f",
                }}
              >
                ¥
              </div>
            </div>

            {/* Handle assembly */}
            <div className="flex items-center justify-end gap-2">
              <span className="text-red-200 text-[9px] font-mono">轉動把手</span>

              {/* Handle arm + knob */}
              <div className="relative" style={{ width: 72, height: 28 }}>
                {/* Arm — rotates from left origin */}
                <div
                  className="absolute"
                  style={{
                    width: 52,
                    height: 8,
                    background: "linear-gradient(90deg, #6b7280 0%, #374151 100%)",
                    borderRadius: 4,
                    top: "50%",
                    left: 0,
                    transformOrigin: "left center",
                    transform: `translateY(-50%) rotate(${handleRotating ? handleAngle * 0.15 : 0}deg)`,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                    transition: handleRotating ? "none" : "transform 0.3s ease",
                  }}
                />
                {/* Knob */}
                <button
                  onClick={handleTurn}
                  disabled={!isIdle}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    width: 28,
                    height: 28,
                    right: 0,
                    background: isIdle
                      ? "radial-gradient(circle at 35% 35%, #f87171, #991b1b)"
                      : "#374151",
                    boxShadow: isIdle
                      ? "0 3px 8px rgba(0,0,0,0.5), inset 0 1px 3px rgba(255,255,255,0.25)"
                      : "none",
                    border: "none",
                    animation: handleRotating
                      ? `none`
                      : "none",
                    transform: handleRotating
                      ? `translateY(-50%) rotate(${handleAngle}deg)`
                      : "translateY(-50%)",
                    transition: handleRotating ? "none" : "transform 0.3s ease, background 0.2s",
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Chute + capsule delivery area ── */}
          <div className="mx-4">
            {/* Chute opening */}
            <div
              className="rounded-t-lg mx-auto mb-1"
              style={{
                width: 60,
                height: 16,
                background: "#0a0f1a",
                border: "1px solid #1f2937",
                borderBottom: "none",
                boxShadow: "inset 0 4px 8px rgba(0,0,0,0.9)",
              }}
            />

            {/* Capsule tray */}
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                height: 80,
                background: "#0a0f1a",
                border: "2px solid #1f2937",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
                position: "relative",
              }}
            >
              {/* Idle prompt */}
              {!showCapsule && (
                <span className="text-gray-700 text-xs font-mono">capsule tray</span>
              )}

              {/* Delivered capsule */}
              {showCapsule && (
                <DeliveredCapsule
                  grade={grade}
                  visible={showCapsule}
                  opened={capsuleOpened}
                  onClick={handleCapsuleClick}
                />
              )}
            </div>
          </div>
        </div>

        {/* Machine base / stand */}
        <div
          className="mx-auto rounded-b-2xl"
          style={{
            width: 200,
            height: 12,
            background: "linear-gradient(180deg, #b91c1c 0%, #7f1d1d 100%)",
            boxShadow: "4px 4px 0 #450a0a, 0 8px 20px rgba(0,0,0,0.6)",
          }}
        />
        <div
          className="mx-auto rounded-b-xl"
          style={{
            width: 160,
            height: 10,
            background: "#450a0a",
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
          }}
        />

        {/* Result panel — below machine */}
        {showResult && (
          <div
            className="mt-4 rounded-xl text-center py-3 px-4"
            style={{
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              boxShadow: `0 0 20px ${colors.glow}55`,
              animation: "gacha-pop-in 0.4s ease-out",
              minWidth: 200,
            }}
          >
            <div className="text-sm font-black mb-0.5" style={{ color: colors.glow }}>
              扭蛋開封！
            </div>
            <div className="text-xl font-black" style={{ color: colors.text }}>
              {grade}
            </div>
            <div className="text-xs opacity-80 mt-0.5" style={{ color: colors.text }}>
              {prizeName}
            </div>
          </div>
        )}
      </div>

      {/* Controls below */}
      <div className="mt-4 flex items-center gap-3">
        {gameState === "RESULT" && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            ↺ 重置
          </button>
        )}
        {gameState === "PLAYING" && !showCapsule && (
          <span className="text-red-400 text-xs font-mono animate-pulse">轉動中...</span>
        )}
        {gameState === "PLAYING" && showCapsule && !capsuleOpened && (
          <span className="text-amber-400 text-xs font-mono animate-pulse">點擊扭蛋開啟！</span>
        )}

        <div
          className="px-3 py-1 rounded-full text-xs font-mono"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid #7f1d1d",
            color: "#6b7280",
          }}
        >
          狀態: <span className="text-red-300">{gameState}</span>
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
