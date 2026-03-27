"use client";

import { useEffect, useState } from "react";
import { a11y } from "@/lib/accessibility";
import type { AccessibilitySettings, ColorBlindMode } from "@/lib/accessibility";

// ─────────────────────────────────────────────────────────────────────────────
// AccessibilityPanel
//
// A collapsible panel that lets users tweak all accessibility settings.
// Reads from and writes to the singleton `a11y` manager so settings
// propagate to every game component.
// ─────────────────────────────────────────────────────────────────────────────

interface AccessibilityPanelProps {
  /** When true the panel is rendered as an open overlay card */
  open: boolean;
  onClose: () => void;
}

export function AccessibilityPanel({ open, onClose }: AccessibilityPanelProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(
    () => a11y.settings,
  );

  // Keep local state in sync with the singleton (e.g. OS-level changes)
  useEffect(() => {
    const unsub = a11y.subscribe((s) => setSettings({ ...s }));
    return unsub;
  }, []);

  function toggle(key: keyof Pick<
    AccessibilitySettings,
    "reducedMotion" | "highContrast" | "largeText" | "screenReaderMode"
  >) {
    const next = !settings[key];
    a11y.update({ [key]: next });
  }

  function setColorBlindMode(mode: ColorBlindMode) {
    a11y.update({ colorBlindMode: mode });
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="無障礙設定"
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-container rounded-2xl shadow-2xl shadow-black/40 p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-on-surface font-black text-base flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>accessibility_new</span>
          </h2>
          <button
            onClick={onClose}
            aria-label="關閉無障礙設定"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Toggle options */}
        <div className="space-y-3">
          <ToggleRow
            label="減少動畫"
            icon="♿"
            description="跳過所有動畫，直接顯示結果"
            checked={settings.reducedMotion}
            onChange={() => toggle("reducedMotion")}
            id="a11y-reduced-motion"
          />
          <ToggleRow
            label="高對比度"
            icon="◼"
            description="加粗輪廓，使用純黑白配色"
            checked={settings.highContrast}
            onChange={() => toggle("highContrast")}
            id="a11y-high-contrast"
          />
          <ToggleRow
            label="放大文字"
            icon="A"
            description="所有遊戲文字縮放 1.5 倍"
            checked={settings.largeText}
            onChange={() => toggle("largeText")}
            id="a11y-large-text"
          />
          <ToggleRow
            label="螢幕閱讀器模式"
            icon="◎"
            description="為所有互動元素補充 aria 標籤"
            checked={settings.screenReaderMode}
            onChange={() => toggle("screenReaderMode")}
            id="a11y-screen-reader"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-outline-variant/15" />

        {/* Colour-blind mode */}
        <div className="space-y-2">
          <label
            htmlFor="a11y-colorblind-select"
            className="flex items-center gap-2 text-sm font-semibold text-on-surface"
          >
            <span className="w-5 h-5 rounded bg-gradient-to-br from-red-500 via-green-500 to-blue-500 inline-block" aria-hidden="true" />
            色覺模式
          </label>
          <select
            id="a11y-colorblind-select"
            value={settings.colorBlindMode}
            onChange={(e) => setColorBlindMode(e.target.value as ColorBlindMode)}
            className="w-full bg-surface-container-lowest border-none text-on-surface text-sm rounded-xl px-3 py-2 focus:ring-1 focus:ring-primary outline-none transition-colors cursor-pointer"
          >
            <option value="none">一般（無調整）</option>
            <option value="protanopia">紅色弱 (Protanopia)</option>
            <option value="deuteranopia">綠色弱 (Deuteranopia)</option>
            <option value="tritanopia">藍色弱 (Tritanopia)</option>
          </select>
          <p className="text-xs text-on-surface-variant/50">
            套用 SVG 濾鏡模擬色覺差異，並重新映射遊戲中的獎品顏色
          </p>
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            a11y.update({
              reducedMotion: false,
              highContrast: false,
              largeText: false,
              screenReaderMode: false,
              colorBlindMode: "none",
            });
          }}
          className="w-full text-xs text-on-surface-variant/50 hover:text-on-surface py-2 rounded-lg hover:bg-surface-container-high transition-all"
        >
          恢復預設值
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToggleRow helper
// ─────────────────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  icon,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  icon: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer group select-none"
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {/* Custom toggle */}
      <div
        aria-hidden="true"
        className={[
          "relative mt-0.5 w-9 h-5 rounded-full transition-all duration-200 shrink-0 flex items-center",
          checked ? "bg-primary-container" : "bg-surface-container-highest group-hover:bg-surface-bright",
        ].join(" ")}
      >
        <span
          className={[
            "absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200",
            checked ? "left-[18px]" : "left-[3px]",
          ].join(" ")}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
          <span className="text-sm" aria-hidden="true">{icon}</span>
          {label}
        </p>
        <p className="text-xs text-on-surface-variant/50 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
