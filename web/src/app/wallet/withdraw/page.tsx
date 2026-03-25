"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";

interface WalletDto {
  drawPointsBalance: number;
  revenuePointsBalance: number;
}

/** 1 revenue point = TWD 0.01 (100 points = TWD 1). */
const POINTS_PER_TWD = 100;

/**
 * Withdrawal request form page.
 *
 * Displays the player's current revenue points balance.
 * Collects bank account details and desired withdrawal amount.
 * Shows a TWD equivalent preview.
 * Submits to POST /api/v1/withdrawals.
 */
export default function WithdrawPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<WalletDto>("/api/v1/players/me/wallet")
      .then((w) => setBalance(w.revenuePointsBalance))
      .catch(() => {});
  }, []);

  const parsedAmount = parseInt(amount, 10);
  const twdEquivalent = Number.isFinite(parsedAmount)
    ? (parsedAmount / POINTS_PER_TWD).toFixed(2)
    : "0.00";
  const isValid =
    bankName.trim() &&
    bankCode.trim() &&
    holderName.trim() &&
    accountNumber.trim() &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= balance;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/withdrawals", {
        pointsAmount: parsedAmount,
        bankName: bankName.trim(),
        bankCode: bankCode.trim(),
        accountHolderName: holderName.trim(),
        accountNumber: accountNumber.trim(),
      });
      router.push("/wallet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Back to Wallet
      </button>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Withdraw Revenue Points
      </h1>

      <div className="mb-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
        <p className="text-xs text-zinc-500">Available Balance</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {balance.toLocaleString()} pts
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormField label="Bank Name" value={bankName} onChange={setBankName} type="text" />
        <FormField
          label="Bank Code"
          value={bankCode}
          onChange={setBankCode}
          type="text"
          inputMode="numeric"
        />
        <FormField
          label="Account Holder Name"
          value={holderName}
          onChange={setHolderName}
          type="text"
        />
        <FormField
          label="Account Number"
          value={accountNumber}
          onChange={setAccountNumber}
          type="text"
          inputMode="numeric"
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Amount (pts)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            max={balance}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
          {parsedAmount > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              ≈ TWD {twdEquivalent}
            </p>
          )}
          {parsedAmount > balance && (
            <p className="mt-1 text-xs text-red-600">Exceeds available balance</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {isSubmitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
      />
    </div>
  );
}
