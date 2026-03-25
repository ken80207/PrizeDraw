"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Coupon {
  id: string;
  name: string;
  code?: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  applicableCampaigns: string[];
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  usedCount: number;
  status: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [formDiscountValue, setFormDiscountValue] = useState(10);
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState<number | "">(100);
  const [formGenerateCode, setFormGenerateCode] = useState(true);

  useEffect(() => {
    apiClient
      .get<Coupon[]>("/api/v1/admin/coupons?limit=100")
      .then((data) => { setCoupons(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, []);

  const handleCreate = async () => {
    if (!formName || !formValidFrom || !formValidUntil) return;
    setIsSubmitting(true);
    try {
      const coupon = await apiClient.post<Coupon>("/api/v1/admin/coupons", {
        name: formName,
        discountType: formDiscountType,
        discountValue: formDiscountValue,
        validFrom: formValidFrom,
        validUntil: formValidUntil,
        usageLimit: formUsageLimit || undefined,
        generateCode: formGenerateCode,
      });
      setCoupons((prev) => [coupon, ...prev]);
      setCreateModal(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("確定要停用此優惠券嗎？")) return;
    try {
      await apiClient.patch(`/api/v1/admin/coupons/${id}/deactivate`, {});
      setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, status: "INACTIVE" } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDiscountType("PERCENTAGE");
    setFormDiscountValue(10);
    setFormValidFrom("");
    setFormValidUntil("");
    setFormUsageLimit(100);
    setFormGenerateCode(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">優惠券管理</h1>
          <p className="text-sm text-slate-500">建立與管理折扣碼</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + 建立優惠券
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={7} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : coupons.length === 0 ? (
        <EmptyState icon="🎟" title="沒有優惠券" description="點擊上方按鈕建立第一個優惠券" action={{ label: "建立優惠券", onClick: () => setCreateModal(true) }} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["名稱", "折扣碼", "折扣類型", "折扣值", "有效期限", "使用情況", "狀態", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((coupon, idx) => (
                <tr key={coupon.id} className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{coupon.name}</td>
                  <td className="px-4 py-3">
                    {coupon.code ? (
                      <span className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5">{coupon.code}</span>
                    ) : <span className="text-slate-400">自動套用</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {coupon.discountType === "PERCENTAGE" ? "百分比" : "固定金額"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {coupon.discountType === "PERCENTAGE"
                      ? `${coupon.discountValue}%`
                      : `${coupon.discountValue} 點`}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <div>{new Date(coupon.validFrom).toLocaleDateString("zh-TW")}</div>
                    <div>~ {new Date(coupon.validUntil).toLocaleDateString("zh-TW")}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {coupon.usedCount} / {coupon.usageLimit ?? "∞"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={coupon.status} /></td>
                  <td className="px-4 py-3">
                    {coupon.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(coupon.id)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200"
                      >
                        停用
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createModal}
        onClose={() => { setCreateModal(false); resetForm(); }}
        title="建立優惠券"
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => { setCreateModal(false); resetForm(); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleCreate} disabled={!formName || !formValidFrom || !formValidUntil || isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {isSubmitting ? "建立中..." : "建立"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">優惠券名稱 *</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="春季折扣"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">折扣類型</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formDiscountType}
                onChange={(e) => setFormDiscountType(e.target.value as "PERCENTAGE" | "FIXED")}
              >
                <option value="PERCENTAGE">百分比折扣</option>
                <option value="FIXED">固定點數折扣</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                折扣值 {formDiscountType === "PERCENTAGE" ? "（%）" : "（點）"}
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formDiscountValue}
                onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                min={1}
                max={formDiscountType === "PERCENTAGE" ? 100 : undefined}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">開始日期 *</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formValidFrom}
                onChange={(e) => setFormValidFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">結束日期 *</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formValidUntil}
                onChange={(e) => setFormValidUntil(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">使用上限（留空無限制）</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={formUsageLimit}
                onChange={(e) => setFormUsageLimit(e.target.value ? Number(e.target.value) : "")}
                min={1}
                placeholder="不限"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormGenerateCode(!formGenerateCode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formGenerateCode ? "bg-indigo-600" : "bg-slate-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formGenerateCode ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <label className="text-sm text-slate-700">自動生成折扣碼</label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
