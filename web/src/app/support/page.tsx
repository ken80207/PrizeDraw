"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { ListItemSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";

interface SupportTicketDto {
  id: string;
  ticketNumber: number;
  category: string;
  subject: string;
  status: string;
  lastMessagePreview: string | null;
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

const STATUS_ICONS: Record<string, string> = {
  OPEN: "🔵",
  IN_PROGRESS: "🟡",
  RESOLVED: "🟢",
  CLOSED: "⚫",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<SupportTicketDto[]>("/api/v1/support/tickets");
      setTickets(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "載入工單失敗";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">客服中心</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              查看你的客服工單和回覆記錄
            </p>
          </div>
          <Link
            href="/support/new"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            + 建立新工單
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button onClick={loadTickets} className="text-sm font-medium text-red-700 hover:underline">
              重試
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon="🎧"
            title="目前沒有客服工單"
            description="遇到任何問題？建立工單讓我們協助你！"
            action={{
              label: "建立新工單",
              onClick: () => (window.location.href = "/support/new"),
            }}
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/support/${ticket.id}`} className="block group">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          #{ticket.ticketNumber ?? ticket.id.slice(0, 6).toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                          {CATEGORY_ZH[ticket.category] ?? ticket.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {ticket.subject}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm">{STATUS_ICONS[ticket.status] ?? "⚪"}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.CLOSED}`}
                      >
                        {STATUS_ZH[ticket.status] ?? ticket.status}
                      </span>
                    </div>
                  </div>

                  {ticket.lastMessagePreview && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">
                      {ticket.lastMessagePreview}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    最後更新：{timeAgo(ticket.updatedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
