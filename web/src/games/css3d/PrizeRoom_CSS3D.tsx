"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NPC {
  id: string;
  nickname: string;
  emoji: string;
  color: string;
  x: number;
  z: number;
  bobPhase: number;
  state: "IDLE" | "QUEUING" | "DRAWING" | "CELEBRATING";
  bubble: string | null;
  bubbleExpiry: number;
}

export interface PrizeRoomCSS3DProps {
  npcCount?: number;
  onStateChange?: (info: {
    yourPos: { x: number; z: number };
    queue: string[];
    activeDrawer: string | null;
  }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NPC_NAMES = ["小明", "小花", "阿強", "美玲", "大衛", "雅婷", "建國", "淑芬"];
const NPC_EMOJIS = ["🧑", "👧", "👦", "👩", "🧔", "👱", "🧒", "👴"];
const NPC_COLORS = ["#6366f1", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#f43f5e", "#a855f7"];
const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;

const GRADE_COLORS: Record<string, { bg: string; glow: string; text: string }> = {
  "A賞": { bg: "#92400e", glow: "#f59e0b", text: "#fde68a" },
  "B賞": { bg: "#1e3a8a", glow: "#3b82f6", text: "#bae6fd" },
  "C賞": { bg: "#064e3b", glow: "#10b981", text: "#a7f3d0" },
  "D賞": { bg: "#4c1d95", glow: "#a855f7", text: "#ddd6fe" },
};

const SHELF_PRIZES = [
  { grade: "A賞", emoji: "🏆", label: "金獎公仔" },
  { grade: "B賞", emoji: "💎", label: "藍寶石" },
  { grade: "C賞", emoji: "🎖️", label: "勳章組" },
  { grade: "D賞", emoji: "🎀", label: "緞帶禮" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomNPCBubble(): string {
  const bubbles = ["哇！", "好期待！", "輪到我了嗎？", "抽到好獎！", "再來一次！", "太棒了！", "耶！"];
  return bubbles[Math.floor(Math.random() * bubbles.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Face({
  style,
  className = "",
  children,
}: {
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`absolute ${className}`} style={{ backfaceVisibility: "hidden", ...style }}>
      {children}
    </div>
  );
}

interface Box3DProps {
  width: number;
  height: number;
  depth: number;
  colorTop?: string;
  colorFront?: string;
  colorSide?: string;
  colorBack?: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

function Box3D({
  width,
  height,
  depth,
  colorTop = "#92400e",
  colorFront = "#b45309",
  colorSide = "#78350f",
  colorBack = "#78350f",
  style,
  className = "",
  children,
  onClick,
}: Box3DProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width,
        height,
        transformStyle: "preserve-3d",
        ...style,
      }}
      onClick={onClick}
    >
      {/* Front face */}
      <Face
        style={{
          width,
          height,
          background: colorFront,
          transform: `translateZ(${depth / 2}px)`,
        }}
      >
        {children}
      </Face>
      {/* Back face */}
      <Face
        style={{
          width,
          height,
          background: colorBack,
          transform: `rotateY(180deg) translateZ(${depth / 2}px)`,
        }}
      />
      {/* Left face */}
      <Face
        style={{
          width: depth,
          height,
          background: colorSide,
          transform: `rotateY(-90deg) translateZ(${depth / 2}px)`,
          left: 0,
          transformOrigin: "left center",
        }}
      />
      {/* Right face */}
      <Face
        style={{
          width: depth,
          height,
          background: colorSide,
          transform: `rotateY(90deg) translateZ(${width - depth / 2}px)`,
          left: 0,
          transformOrigin: "left center",
        }}
      />
      {/* Top face */}
      <Face
        style={{
          width,
          height: depth,
          background: colorTop,
          transform: `rotateX(90deg) translateZ(${depth / 2}px)`,
          top: 0,
          transformOrigin: "top center",
        }}
      />
      {/* Bottom face */}
      <Face
        style={{
          width,
          height: depth,
          background: colorSide,
          transform: `rotateX(-90deg) translateZ(${height - depth / 2}px)`,
          top: 0,
          transformOrigin: "top center",
        }}
      />
    </div>
  );
}

function PrizeBox({ grade, emoji, label, glowPhase }: {
  grade: string;
  emoji: string;
  label: string;
  glowPhase: number;
}) {
  const colors = GRADE_COLORS[grade] ?? { bg: "#374151", glow: "#6b7280", text: "#d1d5db" };
  const glowIntensity = 0.5 + 0.5 * Math.sin(glowPhase);
  const glowPx = 4 + glowIntensity * 8;

  return (
    <Box3D
      width={48}
      height={48}
      depth={48}
      colorFront={colors.bg}
      colorTop={colors.bg}
      colorSide={colors.bg}
      colorBack={colors.bg}
      style={{
        cursor: "pointer",
        transition: "transform 0.2s",
      }}
      className="hover:scale-110"
    >
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded"
        style={{
          boxShadow: `0 0 ${glowPx}px ${glowPx / 2}px ${colors.glow}88`,
          border: `1px solid ${colors.glow}66`,
        }}
      >
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span className="text-[8px] font-bold leading-none" style={{ color: colors.text }}>{grade}</span>
        <span className="text-[7px] leading-none opacity-80" style={{ color: colors.text }}>{label}</span>
      </div>
    </Box3D>
  );
}

function CharacterBadge({
  npc,
  bobOffset,
  isPlayer = false,
  onClick,
}: {
  npc: NPC;
  bobOffset: number;
  isPlayer?: boolean;
  onClick?: () => void;
}) {
  const stateColor = (() => {
    switch (npc.state) {
      case "DRAWING": return "#ec4899";
      case "QUEUING": return "#f59e0b";
      case "CELEBRATING": return "#22c55e";
      default: return isPlayer ? "#fbbf24" : npc.color;
    }
  })();

  return (
    <div
      className="absolute flex flex-col items-center gap-0.5 cursor-pointer select-none"
      style={{
        /* Position-only transform transitions smoothly when x/z changes */
        transform: `translate3d(${npc.x}px, 0px, ${npc.z}px)`,
        transition: "transform 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
      onClick={onClick}
    >
    {/* Inner wrapper carries only the bob offset — no transition so it's instant each frame */}
    <div style={{ transform: `translateY(${bobOffset}px)` }}>
      {/* Speech bubble */}
      {npc.bubble && (
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 8,
            padding: "3px 8px",
            fontSize: 11,
            color: "#1f2937",
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 10,
          }}
        >
          {npc.bubble}
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid rgba(255,255,255,0.92)",
            }}
          />
        </div>
      )}

      {/* Character body */}
      <div
        className="flex flex-col items-center gap-0.5 transition-transform duration-150 hover:scale-110"
        style={{
          filter: `drop-shadow(0 0 6px ${stateColor}88)`,
        }}
      >
        {/* Emoji */}
        <span style={{ fontSize: 28, lineHeight: 1 }}>{npc.emoji}</span>
        {/* Name badge */}
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            background: stateColor + "22",
            border: `1px solid ${stateColor}88`,
            color: stateColor,
            backdropFilter: "blur(4px)",
          }}
        >
          {isPlayer ? "你" : npc.nickname}
        </div>
        {/* State indicator dot */}
        {npc.state !== "IDLE" && (
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: stateColor }}
          />
        )}
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoomCSS3D({ npcCount = 3, onStateChange }: PrizeRoomCSS3DProps) {
  const [npcs, setNpcs] = useState<NPC[]>(() =>
    Array.from({ length: Math.min(npcCount, NPC_NAMES.length) }, (_, i) => ({
      id: `npc-${i}`,
      nickname: NPC_NAMES[i % NPC_NAMES.length],
      emoji: NPC_EMOJIS[i % NPC_EMOJIS.length],
      color: NPC_COLORS[i % NPC_COLORS.length],
      x: randomBetween(-120, 120),
      z: randomBetween(-60, 60),
      bobPhase: Math.random() * Math.PI * 2,
      state: "IDLE" as const,
      bubble: null,
      bubbleExpiry: 0,
    }))
  );

  const playerPos = useMemo(() => ({ x: 0, z: 80 }), []);
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  // glowPhase + bobPhases both live in state, updated from rAF (not from effect body)
  const [glowPhase, setGlowPhase] = useState(0);
  const [bobPhases, setBobPhases] = useState<Record<string, number>>({});
  const [drawFlash, setDrawFlash] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glowRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  // Seed bob phases for NPCs — written to a ref, read back in the rAF tick
  const seedBobRef = useRef<Record<string, number>>({});

  // Keep seed ref in sync with npc list (effect with no setState — just mutates a ref)
  useEffect(() => {
    npcs.forEach((npc) => {
      if (!(npc.id in seedBobRef.current)) {
        seedBobRef.current[npc.id] = npc.bobPhase;
      }
    });
  }, [npcs]);

  // Animation loop — setState called from rAF callback, not from effect body
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      glowRef.current += 0.03;
      const gp = glowRef.current;
      setGlowPhase(gp);
      setBobPhases((prev) => {
        const next: Record<string, number> = {};
        // Include any newly seeded NPCs
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(seedBobRef.current)]);
        for (const key of allKeys) {
          next[key] = ((prev[key] ?? seedBobRef.current[key] ?? 0) + 0.06);
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Periodic NPC behaviours
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setNpcs((prev) => {
        const now = Date.now();
        return prev.map((npc) => {
          // Expire bubble
          if (npc.bubble && now > npc.bubbleExpiry) {
            return { ...npc, bubble: null };
          }
          return npc;
        });
      });

      // Occasionally trigger NPC draw
      if (!activeDrawer && npcs.length > 0 && Math.random() < 0.15) {
        const idleNpcs = npcs.filter((n) => n.state === "IDLE");
        if (idleNpcs.length > 0) {
          const chosen = idleNpcs[Math.floor(Math.random() * idleNpcs.length)];
          setActiveDrawer(chosen.id);
          setQueueIds((q) => [...q, chosen.id]);
          setNpcs((prev) =>
            prev.map((n) =>
              n.id === chosen.id ? { ...n, state: "QUEUING", x: randomBetween(-30, 30), z: -40 } : n
            )
          );

          // After 2s, draw
          setTimeout(() => {
            const grade = GRADES[Math.floor(Math.random() * GRADES.length)];
            setLastResult(grade);
            setDrawFlash(true);
            setNpcs((prev) =>
              prev.map((n) =>
                n.id === chosen.id
                  ? {
                      ...n,
                      state: "DRAWING",
                      bubble: `抽到 ${grade}！`,
                      bubbleExpiry: Date.now() + 3000,
                    }
                  : n
              )
            );
            setTimeout(() => setDrawFlash(false), 600);

            // After celebrate
            setTimeout(() => {
              setNpcs((prev) =>
                prev.map((n) =>
                  n.id === chosen.id
                    ? {
                        ...n,
                        state: "CELEBRATING",
                        bubble: randomNPCBubble(),
                        bubbleExpiry: Date.now() + 2500,
                        x: randomBetween(-120, 120),
                        z: randomBetween(-20, 80),
                      }
                    : n
                )
              );
              setActiveDrawer(null);
              setQueueIds((q) => q.filter((id) => id !== chosen.id));

              setTimeout(() => {
                setNpcs((prev) =>
                  prev.map((n) =>
                    n.id === chosen.id ? { ...n, state: "IDLE" } : n
                  )
                );
              }, 3000);
            }, 2000);
          }, 2000);
        }
      }

      // Occasionally wander
      setNpcs((prev) =>
        prev.map((npc) => {
          if (npc.state !== "IDLE" || Math.random() > 0.08) return npc;
          return {
            ...npc,
            x: randomBetween(-140, 140),
            z: randomBetween(-20, 100),
          };
        })
      );

      // Report state
      onStateChange?.({
        yourPos: playerPos,
        queue: queueIds,
        activeDrawer,
      });
    }, 1500);

    return () => {
      if (tickRef.current !== null) clearInterval(tickRef.current);
    };
  }, [npcs, activeDrawer, queueIds, playerPos, onStateChange]);

  const handleCounterClick = useCallback(() => {
    const grade = GRADES[Math.floor(Math.random() * GRADES.length)];
    setLastResult(grade);
    setDrawFlash(true);
    setTimeout(() => setDrawFlash(false), 600);
  }, []);

  const handleNPCClick = useCallback((id: string) => {
    setNpcs((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, bubble: randomNPCBubble(), bubbleExpiry: Date.now() + 2500 }
          : n
      )
    );
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-gray-950 rounded-xl select-none" style={{ height: 500 }}>
      {/* CSS keyframe styles injected inline */}
      <style>{`
        @keyframes css3d-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes css3d-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes css3d-draw-flash {
          0% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        @keyframes css3d-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
        @keyframes css3d-btn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.5), 0 0 10px rgba(251,191,36,0.3); }
          50% { box-shadow: 0 0 0 6px rgba(251,191,36,0), 0 0 22px rgba(251,191,36,0.6); }
        }
        .css3d-pulse-btn { animation: css3d-btn-pulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Scene container with perspective */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px", perspectiveOrigin: "50% 40%" }}
      >
        <div
          className="relative"
          style={{
            width: 640,
            height: 400,
            transformStyle: "preserve-3d",
            transform: "rotateX(22deg) rotateY(-8deg) translateZ(-80px) translateY(-20px)",
          }}
        >
          {/* ── Floor ─────────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{
              width: 640,
              height: 640,
              left: 0,
              top: 0,
              transform: "rotateX(90deg) translateZ(-0px)",
              transformOrigin: "top center",
              background:
                "repeating-conic-gradient(#6b4c1e 0% 25%, #7c5c2a 0% 50%) 0 0 / 40px 40px",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
            }}
          />

          {/* ── Back wall ─────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{
              width: 640,
              height: 340,
              left: 0,
              top: 0,
              transform: "translateZ(-320px)",
              background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 60%, #fbbf24 100%)",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Wall decorations */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <div className="text-2xl">🎪</div>
              <div className="text-lg font-black text-amber-900 tracking-widest">抽獎屋</div>
              <div className="text-2xl">🎪</div>
            </div>
            {/* Wall banner */}
            <div
              className="absolute top-10 left-8 right-8 h-8 flex items-center justify-center"
              style={{
                background: "linear-gradient(90deg, #dc2626, #7c3aed, #0284c7, #059669, #dc2626)",
                borderRadius: 4,
              }}
            >
              <span className="text-white text-xs font-bold tracking-wider">✦ 歡迎來到 PrizeDraw ✦</span>
            </div>

            {/* Wall shelves row */}
            <div className="absolute bottom-8 left-6 right-6 flex justify-around items-end">
              {SHELF_PRIZES.map((p) => {
                const colors = GRADE_COLORS[p.grade] ?? { glow: "#6b7280" };
                const gInt = 0.5 + 0.5 * Math.sin(glowPhase + SHELF_PRIZES.indexOf(p));
                return (
                  <div key={p.grade} className="flex flex-col items-center gap-1">
                    <div
                      className="w-12 h-12 rounded-lg flex flex-col items-center justify-center"
                      style={{
                        background: "rgba(0,0,0,0.15)",
                        border: `2px solid ${colors.glow}`,
                        boxShadow: `0 0 ${6 + gInt * 10}px ${colors.glow}`,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{p.emoji}</span>
                    </div>
                    <div className="text-[9px] font-bold text-amber-900">{p.grade}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Left wall ─────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{
              width: 320,
              height: 340,
              left: 0,
              top: 0,
              transformOrigin: "left center",
              transform: "rotateY(90deg) translateZ(0px)",
              background: "linear-gradient(270deg, #fef3c7 0%, #fde68a 100%)",
              boxShadow: "inset -20px 0 40px rgba(0,0,0,0.1)",
            }}
          >
            <div className="absolute top-8 left-4 right-4 space-y-3">
              {/* Poster 1 */}
              <div
                className="rounded-lg p-2 text-center"
                style={{ background: "rgba(217,119,6,0.2)", border: "2px solid #f59e0b" }}
              >
                <div className="text-xs font-bold text-amber-800">本期特選</div>
                <div className="text-lg">🎁</div>
                <div className="text-[9px] text-amber-700">限定公仔</div>
              </div>
              {/* Poster 2 */}
              <div
                className="rounded-lg p-2 text-center"
                style={{ background: "rgba(124,58,237,0.1)", border: "2px solid #a855f7" }}
              >
                <div className="text-xs font-bold text-purple-800">熱銷排行</div>
                <div className="text-lg">⭐</div>
                <div className="text-[9px] text-purple-700">Top 1</div>
              </div>
            </div>
          </div>

          {/* ── Right wall ────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{
              width: 320,
              height: 340,
              left: 640,
              top: 0,
              transformOrigin: "left center",
              transform: "rotateY(90deg) translateZ(0px)",
              background: "linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)",
              boxShadow: "inset 20px 0 40px rgba(0,0,0,0.1)",
            }}
          >
            <div className="absolute top-8 right-4 left-4 space-y-3">
              <div
                className="rounded-lg p-2 text-center"
                style={{ background: "rgba(5,150,105,0.1)", border: "2px solid #10b981" }}
              >
                <div className="text-xs font-bold text-emerald-800">今日特賣</div>
                <div className="text-lg">💝</div>
                <div className="text-[9px] text-emerald-700">C賞特惠</div>
              </div>
              <div
                className="rounded-lg p-2 text-center"
                style={{ background: "rgba(2,132,199,0.1)", border: "2px solid #3b82f6" }}
              >
                <div className="text-xs font-bold text-blue-800">新品上市</div>
                <div className="text-lg">🆕</div>
                <div className="text-[9px] text-blue-700">B賞限定</div>
              </div>
            </div>
          </div>

          {/* ── Counter / 櫃台 ─────────────────────────────────────────────── */}
          <Box3D
            width={200}
            height={70}
            depth={60}
            colorFront="#b45309"
            colorTop="#d97706"
            colorSide="#92400e"
            colorBack="#78350f"
            className="css3d-pulse-btn"
            style={{
              position: "absolute",
              left: 220,
              top: 200,
              transform: "translateZ(-180px)",
              cursor: "pointer",
            }}
            onClick={handleCounterClick}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 rounded">
              <span className="text-lg">🎰</span>
              <span className="text-[10px] font-bold text-amber-200">點擊抽獎</span>
            </div>
          </Box3D>

          {/* ── Display shelves with prize boxes ──────────────────────────── */}
          {/* Left shelf */}
          <Box3D
            width={160}
            height={16}
            depth={40}
            colorFront="#a16207"
            colorTop="#ca8a04"
            colorSide="#854d0e"
            style={{
              position: "absolute",
              left: 30,
              top: 110,
              transform: "translateZ(-310px)",
            }}
          />
          <div
            className="absolute flex gap-2 items-end"
            style={{
              left: 30,
              top: 62,
              transform: "translateZ(-312px)",
            }}
          >
            {SHELF_PRIZES.slice(0, 2).map((p, i) => (
              <PrizeBox
                key={p.grade}
                grade={p.grade}
                emoji={p.emoji}
                label={p.label}
                glowPhase={glowPhase + i * 1.5}
              />
            ))}
          </div>

          {/* Right shelf */}
          <Box3D
            width={160}
            height={16}
            depth={40}
            colorFront="#a16207"
            colorTop="#ca8a04"
            colorSide="#854d0e"
            style={{
              position: "absolute",
              left: 450,
              top: 110,
              transform: "translateZ(-310px)",
            }}
          />
          <div
            className="absolute flex gap-2 items-end"
            style={{
              left: 450,
              top: 62,
              transform: "translateZ(-312px)",
            }}
          >
            {SHELF_PRIZES.slice(2, 4).map((p, i) => (
              <PrizeBox
                key={p.grade}
                grade={p.grade}
                emoji={p.emoji}
                label={p.label}
                glowPhase={glowPhase + i * 1.5 + 2}
              />
            ))}
          </div>

          {/* ── Queue carpet ──────────────────────────────────────────────── */}
          <div
            className="absolute rounded"
            style={{
              width: 100,
              height: 80,
              left: 270,
              top: 260,
              transform: "rotateX(90deg) translateZ(-4px)",
              transformOrigin: "top center",
              background: "rgba(124,58,237,0.35)",
              border: "1px dashed #a855f7",
              boxShadow: "0 0 10px #a855f766",
            }}
          />

          {/* ── NPCs ──────────────────────────────────────────────────────── */}
          {npcs.map((npc) => {
            const bobPhase = bobPhases[npc.id] ?? npc.bobPhase;
            const bobOffset = Math.sin(bobPhase) * 3;
            return (
              <CharacterBadge
                key={npc.id}
                npc={npc}
                bobOffset={bobOffset}
                onClick={() => handleNPCClick(npc.id)}
              />
            );
          })}

          {/* ── Player ────────────────────────────────────────────────────── */}
          <CharacterBadge
            npc={{
              id: "player",
              nickname: "你",
              emoji: "🧑‍💼",
              color: "#fbbf24",
              x: playerPos.x,
              z: playerPos.z,
              bobPhase: 0,
              state: "IDLE",
              bubble: null,
              bubbleExpiry: 0,
            }}
            bobOffset={Math.sin(glowPhase * 0.8) * 3}
            isPlayer
          />

          {/* ── Draw flash effect ─────────────────────────────────────────── */}
          {drawFlash && (
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              style={{
                zIndex: 50,
                animation: "css3d-draw-flash 0.6s ease-out forwards",
              }}
            >
              <div
                className="text-4xl font-black"
                style={{
                  color: "#fde68a",
                  textShadow: "0 0 20px #f59e0b, 0 0 40px #f59e0b",
                }}
              >
                {lastResult ?? "✨"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── HUD overlay ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-end justify-between pointer-events-none">
        {/* Status badge */}
        <div className="flex flex-col gap-1">
          {/* Spectator count */}
          <div
            className="px-2 py-1 rounded-lg text-[10px] font-bold"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#e5e7eb",
              backdropFilter: "blur(4px)",
            }}
          >
            👀 {npcs.length + 1} 人觀看中
          </div>
          {activeDrawer && (
            <div
              className="px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: "rgba(236,72,153,0.2)",
                border: "1px solid #ec4899",
                color: "#f9a8d4",
                backdropFilter: "blur(4px)",
              }}
            >
              🎰 {npcs.find((n) => n.id === activeDrawer)?.nickname ?? "??"} 正在抽獎...
            </div>
          )}
          {lastResult && (
            <div
              className="px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: "rgba(245,158,11,0.2)",
                border: "1px solid #f59e0b",
                color: "#fde68a",
                backdropFilter: "blur(4px)",
              }}
            >
              上次結果：{lastResult}
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="flex gap-2 text-[9px]"
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "4px 8px",
          }}
        >
          {[
            { color: "#ec4899", label: "抽獎中" },
            { color: "#f59e0b", label: "排隊中" },
            { color: "#22c55e", label: "慶祝中" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
              <span className="text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-mono"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#6b7280",
        }}
      >
        CSS 3D Transform
      </div>
    </div>
  );
}
