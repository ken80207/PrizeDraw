// Achievement / stamp system — client-side, persisted to localStorage

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlockedAt?: number; // Unix timestamp (ms)
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_draw",    icon: "🎰", title: "初次抽獎",   description: "完成第一次抽獎" },
  { id: "try_all_games", icon: "🕹️", title: "遊戲達人",   description: "嘗試過拉霸機、夾娃娃、扭蛋機" },
  { id: "try_all_styles",icon: "🎨", title: "風格鑑賞家", description: "嘗試過全部 8 種視覺風格" },
  { id: "win_a_grade",   icon: "👑", title: "大獎得主",   description: "抽到 A 賞" },
  { id: "combo_3",       icon: "🔥", title: "三連擊",     description: "連續抽到 3 個 B 賞以上" },
  { id: "combo_5",       icon: "💥", title: "五連爆",     description: "連續抽到 5 個 B 賞以上" },
  { id: "speed_draw",    icon: "⚡", title: "閃電手",     description: "3 秒內完成一次抽獎" },
  { id: "night_owl",     icon: "🦉", title: "夜貓子",     description: "在凌晨 2-5 點抽獎" },
  { id: "collector_10",  icon: "📦", title: "收藏家",     description: "累計抽獎 10 次" },
  { id: "collector_50",  icon: "🏅", title: "資深收藏家", description: "累計抽獎 50 次" },
  { id: "compare_mode",  icon: "🔀", title: "比較大師",   description: "使用比較模式" },
  { id: "screenshot",    icon: "📸", title: "紀念照",     description: "截圖分享抽獎結果" },
];

const STORAGE_KEY = "prizedraw_achievements";

type UnlockListener = (achievement: Achievement) => void;

class AchievementManager {
  private unlocked: Set<string>;
  private listeners: UnlockListener[] = [];

  constructor() {
    this.unlocked = new Set<string>();
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => this.unlocked.add(id));
          }
        }
      } catch {
        // Corrupted storage — start fresh
        this.unlocked = new Set();
      }
    }
  }

  /** Returns true if the achievement is already unlocked. */
  check(id: string): boolean {
    return this.unlocked.has(id);
  }

  /** Unlock an achievement. Idempotent — does nothing if already unlocked. */
  unlock(id: string): void {
    if (this.unlocked.has(id)) return;

    const definition = ACHIEVEMENTS.find((a) => a.id === id);
    if (!definition) return;

    this.unlocked.add(id);
    this.persist();

    const achievement: Achievement = { ...definition, unlockedAt: Date.now() };
    this.listeners.forEach((fn) => fn(achievement));
  }

  /** Subscribe to unlock events. Returns an unsubscribe function. */
  onUnlock(listener: UnlockListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Returns all achievements with their current unlock status. */
  getAll(): Achievement[] {
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlockedAt: this.unlocked.has(a.id) ? this.getUnlockTime(a.id) : undefined,
    }));
  }

  getStats(): { total: number; unlocked: number } {
    return { total: ACHIEVEMENTS.length, unlocked: this.unlocked.size };
  }

  /** Clear all achievements. */
  reset(): void {
    this.unlocked.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}_times`);
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
    } catch {
      // Storage quota exceeded or unavailable — silently ignore
    }
  }

  private getUnlockTime(id: string): number | undefined {
    if (typeof window === "undefined") return undefined;
    try {
      const key = `${STORAGE_KEY}_time_${id}`;
      const raw = localStorage.getItem(key);
      return raw ? parseInt(raw, 10) : undefined;
    } catch {
      return undefined;
    }
  }
}

export const achievements = new AchievementManager();
