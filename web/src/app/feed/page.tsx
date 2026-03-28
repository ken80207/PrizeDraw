"use client";

import { useEffect } from "react";
import { useFeedStore, useFilteredFeedItems } from "@/stores/feedStore";
import { subscribeFeed } from "@/services/feedWebSocket";
import { useAuthStore } from "@/stores/authStore";
import FeedItem from "@/components/feed/FeedItem";
import FeedFilterBar from "@/components/feed/FeedFilterBar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function FeedPage() {
  const { addEvent, setInitialItems, setConnected } = useFeedStore();
  const filteredItems = useFilteredFeedItems();

  const player = useAuthStore((state) => state.player);
  const currentPlayerId: string | null = player?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadRecent() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/feed/recent?limit=50`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setInitialItems(data.items ?? []);
        }
      } catch {
        // Silently fail — WebSocket will provide live data
      }
    }

    loadRecent();

    const unsubscribe = subscribeFeed(
      (event) => { if (!cancelled) addEvent(event); },
      (connected) => { if (!cancelled) setConnected(connected); },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [addEvent, setInitialItems, setConnected]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-on-surface mb-1">抽獎動態</h1>
      <p className="text-sm text-on-surface-variant mb-4">即時查看所有玩家的抽獎結果</p>

      <FeedFilterBar />

      <div className="flex flex-col gap-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant text-sm">
            尚無抽獎紀錄
          </div>
        ) : (
          filteredItems.map((item) => (
            <FeedItem
              key={item.drawId}
              event={item}
              isOwn={currentPlayerId !== null && item.playerId === currentPlayerId}
            />
          ))
        )}
      </div>

      {filteredItems.length > 0 && (
        <p className="text-center text-[11px] text-on-surface-variant/50 mt-4">
          只顯示最近 100 筆 · 即時更新中
        </p>
      )}
    </div>
  );
}
