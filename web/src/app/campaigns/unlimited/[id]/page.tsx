"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import Link from "next/link";
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
// Mock data generators
// ─────────────────────────────────────────────────────────────────────────────

function generateMockActiveDrawers(): ActiveDrawer[] {
  return [
    { playerId: "p1", nickname: "星空玩家", startedAt: new Date().toISOString() },
    { playerId: "p2", nickname: "Lucky777", startedAt: new Date().toISOString() },
    { playerId: "p3", nickname: "抽獎達人", startedAt: new Date().toISOString() },
    { playerId: "p4", nickname: "CoolCat99", startedAt: new Date().toISOString() },
  ];
}

function generateMockRecentWins(): RecentWin[] {
  return [
    { id: "w1", nickname: "小明", grade: "A賞", prizeName: "限定公仔", timestamp: "14:45", isNew: true },
    { id: "w2", nickname: "小花", grade: "B賞", prizeName: "精品模型", timestamp: "14:43" },
    { id: "w3", nickname: "阿陳", grade: "D賞", prizeName: "隨機貼紙", timestamp: "14:41" },
    { id: "w4", nickname: "Lucky", grade: "C賞", prizeName: "造型吊飾", timestamp: "14:39" },
    { id: "w5", nickname: "玩家168", grade: "D賞", prizeName: "隨機貼紙", timestamp: "14:37" },
    { id: "w6", nickname: "星空", grade: "A賞", prizeName: "限定公仔", timestamp: "14:35" },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MULTI_DRAW_OPTIONS = [
  { label: "×3", qty: 3 },
  { label: "×5", qty: 5 },
  { label: "×10", qty: 10 },
];

const MOCK_COUPONS = [
  { id: "c1", label: "新人優惠券 -10%", discount: 0.9 },
  { id: "c2", label: "連抽特典 -20%", discount: 0.8 },
];

const MOCK_SPECTATOR_COUNT = 45;

const REACTION_EMOJIS = ["🎉", "😱", "👏", "🔥", "💪", "😂", "❤️", "🎊"];

// ─────────────────────────────────────────────────────────────────────────────
// Inline ChatPanel for sidebar — a compact variant of the global ChatPanel
// ─────────────────────────────────────────────────────────────────────────────

interface InlineChatPanelProps {
  roomId: string;
}

function InlineChatPanel({ roomId }: InlineChatPanelProps) {
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
      setSendError(err instanceof Error ? err.message : "傳送失敗");
    }
  };

  const handleReaction = async (emoji: string) => {
    if (isCoolingDown) return;
    setSendError(null);
    try {
      await sendReaction(emoji);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "傳送失敗");
    }
  };

  const MAX_LEN = 100;
  const remaining = MAX_LEN - inputText.length;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Floating reactions */}
      <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
        <ReactionOverlay emoji={currentEmoji} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">💬 聊天</span>
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-gray-400"}`}
          title={isConnected ? "已連線" : "連線中..."}
        />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 text-xs mt-4">
            目前沒有訊息，搶先發言！
          </p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.playerId === currentPlayerId;
          if (msg.isReaction) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 rounded-full px-2 py-0.5">
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
                <span className="text-xs text-gray-400 dark:text-gray-500 px-1">{msg.nickname}</span>
              )}
              <div
                className={`max-w-[90%] px-2.5 py-1.5 rounded-xl text-xs break-words ${
                  isSelf
                    ? "bg-indigo-500 text-white rounded-br-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm"
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
      <div className="px-2 py-1.5 flex gap-1 border-t border-gray-200 dark:border-gray-700 shrink-0 overflow-x-auto">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => void handleReaction(emoji)}
            disabled={isCoolingDown}
            className="text-base p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 shrink-0"
            aria-label={`傳送 ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0 border-t border-gray-200 dark:border-gray-700">
        {sendError && <p className="text-xs text-red-400 mb-1">{sendError}</p>}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 relative">
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
              placeholder="說點什麼..."
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs rounded-lg px-3 py-2 pr-8 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                remaining < 20 ? "text-red-400" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {remaining}
            </span>
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || isCoolingDown}
            className="shrink-0 px-2.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isCoolingDown ? "⏱" : "送出"}
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

  // ── UI state ─────────────────────────────────────────────────────────────
  const [couponOpen, setCouponOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [pointBalance, setPointBalance] = useState(1250);
  const [rateLimited, setRateLimited] = useState(false);
  // watchingPlayerId drives "SPECTATING" — no separate pageState enum needed
  const [watchingPlayerId, setWatchingPlayerId] = useState<string | null>(null);
  const [activeDrawers, setActiveDrawers] = useState<ActiveDrawer[]>(() =>
    generateMockActiveDrawers(),
  );
  const [recentWins, setRecentWins] = useState<RecentWin[]>(() => generateMockRecentWins());
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("drawers");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Rate-limit cooldown timer
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived page state — computed from hook state, no sync effects needed ─
  const pageState: PageState = isDrawing
    ? "DRAWING"
    : lastResult
      ? "RESULT"
      : watchingPlayerId
        ? "SPECTATING"
        : "BROWSING";

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedCouponData = MOCK_COUPONS.find((c) => c.id === selectedCoupon) ?? null;
  const effectivePrice = campaign
    ? Math.round(campaign.pricePerDraw * (selectedCouponData?.discount ?? 1))
    : 0;
  const canAfford = pointBalance >= effectivePrice;
  const watchingDrawer = activeDrawers.find((d) => d.playerId === watchingPlayerId) ?? null;
  const isSpectating = pageState === "SPECTATING" && watchingDrawer !== null;

  // ── Rate-limit detection — uses startTransition to avoid cascading renders ─
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

  // ── Multi-draw orchestration ──────────────────────────────────────────────
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

  // ── Single draw ───────────────────────────────────────────────────────────
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

  // ── Close result & return to browsing ─────────────────────────────────────
  const handleAcknowledge = useCallback(() => {
    acknowledgeResult();
  }, [acknowledgeResult]);

  // ── Spectator mode ────────────────────────────────────────────────────────
  const handleWatchPlayer = useCallback((playerId: string) => {
    setWatchingPlayerId(playerId);
  }, []);

  const handleStopWatching = useCallback(() => {
    setWatchingPlayerId(null);
  }, []);

  // ── Simulate live data updates ────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly add a new recent win
      const grades = ["A賞", "B賞", "C賞", "D賞"];
      const names = ["限定公仔", "精品模型", "造型吊飾", "隨機貼紙"];
      const nicknames = ["小新", "玩家456", "阿豪", "CoolKid", "NightOwl"];
      const gradeIndex = Math.floor(Math.random() * grades.length);
      const newWin: RecentWin = {
        id: `w_${Date.now()}`,
        nickname: nicknames[Math.floor(Math.random() * nicknames.length)],
        grade: grades[gradeIndex],
        prizeName: names[gradeIndex],
        timestamp: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
        isNew: true,
      };
      setRecentWins((prev) => {
        const updated = [newWin, ...prev.slice(0, 9)];
        // Clear isNew after 3s
        setTimeout(() => {
          setRecentWins((w) => w.map((x) => (x.id === newWin.id ? { ...x, isNew: false } : x)));
        }, 3000);
        return updated;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Simulate active drawers refreshing ───────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDrawers((prev) => {
        // Randomly remove one and possibly add one
        if (prev.length > 1 && Math.random() > 0.5) {
          return prev.filter((_, i) => i !== 0);
        }
        const newDrawer: ActiveDrawer = {
          playerId: `p_${Date.now()}`,
          nickname: `玩家${Math.floor(Math.random() * 9000) + 1000}`,
          startedAt: new Date().toISOString(),
        };
        return [...prev.slice(-5), newDrawer];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) return <UnlimitedPageSkeleton />;

  if (!campaign && !isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{error ?? "找不到此活動"}</p>
        <Link
          href="/campaigns?type=unlimited"
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          返回活動列表
        </Link>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Top navbar strip ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          {/* Back */}
          <Link
            href="/campaigns?type=unlimited"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="hidden sm:inline">返回</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            <StatusBadge status="無限賞" />
            <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              {campaign?.title ?? "活動"}
            </h1>
          </div>

          {/* Right — viewer count + LIVE */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>👀</span>
              <span className="font-medium">{MOCK_SPECTATOR_COUNT}</span>
              <span className="hidden sm:inline">人</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              LIVE
            </span>
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="lg:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="開啟側欄"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              側欄
            </button>
          </div>
        </div>
      </div>

      {/* ── Rate limit banner ─────────────────────────────────────────────── */}
      {rateLimited && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
            <span>⚠️</span>
            <span>抽太快了！稍後再試（3 秒冷卻）</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        </div>
      )}

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && !rateLimited && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={dismissError}
            className="text-red-400 hover:text-red-600 text-lg leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Main two-column layout ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">

          {/* ── Left / Main content ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Spectating banner */}
            {isSpectating && (
              <SpectatingBanner drawer={watchingDrawer!} onStop={handleStopWatching} />
            )}

            {/* Probability table */}
            {prizes.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">賞品與機率</h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">每次獨立計算</span>
                </div>
                <div className="overflow-x-auto">
                  <ProbabilityTable prizes={prizes} />
                </div>
              </section>
            )}

            {/* Draw area */}
            {campaign && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">抽獎區</h2>
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
                    onToggleCoupon={() => setCouponOpen((v) => !v)}
                    onSelectCoupon={(id) => { setSelectedCoupon(id); setCouponOpen(false); }}
                    onClearCoupon={() => { setSelectedCoupon(null); setCouponOpen(false); }}
                    onDraw={handleDraw}
                    onMultiDraw={handleMultiDraw}
                  />
                </div>
              </section>
            )}

            {/* Session draw history */}
            {drawHistory.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">本次抽獎紀錄</h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{drawHistory.length} 次</span>
                </div>
                <SessionHistory history={drawHistory} />
              </section>
            )}
          </div>

          {/* ── Right sidebar — desktop only ─────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 gap-4">
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

      {/* ── Mobile bottom sheet sidebar ──────────────────────────────────── */}
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

      {/* ── Result reveal modal ───────────────────────────────────────────── */}
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
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-700/50">
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            等級
          </th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            賞品
          </th>
          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            機率
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
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
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
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
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm shrink-0">
              🏆
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{prize.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
          {probabilityText}
        </span>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw area
// ─────────────────────────────────────────────────────────────────────────────

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
  selectedCouponData: { id: string; label: string; discount: number } | null;
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
  onToggleCoupon,
  onSelectCoupon,
  onClearCoupon,
  onDraw,
  onMultiDraw,
}: DrawAreaProps) {
  const isDisabled = isDrawing || pageState === "DRAWING" || rateLimited || !canAfford;

  return (
    <div className="space-y-4">
      {/* Balance + coupon row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">你的點數</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            💰 {pointBalance.toLocaleString()} 點
          </p>
          {!canAfford && (
            <p className="text-xs text-red-500 mt-0.5">點數不足，無法抽獎</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">每抽費用</p>
          <div className="flex items-center gap-1.5">
            {selectedCouponData && (
              <span className="text-sm text-gray-400 line-through tabular-nums">
                {pricePerDraw.toLocaleString()}
              </span>
            )}
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {effectivePrice.toLocaleString()} 點
            </span>
          </div>
        </div>
      </div>

      {/* Coupon selector */}
      <div className="relative">
        <button
          onClick={onToggleCoupon}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed text-sm transition-colors ${
            selectedCoupon
              ? "border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
              : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400"
          }`}
        >
          <span>
            {selectedCouponData ? (
              <>
                <span className="mr-1">🎫</span>
                {selectedCouponData.label}
              </>
            ) : (
              "使用優惠券"
            )}
          </span>
          <span className="text-gray-400">{couponOpen ? "▲" : "▼"}</span>
        </button>

        {couponOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            {selectedCoupon && (
              <button
                onClick={onClearCoupon}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
              >
                不使用優惠券
              </button>
            )}
            {MOCK_COUPONS.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCoupon(c.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20 ${
                  selectedCoupon === c.id
                    ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10"
                    : "text-gray-700 dark:text-gray-300"
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
        className={`w-full py-5 rounded-2xl font-extrabold text-xl transition-all shadow-lg ${
          isDisabled
            ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
            : rateLimited
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-400 cursor-not-allowed"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
        }`}
      >
        {rateLimited
          ? "⏳ 稍後再試..."
          : isDrawing
            ? "⏳ 抽獎中..."
            : !canAfford
              ? "💸 點數不足"
              : "🎲 立即抽獎"}
      </button>

      {/* Multi-draw buttons */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">連抽</p>
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
                className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-colors flex flex-col items-center gap-0.5 ${
                  isDisabled || !canAffordMulti
                    ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-transparent"
                    : "border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-xs font-normal opacity-70 tabular-nums">
                  {totalCost.toLocaleString()} 點
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          連抽每次獨立計算機率，無保底
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
    <div data-testid="draw-history" className="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-64 overflow-y-auto">
      {history.map((result, i) => (
        <SessionHistoryRow key={`${result.prizeInstanceId}-${i}`} result={result} />
      ))}
    </div>
  );
}

function SessionHistoryRow({ result }: { result: UnlimitedDrawResultDto }) {
  const time = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      data-testid="draw-history-item"
      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
    >
      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 shrink-0">
        {time}
      </span>
      {result.prizePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.prizePhotoUrl}
          alt={result.prizeName}
          className="w-8 h-8 rounded-md object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0">
          🏆
        </div>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GradeBadge grade={result.grade} />
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{result.prizeName}</span>
      </div>
      <span className="text-sm font-medium text-red-500 dark:text-red-400 shrink-0 tabular-nums">
        -{result.pointsCharged.toLocaleString()} 點
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
  return (
    <>
      {/* Active drawers */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">目前在抽</h3>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
            {activeDrawers.length}
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-52 overflow-y-auto">
          {activeDrawers.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">目前沒有人在抽</p>
          )}
          {activeDrawers.map((drawer) => (
            <div
              key={drawer.playerId}
              className={`flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                watchingPlayerId === drawer.playerId ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 min-w-0 truncate">
                {drawer.nickname}
              </span>
              <button
                onClick={() => onWatchPlayer(drawer.playerId)}
                className={`text-xs shrink-0 transition-colors ${
                  watchingPlayerId === drawer.playerId
                    ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
                }`}
              >
                {watchingPlayerId === drawer.playerId ? "觀看中" : "觀看"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent wins */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">最近中獎</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-52 overflow-y-auto">
          {recentWins.map((win) => (
            <div
              key={win.id}
              className={`flex items-center gap-2 px-4 py-2 transition-all ${
                win.isNew ? "bg-amber-50 dark:bg-amber-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
              }`}
            >
              {win.isNew && (
                <span className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5">
                  NEW
                </span>
              )}
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">
                {win.nickname}
              </span>
              <GradeBadge grade={win.grade} />
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ minHeight: "280px", maxHeight: "400px" }}>
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

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: "drawers", label: "目前在抽" },
  { id: "wins", label: "最近中獎" },
  { id: "chat", label: "聊天" },
];

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
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-label="關閉側欄"
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Handle + close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <div />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3 shrink-0">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
          {activeTab === "drawers" && (
            <div className="space-y-2">
              {activeDrawers.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  目前沒有人在抽
                </p>
              )}
              {activeDrawers.map((drawer) => (
                <div
                  key={drawer.playerId}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    watchingPlayerId === drawer.playerId
                      ? "bg-indigo-50 dark:bg-indigo-900/20"
                      : "bg-gray-50 dark:bg-gray-800/50"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">
                    {drawer.nickname}
                  </span>
                  <button
                    onClick={() => onWatchPlayer(drawer.playerId)}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline shrink-0 font-medium"
                  >
                    {watchingPlayerId === drawer.playerId ? "觀看中" : "[觀看他的抽獎]"}
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
                  className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                    win.isNew
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : "bg-gray-50 dark:bg-gray-800/50"
                  }`}
                >
                  {win.isNew && (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1 py-0.5 shrink-0">
                      NEW
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {win.nickname}
                  </span>
                  <GradeBadge grade={win.grade} />
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{win.timestamp}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="h-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
        <div>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
            正在觀看 {drawer.nickname} 的抽獎
          </p>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
            觀戰模式 · 不消耗點數
          </p>
        </div>
      </div>
      <button
        onClick={onStop}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
      >
        停止觀看
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
              <p className="text-2xl mb-1">🎉</p>
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

              <GradeBadge
                grade={result.grade}
                className="mb-3"
                data-testid="prize-grade"
              />
              <h3
                data-testid="prize-name"
                className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1"
              >
                {result.prizeName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                已存入賞品庫 · 消費{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                  {result.pointsCharged.toLocaleString()}
                </span>{" "}
                點
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors"
                >
                  繼續抽獎
                </button>
                <Link
                  href="/prizes"
                  className="px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={onClose}
                >
                  我的賞品
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sticky nav skeleton */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-6 gap-4">
        <Skeleton className="w-16 h-5" />
        <Skeleton className="flex-1 h-5 max-w-xs mx-auto" />
        <Skeleton className="w-24 h-5" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Probability table skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="w-12 h-6 rounded-full" />
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="flex-1 h-4" />
                    <Skeleton className="w-14 h-4" />
                  </div>
                ))}
              </div>
            </div>

            {/* Draw area skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="w-32 h-8" />
                  <Skeleton className="w-20 h-8" />
                </div>
                <Skeleton className="w-full h-12 rounded-xl" />
                <Skeleton className="w-full h-16 rounded-2xl" />
                <div className="flex gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="flex-1 h-12 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar skeleton — desktop only */}
          <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 gap-4">
            <Skeleton className="w-full rounded-2xl h-44" />
            <Skeleton className="w-full rounded-2xl h-52" />
            <Skeleton className="w-full rounded-2xl h-72" />
          </aside>
        </div>
      </div>
    </div>
  );
}
