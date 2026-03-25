"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  formatProbabilityBps,
  useUnlimitedDraw,
  type PrizeDefinitionDto,
  type UnlimitedDrawResultDto,
} from "@/features/unlimited/useUnlimitedDraw";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/LoadingSkeleton";
import { AnimatedReveal } from "@/animations/AnimatedReveal";
import { useAnimationMode } from "@/hooks/useAnimationMode";
import { ChatPanel } from "@/components/ChatPanel";
import { ReactionOverlay } from "@/components/ReactionOverlay";

const MULTI_DRAW_OPTIONS = [
  { label: "×3", qty: 3 },
  { label: "×5", qty: 5 },
  { label: "×10", qty: 10 },
];

export default function UnlimitedCampaignPage() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const {
    campaign,
    prizes,
    lastResult,
    drawHistory,
    isDrawing,
    isLoading,
    error,
    draw,
    acknowledgeResult,
    dismissError,
  } = useUnlimitedDraw(id);

  const [couponOpen, setCouponOpen] = useState(false);

  if (isLoading) return <UnlimitedSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={dismissError} className="text-red-500 hover:text-red-700 text-lg">
            ×
          </button>
        </div>
      )}

      {campaign && (
        <>
          {/* ── Campaign Header ───────────────────────────────── */}
          <section className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="relative w-full md:w-64 h-44 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                  {campaign.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={campaign.coverImageUrl}
                      alt={campaign.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🎲</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status="無限賞" />
                    <StatusBadge status="開放中" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {campaign.title}
                  </h1>
                  {campaign.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {campaign.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* ── Probability Table ────────────────────────────── */}
            {prizes.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                  機率表
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          等級
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          賞品名稱
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          照片
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          機率
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {prizes.map((prize) => (
                        <PrizeRow key={prize.id} prize={prize} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Draw Section ──────────────────────────────────── */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">抽獎區域</h2>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">你的點數</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    💰 {campaign.pricePerDraw.toLocaleString()} 點/抽
                  </p>
                </div>
                <button
                  onClick={() => setCouponOpen(!couponOpen)}
                  className="px-4 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  使用優惠券 ▼
                </button>
              </div>

              {/* Big draw button */}
              <button
                data-testid="draw-button"
                onClick={() => draw()}
                disabled={isDrawing}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 mb-4"
              >
                {isDrawing ? "⏳ 抽獎中..." : "🎲 立即抽獎"}
              </button>

              {/* Multi-draw buttons */}
              <div className="flex gap-3">
                {MULTI_DRAW_OPTIONS.map((opt) => (
                  <button
                    key={opt.qty}
                    data-testid={`multi-draw-${opt.qty}`}
                    disabled={isDrawing}
                    onClick={() => {
                      for (let i = 0; i < opt.qty; i++) draw();
                    }}
                    className="flex-1 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
                連抽將依序扣除點數
              </p>
            </section>

            {/* ── Session History ───────────────────────────────── */}
            {drawHistory.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                  本次抽獎紀錄
                </h2>
                <div data-testid="draw-history" className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {drawHistory.map((result) => (
                    <HistoryRow key={result.prizeInstanceId} result={result} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {/* ── Result reveal modal ───────────────────────────── */}
      {lastResult && <ResultModal result={lastResult} onClose={acknowledgeResult} />}

      {/* ── Chat panel for the unlimited campaign room ─────── */}
      {id && <ChatPanel roomId={`unlimited:${id}`} />}

      {/* ── Reaction Overlay — floating emojis ──────────────── */}
      {id && (
        <div className="fixed inset-0 pointer-events-none z-30" aria-hidden="true">
          <ReactionOverlay emoji={null} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PrizeRow({ prize }: { prize: PrizeDefinitionDto }) {
  const probabilityText =
    prize.probabilityBps !== null ? formatProbabilityBps(prize.probabilityBps) : "--";
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <td className="px-4 py-3">
        <GradeBadge grade={prize.grade} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{prize.name}</span>
      </td>
      <td className="px-4 py-3 text-center">
        {prize.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.photos[0]}
            alt={prize.name}
            className="w-10 h-10 rounded-lg object-cover mx-auto"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto text-gray-400 text-xs">
            ?
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {probabilityText}
        </span>
      </td>
    </tr>
  );
}

function HistoryRow({ result }: { result: UnlimitedDrawResultDto }) {
  const now = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  return (
    <div data-testid="draw-history-item" className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-12">{now}</span>
      {result.prizePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.prizePhotoUrl}
          alt={result.prizeName}
          className="w-8 h-8 rounded-md object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">
          ?
        </div>
      )}
      <div className="flex-1 min-w-0">
        <GradeBadge grade={result.grade} className="mr-2" />
        <span className="text-sm text-gray-700 dark:text-gray-300">{result.prizeName}</span>
      </div>
      <span className="text-sm font-medium text-red-600 dark:text-red-400 shrink-0">
        -{result.pointsCharged.toLocaleString()} 點
      </span>
    </div>
  );
}

/**
 * Result modal for unlimited draws.
 *
 * Shows the configured animation overlay first, then transitions to a static
 * prize-detail card so the player can read the result before continuing.
 */
function ResultModal({
  result,
  onClose,
}: {
  result: UnlimitedDrawResultDto;
  onClose: () => void;
}) {
  const [animationDone, setAnimationDone] = useState(false);
  const { mode } = useAnimationMode("FLIP");

  return (
    <>
      {/* Animated reveal — shown until the player completes the interaction */}
      {!animationDone && result.prizePhotoUrl && (
        <AnimatedReveal
          mode={mode}
          prizePhotoUrl={result.prizePhotoUrl}
          prizeGrade={result.grade}
          prizeName={result.prizeName}
          onRevealed={() => setAnimationDone(true)}
          onDismiss={() => setAnimationDone(true)}
        />
      )}

      {/* Static prize detail card after animation */}
      {animationDone && (
        <div
          data-testid="animation-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <div
            data-testid="prize-result"
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Celebration header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-center text-white">
              <p className="font-bold text-lg">恭喜獲得！</p>
            </div>

            <div className="p-6 text-center">
              {result.prizePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.prizePhotoUrl}
                  alt={result.prizeName}
                  className="w-full h-48 object-cover rounded-xl mb-4 mx-auto"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">🏆</span>
                </div>
              )}

              <GradeBadge grade={result.grade} className="mb-3" data-testid="prize-grade" />
              <h3 data-testid="prize-name" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {result.prizeName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                已存入賞品庫 · 消費 {result.pointsCharged.toLocaleString()} 點
              </p>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors"
              >
                繼續抽獎
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UnlimitedSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            <Skeleton className="w-64 h-44 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
