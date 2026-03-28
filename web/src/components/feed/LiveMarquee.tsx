"use client";

import { useEffect } from "react";
import { useFeedStore } from "@/stores/feedStore";
import { subscribeFeed } from "@/services/feedWebSocket";
import Link from "next/link";

const GRADE_STYLES: Record<string, { border: string; badge: string; text: string }> = {
  SSR: { border: "border-l-yellow-500", badge: "bg-yellow-500 text-black", text: "text-yellow-500" },
  SR: { border: "border-l-gray-300", badge: "bg-gray-300 text-black", text: "text-gray-300" },
  R: { border: "border-l-amber-600", badge: "bg-amber-600 text-black", text: "text-amber-600" },
  N: { border: "border-l-gray-500", badge: "bg-gray-500 text-black", text: "text-gray-500" },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface LiveMarqueeProps {
  currentPlayerId?: string | null;
}

export default function LiveMarquee({ currentPlayerId }: LiveMarqueeProps) {
  const { items, addEvent, setInitialItems, setConnected } = useFeedStore();

  useEffect(() => {
    let cancelled = false;

    async function loadRecent() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/feed/recent?limit=10`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && useFeedStore.getState().items.length === 0) setInitialItems(data.items ?? []);
        }
      } catch {
        // Silently fail
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addEvent, setInitialItems, setConnected]);

  if (items.length === 0) return null;

  const displayItems = items.slice(0, 20);
  const doubled = [...displayItems, ...displayItems];

  return (
    <section className="py-3 bg-surface-container-low/50 overflow-hidden border-y border-white/5">
      <div className="flex items-center justify-between px-4 mb-2">
        <span className="text-xs text-on-surface-variant font-medium">抽獎動態</span>
        <Link href="/feed" className="text-xs text-primary hover:underline">
          查看全部 →
        </Link>
      </div>
      <div className="overflow-hidden whitespace-nowrap">
        <div className="animate-marquee flex items-center gap-3 px-4">
          {doubled.map((item, i) => {
            const isOwn = currentPlayerId != null && item.playerId === currentPlayerId;
            const style = GRADE_STYLES[item.prizeGrade] ?? GRADE_STYLES.N;

            return (
              <div
                key={`${item.drawId}-${i}`}
                className={`flex items-center gap-2 shrink-0 rounded-xl px-3 py-2 border-l-[3px] ${style.border} ${
                  isOwn
                    ? "bg-green-900/30 shadow-[0_0_8px_rgba(80,250,123,0.3)]"
                    : "bg-surface-container-high/50"
                }`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${style.badge}`}>
                  {item.prizeGrade}
                </span>
                <span className={`text-xs font-semibold ${isOwn ? "text-green-400" : "text-on-surface"}`}>
                  {isOwn ? "⭐ 你" : item.playerNickname}
                </span>
                <span className="text-xs text-on-surface-variant truncate max-w-[120px]">
                  {item.prizeName}
                </span>
                <span className="text-[10px] text-on-surface-variant/50 truncate max-w-[100px]">
                  {item.campaignTitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
