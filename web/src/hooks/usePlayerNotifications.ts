/**
 * React hook that manages the player notification WebSocket lifecycle.
 *
 * Connects when authenticated, disconnects on logout. Routes incoming
 * WebSocket events to the notificationStore and walletStore.
 *
 * Usage: Call this once in the root layout or authenticated wrapper.
 */

"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useWalletStore } from "@/stores/walletStore";
import {
  connectPlayerWebSocket,
  type PlayerWsMessage,
} from "@/services/playerWebSocket";

export function usePlayerNotifications(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const disposeRef = useRef<(() => void) | null>(null);

  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const addDrawPoints = useWalletStore((s) => s.addDrawPoints);
  const addRevenuePoints = useWalletStore((s) => s.addRevenuePoints);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disposeRef.current?.();
      disposeRef.current = null;
      return;
    }

    const dispose = connectPlayerWebSocket(accessToken, {
      onConnected(unreadCount: number) {
        setUnreadCount(unreadCount);
      },

      onNotification(msg: PlayerWsMessage) {
        addNotification({
          id: msg.notificationId ?? crypto.randomUUID(),
          eventType: msg.eventType,
          title: msg.title,
          body: msg.body,
          data: msg.data,
          isRead: false,
          createdAt: msg.timestamp,
        });

        routeWalletEvent(msg);
      },

      onDisconnected() {
        // Reconnect is handled by the WS service internally
      },
    });

    disposeRef.current = dispose;

    return () => {
      dispose();
      disposeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  function routeWalletEvent(msg: PlayerWsMessage): void {
    const data = msg.data;
    switch (msg.eventType) {
      case "payment.confirmed": {
        const points = parseInt(data.drawPointsGranted ?? "0", 10);
        if (points > 0) addDrawPoints(points);
        break;
      }
      case "buyback.completed": {
        const points = parseInt(data.revenuePointsCredited ?? "0", 10);
        if (points > 0) addRevenuePoints(points);
        break;
      }
      case "trade.completed": {
        const sellerProceeds = parseInt(data.sellerProceeds ?? "0", 10);
        if (sellerProceeds > 0) addRevenuePoints(sellerProceeds);
        break;
      }
      default:
        break;
    }
  }
}
