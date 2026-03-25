"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  async function confirmDelivery() {
    if (!order) return;
    setConfirming(true);
    try {
      await apiClient.post(`/api/v1/shipping/orders/${order.id}/confirm-delivery`, { shippingOrderId: order.id });
      setOrder((prev) => prev ? { ...prev, status: "DELIVERED" } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm delivery");
    } finally {
      setConfirming(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600 dark:text-red-400">{error ?? "Order not found"}</p>
        <button type="button" onClick={() => router.back()} className="text-sm underline">Go back</button>
      </div>
    );
  }

  const steps: Step[] = [
    { label: "Order Created", description: "Shipping request received.", done: true },
    {
      label: "Awaiting Shipment",
      description: "Waiting for operator fulfillment.",
      done: order.status !== "PENDING_SHIPMENT",
    },
    {
      label: "Shipped",
      description: order.trackingNumber
        ? `${order.carrier ?? "Carrier"}: ${order.trackingNumber}`
        : "Tracking info not yet available.",
      done: order.status === "SHIPPED" || order.status === "DELIVERED",
    },
    {
      label: "Delivered",
      description: order.deliveredAt
        ? `Delivered on ${new Date(order.deliveredAt).toLocaleDateString()}`
        : "Pending delivery.",
      done: order.status === "DELIVERED",
    },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button type="button" onClick={() => router.back()} className="mb-4 text-sm text-zinc-500 hover:text-zinc-800">
        ← Back
      </button>
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Shipping Tracking</h1>
      <p className="mb-6 font-mono text-xs text-zinc-400">#{order.id}</p>

      <div className="mb-6 flex flex-col gap-4">
        {steps.map((step) => (
          <div key={step.label} className="flex items-start gap-3">
            <span className={`mt-0.5 text-lg ${step.done ? "text-green-500" : "text-zinc-300"}`}>
              {step.done ? "✓" : "○"}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{step.label}</p>
              <p className="text-xs text-zinc-500">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {order.status === "SHIPPED" && (
        <button
          type="button"
          onClick={confirmDelivery}
          disabled={confirming}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {confirming ? "Confirming…" : "Confirm Delivery"}
        </button>
      )}
    </div>
  );
}
