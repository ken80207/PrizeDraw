"use client";

import { useEffect, useRef, useState } from "react";

interface ComboDisplayProps {
  streak: number;
  /** If provided, a milestone flash is shown (combo3 / combo5 / combo10) */
  milestone?: string | null;
}

const MILESTONE_CONFIG: Record<string, { label: string; color: string; size: string; emoji: string }> = {
  combo3:  { label: "3 COMBO!",  color: "#f59e0b", size: "text-4xl", emoji: "🔥" },
  combo5:  { label: "5 COMBO!",  color: "#ef4444", size: "text-5xl", emoji: "💥" },
  combo10: { label: "10 COMBO!", color: "#a855f7", size: "text-6xl", emoji: "⚡" },
};

/**
 * Floating combo counter overlay.
 * Shows a persistent streak badge when streak > 0, and a full-screen flash at
 * milestone values (3, 5, 10).
 */
export function ComboDisplay({ streak, milestone }: ComboDisplayProps) {
  // Snapshot the milestone so we can display it even after the prop clears
  const [activeMilestone, setActiveMilestone] = useState<string | null>(null);
  // Controls the fade-out — set via setTimeout, not synchronously in the effect
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!milestone) return;

    // Schedule the state update slightly deferred to satisfy set-state-in-effect rule
    const showTimer = setTimeout(() => {
      setActiveMilestone(milestone);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setActiveMilestone(null), 2000);
    }, 0);

    return () => {
      clearTimeout(showTimer);
    };
  }, [milestone]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const mConfig = activeMilestone ? MILESTONE_CONFIG[activeMilestone] : null;

  if (streak <= 0 && !activeMilestone) return null;

  return (
    <>
      {/* Persistent streak counter — top-right */}
      {streak > 0 && (
        <div className="fixed top-20 right-4 z-40 pointer-events-none">
          <div className="text-center select-none">
            <div
              className="text-4xl font-black"
              style={{
                color: "#fbbf24",
                textShadow: "0 0 20px rgba(245,158,11,0.5)",
                lineHeight: 1,
              }}
            >
              {streak}x
            </div>
            <div className="text-xs text-amber-300 font-bold tracking-widest mt-0.5">
              COMBO!
            </div>
          </div>
        </div>
      )}

      {/* Full-screen milestone flash */}
      {activeMilestone && mConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ animation: "comboFlash 2s ease-out forwards" }}
        >
          <div
            className={`font-black ${mConfig.size} select-none`}
            style={{
              color: mConfig.color,
              textShadow: `0 0 40px ${mConfig.color}cc, 0 0 80px ${mConfig.color}66`,
              animation: "comboPop 2s ease-out forwards",
            }}
          >
            {mConfig.emoji} {mConfig.label}
          </div>

          <style>{`
            @keyframes comboFlash {
              0%   { background: rgba(245,158,11,0.15); }
              20%  { background: rgba(245,158,11,0.08); }
              100% { background: transparent; }
            }
            @keyframes comboPop {
              0%   { transform: scale(0.5); opacity: 0; }
              20%  { transform: scale(1.15); opacity: 1; }
              40%  { transform: scale(1); opacity: 1; }
              80%  { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.8); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
