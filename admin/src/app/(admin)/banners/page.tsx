"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ImageUpload } from "@/components/ImageUpload";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Banner {
  id: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

interface CreateForm {
  imageUrl: string;
  sortOrder: number;
  scheduledStart: string;
  scheduledEnd: string;
}

const EMPTY_FORM: CreateForm = {
  imageUrl: "",
  sortOrder: 0,
  scheduledStart: "",
  scheduledEnd: "",
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin banner carousel management page.
 *
 * Allows operators to upload and schedule promotional banner images shown
 * on the home page carousel.
 *
 * Routes used:
 * - GET    /api/v1/admin/banners        — list
 * - POST   /api/v1/admin/banners        — create
 * - DELETE /api/v1/admin/banners/{id}   — deactivate
 */
export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBanners = () => {
    setIsLoading(true);
    apiClient
      .get<Banner[]>("/api/v1/admin/banners")
      .then((data) => {
        setBanners(data);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      alert("請先上傳橫幅圖片");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/v1/admin/banners", {
        imageUrl: form.imageUrl,
        sortOrder: form.sortOrder,
        scheduledStart: form.scheduledStart || null,
        scheduledEnd: form.scheduledEnd || null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadBanners();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm("確定要停用此橫幅？")) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/admin/banners/${id}`);
      loadBanners();
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
          <h1 className="text-xl font-bold text-slate-900">輪播橫幅管理</h1>
          <p className="text-sm text-slate-500">管理首頁推廣輪播圖片，支援排程上下架</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          {showForm ? "取消" : "+ 新增橫幅"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">新增橫幅</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Image upload */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">橫幅圖片</label>
              <ImageUpload
                onUpload={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                currentUrl={form.imageUrl || undefined}
                label=""
              />
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">排序順序</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
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
                {isSubmitting ? "送出中…" : "建立橫幅"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banner list */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={3} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
          沒有橫幅
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => {
            const isDeleting = deletingId === b.id;
            return (
              <div
                key={b.id}
                className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0 mr-4">
                  {/* Thumbnail */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.imageUrl}
                    alt="橫幅預覽"
                    className="h-16 w-28 rounded object-cover shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Sort order badge */}
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        排序 {b.sortOrder}
                      </span>

                      {/* Status badge */}
                      {b.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          上架中
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          已下架
                        </span>
                      )}
                    </div>

                    {/* Schedule times */}
                    <div className="mt-1 space-y-0.5">
                      {b.scheduledStart && (
                        <p className="text-xs text-slate-400">
                          開始：{new Date(b.scheduledStart).toLocaleString("zh-TW")}
                        </p>
                      )}
                      {b.scheduledEnd && (
                        <p className="text-xs text-slate-400">
                          結束：{new Date(b.scheduledEnd).toLocaleString("zh-TW")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeactivate(b.id)}
                  disabled={isDeleting || !b.isActive}
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
