"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { achievements } from "@/lib/achievements";
import type { Achievement } from "@/lib/achievements";

interface AchievementPanelProps {
  /** Whether the panel is expanded. Controlled externally so parent can manage toggle. */
  open: boolean;
  onToggle: () => void;
}

/** Collapsible achievement panel showing all achievements and progress. */
export function AchievementPanel({ open, onToggle }: AchievementPanelProps) {
  const t = useTranslations("achievement");
  // Lazily initialise so first render is populated without a synchronous setState in an effect
  const [all, setAll] = useState<Achievement[]>(() => achievements.getAll());
  const [stats, setStats] = useState(() => achievements.getStats());

  const refresh = useCallback(() => {
    setAll(achievements.getAll());
    setStats(achievements.getStats());
  }, []);

  useEffect(() => {
    // Re-render whenever a new achievement is unlocked (callback — not synchronous setState)
    const unsubscribe = achievements.onUnlock(() => refresh());
    return unsubscribe;
  }, [refresh]);

  const handleReset = useCallback(() => {
    if (!confirm(t("resetConfirm"))) return;
    achievements.reset();
    refresh();
  }, [refresh, t]);

  return (
    <div className="rounded-lg bg-surface-container overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-container-high transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-primary">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
          <span className="font-headline">{t("title")}</span>
          <span className="text-on-surface-variant text-xs font-normal">
            {stats.unlocked}/{stats.total}
          </span>
        </span>
        <span className={`material-symbols-outlined text-sm text-primary transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Progress bar */}
          <div>
            <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500"
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
                  title={unlocked
                    ? t("unlockedAt", { date: new Date(a.unlockedAt!).toLocaleDateString("zh-TW") })
                    : t("notYetUnlocked")}
                  className={[
                    "rounded-lg p-3 flex flex-col items-center gap-1 text-center transition-all",
                    unlocked
                      ? "bg-primary/10"
                      : "bg-surface-container-high opacity-45 grayscale",
                  ].join(" ")}
                >
                  <span
                    className="text-2xl"
                    role="img"
                    aria-label={a.title}
                  >
                    {a.icon}
                  </span>
                  <span className={`text-xs font-bold leading-tight ${unlocked ? "text-primary" : "text-on-surface-variant/50"}`}>
                    {a.title}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/50 leading-tight">{a.description}</span>
                  {unlocked && a.unlockedAt && (
                    <span className="text-[9px] text-primary-container mt-0.5">
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
              className="text-xs text-on-surface-variant/40 hover:text-error transition-colors px-2 py-1 rounded"
            >
              {t("resetAll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
