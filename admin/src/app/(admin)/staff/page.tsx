"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

const ROLES = [
  { value: "SUPER_ADMIN", label: "超級管理員" },
  { value: "ADMIN", label: "管理員" },
  { value: "SUPPORT", label: "客服" },
  { value: "FINANCE", label: "財務" },
  { value: "READONLY", label: "唯讀" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  SUPPORT: "bg-blue-100 text-blue-700",
  FINANCE: "bg-green-100 text-green-700",
  READONLY: "bg-slate-100 text-slate-600",
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("SUPPORT");

  useEffect(() => {
    apiClient
      .get<Staff[]>("/api/v1/admin/staff?limit=100")
      .then((data) => { setStaffList(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword) return;
    setIsSubmitting(true);
    try {
      const staff = await apiClient.post<Staff>("/api/v1/admin/staff", {
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
      });
      setStaffList((prev) => [staff, ...prev]);
      setCreateModal(false);
      setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("SUPPORT");
    } catch (err) {
      alert(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await apiClient.patch(`/api/v1/admin/staff/${id}`, { role: newRole });
      setStaffList((prev) => prev.map((s) => s.id === id ? { ...s, role: newRole } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!confirm(`確定要${newStatus === "ACTIVE" ? "啟用" : "停用"}此人員嗎？`)) return;
    try {
      await apiClient.patch(`/api/v1/admin/staff/${id}/status`, { status: newStatus });
      setStaffList((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">人員管理</h1>
          <p className="text-sm text-slate-500">管理後台工作人員帳號</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + 新增人員
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={5} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : staffList.length === 0 ? (
        <EmptyState icon="🔐" title="沒有人員" description="點擊上方按鈕新增第一個人員帳號" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["姓名", "Email", "角色", "狀態", "最後登入", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((staff, idx) => (
                <tr key={staff.id} className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex-shrink-0">
                        {staff.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-800">{staff.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{staff.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={staff.role}
                      onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                      className={`rounded px-2 py-1 text-xs font-medium border-0 outline-none cursor-pointer ${ROLE_COLORS[staff.role] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={staff.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString("zh-TW") : "從未登入"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(staff.id, staff.isActive ? "ACTIVE" : "INACTIVE")}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors border ${
                        staff.isActive ? "ACTIVE" : "INACTIVE" === "ACTIVE"
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {staff.isActive ? "ACTIVE" : "INACTIVE" === "ACTIVE" ? "停用" : "啟用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create staff modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="新增人員"
        footer={
          <>
            <button type="button" onClick={() => setCreateModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleCreate} disabled={!formName || !formEmail || !formPassword || isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {isSubmitting ? "建立中..." : "建立帳號"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">姓名 *</label>
            <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="王小明" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">電子郵件 *</label>
            <input type="email" className={inputCls} value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="staff@prizedraw.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">初始密碼 *</label>
            <input type="password" className={inputCls} value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">角色</label>
            <select className={inputCls} value={formRole} onChange={(e) => setFormRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
