"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

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
  photoUrl?: string;
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
  const [isSaving, setIsSaving] = useState(false);
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
          .get<DrawRecord[]>(`/api/v1/admin/campaigns/${id}/draw-records?limit=50`)
          .then(setDrawRecords)
          .catch(() => {}); // silently fail if not available yet
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "載入失敗");
        setIsLoading(false);
      });
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setIsSaving(true);
    try {
      await apiClient.patch(`/api/v1/admin/campaigns/${id}/status`, { status: newStatus });
      setCampaign((prev) => prev ? { ...prev, status: newStatus } : prev);
      setConfirmModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // TODO: prize-pool update endpoint is not yet defined in AdminEndpoints.
  // When the server route is added, implement PATCH /api/v1/admin/campaigns/{id}/prize-pool
  // with body { prizePool: [{ grade, name, probability }] }.
  const handleSaveProbability = async () => {
    alert("賞品機率更新功能尚未開放，請聯絡後端工程師新增對應端點。");
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

      {/* Basic info edit */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">基本資訊</h2>

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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveBasic}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? "儲存中..." : "儲存變更"}
          </button>
        </div>
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
                {["等級", "賞品名稱", "機率 %"].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-medium text-slate-500 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {probRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3 text-slate-700 font-medium">{row.grade}</td>
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
                </tr>
              ))}
            </tbody>
          </table>

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
        <p className="text-sm text-slate-600">
          {confirmModal?.action === "activate"
            ? `確定要將「${campaign.title}」上架嗎？上架後玩家即可抽獎。`
            : `確定要停售「${campaign.title}」嗎？進行中的抽籤將被中斷。`}
        </p>
      </Modal>
    </div>
  );
}
