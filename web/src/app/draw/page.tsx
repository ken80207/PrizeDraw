"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatedReveal, type AnimationMode } from "@/animations/AnimatedReveal";

interface DrawResult {
  prizeInstanceId: string;
  prizeName: string;
  prizeGrade: string;
  prizePhotoUrl: string;
  animationMode: AnimationMode;
}

/**
 * Draw result page.
 *
 * Reads draw result data from sessionStorage (keyed "drawResult") and the
 * animation mode from the "mode" search parameter, then renders the
 * appropriate reveal animation via [AnimatedReveal].
 *
 * The campaign draw flow redirects here immediately after a successful draw
 * API call, serialising the DrawResultDto to sessionStorage before navigation.
 *
 * Search params:
 *   ?mode=TEAR|SCRATCH|FLIP|INSTANT  — overrides stored animation preference
 */
function DrawPageContent() {
  const t = useTranslations("draw");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<{
    drawResult: DrawResult | null;
    revealed: boolean;
    error: string | null;
  }>(() => {
    if (typeof window === "undefined") return { drawResult: null, revealed: false, error: null };
    try {
      const raw = sessionStorage.getItem("drawResult");
      if (!raw) return { drawResult: null, revealed: false, error: "No draw result found. Please start a draw from a campaign." };
      const result = JSON.parse(raw) as DrawResult;
      sessionStorage.removeItem("drawResult");
      return { drawResult: result, revealed: false, error: null };
    } catch {
      return { drawResult: null, revealed: false, error: "Failed to read draw result." };
    }
  });

  const drawResult = state.drawResult;
  const revealed = state.revealed;
  const error = state.error;

  // Allow the URL param to override the stored mode
  const modeParam = searchParams.get("mode") as AnimationMode | null;
  const effectiveResult = drawResult && modeParam
    ? { ...drawResult, animationMode: modeParam }
    : drawResult;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-dim px-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error-container/20">
          <span className="material-symbols-outlined text-4xl text-error">error</span>
        </div>
        <div>
          <p className="mb-1 font-headline text-lg font-bold text-on-surface">{t("notFoundTitle")}</p>
          <p className="text-sm text-on-surface-variant">{error}</p>
        </div>
        <Link
          href="/campaigns"
          className="rounded-xl px-6 py-3 text-sm font-semibold transition-all amber-gradient text-on-primary hover:shadow-md gold-glow"
        >
          {t("browseCampaigns")}
        </Link>
      </div>
    );
  }

  if (!effectiveResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-dim">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-container-high border-t-primary" />
          <p className="text-sm text-on-surface-variant">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-dim px-4 py-8">
      {/* Animation fills the screen before reveal */}
      {!revealed && (
        <div className="w-full max-w-sm">
          <AnimatedReveal
            mode={effectiveResult.animationMode}
            prizePhotoUrl={effectiveResult.prizePhotoUrl}
            prizeGrade={effectiveResult.prizeGrade}
            prizeName={effectiveResult.prizeName}
            onRevealed={() => setState(prev => ({ ...prev, revealed: true }))}
          />
        </div>
      )}

      {/* Prize info — shown after animation completes */}
      {revealed && (
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Prize image */}
          {effectiveResult.prizePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={effectiveResult.prizePhotoUrl}
              alt={effectiveResult.prizeName}
              className="h-48 w-48 rounded-2xl object-cover shadow-2xl gold-glow"
            />
          )}

          {/* Grade + name */}
          <div>
            <span className="mb-2 inline-flex items-center rounded-full px-4 py-1 text-xs font-extrabold uppercase tracking-widest amber-gradient text-on-primary">
              {t("grade")} {effectiveResult.prizeGrade}
            </span>
            <h1 className="mt-3 font-headline text-3xl font-bold text-on-surface">
              {effectiveResult.prizeName}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">{t("congratulations")}</p>
          </div>

          {/* Actions */}
          <div className="mt-2 flex gap-3">
            <Link
              href="/prizes"
              className="rounded-xl px-6 py-3 text-sm font-semibold transition-all amber-gradient text-on-primary hover:shadow-md gold-glow"
            >
              {t("viewPrizes")}
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl bg-surface-container-high px-6 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {tCommon("back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DrawPage() {
  const t = useTranslations("draw");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-dim">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-container-high border-t-primary" />
            <p className="text-sm text-on-surface-variant">{t("loading")}</p>
          </div>
        </div>
      }
    >
      <DrawPageContent />
    </Suspense>
  );
}
