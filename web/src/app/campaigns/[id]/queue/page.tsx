"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { authStore } from "@/stores/authStore";
import { GradeBadge } from "@/components/GradeBadge";
import { toast } from "@/components/Toast";
import { AnimatedReveal } from "@/animations/AnimatedReveal";
import { useAnimationMode } from "@/hooks/useAnimationMode";
import { SpectatorBar } from "@/components/SpectatorBar";
import { SpectatorAnimation } from "@/components/SpectatorAnimation";
import { ChatPanel } from "@/components/ChatPanel";
import { useDrawSync } from "@/hooks/useDrawSync";

interface QueueEntryDto {
  id: string;
  position: number;
  status: string;
  joinedAt: string;
  queueLength: number;
  sessionExpiresAt: string | null;
}

interface DrawnTicketResultDto {
  ticketId: string;
  position: number;
  prizeInstanceId: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string;
  pointsCharged: number;
}

interface DrawResultDto {
  tickets: DrawnTicketResultDto[];
}

const DRAW_MODES = [
  { label: "自選籤", qty: 0 },
  { label: "1 抽", qty: 1 },
  { label: "3 抽", qty: 3 },
  { label: "5 抽", qty: 5 },
  { label: "12 抽", qty: 12 },
];

export default function QueuePage() {
  return (
    <Suspense>
      <QueueContent />
    </Suspense>
  );
}

function QueueContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const campaignId =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const boxId = searchParams.get("boxId") ?? "";

  const [queueEntry, setQueueEntry] = useState<QueueEntryDto | null>(null);
  const [pricePerDraw, setPricePerDraw] = useState(0);
  const [drawPoints, setDrawPoints] = useState(0);
  const [selectedMode, setSelectedMode] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<DrawResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { activeDrawSession, lastRevealed, clearRevealed } = useDrawSync(campaignId);

  // Load campaign price + player points
  useEffect(() => {
    if (!campaignId) return;
    apiClient
      .get<{ campaign: { pricePerDraw: number } }>(`/api/v1/campaigns/kuji/${campaignId}`)
      .then((d) => setPricePerDraw(d.campaign.pricePerDraw))
      .catch(() => {});
    const p = authStore.player;
    if (p) setDrawPoints(p.drawPointsBalance);
  }, [campaignId]);

  const isMyTurn = queueEntry?.status === "ACTIVE";
  const selectedQty = DRAW_MODES[selectedMode]?.qty ?? 1;
  const totalCost = selectedQty > 0 ? selectedQty * pricePerDraw : pricePerDraw;

  // Countdown timer
  const sessionExpiresAt = queueEntry?.sessionExpiresAt ?? null;
  useEffect(() => {
    if (isMyTurn && sessionExpiresAt) {
      function update() {
        const remaining = Math.max(
          0,
          Math.floor((new Date(sessionExpiresAt!).getTime() - Date.now()) / 1000),
        );
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(countdownRef.current!);
      }
      update();
      countdownRef.current = setInterval(update, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isMyTurn, sessionExpiresAt]);

  const handleJoinQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entry = await apiClient.post<QueueEntryDto>("/api/v1/draws/kuji/queue/join", {
        ticketBoxId: boxId,
      });
      setQueueEntry(entry);
      toast.success("成功加入排隊！");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加入排隊失敗";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId]);

  const handleLeaveQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = authStore.accessToken;
      const res = await fetch("/api/v1/draws/kuji/queue/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ticketBoxId: boxId }),
      });
      if (!res.ok) throw new Error("離開排隊失敗");
      setQueueEntry(null);
      toast.info("已離開排隊");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "離開排隊失敗";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId]);

  const handleDraw = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<DrawResultDto>("/api/v1/draws/kuji", {
        ticketBoxId: boxId,
        ticketIds: [],
        quantity: selectedQty > 0 ? selectedQty : 1,
      });
      setDrawResult(result);
      toast.success("抽獎成功！");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "抽獎失敗";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId, selectedQty]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
        >
          ← 返回活動頁
        </Link>

        {/* When someone else is drawing and player is waiting */}
        {!isMyTurn && activeDrawSession && (
          <div className="mb-6">
            <SpectatorBar
              activeSession={activeDrawSession}
              lastRevealed={lastRevealed}
              onRevealDismissed={clearRevealed}
            />
            <SpectatorAnimation
              animationMode={activeDrawSession.animationMode}
              progress={activeDrawSession.progress}
            />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-lg ml-3"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Queue / Active state card ───────────────────────── */}
        {isMyTurn ? (
          <ActiveTurnCard countdown={countdown} drawPoints={drawPoints} />
        ) : (
          <WaitingCard queueEntry={queueEntry} />
        )}

        {/* ── Draw mode selector (active turn only) ───────────── */}
        {isMyTurn && !drawResult && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">抽籤模式選擇</h3>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {DRAW_MODES.map((mode, i) => (
                <button
                  key={i}
                  {...(mode.qty > 0 ? { "data-testid": `multi-draw-${mode.qty}` } : {})}
                  onClick={() => setSelectedMode(i)}
                  className={`py-2 px-1 rounded-xl text-xs font-medium transition-all ${
                    selectedMode === i
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {selectedQty > 0 && (
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-gray-500 dark:text-gray-400">費用預覽</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedQty} 抽 = {totalCost.toLocaleString()} 點
                </span>
              </div>
            )}

            {/* Coupon selector placeholder */}
            <button className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4">
              使用優惠券 ▼
            </button>

            <button
              onClick={handleDraw}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "抽獎中..." : `🎫 ${DRAW_MODES[selectedMode].label}`}
            </button>
          </div>
        )}

        {/* ── Queue controls ────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          {!queueEntry ? (
            <button
              data-testid="join-queue-btn"
              onClick={handleJoinQueue}
              disabled={loading || !boxId}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "加入中..." : "加入排隊"}
            </button>
          ) : !isMyTurn ? (
            <button
              data-testid="leave-queue-btn"
              onClick={handleLeaveQueue}
              disabled={loading}
              className="w-full py-3.5 rounded-xl border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              {loading ? "離開中..." : "離開排隊"}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/campaigns/${campaignId}`)}
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                切換籤盒
              </button>
              <button
                data-testid="leave-queue-btn"
                onClick={handleLeaveQueue}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors text-sm"
              >
                結束抽籤
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Draw result modal with animation ─────────────────── */}
      {drawResult && (
        <DrawResultSequence
          result={drawResult}
          onContinue={() => setDrawResult(null)}
          onViewPrizes={() => router.push("/prizes")}
        />
      )}

      {/* ── Chat panel — players can chat while waiting ───────── */}
      {campaignId && <ChatPanel roomId={`kuji:${campaignId}`} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WaitingCard({ queueEntry }: { queueEntry: QueueEntryDto | null }) {
  if (!queueEntry) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="text-5xl mb-4">🎫</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">加入排隊</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          點擊下方按鈕加入排隊，等待輪到你時即可開始抽籤
        </p>
      </div>
    );
  }

  const progressPercent = Math.max(
    0,
    Math.min(100, ((queueEntry.queueLength - queueEntry.position) / queueEntry.queueLength) * 100),
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">你的排隊位置</p>
        <p className="text-6xl font-extrabold text-indigo-600 dark:text-indigo-400">
          第 {queueEntry.position} 位
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          前方還有 {queueEntry.position - 1} 人
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>等待中</span>
          <span>輪到你</span>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        你在排隊時可以即時觀看籤面更新
      </p>
    </div>
  );
}

function ActiveTurnCard({
  countdown,
  drawPoints,
}: {
  countdown: number | null;
  drawPoints: number;
}) {
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isUrgent = countdown !== null && countdown < 60;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
          輪到你了！
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">剩餘時間</p>
          <p
            data-testid="countdown-timer"
            className={`text-3xl font-bold tabular-nums ${
              isUrgent
                ? "text-red-600 dark:text-red-400 animate-pulse"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {countdown !== null ? formatCountdown(countdown) : "--:--"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">你的點數</p>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {drawPoints.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Sequences through each drawn ticket, showing an AnimatedReveal for each one.
 * After the animation is complete the static prize card is displayed so the
 * player can read the details before advancing.
 */
function DrawResultSequence({
  result,
  onContinue,
  onViewPrizes,
}: {
  result: DrawResultDto;
  onContinue: () => void;
  onViewPrizes: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ticketRevealed, setTicketRevealed] = useState(false);
  const { mode } = useAnimationMode("FLIP");

  const current = result.tickets[currentIdx];
  const hasMore = currentIdx < result.tickets.length - 1;

  // Reset per-ticket state when we advance to the next ticket
  const handleNext = () => {
    setCurrentIdx((i) => i + 1);
    setTicketRevealed(false);
  };

  return (
    <>
      {/* Animated reveal overlay */}
      {!ticketRevealed && current.prizePhotoUrl && (
        <AnimatedReveal
          mode={mode}
          prizePhotoUrl={current.prizePhotoUrl}
          prizeGrade={current.grade}
          prizeName={current.prizeName}
          onRevealed={() => setTicketRevealed(true)}
        />
      )}

      {/* Static result card shown after animation completes */}
      {ticketRevealed && (
        <div data-testid="animation-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div data-testid="prize-result" className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-center text-white">
              <p className="font-bold text-lg">恭喜獲得！</p>
            </div>

            {/* Prize info */}
            <div className="p-6 text-center">
              {current.prizePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.prizePhotoUrl}
                  alt={current.prizeName}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )}
              <GradeBadge grade={current.grade} className="mb-3" data-testid="prize-grade" />
              <h3 data-testid="prize-name" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {current.prizeName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                已存入賞品庫 · 消費 {current.pointsCharged.toLocaleString()} 點
              </p>

              {result.tickets.length > 1 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                  第 {currentIdx + 1} / {result.tickets.length} 個
                </p>
              )}

              <div className="flex gap-3">
                {hasMore ? (
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    下一個 →
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onContinue}
                      className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      繼續抽
                    </button>
                    <button
                      onClick={onViewPrizes}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors text-sm"
                    >
                      查看賞品庫
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
