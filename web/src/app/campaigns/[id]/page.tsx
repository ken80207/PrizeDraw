"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/LoadingSkeleton";
import { ChatPanel } from "@/components/ChatPanel";
import { SpectatorBar } from "@/components/SpectatorBar";
import { useDrawSync } from "@/hooks/useDrawSync";

interface KujiCampaignDto {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  pricePerDraw: number;
  drawSessionSeconds: number;
  status: string;
}

interface TicketBoxDto {
  id: string;
  name: string;
  totalTickets: number;
  remainingTickets: number;
  status: string;
  displayOrder: number;
}

interface PrizeDefinitionDto {
  id: string;
  grade: string;
  name: string;
  photos: string[];
  buybackPrice: number;
  ticketCount: number | null;
  displayOrder: number;
}

interface KujiCampaignDetailDto {
  campaign: KujiCampaignDto;
  boxes: TicketBoxDto[];
  prizes: PrizeDefinitionDto[];
}

const STATUS_ZH: Record<string, string> = {
  ACTIVE: "開放中",
  SOLD_OUT: "已售罄",
  INACTIVE: "已停售",
  DRAFT: "草稿",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [detail, setDetail] = useState<KujiCampaignDetailDto | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activeDrawSession, lastRevealed, clearRevealed } = useDrawSync(id);
  const chatRoomId = id ? `kuji:${id}` : "";

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<KujiCampaignDetailDto>(`/api/v1/campaigns/kuji/${id}`)
      .then((data) => {
        setDetail(data);
        setSelectedBoxId(data.boxes[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "載入活動失敗"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <CampaignDetailSkeleton />;

  if (error || !detail) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{error ?? "找不到此活動"}</p>
        <button
          onClick={() => router.push("/campaigns")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          返回活動列表
        </button>
      </div>
    );
  }

  const { campaign, boxes, prizes } = detail;
  const selectedBox = boxes.find((b) => b.id === selectedBoxId) ?? boxes[0];

  const statusLabel = STATUS_ZH[campaign.status] ?? campaign.status;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Spectator bar (shown while another player is drawing) ──────────── */}
      <SpectatorBar
        activeSession={activeDrawSession}
        lastRevealed={lastRevealed}
        onRevealDismissed={clearRevealed}
      />

      {/* ── Campaign Header ──────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Cover image */}
            <div className="relative w-full md:w-72 h-52 md:h-auto shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
              {campaign.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={campaign.coverImageUrl}
                  alt={campaign.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">🎫</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <StatusBadge status={statusLabel} />
                <StatusBadge status="一番賞" />
                {/* Spectator count badge — shown when someone is drawing */}
                {activeDrawSession && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                    👀 正在觀戰
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {campaign.title}
              </h1>
              {campaign.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                  {campaign.description}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-center">
                  <div className="text-xs text-indigo-500 dark:text-indigo-400 mb-1">每抽費用</div>
                  <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                    {campaign.pricePerDraw.toLocaleString()} 點
                  </div>
                </div>
                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
                  <div className="text-xs text-purple-500 dark:text-purple-400 mb-1">抽籤時間</div>
                  <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                    {Math.floor(campaign.drawSessionSeconds / 60)} 分鐘
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                  <div className="text-xs text-amber-500 dark:text-amber-400 mb-1">籤盒數量</div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {boxes.length} 個
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Prize Gallery ────────────────────────────────── */}
        {prizes.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">賞品一覽</h2>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {prizes.map((prize) => (
                <div
                  key={prize.id}
                  className="min-w-[120px] flex-shrink-0 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="h-24 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {prize.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prize.photos[0]}
                        alt={prize.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">🏆</span>
                    )}
                  </div>
                  <div className="p-2">
                    <GradeBadge grade={prize.grade} />
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-1 line-clamp-2">
                      {prize.name}
                    </p>
                    {prize.ticketCount !== null && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {prize.ticketCount} 張
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Ticket Box Tabs ───────────────────────────────── */}
        {boxes.length > 0 && (
          <section>
            {/* Box tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
              {boxes.map((box) => (
                <button
                  key={box.id}
                  onClick={() => setSelectedBoxId(box.id)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedBoxId === box.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600"
                  }`}
                >
                  {box.name}
                  <span className="ml-2 text-xs opacity-75">
                    ({box.remainingTickets}/{box.totalTickets})
                  </span>
                </button>
              ))}
            </div>

            {/* Ticket board loaded via WebSocket in queue page */}
            <div className="flex items-center justify-center h-32 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-sm">
              加入排隊後即可即時觀看籤面
            </div>
          </section>
        )}
      </div>

      {/* ── Sticky bottom bar ────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-4">
          <Link
            href={`/campaigns/${id}/queue${selectedBox ? `?boxId=${selectedBox.id}` : ""}`}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
          >
            加入排隊
          </Link>
        </div>
      </div>

      {/* ── Chat panel (slide-in from right / bottom sheet on mobile) ─────── */}
      {chatRoomId && <ChatPanel roomId={chatRoomId} />}

    </div>
  );
}

function CampaignDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6">
            <Skeleton className="w-full md:w-72 h-52 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="min-w-[120px] h-40 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: 40 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
