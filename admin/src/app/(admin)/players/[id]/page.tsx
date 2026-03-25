"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Player {
  id: string;
  nickname: string;
  phone: string;
  email?: string;
  consumePoints: number;
  revenuePoints: number;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface Transaction {
  id: string;
  type: string;
  pointType: "CONSUME" | "REVENUE";
  description: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

interface DrawRecord {
  id: string;
  campaignName: string;
  campaignType: string;
  prizeName: string;
  prizeGrade: string;
  cost: number;
  createdAt: string;
}

interface PrizeInstance {
  id: string;
  prizeName: string;
  prizeGrade: string;
  campaignName: string;
  status: string;
  acquiredAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  description: string;
  staffName: string;
  createdAt: string;
}

type TabType = "profile" | "transactions" | "draws" | "prizes" | "audit";

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>("profile");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [prizes, setPrizes] = useState<PrizeInstance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [freezeModal, setFreezeModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustPointType, setAdjustPointType] = useState<"CONSUME" | "REVENUE">("CONSUME");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<Player>(`/api/v1/admin/players/${id}`)
      .then((data) => { setPlayer(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, [id]);

  const loadTab = async (t: TabType) => {
    setTab(t);
    try {
      if (t === "transactions" && transactions.length === 0) {
        const data = await apiClient.get<Transaction[]>(`/api/v1/admin/players/${id}/transactions?limit=50`);
        setTransactions(data);
      } else if (t === "draws" && draws.length === 0) {
        const data = await apiClient.get<DrawRecord[]>(`/api/v1/admin/players/${id}/draws?limit=50`);
        setDraws(data);
      } else if (t === "prizes" && prizes.length === 0) {
        const data = await apiClient.get<PrizeInstance[]>(`/api/v1/admin/players/${id}/prizes?limit=50`);
        setPrizes(data);
      } else if (t === "audit" && auditLogs.length === 0) {
        const data = await apiClient.get<AuditLog[]>(`/api/v1/admin/players/${id}/audit?limit=50`);
        setAuditLogs(data);
      }
    } catch {
      // ignore tab load errors
    }
  };

  const handleFreezeToggle = async () => {
    if (!player) return;
    setIsSubmitting(true);
    const newStatus = player.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await apiClient.patch(`/api/v1/admin/players/${id}/status`, { status: newStatus });
      setPlayer((prev) => prev ? { ...prev, status: newStatus } : prev);
      setFreezeModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!adjustReason || adjustAmount === 0) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/v1/admin/players/${id}/points`, {
        pointType: adjustPointType,
        amount: adjustAmount,
        reason: adjustReason,
      });
      const delta = adjustAmount;
      setPlayer((prev) => {
        if (!prev) return prev;
        return adjustPointType === "CONSUME"
          ? { ...prev, consumePoints: prev.consumePoints + delta }
          : { ...prev, revenuePoints: prev.revenuePoints + delta };
      });
      setAdjustModal(false);
      setAdjustAmount(0);
      setAdjustReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "調整失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={3} />
        </div>
      </div>
    );
  }

  if (error || !player) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "找不到玩家"}</div>;
  }

  const TABS: { value: TabType; label: string }[] = [
    { value: "profile", label: "基本資料" },
    { value: "transactions", label: "交易紀錄" },
    { value: "draws", label: "抽獎紀錄" },
    { value: "prizes", label: "賞品庫" },
    { value: "audit", label: "操作紀錄" },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button type="button" onClick={() => router.push("/players")} className="text-sm text-slate-500 hover:text-slate-700 mb-1 block">
            ← 玩家管理
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-lg font-bold">
              {player.nickname.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{player.nickname}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={player.status} />
                <span className="text-xs text-slate-500">{player.phone}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFreezeModal(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              player.status === "ACTIVE"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {player.status === "ACTIVE" ? "凍結帳戶" : "解凍帳戶"}
          </button>
          <button
            type="button"
            onClick={() => setAdjustModal(true)}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            調整點數
          </button>
        </div>
      </div>

      {/* Point cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">消費點數</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{player.consumePoints.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">用於抽獎/購買</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">收益點數</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{player.revenuePoints.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">可提領現金</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => loadTab(t.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {tab === "profile" && (
          <div className="p-6">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "玩家 ID", value: <span className="font-mono text-xs">{player.id}</span> },
                { label: "暱稱", value: player.nickname },
                { label: "手機", value: player.phone },
                { label: "Email", value: player.email ?? "—" },
                { label: "狀態", value: <StatusBadge status={player.status} /> },
                { label: "加入日期", value: player.createdAt ? new Date(player.createdAt).toLocaleString("zh-TW") : "—" },
                { label: "最後登入", value: player.lastLoginAt ? new Date(player.lastLoginAt).toLocaleString("zh-TW") : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {tab === "transactions" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["時間", "說明", "點數類型", "金額", "餘額後"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">沒有交易紀錄</td></tr>
                ) : transactions.map((tx, idx) => (
                  <tr key={tx.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleString("zh-TW")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{tx.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${tx.pointType === "CONSUME" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
                        {tx.pointType === "CONSUME" ? "消費" : "收益"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{tx.balanceAfter.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "draws" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["時間", "活動", "類型", "賞品", "等級", "花費"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draws.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">沒有抽獎紀錄</td></tr>
                ) : draws.map((d, idx) => (
                  <tr key={d.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(d.createdAt).toLocaleString("zh-TW")}</td>
                    <td className="px-4 py-3 text-slate-700">{d.campaignName}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.campaignType} label={d.campaignType === "KUJI" ? "一番賞" : "無限賞"} /></td>
                    <td className="px-4 py-3 text-slate-700">{d.prizeName}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{d.prizeGrade}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">-{d.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "prizes" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["賞品", "等級", "來源活動", "狀態", "取得時間"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prizes.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">沒有賞品</td></tr>
                ) : prizes.map((p, idx) => (
                  <tr key={p.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.prizeName}</td>
                    <td className="px-4 py-3 font-medium text-indigo-600">{p.prizeGrade}</td>
                    <td className="px-4 py-3 text-slate-600">{p.campaignName}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.acquiredAt).toLocaleDateString("zh-TW")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "audit" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["時間", "操作", "說明", "執行人員"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">沒有操作紀錄</td></tr>
                ) : auditLogs.map((log, idx) => (
                  <tr key={log.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("zh-TW")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.action}</td>
                    <td className="px-4 py-3 text-slate-700">{log.description}</td>
                    <td className="px-4 py-3 text-slate-600">{log.staffName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Freeze modal */}
      <Modal
        open={freezeModal}
        onClose={() => setFreezeModal(false)}
        title={player.status === "ACTIVE" ? "凍結帳戶" : "解凍帳戶"}
        footer={
          <>
            <button type="button" onClick={() => setFreezeModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleFreezeToggle} disabled={isSubmitting} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${player.status === "ACTIVE" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
              {isSubmitting ? "處理中..." : player.status === "ACTIVE" ? "確認凍結" : "確認解凍"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {player.status === "ACTIVE"
            ? `確定要凍結「${player.nickname}」的帳戶嗎？凍結後玩家將無法登入。`
            : `確定要解凍「${player.nickname}」的帳戶嗎？`}
        </p>
      </Modal>

      {/* Adjust modal */}
      <Modal
        open={adjustModal}
        onClose={() => { setAdjustModal(false); setAdjustAmount(0); setAdjustReason(""); }}
        title="調整點數"
        footer={
          <>
            <button type="button" onClick={() => { setAdjustModal(false); setAdjustAmount(0); setAdjustReason(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleAdjustPoints} disabled={!adjustReason || adjustAmount === 0 || isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {isSubmitting ? "調整中..." : "確認調整"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">點數類型</label>
            <div className="flex gap-3">
              {(["CONSUME", "REVENUE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAdjustPointType(t)}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium ${
                    adjustPointType === t
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {t === "CONSUME" ? "消費點數" : "收益點數"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">調整金額（正數增加，負數減少）</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">調整原因 *</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="填寫調整原因"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
