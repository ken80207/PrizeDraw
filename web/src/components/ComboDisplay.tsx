"use client";

import { useEffect, useState } from "react";

interface ComboDisplayProps {
  streak: number;
  /** If provided, a milestone flash is shown (combo3 / combo5 / combo10) */
  milestone?: string | null;
}

/**
 * Floating combo counter overlay.
 * Renders nothing when streak is 0.
 */
export function ComboDisplay({ streak, milestone }: ComboDisplayProps) {
  const [showMilestone, setShowMilestone] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState<string | null>(null);

  useEffect(() => {
    if (!milestone) return;
    setCurrentMilestone(milestone);
    setShowMilestone(true);
    const t = setTimeout(() => setShowMilestone(false), 2000);
    return () => clearTimeout(t);
  }, [milestone]);

  if (streak <= 0 && !showMilestone) return null;

  const milestoneConfig: Record<string, { label: string; color: string; size: string }> = {
    combo3:  { label: "3 COMBO!", color: "#f59e0b", size: "text-4xl" },
    combo5:  { label: "5 COMBO!", color: "#ef4444", size: "text-5xl" },
    combo10: { label: "10 COMBO!", color: "#a855f7", size: "text-6xl" },
  };

  const mConfig = currentMilestone ? milestoneConfig[currentMilestone] : null;

  return (
    <>
      {/* Persistent streak counter */}
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
      {showMilestone && mConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            animation: "comboFlash 2s ease-out forwards",
          }}
        >
          <div
            className={`font-black ${mConfig.size} select-none`}
            style={{
              color: mConfig.color,
              textShadow: `0 0 40px ${mConfig.color}cc, 0 0 80px ${mConfig.color}66`,
              animation: "comboPop 2s ease-out forwards",
            }}
          >
            {currentMilestone === "combo3" ? "🔥" : currentMilestone === "combo5" ? "💥" : "⚡"}{" "}
            {mConfig.label}
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
