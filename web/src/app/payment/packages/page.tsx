"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiClient } from "@/services/apiClient";

// ── Package definitions ──────────────────────────────────────────────────────

interface Package {
  id: string;
  icon: string;
  iconFill: boolean;
  points: number;
  bonus: number;
  price: number;
  popular?: boolean;
}

const PACKAGES: Package[] = [
  { id: "starter", icon: "token", iconFill: false, points: 1000, bonus: 0, price: 9.99 },
  { id: "elite", icon: "diamond", iconFill: true, points: 5000, bonus: 500, price: 49.99, popular: true },
  { id: "legend", icon: "crown", iconFill: false, points: 12000, bonus: 2000, price: 99.99 },
];

type PaymentMethodId = "line_pay" | "apple_pay" | "google_pay" | "jko_pay" | "credit_card";

interface PaymentMethod {
  id: PaymentMethodId;
  icon: string;
  iconFill: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "line_pay", icon: "wallet", iconFill: false },
  { id: "apple_pay", icon: "ios", iconFill: true },
  { id: "google_pay", icon: "google", iconFill: true },
  { id: "jko_pay", icon: "account_balance", iconFill: false },
  { id: "credit_card", icon: "credit_card", iconFill: false },
];

const TAX_RATE = 0.05;

// ── Component ────────────────────────────────────────────────────────────────

export default function RechargePackagesPage() {
  const t = useTranslations("recharge");
  const tc = useTranslations("common");
  const router = useRouter();

  const PACKAGE_NAMES: Record<string, { name: string; desc: string }> = {
    starter: { name: t("starterName"), desc: t("starterDesc") },
    elite: { name: t("eliteName"), desc: t("eliteDesc") },
    legend: { name: t("legendName"), desc: t("legendDesc") },
  };

  const METHOD_LABELS: Record<PaymentMethodId, string> = {
    line_pay: t("linePay"),
    apple_pay: t("applePay"),
    google_pay: t("googlePay"),
    jko_pay: t("jkoPay"),
    credit_card: t("creditCard"),
  };

  const [selectedPkg, setSelectedPkg] = useState<string>("elite");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("apple_pay");
  const [balance, setBalance] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load current balance
  useEffect(() => {
    apiClient
      .get<{ drawPointsBalance: number }>("/api/v1/players/me/wallet")
      .then((data) => setBalance(data.drawPointsBalance ?? 0))
      .catch(() => {});
  }, []);

  const pkg = PACKAGES.find((p) => p.id === selectedPkg)!;
  const subtotal = pkg.price;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      const totalPoints = pkg.points + pkg.bonus;
      await apiClient.post("/api/v1/payment/mock-topup", {
        points: totalPoints,
      });
      router.push("/wallet");
    } catch (err) {
      alert(err instanceof Error ? err.message : "儲值失敗，請稍後再試");
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        {t("back")}
      </button>

      {/* ── Hero: Balance + Steps ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12 lg:mb-16 items-end">
        <div className="lg:col-span-7">
          <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface mb-4 tracking-tighter">
            {t("heroTitle").replace(t("heroTitleHighlight"), "")}
            <span className="text-primary italic">{t("heroTitleHighlight")}</span>
          </h1>
          <p className="text-on-surface-variant max-w-lg mb-8 lg:mb-10 text-sm sm:text-base">
            {t("heroDesc")}
          </p>

          {/* Steps — hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-4 lg:gap-8">
            {/* Step 1 - Active */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full amber-gradient flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-xl">check</span>
              </div>
              <span className="text-primary font-headline font-bold text-sm">{t("stepChoose")}</span>
            </div>
            <div className="h-[2px] w-8 lg:w-12 bg-surface-container-highest" />
            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="text-sm font-bold">2</span>
              </div>
              <span className="text-on-surface-variant font-headline font-medium text-sm">{t("stepPayment")}</span>
            </div>
            <div className="h-[2px] w-8 lg:w-12 bg-surface-container-highest" />
            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="text-sm font-bold">3</span>
              </div>
              <span className="text-on-surface-variant font-headline font-medium text-sm">{t("stepConfirm")}</span>
            </div>
          </div>
        </div>

        {/* Balance card */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-6 lg:p-8 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <span className="text-secondary text-xs font-bold uppercase tracking-[0.2em] mb-2">
              {t("currentBalance")}
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className="text-4xl lg:text-5xl font-headline font-black text-primary tabular-nums"
                style={{ textShadow: "0 0 20px rgba(245,158,11,0.4)" }}
              >
                {balance.toLocaleString()}
              </span>
              <span className="text-primary-container text-lg lg:text-xl font-bold font-headline">{t("pts")}</span>
            </div>
            <div className="mt-4 lg:mt-6">
              <span className="text-[10px] px-3 py-1 bg-surface-container-highest rounded-full text-secondary uppercase font-bold tracking-widest">
                {t("tierLabel")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content: Packages + Payment + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Package + Payment */}
        <div className="lg:col-span-8 space-y-10 lg:space-y-12">
          {/* Package Selection */}
          <section>
            <h2 className="font-headline text-xl lg:text-2xl font-bold flex items-center gap-3 mb-6 lg:mb-8">
              <span className="w-8 h-[2px] bg-primary" />
              {t("selectPlan")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              {PACKAGES.map((p) => {
                const isSelected = selectedPkg === p.id;
                const info = PACKAGE_NAMES[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPkg(p.id)}
                    className={`group relative bg-surface-container rounded-lg p-6 lg:p-8 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-2 border-primary shadow-[0_20px_40px_rgba(245,158,11,0.15)]"
                        : "border border-outline-variant/10 hover:bg-surface-container-high hover:scale-[1.02]"
                    }`}
                  >
                    {p.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 amber-gradient px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-on-primary">
                        {t("mostPopular")}
                      </div>
                    )}
                    <div className="mb-6 lg:mb-8">
                      <span
                        className={`material-symbols-outlined text-3xl lg:text-4xl transition-colors ${
                          isSelected ? "text-primary" : "text-secondary group-hover:text-primary"
                        }`}
                        style={p.iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {p.icon}
                      </span>
                    </div>
                    <h3 className="font-headline text-lg lg:text-xl font-bold mb-1">{info.name}</h3>
                    <p className="text-xs text-on-surface-variant mb-4 lg:mb-6">{info.desc}</p>
                    <div className="flex items-baseline gap-1 mb-6 lg:mb-8">
                      <span className="text-2xl lg:text-3xl font-headline font-black text-on-surface">
                        {(p.points + p.bonus).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-secondary uppercase">{t("pts")}</span>
                    </div>
                    <div className="text-lg font-headline font-bold text-primary">${p.price}</div>
                    {p.bonus > 0 && (
                      <div className="mt-3 lg:mt-4 text-[10px] text-primary-container font-bold flex items-center gap-1 italic">
                        <span className="material-symbols-outlined text-xs">add</span>
                        {t("bonusPts", { bonus: p.bonus.toLocaleString() })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Payment Method */}
          <section>
            <h2 className="font-headline text-xl lg:text-2xl font-bold flex items-center gap-3 mb-6 lg:mb-8">
              <span className="w-8 h-[2px] bg-primary" />
              {t("paymentMethod")}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 lg:gap-4">
              {PAYMENT_METHODS.map((m) => {
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`bg-surface-container rounded-xl p-4 lg:p-6 flex flex-col items-center gap-2 lg:gap-3 transition-all group active:scale-95 ${
                      isSelected
                        ? "border-2 border-primary shadow-lg shadow-primary/5"
                        : "border border-outline-variant/10 hover:bg-surface-container-high hover:border-primary/50"
                    }`}
                  >
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center transition-all ${!isSelected ? "grayscale group-hover:grayscale-0" : ""}`}>
                      <span
                        className={`material-symbols-outlined text-2xl lg:text-3xl ${isSelected ? "text-primary" : "text-secondary"}`}
                        style={m.iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {m.icon}
                      </span>
                    </div>
                    <span className={`text-[9px] lg:text-[10px] font-bold uppercase tracking-widest ${isSelected ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"}`}>
                      {METHOD_LABELS[m.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right: Order Summary (sticky on desktop, normal on mobile) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-28">
          <div className="glass-panel rounded-lg overflow-hidden">
            <div className="bg-surface-container-high p-5 lg:p-6">
              <h3 className="font-headline font-bold text-lg">{t("orderSummary")}</h3>
            </div>
            <div className="p-6 lg:p-8 space-y-6">
              {/* Selected plan */}
              <div className="flex justify-between items-center pb-6" style={{ borderBottom: "1px solid rgba(83,68,52,0.1)" }}>
                <div>
                  <p className="text-sm font-bold text-on-surface">{PACKAGE_NAMES[selectedPkg].name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {pkg.bonus > 0
                      ? t("bonusPoints", { base: pkg.points.toLocaleString(), bonus: pkg.bonus.toLocaleString() })
                      : `${(pkg.points).toLocaleString()} ${t("pts")}`}
                  </p>
                </div>
                <p className="font-headline font-bold">${pkg.price}</p>
              </div>

              {/* Breakdown */}
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">{t("subtotal")}</span>
                  <span className="text-on-surface">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">{t("tax")}</span>
                  <span className="text-on-surface">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">{t("serviceFee")}</span>
                  <span className="text-on-surface">{t("free")}</span>
                </div>
              </div>

              {/* Total + Pay */}
              <div className="pt-6" style={{ borderTop: "1px solid rgba(83,68,52,0.1)" }}>
                <div className="flex justify-between items-end mb-6 lg:mb-8">
                  <span className="font-headline font-bold text-lg">{t("totalAmount")}</span>
                  <span className="font-headline font-black text-2xl lg:text-3xl text-primary">${total.toFixed(2)}</span>
                </div>

                {/* Payment method indicator */}
                <div className="flex items-center gap-3 p-4 bg-surface-container-lowest rounded-xl mb-6">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.iconFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.icon}
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{t("payingVia")}</p>
                    <p className="text-xs font-bold">{METHOD_LABELS[selectedMethod]}</p>
                  </div>
                  <button className="ml-auto text-primary text-[10px] font-bold uppercase">{t("change")}</button>
                </div>

                <button
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="w-full amber-gradient py-4 lg:py-5 rounded-xl font-headline font-black text-on-primary text-lg shadow-[0_20px_40px_rgba(245,158,11,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {isProcessing ? tc("loading") : t("payNow")}
                </button>

                <div className="mt-4 lg:mt-6 flex items-center justify-center gap-2 text-on-surface-variant opacity-60">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t("secureTransaction")}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
