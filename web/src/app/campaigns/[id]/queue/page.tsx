"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

const DRAW_MODE_QTY = [0, 1, 3, 5, 12] as const;

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
  const t = useTranslations("campaign");
  const tc = useTranslations("common");

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

  const DRAW_MODES = [
    { label: t("drawModeSelf"), qty: 0 },
    { label: `1 抽`, qty: 1 },
    { label: `3 抽`, qty: 3 },
    { label: `5 抽`, qty: 5 },
    { label: `12 抽`, qty: 12 },
  ];

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
  const selectedQty = DRAW_MODE_QTY[selectedMode] ?? 1;
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
        if (remaining <= 0) {
          clearInterval(countdownRef.current!);
          toast.info(t("turnExpired"));
          setQueueEntry(null);
        }
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
      toast.success(t("joinedQueue"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("joinQueueFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId, t]);

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
      if (!res.ok) throw new Error(t("leaveQueueFailed"));
      setQueueEntry(null);
      toast.info(t("leftQueue"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("leaveQueueFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId, t]);

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
      toast.success(t("drawSuccess"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("drawFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [boxId, selectedQty, t]);

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          href={`/campaigns/${campaignId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
          {t("backToCampaign")}
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
          <div className="mb-4 flex items-center justify-between rounded-xl bg-error-container/20 px-4 py-3">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-error/60 transition-colors hover:text-error"
            >
              <span className="material-symbols-outlined text-base leading-none">close</span>
            </button>
          </div>
        )}

        {/* Queue / Active state card */}
        {isMyTurn ? (
          <ActiveTurnCard countdown={countdown} drawPoints={drawPoints} />
        ) : (
          <WaitingCard queueEntry={queueEntry} />
        )}

        {/* Draw mode selector (active turn only) */}
        {isMyTurn && !drawResult && (
          <div className="mt-6 rounded-2xl bg-surface-container p-5">
            <h3 className="mb-4 font-headline font-semibold text-on-surface">{t("drawModeTitle")}</h3>
            <div className="mb-4 grid grid-cols-5 gap-2">
              {DRAW_MODES.map((mode, i) => (
                <button
                  key={i}
                  {...(mode.qty > 0 ? { "data-testid": `multi-draw-${mode.qty}` } : {})}
                  onClick={() => setSelectedMode(i)}
                  className={`rounded-xl px-1 py-2 text-xs font-semibold transition-all ${
                    selectedMode === i
                      ? "amber-gradient text-on-primary shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {selectedQty > 0 && (
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">{t("costPreview")}</span>
                <span className="font-bold text-primary tabular-nums">
                  {t("costPreviewDetail", { qty: selectedQty, total: totalCost.toLocaleString() })}
                </span>
              </div>
            )}

            {/* Coupon selector placeholder */}
            <button className="mb-4 w-full rounded-xl border border-dashed border-outline/40 py-2.5 text-sm text-on-surface-variant transition-colors hover:border-primary hover:text-primary">
              {t("useCoupon")}
            </button>

            <button
              onClick={handleDraw}
              disabled={loading}
              className="w-full rounded-xl py-3.5 font-bold text-base transition-all disabled:cursor-not-allowed disabled:opacity-50 amber-gradient text-on-primary shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 gold-glow"
            >
              {loading ? t("drawing") : DRAW_MODES[selectedMode]?.label ?? ""}
            </button>
          </div>
        )}

        {/* Queue controls */}
        <div className="mt-4 space-y-3">
          {!queueEntry ? (
            <button
              data-testid="join-queue-btn"
              onClick={handleJoinQueue}
              disabled={loading || !boxId}
              className="w-full rounded-xl py-3.5 font-bold text-base transition-all disabled:cursor-not-allowed disabled:opacity-50 amber-gradient text-on-primary shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 gold-glow"
            >
              {loading ? t("joiningBtn") : t("joinQueueBtn")}
            </button>
          ) : !isMyTurn ? (
            <button
              data-testid="leave-queue-btn"
              onClick={handleLeaveQueue}
              disabled={loading}
              className="w-full rounded-xl border border-error/30 bg-error-container/10 py-3.5 font-medium text-error transition-colors disabled:opacity-50 hover:bg-error-container/20"
            >
              {loading ? t("leavingBtn") : t("leaveQueue")}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/campaigns/${campaignId}`)}
                className="flex-1 rounded-xl bg-surface-container-high py-3 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {t("switchBox")}
              </button>
              <button
                data-testid="leave-queue-btn"
                onClick={handleLeaveQueue}
                disabled={loading}
                className="flex-1 rounded-xl border border-error/30 bg-error-container/10 py-3 text-sm font-medium text-error transition-colors disabled:opacity-50 hover:bg-error-container/20"
              >
                {t("endDraw")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draw result modal with animation */}
      {drawResult && (
        <DrawResultSequence
          result={drawResult}
          onContinue={() => setDrawResult(null)}
          onViewPrizes={() => router.push("/prizes")}
        />
      )}

      {/* Chat panel — players can chat while waiting */}
      {campaignId && <ChatPanel roomId={`kuji:${campaignId}`} />}
    </div>
  );
}

// Sub-components

function WaitingCard({ queueEntry }: { queueEntry: QueueEntryDto | null }) {
  const t = useTranslations("campaign");
  if (!queueEntry) {
    return (
      <div className="rounded-2xl bg-surface-container p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-3xl text-primary">confirmation_number</span>
        </div>
        <h2 className="mb-2 font-headline text-xl font-bold text-on-surface">{t("joinQueue")}</h2>
        <p className="text-sm text-on-surface-variant">
          {t("queueWatchNote")}
        </p>
      </div>
    );
  }

  const progressPercent = Math.max(
    0,
    Math.min(100, ((queueEntry.queueLength - queueEntry.position) / queueEntry.queueLength) * 100),
  );

  return (
    <div className="rounded-2xl bg-surface-container p-8">
      <div className="mb-6 text-center">
        <p className="mb-1 text-sm text-on-surface-variant">{t("queuePosition")}</p>
        <p className="text-6xl font-extrabold text-primary tabular-nums">
          {t("queuePositionNum", { position: queueEntry.position })}
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          {t("queuePeopleAhead", { count: queueEntry.position - 1 })}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-on-surface-variant">
          <span>{t("queueWaiting")}</span>
          <span>{t("queueYourTurn")}</span>
        </div>
      </div>

      <p className="text-center text-sm text-on-surface-variant">
        {t("queueWatchNote")}
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
  const t = useTranslations("campaign");

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isUrgent = countdown !== null && countdown < 60;

  return (
    <div className="rounded-2xl bg-surface-container p-8 gold-glow">
      {/* Amber accent top bar */}
      <div className="amber-gradient -mx-8 -mt-8 mb-6 rounded-t-2xl px-8 py-4 text-center">
        <p className="font-headline font-extrabold text-on-primary text-xl">{t("yourTurnHeader")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-container-high p-4 text-center">
          <p className="mb-1 text-xs text-on-surface-variant">{t("timeRemaining")}</p>
          <p
            data-testid="countdown-timer"
            className={`text-3xl font-bold tabular-nums ${
              isUrgent
                ? "animate-pulse text-error"
                : "text-on-surface"
            }`}
          >
            {countdown !== null ? formatCountdown(countdown) : "--:--"}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-high p-4 text-center">
          <p className="mb-1 text-xs text-on-surface-variant">{t("yourPoints")}</p>
          <p className="text-3xl font-bold text-primary tabular-nums">
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
  const t = useTranslations("campaign");
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
        <div data-testid="animation-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            data-testid="prize-result"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface-container shadow-2xl gold-glow"
          >
            {/* Header */}
            <div className="amber-gradient px-6 py-5 text-center">
              <span className="material-symbols-outlined mb-1 block text-3xl text-on-primary">
                celebration
              </span>
              <p className="font-headline font-bold text-lg text-on-primary">{t("congratsWon")}</p>
            </div>

            {/* Prize info */}
            <div className="p-6 text-center">
              {current.prizePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.prizePhotoUrl}
                  alt={current.prizeName}
                  className="mb-4 h-48 w-full rounded-xl object-cover"
                />
              )}
              <GradeBadge grade={current.grade} className="mb-3" data-testid="prize-grade" />
              <h3 data-testid="prize-name" className="mb-1 font-headline text-lg font-bold text-on-surface">
                {current.prizeName}
              </h3>
              <p className="mb-4 text-sm text-on-surface-variant">
                {t("prizeStoredDot")} · {t("pointsCharged", { points: current.pointsCharged.toLocaleString() })}
              </p>

              {result.tickets.length > 1 && (
                <p className="mb-4 text-xs text-on-surface-variant">
                  {t("ticketNum", { current: currentIdx + 1, total: result.tickets.length })}
                </p>
              )}

              <div className="flex gap-3">
                {hasMore ? (
                  <button
                    onClick={handleNext}
                    className="flex-1 rounded-xl py-3 font-semibold transition-all amber-gradient text-on-primary hover:shadow-md"
                  >
                    {t("nextTicket")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onContinue}
                      className="flex-1 rounded-xl bg-surface-container-high py-3 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {t("continueDrawing")}
                    </button>
                    <button
                      onClick={onViewPrizes}
                      className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all amber-gradient text-on-primary hover:shadow-md"
                    >
                      {t("viewPrizeVault")}
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
