"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
import { ListItemSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";

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

const STATUS_STYLES: Record<string, { dot: string; badge: string }> = {
  OPEN: {
    dot: "bg-[#8fd5ff]",
    badge: "bg-[#8fd5ff]/10 text-[#8fd5ff]",
  },
  IN_PROGRESS: {
    dot: "bg-[#ffc174]",
    badge: "bg-[#ffc174]/10 text-[#ffc174]",
  },
  RESOLVED: {
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-400",
  },
  CLOSED: {
    dot: "bg-[#534434]",
    badge: "bg-[#534434]/30 text-[#d8c3ad]/60",
  },
};

export default function SupportPage() {
  const t = useTranslations("support");
  const tCommon = useTranslations("common");

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

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return tCommon("justNow");
    if (mins < 60) return tCommon("minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tCommon("hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return tCommon("daysAgo", { count: days });
  }

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
      const msg = err instanceof Error ? err.message : t("loadError");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <div className="min-h-screen bg-[#111125]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-headline text-3xl font-bold text-[#e2e0fc]">{t("title")}</h1>
            <p className="mt-1 text-sm text-[#d8c3ad]">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/support/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl amber-gradient text-[#472a00] text-sm font-bold shadow-[0_4px_16px_rgba(245,158,11,0.25)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.35)] transition-all hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontSize: "18px" }}>
              add
            </span>
            {t("newTicket")}
          </Link>
        </div>

        {/* Active Cases label */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline text-sm font-bold text-[#e2e0fc] uppercase tracking-widest">
            {t("activeCases")}
          </h2>
          <span className="text-xs text-[#d8c3ad]/60 uppercase tracking-wider">{t("sortRecent")}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-[#ffb4ab]/10 flex items-center justify-between">
            <span className="text-sm text-[#ffb4ab]">{error}</span>
            <button onClick={loadTickets} className="text-sm font-bold text-[#ffc174] hover:underline">
              {tCommon("retry")}
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
            icon="headset_mic"
            title={t("noTickets")}
            description={t("noTicketsDesc")}
            action={{
              label: t("createTicket"),
              onClick: () => (window.location.href = "/support/new"),
            }}
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const statusStyle = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.CLOSED;
              return (
                <Link key={ticket.id} href={`/support/${ticket.id}`} className="block group">
                  <div className="bg-[#1e1e32] rounded-2xl p-4 hover:bg-[#28283d] transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs text-[#d8c3ad]/50 font-mono">
                            TK-{ticket.ticketNumber ?? ticket.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className="text-xs text-[#c0c1ff] bg-[#c0c1ff]/10 px-2 py-0.5 rounded-full">
                            {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                          </span>
                        </div>
                        <h3 className="font-semibold text-[#e2e0fc] truncate group-hover:text-[#ffc174] transition-colors">
                          {ticket.subject}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle.badge}`}
                      >
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </div>

                    {ticket.lastMessagePreview && (
                      <p className="text-sm text-[#d8c3ad]/70 truncate mb-2">
                        {ticket.lastMessagePreview}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                      <p className="text-xs text-[#d8c3ad]/50">
                        {timeAgo(ticket.updatedAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
