"use client";

import Link from "next/link";
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
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type PhaseTab = "phase1" | "phase2" | "phase3";
type MiniGameId = "slot" | "claw" | "gacha";

const PHASE_TABS: { id: PhaseTab; label: string; sub: string }[] = [
  { id: "phase1", label: "Phase 1", sub: "動畫" },
  { id: "phase2", label: "Phase 2", sub: "迷你遊戲" },
  { id: "phase3", label: "Phase 3", sub: "2.5D 房間" },
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
  B賞: "from-sky-400 to-blue-300",
  C賞: "from-emerald-400 to-green-300",
  D賞: "from-violet-400 to-purple-300",
  最後賞: "from-rose-500 to-pink-400",
};

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

  // ── Phase 3 state ──────────────────────────────────────────────────────────
  const [npcCount, setNpcCount] = useState(3);
  const [roomInfo, setRoomInfo] = useState<{
    yourPos: { isoX: number; isoY: number };
    queue: string[];
    activeDrawer: string | null;
  }>({ yourPos: { isoX: 5, isoY: 9 }, queue: [], activeDrawer: null });

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
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dev"
              className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              aria-label="Back to dev tools"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">🎬</span>
              <h1 className="font-bold text-white truncate">動畫預覽工具</h1>
              <span className="hidden sm:inline text-gray-500 text-sm truncate">
                — Animation Showcase &amp; Preview
              </span>
            </div>
          </div>
          <span className="shrink-0 text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 font-mono">
            /dev/animations
          </span>
        </div>
      </div>

      {/* ── Phase tabs ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 pt-3">
            {PHASE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePhase(tab.id)}
                className={[
                  "flex flex-col items-center px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-all border-b-2 -mb-px",
                  activePhase === tab.id
                    ? "bg-gray-800 border-indigo-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50",
                ].join(" ")}
              >
                <span>{tab.label}</span>
                <span
                  className={[
                    "text-xs font-normal mt-0.5",
                    activePhase === tab.id ? "text-indigo-400" : "text-gray-600",
                  ].join(" ")}
                >
                  {tab.sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              {/* LEFT: Animation canvas */}
              <div className="space-y-4">
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

              {/* RIGHT: Settings panel */}
              <div className="space-y-5">
                <SectionLabel>Settings</SectionLabel>

                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Prize Grade — 賞品等級
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGrade(g)}
                        className={[
                          "px-3 py-1 rounded-lg text-xs font-semibold border transition-all",
                          grade === g
                            ? "bg-amber-500 border-amber-400 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                        ].join(" ")}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Prize Name — 賞品名稱
                  </label>
                  <input
                    type="text"
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder={DEFAULT_PRIZE_NAME}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Image URL — 圖片網址
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="留空使用預設漸層佔位圖"
                  />
                  {!effectiveImageUrl && (
                    <p className="mt-1 text-xs text-gray-600">
                      Using gradient placeholder based on grade colour.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Animation Speed
                  </label>
                  <div className="flex gap-1.5">
                    {([0.5, 1, 2] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeedMultiplier(s)}
                        className={[
                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          speedMultiplier === s
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                        ].join(" ")}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Prize Image Preview
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
              </div>
            </div>

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
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Event Log</p>
                <div
                  ref={logContainerRef}
                  className="h-32 overflow-y-auto rounded-lg bg-gray-950 border border-gray-800 p-2 space-y-1 font-mono text-xs"
                >
                  {logs.length === 0 ? (
                    <p className="text-gray-700 p-1">No events yet — press Play to start.</p>
                  ) : (
                    logs.map((entry) => (
                      <div key={entry.id} className="flex gap-3 items-baseline">
                        <span className="text-gray-700 shrink-0">
                          {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                            hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </span>
                        <span className={
                          entry.event.startsWith("DRAW_REVEALED") ? "text-emerald-400"
                          : entry.event.startsWith("RESET") ? "text-amber-400"
                          : entry.event.startsWith("MODE_CHANGED") ? "text-sky-400"
                          : entry.event.startsWith("DRAW_STARTED") ? "text-indigo-400"
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
            <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm text-gray-400">
                <span className="text-indigo-400 font-semibold">Phase 2 迷你遊戲</span> — 結果預決，遊戲只是視覺演出。下方三款遊戲均使用純 Canvas API 實作，無外部遊戲引擎。
              </p>
            </section>

            {/* Game selector */}
            <section>
              <SectionLabel>遊戲選擇</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {MINI_GAMES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchMiniGame(g.id)}
                    className={[
                      "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                      activeMiniGame === g.id
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white",
                    ].join(" ")}
                  >
                    {g.label}
                    <span className={["ml-2 text-xs font-normal", activeMiniGame === g.id ? "text-indigo-200" : "text-gray-500"].join(" ")}>
                      {g.desc}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Two-column: game + settings */}
            <div className="grid grid-cols-1 lg:grid-cols-[auto_280px] gap-6 items-start">
              {/* LEFT: Game canvas */}
              <div className="flex justify-center">
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
              </div>

              {/* RIGHT: Settings + Debug */}
              <div className="space-y-5">
                <SectionLabel>Settings</SectionLabel>

                {/* Result grade */}
                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Result Grade — 預決結果
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MINI_GAME_GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          setMiniGrade(g);
                          handleMiniGameReset();
                        }}
                        className={[
                          "px-3 py-1 rounded-lg text-xs font-semibold border transition-all",
                          miniGrade === g
                            ? "bg-amber-500 border-amber-400 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                        ].join(" ")}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prize name */}
                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Prize Name — 賞品名稱
                  </label>
                  <input
                    type="text"
                    value={miniPrizeName}
                    onChange={(e) => setMiniPrizeName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="限定公仔"
                  />
                </div>

                {/* Reset */}
                <button
                  onClick={handleMiniGameReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold text-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  重置遊戲
                </button>

                {/* Debug panel */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <SectionLabel className="mb-0">Debug</SectionLabel>
                    <button
                      onClick={() => dispatchMiniLog({ type: "clear" })}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <DebugCell label="Game" value={activeMiniGame} />
                    <DebugCell label="State" value={miniGameState} />
                    <DebugCell label="Result Grade" value={miniGrade} />
                    <DebugCell label="Actual Result" value={miniGameResult ?? "—"} highlight={miniGameResult !== null} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">State: IDLE → PLAYING → RESULT</p>
                    <div
                      ref={miniLogRef}
                      className="h-28 overflow-y-auto rounded-lg bg-gray-950 border border-gray-800 p-2 space-y-1 font-mono text-xs"
                    >
                      {miniGameLogs.length === 0 ? (
                        <p className="text-gray-700 p-1">No events yet.</p>
                      ) : (
                        miniGameLogs.map((entry) => (
                          <div key={entry.id} className="flex gap-3 items-baseline">
                            <span className="text-gray-700 shrink-0">
                              {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                                hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                              })}
                            </span>
                            <span className={
                              entry.event.startsWith("RESULT") ? "text-amber-400"
                              : entry.event.startsWith("RESET") ? "text-rose-400"
                              : entry.event.startsWith("STATE") ? "text-sky-400"
                              : "text-gray-400"
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
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 3: 2.5D Room
            ════════════════════════════════════════════════════════════════════ */}
        {activePhase === "phase3" && (
          <>
            {/* Description */}
            <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm text-gray-400">
                <span className="text-indigo-400 font-semibold">Phase 3 2.5D 房間</span> — 等距視角（isometric）的虛擬商店。點擊地板移動角色，NPC 自動走動並定期抽獎。純 Canvas API + A* 尋路。
              </p>
            </section>

            {/* Two-column: room + controls */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-6 items-start">
              {/* LEFT: Isometric room */}
              <div className="w-full overflow-x-auto">
                <IsometricRoom
                  npcCount={npcCount}
                  onStateChange={setRoomInfo}
                />
              </div>

              {/* RIGHT: Controls + Info */}
              <div className="space-y-5">
                <SectionLabel>Controls</SectionLabel>

                {/* NPC count */}
                <div>
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    NPC 數量
                  </label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setNpcCount(n)}
                        className={[
                          "flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          npcCount === n
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info panel */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
                  <SectionLabel className="mb-0">Info</SectionLabel>
                  <div className="space-y-2">
                    <DebugCell label="你的位置" value={`(${roomInfo.yourPos.isoX}, ${roomInfo.yourPos.isoY})`} />
                    <DebugCell label="排隊人數" value={roomInfo.queue.length > 0 ? `${roomInfo.queue.length} 人` : "無排隊"} />
                    <DebugCell
                      label="目前抽獎者"
                      value={roomInfo.activeDrawer ?? "—"}
                      highlight={roomInfo.activeDrawer !== null}
                    />
                    <DebugCell label="NPC 數量" value={`${npcCount} 人`} />
                  </div>
                </div>

                {/* Legend */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
                  <SectionLabel className="mb-0">圖例</SectionLabel>
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
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-gray-400">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-800 space-y-1 text-xs text-gray-500">
                    <p>展架 = 陳列賞品</p>
                    <p>櫃台 = 抽獎區域</p>
                    <p>紫色地毯 = 等候區</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-1.5 text-xs text-gray-500">
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
    A賞: ["#fbbf24", "#fde68a"],
    B賞: ["#38bdf8", "#bae6fd"],
    C賞: ["#34d399", "#a7f3d0"],
    D賞: ["#a78bfa", "#ddd6fe"],
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
