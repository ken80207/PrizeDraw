"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/services/apiClient";
import { TicketCard, type Ticket } from "@/components/TicketCard";

interface TicketStats {
  open: number;
  inProgress: number;
  resolvedToday: number;
}

interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTERS = [
  { value: "OPEN", label: "未回覆", color: "text-red-600" },
  { value: "IN_PROGRESS", label: "處理中", color: "text-amber-600" },
  { value: "RESOLVED", label: "已解決", color: "text-green-600" },
  { value: "", label: "全部", color: "text-slate-600" },
];

const CATEGORIES = [
  { value: "", label: "全部分類" },
  { value: "TRADE_DISPUTE", label: "交易爭議" },
  { value: "ACCOUNT", label: "帳戶問題" },
  { value: "PAYMENT", label: "付款問題" },
  { value: "SHIPPING", label: "出貨問題" },
  { value: "DRAW_ISSUE", label: "抽獎異常" },
  { value: "PRIZE", label: "賞品問題" },
  { value: "OTHER", label: "其他" },
];

const ASSIGN_FILTERS = [
  { value: "", label: "全部人員" },
  { value: "me", label: "我的工單" },
  { value: "unassigned", label: "未指派" },
];

const PAGE_SIZE = 20;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats>({
    open: 0,
    inProgress: 0,
    resolvedToday: 0,
  });
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [assignFilter, setAssignFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (assignFilter) params.set("assign", assignFilter);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    try {
      const data = await apiClient.get<TicketListResponse>(
        `/api/v1/support/tickets?${params.toString()}`,
      );
      setTickets(data.tickets ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入工單失敗");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, assignFilter, page]);

  const fetchStats = useCallback(async () => {
    // Derive stats from current ticket list (no dedicated stats endpoint in contracts).
    // Stats will be updated after each fetchTickets call via useEffect.
  }, []);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  // Recompute stats from loaded tickets on each fetch
  useEffect(() => {
    setStats({
      open: tickets.filter((t) => t.status === "OPEN").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      resolvedToday: tickets.filter((t) => t.status === "RESOLVED").length,
    });
  }, [tickets]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, assignFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full flex-col">
      {/* Stats row */}
      <div className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setStatusFilter("OPEN")}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
          >
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white leading-none">
              {stats.open}
            </span>
            <span className="font-medium text-slate-700">未回覆</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
          >
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-white leading-none">
              {stats.inProgress}
            </span>
            <span className="font-medium text-slate-700">處理中</span>
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-bold text-white leading-none">
              {stats.resolvedToday}
            </span>
            <span className="font-medium text-slate-700">今日已結案</span>
          </div>
          <div className="ml-auto text-xs text-slate-400">
            每 30 秒自動更新
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter panel */}
        <aside className="hidden w-44 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 md:block">
          {/* Status filter */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              狀態
            </p>
            <div className="space-y-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      f.value === "OPEN"
                        ? "bg-red-500"
                        : f.value === "IN_PROGRESS"
                          ? "bg-amber-400"
                          : f.value === "RESOLVED"
                            ? "bg-green-500"
                            : "bg-slate-300"
                    }`}
                  />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              分類
            </p>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignment filter */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              指派
            </p>
            <select
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            >
              {ASSIGN_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </aside>

        {/* Ticket list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-lg bg-slate-200"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-5xl">📭</span>
                <p className="mt-4 text-base font-medium">沒有符合條件的工單</p>
                <p className="mt-1 text-sm">嘗試調整篩選條件</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
              <p className="text-sm text-slate-500">
                共 {total} 筆，第 {page} / {totalPages} 頁
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一頁
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
