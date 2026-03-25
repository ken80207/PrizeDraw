"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface ShippingOrderDetail {
  id: string;
  playerId: string;
  playerName: string;
  prizeInstanceId: string;
  prizeName: string;
  prizeGrade: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  postalCode: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  notes?: string;
}

const CARRIERS = ["黑貓宅急便", "7-11 交貨便", "全家 好事多", "郵局包裹", "新竹物流", "其他"];

export default function ShippingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ShippingOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fulfillModal, setFulfillModal] = useState(false);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<ShippingOrderDetail>(`/api/v1/admin/shipping/orders/${id}`)
      .then((data) => { setOrder(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "載入失敗"); setIsLoading(false); });
  }, [id]);

  const handleFulfill = async () => {
    if (!trackingNumber) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/api/v1/admin/shipping/orders/${id}/ship`, { carrier, trackingNumber });
      setOrder((prev) => prev ? { ...prev, status: "SHIPPED", carrier, trackingNumber } : prev);
      setFulfillModal(false);
      setTrackingNumber("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={6} columns={2} />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "找不到訂單"}</div>;
  }

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/shipping")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 出貨管理
        </button>
        <h1 className="text-xl font-bold text-slate-900">訂單詳情</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">訂單資訊</h2>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="訂單 ID" value={<span className="font-mono text-xs">{order.id}</span>} />
          <Field label="建立時間" value={order.createdAt ? new Date(order.createdAt).toLocaleString("zh-TW") : "—"} />
          <Field label="賞品" value={`${order.prizeGrade ? order.prizeGrade + " — " : ""}${order.prizeName}`} />
          <Field label="玩家" value={order.playerName} />
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">收件資訊</h2>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="收件人" value={order.recipientName} />
          <Field label="手機" value={order.recipientPhone} />
          <div className="col-span-2">
            <Field label="地址" value={`${order.postalCode ?? ""} ${order.address}`} />
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">物流資訊</h2>
        {order.carrier ? (
          <dl className="grid grid-cols-2 gap-4">
            <Field label="物流公司" value={order.carrier} />
            <Field label="物流單號" value={<span className="font-mono text-xs">{order.trackingNumber}</span>} />
            <Field label="出貨時間" value={order.shippedAt ? new Date(order.shippedAt).toLocaleString("zh-TW") : "—"} />
            <Field label="送達時間" value={order.deliveredAt ? new Date(order.deliveredAt).toLocaleString("zh-TW") : "—"} />
          </dl>
        ) : (
          <p className="text-sm text-slate-400">尚未出貨</p>
        )}
      </div>

      {order.status === "PENDING_SHIPMENT" && (
        <button
          type="button"
          onClick={() => setFulfillModal(true)}
          className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          填寫出貨資訊
        </button>
      )}

      <Modal
        open={fulfillModal}
        onClose={() => { setFulfillModal(false); setTrackingNumber(""); }}
        title="填寫出貨資訊"
        footer={
          <>
            <button type="button" onClick={() => { setFulfillModal(false); setTrackingNumber(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">取消</button>
            <button type="button" onClick={handleFulfill} disabled={!trackingNumber || isSubmitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {isSubmitting ? "送出中..." : "確認出貨"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">物流公司</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">物流單號 *</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="輸入物流單號" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
