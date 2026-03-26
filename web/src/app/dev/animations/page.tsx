"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { AnimationMode } from "@/animations/AnimatedReveal";
import { TearReveal } from "@/animations/TearReveal";
import { ScratchReveal } from "@/animations/ScratchReveal";
import { FlipReveal } from "@/animations/FlipReveal";
import { InstantReveal } from "@/animations/InstantReveal";
import { SpectatorAnimation } from "@/components/SpectatorAnimation";
import { SlotMachine } from "@/games/SlotMachine";
import type { GameState as SlotGameState } from "@/games/SlotMachine";
import { ClawMachine } from "@/games/ClawMachine";
import type { ClawGameState } from "@/games/ClawMachine";
import { GachaMachine } from "@/games/GachaMachine";
import type { GachaGameState } from "@/games/GachaMachine";
import { IsometricRoom } from "@/games/IsometricRoom";

// ─────────────────────────────────────────────────────────────────────────────
// 3D components — dynamically imported (Three.js is SSR-incompatible)
// ─────────────────────────────────────────────────────────────────────────────

const SlotMachine3D = dynamic(
  () => import("@/games/3d/SlotMachine3D").then((m) => ({ default: m.SlotMachine3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="拉霸機 3D" /> },
);

const ClawMachine3D = dynamic(
  () => import("@/games/3d/ClawMachine3D").then((m) => ({ default: m.ClawMachine3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="夾娃娃 3D" /> },
);

const GachaMachine3D = dynamic(
  () => import("@/games/3d/GachaMachine3D").then((m) => ({ default: m.GachaMachine3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="扭蛋機 3D" /> },
);

const PrizeDrawRoom3D = dynamic(
  () => import("@/games/3d/PrizeDrawRoom3D").then((m) => ({ default: m.PrizeDrawRoom3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="3D 房間" height={560} /> },
);

const PrizeRoomCSS3D = dynamic(
  () => import("@/games/css3d/PrizeRoom_CSS3D").then((m) => ({ default: m.PrizeRoomCSS3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="CSS 3D 房間" height={500} /> },
);

const SlotMachineCSS3D = dynamic(
  () => import("@/games/css3d/SlotMachine_CSS3D").then((m) => ({ default: m.SlotMachineCSS3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="CSS 3D 拉霸機" /> },
);

const ClawMachineCSS3D = dynamic(
  () => import("@/games/css3d/ClawMachine_CSS3D").then((m) => ({ default: m.ClawMachineCSS3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="CSS 3D 夾娃娃機" /> },
);

const GachaMachineCSS3D = dynamic(
  () => import("@/games/css3d/GachaMachine_CSS3D").then((m) => ({ default: m.GachaMachineCSS3D })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="CSS 3D 扭蛋機" /> },
);

const SlotMachinePixel = dynamic(
  () => import("@/games/pixel/SlotMachine_Pixel").then((m) => ({ default: m.SlotMachine_Pixel })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Pixel 拉霸機" /> },
);

const PrizeRoomPixel = dynamic(
  () => import("@/games/pixel/PrizeRoom_Pixel").then((m) => ({ default: m.PrizeRoom_Pixel })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Pixel 房間" height={500} /> },
);

const ClawMachinePixel = dynamic(
  () => import("@/games/pixel/ClawMachine_Pixel").then((m) => ({ default: m.ClawMachinePixel })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Pixel 夾娃娃機" /> },
);

const GachaMachinePixel = dynamic(
  () => import("@/games/pixel/GachaMachine_Pixel").then((m) => ({ default: m.GachaMachinePixel })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Pixel 扭蛋機" /> },
);

const SlotMachineNeon = dynamic(
  () => import("@/games/neon/SlotMachine_Neon").then((m) => ({ default: m.SlotMachine_Neon })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Neon 拉霸機" /> },
);

const PrizeRoomNeon = dynamic(
  () => import("@/games/neon/PrizeRoom_Neon").then((m) => ({ default: m.PrizeRoom_Neon })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Neon 房間" height={500} /> },
);

const ClawMachineNeon = dynamic(
  () => import("@/games/neon/ClawMachine_Neon").then((m) => ({ default: m.ClawMachine_Neon })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Neon 夾娃娃機" /> },
);

const GachaMachineNeon = dynamic(
  () => import("@/games/neon/GachaMachine_Neon").then((m) => ({ default: m.GachaMachine_Neon })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Neon 扭蛋機" /> },
);

const SlotMachineSketch = dynamic(
  () => import("@/games/sketch/SlotMachine_Sketch").then((m) => ({ default: m.SlotMachine_Sketch })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Sketch 拉霸機" /> },
);

const PrizeRoomSketch = dynamic(
  () => import("@/games/sketch/PrizeRoom_Sketch").then((m) => ({ default: m.PrizeRoom_Sketch })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Sketch 房間" height={500} /> },
);

const ClawMachineSketch = dynamic(
  () => import("@/games/sketch/ClawMachine_Sketch").then((m) => ({ default: m.ClawMachine_Sketch })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Sketch 夾娃娃機" /> },
);

const GachaMachineSketch = dynamic(
  () => import("@/games/sketch/GachaMachine_Sketch").then((m) => ({ default: m.GachaMachine_Sketch })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Sketch 扭蛋機" /> },
);

const SlotMachineFlat = dynamic(
  () => import("@/games/flat/SlotMachine_Flat").then((m) => ({ default: m.SlotMachine_Flat })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Flat 拉霸機" /> },
);

const PrizeRoomFlat = dynamic(
  () => import("@/games/flat/PrizeRoom_Flat").then((m) => ({ default: m.PrizeRoom_Flat })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Flat 房間" height={500} /> },
);

const ClawMachineFlat = dynamic(
  () => import("@/games/flat/ClawMachine_Flat").then((m) => ({ default: m.ClawMachine_Flat })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Flat 夾娃娃機" /> },
);

const GachaMachineFlat = dynamic(
  () => import("@/games/flat/GachaMachine_Flat").then((m) => ({ default: m.GachaMachine_Flat })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Flat 扭蛋機" /> },
);

const SlotMachineAnime = dynamic(
  () => import("@/games/anime/SlotMachine_Anime").then((m) => ({ default: m.SlotMachine_Anime })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Anime 拉霸機" /> },
);

const PrizeRoomAnime = dynamic(
  () => import("@/games/anime/PrizeRoom_Anime").then((m) => ({ default: m.PrizeRoom_Anime })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Anime 房間" height={500} /> },
);

const ClawMachineAnime = dynamic(
  () => import("@/games/anime/ClawMachine_Anime").then((m) => ({ default: m.ClawMachine_Anime })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Anime 夾娃娃機" /> },
);

const GachaMachineAnime = dynamic(
  () => import("@/games/anime/GachaMachine_Anime").then((m) => ({ default: m.GachaMachine_Anime })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Anime 扭蛋機" /> },
);

function ThreeDLoadingPlaceholder({ label, height = 480 }: { label: string; height?: number }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 gap-3"
      style={{ height }}
    >
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">載入 {label}...</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type PhaseTab = "phase1" | "phase2" | "phase3";
type MiniGameId = "slot" | "claw" | "gacha";
type StyleMode = "2d" | "css3d" | "webgl" | "pixel" | "neon" | "sketch" | "flat" | "anime";

const PHASE_TABS: { id: PhaseTab; label: string; icon: string }[] = [
  { id: "phase1", label: "動畫效果", icon: "🎬" },
  { id: "phase2", label: "迷你遊戲", icon: "🕹️" },
  { id: "phase3", label: "2.5D 房間", icon: "🏠" },
];

const MINI_GAMES: { id: MiniGameId; label: string; desc: string }[] = [
  { id: "slot",  label: "拉霸機", desc: "Slot Machine" },
  { id: "claw",  label: "夾娃娃", desc: "Claw Machine" },
  { id: "gacha", label: "扭蛋機", desc: "Gacha Machine" },
];

const MODES: { id: AnimationMode; label: string; hint: string }[] = [
  { id: "TEAR", label: "撕籤", hint: "拖拉紙張以撕開" },
  { id: "SCRATCH", label: "刮刮樂", hint: "用滑鼠刮開塗層" },
  { id: "FLIP", label: "翻牌", hint: "點擊卡片翻面" },
  { id: "INSTANT", label: "快速", hint: "立即揭曉結果" },
];

const GRADES = ["A賞", "B賞", "C賞", "D賞", "最後賞"];
const MINI_GAME_GRADES = ["A賞", "B賞", "C賞", "D賞"];

const GRADE_COLOURS: Record<string, string> = {
  A賞: "from-amber-400 to-yellow-300",
  B賞: "from-blue-500 to-blue-400",
  C賞: "from-emerald-500 to-emerald-400",
  D賞: "from-purple-500 to-purple-400",
  最後賞: "from-rose-500 to-pink-400",
};

// Canonical hex accent per grade — single source of truth for the dev page UI
const GRADE_HEX: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
  "最後賞": "#f43f5e",
};

function gradeAccentHex(g: string): string {
  return GRADE_HEX[g] ?? "#6366f1";
}

const DEFAULT_PRIZE_NAME = "限定公仔";
const DEFAULT_IMAGE_URL = "";

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder image component
// ─────────────────────────────────────────────────────────────────────────────

function PlaceholderImage({
  grade,
  prizeName,
  className = "",
}: {
  grade: string;
  prizeName: string;
  className?: string;
}) {
  const gradient = GRADE_COLOURS[grade] ?? "from-gray-400 to-gray-300";
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br ${gradient} select-none ${className}`}
    >
      <span className="text-5xl drop-shadow-md">🎁</span>
      <span className="text-white font-black text-xl drop-shadow-md tracking-wide">{grade}</span>
      <span
        className="text-white/80 font-semibold text-sm text-center px-4 leading-tight drop-shadow"
        style={{ maxWidth: 180 }}
      >
        {prizeName}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event log reducer
// ─────────────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  ts: number;
  event: string;
}

let _idCounter = 0;

function logReducer(
  state: LogEntry[],
  action: { type: "push"; event: string } | { type: "clear" },
): LogEntry[] {
  if (action.type === "clear") return [];
  const entry: LogEntry = {
    id: ++_idCounter,
    ts: Date.now(),
    event: action.event,
  };
  return [entry, ...state].slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AnimationsShowcasePage() {
  // ── Phase tab ──────────────────────────────────────────────────────────────
  const [activePhase, setActivePhase] = useState<PhaseTab>("phase1");

  // ── Phase 1 state ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AnimationMode>("TEAR");
  const [grade, setGrade] = useState("A賞");
  const [prizeName, setPrizeName] = useState(DEFAULT_PRIZE_NAME);
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE_URL);
  const [speedMultiplier, setSpeedMultiplier] = useState<0.5 | 1 | 2>(1);
  const [progress, setProgress] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [logs, dispatchLog] = useReducer(logReducer, []);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // ── Phase 2 state ──────────────────────────────────────────────────────────
  const [activeMiniGame, setActiveMiniGame] = useState<MiniGameId>("slot");
  const [miniGrade, setMiniGrade] = useState("A賞");
  const [miniPrizeName, setMiniPrizeName] = useState("限定公仔");
  const [miniGameKey, setMiniGameKey] = useState(0);
  const [miniGameState, setMiniGameState] = useState<SlotGameState | ClawGameState | GachaGameState>("IDLE");
  const [miniGameResult, setMiniGameResult] = useState<string | null>(null);
  const [miniGameLogs, dispatchMiniLog] = useReducer(logReducer, []);
  const miniLogRef = useRef<HTMLDivElement>(null);

  // ── Style toggle state (2d | css3d | webgl) ───────────────────────────────
  const [miniGameStyle, setMiniGameStyle] = useState<StyleMode>("2d");
  const [roomStyle, setRoomStyle] = useState<StyleMode>("2d");
  // Legacy alias used in arcade cabinet overflow class
  const room3D = roomStyle === "webgl";

  // ── Phase 3 state ──────────────────────────────────────────────────────────
  const [npcCount, setNpcCount] = useState(3);
  const [roomInfo, setRoomInfo] = useState<{
    yourPos: { isoX: number; isoY: number };
    queue: string[];
    activeDrawer: string | null;
  }>({ yourPos: { isoX: 5, isoY: 9 }, queue: [], activeDrawer: null });
  const [room3DInfo, setRoom3DInfo] = useState<{
    yourPos: { x: number; z: number };
    queue: string[];
    activeDrawer: string | null;
  }>({ yourPos: { x: 0, z: 2.5 }, queue: [], activeDrawer: null });

  // ── Derived values ─────────────────────────────────────────────────────────
  const effectiveImageUrl = imageUrl.trim() || null;

  // ── Phase 1 callbacks ──────────────────────────────────────────────────────
  const handleProgress = useCallback((p: number) => {
    setProgress(p);
    const pct = Math.round(p * 100);
    if (pct % 10 === 0 && pct > 0) {
      dispatchLog({ type: "push", event: `DRAW_PROGRESS(${p.toFixed(2)})` });
    }
  }, []);

  const handleRevealed = useCallback(() => {
    setIsRevealed(true);
    setProgress(1);
    setIsPlaying(false);
    dispatchLog({ type: "push", event: "DRAW_REVEALED" });
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying && !isRevealed) return;
    setAnimationKey((k) => k + 1);
    setProgress(0);
    setIsRevealed(false);
    setIsPlaying(true);
    dispatchLog({ type: "push", event: `DRAW_STARTED (mode=${mode})` });
  }, [isPlaying, isRevealed, mode]);

  const handleReset = useCallback(() => {
    setAnimationKey((k) => k + 1);
    setProgress(0);
    setIsRevealed(false);
    setIsPlaying(false);
    dispatchLog({ type: "push", event: "RESET" });
  }, []);

  const handleModeChange = useCallback((newMode: AnimationMode) => {
    setMode(newMode);
    setAnimationKey((k) => k + 1);
    setProgress(0);
    setIsRevealed(false);
    setIsPlaying(false);
    dispatchLog({ type: "push", event: `MODE_CHANGED → ${newMode}` });
  }, []);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = 0;
  }, [logs]);

  useEffect(() => {
    if (miniLogRef.current) miniLogRef.current.scrollTop = 0;
  }, [miniGameLogs]);

  const phaseLabel = (() => {
    if (isRevealed) return "revealed";
    if (!isPlaying) return "idle";
    if (progress === 0) return "ready";
    if (mode === "TEAR") {
      return progress >= 0.7 ? "tearing off" : `dragging (pre-threshold ${(progress * 100).toFixed(0)}%)`;
    }
    if (mode === "SCRATCH") return `scratching (${(progress * 100).toFixed(0)}%)`;
    if (mode === "FLIP") return progress >= 0.5 ? "flipping (back)" : "flipping (front)";
    return "animating";
  })();

  const prizePhotoUrl = effectiveImageUrl ?? makePlaceholderDataUrl(grade, prizeName);

  // ── Phase 2 callbacks ──────────────────────────────────────────────────────
  const handleMiniGameResult = useCallback((g: string) => {
    setMiniGameResult(g);
    dispatchMiniLog({ type: "push", event: `RESULT: ${g}` });
  }, []);

  const handleMiniGameStateChange = useCallback(
    (s: SlotGameState | ClawGameState | GachaGameState) => {
      setMiniGameState(s);
      dispatchMiniLog({ type: "push", event: `STATE → ${s}` });
    },
    [],
  );

  const handleMiniGameReset = useCallback(() => {
    setMiniGameKey((k) => k + 1);
    setMiniGameResult(null);
    setMiniGameState("IDLE");
    dispatchMiniLog({ type: "push", event: "RESET" });
  }, []);

  const handleSwitchMiniGame = useCallback((id: MiniGameId) => {
    setActiveMiniGame(id);
    setMiniGameKey((k) => k + 1);
    setMiniGameResult(null);
    setMiniGameState("IDLE");
    dispatchMiniLog({ type: "push", event: `GAME_CHANGED → ${id}` });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-gray-900 via-purple-950 to-gray-900 border-b border-purple-800/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dev"
                className="text-purple-400 hover:text-purple-200 transition-colors shrink-0"
                aria-label="Back to dev tools"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <span className="text-2xl shrink-0">🎮</span>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-white leading-tight truncate">PrizeDraw 遊戲預覽</h1>
                <p className="text-purple-300 text-xs">Animation &amp; Game Showcase</p>
              </div>
            </div>
            <span className="shrink-0 text-xs px-2 py-1 rounded bg-purple-900/60 border border-purple-700/50 text-purple-300 font-mono">
              /dev/animations
            </span>
          </div>

          {/* Phase tabs — pill style */}
          <div className="flex gap-2 flex-wrap">
            {PHASE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePhase(tab.id)}
                className={[
                  "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                  activePhase === tab.id
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "text-purple-300 hover:text-white hover:bg-white/10",
                ].join(" ")}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 1: Animations
            ════════════════════════════════════════════════════════════════════ */}
        {activePhase === "phase1" && (
          <>
            {/* Mode tabs */}
            <section>
              <SectionLabel>Mode</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModeChange(m.id)}
                    className={[
                      "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border",
                      mode === m.id
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white",
                    ].join(" ")}
                  >
                    {m.label}
                    <span
                      className={[
                        "ml-2 text-xs font-normal",
                        mode === m.id ? "text-indigo-200" : "text-gray-500",
                      ].join(" ")}
                    >
                      {m.id}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {MODES.find((m) => m.id === mode)?.hint}
              </p>
            </section>

            {/* Two-column: animation + controls */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* LEFT: Animation canvas — 60% on desktop */}
              <div className="w-full lg:flex-[3] space-y-4">
                <SectionLabel>Animation Canvas</SectionLabel>
                <div
                  className="mx-auto rounded-2xl overflow-hidden border border-gray-700 bg-gray-800 shadow-2xl relative"
                  style={{ width: 340, height: 480 }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  <div className="absolute inset-0">
                    {isPlaying || isRevealed ? (
                      <AnimationCanvas
                        key={animationKey}
                        mode={mode}
                        prizePhotoUrl={prizePhotoUrl}
                        grade={grade}
                        prizeName={prizeName}
                        onProgress={handleProgress}
                        onRevealed={handleRevealed}
                        speedMultiplier={speedMultiplier}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 relative">
                        <div className="text-gray-600 text-center px-6">
                          <div className="text-4xl mb-3">🎮</div>
                          <p className="text-sm font-medium text-gray-400">
                            按下「開始」預覽{" "}
                            <span className="text-indigo-400 font-bold">
                              {MODES.find((m) => m.id === mode)?.label}
                            </span>{" "}
                            動畫
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Play / Reset buttons */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handlePlay}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    開始
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold text-sm transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    重置
                  </button>
                </div>
              </div>

              {/* RIGHT: Settings panel — 40% on desktop */}
              <div className="w-full lg:flex-[2]">
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 space-y-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    ⚙️ 設定
                  </h3>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">
                    獎品等級
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGrade(g)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={grade === g
                          ? { background: gradeAccentHex(g), color: "#fff", boxShadow: `0 2px 8px ${gradeAccentHex(g)}66` }
                          : { background: "#1f2937", color: "#9ca3af" }
                        }
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">
                    獎品名稱
                  </label>
                  <input
                    type="text"
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors placeholder-gray-600"
                    placeholder={DEFAULT_PRIZE_NAME}
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">
                    圖片網址
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors placeholder-gray-600"
                    placeholder="留空使用預設漸層佔位圖"
                  />
                  {!effectiveImageUrl && (
                    <p className="mt-1 text-xs text-gray-600">
                      Using gradient placeholder based on grade colour.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">
                    動畫速度
                  </label>
                  <div className="flex gap-1.5">
                    {([0.5, 1, 2] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeedMultiplier(s)}
                        className={[
                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          speedMultiplier === s
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600",
                        ].join(" ")}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">
                    獎品圖預覽
                  </label>
                  <div className="rounded-xl overflow-hidden border border-gray-700 shadow-inner" style={{ height: 120 }}>
                    {effectiveImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={effectiveImageUrl}
                        alt="Prize preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <PlaceholderImage grade={grade} prizeName={prizeName} />
                    )}
                  </div>
                </div>
                </div>{/* end settings card */}
              </div>{/* end right column */}
            </div>{/* end two-column flex */}

            {/* Spectator section */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-base">👁</span>
                <SectionLabel className="mb-0">觀戰者視角 — Spectator View</SectionLabel>
              </div>
              <p className="text-xs text-gray-500">
                This is what other players watching the draw would see — a read-only miniature synced to the current progress.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="shrink-0">
                  <SpectatorAnimation
                    animationMode={mode}
                    progress={progress}
                    prizePhotoUrl={effectiveImageUrl ?? undefined}
                    revealed={isRevealed}
                  />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span className="font-mono">{(progress * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-75"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusChip label="Status" value={isRevealed ? "已揭曉" : isPlaying ? "進行中..." : "等待中"} />
                    <StatusChip label="Mode" value={mode} mono />
                    <StatusChip label="Phase" value={phaseLabel} mono highlight={isRevealed} />
                  </div>
                </div>
              </div>
            </section>

            {/* Debug panel */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔍</span>
                  <SectionLabel className="mb-0">狀態資訊 — Debug Panel</SectionLabel>
                </div>
                <button
                  onClick={() => dispatchLog({ type: "clear" })}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Clear log
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DebugCell label="Animation Mode" value={mode} />
                <DebugCell label="Progress" value={progress.toFixed(3)} />
                <DebugCell label="Phase" value={phaseLabel} />
                <DebugCell label="Revealed" value={String(isRevealed)} highlight={isRevealed} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DebugCell label="Grade" value={grade} />
                <DebugCell label="Prize Name" value={prizeName || "(empty)"} />
                <DebugCell label="Image Source" value={effectiveImageUrl ? "URL" : "placeholder"} />
                <DebugCell label="Speed" value={`${speedMultiplier}x`} />
              </div>
              {/* Terminal-style event log */}
              <div className="bg-gray-950 rounded-xl border border-gray-800 p-3 font-mono text-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Event Log
                  </div>
                </div>
                <div
                  ref={logContainerRef}
                  className="space-y-0.5 max-h-32 overflow-y-auto"
                >
                  {logs.length === 0 ? (
                    <p className="text-gray-700 p-1">No events yet — press Play to start.</p>
                  ) : (
                    logs.map((entry) => (
                      <div key={entry.id} className="flex gap-3 items-baseline">
                        <span className="text-gray-600 shrink-0">
                          {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                            hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </span>
                        <span className={
                          entry.event.startsWith("DRAW_REVEALED") ? "text-emerald-400"
                          : entry.event.startsWith("RESET") ? "text-amber-400"
                          : entry.event.startsWith("MODE_CHANGED") ? "text-cyan-400"
                          : entry.event.startsWith("DRAW_STARTED") ? "text-cyan-400"
                          : entry.event.startsWith("DRAW_PROGRESS") ? "text-gray-500"
                          : "text-gray-400"
                        }>
                          {entry.event}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 2: Mini-Games
            ════════════════════════════════════════════════════════════════════ */}
        {activePhase === "phase2" && (
          <>
            {/* Description */}
            <section className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-400">
                  <span className="text-purple-300 font-semibold">Phase 2 迷你遊戲</span> — 結果預決，遊戲只是視覺演出。Canvas 2D、CSS 3D、React Three Fiber WebGL、<span className="text-yellow-400 font-semibold">Pixel Art</span>、<span className="text-pink-400 font-semibold">Neon Cyberpunk</span>、<span className="text-amber-300 font-semibold">Hand-drawn Sketch</span>、<span className="text-indigo-300 font-semibold">Minimalist Flat</span> 或 <span className="text-pink-300 font-semibold">Anime/Manga</span> 八種渲染模式可切換比較。
                </p>
                {/* Eight-way style toggle */}
                <div className="flex items-center gap-1 shrink-0 rounded-full p-0.5 bg-gray-800 border border-gray-700">
                  {(["2d", "css3d", "webgl", "pixel", "neon", "sketch", "flat", "anime"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setMiniGameStyle(mode); handleMiniGameReset(); }}
                      className={[
                        "px-3 py-1 rounded-full text-xs font-bold transition-all duration-150",
                        miniGameStyle === mode
                          ? "bg-purple-600 text-white shadow"
                          : "text-gray-400 hover:text-white",
                      ].join(" ")}
                    >
                      {mode === "2d" ? "2D" : mode === "css3d" ? "CSS 3D" : mode === "webgl" ? "WebGL" : mode === "pixel" ? "Pixel" : mode === "neon" ? "Neon" : mode === "sketch" ? "Sketch" : mode === "flat" ? "Flat" : "Anime"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Game selector — pill style */}
            <section>
              <div className="flex flex-wrap gap-2">
                {MINI_GAMES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchMiniGame(g.id)}
                    className={[
                      "px-5 py-2 rounded-full text-sm font-bold transition-all",
                      activeMiniGame === g.id
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                        : "text-purple-300 hover:text-white hover:bg-white/10",
                    ].join(" ")}
                  >
                    {g.label}
                    <span className={["ml-2 text-xs font-normal opacity-70"].join(" ")}>
                      {g.desc}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Two-column: game + settings */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* LEFT: Arcade cabinet frame — 60% */}
              <div className="w-full lg:flex-[3] flex justify-center">
                <div className="relative w-full max-w-lg">
                  {/* Arcade cabinet frame */}
                  <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                    <div className="bg-gray-950 rounded-xl overflow-hidden">
                      {miniGameStyle === "webgl" ? (
                        /* WebGL 3D versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachine3D
                              key={`3d-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachine3D
                              key={`3d-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachine3D
                              key={`3d-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "css3d" ? (
                        /* CSS 3D versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineCSS3D
                              key={`css3d-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachineCSS3D
                              key={`css3d-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachineCSS3D
                              key={`css3d-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "pixel" ? (
                        /* Pixel Art versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachinePixel
                              key={`pixel-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachinePixel
                              key={`pixel-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachinePixel
                              key={`pixel-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "neon" ? (
                        /* Neon Cyberpunk versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineNeon
                              key={`neon-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachineNeon
                              key={`neon-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachineNeon
                              key={`neon-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "sketch" ? (
                        /* Hand-drawn Sketch versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineSketch
                              key={`sketch-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachineSketch
                              key={`sketch-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachineSketch
                              key={`sketch-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "flat" ? (
                        /* Minimalist Flat versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineFlat
                              key={`flat-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachineFlat
                              key={`flat-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachineFlat
                              key={`flat-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : miniGameStyle === "anime" ? (
                        /* Anime/Manga versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineAnime
                              key={`anime-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachineAnime
                              key={`anime-claw-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as ClawGameState)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachineAnime
                              key={`anime-gacha-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as GachaGameState)}
                            />
                          )}
                        </>
                      ) : (
                        /* 2D Canvas versions */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachine
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s)}
                            />
                          )}
                          {activeMiniGame === "claw" && (
                            <ClawMachine
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s)}
                            />
                          )}
                          {activeMiniGame === "gacha" && (
                            <GachaMachine
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s)}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Game title plate */}
                  <div className="mt-3 text-center">
                    <span className="inline-block bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                      {MINI_GAMES.find(g => g.id === activeMiniGame)?.label ?? ""} — {MINI_GAMES.find(g => g.id === activeMiniGame)?.desc ?? ""}
                      {miniGameStyle === "webgl" ? " (WebGL 3D)" : miniGameStyle === "css3d" ? " (CSS 3D)" : miniGameStyle === "pixel" ? " (Pixel Art)" : miniGameStyle === "neon" ? " (Neon Cyberpunk)" : miniGameStyle === "sketch" ? " (Hand-drawn Sketch)" : miniGameStyle === "flat" ? " (Minimalist Flat)" : miniGameStyle === "anime" ? " (Anime/Manga)" : " (2D Canvas)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Settings + Debug — 40% */}
              <div className="w-full lg:flex-[2] space-y-4">
                {/* Settings card */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 space-y-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    ⚙️ 設定
                  </h3>

                  {/* Grade selector */}
                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-medium">獎品等級</label>
                    <div className="flex gap-2 flex-wrap">
                      {MINI_GAME_GRADES.map((g) => (
                        <button
                          key={g}
                          onClick={() => {
                            setMiniGrade(g);
                            handleMiniGameReset();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={miniGrade === g
                            ? { background: gradeAccentHex(g), color: "#fff", boxShadow: `0 2px 8px ${gradeAccentHex(g)}66` }
                            : { background: "#1f2937", color: "#9ca3af" }
                          }
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prize name */}
                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-medium">獎品名稱</label>
                    <input
                      type="text"
                      value={miniPrizeName}
                      onChange={(e) => setMiniPrizeName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="限定公仔"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleMiniGameReset}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold py-2 rounded-lg transition-colors"
                    >
                      ↺ 重置
                    </button>
                  </div>
                </div>

                {/* Debug cells */}
                <div className="grid grid-cols-2 gap-2">
                  <DebugCell label="Game" value={activeMiniGame} />
                  <DebugCell label="State" value={miniGameState} />
                  <DebugCell label="Result Grade" value={miniGrade} />
                  <DebugCell label="Actual Result" value={miniGameResult ?? "—"} highlight={miniGameResult !== null} />
                </div>

                {/* Terminal-style event log */}
                <div className="bg-gray-950 rounded-xl border border-gray-800 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                      Event Log
                    </div>
                    <button
                      onClick={() => dispatchMiniLog({ type: "clear" })}
                      className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <div
                    ref={miniLogRef}
                    className="space-y-0.5 max-h-32 overflow-y-auto"
                  >
                    {miniGameLogs.length === 0 ? (
                      <p className="text-gray-700 p-1">No events yet.</p>
                    ) : (
                      miniGameLogs.map((entry) => (
                        <div key={entry.id} className="flex gap-3 items-baseline">
                          <span className="text-gray-600 shrink-0">
                            {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                              hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })}
                          </span>
                          <span className={
                            entry.event.startsWith("RESULT") ? "text-emerald-400"
                            : entry.event.startsWith("RESET") ? "text-amber-400"
                            : entry.event.startsWith("STATE") ? "text-cyan-400"
                            : entry.event.startsWith("GAME_CHANGED") ? "text-cyan-400"
                            : "text-gray-500"
                          }>
                            {entry.event}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 3: 2.5D Room
            ════════════════════════════════════════════════════════════════════ */}
        {activePhase === "phase3" && (
          <>
            {/* Description */}
            <section className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-400">
                  <span className="text-purple-300 font-semibold">Phase 3 房間</span> —{" "}
                  {roomStyle === "webgl"
                    ? "React Three Fiber 真3D 空間，OrbitControls 自由旋轉視角，點擊地板移動角色。"
                    : roomStyle === "css3d"
                    ? "純 CSS 3D Transform 房間，無 WebGL，適合低階裝置。NPC 自動走動並定期抽獎。"
                    : roomStyle === "pixel"
                    ? "16-bit 像素風格俯視商店。Tile-based，點擊地板移動角色，NPC 自動徘徊。Canvas pixelated rendering。"
                    : roomStyle === "neon"
                    ? "霓虹賽博龐克風格商店。深色背景配電光輪廓，Tron 地板格線，掃描線疊加。點擊地板移動角色。"
                    : roomStyle === "sketch"
                    ? "手繪素描風格商店。筆記本紙背景，鉛筆線條，火柴人角色，塗鴉風裝飾。點擊地板移動角色，點擊 DRAW! 按鈕抽獎。"
                    : roomStyle === "flat"
                    ? "極簡扁平風格商店。純白背景，幾何圓形角色，無陰影無漸層。Notion 風格點陣底紋，點擊地板移動角色，靠近櫃台後點擊「抽獎」。"
                    : roomStyle === "anime"
                    ? "動漫/漫畫風格一番賞店。粉藍漸層天空，暖色木地板，條紋雨棚，Chibi 角色（大頭比例），粗黑輪廓，表情隨機應變（^_^ >_< O_O），點擊地板移動，靠近櫃台抽獎。"
                    : "等距視角（isometric）的虛擬商店。點擊地板移動角色，NPC 自動走動並定期抽獎。純 Canvas API + A* 尋路。"}
                </p>
                {/* Eight-way style toggle */}
                <div className="flex items-center gap-1 shrink-0 rounded-full p-0.5 bg-gray-800 border border-gray-700">
                  {(["2d", "css3d", "webgl", "pixel", "neon", "sketch", "flat", "anime"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRoomStyle(mode)}
                      className={[
                        "px-3 py-1 rounded-full text-xs font-bold transition-all duration-150",
                        roomStyle === mode
                          ? "bg-purple-600 text-white shadow"
                          : "text-gray-400 hover:text-white",
                      ].join(" ")}
                    >
                      {mode === "2d" ? "2D" : mode === "css3d" ? "CSS 3D" : mode === "webgl" ? "WebGL" : mode === "pixel" ? "Pixel" : mode === "neon" ? "Neon" : mode === "sketch" ? "Sketch" : mode === "flat" ? "Flat" : "Anime"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Two-column: room + controls */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* LEFT: Arcade cabinet frame — 60% */}
              <div className="w-full lg:flex-[3]">
                <div className="relative">
                  <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                    <div className={["bg-gray-950 rounded-xl", room3D ? "overflow-hidden" : "overflow-x-auto"].join(" ")}>
                      {roomStyle === "webgl" ? (
                        <PrizeDrawRoom3D
                          key={`3d-room-${npcCount}`}
                          npcCount={npcCount}
                          onStateChange={(info) => setRoom3DInfo(info)}
                        />
                      ) : roomStyle === "css3d" ? (
                        <PrizeRoomCSS3D
                          key={`css3d-room-${npcCount}`}
                          npcCount={npcCount}
                          onStateChange={(info) => setRoom3DInfo({
                            yourPos: info.yourPos,
                            queue: info.queue,
                            activeDrawer: info.activeDrawer,
                          })}
                        />
                      ) : roomStyle === "pixel" ? (
                        <PrizeRoomPixel
                          key={`pixel-room-${npcCount}`}
                          npcCount={npcCount}
                          resultGrade={miniGameResult ?? undefined}
                        />
                      ) : roomStyle === "neon" ? (
                        <PrizeRoomNeon
                          key={`neon-room-${npcCount}`}
                          npcCount={npcCount}
                          resultGrade={miniGameResult ?? undefined}
                        />
                      ) : roomStyle === "sketch" ? (
                        <PrizeRoomSketch
                          key={`sketch-room-${npcCount}`}
                          npcCount={npcCount}
                          resultGrade={miniGameResult ?? undefined}
                          onDrawResult={(grade) => dispatchMiniLog({ type: "push", event: `ROOM_DRAW: ${grade}` })}
                        />
                      ) : roomStyle === "flat" ? (
                        <PrizeRoomFlat
                          key={`flat-room-${npcCount}`}
                          npcCount={npcCount}
                          resultGrade={miniGameResult ?? undefined}
                          onDrawResult={(grade) => dispatchMiniLog({ type: "push", event: `ROOM_DRAW: ${grade}` })}
                        />
                      ) : roomStyle === "anime" ? (
                        <PrizeRoomAnime
                          key={`anime-room-${npcCount}`}
                          npcCount={npcCount}
                          onDrawResult={(grade) => dispatchMiniLog({ type: "push", event: `ROOM_DRAW: ${grade}` })}
                        />
                      ) : (
                        <IsometricRoom
                          npcCount={npcCount}
                          onStateChange={setRoomInfo}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="inline-block bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                      {roomStyle === "webgl"
                        ? "真 3D 房間 — 拖曳旋轉視角，點擊地板移動"
                        : roomStyle === "css3d"
                        ? "CSS 3D 房間 — 純 CSS Transform，無 WebGL"
                        : roomStyle === "pixel"
                        ? "Pixel Art 商店 — 16-bit 俯視，點擊移動"
                        : roomStyle === "neon"
                        ? "Neon Cyberpunk — 電光霓虹，點擊移動"
                        : roomStyle === "sketch"
                        ? "Hand-drawn Sketch — 鉛筆素描，火柴人，點擊移動"
                        : roomStyle === "flat"
                        ? "Minimalist Flat — 幾何圓形，純色填充，點擊移動"
                        : roomStyle === "anime"
                        ? "Anime/Manga — Chibi 角色，粗黑輪廓，一番賞店"
                        : "2.5D 等距房間"}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Controls + Info — 40% */}
              <div className="w-full lg:flex-[2] space-y-4">
                {/* Settings card */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 space-y-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    ⚙️ 設定
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 text-xs font-medium">NPC 數量</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setNpcCount(n)}
                          className={[
                            "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            npcCount === n
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info cells */}
                <div className="grid grid-cols-2 gap-2">
                  {roomStyle === "webgl" ? (
                    <>
                      <DebugCell label="你的位置" value={`(${room3DInfo.yourPos.x.toFixed(1)}, ${room3DInfo.yourPos.z.toFixed(1)})`} />
                      <DebugCell label="排隊人數" value={room3DInfo.queue.length > 0 ? `${room3DInfo.queue.length} 人` : "無排隊"} />
                      <DebugCell
                        label="目前抽獎者"
                        value={room3DInfo.activeDrawer ?? "—"}
                        highlight={room3DInfo.activeDrawer !== null}
                      />
                      <DebugCell label="模式" value="WebGL 3D" highlight />
                    </>
                  ) : roomStyle === "css3d" ? (
                    <>
                      <DebugCell label="你的位置" value={`(${room3DInfo.yourPos.x.toFixed(1)}, ${room3DInfo.yourPos.z.toFixed(1)})`} />
                      <DebugCell label="排隊人數" value={room3DInfo.queue.length > 0 ? `${room3DInfo.queue.length} 人` : "無排隊"} />
                      <DebugCell
                        label="目前抽獎者"
                        value={room3DInfo.activeDrawer ?? "—"}
                        highlight={room3DInfo.activeDrawer !== null}
                      />
                      <DebugCell label="模式" value="CSS 3D" highlight />
                    </>
                  ) : roomStyle === "pixel" ? (
                    <>
                      <DebugCell label="渲染" value="Pixel Art" highlight />
                      <DebugCell label="解析度" value="320×240" />
                      <DebugCell label="Tile 大小" value="16px" />
                      <DebugCell label="模式" value="Top-Down" highlight />
                    </>
                  ) : roomStyle === "neon" ? (
                    <>
                      <DebugCell label="渲染" value="Neon Cyberpunk" highlight />
                      <DebugCell label="解析度" value="480×360" />
                      <DebugCell label="特效" value="Glow + Scanlines" />
                      <DebugCell label="模式" value="Top-Down" highlight />
                    </>
                  ) : roomStyle === "sketch" ? (
                    <>
                      <DebugCell label="渲染" value="Hand-drawn Sketch" highlight />
                      <DebugCell label="解析度" value="480×360" />
                      <DebugCell label="特效" value="Wobbly Lines + Cross-hatch" />
                      <DebugCell label="模式" value="Stick Figures" highlight />
                    </>
                  ) : roomStyle === "flat" ? (
                    <>
                      <DebugCell label="渲染" value="Minimalist Flat" highlight />
                      <DebugCell label="解析度" value="480×380" />
                      <DebugCell label="特效" value="Zero shadows / Zero gradients" />
                      <DebugCell label="模式" value="Geometric Circles" highlight />
                    </>
                  ) : roomStyle === "anime" ? (
                    <>
                      <DebugCell label="渲染" value="Anime/Manga" highlight />
                      <DebugCell label="解析度" value="480×380" />
                      <DebugCell label="特效" value="Speed Lines + Chibi + Petals" />
                      <DebugCell label="模式" value="一番賞 Shop" highlight />
                    </>
                  ) : (
                    <>
                      <DebugCell label="你的位置" value={`(${roomInfo.yourPos.isoX}, ${roomInfo.yourPos.isoY})`} />
                      <DebugCell label="排隊人數" value={roomInfo.queue.length > 0 ? `${roomInfo.queue.length} 人` : "無排隊"} />
                      <DebugCell
                        label="目前抽獎者"
                        value={roomInfo.activeDrawer ?? "—"}
                        highlight={roomInfo.activeDrawer !== null}
                      />
                      <DebugCell label="模式" value="2.5D Canvas" />
                    </>
                  )}
                  <DebugCell label="NPC 數量" value={`${npcCount} 人`} />
                </div>

                {/* Legend */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 space-y-2">
                  <p className="text-white font-bold text-xs flex items-center gap-1">🗺️ 圖例</p>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { color: "#fbbf24", label: "你的角色" },
                      { color: "#6366f1", label: "NPC 角色" },
                      { color: "#22c55e", label: "移動中" },
                      { color: "#f59e0b", label: "排隊中" },
                      { color: "#ec4899", label: "抽獎中" },
                      { color: "#fbbf24", label: "慶祝中" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-gray-400">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-700/50 space-y-1 text-xs text-gray-500">
                    <p>展架 = 陳列賞品</p>
                    <p>櫃台 = 抽獎區域</p>
                    <p>紫色地毯 = 等候區</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-700/30 p-4 space-y-1.5 text-xs text-gray-500">
                  <p className="font-semibold text-gray-400">操作說明</p>
                  <p>點擊地板 — 移動角色</p>
                  <p>觸發 NPC 抽獎 — 在遊戲內隨機選 NPC 至櫃台抽獎</p>
                  <p>發送訊息 — 角色頭頂出現聊天氣泡</p>
                  <p>添加獎品氣泡 — 角色頭頂顯示獲獎</p>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation canvas dispatcher (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

interface AnimationCanvasProps {
  mode: AnimationMode;
  prizePhotoUrl: string;
  grade: string;
  prizeName: string;
  onProgress: (p: number) => void;
  onRevealed: () => void;
  speedMultiplier: number;
}

function AnimationCanvas({
  mode,
  prizePhotoUrl,
  grade,
  prizeName,
  onProgress,
  onRevealed,
  speedMultiplier,
}: AnimationCanvasProps) {
  const speedStyle: React.CSSProperties = {
    // @ts-expect-error -- custom CSS var
    "--animation-speed-multiplier": speedMultiplier,
  };
  const wrapperClass = "w-full h-full";

  switch (mode) {
    case "TEAR":
      return (
        <div className={wrapperClass} style={speedStyle}>
          <TearReveal
            prizePhotoUrl={prizePhotoUrl}
            prizeGrade={grade}
            prizeName={prizeName}
            onRevealed={onRevealed}
            onProgress={onProgress}
          />
        </div>
      );
    case "SCRATCH":
      return (
        <div className={wrapperClass} style={speedStyle}>
          <ScratchReveal
            prizePhotoUrl={prizePhotoUrl}
            onRevealed={() => {
              onProgress(1);
              onRevealed();
            }}
          />
        </div>
      );
    case "FLIP":
      return (
        <div className={wrapperClass} style={speedStyle}>
          <FlipRevealWithProgress
            prizePhotoUrl={prizePhotoUrl}
            grade={grade}
            prizeName={prizeName}
            speedMultiplier={speedMultiplier}
            onProgress={onProgress}
            onRevealed={onRevealed}
          />
        </div>
      );
    case "INSTANT":
    default:
      return (
        <div className={wrapperClass} style={speedStyle}>
          <InstantRevealWithProgress
            prizePhotoUrl={prizePhotoUrl}
            grade={grade}
            prizeName={prizeName}
            speedMultiplier={speedMultiplier}
            onProgress={onProgress}
            onRevealed={onRevealed}
          />
        </div>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function FlipRevealWithProgress({
  prizePhotoUrl,
  grade,
  prizeName,
  speedMultiplier,
  onProgress,
  onRevealed,
}: {
  prizePhotoUrl: string;
  grade: string;
  prizeName: string;
  speedMultiplier: number;
  onProgress: (p: number) => void;
  onRevealed: () => void;
}) {
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [flipping, setFlipping] = useState(false);
  const FLIP_DURATION_MS = 650 / speedMultiplier;

  const handleInternalRevealed = useCallback(() => {
    onProgress(1);
    onRevealed();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, [onProgress, onRevealed]);

  const handleClick = useCallback(() => {
    if (flipping) return;
    setFlipping(true);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const p = Math.min(elapsed / FLIP_DURATION_MS, 1);
      onProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [flipping, FLIP_DURATION_MS, onProgress]);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div onClick={handleClick} className="w-full h-full cursor-pointer">
      <FlipReveal
        prizePhotoUrl={prizePhotoUrl}
        prizeGrade={grade}
        prizeName={prizeName}
        onRevealed={handleInternalRevealed}
      />
    </div>
  );
}

function InstantRevealWithProgress({
  prizePhotoUrl,
  grade,
  prizeName,
  speedMultiplier,
  onProgress,
  onRevealed,
}: {
  prizePhotoUrl: string;
  grade: string;
  prizeName: string;
  speedMultiplier: number;
  onProgress: (p: number) => void;
  onRevealed: () => void;
}) {
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const DURATION_MS = 350 / speedMultiplier;

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const p = Math.min(elapsed / DURATION_MS, 1);
      onProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInternalRevealed = useCallback(() => {
    onProgress(1);
    onRevealed();
  }, [onProgress, onRevealed]);

  return (
    <InstantReveal
      prizePhotoUrl={prizePhotoUrl}
      prizeGrade={grade}
      prizeName={prizeName}
      onRevealed={handleInternalRevealed}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  className = "mb-2",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}>
      {children}
    </p>
  );
}

function StatusChip({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs",
        highlight
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-gray-700 bg-gray-800 text-gray-300",
      ].join(" ")}
    >
      <span className="text-gray-500">{label}:</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}

function DebugCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-800/60 border border-gray-800 p-2.5 min-w-0">
      <p className="text-xs text-gray-600 mb-0.5 truncate">{label}</p>
      <p
        className={[
          "text-xs font-mono font-semibold truncate",
          highlight ? "text-emerald-400" : "text-gray-200",
        ].join(" ")}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder data URL generator
// ─────────────────────────────────────────────────────────────────────────────

function makePlaceholderDataUrl(grade: string, prizeName: string): string {
  const gradients: Record<string, [string, string]> = {
    A賞: ["#f59e0b", "#fde68a"],
    B賞: ["#3b82f6", "#bae6fd"],
    C賞: ["#10b981", "#a7f3d0"],
    D賞: ["#a855f7", "#ddd6fe"],
    最後賞: ["#f43f5e", "#fda4af"],
  };
  const [c1, c2] = gradients[grade] ?? ["#6b7280", "#d1d5db"];
  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="340" height="480" viewBox="0 0 340 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="340" height="480" fill="url(#g)" rx="16"/>
  <text x="170" y="200" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" fill="white" opacity="0.9">🎁</text>
  <text x="170" y="280" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="900" fill="white">${grade}</text>
  <text x="170" y="320" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="white" opacity="0.8">${prizeName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}
