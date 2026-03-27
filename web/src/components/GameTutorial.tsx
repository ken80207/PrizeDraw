"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  /** CSS selector or descriptive area identifier */
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  /** Whether to render a spotlight cutout around the target area */
  highlight?: boolean;
}

export type TutorialGameId = "slot" | "claw" | "gacha" | "roulette" | "pachinko" | "scratch";

interface GameTutorialProps {
  gameId: TutorialGameId;
  /** Force the tutorial to show regardless of localStorage flag */
  forceShow?: boolean;
  /** Called when tutorial finishes or is skipped */
  onDone?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tutorial step metadata (target/position/highlight only — titles/descriptions
// are resolved from i18n inside the component)
// ─────────────────────────────────────────────────────────────────────────────

type StepMeta = Omit<TutorialStep, "title" | "description">;

const SLOT_STEPS_META: StepMeta[] = [
  { target: "lever", position: "left", highlight: true },
  { target: "reels", position: "bottom" },
  { target: "result", position: "top" },
];

const CLAW_STEPS_META: StepMeta[] = [
  { target: "arrows", position: "bottom", highlight: true },
  { target: "drop", position: "left" },
  { target: "prizes", position: "top" },
];

const GACHA_STEPS_META: StepMeta[] = [
  { target: "handle", position: "left", highlight: true },
  { target: "dome", position: "bottom" },
  { target: "capsule", position: "top" },
];

const ROULETTE_STEPS_META: StepMeta[] = [
  { target: "wheel", position: "bottom", highlight: true },
  { target: "pointer", position: "top" },
  { target: "result", position: "left" },
];

const PACHINKO_STEPS_META: StepMeta[] = [
  { target: "ball", position: "bottom", highlight: true },
  { target: "pegs", position: "right" },
  { target: "slots", position: "top" },
];

const SCRATCH_STEPS_META: StepMeta[] = [
  { target: "card", position: "bottom", highlight: true },
  { target: "grid", position: "top" },
  { target: "match", position: "left" },
];

// Legacy exports — keep for backward compatibility (target/position/highlight
// are correct; title/description are placeholder strings for non-i18n callers).
export const SLOT_TUTORIAL: TutorialStep[] = SLOT_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));
export const CLAW_TUTORIAL: TutorialStep[] = CLAW_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));
export const GACHA_TUTORIAL: TutorialStep[] = GACHA_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));
export const ROULETTE_TUTORIAL: TutorialStep[] = ROULETTE_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));
export const PACHINKO_TUTORIAL: TutorialStep[] = PACHINKO_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));
export const SCRATCH_TUTORIAL: TutorialStep[] = SCRATCH_STEPS_META.map((s) => ({
  ...s,
  title: s.target,
  description: "",
}));

function storageKey(gameId: TutorialGameId): string {
  return `prizedraw_tutorial_seen_${gameId}`;
}

function markSeen(gameId: TutorialGameId): void {
  try {
    localStorage.setItem(storageKey(gameId), "1");
  } catch {
    // ignore
  }
}

function hasSeen(gameId: TutorialGameId): boolean {
  try {
    return localStorage.getItem(storageKey(gameId)) === "1";
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GameTutorial({ gameId, forceShow = false, onDone }: GameTutorialProps) {
  const t = useTranslations("gameTutorial");

  // Build translated step arrays inside the component so hooks are valid
  const TRANSLATED_STEPS: Record<TutorialGameId, TutorialStep[]> = {
    slot: [
      { ...SLOT_STEPS_META[0], title: t("slotLever"), description: t("slotLeverDesc") },
      { ...SLOT_STEPS_META[1], title: t("slotReels"), description: t("slotReelsDesc") },
      { ...SLOT_STEPS_META[2], title: t("slotResult"), description: t("slotResultDesc") },
    ],
    claw: [
      { ...CLAW_STEPS_META[0], title: t("clawArrows"), description: t("clawArrowsDesc") },
      { ...CLAW_STEPS_META[1], title: t("clawDrop"), description: t("clawDropDesc") },
      { ...CLAW_STEPS_META[2], title: t("clawPrizes"), description: t("clawPrizesDesc") },
    ],
    gacha: [
      { ...GACHA_STEPS_META[0], title: t("gachaHandle"), description: t("gachaHandleDesc") },
      { ...GACHA_STEPS_META[1], title: t("gachaDome"), description: t("gachaDomeDesc") },
      { ...GACHA_STEPS_META[2], title: t("gachaCapsule"), description: t("gachaCapsuleDesc") },
    ],
    roulette: [
      { ...ROULETTE_STEPS_META[0], title: t("rouletteWheel"), description: t("rouletteWheelDesc") },
      { ...ROULETTE_STEPS_META[1], title: t("roulettePointer"), description: t("roulettePointerDesc") },
      { ...ROULETTE_STEPS_META[2], title: t("rouletteResult"), description: t("rouletteResultDesc") },
    ],
    pachinko: [
      { ...PACHINKO_STEPS_META[0], title: t("pachinkoball"), description: t("pachinkoballDesc") },
      { ...PACHINKO_STEPS_META[1], title: t("pachinkoPegs"), description: t("pachinkoPegsDesc") },
      { ...PACHINKO_STEPS_META[2], title: t("pachinkoSlots"), description: t("pachinkoSlotsDesc") },
    ],
    scratch: [
      { ...SCRATCH_STEPS_META[0], title: t("scratchCard"), description: t("scratchCardDesc") },
      { ...SCRATCH_STEPS_META[1], title: t("scratchGrid"), description: t("scratchGridDesc") },
      { ...SCRATCH_STEPS_META[2], title: t("scratchMatch"), description: t("scratchMatchDesc") },
    ],
  };

  const steps = TRANSLATED_STEPS[gameId];
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Decide whether to show on mount — initialise both at once to avoid extra renders
  useEffect(() => {
    const shouldShow = forceShow || !hasSeen(gameId);
    // Schedule in the same event loop tick via startTransition-compatible pattern
    if (shouldShow) {
      Promise.resolve().then(() => {
        setStepIndex(0);
        setVisible(true);
      });
    }
  }, [gameId, forceShow]);

  const dismiss = useCallback(() => {
    markSeen(gameId);
    setVisible(false);
    onDone?.();
  }, [gameId, onDone]);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  }, [stepIndex, steps.length, dismiss]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!visible) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Arrow classes
  const arrowClass: Record<TutorialStep["position"], string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-surface-container",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-surface-container",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-surface-container",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-surface-container",
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("stepLabel", { current: stepIndex + 1, total: steps.length })}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Centred tooltip card — positioned relative to overlay centre */}
      <div className="relative z-10 max-w-xs w-full mx-4">
        {/* Spotlight indicator (decorative) */}
        {step.highlight && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none animate-pulse" />
        )}

        {/* Tooltip card */}
        <div className="bg-surface-container rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-surface-container-highest">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-5 space-y-3">
            {/* Step counter + title */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-primary text-xs font-bold font-headline">
                {stepIndex + 1} / {steps.length}
              </span>
              <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                {step.target}
              </span>
            </div>

            <div>
              <h3 className="text-on-surface font-black text-lg leading-tight font-headline">{step.title}</h3>
              <p className="text-on-surface-variant text-sm mt-1 leading-relaxed">{step.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {stepIndex > 0 && (
                <button
                  onClick={prev}
                  className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant text-xs font-bold transition-colors"
                >
                  {t("prev")}
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 px-4 py-2 rounded-xl amber-gradient active:scale-95 text-on-primary text-sm font-bold transition-all shadow-lg shadow-primary/20"
              >
                {isLast ? t("done") : t("next")}
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-2 rounded-lg text-on-surface-variant/50 hover:text-on-surface text-xs font-medium transition-colors hover:bg-surface-container-high"
              >
                {t("skip")}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointer (decorative) */}
        <div
          className={`absolute border-8 ${arrowClass[step.position]} hidden`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility — programmatically reset the "seen" flag (for settings page)
// ─────────────────────────────────────────────────────────────────────────────

export function resetTutorialFlag(gameId: TutorialGameId): void {
  try {
    localStorage.removeItem(storageKey(gameId));
  } catch {
    // ignore
  }
}

export function resetAllTutorialFlags(): void {
  const ids: TutorialGameId[] = ["slot", "claw", "gacha", "roulette", "pachinko", "scratch"];
  ids.forEach(resetTutorialFlag);
}
