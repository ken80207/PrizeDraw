// ─────────────────────────────────────────────────────────────────────────────
// Accessibility manager — persisted settings + CSS custom-property application
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "prizedraw_a11y_settings";

export type ColorBlindMode = "none" | "protanopia" | "deuteranopia" | "tritanopia";

export interface AccessibilitySettings {
  /** Respect prefers-reduced-motion + allow manual override */
  reducedMotion: boolean;
  /** Boost contrast for all game elements */
  highContrast: boolean;
  /** Scale all text 1.5× */
  largeText: boolean;
  /** Enrich aria-labels on all interactive elements */
  screenReaderMode: boolean;
  /** Swap grade colours to distinct patterns + shapes */
  colorBlindMode: ColorBlindMode;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderMode: false,
  colorBlindMode: "none",
};

// Grade colour remaps for each vision-deficiency mode.
// Keys are the canonical hex values used throughout games.
const COLOR_BLIND_REMAP: Record<ColorBlindMode, Record<string, string>> = {
  none: {},
  // Protanopia — red absent: shift reds → blue/yellow
  protanopia: {
    "#f59e0b": "#f59e0b", // amber A賞 — keep
    "#dc2626": "#1d4ed8", // red → blue
    "#3b82f6": "#3b82f6", // blue B賞 — keep
    "#10b981": "#10b981", // green C賞 — keep
    "#a855f7": "#f59e0b", // purple D賞 → amber for distinction
  },
  // Deuteranopia — green absent: shift greens → blue
  deuteranopia: {
    "#10b981": "#0ea5e9", // green C賞 → sky-blue
    "#a855f7": "#ec4899", // purple D賞 → pink for contrast
  },
  // Tritanopia — blue absent: shift blues → red/orange
  tritanopia: {
    "#3b82f6": "#ef4444", // blue B賞 → red
    "#a855f7": "#f97316", // purple D賞 → orange
  },
};

type SettingsChangeListener = (settings: AccessibilitySettings) => void;

class AccessibilityManager {
  settings: AccessibilitySettings;
  private listeners: SettingsChangeListener[] = [];

  constructor() {
    // Detect OS preference
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Load persisted settings
    let saved: Partial<AccessibilitySettings> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw) as Partial<AccessibilitySettings>;
      } catch {
        // ignore
      }
    }

    this.settings = {
      ...DEFAULT_SETTINGS,
      reducedMotion: saved.reducedMotion ?? prefersReduced,
      highContrast: saved.highContrast ?? false,
      largeText: saved.largeText ?? false,
      screenReaderMode: saved.screenReaderMode ?? false,
      colorBlindMode: saved.colorBlindMode ?? "none",
    };

    if (typeof window !== "undefined") {
      this.applyToDocument();

      // React to OS-level changes
      window
        .matchMedia("(prefers-reduced-motion: reduce)")
        .addEventListener("change", (e) => {
          if (!this.settings.reducedMotion) {
            this.update({ reducedMotion: e.matches });
          }
        });
    }
  }

  /** Subscribe to settings changes. Returns an unsubscribe function. */
  subscribe(listener: SettingsChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Update one or more settings, persist, and re-apply to document. */
  update(patch: Partial<AccessibilitySettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    this.applyToDocument();
    this.listeners.forEach((l) => l(this.settings));
  }

  /**
   * Remap a hex colour according to the active colour-blind mode.
   * Falls back to the original hex if no mapping is defined.
   */
  remapColor(hex: string): string {
    const map = COLOR_BLIND_REMAP[this.settings.colorBlindMode];
    return map[hex.toLowerCase()] ?? hex;
  }

  /** Returns true when animations should be skipped entirely. */
  get skipAnimations(): boolean {
    return this.settings.reducedMotion;
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  private applyToDocument(): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Reduced motion — drives CSS transitions across the whole app
    root.classList.toggle("a11y-reduced-motion", this.settings.reducedMotion);

    // High contrast — thick borders, pure black/white
    root.classList.toggle("a11y-high-contrast", this.settings.highContrast);

    // Large text — 1.5× scale on all game text nodes
    root.classList.toggle("a11y-large-text", this.settings.largeText);

    // Screen reader — surfaces aria-label on canvas-based interactive elements
    root.classList.toggle("a11y-screen-reader", this.settings.screenReaderMode);

    // Colour-blind mode — CSS filter approximation
    const filterMap: Record<ColorBlindMode, string> = {
      none: "none",
      protanopia: "url(#a11y-protanopia)",
      deuteranopia: "url(#a11y-deuteranopia)",
      tritanopia: "url(#a11y-tritanopia)",
    };
    root.style.setProperty(
      "--a11y-color-filter",
      filterMap[this.settings.colorBlindMode],
    );

    // Ensure the SVG filter definitions exist in the DOM
    this.ensureColorFilters();
  }

  private ensureColorFilters(): void {
    if (
      typeof document === "undefined" ||
      document.getElementById("a11y-svg-filters")
    )
      return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "a11y-svg-filters";
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";

    // Protanopia matrix (red-blind)
    const protanopia = `
      <filter id="a11y-protanopia">
        <feColorMatrix type="matrix" values="
          0.567 0.433 0     0 0
          0.558 0.442 0     0 0
          0     0.242 0.758 0 0
          0     0     0     1 0"/>
      </filter>`;

    // Deuteranopia matrix (green-blind)
    const deuteranopia = `
      <filter id="a11y-deuteranopia">
        <feColorMatrix type="matrix" values="
          0.625 0.375 0   0 0
          0.7   0.3   0   0 0
          0     0.3   0.7 0 0
          0     0     0   1 0"/>
      </filter>`;

    // Tritanopia matrix (blue-blind)
    const tritanopia = `
      <filter id="a11y-tritanopia">
        <feColorMatrix type="matrix" values="
          0.95 0.05  0     0 0
          0    0.433 0.567 0 0
          0    0.475 0.525 0 0
          0    0     0     1 0"/>
      </filter>`;

    svg.innerHTML = `<defs>${protanopia}${deuteranopia}${tritanopia}</defs>`;
    document.body.appendChild(svg);
  }
}

// Singleton — import this instance anywhere in the app
export const a11y = new AccessibilityManager();
