"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/LoadingSkeleton";

interface ShippingOrderDto {
  id: string;
  prizeInstanceId: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  countryCode: string;
  trackingNumber: string | null;
  carrier: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

const STATUS_ZH: Record<string, string> = {
  PENDING_SHIPMENT: "待寄送",
  SHIPPED: "已寄出",
  DELIVERED: "已送達",
  CANCELLED: "已取消",
};

export default function ShippingListPage() {
  const [orders, setOrders] = useState<ShippingOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<ShippingOrderDto[]>("/api/v1/shipping/orders")
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : "無法載入寄送訂單"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShippingListSkeleton />;

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">我的寄送訂單</h1>
          <Link
            href="/prizes"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            申請新寄送
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400 mb-4">目前沒有寄送訂單</p>
            <Link
              href="/prizes"
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              前往賞品庫
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/shipping/${order.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {order.recipientName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {order.addressLine1}
                        {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}{" "}
                        {order.postalCode}
                      </p>
                    </div>
                    <StatusBadge status={STATUS_ZH[order.status] ?? order.status} />
                  </div>

                  {order.trackingNumber && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      追蹤號碼：
                      <span className="font-mono font-medium">{order.trackingNumber}</span>
                      {order.carrier && (
                        <span className="ml-1 text-gray-400 dark:text-gray-500">
                          ({order.carrier})
                        </span>
                      )}
                    </p>
                  )}

                  {order.shippedAt && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      寄出時間：{new Date(order.shippedAt).toLocaleString("zh-TW")}
                    </p>
                  )}

                  {order.deliveredAt && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      送達時間：{new Date(order.deliveredAt).toLocaleString("zh-TW")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShippingListSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
