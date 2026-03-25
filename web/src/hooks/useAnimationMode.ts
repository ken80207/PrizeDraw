import { useCallback, useState } from "react";
import type { AnimationMode } from "@/animations/AnimatedReveal";

/**
 * Hook that manages the player's preferred animation mode.
 *
 * Reads the initial mode from the player profile store. When a mode is disabled
 * server-side the server already returns `INSTANT` in the profile, so this hook
 * simply surfaces whatever mode is stored.
 *
 * @returns The current animation mode and a setter that persists the preference
 *          via `PATCH /api/v1/players/me/preferences/animation`.
 */
export function useAnimationMode(initialMode: AnimationMode = "INSTANT") {
  const [mode, setModeLocal] = useState<AnimationMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMode = useCallback(async (newMode: AnimationMode) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/players/me/preferences/animation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setModeLocal(newMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save animation preference");
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { mode, setMode, isSaving, error };
}
