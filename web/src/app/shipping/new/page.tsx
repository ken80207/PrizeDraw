"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/services/apiClient";

interface CreateShippingOrderRequest {
  prizeInstanceId: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

interface ShippingOrderDto {
  id: string;
}

/**
 * Shipping address form page.
 *
 * Accepts a prizeId query param (pre-filled from prize detail page).
 * On submit calls POST /api/v1/shipping/orders and redirects to the tracking page.
 */
export default function NewShippingPage() {
  return (
    <Suspense>
      <NewShippingContent />
    </Suspense>
  );
}

function NewShippingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prizeId = searchParams.get("prizeId") ?? "";

  const [form, setForm] = useState({
    recipientName: "",
    recipientPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    countryCode: "TW",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const body: CreateShippingOrderRequest = {
        prizeInstanceId: prizeId,
        recipientName: form.recipientName,
        recipientPhone: form.recipientPhone,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        city: form.city,
        postalCode: form.postalCode,
        countryCode: form.countryCode.toUpperCase().slice(0, 2),
      };
      const order = await apiClient.post<ShippingOrderDto>("/api/v1/shipping/orders", body);
      router.push(`/shipping/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shipping order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button type="button" onClick={() => router.back()} className="mb-4 text-sm text-zinc-500 hover:text-zinc-800">
        ← Back
      </button>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Shipping Address</h1>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Recipient Name" name="recipientName" value={form.recipientName} onChange={handleChange} required />
        <FormField label="Phone Number" name="recipientPhone" value={form.recipientPhone} onChange={handleChange} required />
        <FormField label="Address Line 1" name="addressLine1" value={form.addressLine1} onChange={handleChange} required />
        <FormField label="Address Line 2 (optional)" name="addressLine2" value={form.addressLine2} onChange={handleChange} />
        <FormField label="City" name="city" value={form.city} onChange={handleChange} required />
        <FormField label="Postal Code" name="postalCode" value={form.postalCode} onChange={handleChange} required />
        <FormField label="Country Code (e.g. TW)" name="countryCode" value={form.countryCode} onChange={handleChange} required maxLength={2} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-11 items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {isSubmitting ? "Submitting…" : "Request Shipping"}
        </button>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
      />
    </div>
  );
}
