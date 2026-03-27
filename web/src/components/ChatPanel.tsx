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

export function ChatPanel({ roomId }: ChatPanelProps) {
  const t = useTranslations("chat");
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { messages, isConnected, sendMessage, sendReaction, isCoolingDown } =
    useChat(roomId);

  const { currentEmoji, pushReaction } = useReactionQueue();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // ── Send handlers ──────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!inputText.trim() || isCoolingDown) return;
    const text = inputText.trim();
    setInputText("");
    setSendError(null);
    inputRef.current?.focus();
    sendMessage(text);
  };

  const handleReaction = (emoji: string) => {
    if (isCoolingDown) return;
    setSendError(null);
    setShowEmojiPicker(false);
    sendReaction(emoji);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
        className="fixed bottom-[4.5rem] right-4 z-30 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105"
        aria-label={isOpen ? t("closeChat") : t("openChat")}
      >
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
        <span className="hidden sm:inline font-headline text-xs uppercase tracking-wider">{t("toggle")}</span>
        {!isOpen && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full border-2 border-surface-dim" />
        )}
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-outline"}`}
          title={isConnected ? t("connected") : t("connecting")}
        />
      </button>

      {/* ── Slide-in panel ───────────────────────────────────────────────────── */}
      <div
        data-testid="chat-panel"
        className={`
          fixed z-30 flex flex-col
          transition-transform duration-300 ease-in-out
          right-0 bottom-14
          sm:top-0 sm:w-80
          left-0 sm:left-auto
          h-[55vh] sm:h-auto
          rounded-t-2xl sm:rounded-none
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
                <span className={`text-xs px-1 ${isSelf ? "text-primary/60" : "text-on-surface-variant/50"}`}>
                  {msg.nickname}
                </span>
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

        {/* Input area */}
        <div className="px-3 pb-4 pt-2 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {sendError && (
            <p className="text-xs text-error mb-1.5">{sendError}</p>
          )}
          <div className="flex items-center gap-2">
            {/* Emoji picker toggle */}
            <div className="relative" ref={emojiPickerRef}>
              <button
                data-testid="emoji-toggle"
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={isCoolingDown}
                className="shrink-0 p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-colors disabled:opacity-40"
                aria-label={t("emojiPicker")}
              >
                <span className="material-symbols-outlined text-lg">mood</span>
              </button>

              {/* Emoji popover */}
              {showEmojiPicker && (
                <div
                  className="absolute bottom-full left-0 mb-2 p-2 rounded-xl grid grid-cols-4 gap-1"
                  style={{
                    background: "rgba(30, 30, 55, 0.95)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      data-testid={`reaction-${emoji}`}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      disabled={isCoolingDown}
                      className="text-xl p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
                      aria-label={t("sendReaction", { emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
              onClick={handleSend}
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
