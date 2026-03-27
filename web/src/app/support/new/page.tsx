"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/components/Toast";

type TicketCategory =
  | "TRADE_DISPUTE"
  | "DRAW_ISSUE"
  | "ACCOUNT_ISSUE"
  | "SHIPPING_ISSUE"
  | "PAYMENT_ISSUE"
  | "OTHER";

interface SupportTicketDto {
  id: string;
}

export default function NewSupportTicketPage() {
  const t = useTranslations("support");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CATEGORIES: { value: TicketCategory; label: string; icon: string }[] = [
    { value: "TRADE_DISPUTE", label: t("categoryTrade"), icon: "currency_exchange" },
    { value: "DRAW_ISSUE", label: t("categoryDraw"), icon: "confirmation_number" },
    { value: "ACCOUNT_ISSUE", label: t("categoryAccount"), icon: "manage_accounts" },
    { value: "SHIPPING_ISSUE", label: t("categoryShipping"), icon: "package_2" },
    { value: "PAYMENT_ISSUE", label: t("categoryPayment"), icon: "credit_card" },
    { value: "OTHER", label: t("categoryOther"), icon: "chat_bubble" },
  ];

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await apiClient.post<SupportTicketDto>("/api/v1/support/tickets", {
        category,
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success(t("createSuccess"));
      router.push(`/support/${ticket.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("createError");
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111125]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-[#d8c3ad]/60 hover:text-[#ffc174] mb-6 transition-colors"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontSize: "18px" }}>
            arrow_back
          </span>
          {t("title")}
        </Link>

        <div className="bg-[#1e1e32] rounded-2xl p-6">
          <h1 className="font-headline text-2xl font-bold text-[#e2e0fc] mb-1">
            {t("newTicketTitle")}
          </h1>
          <p className="text-sm text-[#d8c3ad] mb-6">
            {t("newTicketDesc")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-[#c0c1ff]/70 uppercase tracking-wider mb-3">
                {t("category")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      category === value
                        ? "bg-[#28283d] shadow-[inset_0_0_0_1px_rgba(255,193,116,0.4)] text-[#ffc174]"
                        : "bg-[#0c0c1f] text-[#d8c3ad] hover:bg-[#1a1a2e]"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-base ${
                        category === value ? "text-[#ffc174]" : "text-[#d8c3ad]/50"
                      }`}
                      style={{ fontSize: "18px" }}
                    >
                      {icon}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="subject"
                className="block text-xs font-semibold text-[#c0c1ff]/70 uppercase tracking-wider mb-2"
              >
                {t("subjectLabel")} <span className="text-[#ffb4ab]">*</span>
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("subjectPlaceholder")}
                maxLength={200}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#0c0c1f] text-sm text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all"
              />
              <p className="mt-1 text-xs text-[#d8c3ad]/40 text-right">
                {subject.length}/200
              </p>
            </div>

            {/* Body */}
            <div>
              <label
                htmlFor="body"
                className="block text-xs font-semibold text-[#c0c1ff]/70 uppercase tracking-wider mb-2"
              >
                {t("descriptionLabel")} <span className="text-[#ffb4ab]">*</span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={7}
                required
                className="w-full resize-y px-4 py-3 rounded-xl bg-[#0c0c1f] text-sm text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-[#ffb4ab]/10">
                <p className="text-sm text-[#ffb4ab]">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Link
                href="/support"
                className="flex-1 py-3 rounded-xl border border-[#534434]/30 text-[#d8c3ad] font-medium text-sm text-center hover:bg-[#28283d] transition-colors"
              >
                {tCommon("cancel")}
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 py-3 rounded-xl amber-gradient text-[#472a00] font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)]"
              >
                {submitting ? tCommon("submitting") : t("submitTicket")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
