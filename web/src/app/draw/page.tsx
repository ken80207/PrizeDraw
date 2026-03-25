"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("drawResult");
      if (!raw) {
        setError("No draw result found. Please start a draw from a campaign.");
        return;
      }
      const result = JSON.parse(raw) as DrawResult;

      // Allow the URL param to override the stored mode
      const modeParam = searchParams.get("mode") as AnimationMode | null;
      if (modeParam) {
        result.animationMode = modeParam;
      }

      setDrawResult(result);
      // Clear immediately so a hard-refresh does not replay the animation
      sessionStorage.removeItem("drawResult");
    } catch {
      setError("Failed to read draw result.");
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        <Link
          href="/campaigns"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Browse Campaigns
        </Link>
      </div>
    );
  }

  if (!drawResult) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-8">
      {/* Animation fills the screen before reveal */}
      {!revealed && (
        <div className="w-full max-w-sm">
          <AnimatedReveal
            mode={drawResult.animationMode}
            prizePhotoUrl={drawResult.prizePhotoUrl}
            prizeGrade={drawResult.prizeGrade}
            prizeName={drawResult.prizeName}
            onRevealed={() => setRevealed(true)}
          />
        </div>
      )}

      {/* Prize info — shown after animation completes */}
      {revealed && (
        <div className="flex flex-col items-center gap-4 text-center">
          {drawResult.prizePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drawResult.prizePhotoUrl}
              alt={drawResult.prizeName}
              className="h-48 w-48 rounded-2xl object-cover shadow-2xl"
            />
          )}
          <div>
            <span className="mb-1 block rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Grade {drawResult.prizeGrade}
            </span>
            <h1 className="mt-2 text-3xl font-bold text-white">{drawResult.prizeName}</h1>
            <p className="mt-1 text-sm text-zinc-400">Congratulations!</p>
          </div>

          <div className="mt-4 flex gap-3">
            <Link
              href="/prizes"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              View My Prizes
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DrawPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
        </div>
      }
    >
      <DrawPageContent />
    </Suspense>
  );
}
