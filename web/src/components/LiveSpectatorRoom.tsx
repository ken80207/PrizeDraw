"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SpectatorAnimation } from "@/components/SpectatorAnimation";
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";

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
    /** 0.0 – 1.0 */
    progress: number;
  } | null;
  /** Your queue position (1-indexed). Undefined = not in queue. */
  queuePosition?: number;
  queueLength: number;
  viewerCount: number;
  recentWins: Array<{
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

const MODE_LABELS: Record<string, string> = {
  TEAR: "撕籤",
  SCRATCH: "刮刮樂",
  FLIP: "翻牌",
  INSTANT: "快速抽",
};

function getModeName(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

// Grade badge colour helper
function gradeGradient(grade: string): string {
  if (grade.startsWith("A")) return "from-amber-400 to-yellow-300";
  if (grade.startsWith("B")) return "from-blue-500 to-blue-400";
  if (grade.startsWith("C")) return "from-emerald-500 to-emerald-400";
  if (grade.startsWith("D")) return "from-purple-500 to-purple-400";
  return "from-rose-500 to-pink-400";
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile chat drawer toggle button
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
// Left sidebar — Queue & Recent Wins
// ─────────────────────────────────────────────────────────────────────────────

function QueueAndWins({
  queuePosition,
  queueLength,
  recentWins,
  onJoinQueue,
  onLeaveQueue,
}: Pick<
  LiveSpectatorRoomProps,
  "queuePosition" | "queueLength" | "recentWins" | "onJoinQueue" | "onLeaveQueue"
>) {
  return (
    <div className="flex flex-col gap-4 lg:w-[250px] w-full">
      {/* Queue card */}
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

      {/* Recent wins feed */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex-1">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <span>🏆</span> 最近中獎
        </h3>

        {recentWins.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            尚無中獎紀錄
          </p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto max-h-[300px] lg:max-h-[360px]">
            {recentWins.map((win, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm animate-[fadeSlideIn_0.3s_ease-out]"
              >
                <span
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradeGradient(win.grade)} flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm`}
                >
                  {win.grade.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {win.nickname}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {win.grade} · {win.prizeName}
                  </div>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{win.timeAgo}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center — Main Stage
// ─────────────────────────────────────────────────────────────────────────────

function MainStage({
  campaignTitle,
  viewerCount,
  currentDrawer,
  onSendReaction,
}: Pick<
  LiveSpectatorRoomProps,
  "campaignTitle" | "viewerCount" | "currentDrawer" | "onSendReaction"
>) {
  const { currentEmoji, pushReaction } = useReactionQueue();

  const handleReaction = (emoji: string) => {
    pushReaction(emoji);
    onSendReaction(emoji);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* LIVE indicator strip */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-black text-rose-500 tracking-wide">LIVE</span>
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">
          {campaignTitle}
        </span>
        <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">
          👀 {viewerCount.toLocaleString()} 人觀看
        </span>
      </div>

      {/* Drawer info */}
      {currentDrawer ? (
        <div className="mb-3">
          <div className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
            <span>🎯</span>
            <span className="text-indigo-600 dark:text-indigo-400">{currentDrawer.nickname}</span>
            <span>正在抽獎中...</span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            抽獎方式：{getModeName(currentDrawer.animationMode)}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 dark:text-gray-500 py-4 text-sm font-medium">
          等待下一位玩家...
        </div>
      )}

      {/* Animation viewer stage */}
      <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-2xl border border-gray-800">
        {currentDrawer ? (
          <>
            {/* Spectator view — fills the stage, pointer-events disabled */}
            <div className="flex items-center justify-center w-full h-full scale-[1.6] sm:scale-[1.85] md:scale-[2.1]">
              <SpectatorAnimation
                animationMode={currentDrawer.animationMode}
                progress={currentDrawer.progress}
              />
            </div>

            {/* Bottom progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800/80">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(currentDrawer.progress * 100, 100)}%` }}
              />
            </div>

            {/* Progress text */}
            <div className="absolute top-3 right-3">
              <span className="text-[11px] font-bold text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                {Math.round(currentDrawer.progress * 100)}%
              </span>
            </div>

            {/* Floating reactions overlay */}
            <ReactionOverlay emoji={currentEmoji} />
          </>
        ) : (
          <div className="text-center text-gray-600 select-none">
            <div className="text-7xl mb-4 opacity-60">🎰</div>
            <div className="text-base font-semibold text-gray-500">等待中...</div>
            <div className="text-xs text-gray-600 mt-1">下一位玩家即將開始</div>
          </div>
        )}
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
// Right sidebar — Chat Panel
// ─────────────────────────────────────────────────────────────────────────────

interface ChatPanelInlineProps {
  chatMessages: LiveSpectatorRoomProps["chatMessages"];
  onSendMessage: (msg: string) => void;
  /** When true, renders as a bottom drawer overlay (mobile) */
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

  // Auto-scroll to bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

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
    : "lg:w-[300px] flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm";

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
        <div className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
          <span>💬</span> 聊天室
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

      {/* Messages */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
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
// Root component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-page Live Spectator Room.
 *
 * Layout:
 *   Desktop (lg+) — 3 columns: Queue/Wins (250px) | Stage (flex-1) | Chat (300px)
 *   Tablet (md)   — 2 columns: Stage | Chat, then Queue/Wins below
 *   Mobile        — single column; chat available as a bottom drawer
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

  // Count unread for mobile dot
  const lastSeenCountRef = useRef(0);
  const unread = chatMessages.length > lastSeenCountRef.current;
  useEffect(() => {
    if (mobileChat) lastSeenCountRef.current = chatMessages.length;
  }, [mobileChat, chatMessages.length]);

  return (
    <div className="relative flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Desktop / Tablet layout ─────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 p-4 max-w-[1600px] mx-auto w-full">

        {/* Left sidebar — visible on lg+ (and below stage on md) */}
        <aside className="hidden lg:flex flex-col">
          <QueueAndWins
            queuePosition={queuePosition}
            queueLength={queueLength}
            recentWins={recentWins}
            onJoinQueue={onJoinQueue}
            onLeaveQueue={onLeaveQueue}
          />
        </aside>

        {/* Center — Main Stage */}
        <main className="flex-1 min-w-0">
          <MainStage
            campaignTitle={campaignTitle}
            viewerCount={viewerCount}
            currentDrawer={currentDrawer}
            onSendReaction={onSendReaction}
          />

          {/* Tablet: Queue & Wins below stage */}
          <div className="mt-4 md:block lg:hidden">
            <QueueAndWins
              queuePosition={queuePosition}
              queueLength={queueLength}
              recentWins={recentWins}
              onJoinQueue={onJoinQueue}
              onLeaveQueue={onLeaveQueue}
            />
          </div>
        </main>

        {/* Right sidebar — visible on md+ */}
        <aside className="hidden md:flex">
          <ChatPanelInline
            chatMessages={chatMessages}
            onSendMessage={onSendMessage}
          />
        </aside>
      </div>

      {/* ── Mobile chat toggle button ──────────────────────────────────────── */}
      <MobileChatToggle unread={unread} onClick={() => setMobileChat(true)} />

      {/* ── Mobile chat bottom drawer ──────────────────────────────────────── */}
      {mobileChat && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="聊天室"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileChat(false)}
          />
          {/* Drawer panel */}
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
