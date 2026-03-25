"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AnnouncementType = "MAINTENANCE" | "ANNOUNCEMENT" | "UPDATE_REQUIRED";

interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  isBlocking: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

interface CreateForm {
  type: AnnouncementType;
  title: string;
  message: string;
  isBlocking: boolean;
  targetPlatforms: string[];
  minAppVersion: string;
  scheduledStart: string;
  scheduledEnd: string;
}

const EMPTY_FORM: CreateForm = {
  type: "ANNOUNCEMENT",
  title: "",
  message: "",
  isBlocking: false,
  targetPlatforms: ["ALL"],
  minAppVersion: "",
  scheduledStart: "",
  scheduledEnd: "",
};

const TYPE_LABELS: Record<AnnouncementType, string> = {
  MAINTENANCE: "維護",
  ANNOUNCEMENT: "公告",
  UPDATE_REQUIRED: "強制更新",
};

const TYPE_COLORS: Record<AnnouncementType, string> = {
  MAINTENANCE: "bg-red-100 text-red-700",
  ANNOUNCEMENT: "bg-blue-100 text-blue-700",
  UPDATE_REQUIRED: "bg-orange-100 text-orange-700",
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin announcement management page.
 *
 * Allows operators to create maintenance windows, informational notices, and
 * forced update prompts that are shown to all platform clients in real time.
 *
 * Routes used:
 * - GET    /api/v1/admin/announcements        — list
 * - POST   /api/v1/admin/announcements        — create
 * - PATCH  /api/v1/admin/announcements/{id}   — update (toggle active)
 * - DELETE /api/v1/admin/announcements/{id}   — deactivate
 */
export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAnnouncements = () => {
    setIsLoading(true);
    apiClient
      .get<Announcement[]>("/api/v1/admin/announcements")
      .then((data) => {
        setAnnouncements(data);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/v1/admin/announcements", {
        type: form.type,
        title: form.title,
        message: form.message,
        isBlocking: form.isBlocking,
        targetPlatforms: form.targetPlatforms,
        minAppVersion: form.minAppVersion || null,
        scheduledStart: form.scheduledStart || null,
        scheduledEnd: form.scheduledEnd || null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadAnnouncements();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm("確定要停用此公告？")) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/admin/announcements/${id}`);
      loadAnnouncements();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "停用失敗");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">公告管理</h1>
          <p className="text-sm text-slate-500">管理系統維護通知與平台公告，變更立即生效</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          {showForm ? "取消" : "+ 新增公告"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">新增公告</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">類型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnouncementType }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ANNOUNCEMENT">公告</option>
                  <option value="MAINTENANCE">維護</option>
                  <option value="UPDATE_REQUIRED">強制更新</option>
                </select>
              </div>

              {/* Blocking */}
              <div className="flex items-center gap-3 pt-5">
                <input
                  id="isBlocking"
                  type="checkbox"
                  checked={form.isBlocking}
                  onChange={(e) => setForm((f) => ({ ...f, isBlocking: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isBlocking" className="text-sm font-medium text-slate-700">
                  封鎖所有操作（維護模式）
                </label>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">標題</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="系統維護中"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">訊息內容</label>
              <textarea
                required
                rows={3}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="預計 14:00 恢復服務"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Scheduled start */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  開始時間（選填）
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Scheduled end */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  結束時間（選填）
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Min app version (for UPDATE_REQUIRED) */}
            {form.type === "UPDATE_REQUIRED" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  最低版本需求（例如 1.2.0）
                </label>
                <input
                  type="text"
                  value={form.minAppVersion}
                  onChange={(e) => setForm((f) => ({ ...f, minAppVersion: e.target.value }))}
                  placeholder="1.2.0"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting ? "送出中…" : "建立公告"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcement list */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={3} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
          沒有公告
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => {
            const isDeleting = deletingId === a.id;
            return (
              <div
                key={a.id}
                className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[a.type]}`}
                    >
                      {TYPE_LABELS[a.type]}
                    </span>
                    {a.isBlocking && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        封鎖中
                      </span>
                    )}
                    <span className="text-sm font-semibold text-slate-800 truncate">{a.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">{a.message}</p>
                  {a.scheduledEnd && (
                    <p className="mt-1 text-xs text-slate-400">
                      預計結束：{new Date(a.scheduledEnd).toLocaleString("zh-TW")}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDeactivate(a.id)}
                  disabled={isDeleting}
                  className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "停用中…" : "停用"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
