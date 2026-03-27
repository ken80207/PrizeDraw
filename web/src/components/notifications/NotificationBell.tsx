"use client";

import { useState } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { NotificationPanel } from "./NotificationPanel";

/**
 * Bell icon with unread notification badge.
 * Clicking toggles the notification dropdown panel.
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel />
      )}
    </div>
  );
}
