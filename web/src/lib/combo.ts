// Combo tracker — tracks consecutive high-grade draws

export type ComboMilestone = "combo3" | "combo5" | "combo10" | null;

export interface ComboResult {
  streak: number;
  broken: boolean;
  previousStreak: number;
  milestone: ComboMilestone;
}

const GOOD_GRADES = new Set(["A賞", "B賞"]);

class ComboTracker {
  private streak = 0;

  recordDraw(grade: string): ComboResult {
    const isGood = GOOD_GRADES.has(grade);

    if (!isGood) {
      const prev = this.streak;
      this.streak = 0;
      return { streak: 0, broken: prev > 0, previousStreak: prev, milestone: null };
    }

    this.streak++;

    const milestone: ComboMilestone =
      this.streak === 3  ? "combo3"
      : this.streak === 5  ? "combo5"
      : this.streak === 10 ? "combo10"
      : null;

    return { streak: this.streak, broken: false, previousStreak: this.streak - 1, milestone };
  }

  getStreak(): number {
    return this.streak;
  }

  reset(): void {
    this.streak = 0;
  }
}

export const combo = new ComboTracker();
