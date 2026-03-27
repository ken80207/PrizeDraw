"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tw = useTranslations("wallet");
  const tc = useTranslations("common");

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
      setError(err instanceof Error ? err.message : tw("loadFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-md mx-auto px-4 py-8">

        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-8 text-sm text-on-surface-variant hover:text-primary transition-colors group"
        >
          <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">
            arrow_back
          </span>
          {tw("backToWallet")}
        </button>

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
          <div>
            <h1 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
              {tw("withdrawTitle")}
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">{tw("withdrawSubtitle")}</p>
          </div>
        </div>

        {/* Balance card */}
        <div className="bg-surface-container rounded-2xl p-5 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/10 rounded-bl-full -mr-8 -mt-8 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-secondary text-sm">payments</span>
              <p className="text-xs font-bold text-secondary uppercase tracking-widest">{tw("availableBalance")}</p>
            </div>
            <p className="font-headline font-extrabold text-4xl text-on-surface tabular-nums">
              {balance.toLocaleString()}
              <span className="text-base text-on-surface-variant font-normal ml-2">{tc("pts")}</span>
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5">

          {/* Bank details section */}
          <div className="bg-surface-container rounded-2xl p-5 space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">credit_card</span>
              {tw("bankInfo")}
            </h3>
            <DarkFormField label={tw("bankName")} value={bankName} onChange={setBankName} type="text" />
            <DarkFormField
              label={tw("bankCode")}
              value={bankCode}
              onChange={setBankCode}
              type="text"
              inputMode="numeric"
            />
            <DarkFormField
              label={tw("accountHolder")}
              value={holderName}
              onChange={setHolderName}
              type="text"
            />
            <DarkFormField
              label={tw("accountNumber")}
              value={accountNumber}
              onChange={setAccountNumber}
              type="text"
              inputMode="numeric"
            />
          </div>

          {/* Amount section */}
          <div className="bg-surface-container rounded-2xl p-5 space-y-4">
            <h3 className="font-headline font-bold text-sm text-on-surface uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary">toll</span>
              {tw("withdrawAmount")}
            </h3>
            <div>
              <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-widest">
                {tw("pointsAmount")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={balance}
                  placeholder={tw("enterAmount")}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-headline font-bold text-lg"
                  style={{ border: "none" }}
                />
                <span className="absolute right-4 top-3.5 text-on-surface-variant font-bold text-sm">
                  {tc("pts").toUpperCase()}
                </span>
              </div>
              {parsedAmount > 0 && (
                <div className="mt-3 space-y-2 px-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{tw("twdEquivalent")}</span>
                    <span className="text-on-surface font-medium">NT$ {twdEquivalent}</span>
                  </div>
                  <div className="h-px bg-surface-container-highest" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-on-surface text-sm">{tw("actualDeposit")}</span>
                    <span className="font-headline font-extrabold text-primary">
                      NT$ {twdEquivalent}
                    </span>
                  </div>
                </div>
              )}
              {parsedAmount > balance && (
                <p className="mt-2 text-xs text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  {tw("exceedsBalance")}
                </p>
              )}
            </div>
            <p className="text-[10px] text-center text-on-surface-variant leading-relaxed">
              {tw("processingTime")}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-error-container/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-sm">error</span>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3.5 rounded-full text-sm font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3.5 rounded-full text-sm font-bold text-on-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed amber-gradient shadow-lg"
            >
              {isSubmitting ? tw("processing") : tw("submitWithdrawal")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DarkFormField({
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
      <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        style={{ border: "none" }}
      />
    </div>
  );
}
