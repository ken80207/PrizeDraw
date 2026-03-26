"use client";

import { useState, useEffect, useCallback } from "react";
import { achievements } from "@/lib/achievements";
import type { Achievement } from "@/lib/achievements";

interface AchievementPanelProps {
  /** Whether the panel is expanded. Controlled externally so parent can manage toggle. */
  open: boolean;
  onToggle: () => void;
}

/** Collapsible achievement panel showing all achievements and progress. */
export function AchievementPanel({ open, onToggle }: AchievementPanelProps) {
  const [all, setAll] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({ total: 0, unlocked: 0 });

  const refresh = useCallback(() => {
    setAll(achievements.getAll());
    setStats(achievements.getStats());
  }, []);

  useEffect(() => {
    refresh();
    // Re-render when a new achievement is unlocked
    const unsubscribe = achievements.onUnlock(() => refresh());
    return unsubscribe;
  }, [refresh]);

  const handleReset = useCallback(() => {
    if (!confirm("確定要重置所有成就嗎？")) return;
    achievements.reset();
    refresh();
  }, [refresh]);

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-900/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-amber-300">
          <span>🏆</span>
          <span>成就</span>
          <span className="text-amber-400 text-xs font-normal">
            {stats.unlocked}/{stats.total} 已解鎖
          </span>
        </span>
        <svg
          className={`w-4 h-4 text-amber-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Progress bar */}
          <div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.unlocked / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Achievement grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((a) => {
              const unlocked = a.unlockedAt !== undefined;
              return (
                <div
                  key={a.id}
                  title={unlocked ? `解鎖於 ${new Date(a.unlockedAt!).toLocaleDateString("zh-TW")}` : "尚未解鎖"}
                  className={[
                    "rounded-xl border p-3 flex flex-col items-center gap-1 text-center transition-all",
                    unlocked
                      ? "border-amber-600/50 bg-amber-900/20"
                      : "border-gray-700/50 bg-gray-800/30 opacity-45 grayscale",
                  ].join(" ")}
                >
                  <span
                    className="text-2xl"
                    role="img"
                    aria-label={a.title}
                  >
                    {a.icon}
                  </span>
                  <span className={`text-xs font-bold leading-tight ${unlocked ? "text-amber-200" : "text-gray-500"}`}>
                    {a.title}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-tight">{a.description}</span>
                  {unlocked && a.unlockedAt && (
                    <span className="text-[9px] text-amber-600 mt-0.5">
                      {new Date(a.unlockedAt).toLocaleDateString("zh-TW")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reset button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleReset}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded"
            >
              重置所有成就
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
