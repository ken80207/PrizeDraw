"use client";

import { useServerStatus } from "@/hooks/useServerStatus";
import { MaintenancePage } from "@/components/MaintenancePage";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

interface StatusGateProps {
  children: React.ReactNode;
}

/**
 * Client-side status gate that wraps the entire app in `layout.tsx`.
 *
 * Behaviour:
 * 1. If the server returns MAINTENANCE with at least one blocking announcement,
 *    render [MaintenancePage] as the sole visible content — children are unmounted.
 * 2. If there are non-blocking ANNOUNCEMENT entries, show [AnnouncementBanner]
 *    above the children.
 * 3. Otherwise render children as-is.
 *
 * The hook polls `/api/v1/status` every 60 seconds (30 seconds during maintenance).
 * The maintenance page disappears automatically once the server is back online.
 */
export function StatusGate({ children }: StatusGateProps) {
  const { isBlocked, isLoading, announcements, refetch } = useServerStatus();

  // While the initial fetch is in progress, render children to avoid
  // a flash of the maintenance screen on healthy startups.
  if (isLoading) return <>{children}</>;

  const blockingMaintenance = announcements.find((a) => a.isBlocking && a.type === "MAINTENANCE");

  if (isBlocked && blockingMaintenance) {
    return (
      <MaintenancePage
        title={blockingMaintenance.title}
        message={blockingMaintenance.message}
        scheduledEnd={blockingMaintenance.scheduledEnd}
        onRetry={refetch}
      />
    );
  }

  const bannerAnnouncement = announcements.find(
    (a) => !a.isBlocking && a.type === "ANNOUNCEMENT",
  );

  return (
    <>
      {bannerAnnouncement && (
        <AnnouncementBanner
          announcementId={bannerAnnouncement.id}
          title={bannerAnnouncement.title}
          message={bannerAnnouncement.message}
        />
      )}
      {children}
    </>
  );
}
