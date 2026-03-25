"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface SystemSettings {
  tradeFeeRateBps: number;
  animationMode: "TEAR" | "SCRATCH" | "FLIP" | "FAST";
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  tradeEnabled: boolean;
  withdrawalEnabled: boolean;
  systemVersion: string;
  environment: string;
  dbVersion?: string;
}

const ANIMATION_MODES = [
  { value: "TEAR", label: "撕籤模式" },
  { value: "SCRATCH", label: "刮刮樂" },
  { value: "FLIP", label: "翻牌" },
  { value: "FAST", label: "快速模式" },
];

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Local edit state
  const [feeRateBps, setFeeRateBps] = useState(0);
  const [animationMode, setAnimationMode] = useState<SystemSettings["animationMode"]>("FAST");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [tradeEnabled, setTradeEnabled] = useState(true);
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(true);

  useEffect(() => {
    apiClient
      .get<SystemSettings>("/api/v1/admin/settings")
      .then((data) => {
        setSettings(data);
        setFeeRateBps(data.tradeFeeRateBps);
        setAnimationMode(data.animationMode);
        setMaintenanceMode(data.maintenanceMode);
        setRegistrationEnabled(data.registrationEnabled);
        setTradeEnabled(data.tradeEnabled);
        setWithdrawalEnabled(data.withdrawalEnabled);
        setIsLoading(false);
      })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch("/api/v1/admin/settings", {
        tradeFeeRateBps: feeRateBps,
        animationMode,
        maintenanceMode,
        registrationEnabled,
        tradeEnabled,
        withdrawalEnabled,
      });
      setSettings((prev) => prev ? {
        ...prev,
        tradeFeeRateBps: feeRateBps,
        animationMode,
        maintenanceMode,
        registrationEnabled,
        tradeEnabled,
        withdrawalEnabled,
      } : prev);
      setIsDirty(false);
      setSavedAt(new Date().toLocaleTimeString("zh-TW"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={2} />
        </div>
      </div>
    );
  }

  const Toggle = ({
    enabled,
    onChange,
    label,
    description,
    danger,
  }: {
    enabled: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
    danger?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className={`text-sm font-medium ${danger ? "text-red-700" : "text-slate-800"}`}>{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => { onChange(!enabled); markDirty(); }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled
            ? danger ? "bg-red-500" : "bg-indigo-600"
            : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">系統設定</h1>
          <p className="text-sm text-slate-500">設定平台相關參數</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !isDirty && (
            <span className="text-xs text-green-600">✓ 已於 {savedAt} 儲存</span>
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Trade fee */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">交易手續費</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">費率（bps）</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={feeRateBps}
              onChange={(e) => { setFeeRateBps(Number(e.target.value)); markDirty(); }}
              min={0}
              max={10000}
            />
            <p className="mt-1 text-xs text-slate-400">1 bps = 0.01%</p>
          </div>
          <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
            <p className="text-xs text-slate-500">換算為百分比</p>
            <p className="text-lg font-bold text-indigo-700">{bpsToPercent(feeRateBps)}%</p>
          </div>
        </div>
      </div>

      {/* Animation mode */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">預設開獎動畫模式</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ANIMATION_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => { setAnimationMode(mode.value as SystemSettings["animationMode"]); markDirty(); }}
              className={`rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                animationMode === mode.value
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* System toggles */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">功能開關</h2>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={registrationEnabled}
            onChange={setRegistrationEnabled}
            label="開放新用戶註冊"
            description="關閉後新用戶無法建立帳號"
          />
          <Toggle
            enabled={tradeEnabled}
            onChange={setTradeEnabled}
            label="交易市集功能"
            description="關閉後玩家無法上架或購買賞品"
          />
          <Toggle
            enabled={withdrawalEnabled}
            onChange={setWithdrawalEnabled}
            label="提領功能"
            description="關閉後玩家無法申請提領"
          />
          <Toggle
            enabled={maintenanceMode}
            onChange={setMaintenanceMode}
            label="維護模式"
            description="開啟後平台顯示維護頁面，玩家無法使用"
            danger
          />
        </div>
      </div>

      {/* System info */}
      {settings && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">系統資訊</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "系統版本", value: settings.systemVersion ?? "—" },
              { label: "執行環境", value: settings.environment ?? "—" },
              { label: "資料庫版本", value: settings.dbVersion ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
