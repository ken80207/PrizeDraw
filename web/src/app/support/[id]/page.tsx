"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/components/Toast";

interface TicketMessageDto {
  id: string;
  senderType: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface SupportTicketDetailDto {
  id: string;
  ticketNumber?: number;
  category: string;
  subject: string;
  status: string;
  messages: TicketMessageDto[];
  satisfactionScore: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-[#8fd5ff]/10 text-[#8fd5ff]",
  IN_PROGRESS: "bg-[#ffc174]/10 text-[#ffc174]",
  RESOLVED: "bg-emerald-400/10 text-emerald-400",
  CLOSED: "bg-[#534434]/30 text-[#d8c3ad]/60",
};

export default function TicketDetailPage() {
  const t = useTranslations("support");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const CATEGORY_LABELS: Record<string, string> = {
    TRADE_DISPUTE: t("categoryTrade"),
    DRAW_ISSUE: t("categoryDraw"),
    ACCOUNT_ISSUE: t("categoryAccount"),
    SHIPPING_ISSUE: t("categoryShipping"),
    PAYMENT_ISSUE: t("categoryPayment"),
    OTHER: t("categoryOther"),
  };

  const STATUS_LABELS: Record<string, string> = {
    OPEN: t("open"),
    IN_PROGRESS: t("inProgress"),
    RESOLVED: t("resolved"),
    CLOSED: t("closed"),
  };

  const [ticket, setTicket] = useState<SupportTicketDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<SupportTicketDetailDto>(`/api/v1/support/tickets/${id}`)
      .then((data) => {
        setTicket(data);
        setRatingScore(data.satisfactionScore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("loadError")))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || sending) return;
    setSending(true);
    try {
      const updated = await apiClient.post<SupportTicketDetailDto>(
        `/api/v1/support/tickets/${id}/reply`,
        { ticketId: id, body: replyBody.trim() },
      );
      setTicket(updated);
      setReplyBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("replyError"));
    } finally {
      setSending(false);
    }
  }

  function handleRating(score: number) {
    // Satisfaction score is submitted with CloseTicketRequest when closing the ticket.
    // Display only — update local state so the UI reflects the pending selection.
    if (ratingScore !== null) return;
    setRatingScore(score);
  }

  const isClosed = ticket?.status === "CLOSED" || ticket?.status === "RESOLVED";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111125] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ffc174]/20 border-t-[#ffc174]" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#111125] flex flex-col items-center justify-center gap-4 px-4">
        <span className="material-symbols-outlined text-5xl text-[#d8c3ad]/40">sentiment_dissatisfied</span>
        <p className="text-[#d8c3ad]">{error ?? t("ticketNotFound")}</p>
        <button
          onClick={() => router.push("/support")}
          className="px-5 py-2.5 rounded-xl amber-gradient text-[#472a00] font-bold text-sm"
        >
          {t("backToSupport")}
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.CLOSED;

  return (
    <div className="min-h-screen bg-[#111125]">
      <div
        className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        {/* Header card */}
        <div className="bg-[#1e1e32] rounded-2xl p-5 mb-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 text-sm text-[#d8c3ad]/60 hover:text-[#ffc174] mb-4 transition-colors"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontSize: "18px" }}>
              arrow_back
            </span>
            {t("title")}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {ticket.ticketNumber && (
                  <span className="text-xs text-[#d8c3ad]/50 font-mono">
                    TK-{ticket.ticketNumber}
                  </span>
                )}
                <span className="text-xs text-[#c0c1ff] bg-[#c0c1ff]/10 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              </div>
              <h1 className="text-lg font-bold text-[#e2e0fc]">{ticket.subject}</h1>
              <p className="text-xs text-[#d8c3ad]/50 mt-1">
                {t("createdAt", { date: new Date(ticket.createdAt).toLocaleString("zh-TW") })}
              </p>
            </div>
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle}`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-[#1e1e32] rounded-2xl p-4 mb-4 overflow-y-auto min-h-64 space-y-4">
          {ticket.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-[#d8c3ad]/40">
              <span className="material-symbols-outlined text-4xl mb-3">chat_bubble_outline</span>
              <p className="text-sm">{t("waitingReply")}</p>
            </div>
          ) : (
            ticket.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} agentName={t("agentName")} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Satisfaction rating (closed tickets) */}
        {isClosed && (
          <div className="bg-[#1e1e32] rounded-2xl p-5 mb-4">
            <p className="text-sm font-semibold text-[#e2e0fc] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ffc174] text-lg">star</span>
              {ratingScore !== null
                ? t("ratingThanks", { score: ratingScore })
                : t("ratingPrompt")}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  disabled={ratingScore !== null}
                  onClick={() => handleRating(score)}
                  onMouseEnter={() => ratingScore === null && setHoveredStar(score)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="text-3xl transition-transform hover:scale-125 disabled:cursor-default"
                  aria-label={t("starLabel", { score })}
                >
                  <span
                    className={`material-symbols-outlined text-3xl transition-colors ${
                      score <= (hoveredStar ?? ratingScore ?? 0)
                        ? "text-[#ffc174]"
                        : "text-[#534434]"
                    }`}
                    style={{
                      fontVariationSettings: score <= (hoveredStar ?? ratingScore ?? 0)
                        ? "'FILL' 1"
                        : "'FILL' 0",
                    }}
                  >
                    star
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reply input (open tickets) */}
        {!isClosed && (
          <form
            onSubmit={handleReply}
            className="bg-[#1e1e32] rounded-2xl p-4"
          >
            <div className="flex gap-3">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={t("replyPlaceholder")}
                rows={3}
                className="flex-1 resize-none px-4 py-3 rounded-xl bg-[#0c0c1f] text-sm text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all"
              />
              <button
                type="submit"
                disabled={!replyBody.trim() || sending}
                className="self-end flex items-center gap-2 px-5 py-3 rounded-xl amber-gradient text-[#472a00] font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)]"
              >
                {sending ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#472a00] border-t-transparent" />
                ) : (
                  <>
                    <span>{t("send")}</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontSize: "18px" }}>
                      send
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, agentName }: { message: TicketMessageDto; agentName: string }) {
  const isPlayer = message.senderType === "PLAYER";
  const time = new Date(message.createdAt).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isPlayer ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[80%] ${isPlayer ? "items-start" : "items-end"} flex flex-col gap-1`}>
        {!isPlayer && (
          <span className="text-xs text-[#c0c1ff]/60 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs" style={{ fontSize: "14px" }}>
              support_agent
            </span>
            {agentName}
          </span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isPlayer
              ? "rounded-tl-sm bg-[#28283d] text-[#e2e0fc]"
              : "rounded-tr-sm bg-gradient-to-br from-[#ffc174] to-[#f59e0b] text-[#472a00]"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
        <span className="text-xs text-[#d8c3ad]/40">{time}</span>
      </div>
    </div>
  );
}
