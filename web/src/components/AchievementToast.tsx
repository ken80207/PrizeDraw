"use client";

import { useEffect, useState } from "react";
import { achievements } from "@/lib/achievements";
import type { Achievement } from "@/lib/achievements";

interface ToastEntry {
  id: number;
  achievement: Achievement;
}

let _toastCounter = 0;

/**
 * Renders a stack of achievement unlock toasts.
 * Mount this once at the top of the app / page.
 */
export function AchievementToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const unsubscribe = achievements.onUnlock((achievement) => {
      const id = ++_toastCounter;
      setToasts((prev) => [...prev, { id, achievement }]);

      // Auto-remove after 3.5 s (toast display + slide-out time)
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((entry) => (
        <AchievementToastCard key={entry.id} achievement={entry.achievement} />
      ))}
    </div>
  );
}

function AchievementToastCard({ achievement }: { achievement: Achievement }) {
  const [visible, setVisible] = useState(false);

  // Trigger entrance on next tick
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 16);
    // Begin exit animation 3 s after entrance
    const exit = setTimeout(() => setVisible(false), 3000);
    return () => { clearTimeout(t); clearTimeout(exit); };
  }, []);

  return (
    <div
      style={{
        transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
        transform: visible ? "translateX(0)" : "translateX(calc(100% + 1rem))",
        opacity: visible ? 1 : 0,
        pointerEvents: "auto",
      }}
    >
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 min-w-56 max-w-xs">
        <span className="text-3xl shrink-0" role="img" aria-label={achievement.title}>
          {achievement.icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs opacity-80 font-medium">🏆 成就解鎖！</div>
          <div className="font-bold text-sm truncate">{achievement.title}</div>
          <div className="text-xs opacity-70 leading-tight">{achievement.description}</div>
        </div>
      </div>
    </div>
  );
}
