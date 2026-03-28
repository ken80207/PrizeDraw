"use client";

import type { DrawFeedEvent } from "@/services/feedWebSocket";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SSR: { bg: "bg-yellow-500/20", border: "border-l-yellow-500", text: "text-yellow-500" },
  SR: { bg: "bg-gray-300/20", border: "border-l-gray-300", text: "text-gray-300" },
  R: { bg: "bg-amber-600/20", border: "border-l-amber-600", text: "text-amber-600" },
  N: { bg: "bg-gray-500/20", border: "border-l-gray-500", text: "text-gray-500" },
};

function timeAgo(drawnAt: string): string {
  const diff = Date.now() - new Date(drawnAt).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分鐘前`;
  const hours = Math.floor(minutes / 60);
  return `${hours}小時前`;
}

interface FeedItemProps {
  event: DrawFeedEvent;
  isOwn: boolean;
}

export default function FeedItem({ event, isOwn }: FeedItemProps) {
  const colors = GRADE_COLORS[event.prizeGrade] ?? GRADE_COLORS.N;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 border-l-4 ${colors.border} ${
        isOwn
          ? "bg-green-900/30 shadow-[0_0_12px_rgba(80,250,123,0.2)]"
          : "bg-surface-container-low"
      }`}
    >
      <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0">
        {event.prizePhotoUrl ? (
          <img src={event.prizePhotoUrl} alt={event.prizeName} className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            redeem
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${colors.bg} ${colors.text}`}>
            {event.prizeGrade}
          </span>
          <span className={`text-sm font-semibold truncate ${isOwn ? "text-green-400" : "text-on-surface"}`}>
            {isOwn ? "⭐ 你" : event.playerNickname}
          </span>
          <span className="text-xs text-on-surface-variant">抽到了</span>
        </div>
        <div className="text-sm text-on-surface-variant truncate">{event.prizeName}</div>
        <div className="text-[11px] text-on-surface-variant/50">
          {event.campaignTitle} · {timeAgo(event.drawnAt)}
        </div>
      </div>
    </div>
  );
}
