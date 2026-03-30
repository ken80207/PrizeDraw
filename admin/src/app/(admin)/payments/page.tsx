"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface PaymentOrder {
  id: string;
  playerId: string;
  playerName: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayTransactionId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
}

interface PaymentListResponse {
  orders: PaymentOrder[];
  total: number;
}

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待付款" },
  { value: "PAID", label: "已付款" },
  { value: "FAILED", label: "失敗" },
  { value: "REFUNDED", label: "已退款" },
];

const GATEWAY_LABELS: Record<string, string> = {
  STRIPE: "Stripe",
  LINE_PAY: "LINE Pay",
  JKOPAY: "街口支付",
  CREDIT_CARD: "信用卡",
};

export default function PaymentsPage() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [tabStatus, setTabStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    const url =
      tabStatus === "ALL"
        ? "/api/v1/admin/payments?limit=100"
        : `/api/v1/admin/payments?status=${tabStatus}&limit=100`;
    apiClient
      .get<PaymentListResponse | PaymentOrder[]>(url)
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
          setTotal(data.length);
        } else {
          const list = (data as Record<string, unknown>).items ?? (data as Record<string, unknown>).orders ?? [];
          setOrders(list as PaymentOrder[]);
          setTotal((data as Record<string, unknown>).total as number ?? (list as PaymentOrder[]).length);
        }
        setError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "載入失敗");
        setIsLoading(false);
      });
  }, [tabStatus]);

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const totalPaid = paidOrders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">金流紀錄</h1>
        <p className="text-sm text-slate-500">查看所有付款訂單</p>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">本頁訂單數</p>
            <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">已付款金額</p>
            <p className="text-2xl font-bold text-green-700">${totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">成功率</p>
            <p className="text-2xl font-bold text-slate-900">
              {orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabStatus(t.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tabStatus === t.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <LoadingSkeleton rows={5} columns={7} />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon="💳" title="沒有付款紀錄" description="此狀態下沒有付款訂單" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["訂單 ID", "玩家", "金額", "支付方式", "交易 ID", "說明", "狀態", "建立日期"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order, idx) => (
                <tr
                  key={order.id}
                  className={`${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"} hover:bg-indigo-50/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{order.playerName}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">
                    ${order.amount.toLocaleString()}
                    <span className="ml-1 text-xs text-slate-400">{order.currency}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {GATEWAY_LABELS[order.gateway] ?? order.gateway}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {order.gatewayTransactionId ? order.gatewayTransactionId.slice(0, 16) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-32 truncate text-xs" title={order.description}>
                    {order.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString("zh-TW") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
