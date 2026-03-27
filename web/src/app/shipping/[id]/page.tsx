"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";

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

type Step = { label: string; description: string; done: boolean };

/**
 * Shipping order tracking page.
 *
 * Fetches GET /api/v1/shipping/orders/{orderId} on mount.
 * Renders a timeline: PENDING_SHIPMENT → SHIPPED → DELIVERED.
 * Shows "Confirm Delivery" button when order is SHIPPED.
 */
export default function ShippingTrackingPage() {
  const t = useTranslations("shipping");
  const tCommon = useTranslations("common");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ShippingOrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    apiClient
      .get<ShippingOrderDto>(`/api/v1/shipping/orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : t("loadError")))
      .finally(() => setIsLoading(false));
  }, [params.id, t]);

  async function confirmDelivery() {
    if (!order) return;
    setConfirming(true);
    try {
      await apiClient.post(`/api/v1/shipping/orders/${order.id}/confirm-delivery`, { shippingOrderId: order.id });
      setOrder((prev) => prev ? { ...prev, status: "DELIVERED" } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setConfirming(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-dim">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-container-highest border-t-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-dim">
        <span className="material-symbols-outlined text-5xl text-error">error_outline</span>
        <p className="text-error font-body">{error ?? t("orderNotFound")}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="font-label text-sm text-on-surface-variant hover:text-on-surface underline"
        >
          {tCommon("goBack")}
        </button>
      </div>
    );
  }

  const steps: Step[] = [
    {
      label: t("stepOrderCreated"),
      description: t("stepOrderCreatedDesc"),
      done: true,
    },
    {
      label: t("stepAwaiting"),
      description: t("stepAwaitingDesc"),
      done: order.status !== "PENDING_SHIPMENT",
    },
    {
      label: t("stepShipped"),
      description: order.trackingNumber
        ? `${order.carrier ?? t("carrier")}: ${order.trackingNumber}`
        : t("stepShippedNoTracking"),
      done: order.status === "SHIPPED" || order.status === "DELIVERED",
    },
    {
      label: t("stepDelivered"),
      description: order.deliveredAt
        ? t("stepDeliveredOn", { date: new Date(order.deliveredAt).toLocaleDateString() })
        : t("stepDeliveredDesc"),
      done: order.status === "DELIVERED",
    },
  ];

  const STEP_ICONS = ["receipt_long", "inventory_2", "local_shipping", "where_to_vote"];

  return (
    <div className="min-h-screen bg-surface-dim">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-label text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {tCommon("back")}
        </button>

        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {t("shippingTitle")}
          </h1>
        </div>
        <p className="font-mono text-xs text-on-surface-variant/50 mb-8">#{order.id}</p>

        {/* Tracking timeline */}
        <div className="bg-surface-container rounded-lg p-6 mb-6 space-y-0">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex items-start gap-4">
              {/* Step indicator + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    step.done
                      ? "bg-gradient-to-br from-primary to-primary-container shadow-md shadow-primary/20"
                      : "bg-surface-container-high"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-lg ${
                      step.done ? "text-on-primary" : "text-on-surface-variant/40"
                    }`}
                  >
                    {step.done ? "check" : STEP_ICONS[idx]}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-1 ${
                      steps[idx + 1].done ? "bg-primary/40" : "bg-surface-container-highest"
                    }`}
                  />
                )}
              </div>

              {/* Step text */}
              <div className={`pb-8 ${idx === steps.length - 1 ? "pb-0" : ""}`}>
                <p
                  className={`font-headline text-sm font-bold mb-0.5 ${
                    step.done ? "text-on-surface" : "text-on-surface-variant/50"
                  }`}
                >
                  {step.label}
                </p>
                <p className="font-body text-xs text-on-surface-variant/60">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-error/10">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
              error_outline
            </span>
            <p className="font-body text-sm text-error">{error}</p>
          </div>
        )}

        {/* Confirm delivery button */}
        {order.status === "SHIPPED" && (
          <button
            type="button"
            onClick={confirmDelivery}
            disabled={confirming}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">where_to_vote</span>
            {confirming ? t("confirming") : t("confirmDelivery")}
          </button>
        )}
      </div>
    </div>
  );
}
