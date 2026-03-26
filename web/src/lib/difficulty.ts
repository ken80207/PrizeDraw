// ─────────────────────────────────────────────────────────────────────────────
// Difficulty system — for claw machine (most skill-dependent game)
//
// IMPORTANT: The result is ALWAYS pre-determined. Difficulty only changes the
// visual experience (how hard it looks), never the actual outcome.
// ─────────────────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "normal" | "hard";

export interface DifficultyConfig {
  label: string;
  icon: string;
  /** How many pixels the claw sways left/right */
  clawSwayAmount: number;
  /** Sway frequency in Hz */
  clawSwaySpeed: number;
  /** ms before the claw grabs (simulates reaction-time window) */
  grabSuccessDelay: number;
  /** Chance (0–1) of a purely visual "oops, almost dropped it" animation */
  dropChance: number;
  /** Total seconds the player has to complete their turn */
  timeLimit: number;
  description: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "簡單",
    icon: "😊",
    clawSwayAmount: 0,
    clawSwaySpeed: 0,
    grabSuccessDelay: 0,
    dropChance: 0,
    timeLimit: 60,
    description: "夾子穩定不晃動，適合新手",
  },
  normal: {
    label: "普通",
    icon: "🎯",
    clawSwayAmount: 3,
    clawSwaySpeed: 0.5,
    grabSuccessDelay: 200,
    dropChance: 0,
    timeLimit: 30,
    description: "夾子微微晃動，考驗手感",
  },
  hard: {
    label: "困難",
    icon: "💀",
    clawSwayAmount: 8,
    clawSwaySpeed: 1.2,
    grabSuccessDelay: 400,
    dropChance: 0.15,
    timeLimit: 15,
    description: "夾子劇烈晃動，時間緊迫",
  },
};

/** Ordered array for iteration (easy → normal → hard). */
export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];
