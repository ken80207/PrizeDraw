"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface MaintenancePageProps {
  title: string;
  message: string;
  scheduledEnd: string | null;
  onRetry: () => void;
}

export function MaintenancePage({ title, message, scheduledEnd, onRetry }: MaintenancePageProps) {
  const t = useTranslations("maintenance");
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    onRetry();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRetrying(false);
  };

  const endTimeDisplay = scheduledEnd
    ? new Date(scheduledEnd).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim">
      {/* Decorative blobs */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-md px-6 text-center">
        <div className="mb-6">
          <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            build
          </span>
        </div>

        <h1 className="mb-3 text-2xl font-black text-on-surface font-headline">
          {title}
        </h1>

        <p className="mb-4 text-on-surface-variant">{message}</p>

        {endTimeDisplay && (
          <p className="mb-6 font-bold text-primary">
            {t("expectedRestore", { time: endTimeDisplay })}
          </p>
        )}

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl amber-gradient px-6 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
        >
          {isRetrying ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>{t("retrying")}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>{t("retryButton")}</span>
            </>
          )}
        </button>

        <p className="mt-3 text-xs text-on-surface-variant/50">{t("autoRetry")}</p>
      </div>
    </div>
  );
}
