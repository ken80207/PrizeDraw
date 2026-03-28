"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLiveDrawStore } from "@/stores/liveDrawStore";
import { subscribeLiveDraws } from "@/services/feedWebSocket";

export function LiveDrawMarquee() {
  const t = useTranslations("live");
  const router = useRouter();
  const { draws, fetchLiveDraws, addDraw, removeDraw } = useLiveDrawStore();

  useEffect(() => {
    fetchLiveDraws();
    const unsub = subscribeLiveDraws((msg) => {
      if (msg.type === "live_draw_started") {
        addDraw(msg.data);
      } else if (msg.type === "live_draw_ended") {
        removeDraw(msg.sessionId);
      }
    });
    return unsub;
  }, [fetchLiveDraws, addDraw, removeDraw]);

  const items = Array.from(draws.values());
  if (items.length === 0) return null;

  const doubled = [...items, ...items]; // seamless loop

  return (
    <section className="py-2 bg-red-950/30 overflow-hidden border-y border-red-500/20">
      <div className="flex items-center px-4 mb-1">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs text-red-400 font-medium">{t("title")}</span>
      </div>
      <div className="overflow-hidden whitespace-nowrap">
        <div className="animate-marquee flex items-center gap-4 px-4">
          {doubled.map((item, i) => (
            <button
              key={`${item.sessionId}-${i}`}
              onClick={() => router.push(`/campaigns/${item.campaignId}/board?spectate=true`)}
              className="flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 transition-colors cursor-pointer"
            >
              <span className="text-xs">🔴</span>
              <span className="text-xs text-on-surface font-medium">
                {t("drawing", { nickname: item.nickname, campaign: item.campaignTitle })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
