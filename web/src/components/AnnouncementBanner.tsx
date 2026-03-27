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
    <div className="flex items-start gap-3 bg-primary/10 px-4 py-3 text-sm">
      <span className="material-symbols-outlined mt-0.5 shrink-0 text-primary text-base" aria-hidden="true">
        info
      </span>

      <div className="flex-1 min-w-0">
        <span className="font-semibold text-primary">{title} </span>
        <span className="text-on-surface-variant">{message}</span>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="關閉公告"
        className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}
