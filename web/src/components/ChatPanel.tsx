"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { authStore } from "@/stores/authStore";
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 100;

const REACTION_EMOJIS = ["🎉", "😱", "👏", "🔥", "💪", "😂", "❤️", "🎊"];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  /**
   * The chat room identifier.
   * For kuji campaigns: `kuji:{campaignId}`
   * For unlimited draws: `unlimited:{campaignId}:{broadcasterId}`
   */
  roomId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slide-in chat panel rendered as a fixed right sidebar on desktop and a
 * bottom sheet on mobile.
 *
 * Features:
 * - Toggle button "💬 聊天" to show/hide the panel
 * - Message list with auto-scroll to bottom
 * - Message input (max 100 chars) with character counter
 * - Reaction bar: 🎉 😱 👏 🔥 💪 😂 ❤️ 🎊
 * - 500 ms send cooldown with visual feedback
 * - Messages styled as bubbles (self = indigo, others = gray)
 * - Floating emoji reactions via ReactionOverlay
 */
export function ChatPanel({ roomId }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const { messages, isConnected, sendMessage, sendReaction, isCoolingDown } =
    useChat(roomId);

  const { currentEmoji, pushReaction } = useReactionQueue();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPlayerId = authStore.player?.id ?? null;

  // ── Auto-scroll to bottom when new messages arrive ─────────────────────────

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Feed incoming reactions into the floating overlay
  useEffect(() => {
    const latest = messages.at(-1);
    if (latest?.isReaction) {
      pushReaction(latest.message);
    }
    // We only want to trigger on new messages, not on `pushReaction` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Send handlers ──────────────────────────────────────────────────────────

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const remaining = MAX_MESSAGE_LENGTH - inputText.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating reaction overlay (portal-like, covers viewport) ─────────── */}
      {isOpen && (
        <div className="fixed inset-0 pointer-events-none z-30" aria-hidden="true">
          <ReactionOverlay emoji={currentEmoji} />
        </div>
      )}

      {/* ── Toggle button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-lg transition-all"
        aria-label={isOpen ? "關閉聊天" : "開啟聊天"}
      >
        <span>💬</span>
        <span className="hidden sm:inline">聊天</span>
        {/* Unread indicator dot — shown when panel is closed and messages exist */}
        {!isOpen && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
        )}
        {/* Connection indicator */}
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-gray-400"}`}
          title={isConnected ? "已連線" : "連線中..."}
        />
      </button>

      {/* ── Slide-in panel ───────────────────────────────────────────────────── */}
      <div
        className={`
          fixed z-40 flex flex-col
          transition-transform duration-300 ease-in-out
          /* Desktop: right sidebar */
          sm:top-0 sm:right-0 sm:h-full sm:w-80
          sm:translate-x-0
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0
          sm:bottom-auto sm:left-auto
          h-[60vh] sm:h-full
          ${isOpen ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}
        `}
        style={{
          background: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">聊天室</span>
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-gray-500"}`}
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="關閉聊天"
          >
            ×
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-xs mt-8">
              目前沒有訊息，搶先發言吧！
            </p>
          )}

          {messages.map((msg) => {
            const isSelf = msg.playerId === currentPlayerId;

            if (msg.isReaction) {
              // Reactions are shown as a compact centered label
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-gray-400 bg-white/5 rounded-full px-2 py-0.5">
                    {msg.nickname} 送出 {msg.message}
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
                  <span className="text-xs text-gray-400 px-1">{msg.nickname}</span>
                )}
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-2xl text-sm break-words
                    ${isSelf
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white/10 text-gray-100 rounded-bl-sm"
                    }
                  `}
                >
                  {msg.message}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Reaction bar */}
        <div className="px-3 py-2 flex gap-1.5 border-t border-white/10 shrink-0 overflow-x-auto">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => void handleReaction(emoji)}
              disabled={isCoolingDown}
              className="text-xl p-1.5 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40 shrink-0"
              aria-label={`傳送 ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="px-3 pb-4 pt-2 shrink-0 border-t border-white/10">
          {sendError && (
            <p className="text-xs text-rose-400 mb-1.5">{sendError}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="說點什麼..."
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full bg-white/10 text-white placeholder-gray-500 text-sm rounded-xl px-3 py-2 pr-10 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {/* Character counter */}
              <span
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                  remaining < 20 ? "text-rose-400" : "text-gray-500"
                }`}
              >
                {remaining}
              </span>
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={!inputText.trim() || isCoolingDown}
              className="shrink-0 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isCoolingDown ? "⏱" : "送出"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
