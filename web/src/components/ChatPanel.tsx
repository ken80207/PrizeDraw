"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("chat");
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
      setSendError(err instanceof Error ? err.message : t("sendFailed"));
    }
  };

  const handleReaction = async (emoji: string) => {
    if (isCoolingDown) return;
    setSendError(null);
    try {
      await sendReaction(emoji);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("sendFailed"));
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
        data-testid="chat-toggle"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105"
        aria-label={isOpen ? t("closeChat") : t("openChat")}
      >
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
        <span className="hidden sm:inline font-headline text-xs uppercase tracking-wider">{t("toggle")}</span>
        {/* Unread indicator dot — shown when panel is closed and messages exist */}
        {!isOpen && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full border-2 border-surface-dim" />
        )}
        {/* Connection indicator */}
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-outline"}`}
          title={isConnected ? t("connected") : t("connecting")}
        />
      </button>

      {/* ── Slide-in panel ───────────────────────────────────────────────────── */}
      <div
        data-testid="chat-panel"
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
          background: "rgba(26, 26, 46, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
            <span className="text-on-surface font-bold text-sm font-headline">{t("title")}</span>
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-outline"}`}
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label={t("closeChat")}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 hide-scrollbar">
          {messages.length === 0 && (
            <p className="text-center text-on-surface-variant/50 text-xs mt-8">
              {t("noMessages")}
            </p>
          )}

          {messages.map((msg) => {
            const isSelf = msg.playerId === currentPlayerId;

            if (msg.isReaction) {
              // Reactions are shown as a compact centered label
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-on-surface-variant/50 bg-white/5 rounded-full px-2 py-0.5">
                    {msg.nickname} {t("sentReaction")} {msg.message}
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
                  <span className="text-xs text-on-surface-variant/50 px-1">{msg.nickname}</span>
                )}
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-2xl text-sm break-words
                    ${isSelf
                      ? "bg-gradient-to-tr from-primary/30 to-primary-container/20 text-on-surface rounded-br-sm"
                      : "bg-surface-container-high text-on-surface rounded-bl-sm"
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
        <div className="px-3 py-2 flex gap-1.5 shrink-0 overflow-x-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              data-testid={`reaction-${emoji}`}
              onClick={() => void handleReaction(emoji)}
              disabled={isCoolingDown}
              className="text-xl p-1.5 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40 shrink-0"
              aria-label={t("sendReaction", { emoji })}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="px-3 pb-4 pt-2 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {sendError && (
            <p className="text-xs text-error mb-1.5">{sendError}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                data-testid="chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/30 text-sm rounded-xl px-3 py-2 pr-10 outline-none border-none focus:ring-1 focus:ring-primary transition-all"
              />
              {/* Character counter */}
              <span
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                  remaining < 20 ? "text-error" : "text-on-surface-variant/40"
                }`}
              >
                {remaining}
              </span>
            </div>
            <button
              data-testid="chat-send"
              onClick={() => void handleSend()}
              disabled={!inputText.trim() || isCoolingDown}
              className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-tr from-primary to-primary-container text-on-primary text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isCoolingDown ? (
                <span className="material-symbols-outlined text-sm">timer</span>
              ) : t("send")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
