"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { calcUnlimitedMargin, pctToBps } from "@/lib/margin-utils";
import { MarginDisplay } from "@/components/MarginDisplay";

interface DrawRecord {
  ticketId: string;
  position: number;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string | null;
  playerNickname: string;
  drawnAt: string;
}

interface PrizeDefinition {
  id: string;
  grade: string;
  name: string;
  probability?: number;
  prizeValue?: number;
  probabilityBps?: number;
  photoUrl?: string;
  photos?: string[];
  ticketCount?: number;
  buybackPrice?: number;
  buybackEnabled?: boolean;
}

interface TicketBox {
  id: string;
  label: string;
  totalTickets: number;
  remainingTickets: number;
}

interface Campaign {
  id: string;
  title: string;
  type: "KUJI" | "UNLIMITED";
  description: string;
  pricePerDraw: number;
  drawSessionSeconds?: number;
  status: string;
  createdAt: string;
  coverImageUrl?: string;
  prizePool?: PrizeDefinition[];
  boxes?: TicketBox[];
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ action: "activate" | "deactivate" } | null>(null);
  const [notifyOnChange, setNotifyOnChange] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [probRows, setProbRows] = useState<PrizeDefinition[]>([]);
  const [probDirty, setProbDirty] = useState(false);
  const [drawRecords, setDrawRecords] = useState<DrawRecord[]>([]);

  useEffect(() => {
    apiClient
      .get<Record<string, unknown>>(`/api/v1/admin/campaigns/${id}`)
      .then((raw) => {
        // The API returns a nested structure: { campaign: {...}, boxes: [...], prizes: [...] }
        // Flatten it into our Campaign interface.
        const inner = (raw.campaign ?? raw) as Record<string, unknown>;
        const data: Campaign = {
          id: inner.id as string,
          title: inner.title as string,
          type: (inner.type ?? (inner.drawSessionSeconds != null ? "KUJI" : "UNLIMITED")) as Campaign["type"],
          description: (inner.description ?? "") as string,
          pricePerDraw: inner.pricePerDraw as number,
          drawSessionSeconds: inner.drawSessionSeconds as number | undefined,
          status: inner.status as string,
          createdAt: (inner.createdAt ?? inner.activatedAt ?? "") as string,
          coverImageUrl: inner.coverImageUrl as string | undefined,
          prizePool: (raw.prizes ?? []) as PrizeDefinition[],
          boxes: (raw.boxes ?? []) as TicketBox[],
        };
        setCampaign(data);
        setEditName(data.title);
        setEditDesc(data.description ?? "");
        setProbRows(data.prizePool ?? []);
        setIsLoading(false);

        apiClient
          .get<DrawRecord[]>(`/api/v1/admin/campaigns/${id}/draw-records?limit=200`)
          .then(setDrawRecords)
          .catch(() => {}); // silently fail if not available yet
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "載入失敗");
        setIsLoading(false);
      });
  }, [id]);

  const handleStatusChange = async (newStatus: string, confirmLowMargin = false) => {
    setIsSaving(true);
    try {
      await apiClient.patch(`/api/v1/admin/campaigns/${id}/status`, {
        status: newStatus,
        ...(confirmLowMargin ? { confirmLowMargin: true } : {}),
        notifyPlayers: notifyOnChange,
      });
      setCampaign((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setConfirmModal(null);
      setNotifyOnChange(true); // reset for next time
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 422) {
        const confirmed = window.confirm("毛利率低於警戒線，確定要上架嗎？");
        if (confirmed) {
          await handleStatusChange(newStatus, true);
          return;
        }
      } else {
        alert(err instanceof Error ? err.message : "操作失敗");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBasic = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch(`/api/v1/admin/campaigns/${id}`, {
        title: editName,
        description: editDesc,
      });
      setCampaign((prev) => prev ? { ...prev, title: editName, description: editDesc } : prev);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProbability = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch(
        `/api/v1/admin/campaigns/unlimited/${id}/prize-table`,
        {
          prizeTable: probRows.map((r, i) => ({
            grade: r.grade,
            name: r.name,
            probabilityBps: pctToBps(r.probability ?? 0),
            prizeValue: r.prizeValue ?? 0,
            photoUrl: r.photoUrl || undefined,
            displayOrder: i,
          })),
        },
      );
      setProbDirty(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProbRow = (rowId: string, field: keyof PrizeDefinition, value: unknown) => {
    setProbRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
    setProbDirty(true);
  };

  const timeAgo = (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  const gradeBadgeStyle = (grade: string): React.CSSProperties => {
    const g = grade.toUpperCase();
    if (g.startsWith("A")) return { backgroundColor: "#fef3c7", color: "#92400e" };
    if (g.startsWith("B")) return { backgroundColor: "#dbeafe", color: "#1e40af" };
    if (g.startsWith("C")) return { backgroundColor: "#dcfce7", color: "#166534" };
    if (g.startsWith("D")) return { backgroundColor: "#f3e8ff", color: "#6b21a8" };
    if (g.startsWith("E")) return { backgroundColor: "#fce7f3", color: "#9d174d" };
    if (g.toLowerCase().includes("last")) return { backgroundColor: "#fee2e2", color: "#991b1b" };
    return { backgroundColor: "#f1f5f9", color: "#475569" };
  };

  const totalProb = probRows.reduce((s, r) => s + (r.probability ?? 0), 0);
  const isLocked = campaign?.status === "ACTIVE" && campaign?.type === "KUJI";

  const unlimitedMargin =
    campaign?.type === "UNLIMITED" && probRows.length > 0
      ? calcUnlimitedMargin(
          campaign.pricePerDraw,
          probRows.map((r) => ({ probabilityBps: pctToBps(r.probability ?? 0), prizeValue: r.prizeValue ?? 0 })),
          20,
        )
      : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={4} columns={3} />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "找不到活動"}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => router.push("/campaigns")}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 活動管理
            </button>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{campaign.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={campaign.type} label={campaign.type === "KUJI" ? "一番賞" : "無限賞"} />
            <StatusBadge status={campaign.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => setConfirmModal({ action: "activate" })}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              上架
            </button>
          )}
          {campaign.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => setConfirmModal({ action: "deactivate" })}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              停售
            </button>
          )}
          {campaign.status === "INACTIVE" && (
            <button
              type="button"
              onClick={() => setConfirmModal({ action: "activate" })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              恢復上架
            </button>
          )}
        </div>
      </div>

      {/* Basic info */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">基本資訊</h2>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              修改
            </button>
          )}
        </div>

        {isEditing ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">活動名稱</label>
                <input
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${
                    isLocked
                      ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "border-slate-300 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  }`}
                  value={editName}
                  onChange={(e) => !isLocked && setEditName(e.target.value)}
                  disabled={isLocked}
                />
                {isLocked && (
                  <p className="mt-1 text-xs text-slate-400">進行中的一番賞名稱不可更改</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">每抽價格</label>
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  {campaign.pricePerDraw} 點
                </div>
              </div>

              {campaign.type === "KUJI" && campaign.drawSessionSeconds && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">抽籤時間</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                    {Math.floor(campaign.drawSessionSeconds / 60)} 分鐘
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">活動描述</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditName(campaign.title);
                  setEditDesc(campaign.description ?? "");
                  setIsEditing(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveBasic}
                disabled={isSaving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? "儲存中..." : "儲存變更"}
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">活動名稱</p>
              <p className="text-sm text-slate-800">{campaign.title}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">每抽價格</p>
              <p className="text-sm text-slate-800">{campaign.pricePerDraw} 點</p>
            </div>
            {campaign.type === "KUJI" && campaign.drawSessionSeconds && (
              <div>
                <p className="text-xs text-slate-500">抽籤時間</p>
                <p className="text-sm text-slate-800">{Math.floor(campaign.drawSessionSeconds / 60)} 分鐘</p>
              </div>
            )}
            {campaign.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">活動描述</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{campaign.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kuji: Ticket boxes preview */}
      {campaign.type === "KUJI" && campaign.boxes && campaign.boxes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">籤盒狀態</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {campaign.boxes.map((box) => {
              const pct = Math.round(((box.totalTickets - box.remainingTickets) / box.totalTickets) * 100);
              return (
                <div key={box.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-700">{box.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {box.remainingTickets}/{box.totalTickets} 剩餘
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prize / reward status */}
      {campaign.prizePool && campaign.prizePool.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">獎賞狀態</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {[
                    "等級",
                    "賞品名稱",
                    ...(campaign.type === "KUJI" ? ["數量", "已抽出", "剩餘"] : ["機率"]),
                    "賞品價值",
                  ].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-slate-500 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaign.prizePool.map((prize) => {
                  const drawnCount = drawRecords.filter((r) => r.grade === prize.grade).length;
                  const total = prize.ticketCount ?? 0;
                  const remaining = total - drawnCount;
                  const pct = total > 0 ? Math.round((drawnCount / total) * 100) : 0;
                  const prob = prize.probabilityBps != null
                    ? (prize.probabilityBps / 100).toFixed(2)
                    : prize.probability != null
                      ? prize.probability.toFixed(2)
                      : "-";

                  return (
                    <tr key={prize.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-4">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-semibold"
                          style={gradeBadgeStyle(prize.grade)}
                        >
                          {prize.grade}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {(prize.photos?.[0] || prize.photoUrl) && (
                            <img
                              src={prize.photos?.[0] || prize.photoUrl}
                              alt={prize.name}
                              className="h-8 w-8 rounded object-cover border border-slate-200 flex-shrink-0"
                            />
                          )}
                          <span className="text-slate-700">{prize.name}</span>
                        </div>
                      </td>
                      {campaign.type === "KUJI" ? (
                        <>
                          <td className="py-2 pr-4 text-slate-600 font-mono text-xs">{total}</td>
                          <td className="py-2 pr-4 text-slate-600 font-mono text-xs">{drawnCount}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs font-semibold ${
                                remaining === 0 ? "text-red-500" : "text-green-600"
                              }`}>
                                {remaining}
                              </span>
                              {total > 0 && (
                                <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      remaining === 0 ? "bg-red-400" : "bg-green-500"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <td className="py-2 pr-4 text-slate-600 text-xs">{prob}%</td>
                      )}
                      <td className="py-2 pr-4 text-slate-600 text-xs">
                        {prize.prizeValue != null ? `${prize.prizeValue} 點` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {campaign.type === "KUJI" && (
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
              <span>
                總獎賞: {campaign.prizePool.reduce((s, p) => s + (p.ticketCount ?? 0), 0)} 件
              </span>
              <span>
                已抽出: {drawRecords.length} 件
              </span>
              <span>
                剩餘: {campaign.prizePool.reduce((s, p) => s + (p.ticketCount ?? 0), 0) - drawRecords.length} 件
              </span>
            </div>
          )}
        </div>
      )}

      {/* Unlimited: Probability table */}
      {campaign.type === "UNLIMITED" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">機率設定</h2>
            {campaign.status === "ACTIVE" && (
              <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                修改將立即生效
              </span>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["等級", "賞品名稱", "機率 %", "市場價值"].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">{h}</th>
                ))}
                {campaign.status === "DRAFT" && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {probRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3">
                    {campaign.status === "DRAFT" ? (
                      <input
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.grade}
                        onChange={(e) => updateProbRow(row.id, "grade", e.target.value)}
                      />
                    ) : (
                      <span className="font-medium text-slate-700">{row.grade}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                      value={row.name}
                      onChange={(e) => updateProbRow(row.id, "name", e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                      value={row.probability}
                      onChange={(e) => updateProbRow(row.id, "probability", parseFloat(e.target.value) || 0)}
                      step="0.01"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={row.prizeValue ?? ""}
                        onChange={(e) => updateProbRow(row.id, "prizeValue", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                        onFocus={(e) => e.target.select()}
                        min={0}
                        placeholder="0"
                      />
                      <span className="text-xs text-slate-400">點</span>
                    </div>
                  </td>
                  {campaign.status === "DRAFT" && (
                    <td className="py-2">
                      {probRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setProbRows((prev) => prev.filter((r) => r.id !== row.id));
                            setProbDirty(true);
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {campaign.status === "DRAFT" && (
            <button
              type="button"
              onClick={() => {
                setProbRows((prev) => [
                  ...prev,
                  { id: Math.random().toString(36).slice(2, 9), grade: "", name: "", probability: 0, prizeValue: 0 },
                ]);
                setProbDirty(true);
              }}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              + 新增等級
            </button>
          )}

          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${Math.abs(totalProb - 100) < 0.01 ? "text-green-600" : "text-red-600"}`}>
              機率總和: {totalProb.toFixed(2)}% {Math.abs(totalProb - 100) < 0.01 ? "✓" : "⚠"}
            </span>
            {probDirty && (
              <button
                type="button"
                onClick={handleSaveProbability}
                disabled={isSaving || Math.abs(totalProb - 100) >= 0.01}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSaving ? "儲存中..." : "儲存機率"}
              </button>
            )}
          </div>

          <MarginDisplay result={unlimitedMargin} />
        </div>
      )}

      {/* Draw records */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">中獎紀錄</h2>
        {drawRecords.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">尚無中獎紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {["位置", "等級", "賞品名稱", "玩家", "中獎時間"].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-slate-500 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drawRecords.map((rec) => (
                  <tr key={rec.ticketId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 pr-4 text-slate-600 font-mono text-xs">#{rec.position}</td>
                    <td className="py-2 pr-4">
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-semibold"
                        style={gradeBadgeStyle(rec.grade)}
                      >
                        {rec.grade}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        {rec.prizePhotoUrl && (
                          <img
                            src={rec.prizePhotoUrl}
                            alt={rec.prizeName}
                            className="h-8 w-8 rounded object-cover border border-slate-200 flex-shrink-0"
                          />
                        )}
                        <span className="text-slate-700">{rec.prizeName}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{rec.playerNickname}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">{timeAgo(rec.drawnAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.action === "activate" ? "確認上架" : "確認停售"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() =>
                handleStatusChange(confirmModal?.action === "activate" ? "ACTIVE" : "INACTIVE")
              }
              disabled={isSaving}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                confirmModal?.action === "activate"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              確認
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {confirmModal?.action === "activate"
              ? `確定要將「${campaign.title}」上架嗎？上架後玩家即可抽獎。`
              : `確定要停售「${campaign.title}」嗎？進行中的抽籤將被中斷。`}
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnChange}
              onChange={(e) => setNotifyOnChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              {confirmModal?.action === "activate"
                ? "同時推播通知玩家"
                : "通知曾參與的玩家"}
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
