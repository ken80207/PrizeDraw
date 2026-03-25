"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface ShippingOrder {
  id: string;
  playerId: string;
  playerNickname: string;
  playerPhone: string;
  prizeInstanceId: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  createdAt: string;
}

interface StatusTabConfig {
  value: string;
  label: string;
  badge?: number;
}

const STATUS_TABS: StatusTabConfig[] = [
  { value: "PENDING_SHIPMENT", label: "待出貨" },
  { value: "SHIPPED", label: "已出貨" },
  { value: "DELIVERED", label: "已送達" },
  { value: "ALL", label: "全部" },
];

const CARRIERS = ["黑貓宅急便", "7-11 交貨便", "全家 好事多", "郵局包裹", "新竹物流", "其他"];

export default function ShippingPage() {
  const [orders, setOrders] = useState<ShippingOrder[]>([]);
  const [tabStatus, setTabStatus] = useState("PENDING_SHIPMENT");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fulfillModal, setFulfillModal] = useState<ShippingOrder | null>(null);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchOrders = async (status: string) => {
    setIsLoading(true);
    const url =
      status === "ALL"
        ? "/api/v1/admin/shipping/orders?limit=100"
        : `/api/v1/admin/shipping/orders?status=${status}&limit=100`;
    try {
      const data = await apiClient.get<ShippingOrder[]>(url);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(tabStatus);
  }, [tabStatus]);

  const handleFulfill = async () => {
    if (!fulfillModal || !trackingNumber) return;
    setIsSubmitting(true);
    try {
      // TODO: confirm correct AdminEndpoint for ship action once added to api-contracts.
      // Using /api/v1/admin/shipping/orders/{id}/ship with UpdateShippingRequest { trackingNumber, carrier }.
      await apiClient.patch(`/api/v1/admin/shipping/orders/${fulfillModal.id}/ship`, {
        trackingNumber,
        carrier,
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === fulfillModal.id
            ? { ...o, status: "SHIPPED", carrier, trackingNumber }
            : o,
        ),
      );
      setFulfillModal(null);
      setTrackingNumber("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === "PENDING_SHIPMENT").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">出貨管理</h1>
        <p className="text-sm text-slate-500">管理賞品寄送訂單</p>
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
            {t.value === "PENDING_SHIPMENT" && pendingCount > 0 && tabStatus !== "PENDING_SHIPMENT" && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={6} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title="沒有訂單" description="此狀態下沒有出貨訂單" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["訂單", "玩家", "賞品", "收件人", "地址", "建立日期", "狀態", "操作"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order, idx) => (
                <tr
                  key={order.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    <Link href={`/shipping/${order.id}`} className="hover:text-indigo-600 hover:underline">
                      #{order.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.playerNickname}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{order.prizeInstanceId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-700">{order.recipientName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-32 truncate" title={`${order.addressLine1}, ${order.city}`}>
                    {order.addressLine1}, {order.city}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                    {order.trackingNumber && (
                      <div className="mt-1 text-xs text-slate-400">
                        {order.carrier}: {order.trackingNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/shipping/${order.id}`}
                        className="rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                      >
                        詳情
                      </Link>
                      {order.status === "PENDING_SHIPMENT" && (
                        <button
                          type="button"
                          onClick={() => setFulfillModal(order)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200"
                        >
                          出貨
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fulfill modal */}
      <Modal
        open={!!fulfillModal}
        onClose={() => { setFulfillModal(null); setTrackingNumber(""); }}
        title="填寫出貨資訊"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setFulfillModal(null); setTrackingNumber(""); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleFulfill}
              disabled={!trackingNumber || isSubmitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "送出中..." : "確認出貨"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-3">
              訂單 #{fulfillModal?.id.slice(0, 8)} — {fulfillModal?.recipientName}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">物流公司</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">物流單號 *</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="輸入物流單號"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
