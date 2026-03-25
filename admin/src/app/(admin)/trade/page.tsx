"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface TradeListing {
  id: string;
  sellerName: string;
  playerId: string;
  prizeInstanceId: string;
  prizeName: string;
  prizeGrade: string;
  campaignName: string;
  price: number;
  status: string;
  listedAt: string;
}

interface TradeListResponse {
  listings: TradeListing[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "全部狀態" },
  { value: "ACTIVE", label: "上架中" },
  { value: "SOLD", label: "已售出" },
  { value: "CANCELLED", label: "已下架" },
];

const GRADE_OPTIONS = [
  { value: "", label: "全部等級" },
  { value: "A賞", label: "A賞" },
  { value: "B賞", label: "B賞" },
  { value: "C賞", label: "C賞" },
  { value: "D賞", label: "D賞" },
];

export default function TradePage() {
  const [listings, setListings] = useState<TradeListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [gradeFilter, setGradeFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [delistModal, setDelistModal] = useState<TradeListing | null>(null);
  const [delistReason, setDelistReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchListings = async () => {
    setIsLoading(true);
    let url = "/api/v1/admin/trade/listings?limit=100";
    if (statusFilter) url += `&status=${statusFilter}`;
    if (gradeFilter) url += `&grade=${encodeURIComponent(gradeFilter)}`;
    if (priceMin) url += `&priceMin=${priceMin}`;
    if (priceMax) url += `&priceMax=${priceMax}`;
    try {
      const data = await apiClient.get<TradeListResponse | TradeListing[]>(url);
      if (Array.isArray(data)) setListings(data);
      else setListings(data.listings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, [statusFilter, gradeFilter]);

  const handleDelist = async () => {
    if (!delistModal) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/api/v1/admin/trade/listings/${delistModal.id}/delist`, { reason: delistReason });
      setListings((prev) => prev.map((l) => l.id === delistModal.id ? { ...l, status: "CANCELLED" } : l));
      setDelistModal(null);
      setDelistReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">交易監控</h1>
        <p className="text-sm text-slate-500">監控市集上架商品，處理違規下架</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          {GRADE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="最低價格"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-slate-400">~</span>
          <input
            type="number"
            placeholder="最高價格"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={fetchListings}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            篩選
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={6} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : listings.length === 0 ? (
        <EmptyState icon="💱" title="沒有上架商品" description="市集目前沒有符合條件的商品" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["ID", "賣家", "賞品", "等級", "來源活動", "價格", "狀態", "上架時間", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{item.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{item.sellerName}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{item.prizeName}</td>
                  <td className="px-4 py-3 font-medium text-indigo-600">{item.prizeGrade}</td>
                  <td className="px-4 py-3 text-slate-600">{item.campaignName}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">{item.price.toLocaleString()} 點</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {item.listedAt ? new Date(item.listedAt).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => setDelistModal(item)}
                        className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200"
                      >
                        下架
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!delistModal}
        onClose={() => { setDelistModal(null); setDelistReason(""); }}
        title="強制下架商品"
        footer={
          <>
            <button type="button" onClick={() => { setDelistModal(null); setDelistReason(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleDelist} disabled={isSubmitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {isSubmitting ? "處理中..." : "確認下架"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            下架商品「{delistModal?.prizeName}」（賣家: {delistModal?.sellerName}）
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">下架原因（選填）</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
              placeholder="違規原因..."
              value={delistReason}
              onChange={(e) => setDelistReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
