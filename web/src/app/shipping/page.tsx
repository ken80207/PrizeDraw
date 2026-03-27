"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

const STATUS_ICON: Record<string, string> = {
  PENDING_SHIPMENT: "schedule",
  SHIPPED: "local_shipping",
  DELIVERED: "check_circle",
  CANCELLED: "cancel",
};

export default function ShippingListPage() {
  const t = useTranslations("shipping");

  const STATUS_LABELS: Record<string, string> = {
    PENDING_SHIPMENT: t("statusPending"),
    SHIPPED: t("statusShipped"),
    DELIVERED: t("statusDelivered"),
    CANCELLED: t("statusCancelled"),
  };

  const [orders, setOrders] = useState<ShippingOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<ShippingOrderDto[]>("/api/v1/shipping/orders")
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : t("loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <ShippingListSkeleton />;

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-error-container/20">
            <span className="text-sm text-on-surface-variant">{error}</span>
            <button onClick={() => window.location.reload()} className="text-xs text-primary font-bold shrink-0">{t("retryBtn")}</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-3xl">
                local_shipping
              </span>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href="/prizes"
            className="flex items-center gap-1.5 text-sm font-label text-primary hover:underline"
          >
            {t("newShipping")}
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                local_shipping
              </span>
            </div>
            <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
              {t("noOrders")}
            </h3>
            <p className="font-body text-sm text-on-surface-variant mb-8">
              {t("noOrdersDesc")}
            </p>
            <Link
              href="/prizes"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-bold font-label shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">trophy</span>
              {t("goToPrizes")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/shipping/${order.id}`}
                  className="group block bg-surface-container rounded-lg p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">
                          {STATUS_ICON[order.status] ?? "local_shipping"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-headline text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                          {order.recipientName}
                        </p>
                        <p className="font-body text-xs text-on-surface-variant mt-0.5 truncate">
                          {order.addressLine1}
                          {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}{" "}
                          {order.postalCode}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={STATUS_LABELS[order.status] ?? order.status} />
                  </div>

                  {order.trackingNumber && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">
                        pin
                      </span>
                      <p className="font-body text-xs text-on-surface-variant">
                        {t("trackingLabel")}
                        <span className="font-mono font-medium text-on-surface">
                          {order.trackingNumber}
                        </span>
                        {order.carrier && (
                          <span className="ml-1 text-on-surface-variant/60">
                            ({order.carrier})
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {order.shippedAt && (
                    <p className="font-body text-xs text-on-surface-variant/60">
                      {t("shippedAt")}{new Date(order.shippedAt).toLocaleString("zh-TW")}
                    </p>
                  )}

                  {order.deliveredAt && (
                    <p className="font-body text-xs text-primary mt-1">
                      {t("deliveredAt")}{new Date(order.deliveredAt).toLocaleString("zh-TW")}
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 bg-surface-dim min-h-screen">
      <Skeleton className="h-8 w-48 mb-8 bg-surface-container" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
