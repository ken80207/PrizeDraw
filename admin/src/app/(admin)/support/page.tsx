"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Ticket {
  id: string;
  ticketNumber: number;
  playerId: string;
  playerName: string;
  category: string;
  subject: string;
  status: string;
  assignedTo?: string;
  lastMessageAt: string;
  createdAt: string;
}

const STATUS_TABS = [
  { value: "OPEN", label: "未回覆" },
  { value: "IN_PROGRESS", label: "處理中" },
  { value: "RESOLVED", label: "已解決" },
  { value: "ALL", label: "全部" },
];

const CATEGORIES = [
  { value: "", label: "全部分類" },
  { value: "TRADE_DISPUTE", label: "交易爭議" },
  { value: "ACCOUNT", label: "帳戶問題" },
  { value: "PAYMENT", label: "付款問題" },
  { value: "SHIPPING", label: "出貨問題" },
  { value: "OTHER", label: "其他" },
];

const CATEGORY_LABELS: Record<string, string> = {
  TRADE_DISPUTE: "交易爭議",
  ACCOUNT: "帳戶問題",
  PAYMENT: "付款問題",
  SHIPPING: "出貨問題",
  OTHER: "其他",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tabStatus, setTabStatus] = useState("OPEN");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const url =
      tabStatus === "ALL"
        ? `/api/v1/admin/support/tickets?limit=100${categoryFilter ? `&category=${categoryFilter}` : ""}`
        : `/api/v1/admin/support/tickets?status=${tabStatus}&limit=100${categoryFilter ? `&category=${categoryFilter}` : ""}`;
    apiClient
      .get<Ticket[]>(url)
      .then((data) => { setTickets(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, [tabStatus, categoryFilter]);

  const openCount = tickets.filter((t) => t.status === "OPEN").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">客服工單</h1>
        <p className="text-sm text-slate-500">處理玩家客服請求</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabStatus(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tabStatus === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.value === "OPEN" && openCount > 0 && tabStatus !== "OPEN" && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={5} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : tickets.length === 0 ? (
        <EmptyState icon="🎧" title="沒有工單" description="此狀態下沒有客服工單" />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-medium text-slate-500">
                    #{ticket.ticketNumber ?? ticket.id.slice(0, 6)}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                  </span>
                  <StatusBadge status={ticket.status} />
                </div>
                <p className="mt-1 font-medium text-slate-800 truncate">{ticket.subject}</p>
                <p className="mt-0.5 text-sm text-slate-500">玩家: {ticket.playerName}</p>
              </div>
              <div className="ml-4 flex-shrink-0 text-right">
                <p className="text-xs text-slate-400">{ticket.lastMessageAt ? timeAgo(ticket.lastMessageAt) : "—"}</p>
                {ticket.assignedTo && (
                  <p className="mt-1 text-xs text-slate-400">指派: {ticket.assignedTo}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
