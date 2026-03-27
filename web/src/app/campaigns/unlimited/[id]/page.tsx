"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
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
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";
import { useChat } from "@/hooks/useChat";
import { authStore } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PageState = "BROWSING" | "DRAWING" | "RESULT" | "SPECTATING";

interface ActiveDrawer {
  playerId: string;
  nickname: string;
  /** ISO timestamp of when they started drawing */
  startedAt: string;
}

interface RecentWin {
  id: string;
  nickname: string;
  grade: string;
  prizeName: string;
  timestamp: string;
  isNew?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MULTI_DRAW_OPTIONS = [
  { label: "×3", qty: 3 },
  { label: "×5", qty: 5 },
  { label: "×10", qty: 10 },
];

const REACTION_EMOJIS = ["🎉", "😱", "👏", "🔥", "💪", "😂", "❤️", "🎊"];

// ─────────────────────────────────────────────────────────────────────────────
// Inline ChatPanel for sidebar — a compact variant of the global ChatPanel
// ─────────────────────────────────────────────────────────────────────────────

interface InlineChatPanelProps {
  roomId: string;
}

function InlineChatPanel({ roomId }: InlineChatPanelProps) {
  const t = useTranslations("campaign");
  const [inputText, setInputText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const { messages, isConnected, sendMessage, sendReaction, isCoolingDown } = useChat(roomId);
  const { currentEmoji, pushReaction } = useReactionQueue();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentPlayerId = authStore.player?.id ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (latest?.isReaction) pushReaction(latest.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isCoolingDown) return;
    setSendError(null);
    try {
      await sendMessage(inputText.trim());
      setInputText("");
      inputRef.current?.focus();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("chatSendFailed"));
    }
  };

  const handleReaction = async (emoji: string) => {
    if (isCoolingDown) return;
    setSendError(null);
    try {
      await sendReaction(emoji);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("chatSendFailed"));
    }
  };

  const MAX_LEN = 100;
  const remaining = MAX_LEN - inputText.length;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Floating reactions */}
      <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
        <ReactionOverlay emoji={currentEmoji} />
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-surface-container-highest px-3 py-2">
        <span className="material-symbols-outlined text-base text-secondary leading-none">chat</span>
        <span className="text-sm font-semibold text-on-surface">{t("chatTitle")}</span>
        <span
          className={`h-2 w-2 rounded-full ${isConnected ? "bg-tertiary animate-pulse" : "bg-on-surface-variant/40"}`}
          title={isConnected ? t("chatConnected") : t("chatConnecting")}
        />
      </div>

      {/* Message list */}
      <div className="hide-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="mt-4 text-center text-xs text-on-surface-variant">
            {t("chatNoMessages")}
          </p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.playerId === currentPlayerId;
          if (msg.isReaction) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant">
                  {msg.nickname} {msg.message}
                </span>
              </div>
            );
          }
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isSelf ? "items-end" : "items-start"}`}
            >
              {!isSelf && (
                <span className="px-1 text-xs text-on-surface-variant">{msg.nickname}</span>
              )}
              <div
                className={`max-w-[90%] break-words rounded-xl px-2.5 py-1.5 text-xs ${
                  isSelf
                    ? "amber-gradient text-on-primary rounded-br-sm"
                    : "bg-surface-container-highest text-on-surface rounded-bl-sm"
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reaction bar */}
      <div className="hide-scrollbar flex shrink-0 gap-1 overflow-x-auto border-t border-surface-container-highest px-2 py-1.5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => void handleReaction(emoji)}
            disabled={isCoolingDown}
            className="shrink-0 rounded-lg p-1 text-base transition-colors hover:bg-surface-container-highest disabled:opacity-40"
            aria-label={t("sendReactionLabel", { emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-surface-container-highest px-3 pb-3 pt-2">
        {sendError && <p className="mb-1 text-xs text-error">{sendError}</p>}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={t("chatPlaceholder")}
              className="w-full rounded-lg bg-surface-container-highest pr-8 px-3 py-2 text-xs text-on-surface placeholder-on-surface-variant outline-none focus:ring-1 focus:ring-primary"
            />
            <span
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                remaining < 20 ? "text-error" : "text-on-surface-variant"
              }`}
            >
              {remaining}
            </span>
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || isCoolingDown}
            className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 amber-gradient text-on-primary hover:shadow-sm"
          >
            {isCoolingDown ? "⏱" : t("chatSend")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar tabs for mobile bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

type SidebarTab = "drawers" | "wins" | "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function UnlimitedCampaignPage() {
  const t = useTranslations("campaign");
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

  const { mode } = useAnimationMode("FLIP");

  // UI state
  const [couponOpen, setCouponOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<{ id: string; label: string; discount: number }[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [watchingPlayerId, setWatchingPlayerId] = useState<string | null>(null);
  const [activeDrawers, setActiveDrawers] = useState<ActiveDrawer[]>([]);
  const [recentWins, setRecentWins] = useState<RecentWin[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("drawers");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived page state
  const pageState: PageState = isDrawing
    ? "DRAWING"
    : lastResult
      ? "RESULT"
      : watchingPlayerId
        ? "SPECTATING"
        : "BROWSING";

  const selectedCouponData = coupons.find((c) => c.id === selectedCoupon) ?? null;
  const effectivePrice = campaign
    ? Math.round(campaign.pricePerDraw * (selectedCouponData?.discount ?? 1))
    : 0;
  const canAfford = pointBalance >= effectivePrice;
  const watchingDrawer = activeDrawers.find((d) => d.playerId === watchingPlayerId) ?? null;
  const isSpectating = pageState === "SPECTATING" && watchingDrawer !== null;

  // Rate-limit detection
  useEffect(() => {
    if (!error) return;
    if (!(error.includes("429") || error.includes("rate") || error.includes("稍後"))) return;
    startTransition(() => {
      setRateLimited(true);
    });
    if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    rateLimitTimerRef.current = setTimeout(() => {
      startTransition(() => setRateLimited(false));
      rateLimitTimerRef.current = null;
    }, 3000);
  }, [error]);

  // Multi-draw orchestration
  const handleMultiDraw = useCallback(
    async (qty: number) => {
      if (!campaign || isDrawing || rateLimited) return;
      if (pointBalance < effectivePrice * qty) return;

      for (let i = 0; i < qty; i++) {
        await draw();
      }
    },
    [campaign, isDrawing, rateLimited, pointBalance, effectivePrice, draw],
  );

  // Single draw
  const handleDraw = useCallback(async () => {
    if (!campaign || isDrawing || rateLimited) return;
    if (!canAfford) return;

    try {
      await draw();
      setPointBalance((prev) => prev - effectivePrice);
    } catch {
      // Errors are surfaced via the hook's error field
    }
  }, [campaign, isDrawing, rateLimited, canAfford, draw, effectivePrice]);

  const handleAcknowledge = useCallback(() => {
    acknowledgeResult();
  }, [acknowledgeResult]);

  const handleWatchPlayer = useCallback((playerId: string) => {
    setWatchingPlayerId(playerId);
  }, []);

  const handleStopWatching = useCallback(() => {
    setWatchingPlayerId(null);
  }, []);

  // Load player balance + coupons from API
  useEffect(() => {
    apiClient
      .get<{ drawPointsBalance: number }>("/api/v1/players/me/wallet")
      .then((w) => setPointBalance(w.drawPointsBalance ?? 0))
      .catch(() => {});
    apiClient
      .get<{ id: string; label: string; discount: number }[]>("/api/v1/players/me/coupons")
      .then(setCoupons)
      .catch(() => {});
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, []);

  // Loading state
  if (isLoading) return <UnlimitedPageSkeleton />;

  if (!campaign && !isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">
            sentiment_dissatisfied
          </span>
        </div>
        <p className="text-on-surface-variant">{error ?? t("notFound")}</p>
        <Link
          href="/campaigns?type=unlimited"
          className="rounded-xl px-6 py-3 text-sm font-semibold transition-all amber-gradient text-on-primary hover:shadow-md"
        >
          {t("backToList")}
        </Link>
      </div>
    );
  }

  // Render
  return (
    <div className="min-h-screen bg-surface-dim">

      {/* Top navbar strip */}
      <div className="sticky top-0 z-20 bg-surface-container-low shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <Link
            href="/campaigns?type=unlimited"
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            <span className="hidden sm:inline">{t("backToList")}</span>
          </Link>

          {/* Title */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <StatusBadge status={t("unlimitedBadge")} />
            <h1 className="truncate font-headline text-sm font-bold text-on-surface sm:text-base">
              {campaign?.title ?? t("notFound")}
            </h1>
          </div>

          {/* Right — viewer count + LIVE + mobile toggle */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-sm leading-none text-secondary">
                visibility
              </span>
              <span className="font-medium tabular-nums">{spectatorCount}</span>
              <span className="hidden sm:inline text-xs">{t("viewers2")}</span>
            </span>
            <span className="flex animate-pulse items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-on-error-container">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              LIVE
            </span>
            <button
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface lg:hidden"
              aria-label={t("openSidebar")}
            >
              <span className="material-symbols-outlined text-base leading-none">menu</span>
              {t("sidebarToggle")}
            </button>
          </div>
        </div>
      </div>

      {/* Rate limit banner */}
      {rateLimited && (
        <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="material-symbols-outlined text-base leading-none">warning</span>
            <span>{t("rateLimitBanner")}</span>
          </div>
          <div className="h-2 w-2 animate-ping rounded-full bg-primary" />
        </div>
      )}

      {/* Error banner */}
      {error && !rateLimited && (
        <div className="flex items-center justify-between border-b border-error/20 bg-error-container/20 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-error">
            <span className="material-symbols-outlined text-base leading-none">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={dismissError}
            className="leading-none text-error/60 transition-colors hover:text-error"
            aria-label={t("closeSidebarLabel")}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">

          {/* Left / Main content */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* Spectating banner */}
            {isSpectating && (
              <SpectatingBanner drawer={watchingDrawer!} onStop={handleStopWatching} />
            )}

            {/* Probability table */}
            {prizes.length > 0 && (
              <section className="overflow-hidden rounded-2xl bg-surface-container">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-container-highest">
                  <h2 className="font-headline text-base font-bold text-on-surface">{t("prizesAndOdds")}</h2>
                  <span className="text-xs text-on-surface-variant">{t("independentOdds")}</span>
                </div>
                <div className="overflow-x-auto">
                  <ProbabilityTable prizes={prizes} />
                </div>
              </section>
            )}

            {/* Draw area */}
            {campaign && (
              <section className="overflow-hidden rounded-2xl bg-surface-container">
                <div className="border-b border-surface-container-highest px-5 py-4">
                  <h2 className="font-headline text-base font-bold text-on-surface">{t("drawArea")}</h2>
                </div>
                <div className="p-5">
                  <DrawArea
                    pricePerDraw={campaign.pricePerDraw}
                    effectivePrice={effectivePrice}
                    pointBalance={pointBalance}
                    isDrawing={isDrawing}
                    pageState={pageState}
                    rateLimited={rateLimited}
                    canAfford={canAfford}
                    couponOpen={couponOpen}
                    selectedCoupon={selectedCoupon}
                    selectedCouponData={selectedCouponData}
                    coupons={coupons}
                    onToggleCoupon={() => setCouponOpen((v) => !v)}
                    onSelectCoupon={(cid) => { setSelectedCoupon(cid); setCouponOpen(false); }}
                    onClearCoupon={() => { setSelectedCoupon(null); setCouponOpen(false); }}
                    onDraw={handleDraw}
                    onMultiDraw={handleMultiDraw}
                  />
                </div>
              </section>
            )}

            {/* Session draw history */}
            {drawHistory.length > 0 && (
              <section className="overflow-hidden rounded-2xl bg-surface-container">
                <div className="flex items-center justify-between border-b border-surface-container-highest px-5 py-4">
                  <h2 className="font-headline text-base font-bold text-on-surface">{t("sessionHistory")}</h2>
                  <span className="text-xs text-on-surface-variant">{t("sessionHistoryCount", { count: drawHistory.length })}</span>
                </div>
                <SessionHistory history={drawHistory} />
              </section>
            )}
          </div>

          {/* Right sidebar — desktop only */}
          <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex xl:w-80">
            <SidebarContent
              activeDrawers={activeDrawers}
              recentWins={recentWins}
              campaignId={id}
              onWatchPlayer={handleWatchPlayer}
              watchingPlayerId={watchingPlayerId}
            />
          </aside>
        </div>
      </div>

      {/* Mobile bottom sheet sidebar */}
      {mobileSidebarOpen && (
        <MobileSidebarSheet
          activeDrawers={activeDrawers}
          recentWins={recentWins}
          campaignId={id}
          onWatchPlayer={(pid) => { handleWatchPlayer(pid); setMobileSidebarOpen(false); }}
          watchingPlayerId={watchingPlayerId}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          onClose={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Result reveal modal */}
      {lastResult && pageState === "RESULT" && (
        <ResultModal
          result={lastResult}
          mode={mode}
          onClose={handleAcknowledge}
        />
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Probability table
// ─────────────────────────────────────────────────────────────────────────────

function ProbabilityTable({ prizes }: { prizes: PrizeDefinitionDto[] }) {
  const t = useTranslations("campaign");
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-surface-container-high">
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("gradeCol")}
          </th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("prizeCol")}
          </th>
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {t("oddsCol")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-container-highest">
        {prizes.map((prize) => (
          <PrizeRow key={prize.id} prize={prize} />
        ))}
      </tbody>
    </table>
  );
}

function PrizeRow({ prize }: { prize: PrizeDefinitionDto }) {
  const probabilityText =
    prize.probabilityBps !== null ? formatProbabilityBps(prize.probabilityBps) : "--";

  return (
    <tr className="transition-colors hover:bg-surface-container-high">
      <td className="px-4 py-3">
        <GradeBadge grade={prize.grade} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {prize.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.photos[0]}
              alt={prize.name}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
              <span className="material-symbols-outlined text-base text-on-surface-variant">
                workspace_premium
              </span>
            </div>
          )}
          <span className="text-sm font-medium text-on-surface">{prize.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-bold tabular-nums text-primary text-sm">{probabilityText}</span>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw area
// ─────────────────────────────────────────────────────────────────────────────

interface CouponOption {
  id: string;
  label: string;
  discount: number;
}

interface DrawAreaProps {
  pricePerDraw: number;
  effectivePrice: number;
  pointBalance: number;
  isDrawing: boolean;
  pageState: PageState;
  rateLimited: boolean;
  canAfford: boolean;
  couponOpen: boolean;
  selectedCoupon: string | null;
  selectedCouponData: CouponOption | null;
  coupons: CouponOption[];
  onToggleCoupon: () => void;
  onSelectCoupon: (id: string) => void;
  onClearCoupon: () => void;
  onDraw: () => void;
  onMultiDraw: (qty: number) => void;
}

function DrawArea({
  pricePerDraw,
  effectivePrice,
  pointBalance,
  isDrawing,
  pageState,
  rateLimited,
  canAfford,
  couponOpen,
  selectedCoupon,
  selectedCouponData,
  coupons,
  onToggleCoupon,
  onSelectCoupon,
  onClearCoupon,
  onDraw,
  onMultiDraw,
}: DrawAreaProps) {
  const t = useTranslations("campaign");
  const isDisabled = isDrawing || pageState === "DRAWING" || rateLimited || !canAfford;

  return (
    <div className="space-y-4">
      {/* Balance + price row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs text-on-surface-variant">{t("yourPointsBalance")}</p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {pointBalance.toLocaleString()} {t("pointsUnit")}
          </p>
          {!canAfford && (
            <p className="mt-0.5 text-xs text-error">{t("insufficientPointsMsg")}</p>
          )}
        </div>
        <div className="text-right">
          <p className="mb-0.5 text-xs text-on-surface-variant">{t("pricePerDrawLabel")}</p>
          <div className="flex items-center gap-1.5">
            {selectedCouponData && (
              <span className="text-sm tabular-nums text-on-surface-variant line-through">
                {pricePerDraw.toLocaleString()}
              </span>
            )}
            <span className="text-xl font-bold tabular-nums text-primary">
              {effectivePrice.toLocaleString()} {t("pointsUnit")}
            </span>
          </div>
        </div>
      </div>

      {/* Coupon selector */}
      <div className="relative">
        <button
          onClick={onToggleCoupon}
          className={`flex w-full items-center justify-between rounded-xl border border-dashed px-4 py-2.5 text-sm transition-colors ${
            selectedCoupon
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-outline/30 text-on-surface-variant hover:border-primary hover:text-primary"
          }`}
        >
          <span>
            {selectedCouponData ? (
              <>
                <span className="mr-1">🎫</span>
                {selectedCouponData.label}
              </>
            ) : (
              t("useCouponBtn")
            )}
          </span>
          <span className="material-symbols-outlined text-base leading-none">
            {couponOpen ? "expand_less" : "expand_more"}
          </span>
        </button>

        {couponOpen && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl bg-surface-container-highest shadow-xl">
            {selectedCoupon && (
              <button
                onClick={onClearCoupon}
                className="w-full border-b border-surface-container-high px-4 py-2.5 text-left text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                {t("noCoupon")}
              </button>
            )}
            {coupons.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCoupon(c.id)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary/10 ${
                  selectedCoupon === c.id
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface"
                }`}
              >
                <span className="mr-2">🎫</span>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Big single-draw button */}
      <button
        data-testid="draw-button"
        onClick={onDraw}
        disabled={isDisabled}
        className={`w-full rounded-2xl py-5 text-xl font-extrabold transition-all ${
          isDisabled
            ? "cursor-not-allowed bg-surface-container-high text-on-surface-variant"
            : "amber-gradient text-on-primary shadow-lg hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md gold-glow"
        }`}
      >
        {rateLimited
          ? t("rateLimited")
          : isDrawing
            ? t("drawingNow")
            : !canAfford
              ? t("insufficientPoints")
              : t("drawNowBtn")}
      </button>

      {/* Multi-draw buttons */}
      <div className="space-y-2">
        <p className="text-center text-xs text-on-surface-variant">{t("multiDraw2")}</p>
        <div className="flex gap-3">
          {MULTI_DRAW_OPTIONS.map((opt) => {
            const totalCost = effectivePrice * opt.qty;
            const canAffordMulti = pointBalance >= totalCost;
            return (
              <button
                key={opt.qty}
                data-testid={`multi-draw-${opt.qty}`}
                disabled={isDisabled || !canAffordMulti}
                onClick={() => onMultiDraw(opt.qty)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-3 text-sm font-bold transition-colors ${
                  isDisabled || !canAffordMulti
                    ? "cursor-not-allowed border-surface-container-highest text-on-surface-variant/30"
                    : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-xs font-normal opacity-70 tabular-nums">
                  {totalCost.toLocaleString()} {t("pointsUnit")}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-on-surface-variant">
          {t("multiDrawNote")}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session history
// ─────────────────────────────────────────────────────────────────────────────

function SessionHistory({ history }: { history: UnlimitedDrawResultDto[] }) {
  return (
    <div data-testid="draw-history" className="hide-scrollbar max-h-64 divide-y divide-surface-container-highest overflow-y-auto">
      {history.map((result, i) => (
        <SessionHistoryRow key={`${result.prizeInstanceId}-${i}`} result={result} />
      ))}
    </div>
  );
}

function SessionHistoryRow({ result }: { result: UnlimitedDrawResultDto }) {
  const t = useTranslations("campaign");
  const time = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      data-testid="draw-history-item"
      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-container-high"
    >
      <span className="w-10 shrink-0 text-xs tabular-nums text-on-surface-variant">
        {time}
      </span>
      {result.prizePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.prizePhotoUrl}
          alt={result.prizeName}
          className="h-8 w-8 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-high">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            workspace_premium
          </span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GradeBadge grade={result.grade} />
        <span className="truncate text-sm text-on-surface">{result.prizeName}</span>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-error">
        -{result.pointsCharged.toLocaleString()} {t("pointsUnit")}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content (shared between desktop and mobile)
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarContentProps {
  activeDrawers: ActiveDrawer[];
  recentWins: RecentWin[];
  campaignId: string;
  onWatchPlayer: (playerId: string) => void;
  watchingPlayerId: string | null;
}

function SidebarContent({
  activeDrawers,
  recentWins,
  campaignId,
  onWatchPlayer,
  watchingPlayerId,
}: SidebarContentProps) {
  const t = useTranslations("campaign");
  return (
    <>
      {/* Active drawers */}
      <div className="overflow-hidden rounded-2xl bg-surface-container">
        <div className="flex items-center gap-2 border-b border-surface-container-highest px-4 py-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
          <h3 className="text-sm font-bold text-on-surface">{t("activeDrawersTitle")}</h3>
          <span className="ml-auto rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant">
            {activeDrawers.length}
          </span>
        </div>
        <div className="hide-scrollbar max-h-52 divide-y divide-surface-container-highest overflow-y-auto">
          {activeDrawers.length === 0 && (
            <p className="px-4 py-3 text-xs text-on-surface-variant">{t("noActiveDrawers")}</p>
          )}
          {activeDrawers.map((drawer) => (
            <div
              key={drawer.playerId}
              className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${
                watchingPlayerId === drawer.playerId
                  ? "bg-primary/10"
                  : "hover:bg-surface-container-high"
              }`}
            >
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">
                {drawer.nickname}
              </span>
              <button
                onClick={() => onWatchPlayer(drawer.playerId)}
                className={`shrink-0 text-xs transition-colors ${
                  watchingPlayerId === drawer.playerId
                    ? "font-semibold text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {watchingPlayerId === drawer.playerId ? t("watching") : t("watch")}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent wins */}
      <div className="overflow-hidden rounded-2xl bg-surface-container">
        <div className="flex items-center gap-2 border-b border-surface-container-highest px-4 py-3">
          <span className="material-symbols-outlined text-base text-primary leading-none">
            emoji_events
          </span>
          <h3 className="text-sm font-bold text-on-surface">{t("recentWins")}</h3>
        </div>
        <div className="hide-scrollbar max-h-52 divide-y divide-surface-container-highest overflow-y-auto">
          {recentWins.map((win) => (
            <div
              key={win.id}
              className={`flex items-center gap-2 px-4 py-2 transition-all ${
                win.isNew ? "bg-primary/10" : "hover:bg-surface-container-high"
              }`}
            >
              {win.isNew && (
                <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-xs font-bold text-primary">
                  NEW
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-on-surface">
                {win.nickname}
              </span>
              <GradeBadge grade={win.grade} />
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div
        className="overflow-hidden rounded-2xl bg-surface-container flex flex-col"
        style={{ minHeight: "280px", maxHeight: "400px" }}
      >
        <InlineChatPanel roomId={`unlimited:${campaignId}`} />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile sidebar bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

interface MobileSidebarSheetProps extends SidebarContentProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

// SIDEBAR_TABS labels are resolved via i18n inside MobileSidebarSheet

function MobileSidebarSheet({
  activeDrawers,
  recentWins,
  campaignId,
  onWatchPlayer,
  watchingPlayerId,
  activeTab,
  onTabChange,
  onClose,
}: MobileSidebarSheetProps) {
  const t = useTranslations("campaign");
  const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
    { id: "drawers", label: t("sidebarDrawers") },
    { id: "wins", label: t("sidebarWins") },
    { id: "chat", label: t("sidebarChat") },
  ];
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("closeSidebarLabel")}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl bg-surface-container-low shadow-2xl">
        {/* Handle + close */}
        <div className="relative flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
          <div className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-surface-container-highest" />
          <div />
          <button
            onClick={onClose}
            className="text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label={t("closeSidebarLabel")}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 px-4 pb-3">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "amber-gradient text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {activeTab === "drawers" && (
            <div className="space-y-2">
              {activeDrawers.length === 0 && (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  {t("noActiveDrawers")}
                </p>
              )}
              {activeDrawers.map((drawer) => (
                <div
                  key={drawer.playerId}
                  className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                    watchingPlayerId === drawer.playerId
                      ? "bg-primary/10"
                      : "bg-surface-container-high"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-error" />
                  <span className="flex-1 truncate font-semibold text-sm text-on-surface">
                    {drawer.nickname}
                  </span>
                  <button
                    onClick={() => onWatchPlayer(drawer.playerId)}
                    className="shrink-0 text-xs font-medium text-secondary hover:text-primary"
                  >
                    {watchingPlayerId === drawer.playerId ? t("watching") : t("watchDraw")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "wins" && (
            <div className="space-y-2">
              {recentWins.map((win) => (
                <div
                  key={win.id}
                  className={`flex items-center gap-2 rounded-xl p-3 transition-all ${
                    win.isNew
                      ? "bg-primary/10"
                      : "bg-surface-container-high"
                  }`}
                >
                  {win.isNew && (
                    <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-xs font-bold text-primary">
                      NEW
                    </span>
                  )}
                  <span className="flex-1 truncate text-sm font-medium text-on-surface">
                    {win.nickname}
                  </span>
                  <GradeBadge grade={win.grade} />
                  <span className="shrink-0 text-xs text-on-surface-variant">{win.timestamp}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="h-80 overflow-hidden rounded-xl bg-surface-container">
              <InlineChatPanel roomId={`unlimited:${campaignId}`} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spectating banner
// ─────────────────────────────────────────────────────────────────────────────

function SpectatingBanner({
  drawer,
  onStop,
}: {
  drawer: ActiveDrawer;
  onStop: () => void;
}) {
  const t = useTranslations("campaign");
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-error" />
        <div>
          <p className="text-sm font-bold text-on-surface">
            {t("spectatingBannerTitle", { nickname: drawer.nickname })}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {t("spectatingBannerNote")}
          </p>
        </div>
      </div>
      <button
        onClick={onStop}
        className="shrink-0 rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {t("stopWatching")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result reveal modal
// ─────────────────────────────────────────────────────────────────────────────

function ResultModal({
  result,
  mode,
  onClose,
}: {
  result: UnlimitedDrawResultDto;
  mode: ReturnType<typeof useAnimationMode>["mode"];
  onClose: () => void;
}) {
  const t = useTranslations("campaign");
  const [animationDone, setAnimationDone] = useState(false);

  return (
    <>
      {/* Animated reveal — only when photo exists */}
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

      {/* Static prize detail card after animation (or immediately if no photo) */}
      {(animationDone || !result.prizePhotoUrl) && (
        <div
          data-testid="animation-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={onClose}
        >
          <div
            data-testid="prize-result"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface-container shadow-2xl gold-glow"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Celebration header */}
            <div className="amber-gradient px-6 py-5 text-center">
              <span className="material-symbols-outlined mb-1 block text-3xl text-on-primary">
                celebration
              </span>
              <p className="font-headline font-bold text-lg text-on-primary">{t("congratsWon")}</p>
            </div>

            <div className="p-6 text-center">
              {result.prizePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.prizePhotoUrl}
                  alt={result.prizeName}
                  className="mx-auto mb-4 h-48 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-surface-container-high">
                  <span className="material-symbols-outlined text-5xl text-primary">
                    workspace_premium
                  </span>
                </div>
              )}

              <GradeBadge
                grade={result.grade}
                className="mb-3"
                data-testid="prize-grade"
              />
              <h3
                data-testid="prize-name"
                className="mb-1 font-headline text-xl font-bold text-on-surface"
              >
                {result.prizeName}
              </h3>
              <p className="mb-6 text-sm text-on-surface-variant">
                {t("prizeStored", { points: result.pointsCharged.toLocaleString() })}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl py-3.5 font-bold transition-all amber-gradient text-on-primary hover:shadow-md"
                >
                  {t("continueDrawBtn")}
                </button>
                <Link
                  href="/prizes"
                  className="rounded-xl bg-surface-container-high px-4 py-3.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
                  onClick={onClose}
                >
                  {t("myPrizesBtn")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function UnlimitedPageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-dim">
      {/* Sticky nav skeleton */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-4 bg-surface-container-low px-6">
        <Skeleton className="h-5 w-16 rounded-lg bg-surface-container-high" />
        <Skeleton className="mx-auto h-5 max-w-xs flex-1 rounded-lg bg-surface-container-high" />
        <Skeleton className="h-5 w-24 rounded-lg bg-surface-container-high" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 space-y-5">
            {/* Probability table skeleton */}
            <div className="overflow-hidden rounded-2xl bg-surface-container">
              <div className="border-b border-surface-container-highest px-5 py-4">
                <Skeleton className="h-5 w-28 rounded-lg bg-surface-container-high" />
              </div>
              <div className="divide-y divide-surface-container-highest">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-6 w-12 rounded-full bg-surface-container-high" />
                    <Skeleton className="h-10 w-10 rounded-lg bg-surface-container-high" />
                    <Skeleton className="h-4 flex-1 rounded bg-surface-container-high" />
                    <Skeleton className="h-4 w-14 rounded bg-surface-container-high" />
                  </div>
                ))}
              </div>
            </div>

            {/* Draw area skeleton */}
            <div className="overflow-hidden rounded-2xl bg-surface-container">
              <div className="border-b border-surface-container-highest px-5 py-4">
                <Skeleton className="h-5 w-16 rounded-lg bg-surface-container-high" />
              </div>
              <div className="space-y-4 p-5">
                <div className="flex justify-between">
                  <Skeleton className="h-8 w-32 rounded-lg bg-surface-container-high" />
                  <Skeleton className="h-8 w-20 rounded-lg bg-surface-container-high" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl bg-surface-container-high" />
                <Skeleton className="h-16 w-full rounded-2xl bg-surface-container-high" />
                <div className="flex gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 flex-1 rounded-xl bg-surface-container-high" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar skeleton — desktop only */}
          <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex xl:w-80">
            <Skeleton className="h-44 w-full rounded-2xl bg-surface-container" />
            <Skeleton className="h-52 w-full rounded-2xl bg-surface-container" />
            <Skeleton className="h-72 w-full rounded-2xl bg-surface-container" />
          </aside>
        </div>
      </div>
    </div>
  );
}
