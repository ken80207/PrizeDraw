// Time-of-day ambient system

export interface TimeAmbient {
  overlay: string;      // RGBA CSS color to overlay on the page
  lightIntensity: number; // 0.0 – 1.0
  label: string;        // Human-readable greeting label
}

/** Returns ambient values for the current local hour. */
export function getTimeAmbient(): TimeAmbient {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return { overlay: "rgba(255,200,50,0.03)", lightIntensity: 1.0, label: "☀️ 早安" };
  }
  if (hour >= 12 && hour < 17) {
    return { overlay: "rgba(255,255,255,0)", lightIntensity: 1.0, label: "🌤️ 午安" };
  }
  if (hour >= 17 && hour < 20) {
    return { overlay: "rgba(255,120,50,0.05)", lightIntensity: 0.85, label: "🌅 傍晚" };
  }
  if (hour >= 20 || hour < 2) {
    return { overlay: "rgba(30,20,80,0.08)", lightIntensity: 0.7, label: "🌙 晚安" };
  }
  // 2:00 – 5:59 (deep night)
  return { overlay: "rgba(10,10,40,0.1)", lightIntensity: 0.6, label: "🦉 深夜" };
}
