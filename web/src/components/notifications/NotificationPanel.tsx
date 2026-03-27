"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useNotificationStore, type NotificationItem } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";

export function NotificationPanel() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const setLoading = useNotificationStore((s) => s.setLoading);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const fetchNotifications = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications?limit=20", { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, setLoading, setNotifications]);

  useEffect(() => {
    if (notifications.length === 0) {
      void fetchNotifications();
    }
  }, [fetchNotifications, notifications.length]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      markRead(id);
      await fetch(`/api/v1/notifications/${id}/read`, { method: "POST", headers: authHeaders });
    },
    [markRead, authHeaders],
  );

  const handleMarkAllRead = useCallback(async () => {
    markAllRead();
    await fetch("/api/v1/notifications/read-all", { method: "POST", headers: authHeaders });
  }, [markAllRead, authHeaders]);

  return (
    <div className="absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={handleMarkAllRead}>
          Mark all read
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-gray-400">No notifications</span>
        </div>
      ) : (
        <ul>
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  return (
    <li
      className={`border-b px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
        notification.isRead ? "opacity-60" : ""
      }`}
      onClick={() => { if (!notification.isRead) onMarkRead(notification.id); }}
    >
      <div className="flex items-start gap-2">
        {!notification.isRead && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          <p className="text-xs text-gray-500 line-clamp-2">{notification.body}</p>
          <time className="text-[10px] text-gray-400">{formatRelativeTime(notification.createdAt)}</time>
        </div>
      </div>
    </li>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
