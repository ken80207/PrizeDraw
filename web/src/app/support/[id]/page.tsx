"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

const CATEGORY_ZH: Record<string, string> = {
  TRADE_DISPUTE: "交易爭議",
  DRAW_ISSUE: "抽獎問題",
  ACCOUNT_ISSUE: "帳戶問題",
  SHIPPING_ISSUE: "寄送問題",
  PAYMENT_ISSUE: "付款問題",
  OTHER: "其他",
};

const STATUS_ZH: Record<string, string> = {
  OPEN: "待回應",
  IN_PROGRESS: "處理中",
  RESOLVED: "已解決",
  CLOSED: "已關閉",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

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
      .then((t) => {
        setTicket(t);
        setRatingScore(t.satisfactionScore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "載入工單失敗"))
      .finally(() => setLoading(false));
  }, [id]);

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
      toast.error(err instanceof Error ? err.message : "訊息發送失敗");
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{error ?? "找不到此工單"}</p>
        <button
          onClick={() => router.push("/support")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          返回客服中心
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col" style={{ minHeight: "calc(100vh - 4rem)" }}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-3 transition-colors"
          >
            ← 返回客服中心
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {ticket.ticketNumber && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    #{ticket.ticketNumber}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {CATEGORY_ZH[ticket.category] ?? ticket.category}
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{ticket.subject}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                建立於 {new Date(ticket.createdAt).toLocaleString("zh-TW")}
              </p>
            </div>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.CLOSED}`}
            >
              {STATUS_ZH[ticket.status] ?? ticket.status}
            </span>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4 overflow-y-auto min-h-64 space-y-4">
          {ticket.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 dark:text-gray-500">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-sm">等待客服人員回覆中...</p>
            </div>
          ) : (
            ticket.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Satisfaction rating (closed tickets) */}
        {isClosed && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {ratingScore !== null
                ? `感謝你的評分！(${ratingScore}/5 顆星)`
                : "對此次服務的滿意度如何？"}
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
                  aria-label={`評分 ${score} 顆星`}
                >
                  {score <= (hoveredStar ?? ratingScore ?? 0) ? "⭐" : "☆"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reply input (open tickets) */}
        {!isClosed && (
          <form
            onSubmit={handleReply}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex gap-3">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="輸入你的回覆..."
                rows={3}
                className="flex-1 resize-none px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!replyBody.trim() || sending}
                className="self-end px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? "發送中..." : "發送"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: TicketMessageDto }) {
  const isPlayer = message.senderType === "PLAYER";
  const time = new Date(message.createdAt).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isPlayer ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[80%] ${isPlayer ? "items-start" : "items-end"} flex flex-col gap-1`}>
        {!isPlayer && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">客服人員</span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isPlayer
              ? "rounded-tl-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              : "rounded-tr-sm bg-indigo-600 text-white"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
        <span className={`text-xs ${isPlayer ? "text-gray-400" : "text-gray-400"}`}>{time}</span>
      </div>
    </div>
  );
}
