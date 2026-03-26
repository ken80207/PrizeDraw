"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  /** CSS selector or descriptive area identifier */
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  /** Whether to render a spotlight cutout around the target area */
  highlight?: boolean;
}

export type TutorialGameId = "slot" | "claw" | "gacha" | "roulette" | "pachinko" | "scratch";

interface GameTutorialProps {
  gameId: TutorialGameId;
  /** Force the tutorial to show regardless of localStorage flag */
  forceShow?: boolean;
  /** Called when tutorial finishes or is skipped */
  onDone?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tutorial step definitions
// ─────────────────────────────────────────────────────────────────────────────

export const SLOT_TUTORIAL: TutorialStep[] = [
  {
    target: "lever",
    title: "拉桿",
    description: "拖拉這個拉桿開始轉動",
    position: "left",
    highlight: true,
  },
  {
    target: "reels",
    title: "轉盤",
    description: "三個轉盤會依序停下",
    position: "bottom",
  },
  {
    target: "result",
    title: "結果",
    description: "中間那列就是你的獎品！",
    position: "top",
  },
];

export const CLAW_TUTORIAL: TutorialStep[] = [
  {
    target: "arrows",
    title: "移動",
    description: "用箭頭按鈕左右移動夾子",
    position: "bottom",
    highlight: true,
  },
  {
    target: "drop",
    title: "下爪",
    description: "按下按鈕放下夾子",
    position: "left",
  },
  {
    target: "prizes",
    title: "獎品",
    description: "夾到的獎品會掉到出口",
    position: "top",
  },
];

export const GACHA_TUTORIAL: TutorialStep[] = [
  {
    target: "handle",
    title: "把手",
    description: "點擊旋轉把手投幣",
    position: "left",
    highlight: true,
  },
  {
    target: "dome",
    title: "扭蛋球",
    description: "扭蛋會從出口掉出來",
    position: "bottom",
  },
  {
    target: "capsule",
    title: "開啟",
    description: "點擊扭蛋打開看結果",
    position: "top",
  },
];

export const ROULETTE_TUTORIAL: TutorialStep[] = [
  {
    target: "wheel",
    title: "轉盤",
    description: "點擊轉盤讓它旋轉",
    position: "bottom",
    highlight: true,
  },
  {
    target: "pointer",
    title: "指針",
    description: "指針指向的格子就是你的獎品",
    position: "top",
  },
  {
    target: "result",
    title: "結果",
    description: "停下後發光的格子即獲獎！",
    position: "left",
  },
];

export const PACHINKO_TUTORIAL: TutorialStep[] = [
  {
    target: "ball",
    title: "彈珠",
    description: "彈珠從頂部掉落",
    position: "bottom",
    highlight: true,
  },
  {
    target: "pegs",
    title: "釘子",
    description: "彈珠碰到釘子會反彈",
    position: "right",
  },
  {
    target: "slots",
    title: "獎品格",
    description: "彈珠落入的格子就是獎品！",
    position: "top",
  },
];

export const SCRATCH_TUTORIAL: TutorialStep[] = [
  {
    target: "card",
    title: "刮刮卡",
    description: "用滑鼠刮開銀色區域",
    position: "bottom",
    highlight: true,
  },
  {
    target: "grid",
    title: "3x3 格子",
    description: "刮開所有格子查看等級",
    position: "top",
  },
  {
    target: "match",
    title: "配對",
    description: "三個相同等級即獲獎！",
    position: "left",
  },
];

const TUTORIALS: Record<TutorialGameId, TutorialStep[]> = {
  slot: SLOT_TUTORIAL,
  claw: CLAW_TUTORIAL,
  gacha: GACHA_TUTORIAL,
  roulette: ROULETTE_TUTORIAL,
  pachinko: PACHINKO_TUTORIAL,
  scratch: SCRATCH_TUTORIAL,
};

function storageKey(gameId: TutorialGameId): string {
  return `prizedraw_tutorial_seen_${gameId}`;
}

function markSeen(gameId: TutorialGameId): void {
  try {
    localStorage.setItem(storageKey(gameId), "1");
  } catch {
    // ignore
  }
}

function hasSeen(gameId: TutorialGameId): boolean {
  try {
    return localStorage.getItem(storageKey(gameId)) === "1";
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GameTutorial({ gameId, forceShow = false, onDone }: GameTutorialProps) {
  const steps = TUTORIALS[gameId];
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Decide whether to show on mount
  useEffect(() => {
    if (forceShow || !hasSeen(gameId)) {
      setStepIndex(0);
      setVisible(true);
    }
  }, [gameId, forceShow]);

  const dismiss = useCallback(() => {
    markSeen(gameId);
    setVisible(false);
    onDone?.();
  }, [gameId, onDone]);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  }, [stepIndex, steps.length, dismiss]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!visible) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Tooltip positioning classes
  const tooltipPositionClass: Record<TutorialStep["position"], string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-3",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-3",
    left: "right-full top-1/2 -translate-y-1/2 mr-3",
    right: "left-full top-1/2 -translate-y-1/2 ml-3",
  };

  // Arrow classes
  const arrowClass: Record<TutorialStep["position"], string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`教學步驟 ${stepIndex + 1} / ${steps.length}`}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Centred tooltip card — positioned relative to overlay centre */}
      <div className="relative z-10 max-w-xs w-full mx-4">
        {/* Spotlight indicator (decorative) */}
        {step.highlight && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-purple-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none animate-pulse" />
        )}

        {/* Tooltip card */}
        <div className="bg-gray-800 border border-purple-600/50 rounded-2xl shadow-2xl shadow-purple-900/40 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-700">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-5 space-y-3">
            {/* Step counter + title */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-purple-400 text-xs font-mono font-bold">
                {stepIndex + 1} / {steps.length}
              </span>
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full font-mono">
                {step.target}
              </span>
            </div>

            <div>
              <h3 className="text-white font-black text-lg leading-tight">{step.title}</h3>
              <p className="text-gray-300 text-sm mt-1 leading-relaxed">{step.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {stepIndex > 0 && (
                <button
                  onClick={prev}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold transition-colors"
                >
                  上一步
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-sm font-bold transition-all shadow-lg shadow-purple-600/30"
              >
                {isLast ? "完成！" : "下一步"}
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors hover:bg-gray-700"
              >
                跳過
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointer (decorative) */}
        <div
          className={`absolute border-8 ${arrowClass[step.position]} hidden`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — programmatically reset the "seen" flag (for settings page)
// ─────────────────────────────────────────────────────────────────────────────

export function resetTutorialFlag(gameId: TutorialGameId): void {
  try {
    localStorage.removeItem(storageKey(gameId));
  } catch {
    // ignore
  }
}

export function resetAllTutorialFlags(): void {
  const ids: TutorialGameId[] = ["slot", "claw", "gacha", "roulette", "pachinko", "scratch"];
  ids.forEach(resetTutorialFlag);
}
