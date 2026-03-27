"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("shipping");
  const tCommon = useTranslations("common");
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
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

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

        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-3xl">home</span>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {t("addressTitle")}
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-error/10">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
              error_outline
            </span>
            <p className="font-body text-sm text-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField
            label={t("recipientName")}
            name="recipientName"
            value={form.recipientName}
            onChange={handleChange}
            required
            icon="person"
          />
          <FormField
            label={t("phoneNumber")}
            name="recipientPhone"
            value={form.recipientPhone}
            onChange={handleChange}
            required
            icon="call"
          />
          <FormField
            label={t("addressLine1")}
            name="addressLine1"
            value={form.addressLine1}
            onChange={handleChange}
            required
            icon="location_on"
          />
          <FormField
            label={t("addressLine2")}
            name="addressLine2"
            value={form.addressLine2}
            onChange={handleChange}
            icon="add_location"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("city")}
              name="city"
              value={form.city}
              onChange={handleChange}
              required
              icon="location_city"
            />
            <FormField
              label={t("postalCode")}
              name="postalCode"
              value={form.postalCode}
              onChange={handleChange}
              required
              icon="markunread_mailbox"
            />
          </div>
          <FormField
            label={t("countryCodeHint")}
            name="countryCode"
            value={form.countryCode}
            onChange={handleChange}
            required
            maxLength={2}
            icon="public"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">local_shipping</span>
            {isSubmitting ? t("submitting") : t("requestShipping")}
          </button>
        </form>
      </div>
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
  icon,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  maxLength?: number;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-lg pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          maxLength={maxLength}
          className={`w-full rounded-xl bg-surface-container-lowest ${icon ? "pl-12" : "pl-4"} pr-4 py-3 text-sm text-on-surface font-body placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
        />
      </div>
    </div>
  );
}
