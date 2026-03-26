"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ScratchReveal } from "@/animations/ScratchReveal";
import { TearReveal } from "@/animations/TearReveal";
import { FlipReveal } from "@/animations/FlipReveal";
import { InstantReveal } from "@/animations/InstantReveal";
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";
import type { TouchFrame } from "@/hooks/useDrawInputSync";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveSpectatorRoomProps {
  campaignId: string;
  campaignTitle: string;
  currentDrawer?: {
    playerId: string;
    nickname: string;
    /** "TEAR" | "SCRATCH" | "FLIP" | "INSTANT" */
    animationMode: string;
    /** Current remote touch frame (null between touches). */
    currentFrame: TouchFrame | null;
  } | null;
  /** Your queue position (1-indexed). Undefined = not in queue. */
  queuePosition?: number;
  queueLength: number;
  viewerCount: number;
  recentWins: Array<{
    id?: string;
    nickname: string;
    grade: string;
    prizeName: string;
    timeAgo: string;
  }>;
  chatMessages: Array<{
    id?: string;
    nickname: string;
    message: string;
    isReaction: boolean;
    timestamp: string;
  }>;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["🎉", "😱", "👏", "🔥", "💪", "😂", "❤️", "🎊"];

const PLACEHOLDER_PRIZE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'%3E%3Crect width='300' height='420' fill='%234F46E5'/%3E%3Ctext x='150' y='220' text-anchor='middle' fill='white' font-size='80'%3E%3F%3C/text%3E%3C/svg%3E";

// ─────────────────────────────────────────────────────────────────────────────
// Grade helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeGradient(grade: string): string {
  if (grade.startsWith("A")) return "from-amber-400 to-yellow-300";
  if (grade.startsWith("B")) return "from-blue-500 to-blue-400";
  if (grade.startsWith("C")) return "from-emerald-500 to-emerald-400";
  if (grade.startsWith("D")) return "from-purple-500 to-purple-400";
  return "from-rose-500 to-pink-400";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#f59e0b";
  if (grade.startsWith("B")) return "#3b82f6";
  if (grade.startsWith("C")) return "#10b981";
  if (grade.startsWith("D")) return "#8b5cf6";
  return "#f43f5e";
}

function gradeEmoji(grade: string): string {
  if (grade.startsWith("A")) return "🥇";
  if (grade.startsWith("B")) return "🥈";
  if (grade.startsWith("C")) return "🥉";
  if (grade === "最後賞" || grade === "LAST賞") return "🏆";
  return "🎖️";
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation stage — renders the REAL animation component driven by remote touch
// ─────────────────────────────────────────────────────────────────────────────

interface AnimationStageProps {
  animationMode: string;
  currentFrame: TouchFrame | null;
  onRevealed: () => void;
}

function AnimationStage({ animationMode, currentFrame, onRevealed }: AnimationStageProps) {
  // Key rotates on each new draw session so the component fully unmounts/remounts.
  // This is handled by the parent passing a sessionKey prop — see LiveDrawStage.

  switch (animationMode) {
    case "SCRATCH":
      return (
        <ScratchReveal
          prizePhotoUrl={PLACEHOLDER_PRIZE_URL}
          remoteTouchInput={currentFrame}
          isSpectatorMode={true}
          onRevealed={onRevealed}
        />
      );

    case "TEAR":
      return (
        <TearReveal
          prizePhotoUrl={PLACEHOLDER_PRIZE_URL}
          onRevealed={onRevealed}
        />
      );

    case "FLIP":
      return (
        <FlipReveal
          prizePhotoUrl={PLACEHOLDER_PRIZE_URL}
          prizeGrade="?"
          prizeName="等待揭曉"
          onRevealed={onRevealed}
        />
      );

    case "INSTANT":
    default:
      return (
        <InstantReveal
          prizePhotoUrl={PLACEHOLDER_PRIZE_URL}
          prizeGrade="?"
          prizeName="等待揭曉"
          onRevealed={onRevealed}
        />
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DrawerAnimationSlot — keyed by playerId so state fully resets between draws
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerAnimationSlotProps {
  drawer: NonNullable<LiveSpectatorRoomProps["currentDrawer"]>;
}

function DrawerAnimationSlot({ drawer }: DrawerAnimationSlotProps) {
  const [revealed, setRevealed] = useState(false);
  const currentFrame = drawer.currentFrame;
  const isFingerDown = currentFrame?.isDown === true;

  return (
    <>
      {/* Rounded stage frame */}
      <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-indigo-500/30 bg-gray-900 aspect-[4/3] flex items-center justify-center relative">
        {!revealed ? (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="relative"
              style={{
                width: "min(280px, 80%)",
                height: "min(400px, 85%)",
              }}
            >
              <AnimationStage
                animationMode={drawer.animationMode}
                currentFrame={currentFrame ?? null}
                onRevealed={() => setRevealed(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
            <span className="text-6xl">🎊</span>
            <span className="text-white font-black text-xl">已揭曉！</span>
          </div>
        )}

        {/* Remote finger position indicator */}
        {isFingerDown && currentFrame && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20"
            style={{
              left: `${currentFrame.x * 100}%`,
              top: `${currentFrame.y * 100}%`,
            }}
          >
            <div className="absolute w-8 h-8 rounded-full bg-white/20 animate-ping -translate-x-1/2 -translate-y-1/2" />
            <div className="w-5 h-5 rounded-full bg-white/60 border-2 border-white/90 shadow-lg -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live draw stage — the main video-feed-style animation area
// ─────────────────────────────────────────────────────────────────────────────

interface LiveDrawStageProps {
  currentDrawer: LiveSpectatorRoomProps["currentDrawer"];
  campaignTitle: string;
  viewerCount: number;
  onSendReaction: (emoji: string) => void;
}

function LiveDrawStage({
  currentDrawer,
  campaignTitle,
  viewerCount,
  onSendReaction,
}: LiveDrawStageProps) {
  const { currentEmoji, pushReaction } = useReactionQueue();

  const handleReaction = (emoji: string) => {
    pushReaction(emoji);
    onSendReaction(emoji);
  };

  const isFingerDown = currentDrawer?.currentFrame?.isDown === true;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar — LIVE badge + campaign title + viewer count */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {campaignTitle}
        </span>
        <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto shrink-0 flex items-center gap-1">
          <span>👀</span>
          <span>{viewerCount.toLocaleString()}</span>
        </span>
      </div>

      {/* Drawer name */}
      {currentDrawer ? (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
            {currentDrawer.nickname}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            正在{currentDrawer.animationMode === "SCRATCH" ? "刮刮樂" :
                  currentDrawer.animationMode === "TEAR" ? "撕籤" :
                  currentDrawer.animationMode === "FLIP" ? "翻牌" : "抽獎"}中
          </span>
          {isFingerDown && (
            <span className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">
              😬
            </span>
          )}
        </div>
      ) : (
        <div className="mb-3 text-sm text-gray-400 dark:text-gray-500">
          等待下一位玩家...
        </div>
      )}

      {/* Main animation container */}
      <div className="relative">
        {currentDrawer ? (
          /* Key on playerId: fully remounts DrawerAnimationSlot between draws,
             resetting revealed state and the animation component's canvas. */
          <DrawerAnimationSlot
            key={currentDrawer.playerId}
            drawer={currentDrawer}
          />
        ) : (
        /* Empty waiting state */
        <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-indigo-500/30 bg-gray-900 aspect-[4/3] flex items-center justify-center">
          <div className="text-center text-gray-600 select-none">
            <div className="text-7xl mb-4 opacity-60">🎰</div>
            <div className="text-base font-semibold text-gray-500">等待中...</div>
            <div className="text-xs text-gray-600 mt-1">下一位玩家即將開始</div>
          </div>
        </div>
        )}

        {/* Floating reactions overlay — outside DrawerAnimationSlot so it persists */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
          <ReactionOverlay emoji={currentEmoji} />
        </div>
      </div>

      {/* Reaction bar */}
      <div className="flex items-center gap-1.5 mt-4 justify-center flex-wrap">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-xl transition-all duration-150 hover:scale-110 active:scale-95 shadow-sm"
            aria-label={`送出 ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent wins live feed
// ─────────────────────────────────────────────────────────────────────────────

function RecentWinsFeed({
  wins,
}: {
  wins: LiveSpectatorRoomProps["recentWins"];
}) {
  return (
    <div className="space-y-0 overflow-y-auto max-h-[260px]">
      {wins.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          尚無中獎紀錄
        </p>
      )}
      {wins.map((win, i) => (
        <div
          key={win.id ?? `${win.nickname}-${i}`}
          className="flex items-center gap-2 py-2 px-3 rounded-lg"
          style={{
            animation: i === 0 ? "slideDown 0.3s ease-out" : undefined,
          }}
        >
          <div className="relative shrink-0">
            <span
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradeGradient(win.grade)} flex items-center justify-center text-white text-xs font-black shadow-sm`}
            >
              {win.grade.charAt(0)}
            </span>
            {i === 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                {gradeEmoji(win.grade)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm text-gray-800 dark:text-gray-100">
              {win.nickname}
            </span>
            <span className="text-xs text-gray-500 ml-1">抽到</span>
            <span
              className="font-bold text-sm ml-1"
              style={{ color: gradeColor(win.grade) }}
            >
              {win.grade}
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {win.timeAgo}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue panel
// ─────────────────────────────────────────────────────────────────────────────

function QueuePanel({
  queuePosition,
  queueLength,
  onJoinQueue,
  onLeaveQueue,
}: Pick<LiveSpectatorRoomProps, "queuePosition" | "queueLength" | "onJoinQueue" | "onLeaveQueue">) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
        <span>🎫</span> 排隊狀態
      </h3>

      {queuePosition !== undefined && queuePosition > 0 ? (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 mb-3 border border-indigo-100 dark:border-indigo-800/30">
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">
            #{queuePosition}
          </div>
          <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">你的位置</div>
          <button
            onClick={onLeaveQueue}
            className="mt-2.5 text-xs text-rose-500 hover:text-rose-600 hover:underline transition-colors"
          >
            離開排隊
          </button>
        </div>
      ) : (
        <button
          onClick={onJoinQueue}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm transition-colors mb-3 shadow-sm"
        >
          加入排隊
        </button>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">
        排隊人數：<span className="font-semibold text-gray-700 dark:text-gray-200">{queueLength}</span> 人
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat panel — instant message display, aggressive auto-scroll
// ─────────────────────────────────────────────────────────────────────────────

interface ChatPanelInlineProps {
  chatMessages: LiveSpectatorRoomProps["chatMessages"];
  onSendMessage: (msg: string) => void;
  asDrawer?: boolean;
  onClose?: () => void;
}

function ChatPanelInline({
  chatMessages,
  onSendMessage,
  asDrawer = false,
  onClose,
}: ChatPanelInlineProps) {
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Aggressive auto-scroll: always snap to bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    // Snap immediately — no smooth scroll delay
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  // Track scroll position to detect manual scroll-up
  const handleScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleSend = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    onSendMessage(text);
    setChatInput("");
  }, [chatInput, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const panelClass = asDrawer
    ? "flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl border-t border-gray-200 dark:border-gray-700 shadow-2xl h-full"
    : "lg:w-[280px] flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm";

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
          <span>💬</span>
          <span>聊天室</span>
        </div>
        {asDrawer && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none transition-colors"
            aria-label="關閉聊天"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages — no fade-in delay, instant render */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0"
        style={{ scrollBehavior: "auto" }}
      >
        {chatMessages.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            搶先發言吧！
          </p>
        )}
        {chatMessages.map((msg, i) => {
          const key = msg.id ?? `${msg.timestamp}-${i}`;
          if (msg.isReaction) {
            return (
              <div key={key} className="text-center py-0.5">
                <span className="text-2xl">{msg.message}</span>
              </div>
            );
          }
          return (
            <div key={key} className="text-sm leading-snug">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {msg.nickname}
              </span>
              <span className="text-gray-600 dark:text-gray-300 ml-1.5 break-words">
                {msg.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 shrink-0">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
          onKeyDown={handleKeyDown}
          placeholder="輸入訊息..."
          maxLength={100}
          className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          onClick={handleSend}
          disabled={!chatInput.trim()}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          送出
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile chat toggle
// ─────────────────────────────────────────────────────────────────────────────

function MobileChatToggle({
  unread,
  onClick,
}: {
  unread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg transition-all active:scale-95"
      aria-label="開啟聊天"
    >
      <span>💬</span>
      <span>聊天</span>
      {unread && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-page Live Spectator Room using touch-coordinate sync.
 *
 * Instead of a progress bar, spectators see the EXACT SAME animation component
 * as the drawer, driven by the drawer's synced touch coordinates at up to 60fps.
 *
 * Layout:
 *   Desktop (lg+) — 3 columns: Queue/Wins (240px) | Stage (flex-1) | Chat (280px)
 *   Tablet (md)   — 2 columns: Stage | Chat, Queue/Wins below
 *   Mobile        — single column; chat as bottom drawer
 */
export function LiveSpectatorRoom({
  campaignId: _campaignId,
  campaignTitle,
  currentDrawer,
  queuePosition,
  queueLength,
  viewerCount,
  recentWins,
  chatMessages,
  onSendMessage,
  onSendReaction,
  onJoinQueue,
  onLeaveQueue,
}: LiveSpectatorRoomProps) {
  const [mobileChat, setMobileChat] = useState(false);
  // Track unread messages: bump when drawer opens to clear the dot.
  // Stored as a plain number in a ref to avoid setState-in-effect.
  const lastSeenRef = useRef(0);
  const [unread, setUnread] = useState(false);

  // New messages while chat is closed → show unread dot.
  // We derive this in a separate effect to keep it readable.
  useEffect(() => {
    if (!mobileChat && chatMessages.length > lastSeenRef.current) {
      setUnread(true);
    }
    if (mobileChat) {
      lastSeenRef.current = chatMessages.length;
      setUnread(false);
    }
  }, [mobileChat, chatMessages.length]);

  return (
    <div className="relative flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Keyframe animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Desktop / Tablet layout */}
      <div className="flex flex-1 gap-4 p-4 max-w-[1600px] mx-auto w-full">

        {/* Left sidebar — Queue + Wins (lg+) */}
        <aside className="hidden lg:flex flex-col gap-4 w-[240px] shrink-0">
          <QueuePanel
            queuePosition={queuePosition}
            queueLength={queueLength}
            onJoinQueue={onJoinQueue}
            onLeaveQueue={onLeaveQueue}
          />

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex-1">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <span>🏆</span> 最近中獎
            </h3>
            <RecentWinsFeed wins={recentWins} />
          </div>
        </aside>

        {/* Center — Main Stage */}
        <main className="flex-1 min-w-0">
          <LiveDrawStage
            campaignTitle={campaignTitle}
            viewerCount={viewerCount}
            currentDrawer={currentDrawer}
            onSendReaction={onSendReaction}
          />

          {/* Tablet: Queue & Wins below stage */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid lg:hidden">
            <QueuePanel
              queuePosition={queuePosition}
              queueLength={queueLength}
              onJoinQueue={onJoinQueue}
              onLeaveQueue={onLeaveQueue}
            />
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <span>🏆</span> 最近中獎
              </h3>
              <RecentWinsFeed wins={recentWins} />
            </div>
          </div>
        </main>

        {/* Right sidebar — Chat (md+) */}
        <aside className="hidden md:flex">
          <ChatPanelInline
            chatMessages={chatMessages}
            onSendMessage={onSendMessage}
          />
        </aside>
      </div>

      {/* Mobile chat toggle */}
      <MobileChatToggle unread={unread} onClick={() => setMobileChat(true)} />

      {/* Mobile chat bottom drawer */}
      {mobileChat && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="聊天室"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileChat(false)}
          />
          <div className="relative z-10 h-[60vh]">
            <ChatPanelInline
              chatMessages={chatMessages}
              onSendMessage={onSendMessage}
              asDrawer
              onClose={() => setMobileChat(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
