"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Withdrawal {
  id: string;
  playerId: string;
  playerNickname: string;
  fiatAmount: number;
  bankName: string;
  accountNumberMasked: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
}

const STATUS_TABS = [
  { value: "PENDING_REVIEW", label: "待審核" },
  { value: "APPROVED", label: "已核准" },
  { value: "TRANSFERRED", label: "已轉帳" },
  { value: "REJECTED", label: "已拒絕" },
  { value: "ALL", label: "全部" },
];

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [tabStatus, setTabStatus] = useState("PENDING_REVIEW");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Withdrawal | null>(null);
  const [approveModal, setApproveModal] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWithdrawals = async (status: string) => {
    setIsLoading(true);
    const url =
      status === "ALL"
        ? "/api/v1/admin/withdrawals?limit=100"
        : `/api/v1/admin/withdrawals?status=${status}&limit=100`;
    try {
      const data = await apiClient.get<Withdrawal[]>(url);
      setWithdrawals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWithdrawals(tabStatus); }, [tabStatus]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/api/v1/admin/withdrawals/${approveModal.id}/approve`, {});
      setWithdrawals((prev) =>
        prev.map((w) => w.id === approveModal.id ? { ...w, status: "APPROVED" } : w),
      );
      setApproveModal(null);
      setTransferRef("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/api/v1/admin/withdrawals/${rejectModal.id}/reject`, { reason: rejectReason });
      setWithdrawals((prev) =>
        prev.map((w) => w.id === rejectModal.id ? { ...w, status: "REJECTED", rejectReason } : w),
      );
      setRejectModal(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = withdrawals.filter((w) => w.status === "PENDING_REVIEW").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">提領審核</h1>
        <p className="text-sm text-slate-500">審核玩家現金提領申請</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabStatus(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tabStatus === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.value === "PENDING_REVIEW" && pendingCount > 0 && tabStatus !== "PENDING_REVIEW" && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={6} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : withdrawals.length === 0 ? (
        <EmptyState icon="💰" title="沒有提領申請" description="此狀態下沒有提領申請" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["ID", "玩家", "金額", "銀行", "帳號", "申請日期", "狀態", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withdrawals.map((w, idx) => (
                <tr
                  key={w.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{w.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{w.playerNickname}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 tabular-nums">
                    ${w.fiatAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{w.bankName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{w.accountNumberMasked}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {w.createdAt ? new Date(w.createdAt).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-3">
                    {w.status === "PENDING_REVIEW" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setApproveModal(w)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200"
                        >
                          核准
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectModal(w)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200"
                        >
                          拒絕
                        </button>
                      </div>
                    )}
                    {w.rejectionReason && (
                      <p className="text-xs text-slate-400 mt-1 max-w-32 truncate" title={w.rejectionReason}>
                        理由: {w.rejectionReason}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve modal */}
      <Modal
        open={!!approveModal}
        onClose={() => { setApproveModal(null); setTransferRef(""); }}
        title="確認核准提領"
        footer={
          <>
            <button type="button" onClick={() => { setApproveModal(null); setTransferRef(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleApprove} disabled={isSubmitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {isSubmitting ? "處理中..." : "確認核准"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            核准 <strong>{approveModal?.playerNickname}</strong> 的提領申請，金額 <strong>${approveModal?.fiatAmount.toLocaleString()}</strong>。
          </p>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(""); }}
        title="確認拒絕提領"
        footer={
          <>
            <button type="button" onClick={() => { setRejectModal(null); setRejectReason(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleReject} disabled={!rejectReason || isSubmitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {isSubmitting ? "處理中..." : "確認拒絕"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            拒絕 <strong>{rejectModal?.playerNickname}</strong> 的提領申請，點數將退回帳戶。
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">拒絕原因 *</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
              placeholder="請填寫拒絕原因..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
