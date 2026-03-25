"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Message {
  id: string;
  senderType: "PLAYER" | "STAFF";
  senderName: string;
  content: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface DrawRecord {
  id: string;
  campaignName: string;
  prizeName: string;
  createdAt: string;
}

interface PlayerContext {
  id: string;
  nickname: string;
  phone: string;
  consumePoints: number;
  revenuePoints: number;
  status: string;
  recentTransactions: Transaction[];
  recentDraws: DrawRecord[];
}

interface Ticket {
  id: string;
  ticketNumber: number;
  playerId: string;
  playerName: string;
  category: string;
  subject: string;
  status: string;
  assignedTo?: string;
  satisfactionScore?: number;
  createdAt: string;
  messages: Message[];
}

export default function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [playerCtx, setPlayerCtx] = useState<PlayerContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState(5);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<Ticket>(`/api/v1/admin/support/tickets/${id}`),
    ]).then(([ticketResult]) => {
      if (ticketResult.status === "fulfilled") {
        const t = ticketResult.value;
        setTicket(t);
        // Load player context
        apiClient
          .get<PlayerContext>(`/api/v1/admin/players/${t.playerId}/context`)
          .then((ctx) => setPlayerCtx(ctx))
          .catch(() => null);
      } else {
        setError("載入失敗");
      }
      setIsLoading(false);
    });
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return;
    setIsSending(true);
    try {
      const msg = await apiClient.post<Message>(`/api/v1/admin/support/tickets/${id}/messages`, {
        content: replyText,
      });
      setTicket((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg], status: "IN_PROGRESS" } : prev,
      );
      setReplyText("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "傳送失敗");
    } finally {
      setIsSending(false);
    }
  };

  const handleAssign = async () => {
    try {
      await apiClient.patch(`/api/v1/admin/support/tickets/${id}/assign`, {});
      setTicket((prev) =>
        prev ? { ...prev, assignedTo: sessionStorage.getItem("adminStaffName") ?? "我" } : prev,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await apiClient.patch(`/api/v1/admin/support/tickets/${id}/close`, {
        satisfactionScore,
      });
      setTicket((prev) => prev ? { ...prev, status: "RESOLVED", satisfactionScore } : prev);
      setCloseModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} columns={2} />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "找不到工單"}</div>;
  }

  const CATEGORY_LABELS: Record<string, string> = {
    TRADE_DISPUTE: "交易爭議", ACCOUNT: "帳戶問題",
    PAYMENT: "付款問題", SHIPPING: "出貨問題", OTHER: "其他",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            type="button"
            onClick={() => router.push("/support")}
            className="text-sm text-slate-500 hover:text-slate-700 mb-1 block"
          >
            ← 客服工單
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">
              #{ticket.ticketNumber ?? ticket.id.slice(0, 6)} {ticket.subject}
            </h1>
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!ticket.assignedTo && (
            <button
              type="button"
              onClick={handleAssign}
              className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              指派給我
            </button>
          )}
          {ticket.status !== "RESOLVED" && (
            <button
              type="button"
              onClick={() => setCloseModal(true)}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              關閉工單
            </button>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-96">
        {/* Chat thread */}
        <div className="flex flex-1 flex-col rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ticket.messages.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">暫無訊息</p>
            )}
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "STAFF" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                    msg.senderType === "STAFF"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  <p className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</p>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 opacity-60 ${msg.senderType === "STAFF" ? "text-right" : ""}`}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {ticket.status !== "RESOLVED" && (
            <div className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <textarea
                  className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  rows={2}
                  placeholder="輸入回覆..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendReply();
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 self-end"
                >
                  {isSending ? "傳送中..." : "傳送"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Cmd+Enter 快速傳送</p>
            </div>
          )}
        </div>

        {/* Player context sidebar */}
        <aside className="w-64 flex-shrink-0 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">玩家資訊</h3>
            {playerCtx ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm font-bold">
                    {playerCtx.nickname.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{playerCtx.nickname}</p>
                    <StatusBadge status={playerCtx.status} />
                  </div>
                </div>
                <div className="text-xs text-slate-500">{playerCtx.phone}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">消費點數</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{playerCtx.consumePoints.toLocaleString()}</p>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">收益點數</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{playerCtx.revenuePoints.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">玩家: {ticket.playerName}</p>
            )}
          </div>

          {playerCtx && playerCtx.recentTransactions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">近期交易</h3>
              <div className="space-y-2">
                {playerCtx.recentTransactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate flex-1 mr-2">{tx.description}</span>
                    <span className={`font-medium tabular-nums ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {playerCtx && playerCtx.recentDraws.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">近期抽獎</h3>
              <div className="space-y-2">
                {playerCtx.recentDraws.slice(0, 5).map((draw) => (
                  <div key={draw.id} className="text-xs">
                    <p className="text-slate-700 font-medium">{draw.prizeName}</p>
                    <p className="text-slate-400">{draw.campaignName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Close modal */}
      <Modal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        title="關閉工單"
        footer={
          <>
            <button type="button" onClick={() => setCloseModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleClose} disabled={isClosing} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {isClosing ? "關閉中..." : "確認關閉"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">關閉工單後，問題將標記為已解決。</p>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">玩家滿意度評分</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setSatisfactionScore(score)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-110 ${
                    score <= satisfactionScore ? "text-yellow-400" : "text-slate-200"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
