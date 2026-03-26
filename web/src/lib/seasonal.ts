// Seasonal theme system

export interface SeasonalTheme {
  id: string;
  name: string;
  icon: string;
  particles: string[]; // emoji to float as particles
  accentColor: string;
  bgOverlay?: string; // CSS gradient overlay on the page background
}

export const SEASONAL_THEMES: Record<string, SeasonalTheme> = {
  default: {
    id: "default",
    name: "預設",
    icon: "🎰",
    particles: ["✨"],
    accentColor: "#6366f1",
  },
  christmas: {
    id: "christmas",
    name: "聖誕節",
    icon: "🎄",
    particles: ["❄️", "⭐", "🎁"],
    accentColor: "#dc2626",
    bgOverlay: "linear-gradient(to bottom, rgba(220,38,38,0.05), transparent)",
  },
  halloween: {
    id: "halloween",
    name: "萬聖節",
    icon: "🎃",
    particles: ["🦇", "👻", "🕷️"],
    accentColor: "#f97316",
    bgOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.1), transparent)",
  },
  newyear: {
    id: "newyear",
    name: "新年",
    icon: "🧧",
    particles: ["🧨", "🎊", "🏮"],
    accentColor: "#dc2626",
    bgOverlay: "linear-gradient(to bottom, rgba(220,38,38,0.05), transparent)",
  },
  valentine: {
    id: "valentine",
    name: "情人節",
    icon: "💝",
    particles: ["💕", "💖", "✨"],
    accentColor: "#ec4899",
  },
  summer: {
    id: "summer",
    name: "夏日祭",
    icon: "🏖️",
    particles: ["🌊", "🐚", "🌺"],
    accentColor: "#06b6d4",
  },
  sakura: {
    id: "sakura",
    name: "櫻花季",
    icon: "🌸",
    particles: ["🌸", "🌸", "✨"],
    accentColor: "#f472b6",
  },
};

/** Auto-detect the seasonal theme based on the current month. */
export function getSeasonalTheme(): SeasonalTheme {
  const month = new Date().getMonth(); // 0-indexed
  if (month === 11) return SEASONAL_THEMES.christmas;
  if (month === 9)  return SEASONAL_THEMES.halloween;
  if (month === 0)  return SEASONAL_THEMES.newyear;
  if (month === 1)  return SEASONAL_THEMES.valentine;
  if (month === 3)  return SEASONAL_THEMES.sakura;
  if (month >= 6 && month <= 7) return SEASONAL_THEMES.summer;
  return SEASONAL_THEMES.default;
}

/** All theme IDs in display order. */
export const THEME_IDS = [
  "default",
  "christmas",
  "halloween",
  "newyear",
  "valentine",
  "summer",
  "sakura",
] as const;
