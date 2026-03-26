/**
 * HapticManager — thin wrapper around the Vibration API.
 * Gracefully degrades: does nothing when the API is unavailable
 * (desktop browsers, iOS Safari, or when the user has disabled haptics).
 */

class HapticManager {
  private enabled = true;

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled) return;
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  }

  // ── Interaction patterns ───────────────────────────────────────────────────

  /** Very light tap — e.g. button hover/focus */
  tap(): void {
    this.vibrate(10);
  }

  /** Standard button click confirmation */
  click(): void {
    this.vibrate(20);
  }

  /** Paper tear — two short pulses with a small gap */
  tear(): void {
    this.vibrate([10, 5, 10]);
  }

  /** Scratch card surface friction */
  scratch(): void {
    this.vibrate(15);
  }

  /** Card flip — slightly stronger than a click */
  flip(): void {
    this.vibrate(25);
  }

  /** Slot reel coming to a stop */
  reelStop(): void {
    this.vibrate(30);
  }

  /** Claw machine grab — two strong pulses */
  grab(): void {
    this.vibrate([20, 10, 20]);
  }

  /** Capsule/prize drop impact */
  drop(): void {
    this.vibrate(40);
  }

  // ── Win patterns ───────────────────────────────────────────────────────────

  /** Small win (B/C/D grade) */
  winSmall(): void {
    this.vibrate([30, 20, 30]);
  }

  /** Big win (A grade) */
  winBig(): void {
    this.vibrate([50, 30, 50, 30, 100]);
  }

  /** Jackpot — extended celebration pattern */
  jackpot(): void {
    this.vibrate([100, 50, 100, 50, 100, 50, 200]);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  toggle(): void {
    this.enabled = !this.enabled;
    // Cancel any ongoing vibration when disabling
    if (!this.enabled && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const haptics = new HapticManager();
