"use client";

import { useState } from "react";

interface AnnouncementBannerProps {
  /** Stable announcement ID used to key per-announcement dismiss state. */
  announcementId: string;
  /** Short announcement headline. */
  title: string;
  /** Detailed message body. */
  message: string;
}

/**
 * Dismissible top-of-page banner for non-blocking server announcements.
 *
 * Rendered above the main page content when the server returns active
 * `ANNOUNCEMENT`-type entries with `isBlocking = false`. Users can dismiss it
 * permanently for the current session by clicking the close button.
 *
 * The dismissed state is stored in `sessionStorage` keyed by `announcementId`
 * so it resets on the next browser session (ensuring important notices are seen).
 *
 * @param announcementId Stable ID used to track per-announcement dismiss state.
 * @param title Short headline text.
 * @param message Detailed body text shown alongside the headline.
 */
export function AnnouncementBanner({ announcementId, title, message }: AnnouncementBannerProps) {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(`announcement_dismissed_${announcementId}`) === "true";
  });

  const handleDismiss = () => {
    sessionStorage.setItem(`announcement_dismissed_${announcementId}`, "true");
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="flex items-start gap-3 bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-950/40">
      <span className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true">
        ℹ
      </span>

      <div className="flex-1 min-w-0">
        <span className="font-semibold text-indigo-900 dark:text-indigo-300">{title} </span>
        <span className="text-indigo-800 dark:text-indigo-400">{message}</span>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="關閉公告"
        className="shrink-0 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
