"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrizeDefinition {
  id: string;
  grade: string;
  name: string;
}

interface PityPoolItem {
  prizeDefinitionId: string;
  grade: string;
  prizeName: string;
  weight: number;
}

interface PityRuleDto {
  id: string;
  campaignId: string;
  threshold: number;
  accumulationMode: string;
  sessionTimeoutSeconds?: number;
  enabled: boolean;
  prizePool: PityPoolItem[];
}

interface UpsertPityRuleRequest {
  threshold: number;
  accumulationMode: string;
  sessionTimeoutSeconds?: number;
  enabled: boolean;
  prizePool: Array<{ prizeDefinitionId: string; weight: number }>;
}

interface Props {
  campaignId: string;
  campaignStatus: string;
  prizeDefinitions: PrizeDefinition[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultRule = (): Omit<PityRuleDto, "id" | "campaignId"> => ({
  threshold: 10,
  accumulationMode: "PERSISTENT",
  sessionTimeoutSeconds: undefined,
  enabled: false,
  prizePool: [],
});

// ─── Component ────────────────────────────────────────────────────────────────

export function PityConfigSection({ campaignId, campaignStatus, prizeDefinitions }: Props) {
  const isActive = campaignStatus === "ACTIVE";

  const [rule, setRule] = useState<Omit<PityRuleDto, "id" | "campaignId">>(defaultRule());
  const [exists, setExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load existing rule ─────────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<PityRuleDto>(`/api/v1/admin/campaigns/${campaignId}/pity-rule`)
      .then((dto) => {
        setRule({
          threshold: dto.threshold,
          accumulationMode: dto.accumulationMode,
          sessionTimeoutSeconds: dto.sessionTimeoutSeconds,
          enabled: dto.enabled,
          prizePool: dto.prizePool,
        });
        setExists(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        // 404 means no rule yet — that's fine
        if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
          setExists(false);
        } else {
          setError(err instanceof Error ? err.message : "載入失敗");
        }
        setIsLoading(false);
      });
  }, [campaignId]);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // ── Mutate helpers ─────────────────────────────────────────────────────────
  const update = <K extends keyof typeof rule>(key: K, value: (typeof rule)[K]) => {
    setRule((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const updatePoolWeight = (prizeDefinitionId: string, weight: number) => {
    setRule((prev) => ({
      ...prev,
      prizePool: prev.prizePool.map((item) =>
        item.prizeDefinitionId === prizeDefinitionId ? { ...item, weight } : item,
      ),
    }));
    setIsDirty(true);
  };

  const removeFromPool = (prizeDefinitionId: string) => {
    setRule((prev) => ({
      ...prev,
      prizePool: prev.prizePool.filter((item) => item.prizeDefinitionId !== prizeDefinitionId),
    }));
    setIsDirty(true);
  };

  const addFromDefinition = (def: PrizeDefinition) => {
    const alreadyAdded = rule.prizePool.some((item) => item.prizeDefinitionId === def.id);
    if (alreadyAdded) return;
    setRule((prev) => ({
      ...prev,
      prizePool: [
        ...prev.prizePool,
        { prizeDefinitionId: def.id, grade: def.grade, prizeName: def.name, weight: 1 },
      ],
    }));
    setIsDirty(true);
    setShowDropdown(false);
  };

  // ── Save / delete ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const body: UpsertPityRuleRequest = {
        threshold: rule.threshold,
        accumulationMode: rule.accumulationMode,
        ...(rule.accumulationMode === "SESSION" && rule.sessionTimeoutSeconds != null
          ? { sessionTimeoutSeconds: rule.sessionTimeoutSeconds }
          : {}),
        enabled: rule.enabled,
        prizePool: rule.prizePool.map((item) => ({
          prizeDefinitionId: item.prizeDefinitionId,
          weight: item.weight,
        })),
      };
      const saved = await apiClient.put<PityRuleDto>(
        `/api/v1/admin/campaigns/${campaignId}/pity-rule`,
        body,
      );
      setRule({
        threshold: saved.threshold,
        accumulationMode: saved.accumulationMode,
        sessionTimeoutSeconds: saved.sessionTimeoutSeconds,
        enabled: saved.enabled,
        prizePool: saved.prizePool,
      });
      setExists(true);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("確定要刪除保底規則嗎？")) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.delete<void>(`/api/v1/admin/campaigns/${campaignId}/pity-rule`);
      setRule(defaultRule());
      setExists(false);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle enabled (allowed even when ACTIVE) ──────────────────────────────
  const handleToggleEnabled = async (newEnabled: boolean) => {
    // Optimistic UI update
    setRule((prev) => ({ ...prev, enabled: newEnabled }));
    setIsDirty(true);
  };

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalWeight = rule.prizePool.reduce((s, item) => s + item.weight, 0);
  const poolWithPct = rule.prizePool.map((item) => ({
    ...item,
    pct: totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(1) : "0.0",
  }));

  const availableToAdd = prizeDefinitions.filter(
    (def) => !rule.prizePool.some((item) => item.prizeDefinitionId === def.id),
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">保底規則</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            連續未中獎達到閾值後保證命中獎池中的獎品
          </p>
        </div>
        {/* Enabled toggle — always editable */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-slate-600">{rule.enabled ? "已啟用" : "已停用"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            onClick={() => handleToggleEnabled(!rule.enabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              rule.enabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                rule.enabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Config fields — disabled when ACTIVE */}
      <fieldset disabled={isActive} className="space-y-4">
        {isActive && (
          <p className="rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
            活動進行中，僅可切換啟用狀態，其餘設定不可修改
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Threshold */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              閾值（連續未中獎次數）
            </label>
            <input
              type="number"
              min={2}
              value={rule.threshold}
              onChange={(e) => update("threshold", Math.max(2, parseInt(e.target.value, 10) || 2))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-400">最小值為 2</p>
          </div>

          {/* Accumulation mode */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">累積模式</label>
            <select
              value={rule.accumulationMode}
              onChange={(e) => update("accumulationMode", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <option value="PERSISTENT">PERSISTENT（永久累積）</option>
              <option value="SESSION">SESSION（會話累積）</option>
            </select>
          </div>

          {/* Session timeout — only shown in SESSION mode */}
          {rule.accumulationMode === "SESSION" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                會話逾時（秒）
              </label>
              <input
                type="number"
                min={1}
                value={rule.sessionTimeoutSeconds ?? ""}
                onChange={(e) =>
                  update(
                    "sessionTimeoutSeconds",
                    e.target.value === "" ? undefined : Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                placeholder="例如 3600"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-400">玩家閒置超過此秒數後計數重置</p>
            </div>
          )}
        </div>

        {/* Prize pool */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">保底獎池</label>
            {/* Add from campaign prizes dropdown */}
            {!isActive && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDropdown((v) => !v)}
                  disabled={availableToAdd.length === 0}
                  className="flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + 從活動獎品新增
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${showDropdown ? "rotate-180" : ""}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {showDropdown && availableToAdd.length > 0 && (
                  <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
                    <ul className="max-h-48 overflow-y-auto py-1">
                      {availableToAdd.map((def) => (
                        <li key={def.id}>
                          <button
                            type="button"
                            onClick={() => addFromDefinition(def)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                              {def.grade}
                            </span>
                            <span className="truncate">{def.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {rule.prizePool.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
              尚未設定保底獎池，請從活動獎品中新增
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {["等級", "獎品名稱", "權重", "佔比"].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-left text-xs font-medium text-slate-500 pr-3"
                      >
                        {h}
                      </th>
                    ))}
                    {!isActive && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poolWithPct.map((item) => (
                    <tr key={item.prizeDefinitionId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-3">
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {item.grade}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{item.prizeName}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          value={item.weight}
                          onChange={(e) =>
                            updatePoolWeight(
                              item.prizeDefinitionId,
                              Math.max(1, parseInt(e.target.value, 10) || 1),
                            )
                          }
                          disabled={isActive}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500 font-mono">{item.pct}%</td>
                      {!isActive && (
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeFromPool(item.prizeDefinitionId)}
                            className="text-slate-400 hover:text-red-500 text-xs"
                            aria-label="移除"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </fieldset>

      {/* Summary */}
      {(rule.prizePool.length > 0 || rule.threshold > 0) && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 space-y-1">
          <p className="font-medium text-slate-700">觸發條件摘要</p>
          <p>
            連續未中獎{" "}
            <span className="font-semibold text-indigo-700">{rule.threshold}</span> 次後，
            {rule.accumulationMode === "SESSION"
              ? `以會話模式累積（逾時 ${rule.sessionTimeoutSeconds ?? "—"} 秒後重置），`
              : "永久累積計數，"}
            保證從下列獎池中抽到獎品。
          </p>
          {rule.prizePool.length > 0 && (
            <ul className="mt-1 space-y-0.5 pl-3 list-disc">
              {poolWithPct.map((item) => (
                <li key={item.prizeDefinitionId}>
                  {item.grade} · {item.prizeName}
                  <span className="ml-1 text-slate-400">（{item.pct}%）</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {exists ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving || isActive}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            刪除規則
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "儲存中..." : exists ? "更新規則" : "建立規則"}
        </button>
      </div>
    </div>
  );
}
