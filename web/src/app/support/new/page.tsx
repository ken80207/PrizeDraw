"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

const CATEGORIES: { value: TicketCategory; label: string; icon: string }[] = [
  { value: "TRADE_DISPUTE", label: "交易爭議", icon: "💱" },
  { value: "DRAW_ISSUE", label: "抽獎問題", icon: "🎫" },
  { value: "ACCOUNT_ISSUE", label: "帳戶問題", icon: "👤" },
  { value: "SHIPPING_ISSUE", label: "寄送問題", icon: "📦" },
  { value: "PAYMENT_ISSUE", label: "付款問題", icon: "💳" },
  { value: "OTHER", label: "其他", icon: "💬" },
];

export default function NewSupportTicketPage() {
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      toast.success("工單已成功建立！");
      router.push(`/support/${ticket.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "建立工單失敗";
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
        >
          ← 返回客服中心
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            建立新工單
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                問題類別
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      category === value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    }`}
                  >
                    <span>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                主旨 <span className="text-red-500">*</span>
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="簡短說明你的問題"
                maxLength={200}
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">
                {subject.length}/200
              </p>
            </div>

            {/* Body */}
            <div>
              <label
                htmlFor="body"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                問題描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="請盡量詳細描述你的問題，包含相關的活動 ID、交易編號等資訊..."
                rows={7}
                required
                className="w-full resize-y px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Link
                href="/support"
                className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </Link>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "送出中..." : "送出工單"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
