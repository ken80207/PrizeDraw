/**
 * Notification state store backed by Zustand.
 */

import { create } from "zustand";

export interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;

  setUnreadCount: (count: number) => void;
  addNotification: (notification: NotificationItem) => void;
  setNotifications: (items: NotificationItem[]) => void;
  appendNotifications: (items: NotificationItem[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  setUnreadCount(count: number) {
    set({ unreadCount: count });
  },

  addNotification(notification: NotificationItem) {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    }));
  },

  setNotifications(items: NotificationItem[]) {
    set({ notifications: items });
  },

  appendNotifications(items: NotificationItem[]) {
    set((state) => ({
      notifications: [...state.notifications, ...items],
    }));
  },

  markRead(id: string) {
    set((state) => {
      const wasUnread = state.notifications.find((n) => n.id === id && !n.isRead);
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: wasUnread
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    });
  },

  markAllRead() {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  setLoading(loading: boolean) {
    set({ isLoading: loading });
  },
}));
