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
import type { RefObject } from "react";
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
import { GameTutorial } from "@/components/GameTutorial";
import type { TutorialGameId } from "@/components/GameTutorial";
import { resetTutorialFlag } from "@/components/GameTutorial";
import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/difficulty";
import { sounds } from "@/lib/sounds";
import { haptics } from "@/lib/haptics";
import { captureGameScreenshot, shareScreenshot } from "@/lib/screenshot";
import { FPSCounter } from "@/components/FPSCounter";
import { achievements } from "@/lib/achievements";
import { combo } from "@/lib/combo";
import type { ComboMilestone } from "@/lib/combo";
import { getSeasonalTheme, SEASONAL_THEMES, THEME_IDS } from "@/lib/seasonal";
import type { SeasonalTheme } from "@/lib/seasonal";
import { getTimeAmbient } from "@/lib/timeOfDay";
import { AchievementToast } from "@/components/AchievementToast";
import { AchievementPanel } from "@/components/AchievementPanel";
import { ComboDisplay } from "@/components/ComboDisplay";
import { SeasonalOverlay } from "@/components/SeasonalOverlay";

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

const SlotMachineMaple = dynamic(
  () => import("@/games/maple/SlotMachine_Maple").then((m) => ({ default: m.SlotMachine_Maple })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Maple 拉霸機" /> },
);

const PrizeRoomMaple = dynamic(
  () => import("@/games/maple/PrizeRoom_Maple").then((m) => ({ default: m.PrizeRoom_Maple })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="Maple 房間" height={380} /> },
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

const SlotMachineRO = dynamic(
  () => import("@/games/ro/SlotMachine_RO").then((m) => ({ default: m.SlotMachine_RO })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="RO 拉霸機" /> },
);

const PrizeRoomRO = dynamic(
  () => import("@/games/ro/PrizeRoom_RO").then((m) => ({ default: m.PrizeRoom_RO })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="RO 仙境傳說" height={480} /> },
);

// ── Bonus mini-games ─────────────────────────────────────────────────────────

const RouletteGame = dynamic(
  () => import("@/games/bonus/Roulette").then((m) => ({ default: m.Roulette })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="轉盤" height={380} /> },
);

const PachinkoGame = dynamic(
  () => import("@/games/bonus/Pachinko").then((m) => ({ default: m.Pachinko })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="彈珠台" height={520} /> },
);

const ScratchCardGame = dynamic(
  () => import("@/games/bonus/ScratchCard").then((m) => ({ default: m.ScratchCard })),
  { ssr: false, loading: () => <ThreeDLoadingPlaceholder label="刮刮樂" height={280} /> },
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
type MiniGameId = "slot" | "claw" | "gacha" | "roulette" | "pachinko" | "scratch";
type StyleMode = "2d" | "css3d" | "webgl" | "pixel" | "neon" | "sketch" | "flat" | "anime" | "maple" | "ro";

const PHASE_TABS: { id: PhaseTab; label: string; icon: string }[] = [
  { id: "phase1", label: "動畫效果", icon: "🎬" },
  { id: "phase2", label: "迷你遊戲", icon: "🕹️" },
  { id: "phase3", label: "2.5D 房間", icon: "🏠" },
];

const MINI_GAMES: { id: MiniGameId; label: string; desc: string; isBonus?: boolean }[] = [
  { id: "slot",     label: "拉霸機",  desc: "Slot Machine" },
  { id: "claw",     label: "夾娃娃",  desc: "Claw Machine" },
  { id: "gacha",    label: "扭蛋機",  desc: "Gacha Machine" },
  { id: "roulette", label: "轉盤",    desc: "Roulette",   isBonus: true },
  { id: "pachinko", label: "彈珠台",  desc: "Pachinko",   isBonus: true },
  { id: "scratch",  label: "刮刮樂",  desc: "Scratch Card", isBonus: true },
];

/** Maps MiniGameId to TutorialGameId (bonus games share the same id) */
function toTutorialId(gameId: MiniGameId): TutorialGameId {
  return gameId as TutorialGameId;
}

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
// Style Recommendation Panel
// ─────────────────────────────────────────────────────────────────────────────

function StyleRecommendationPanel({ detailsRef }: { detailsRef: RefObject<HTMLDetailsElement | null> }) {
  return (
    <details ref={detailsRef} className="mb-6 bg-gray-800/50 border border-gray-700 rounded-xl">
      <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-gray-300 hover:text-white flex items-center gap-2">
        💡 哪種風格最適合？— 風格推薦指南
      </summary>
      <div className="px-5 pb-5 pt-2">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-700">
              <th className="py-2 pr-3">風格</th>
              <th className="py-2 pr-3">效能需求</th>
              <th className="py-2 pr-3">視覺品質</th>
              <th className="py-2 pr-3">互動感</th>
              <th className="py-2 pr-3">載入速度</th>
              <th className="py-2 pr-3">最適合場景</th>
              <th className="py-2">推薦度</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">🌸 Anime</td>
              <td>低</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐</td>
              <td>快</td>
              <td>一番賞主題 — 最搭配</td>
              <td><span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">推薦</span></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">🎮 WebGL 3D</td>
              <td>高</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>慢（需載入 Three.js）</td>
              <td>高端裝置、沉浸式體驗</td>
              <td><span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">進階</span></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">🧊 CSS 3D</td>
              <td>低</td>
              <td>⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐</td>
              <td>最快（無額外載入）</td>
              <td>手機、低端裝置、快速載入</td>
              <td><span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">輕量</span></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">🎨 2D Canvas</td>
              <td>中</td>
              <td>⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐</td>
              <td>快</td>
              <td>通用、穩定、跨平台一致</td>
              <td><span className="bg-gray-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">穩定</span></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">👾 Pixel Art</td>
              <td>最低</td>
              <td>⭐⭐⭐</td>
              <td>⭐⭐⭐</td>
              <td>最快</td>
              <td>復古主題活動、懷舊風格</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">💜 Neon</td>
              <td>中</td>
              <td>⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐</td>
              <td>快</td>
              <td>夜間模式、科幻主題活動</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">✏️ Sketch</td>
              <td>低</td>
              <td>⭐⭐⭐</td>
              <td>⭐⭐⭐</td>
              <td>快</td>
              <td>特殊活動、藝術風格</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">⬜ Flat</td>
              <td>最低</td>
              <td>⭐⭐⭐</td>
              <td>⭐⭐⭐</td>
              <td>最快</td>
              <td>企業風、簡報展示用</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2.5 font-bold">🍁 Maple</td>
              <td>低</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>快</td>
              <td>楓之谷風格、可愛卡通、橫版場景</td>
              <td><span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">新</span></td>
            </tr>
            <tr>
              <td className="py-2.5 font-bold">⚔️ RO 仙境</td>
              <td>低</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>⭐⭐⭐⭐⭐</td>
              <td>快</td>
              <td>仙境傳說 2D 等距、精靈角色、Poring、水彩風</td>
              <td><span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">新</span></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg text-xs text-amber-200">
          <strong>💡 建議策略：</strong>
          <br/>• <strong>預設使用 Anime 風格</strong> — 最搭配一番賞主題，效能要求低
          <br/>• <strong>進階用戶可選 WebGL 3D</strong> — 最沉浸但需要好的 GPU
          <br/>• <strong>手機用戶自動降級到 CSS 3D</strong> — 零額外載入，最快
          <br/>• <strong>特殊活動可切換主題</strong> — 例如萬聖節用 Neon，聖誕節用 Sketch
        </div>
      </div>
    </details>
  );
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

  // ── Tutorial + Accessibility state ─────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialForced, setTutorialForced] = useState(false);
  const [showA11yPanel, setShowA11yPanel] = useState(false);

  // ── Difficulty state (claw machine only) ───────────────────────────────────
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  // ── Style toggle state (2d | css3d | webgl) ───────────────────────────────
  const [miniGameStyle, setMiniGameStyle] = useState<StyleMode>("2d");
  const [roomStyle, setRoomStyle] = useState<StyleMode>("2d");

  // ── Style recommendation panel refs (one per phase) ────────────────────────
  const phase2RecommendRef = useRef<HTMLDetailsElement | null>(null);
  const phase3RecommendRef = useRef<HTMLDetailsElement | null>(null);

  // ── Compare mode state ─────────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [leftStyle, setLeftStyle] = useState<StyleMode>("anime");
  const [rightStyle, setRightStyle] = useState<StyleMode>("neon");
  const [leftGameKey, setLeftGameKey] = useState(0);
  const [rightGameKey, setRightGameKey] = useState(0);
  const [leftGameState, setLeftGameState] = useState<SlotGameState | ClawGameState | GachaGameState>("IDLE");
  const [rightGameState, setRightGameState] = useState<SlotGameState | ClawGameState | GachaGameState>("IDLE");
  const [leftGameResult, setLeftGameResult] = useState<string | null>(null);
  const [rightGameResult, setRightGameResult] = useState<string | null>(null);
  const [compareLogs, dispatchCompareLog] = useReducer(logReducer, []);
  const compareLogRef = useRef<HTMLDivElement>(null);
  // Legacy alias used in arcade cabinet overflow class
  const room3D = roomStyle === "webgl";

  // ── Achievement / combo / seasonal / time-of-day state ────────────────────
  const [achievementPanelOpen, setAchievementPanelOpen] = useState(false);
  const [comboStreak, setComboStreak] = useState(0);
  const [comboMilestone, setComboMilestone] = useState<ComboMilestone>(null);
  const [seasonalTheme, setSeasonalTheme] = useState<SeasonalTheme>(getSeasonalTheme);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [timeAmbient] = useState(getTimeAmbient);
  // Track which mini-game types the user has tried (for try_all_games achievement)
  const triedGamesRef = useRef<Set<string>>(new Set());
  // Track which styles the user has tried (for try_all_styles achievement)
  const triedStylesRef = useRef<Set<string>>(new Set());
  // Draw count (for collector achievements)
  const drawCountRef = useRef(0);
  // Draw start time (for speed_draw achievement)
  const drawStartRef = useRef<number | null>(null);

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
    // Win sounds based on current grade
    if (grade.startsWith("A")) {
      sounds.playWinBig();
      haptics.winBig();
    } else {
      sounds.playWinSmall();
      haptics.winSmall();
    }

    // ── Achievements ───────────────────────────────────────────────────────
    // First draw
    achievements.unlock("first_draw");
    // A-grade win
    if (grade === "A賞") achievements.unlock("win_a_grade");
    // Night owl
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) achievements.unlock("night_owl");
    // Speed draw — completed within 3 seconds of pressing Play
    if (drawStartRef.current !== null) {
      const elapsed = Date.now() - drawStartRef.current;
      if (elapsed <= 3000) achievements.unlock("speed_draw");
    }
    // Collector
    drawCountRef.current += 1;
    if (drawCountRef.current >= 10) achievements.unlock("collector_10");
    if (drawCountRef.current >= 50) achievements.unlock("collector_50");

    // ── Combo ──────────────────────────────────────────────────────────────
    const result = combo.recordDraw(grade);
    setComboStreak(result.streak);
    setComboMilestone(result.milestone);
    if (result.milestone === "combo3") achievements.unlock("combo_3");
    if (result.milestone === "combo5") achievements.unlock("combo_5");
    // Clear milestone indicator after a short delay
    if (result.milestone) {
      setTimeout(() => setComboMilestone(null), 100);
    }
  }, [grade]);

  const handlePlay = useCallback(() => {
    if (isPlaying && !isRevealed) return;
    setAnimationKey((k) => k + 1);
    setProgress(0);
    setIsRevealed(false);
    setIsPlaying(true);
    drawStartRef.current = Date.now();
    dispatchLog({ type: "push", event: `DRAW_STARTED (mode=${mode})` });
    // Play mode-appropriate sound effect
    if (mode === "TEAR") { sounds.playTear(); haptics.tear(); }
    else if (mode === "SCRATCH") { sounds.playScratch(); haptics.scratch(); }
    else if (mode === "FLIP") { sounds.playFlip(); haptics.flip(); }
    else { haptics.click(); }
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

  useEffect(() => {
    if (compareLogRef.current) compareLogRef.current.scrollTop = 0;
  }, [compareLogs]);

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

  // ── Dev toolbar state ───────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [showFPS, setShowFPS] = useState(false);
  // Ref to the active game container for screenshot capture
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // ── Phase 2 callbacks ──────────────────────────────────────────────────────
  const handleMiniGameResult = useCallback((g: string) => {
    setMiniGameResult(g);
    dispatchMiniLog({ type: "push", event: `RESULT: ${g}` });
    // Sound + haptic feedback based on grade
    if (g.startsWith("A")) {
      sounds.playJackpot();
      haptics.jackpot();
    } else {
      sounds.playWinSmall();
      haptics.winSmall();
    }
    // ── Achievements ─────────────────────────────────────────────────────────
    achievements.unlock("first_draw");
    if (g === "A賞") achievements.unlock("win_a_grade");
    const h = new Date().getHours();
    if (h >= 2 && h < 5) achievements.unlock("night_owl");
    drawCountRef.current += 1;
    if (drawCountRef.current >= 10) achievements.unlock("collector_10");
    if (drawCountRef.current >= 50) achievements.unlock("collector_50");

    // ── Combo ─────────────────────────────────────────────────────────────
    const result = combo.recordDraw(g);
    setComboStreak(result.streak);
    setComboMilestone(result.milestone);
    if (result.milestone === "combo3") achievements.unlock("combo_3");
    if (result.milestone === "combo5") achievements.unlock("combo_5");
    if (result.milestone) {
      setTimeout(() => setComboMilestone(null), 100);
    }
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
    // Track for try_all_games achievement
    triedGamesRef.current.add(id);
    if (
      triedGamesRef.current.has("slot") &&
      triedGamesRef.current.has("claw") &&
      triedGamesRef.current.has("gacha")
    ) {
      achievements.unlock("try_all_games");
    }
  }, []);

  // ── Tutorial + Accessibility callbacks ─────────────────────────────────────
  const handleReplayTutorial = useCallback(() => {
    resetTutorialFlag(toTutorialId(activeMiniGame));
    setTutorialForced(true);
    setShowTutorial(true);
  }, [activeMiniGame]);

  // ── Screenshot callback ─────────────────────────────────────────────────────
  const handleScreenshot = useCallback(async () => {
    const container = gameContainerRef.current;
    if (!container) return;
    try {
      const currentGrade = activePhase === "phase1" ? grade : miniGrade;
      const currentPrize = activePhase === "phase1" ? prizeName : miniPrizeName;
      const currentStyle =
        activePhase === "phase1"
          ? mode
          : miniGameStyle.toUpperCase();
      const blob = await captureGameScreenshot(
        container,
        currentGrade,
        currentPrize,
        currentStyle,
      );
      const shareText = `我在 PrizeDraw 抽到了 ${currentGrade}！✨ ${currentPrize}`;
      await shareScreenshot(blob, shareText);
      sounds.playChat();
      achievements.unlock("screenshot");
    } catch (err) {
      console.error("[screenshot]", err);
    }
  }, [activePhase, grade, miniGrade, prizeName, miniPrizeName, mode, miniGameStyle]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 relative">
      {/* ── Global overlays (z-index layering: seasonal < content < combo < toast) ── */}
      <SeasonalOverlay theme={seasonalTheme} enabled={particlesEnabled} />

      {/* Time-of-day colour overlay — very subtle tint on the full page */}
      <div
        className="fixed inset-0 z-10 pointer-events-none"
        style={{ background: timeAmbient.overlay }}
        aria-hidden="true"
      />

      {/* Achievement toast — top-right, above everything */}
      <AchievementToast />

      {/* Combo display — floats in the viewport */}
      <ComboDisplay streak={comboStreak} milestone={comboMilestone} />

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

          {/* ── Game-experience toolbar ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Achievement panel toggle */}
            <button
              onClick={() => setAchievementPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-900/40 border border-amber-700/40 text-amber-300 hover:bg-amber-800/50 transition-colors"
            >
              🏆 成就 ({achievements.getStats().unlocked}/{achievements.getStats().total})
            </button>

            {/* Seasonal theme selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={seasonalTheme.id}
                onChange={(e) => {
                  const id = e.target.value;
                  setSeasonalTheme(id === "auto" ? getSeasonalTheme() : (SEASONAL_THEMES[id] ?? getSeasonalTheme()));
                }}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-full px-3 py-1 focus:border-purple-500 outline-none cursor-pointer"
              >
                <option value="auto">🔮 自動偵測</option>
                {THEME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SEASONAL_THEMES[id].icon} {SEASONAL_THEMES[id].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Particle toggle */}
            <button
              onClick={() => setParticlesEnabled((v) => !v)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                particlesEnabled
                  ? "bg-indigo-900/40 border-indigo-700/40 text-indigo-300"
                  : "bg-gray-800/40 border-gray-700/40 text-gray-500"
              }`}
            >
              {particlesEnabled ? "✨ 粒子 ON" : "✨ 粒子 OFF"}
            </button>

            {/* Time-of-day ambient label */}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-800/40 border border-gray-700/40 text-gray-400">
              {timeAmbient.label}
            </span>
          </div>

          {/* Achievement panel — collapsible, appears below toolbar */}
          {achievementPanelOpen && (
            <div className="mb-3">
              <AchievementPanel
                open={achievementPanelOpen}
                onToggle={() => setAchievementPanelOpen((v) => !v)}
              />
            </div>
          )}

          {/* Phase tabs — pill style with numeric badge */}
          <div className="flex gap-2 flex-wrap items-center">
            {PHASE_TABS.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActivePhase(tab.id)}
                className={[
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                  activePhase === tab.id
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40"
                    : "text-purple-300 hover:text-white hover:bg-white/10 border border-purple-800/40",
                ].join(" ")}
              >
                <span className={[
                  "w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center",
                  activePhase === tab.id ? "bg-white/20 text-white" : "bg-purple-900/60 text-purple-400",
                ].join(" ")}>
                  {idx + 1}
                </span>
                {tab.icon} {tab.label}
              </button>
            ))}
            {/* Compare mode toggle — only relevant for phase2 and phase3 */}
            {(activePhase === "phase2" || activePhase === "phase3") && (
              <button
                onClick={() => {
                  if (!compareMode) achievements.unlock("compare_mode");
                  setCompareMode(!compareMode);
                }}
                className={`ml-auto px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                  compareMode
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                }`}
              >
                🔀 {compareMode ? "比較模式 ON" : "比較模式"}
              </button>
            )}
          </div>

          {/* ── Dev toolbar: sound / haptic / screenshot / FPS ───────────────── */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => {
                sounds.toggle();
                setSoundEnabled(sounds.isEnabled());
              }}
              className={[
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border",
                soundEnabled
                  ? "bg-emerald-700/60 border-emerald-600/60 text-emerald-200 hover:bg-emerald-700"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700",
              ].join(" ")}
              title={soundEnabled ? "關閉音效" : "開啟音效"}
            >
              {soundEnabled ? "🔊" : "🔇"} 音效
            </button>

            <button
              onClick={() => {
                haptics.toggle();
                setHapticEnabled(haptics.isEnabled());
              }}
              className={[
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border",
                hapticEnabled
                  ? "bg-emerald-700/60 border-emerald-600/60 text-emerald-200 hover:bg-emerald-700"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700",
              ].join(" ")}
              title={hapticEnabled ? "關閉震動" : "開啟震動"}
            >
              {hapticEnabled ? "📳" : "📴"} 震動
            </button>

            <button
              onClick={() => { void handleScreenshot(); }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border bg-indigo-800/60 border-indigo-700/60 text-indigo-200 hover:bg-indigo-700 active:scale-95"
              title="截圖並分享"
            >
              📸 截圖
            </button>

            <button
              onClick={() => setShowFPS((v) => !v)}
              className={[
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border",
                showFPS
                  ? "bg-cyan-700/60 border-cyan-600/60 text-cyan-200 hover:bg-cyan-700"
                  : "bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700",
              ].join(" ")}
              title={showFPS ? "隱藏 FPS" : "顯示 FPS"}
            >
              📊 FPS
            </button>
          </div>
        </div>
      </div>

      {/* FPS performance monitor — fixed bottom-right overlay */}
      {showFPS && <FPSCounter />}

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div ref={gameContainerRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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
            {/* Style Recommendation Panel */}
            <StyleRecommendationPanel detailsRef={phase2RecommendRef} />

            {/* Description */}
            <section className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-400">
                  <span className="text-purple-300 font-semibold">Phase 2 迷你遊戲</span> — 結果預決，遊戲只是視覺演出。Canvas 2D、CSS 3D、React Three Fiber WebGL、<span className="text-yellow-400 font-semibold">Pixel Art</span>、<span className="text-pink-400 font-semibold">Neon Cyberpunk</span>、<span className="text-amber-300 font-semibold">Hand-drawn Sketch</span>、<span className="text-indigo-300 font-semibold">Minimalist Flat</span>、<span className="text-pink-300 font-semibold">Anime/Manga</span> 、<span className="text-red-400 font-semibold">楓之谷 Maple</span> 或 <span className="text-orange-400 font-semibold">仙境傳說 RO</span> 十種渲染模式可切換比較。
                </p>
                {/* Nine-way style toggle — hidden in compare mode + for bonus games */}
                {!compareMode && !["roulette", "pachinko", "scratch"].includes(activeMiniGame) && (
                  <div className="flex flex-wrap items-center gap-1 rounded-2xl p-0.5 bg-gray-800 border border-gray-700">
                    {(["2d", "css3d", "webgl", "pixel", "neon", "sketch", "flat", "anime", "maple", "ro"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setMiniGameStyle(mode);
                          handleMiniGameReset();
                          triedStylesRef.current.add(mode);
                          if (triedStylesRef.current.size >= 10) achievements.unlock("try_all_styles");
                        }}
                        className={[
                          "relative px-3 py-1 rounded-full text-xs font-bold transition-all duration-150",
                          miniGameStyle === mode
                            ? "bg-purple-600 text-white shadow"
                            : "text-gray-400 hover:text-white",
                        ].join(" ")}
                        title={mode === "anime" ? "推薦 — 最適合一番賞主題" : mode === "maple" ? "楓之谷風格 — 2D 橫版" : mode === "ro" ? "仙境傳說 — 2D 等距 RPG 風" : undefined}
                      >
                        {mode === "2d" ? "2D" : mode === "css3d" ? "CSS 3D" : mode === "webgl" ? "WebGL" : mode === "pixel" ? "Pixel" : mode === "neon" ? "Neon" : mode === "sketch" ? "Sketch" : mode === "flat" ? "Flat" : mode === "anime" ? "Anime" : mode === "maple" ? "Maple" : "RO"}
                        {mode === "anime" && (
                          <span className="absolute -top-2 -right-1 bg-amber-400 text-gray-900 text-[8px] font-black px-1 py-px rounded-full leading-none pointer-events-none">
                            推薦
                          </span>
                        )}
                        {mode === "maple" && (
                          <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[8px] font-black px-1 py-px rounded-full leading-none pointer-events-none">
                            新
                          </span>
                        )}
                      </button>
                    ))}
                    {/* Info button — toggles recommendation panel */}
                    <button
                      onClick={() => {
                        const el = phase2RecommendRef.current;
                        if (!el) return;
                        if (el.open) el.removeAttribute("open");
                        else el.setAttribute("open", "");
                        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className="ml-1 px-2 py-1 rounded-full text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                      title="風格推薦指南"
                      aria-label="開啟風格推薦指南"
                    >
                      ℹ️
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Tutorial overlay */}
            {showTutorial && (
              <GameTutorial
                gameId={toTutorialId(activeMiniGame)}
                forceShow={tutorialForced}
                onDone={() => setShowTutorial(false)}
              />
            )}

            {/* Accessibility panel */}
            <AccessibilityPanel
              open={showA11yPanel}
              onClose={() => setShowA11yPanel(false)}
            />

            {/* Game selector — pill style + difficulty + tutorial/a11y toolbar */}
            <section className="space-y-2">
              {/* Row 1: game type buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Core games */}
                {MINI_GAMES.filter((g) => !g.isBonus).map((g) => (
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
                    <span className="ml-2 text-xs font-normal opacity-70">{g.desc}</span>
                  </button>
                ))}

                {/* Divider */}
                <span className="text-gray-700 text-xs font-bold px-1">|</span>

                {/* Bonus games */}
                {MINI_GAMES.filter((g) => g.isBonus).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSwitchMiniGame(g.id)}
                    className={[
                      "relative px-4 py-2 rounded-full text-sm font-bold transition-all border",
                      activeMiniGame === g.id
                        ? "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/30"
                        : "border-amber-700/40 text-amber-400 hover:text-white hover:bg-amber-600/20",
                    ].join(" ")}
                  >
                    <span className="absolute -top-2 -right-1 bg-amber-400 text-gray-900 text-[8px] font-black px-1 py-px rounded-full leading-none pointer-events-none">
                      NEW
                    </span>
                    {g.label}
                    <span className="ml-2 text-xs font-normal opacity-70">{g.desc}</span>
                  </button>
                ))}

                {/* Tutorial + A11y toolbar */}
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={handleReplayTutorial}
                    title="重播教學"
                    aria-label="重播當前遊戲教學"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold transition-all"
                  >
                    <span aria-hidden="true">📖</span> 教學
                  </button>
                  <button
                    onClick={() => setShowA11yPanel(true)}
                    title="無障礙設定"
                    aria-label="開啟無障礙設定"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold transition-all"
                  >
                    <span aria-hidden="true">♿</span>
                  </button>
                </div>
              </div>

              {/* Row 2: difficulty selector (only for claw machine) */}
              {activeMiniGame === "claw" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">難度：</span>
                  {DIFFICULTY_ORDER.map((d) => {
                    const cfg = DIFFICULTIES[d];
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={[
                          "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                          difficulty === d
                            ? "bg-purple-600 border-purple-500 text-white shadow shadow-purple-600/30"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                        ].join(" ")}
                        title={cfg.description}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                  <span className="text-xs text-gray-600">
                    {DIFFICULTIES[difficulty].description}
                    {" · "}限時 {DIFFICULTIES[difficulty].timeLimit}s
                  </span>
                </div>
              )}
            </section>

            {/* ── Compare mode: two side-by-side game columns ────────────────── */}
            {compareMode && (
              <>
                {/* Shared controls bar */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
                    ⚙️ 共用設定
                  </h3>
                  <div className="flex flex-wrap gap-4 items-start">
                    {/* Grade selector */}
                    <div className="space-y-1.5">
                      <label className="text-gray-400 text-xs font-medium block">獎品等級</label>
                      <div className="flex gap-2 flex-wrap">
                        {MINI_GAME_GRADES.map((g) => (
                          <button
                            key={g}
                            onClick={() => {
                              setMiniGrade(g);
                              setLeftGameKey((k) => k + 1);
                              setRightGameKey((k) => k + 1);
                              setLeftGameResult(null);
                              setRightGameResult(null);
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
                    <div className="space-y-1.5 flex-1 min-w-40">
                      <label className="text-gray-400 text-xs font-medium block">獎品名稱</label>
                      <input
                        type="text"
                        value={miniPrizeName}
                        onChange={(e) => setMiniPrizeName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
                        placeholder="限定公仔"
                      />
                    </div>
                    {/* Game selector */}
                    <div className="space-y-1.5">
                      <label className="text-gray-400 text-xs font-medium block">遊戲類型</label>
                      <div className="flex gap-2">
                        {MINI_GAMES.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setActiveMiniGame(g.id);
                              setLeftGameKey((k) => k + 1);
                              setRightGameKey((k) => k + 1);
                              setLeftGameResult(null);
                              setRightGameResult(null);
                            }}
                            className={[
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              activeMiniGame === g.id
                                ? "bg-purple-600 border-purple-500 text-white"
                                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500",
                            ].join(" ")}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two game columns */}
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  {/* LEFT column */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Style dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">左側風格</span>
                      <StyleSelector value={leftStyle} onChange={(s) => { setLeftStyle(s); setLeftGameKey((k) => k + 1); setLeftGameResult(null); }} />
                    </div>
                    {/* Game */}
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                      <div className="bg-gray-950 rounded-xl overflow-hidden">
                        <MiniGameRenderer
                          style={leftStyle}
                          game={activeMiniGame}
                          gameKey={leftGameKey}
                          side="left"
                          resultGrade={miniGrade}
                          prizeName={miniPrizeName}
                          onResult={(g) => { setLeftGameResult(g); dispatchCompareLog({ type: "push", event: `LEFT RESULT: ${g}` }); }}
                          onStateChange={(s) => { setLeftGameState(s); dispatchCompareLog({ type: "push", event: `LEFT STATE → ${s}` }); }}
                        />
                      </div>
                    </div>
                    {/* Per-column controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setLeftGameKey((k) => k + 1); setLeftGameResult(null); setLeftGameState("IDLE"); dispatchCompareLog({ type: "push", event: "LEFT RESET" }); }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold py-2 rounded-lg transition-colors"
                      >
                        ↺ 重置左側
                      </button>
                    </div>
                    {/* Per-column debug */}
                    <div className="grid grid-cols-2 gap-2">
                      <DebugCell label="Style" value={leftStyle} />
                      <DebugCell label="State" value={leftGameState} />
                      <DebugCell label="Result" value={leftGameResult ?? "—"} highlight={leftGameResult !== null} />
                      <DebugCell label="Grade" value={miniGrade} />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:flex flex-col items-center self-stretch">
                    <div className="w-px flex-1 bg-gray-700/50" />
                    <span className="text-gray-600 text-xs font-bold py-2">VS</span>
                    <div className="w-px flex-1 bg-gray-700/50" />
                  </div>

                  {/* RIGHT column */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Style dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">右側風格</span>
                      <StyleSelector value={rightStyle} onChange={(s) => { setRightStyle(s); setRightGameKey((k) => k + 1); setRightGameResult(null); }} />
                    </div>
                    {/* Game */}
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                      <div className="bg-gray-950 rounded-xl overflow-hidden">
                        <MiniGameRenderer
                          style={rightStyle}
                          game={activeMiniGame}
                          gameKey={rightGameKey}
                          side="right"
                          resultGrade={miniGrade}
                          prizeName={miniPrizeName}
                          onResult={(g) => { setRightGameResult(g); dispatchCompareLog({ type: "push", event: `RIGHT RESULT: ${g}` }); }}
                          onStateChange={(s) => { setRightGameState(s); dispatchCompareLog({ type: "push", event: `RIGHT STATE → ${s}` }); }}
                        />
                      </div>
                    </div>
                    {/* Per-column controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setRightGameKey((k) => k + 1); setRightGameResult(null); setRightGameState("IDLE"); dispatchCompareLog({ type: "push", event: "RIGHT RESET" }); }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold py-2 rounded-lg transition-colors"
                      >
                        ↺ 重置右側
                      </button>
                    </div>
                    {/* Per-column debug */}
                    <div className="grid grid-cols-2 gap-2">
                      <DebugCell label="Style" value={rightStyle} />
                      <DebugCell label="State" value={rightGameState} />
                      <DebugCell label="Result" value={rightGameResult ?? "—"} highlight={rightGameResult !== null} />
                      <DebugCell label="Grade" value={miniGrade} />
                    </div>
                  </div>
                </div>

                {/* Shared compare event log */}
                <div className="bg-gray-950 rounded-xl border border-gray-800 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                      比較模式 Event Log
                    </div>
                    <button
                      onClick={() => dispatchCompareLog({ type: "clear" })}
                      className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <div ref={compareLogRef} className="space-y-0.5 max-h-32 overflow-y-auto">
                    {compareLogs.length === 0 ? (
                      <p className="text-gray-700 p-1">No events yet — play either side.</p>
                    ) : (
                      compareLogs.map((entry) => (
                        <div key={entry.id} className="flex gap-3 items-baseline">
                          <span className="text-gray-600 shrink-0">
                            {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                              hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })}
                          </span>
                          <span className={
                            entry.event.includes("RESULT") ? "text-emerald-400"
                            : entry.event.includes("RESET") ? "text-amber-400"
                            : entry.event.includes("STATE") ? "text-cyan-400"
                            : "text-gray-400"
                          }>
                            {entry.event}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Single-view mode (existing layout) ──────────────────────────── */}
            {!compareMode && (
            <>
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
                      ) : miniGameStyle === "maple" ? (
                        /* MapleStory versions — slot only, others show WIP */
                        <>
                          {activeMiniGame === "slot" && (
                            <SlotMachineMaple
                              key={`maple-slot-${miniGameKey}`}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {(activeMiniGame === "claw" || activeMiniGame === "gacha") && (
                            <div className="flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-amber-950/40 to-red-950/40 border-2 border-red-800/40" style={{ width: 340, height: 480 }}>
                              <span className="text-4xl">🍁</span>
                              <p className="text-red-300 font-bold text-sm">楓之谷 {activeMiniGame === "claw" ? "夾娃娃機" : "扭蛋機"}</p>
                              <p className="text-gray-500 text-xs">開發中 — Coming Soon</p>
                            </div>
                          )}
                        </>
                      ) : (
                        /* 2D Canvas versions + bonus games */
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
                          {activeMiniGame === "roulette" && (
                            <RouletteGame
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "pachinko" && (
                            <PachinkoGame
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
                            />
                          )}
                          {activeMiniGame === "scratch" && (
                            <ScratchCardGame
                              key={miniGameKey}
                              resultGrade={miniGrade}
                              prizeName={miniPrizeName}
                              onResult={handleMiniGameResult}
                              onStateChange={(s) => handleMiniGameStateChange(s as SlotGameState)}
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
                      {miniGameStyle === "webgl" ? " (WebGL 3D)" : miniGameStyle === "css3d" ? " (CSS 3D)" : miniGameStyle === "pixel" ? " (Pixel Art)" : miniGameStyle === "neon" ? " (Neon Cyberpunk)" : miniGameStyle === "sketch" ? " (Hand-drawn Sketch)" : miniGameStyle === "flat" ? " (Minimalist Flat)" : miniGameStyle === "anime" ? " (Anime/Manga)" : miniGameStyle === "maple" ? " (楓之谷 Maple)" : " (2D Canvas)"}
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
            </> /* end !compareMode single-view */
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PHASE 3: 2.5D Room
            ════════════════════════════════════════════════════════════════════ */}
        {activePhase === "phase3" && (
          <>
            {/* Style Recommendation Panel */}
            <StyleRecommendationPanel detailsRef={phase3RecommendRef} />

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
                    : roomStyle === "maple"
                    ? "楓之谷 2D 橫版場景。日落視差背景（天空/丘陵/室內三層），可愛 Chibi 角色（超大頭比例），彩色爆炸頭髮，大圓眼雙亮點，名牌標籤，楓葉飄落。點擊地板移動角色，點擊櫃台抽獎，獎品從天而降帶閃光拖尾。"
                    : "等距視角（isometric）的虛擬商店。點擊地板移動角色，NPC 自動走動並定期抽獎。純 Canvas API + A* 尋路。"}
                </p>
                {/* Nine-way style toggle — hidden in compare mode */}
                {!compareMode && (
                  <div className="flex flex-wrap items-center gap-1 rounded-2xl p-0.5 bg-gray-800 border border-gray-700">
                    {(["2d", "css3d", "webgl", "pixel", "neon", "sketch", "flat", "anime", "maple", "ro"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setRoomStyle(mode)}
                        className={[
                          "relative px-3 py-1 rounded-full text-xs font-bold transition-all duration-150",
                          roomStyle === mode
                            ? "bg-purple-600 text-white shadow"
                            : "text-gray-400 hover:text-white",
                        ].join(" ")}
                        title={mode === "anime" ? "推薦 — 最適合一番賞主題" : mode === "maple" ? "楓之谷風格 — 2D 橫版側視" : undefined}
                      >
                        {mode === "2d" ? "2D" : mode === "css3d" ? "CSS 3D" : mode === "webgl" ? "WebGL" : mode === "pixel" ? "Pixel" : mode === "neon" ? "Neon" : mode === "sketch" ? "Sketch" : mode === "flat" ? "Flat" : mode === "anime" ? "Anime" : mode === "maple" ? "Maple" : "RO"}
                        {mode === "anime" && (
                          <span className="absolute -top-2 -right-1 bg-amber-400 text-gray-900 text-[8px] font-black px-1 py-px rounded-full leading-none pointer-events-none">
                            推薦
                          </span>
                        )}
                        {mode === "maple" && (
                          <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[8px] font-black px-1 py-px rounded-full leading-none pointer-events-none">
                            新
                          </span>
                        )}
                      </button>
                    ))}
                    {/* Info button — toggles recommendation panel */}
                    <button
                      onClick={() => {
                        const el = phase3RecommendRef.current;
                        if (!el) return;
                        if (el.open) el.removeAttribute("open");
                        else el.setAttribute("open", "");
                        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className="ml-1 px-2 py-1 rounded-full text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                      title="風格推薦指南"
                      aria-label="開啟風格推薦指南"
                    >
                      ℹ️
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── Compare mode: two side-by-side room columns ─────────────────── */}
            {compareMode && (
              <>
                {/* Shared NPC count control */}
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-3">
                    ⚙️ 共用設定
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

                {/* Two room columns */}
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  {/* LEFT room column */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">左側風格</span>
                      <StyleSelector value={leftStyle} onChange={setLeftStyle} />
                    </div>
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                      <div className={["bg-gray-950 rounded-xl", leftStyle === "webgl" ? "overflow-hidden" : "overflow-x-auto"].join(" ")}>
                        <RoomRenderer
                          style={leftStyle}
                          npcCount={npcCount}
                          side="left"
                          resultGrade={miniGameResult ?? undefined}
                          onDrawResult={(g) => dispatchCompareLog({ type: "push", event: `LEFT ROOM_DRAW: ${g}` })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-xs text-gray-600 font-mono bg-gray-800 px-2 py-1 rounded">
                        {leftStyle === "webgl" ? "真 3D — 拖曳旋轉" : leftStyle === "css3d" ? "CSS 3D 房間" : leftStyle === "pixel" ? "Pixel Art 商店" : leftStyle === "neon" ? "Neon Cyberpunk" : leftStyle === "sketch" ? "Hand-drawn Sketch" : leftStyle === "flat" ? "Minimalist Flat" : leftStyle === "anime" ? "Anime/Manga 店" : leftStyle === "maple" ? "楓之谷 Maple 橫版店" : "2.5D 等距房間"}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:flex flex-col items-center self-stretch">
                    <div className="w-px flex-1 bg-gray-700/50" />
                    <span className="text-gray-600 text-xs font-bold py-2">VS</span>
                    <div className="w-px flex-1 bg-gray-700/50" />
                  </div>

                  {/* RIGHT room column */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">右側風格</span>
                      <StyleSelector value={rightStyle} onChange={setRightStyle} />
                    </div>
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1.5 shadow-2xl shadow-purple-900/20">
                      <div className={["bg-gray-950 rounded-xl", rightStyle === "webgl" ? "overflow-hidden" : "overflow-x-auto"].join(" ")}>
                        <RoomRenderer
                          style={rightStyle}
                          npcCount={npcCount}
                          side="right"
                          resultGrade={miniGameResult ?? undefined}
                          onDrawResult={(g) => dispatchCompareLog({ type: "push", event: `RIGHT ROOM_DRAW: ${g}` })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-xs text-gray-600 font-mono bg-gray-800 px-2 py-1 rounded">
                        {rightStyle === "webgl" ? "真 3D — 拖曳旋轉" : rightStyle === "css3d" ? "CSS 3D 房間" : rightStyle === "pixel" ? "Pixel Art 商店" : rightStyle === "neon" ? "Neon Cyberpunk" : rightStyle === "sketch" ? "Hand-drawn Sketch" : rightStyle === "flat" ? "Minimalist Flat" : rightStyle === "anime" ? "Anime/Manga 店" : rightStyle === "maple" ? "楓之谷 Maple 橫版店" : "2.5D 等距房間"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shared compare event log */}
                <div className="bg-gray-950 rounded-xl border border-gray-800 p-3 font-mono text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
                      比較模式 Event Log
                    </div>
                    <button
                      onClick={() => dispatchCompareLog({ type: "clear" })}
                      className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <div ref={compareLogRef} className="space-y-0.5 max-h-32 overflow-y-auto">
                    {compareLogs.length === 0 ? (
                      <p className="text-gray-700 p-1">No events yet.</p>
                    ) : (
                      compareLogs.map((entry) => (
                        <div key={entry.id} className="flex gap-3 items-baseline">
                          <span className="text-gray-600 shrink-0">
                            {new Date(entry.ts).toLocaleTimeString("zh-TW", {
                              hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })}
                          </span>
                          <span className={
                            entry.event.includes("RESULT") || entry.event.includes("DRAW") ? "text-emerald-400"
                            : entry.event.includes("RESET") ? "text-amber-400"
                            : "text-gray-400"
                          }>
                            {entry.event}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Single-view mode (existing layout) ──────────────────────────── */}
            {!compareMode && (
            <>
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
                      ) : roomStyle === "maple" ? (
                        <PrizeRoomMaple
                          key={`maple-room-${npcCount}`}
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
                        : roomStyle === "maple"
                        ? "楓之谷 Maple — 2D 橫版，視差背景，Chibi 超大頭，楓葉飄落"
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
                  ) : roomStyle === "maple" ? (
                    <>
                      <DebugCell label="渲染" value="楓之谷 Maple" highlight />
                      <DebugCell label="解析度" value="520×380" />
                      <DebugCell label="特效" value="視差背景 + 楓葉 + 道具掉落" />
                      <DebugCell label="模式" value="2D 橫版側視" highlight />
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
            </> /* end !compareMode single-view */
            )}
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

// ─────────────────────────────────────────────────────────────────────────────
// StyleSelector — compact dropdown for compare mode
// ─────────────────────────────────────────────────────────────────────────────

function StyleSelector({
  value,
  onChange,
}: {
  value: StyleMode;
  onChange: (s: StyleMode) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as StyleMode)}
      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors cursor-pointer"
    >
      <option value="2d">2D Canvas</option>
      <option value="css3d">CSS 3D</option>
      <option value="webgl">WebGL 3D</option>
      <option value="pixel">Pixel Art</option>
      <option value="neon">Neon</option>
      <option value="sketch">Sketch</option>
      <option value="flat">Flat</option>
      <option value="anime">Anime 🌸 推薦</option>
      <option value="maple">Maple 🍁 楓之谷</option>
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniGameRenderer — renders the correct mini-game component for a given style
// Used only in compare mode so each pane is fully independent
// ─────────────────────────────────────────────────────────────────────────────

interface MiniGameRendererProps {
  style: StyleMode;
  game: MiniGameId;
  gameKey: number;
  side: "left" | "right";
  resultGrade: string;
  prizeName: string;
  onResult: (g: string) => void;
  onStateChange: (s: SlotGameState | ClawGameState | GachaGameState) => void;
}

function MiniGameRenderer({
  style,
  game,
  gameKey,
  side,
  resultGrade,
  prizeName,
  onResult,
  onStateChange,
}: MiniGameRendererProps) {
  const prefix = `compare-${side}`;

  if (style === "webgl") {
    if (game === "slot") return <SlotMachine3D key={`${prefix}-3d-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachine3D key={`${prefix}-3d-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachine3D key={`${prefix}-3d-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "css3d") {
    if (game === "slot") return <SlotMachineCSS3D key={`${prefix}-css3d-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachineCSS3D key={`${prefix}-css3d-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachineCSS3D key={`${prefix}-css3d-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "pixel") {
    if (game === "slot") return <SlotMachinePixel key={`${prefix}-pixel-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachinePixel key={`${prefix}-pixel-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachinePixel key={`${prefix}-pixel-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "neon") {
    if (game === "slot") return <SlotMachineNeon key={`${prefix}-neon-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachineNeon key={`${prefix}-neon-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachineNeon key={`${prefix}-neon-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "sketch") {
    if (game === "slot") return <SlotMachineSketch key={`${prefix}-sketch-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachineSketch key={`${prefix}-sketch-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachineSketch key={`${prefix}-sketch-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "flat") {
    if (game === "slot") return <SlotMachineFlat key={`${prefix}-flat-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachineFlat key={`${prefix}-flat-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachineFlat key={`${prefix}-flat-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  if (style === "anime") {
    if (game === "slot") return <SlotMachineAnime key={`${prefix}-anime-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
    if (game === "claw") return <ClawMachineAnime key={`${prefix}-anime-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as ClawGameState)} />;
    return <GachaMachineAnime key={`${prefix}-anime-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as GachaGameState)} />;
  }
  // 2D Canvas fallback
  if (game === "slot") return <SlotMachine key={`${prefix}-2d-slot-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={onStateChange} />;
  if (game === "claw") return <ClawMachine key={`${prefix}-2d-claw-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={onStateChange} />;
  if (game === "gacha") return <GachaMachine key={`${prefix}-2d-gacha-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={onStateChange} />;
  // Bonus games — always 2D, style has no effect
  if (game === "roulette") return <RouletteGame key={`${prefix}-roulette-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
  if (game === "pachinko") return <PachinkoGame key={`${prefix}-pachinko-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
  return <ScratchCardGame key={`${prefix}-scratch-${gameKey}`} resultGrade={resultGrade} prizeName={prizeName} onResult={onResult} onStateChange={(s) => onStateChange(s as SlotGameState)} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomRenderer — renders the correct room component for a given style
// Used only in compare mode so each pane is fully independent
// ─────────────────────────────────────────────────────────────────────────────

interface RoomRendererProps {
  style: StyleMode;
  npcCount: number;
  side: "left" | "right";
  resultGrade?: string;
  onDrawResult?: (grade: string) => void;
}

function RoomRenderer({ style, npcCount, side, resultGrade, onDrawResult }: RoomRendererProps) {
  const prefix = `compare-room-${side}`;

  if (style === "webgl") {
    return (
      <PrizeDrawRoom3D
        key={`${prefix}-3d-${npcCount}`}
        npcCount={npcCount}
        onStateChange={() => undefined}
      />
    );
  }
  if (style === "css3d") {
    return (
      <PrizeRoomCSS3D
        key={`${prefix}-css3d-${npcCount}`}
        npcCount={npcCount}
        onStateChange={() => undefined}
      />
    );
  }
  if (style === "pixel") {
    return (
      <PrizeRoomPixel
        key={`${prefix}-pixel-${npcCount}`}
        npcCount={npcCount}
        resultGrade={resultGrade}
      />
    );
  }
  if (style === "neon") {
    return (
      <PrizeRoomNeon
        key={`${prefix}-neon-${npcCount}`}
        npcCount={npcCount}
        resultGrade={resultGrade}
      />
    );
  }
  if (style === "sketch") {
    return (
      <PrizeRoomSketch
        key={`${prefix}-sketch-${npcCount}`}
        npcCount={npcCount}
        resultGrade={resultGrade}
        onDrawResult={onDrawResult}
      />
    );
  }
  if (style === "flat") {
    return (
      <PrizeRoomFlat
        key={`${prefix}-flat-${npcCount}`}
        npcCount={npcCount}
        resultGrade={resultGrade}
        onDrawResult={onDrawResult}
      />
    );
  }
  if (style === "anime") {
    return (
      <PrizeRoomAnime
        key={`${prefix}-anime-${npcCount}`}
        npcCount={npcCount}
        onDrawResult={onDrawResult}
      />
    );
  }
  // 2D isometric fallback
  return (
    <IsometricRoom
      key={`${prefix}-2d-${npcCount}`}
      npcCount={npcCount}
      onStateChange={() => undefined}
    />
  );
}
