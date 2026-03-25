"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface PrizeDefinition {
  id: string;
  campaignId: string;
  campaignName: string;
  grade: string;
  name: string;
  photoUrl?: string;
  buybackPrice: number;
  buybackEnabled: boolean;
  totalCount?: number;
}

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  prizes: PrizeDefinition[];
}

export default function PrizesPage() {
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [localPrizes, setLocalPrizes] = useState<Map<string, { buybackPrice: number; buybackEnabled: boolean }>>(new Map());

  useEffect(() => {
    apiClient
      .get<PrizeDefinition[]>("/api/v1/admin/prizes?limit=200")
      .then((data) => {
        // Group by campaign
        const map = new Map<string, CampaignGroup>();
        data.forEach((p) => {
          if (!map.has(p.campaignId)) {
            map.set(p.campaignId, { campaignId: p.campaignId, campaignName: p.campaignName, prizes: [] });
          }
          map.get(p.campaignId)!.prizes.push(p);
        });
        setGroups(Array.from(map.values()));

        // Initialize local state
        const locals = new Map<string, { buybackPrice: number; buybackEnabled: boolean }>();
        data.forEach((p) => locals.set(p.id, { buybackPrice: p.buybackPrice, buybackEnabled: p.buybackEnabled }));
        setLocalPrizes(locals);
        setIsLoading(false);
      })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleChange = (id: string, field: "buybackPrice" | "buybackEnabled", value: number | boolean) => {
    setLocalPrizes((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? { buybackPrice: 0, buybackEnabled: false };
      next.set(id, { ...current, [field]: value });
      return next;
    });
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const handleSave = async (id: string) => {
    const local = localPrizes.get(id);
    if (!local) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.patch(`/api/v1/admin/prizes/${id}`, {
        buybackPrice: local.buybackPrice,
        buybackEnabled: local.buybackEnabled,
      });
      setDirtyIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">賞品管理</h1>
        <p className="text-sm text-slate-500">設定各賞品的官方回收價格與開關</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {groups.length === 0 && !isLoading && (
        <EmptyState icon="🏆" title="沒有賞品定義" description="請先建立活動並設定賞品" />
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.campaignId} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">{group.campaignName}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["等級", "賞品名稱", "回收價格（點）", "官方回收開關", "操作"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.prizes.map((prize, idx) => {
                  const local = localPrizes.get(prize.id) ?? { buybackPrice: prize.buybackPrice, buybackEnabled: prize.buybackEnabled };
                  const isDirty = dirtyIds.has(prize.id);
                  const isSaving = savingIds.has(prize.id);
                  return (
                    <tr key={prize.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                      <td className="px-4 py-3 font-semibold text-indigo-600">{prize.grade}</td>
                      <td className="px-4 py-3 text-slate-800">{prize.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                            value={local.buybackPrice}
                            onChange={(e) => handleChange(prize.id, "buybackPrice", Number(e.target.value))}
                            min={0}
                          />
                          <span className="text-xs text-slate-400">點</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleChange(prize.id, "buybackEnabled", !local.buybackEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            local.buybackEnabled ? "bg-indigo-600" : "bg-slate-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              local.buybackEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {isDirty && (
                          <button
                            type="button"
                            onClick={() => handleSave(prize.id)}
                            disabled={isSaving}
                            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isSaving ? "儲存中..." : "儲存"}
                          </button>
                        )}
                        {!isDirty && (
                          <span className="text-xs text-slate-300">已儲存</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
