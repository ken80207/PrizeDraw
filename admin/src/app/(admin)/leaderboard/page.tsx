"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface LeaderboardConfig {
  id: string;
  type: "DRAW_COUNT" | "LUCKY_STAR" | "TRADE_VOLUME";
  name: string;
  description: string;
  enabled: boolean;
  displayLimit: number;
  updatedAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  DRAW_COUNT: "抽獎達人",
  LUCKY_STAR: "幸運之星",
  TRADE_VOLUME: "交易風雲",
};

const TYPE_ICONS: Record<string, string> = {
  DRAW_COUNT: "🎰",
  LUCKY_STAR: "⭐",
  TRADE_VOLUME: "💱",
};

export default function LeaderboardPage() {
  const [configs, setConfigs] = useState<LeaderboardConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<LeaderboardConfig[]>("/api/v1/admin/leaderboard/config")
      .then((data) => { setConfigs(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleToggle = (id: string) => {
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));
    setIsDirty(true);
  };

  const handleLimitChange = (id: string, value: number) => {
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, displayLimit: value } : c));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch("/api/v1/admin/leaderboard/config", {
        configs: configs.map((c) => ({
          id: c.id,
          enabled: c.enabled,
          displayLimit: c.displayLimit,
        })),
      });
      setIsDirty(false);
      setSavedAt(new Date().toLocaleTimeString("zh-TW"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">排行榜設定</h1>
          <p className="text-sm text-slate-500">設定各排行榜的顯示筆數與開關</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !isDirty && (
            <span className="text-xs text-green-600">✓ 已於 {savedAt} 儲存</span>
          )}
          {isDirty && (
            <span className="text-xs text-orange-500">有未儲存的變更</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "儲存中..." : "儲存設定"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-6 h-24" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`rounded-lg border bg-white p-5 transition-colors ${
                isDirty ? "border-indigo-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">
                    {TYPE_ICONS[config.type] ?? "🏅"}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {TYPE_LABELS[config.type] ?? config.type}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Display limit */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600 whitespace-nowrap">顯示名次:</label>
                    <input
                      type="number"
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center focus:border-indigo-500 focus:outline-none"
                      value={config.displayLimit}
                      onChange={(e) => handleLimitChange(config.id, Math.max(1, Number(e.target.value)))}
                      min={1}
                      max={100}
                    />
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${config.enabled ? "text-green-600" : "text-slate-400"}`}>
                      {config.enabled ? "啟用" : "停用"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggle(config.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enabled ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          config.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {config.updatedAt && (
                <p className="mt-2 text-xs text-slate-400">
                  最後更新: {new Date(config.updatedAt).toLocaleString("zh-TW")}
                </p>
              )}
            </div>
          ))}

          {configs.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
              沒有排行榜設定
            </div>
          )}
        </div>
      )}
    </div>
  );
}
