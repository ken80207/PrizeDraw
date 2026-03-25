"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt?: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient
      .get<FeatureFlag[]>("/api/v1/admin/feature-flags")
      .then((data) => { setFlags(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    const newEnabled = !flag.enabled;
    // Optimistic update
    setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabled: newEnabled } : f));
    setDirtyIds((prev) => new Set(prev).add(flag.id));
    setSavingId(flag.id);

    try {
      await apiClient.patch(`/api/v1/admin/feature-flags/${flag.id}`, { enabled: newEnabled });
      setFlags((prev) =>
        prev.map((f) => f.id === flag.id ? { ...f, enabled: newEnabled, updatedAt: new Date().toISOString() } : f),
      );
      setDirtyIds((prev) => { const next = new Set(prev); next.delete(flag.id); return next; });
    } catch (err) {
      // Revert
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabled: flag.enabled } : f));
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Feature Flags</h1>
        <p className="text-sm text-slate-500">即時開關系統功能，變更立即生效</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} columns={3} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="space-y-2">
          {flags.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
              沒有 Feature Flags
            </div>
          )}
          {flags.map((flag) => {
            const isDirty = dirtyIds.has(flag.id);
            const isSaving = savingId === flag.id;
            return (
              <div
                key={flag.id}
                className={`flex items-center justify-between rounded-lg border bg-white p-4 transition-colors ${
                  isDirty ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-slate-800">{flag.name}</p>
                    {isDirty && (
                      <span className="h-2 w-2 rounded-full bg-orange-400" title="未儲存變更" />
                    )}
                    {isSaving && (
                      <svg className="h-3 w-3 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{flag.description}</p>
                  {flag.updatedAt && (
                    <p className="mt-1 text-xs text-slate-400">
                      最後更新: {new Date(flag.updatedAt).toLocaleString("zh-TW")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium ${flag.enabled ? "text-green-600" : "text-slate-400"}`}>
                    {flag.enabled ? "已啟用" : "已停用"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(flag)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                      flag.enabled ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                    aria-label={flag.enabled ? "停用" : "啟用"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        flag.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
