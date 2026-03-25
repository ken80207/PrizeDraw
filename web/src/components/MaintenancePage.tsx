"use client";

import { useState } from "react";

interface MaintenancePageProps {
  /** Maintenance headline from the active announcement. */
  title: string;
  /** Detailed maintenance message. */
  message: string;
  /**
   * ISO-8601 timestamp of the expected restoration time, or null when unknown.
   * Displayed as a localised time string in the user's browser timezone.
   */
  scheduledEnd: string | null;
  /** Callback invoked when the user clicks the retry button. */
  onRetry: () => void;
}

/**
 * Full-screen blocking overlay rendered during platform maintenance.
 *
 * This page **cannot be interacted-with in the background** — it is rendered
 * as the sole child of `layout.tsx` via `useServerStatus()` when `isBlocked`
 * is `true`. Navigation to any other route is impossible while it is displayed.
 *
 * @param title Maintenance headline.
 * @param message Detailed maintenance body text.
 * @param scheduledEnd Optional ISO timestamp of the expected end time.
 * @param onRetry Callback for the retry button; the layout polls automatically
 *   every 30 seconds and will remove this page once the server is back online.
 */
export function MaintenancePage({ title, message, scheduledEnd, onRetry }: MaintenancePageProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-md px-6 text-center">
        {/* Wrench icon */}
        <div className="mb-6 text-6xl" role="img" aria-label="maintenance">
          🔧
        </div>

        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h1>

        <p className="mb-4 text-gray-600 dark:text-gray-400">{message}</p>

        {endTimeDisplay && (
          <p className="mb-6 font-medium text-indigo-600 dark:text-indigo-400">
            預計 {endTimeDisplay} 恢復服務
          </p>
        )}

        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
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
              連線中…
            </>
          ) : (
            "重新連線"
          )}
        </button>

        <p className="mt-3 text-xs text-gray-400">每 30 秒自動重試</p>
      </div>
    </div>
  );
}
