"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/services/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { GradeBadge } from "@/components/GradeBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/LoadingSkeleton";
import { ChatPanel } from "@/components/ChatPanel";
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";
import { AnimatedReveal, type AnimationMode } from "@/animations/AnimatedReveal";
import { useDrawSync } from "@/hooks/useDrawSync";
import { useDrawInputSync } from "@/hooks/useDrawInputSync";
import { ScratchReveal } from "@/animations/ScratchReveal";
import { FlipReveal } from "@/animations/FlipReveal";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

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

interface TicketDto {
  id: string;
  position: number;
  status: "AVAILABLE" | "DRAWN";
  grade: string | null;
  prizeName: string | null;
  prizePhotoUrl: string | null;
  drawnByNickname: string | null;
}

interface QueueEntryDto {
  id: string;
  position: number;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED" | "EVICTED";
  joinedAt: string;
  queueLength: number;
  sessionExpiresAt: string | null;
}

interface DrawnTicketResultDto {
  ticketId: string;
  position: number;
  prizeInstanceId: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string;
  pointsCharged: number;
}

interface DrawResultDto {
  tickets: DrawnTicketResultDto[];
}

interface WinRecord {
  id: string;
  nickname: string;
  grade: string;
  prizeName: string;
  prizePhotoUrl: string | null;
  at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock / demo data (used when API is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CAMPAIGN: KujiCampaignDto = {
  id: "demo-001",
  title: "鬼滅之刃 一番賞 2026 Spring",
  description:
    "超豪華陣容！集結竈門炭治郎、煉獄杏壽郎、胡蝶忍等人氣角色，共 6 種賞品等你抽！Last 賞超稀有限量，手速決定一切！",
  coverImageUrl: null,
  pricePerDraw: 350,
  drawSessionSeconds: 300,
  status: "ACTIVE",
};

const MOCK_BOXES: TicketBoxDto[] = [
  { id: "box-A", name: "籤盒 A", totalTickets: 80, remainingTickets: 47, status: "ACTIVE", displayOrder: 1 },
  { id: "box-B", name: "籤盒 B", totalTickets: 80, remainingTickets: 55, status: "ACTIVE", displayOrder: 2 },
];

const MOCK_PRIZES: PrizeDefinitionDto[] = [
  { id: "p1", grade: "A賞", name: "炭治郎 1/7 完成品", photos: [], buybackPrice: 3500, ticketCount: 2, displayOrder: 1 },
  { id: "p2", grade: "B賞", name: "煉獄杏壽郎 亞克力立牌", photos: [], buybackPrice: 800, ticketCount: 5, displayOrder: 2 },
  { id: "p3", grade: "C賞", name: "胡蝶忍 壓克力鑰匙圈", photos: [], buybackPrice: 450, ticketCount: 10, displayOrder: 3 },
  { id: "p4", grade: "D賞", name: "禰豆子 馬克杯", photos: [], buybackPrice: 300, ticketCount: 15, displayOrder: 4 },
  { id: "p5", grade: "E賞", name: "善逸 徽章", photos: [], buybackPrice: 150, ticketCount: 25, displayOrder: 5 },
  { id: "p6", grade: "Last賞", name: "炭治郎 & 禰豆子 豪華套組", photos: [], buybackPrice: 9800, ticketCount: 1, displayOrder: 6 },
];

function buildMockTickets(boxId: string): TicketDto[] {
  const total = boxId === "box-A" ? 80 : 80;
  const drawn = boxId === "box-A" ? 33 : 25;
  return Array.from({ length: total }, (_, i) => {
    const pos = i + 1;
    const isDrawn = pos <= drawn;
    const prizeIdx = pos % MOCK_PRIZES.length;
    return {
      id: `${boxId}-t${pos}`,
      position: pos,
      status: isDrawn ? "DRAWN" : "AVAILABLE",
      grade: isDrawn ? (MOCK_PRIZES[prizeIdx]?.grade ?? "E賞") : null,
      prizeName: isDrawn ? (MOCK_PRIZES[prizeIdx]?.name ?? "") : null,
      prizePhotoUrl: null,
      drawnByNickname: isDrawn ? `玩家${100 + pos}` : null,
    };
  });
}

const MOCK_RECENT_WINS: WinRecord[] = [
  { id: "w1", nickname: "龍之勇者", grade: "A賞", prizeName: "炭治郎 1/7 完成品", prizePhotoUrl: null, at: new Date(Date.now() - 120_000).toISOString() },
  { id: "w2", nickname: "SakuraXO", grade: "C賞", prizeName: "胡蝶忍 壓克力鑰匙圈", prizePhotoUrl: null, at: new Date(Date.now() - 350_000).toISOString() },
  { id: "w3", nickname: "KujiMaster88", grade: "B賞", prizeName: "煉獄杏壽郎 亞克力立牌", prizePhotoUrl: null, at: new Date(Date.now() - 720_000).toISOString() },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page-level state machine
// ─────────────────────────────────────────────────────────────────────────────

type PageMode =
  | { type: "BROWSING" }
  | { type: "IN_QUEUE"; entry: QueueEntryDto }
  | { type: "MY_TURN"; entry: QueueEntryDto; countdown: number }
  | { type: "DRAWING"; tickets: DrawnTicketResultDto[]; animIndex: number }
  | { type: "SPECTATING"; drawerId: string; drawerNickname: string };

type PageAction =
  | { type: "JOIN_QUEUE"; entry: QueueEntryDto }
  | { type: "LEAVE_QUEUE" }
  | { type: "QUEUE_ACTIVATED"; entry: QueueEntryDto }
  | { type: "START_DRAWING"; tickets: DrawnTicketResultDto[] }
  | { type: "NEXT_ANIMATION" }
  | { type: "ANIMATION_DONE" }
  | { type: "SPECTATOR_STARTED"; drawerId: string; drawerNickname: string }
  | { type: "SPECTATOR_ENDED" }
  | { type: "TICK_COUNTDOWN"; seconds: number };

function pageReducer(state: PageMode, action: PageAction): PageMode {
  switch (action.type) {
    case "JOIN_QUEUE":
      return { type: "IN_QUEUE", entry: action.entry };
    case "LEAVE_QUEUE":
      return { type: "BROWSING" };
    case "QUEUE_ACTIVATED":
      return { type: "MY_TURN", entry: action.entry, countdown: action.entry.sessionExpiresAt
        ? Math.max(0, Math.round((new Date(action.entry.sessionExpiresAt).getTime() - Date.now()) / 1000))
        : 300 };
    case "TICK_COUNTDOWN":
      if (state.type === "MY_TURN") return { ...state, countdown: action.seconds };
      return state;
    case "START_DRAWING":
      return { type: "DRAWING", tickets: action.tickets, animIndex: 0 };
    case "NEXT_ANIMATION":
      if (state.type === "DRAWING") return { ...state, animIndex: state.animIndex + 1 };
      return state;
    case "ANIMATION_DONE":
      return { type: "BROWSING" };
    case "SPECTATOR_STARTED":
      if (state.type === "BROWSING")
        return { type: "SPECTATING", drawerId: action.drawerId, drawerNickname: action.drawerNickname };
      return state;
    case "SPECTATOR_ENDED":
      if (state.type === "SPECTATING") return { type: "BROWSING" };
      return state;
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_ZH: Record<string, string> = {
  ACTIVE: "開放中",
  SOLD_OUT: "已售罄",
  INACTIVE: "已停售",
  DRAFT: "草稿",
};

const ANIMATION_MODE_ZH: Record<string, string> = {
  TEAR: "撕籤",
  SCRATCH: "刮刮",
  FLIP: "翻牌",
  INSTANT: "即時",
};

const DRAW_QUANTITIES = [1, 3, 5, 12] as const;

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  return `${Math.floor(diff / 3600)} 小時前`;
}

// Prize grade color mapping for ticket cells
const GRADE_BG: Record<string, string> = {
  "A賞": "bg-red-50 border-red-200",
  "B賞": "bg-orange-50 border-orange-200",
  "C賞": "bg-blue-50 border-blue-200",
  "D賞": "bg-green-50 border-green-200",
  "E賞": "bg-purple-50 border-purple-200",
  "Last賞": "bg-amber-50 border-amber-300",
  "LAST賞": "bg-amber-50 border-amber-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Grid Cell
// ─────────────────────────────────────────────────────────────────────────────

interface TicketCellProps {
  ticket: TicketDto;
  isSelectable: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function TicketCell({ ticket, isSelectable, isSelected, onSelect }: TicketCellProps) {
  const isDrawn = ticket.status === "DRAWN";
  const gradeStyle = ticket.grade ? (GRADE_BG[ticket.grade] ?? "bg-gray-50 border-gray-200") : "";

  return (
    <button
      type="button"
      aria-label={isDrawn ? `${ticket.position}號 已抽 ${ticket.grade ?? ""}` : `${ticket.position}號 可抽`}
      aria-pressed={isSelected}
      disabled={isDrawn || (!isSelectable && !isSelected)}
      onClick={() => !isDrawn && isSelectable && onSelect(ticket.id)}
      className={cn(
        "aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative overflow-hidden transition-all duration-150",
        isDrawn
          ? cn("border", gradeStyle || "bg-gray-50 border-gray-200", "cursor-default")
          : isSelectable
          ? cn(
              "bg-amber-50 border-2 border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer",
              isSelected && "ring-2 ring-amber-500 bg-amber-100 border-amber-400 shadow-md scale-105",
            )
          : "bg-amber-50 border-2 border-amber-200 cursor-default",
      )}
    >
      {isDrawn ? (
        <>
          {ticket.prizePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.prizePhotoUrl}
              alt={ticket.grade ?? ""}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg select-none">
              {ticket.grade === "A賞" ? "🥇" :
               ticket.grade === "B賞" ? "🥈" :
               ticket.grade?.includes("Last") ? "🌟" : "🎁"}
            </span>
          )}
          {/* Grade badge overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5 leading-tight">
            {ticket.grade}
          </div>
          {/* Drawn-by label */}
          {ticket.drawnByNickname && (
            <div className="absolute top-0.5 left-0 right-0 text-[8px] text-white/80 text-center truncate px-0.5 bg-black/30">
              {ticket.drawnByNickname}
            </div>
          )}
        </>
      ) : (
        <span className="font-bold text-amber-700 text-xs tabular-nums select-none">
          {ticket.position.toString().padStart(2, "0")}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prize Gallery
// ─────────────────────────────────────────────────────────────────────────────

function PrizeGallery({ prizes }: { prizes: PrizeDefinitionDto[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
      {prizes.map((prize) => (
        <div
          key={prize.id}
          className="shrink-0 w-24 snap-start"
        >
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
            {prize.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.photos[0]}
                alt={prize.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">
                {prize.grade === "A賞" ? "🥇" :
                 prize.grade === "B賞" ? "🥈" :
                 prize.grade?.includes("Last") ? "🌟" : "🎁"}
              </span>
            )}
          </div>
          <div className="mt-1.5 space-y-0.5">
            <GradeBadge grade={prize.grade} className="text-[10px] px-1.5 py-0" />
            <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-tight line-clamp-2">
              {prize.name}
            </p>
            {prize.ticketCount !== null && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {prize.ticketCount} 枚
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Wins sidebar widget
// ─────────────────────────────────────────────────────────────────────────────

function RecentWins({ records }: { records: WinRecord[] }) {
  if (records.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        最近中獎
      </h3>
      <div className="space-y-1.5">
        {records.slice(0, 5).map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-700"
          >
            {r.prizePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.prizePhotoUrl}
                alt={r.prizeName}
                className="w-8 h-8 rounded-md object-cover shrink-0"
              />
            ) : (
              <span className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-base shrink-0">
                🏆
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">
                  {r.nickname}
                </span>
                <GradeBadge grade={r.grade} className="text-[9px] px-1 py-0" />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {r.prizeName}
              </p>
            </div>
            <time className="text-[9px] text-gray-400 dark:text-gray-500 shrink-0 self-end">
              {timeAgo(r.at)}
            </time>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue & Turn panels
// ─────────────────────────────────────────────────────────────────────────────

interface QueueStatusCardProps {
  entry: QueueEntryDto;
  onLeave: () => void;
  isLeaving: boolean;
}

function QueueStatusCard({ entry, onLeave, isLeaving }: QueueStatusCardProps) {
  const ahead = Math.max(0, entry.position - 1);
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          排隊中
        </span>
        <span className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full font-medium">
          共 {entry.queueLength} 人
        </span>
      </div>
      <div className="text-center py-2">
        <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
          #{entry.position}
        </div>
        <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
          {ahead === 0 ? "即將輪到你！" : `前面還有 ${ahead} 人`}
        </div>
      </div>
      <button
        type="button"
        onClick={onLeave}
        disabled={isLeaving}
        className="w-full py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors"
      >
        {isLeaving ? "處理中..." : "離開排隊"}
      </button>
    </div>
  );
}

interface MyTurnPanelProps {
  entry: QueueEntryDto;
  countdown: number;
  pricePerDraw: number;
  playerPoints: number;
  selectedTicketIds: string[];
  selectionMode: "manual" | "random";
  quantity: number;
  animMode: AnimationMode;
  isSubmitting: boolean;
  onSelectionModeChange: (mode: "manual" | "random") => void;
  onQuantityChange: (q: number) => void;
  onAnimModeChange: (m: AnimationMode) => void;
  onConfirmDraw: () => void;
  onEndTurn: () => void;
}

function MyTurnPanel({
  countdown,
  pricePerDraw,
  playerPoints,
  selectedTicketIds,
  selectionMode,
  quantity,
  animMode,
  isSubmitting,
  onSelectionModeChange,
  onQuantityChange,
  onAnimModeChange,
  onConfirmDraw,
  onEndTurn,
}: MyTurnPanelProps) {
  const cost = selectionMode === "manual" ? selectedTicketIds.length * pricePerDraw : quantity * pricePerDraw;
  const canAfford = playerPoints >= cost;
  const canDraw =
    !isSubmitting &&
    canAfford &&
    (selectionMode === "random" ? quantity > 0 : selectedTicketIds.length > 0);

  const countdownColor =
    countdown <= 30 ? "text-rose-600 dark:text-rose-400" :
    countdown <= 60 ? "text-amber-500 dark:text-amber-400" :
    "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
          輪到你了！
        </span>
        <span className={cn("text-xl font-black tabular-nums", countdownColor)}>
          {formatCountdown(countdown)}
        </span>
      </div>

      {/* Selection mode */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">選擇方式</p>
        <div className="grid grid-cols-2 gap-2">
          {(["manual", "random"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSelectionModeChange(m)}
              className={cn(
                "py-2 rounded-lg text-xs font-semibold transition-all",
                selectionMode === m
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300",
              )}
            >
              {m === "manual" ? "🎯 自己選籤" : "🎲 隨機抽取"}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity (random mode only) */}
      {selectionMode === "random" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">抽取數量</p>
          <div className="flex gap-1.5 flex-wrap">
            {DRAW_QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuantityChange(q)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  quantity === q
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-300",
                )}
              >
                {q} 抽
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual selection summary */}
      {selectionMode === "manual" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          已選 <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedTicketIds.length}</span> 張
          （在下方籤面點選籤號）
        </p>
      )}

      {/* Animation mode */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">揭曉方式</p>
        <div className="flex gap-1.5 flex-wrap">
          {(["SCRATCH", "TEAR", "FLIP", "INSTANT"] as AnimationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onAnimModeChange(m)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                animMode === m
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-300",
              )}
            >
              {ANIMATION_MODE_ZH[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Cost */}
      <div className={cn(
        "flex items-center justify-between text-sm rounded-lg px-3 py-2",
        canAfford
          ? "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
          : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800",
      )}>
        <span className="text-gray-600 dark:text-gray-400">費用</span>
        <span className={cn("font-bold tabular-nums", canAfford ? "text-indigo-700 dark:text-indigo-300" : "text-rose-600 dark:text-rose-400")}>
          {cost.toLocaleString()} 點
          {!canAfford && <span className="text-xs font-normal ml-1">（點數不足）</span>}
        </span>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onConfirmDraw}
          disabled={!canDraw}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm"
        >
          {isSubmitting ? "抽籤中..." : "確認抽取"}
        </button>
        <button
          type="button"
          onClick={onEndTurn}
          className="w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          結束回合
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spectator overlay (when another player is drawing)
// ─────────────────────────────────────────────────────────────────────────────

interface SpectatorOverlayProps {
  drawerNickname: string;
  animationMode: string | null;
  currentFrame: import("@/hooks/useDrawInputSync").TouchFrame | null;
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  onClose: () => void;
}

function SpectatorOverlay({
  drawerNickname,
  animationMode,
  currentFrame,
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  onClose,
}: SpectatorOverlayProps) {
  const handleRevealed = useCallback(() => {
    // Spectator animation completes — auto-close after short delay
    setTimeout(onClose, 1500);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)" }}
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-900/30 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
            LIVE
          </span>
          {animationMode && (
            <span className="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-0.5 rounded-full">
              {ANIMATION_MODE_ZH[animationMode] ?? animationMode}
            </span>
          )}
        </div>
        <p className="text-white text-sm font-semibold">
          正在觀看 <span className="text-indigo-300">{drawerNickname}</span> 的抽獎
        </p>
      </div>

      {/* Animation area */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ width: "min(320px, 88vw)", height: "min(440px, 72vh)" }}
      >
        {animationMode === "SCRATCH" ? (
          <ScratchReveal
            prizePhotoUrl={prizePhotoUrl || "/placeholder-prize.jpg"}
            onRevealed={handleRevealed}
            remoteTouchInput={currentFrame}
            isSpectatorMode
          />
        ) : animationMode === "FLIP" ? (
          <FlipReveal
            prizePhotoUrl={prizePhotoUrl || "/placeholder-prize.jpg"}
            prizeGrade={prizeGrade}
            prizeName={prizeName}
            onRevealed={handleRevealed}
          />
        ) : (
          // Tear / Instant / unknown — show placeholder card
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl">
            <div className="text-center space-y-3">
              <span className="text-6xl animate-pulse">🎫</span>
              <p className="text-white/70 text-sm">抽籤進行中...</p>
            </div>
          </div>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="text-white/60 hover:text-white text-sm transition-colors"
      >
        關閉觀戰視窗
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function CampaignDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <Skeleton className="w-16 h-8 rounded-lg" />
          <Skeleton className="flex-1 h-7 rounded-lg" />
          <Skeleton className="w-24 h-6 rounded-full" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Prize gallery skeleton */}
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-24 space-y-2">
              <Skeleton className="w-24 h-24 rounded-xl" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
        {/* Main layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {/* Box tabs */}
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
            {/* Grid */}
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
              {Array.from({ length: 80 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const player = useAuthStore((s) => s.player);
  const chatRoomId = id ? `kuji:${id}` : "";

  // ── Remote state ─────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<KujiCampaignDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Tickets per box (keyed by boxId)
  const [ticketMap, setTicketMap] = useState<Map<string, TicketDto[]>>(new Map());
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [playerPoints, setPlayerPoints] = useState(1250); // demo fallback
  const [spectatorCount] = useState(128);
  const [recentWins, setRecentWins] = useState<WinRecord[]>(MOCK_RECENT_WINS);

  // ── Page state machine ───────────────────────────────────────────────────
  const [pageMode, dispatch] = useReducer(pageReducer, { type: "BROWSING" });

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"manual" | "random">("random");
  const [drawQuantity, setDrawQuantity] = useState<number>(1);
  const [animMode, setAnimMode] = useState<AnimationMode>("SCRATCH");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Realtime hooks ───────────────────────────────────────────────────────
  const { activeDrawSession, lastRevealed, clearRevealed } = useDrawSync(id);
  const drawInputSync = useDrawInputSync(id);
  const { currentEmoji } = useReactionQueue();

  // ── Countdown timer ──────────────────────────────────────────────────────
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((expiresAt: string | null, sessionSecs: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const remaining = expiresAt
        ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
        : sessionSecs;
      dispatch({ type: "TICK_COUNTDOWN", seconds: remaining });
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        dispatch({ type: "ANIMATION_DONE" });
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Load campaign detail ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<KujiCampaignDetailDto>(`/api/v1/campaigns/kuji/${id}`)
      .then((data) => {
        setDetail(data);
        setSelectedBoxId(data.boxes[0]?.id ?? null);
      })
      .catch(() => {
        // Fall back to mock data
        setDetail({ campaign: MOCK_CAMPAIGN, boxes: MOCK_BOXES, prizes: MOCK_PRIZES });
        setSelectedBoxId(MOCK_BOXES[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Load player wallet points ─────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    apiClient
      .get<{ drawPoints: number }>("/api/v1/players/me/wallet")
      .then((w) => setPlayerPoints(w.drawPoints))
      .catch(() => {}); // keep demo fallback
  }, [player]);

  // ── Load tickets for selected box ────────────────────────────────────────
  useEffect(() => {
    if (!id || !selectedBoxId) return;
    if (ticketMap.has(selectedBoxId)) return;
    setTicketsLoading(true);
    apiClient
      .get<{ tickets: TicketDto[] }>(`/api/v1/campaigns/kuji/${id}/boxes/${selectedBoxId}/tickets`)
      .then(({ tickets }) => {
        setTicketMap((prev) => new Map(prev).set(selectedBoxId, tickets));
      })
      .catch(() => {
        // Fall back to mock tickets
        setTicketMap((prev) => new Map(prev).set(selectedBoxId, buildMockTickets(selectedBoxId)));
      })
      .finally(() => setTicketsLoading(false));
  }, [id, selectedBoxId, ticketMap]);

  // ── Spectator draw sync → show spectator overlay ─────────────────────────
  useEffect(() => {
    if (!activeDrawSession) {
      dispatch({ type: "SPECTATOR_ENDED" });
      return;
    }
    if (player && activeDrawSession.playerId === player.id) return; // my own draw
    dispatch({
      type: "SPECTATOR_STARTED",
      drawerId: activeDrawSession.playerId,
      drawerNickname: activeDrawSession.nickname,
    });
  }, [activeDrawSession, player]);

  // ── WebSocket board updates: mark tickets drawn ───────────────────────────
  useEffect(() => {
    if (!lastRevealed) return;
    // Patch all box ticket lists: mark this ticket drawn
    if (lastRevealed.ticketId) {
      setTicketMap((prev) => {
        const next = new Map(prev);
        for (const [boxId, tickets] of next) {
          const idx = tickets.findIndex((t) => t.id === lastRevealed.ticketId);
          if (idx !== -1) {
            const updated = [...tickets];
            updated[idx] = {
              ...updated[idx],
              status: "DRAWN",
              grade: lastRevealed.grade,
              prizeName: lastRevealed.prizeName,
              prizePhotoUrl: lastRevealed.photoUrl,
              drawnByNickname: activeDrawSession?.nickname ?? null,
            };
            next.set(boxId, updated);
          }
        }
        return next;
      });
      // Add to recent wins feed
      setRecentWins((prev) => [
        {
          id: `w-${Date.now()}`,
          nickname: activeDrawSession?.nickname ?? "玩家",
          grade: lastRevealed.grade,
          prizeName: lastRevealed.prizeName,
          prizePhotoUrl: lastRevealed.photoUrl,
          at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
    }
    clearRevealed();
  }, [lastRevealed, clearRevealed, activeDrawSession]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentTickets = useMemo(
    () => (selectedBoxId ? (ticketMap.get(selectedBoxId) ?? []) : []),
    [selectedBoxId, ticketMap],
  );

  const availableTickets = useMemo(
    () => currentTickets.filter((t) => t.status === "AVAILABLE"),
    [currentTickets],
  );

  const selectedBox = useMemo(
    () => detail?.boxes.find((b) => b.id === selectedBoxId) ?? detail?.boxes[0] ?? null,
    [detail, selectedBoxId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectTicket = useCallback((ticketId: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(ticketId) ? prev.filter((x) => x !== ticketId) : [...prev, ticketId],
    );
  }, []);

  const handleJoinQueue = useCallback(async () => {
    if (!selectedBoxId || !detail) return;
    setIsJoining(true);
    setActionError(null);
    try {
      const entry = await apiClient.post<QueueEntryDto>(`/api/v1/campaigns/kuji/${id}/queue`, {
        boxId: selectedBoxId,
      });
      dispatch({ type: "JOIN_QUEUE", entry });
    } catch {
      // Demo mode: simulate queue join
      const mockEntry: QueueEntryDto = {
        id: `q-${Date.now()}`,
        position: 3,
        status: "WAITING",
        joinedAt: new Date().toISOString(),
        queueLength: 5,
        sessionExpiresAt: null,
      };
      dispatch({ type: "JOIN_QUEUE", entry: mockEntry });
    } finally {
      setIsJoining(false);
    }
  }, [id, selectedBoxId, detail]);

  const handleLeaveQueue = useCallback(async () => {
    setIsLeaving(true);
    setActionError(null);
    try {
      if (pageMode.type === "IN_QUEUE" || pageMode.type === "MY_TURN") {
        const entryId = pageMode.type === "IN_QUEUE"
          ? pageMode.entry.id
          : pageMode.entry.id;
        await apiClient.delete(`/api/v1/campaigns/kuji/${id}/queue/${entryId}`);
      }
    } catch {
      // Ignore — proceed anyway
    } finally {
      setIsLeaving(false);
      dispatch({ type: "LEAVE_QUEUE" });
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [id, pageMode]);

  const handleConfirmDraw = useCallback(async () => {
    if (!selectedBoxId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const body =
        selectionMode === "random"
          ? { boxId: selectedBoxId, quantity: drawQuantity, mode: "RANDOM", animationMode: animMode }
          : { boxId: selectedBoxId, ticketIds: selectedTicketIds, mode: "MANUAL", animationMode: animMode };

      const result = await apiClient.post<DrawResultDto>(`/api/v1/draws/kuji`, body);
      dispatch({ type: "START_DRAWING", tickets: result.tickets });
      setSelectedTicketIds([]);
    } catch {
      // Demo mode: simulate draw result
      const qty = selectionMode === "random" ? drawQuantity : selectedTicketIds.length;
      const demoTickets: DrawnTicketResultDto[] = Array.from({ length: Math.max(1, qty) }, (_, i) => {
        const prize = MOCK_PRIZES[i % MOCK_PRIZES.length]!;
        return {
          ticketId: `demo-${Date.now()}-${i}`,
          position: availableTickets[i]?.position ?? i + 1,
          prizeInstanceId: `pi-${i}`,
          grade: prize.grade,
          prizeName: prize.name,
          prizePhotoUrl: prize.photos[0] ?? "",
          pointsCharged: detail?.campaign.pricePerDraw ?? 350,
        };
      });
      dispatch({ type: "START_DRAWING", tickets: demoTickets });
      setSelectedTicketIds([]);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedBoxId, selectionMode, drawQuantity, selectedTicketIds, animMode, availableTickets, detail]);

  const handleEndTurn = useCallback(async () => {
    if (pageMode.type === "MY_TURN") {
      try {
        await apiClient.post(`/api/v1/campaigns/kuji/${id}/queue/${pageMode.entry.id}/end`);
      } catch {
        // Ignore
      }
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    dispatch({ type: "ANIMATION_DONE" });
  }, [id, pageMode]);

  // Simulate queue activation after 3s in demo mode
  useEffect(() => {
    if (pageMode.type !== "IN_QUEUE") return;
    const timer = setTimeout(() => {
      const activated: QueueEntryDto = {
        ...pageMode.entry,
        status: "ACTIVE",
        sessionExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      dispatch({ type: "QUEUE_ACTIVATED", entry: activated });
      startCountdown(activated.sessionExpiresAt, detail?.campaign.drawSessionSeconds ?? 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pageMode, detail, startCountdown]);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) return <CampaignDetailSkeleton />;

  if (loadError || !detail) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">😞</span>
        <p className="text-gray-600 dark:text-gray-400">{loadError ?? "找不到此活動"}</p>
        <button
          type="button"
          onClick={() => router.push("/campaigns")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          返回活動列表
        </button>
      </div>
    );
  }

  const { campaign, boxes, prizes } = detail;
  const statusLabel = STATUS_ZH[campaign.status] ?? campaign.status;
  const isMyTurn = pageMode.type === "MY_TURN";
  const isInQueue = pageMode.type === "IN_QUEUE";
  const isDrawing = pageMode.type === "DRAWING";

  // Current animation in multi-draw sequence
  const currentDrawTicket =
    pageMode.type === "DRAWING" ? pageMode.tickets[pageMode.animIndex] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">

      {/* ── Spectator overlay (another player is drawing) ──────────────────── */}
      {pageMode.type === "SPECTATING" && (
        <SpectatorOverlay
          drawerNickname={pageMode.drawerNickname}
          animationMode={drawInputSync.animationMode}
          currentFrame={drawInputSync.currentFrame}
          prizePhotoUrl=""
          prizeGrade=""
          prizeName=""
          onClose={() => dispatch({ type: "SPECTATOR_ENDED" })}
        />
      )}

      {/* ── Draw animation overlay (my draw) ──────────────────────────────── */}
      {isDrawing && currentDrawTicket && (
        <AnimatedReveal
          mode={animMode}
          prizePhotoUrl={currentDrawTicket.prizePhotoUrl || ""}
          prizeGrade={currentDrawTicket.grade}
          prizeName={currentDrawTicket.prizeName}
          onRevealed={() => {
            if (pageMode.type === "DRAWING") {
              if (pageMode.animIndex + 1 < pageMode.tickets.length) {
                dispatch({ type: "NEXT_ANIMATION" });
              } else {
                dispatch({ type: "ANIMATION_DONE" });
              }
            }
          }}
          onDismiss={() => dispatch({ type: "ANIMATION_DONE" })}
        />
      )}

      {/* ── Top nav bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          {/* Back */}
          <Link
            href="/campaigns"
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0 text-sm font-medium"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">返回</span>
          </Link>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Title */}
          <h1 className="flex-1 text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
            {campaign.title}
          </h1>

          {/* Live indicators */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>👀</span>
              <span data-testid="spectator-count" className="tabular-nums">
                {spectatorCount.toLocaleString()}
              </span>
              <span className="hidden sm:inline">人</span>
            </span>
            {activeDrawSession && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            <StatusBadge status={statusLabel} />
          </div>
        </div>

        {/* Active draw progress bar */}
        {activeDrawSession && (
          <div className="h-1 bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.round(activeDrawSession.progress * 100)}%` }}
            />
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">

        {/* Campaign meta strip */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status="一番賞" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            每抽 <span className="font-bold text-indigo-600 dark:text-indigo-400">{campaign.pricePerDraw.toLocaleString()} 點</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            場次 {Math.floor(campaign.drawSessionSeconds / 60)} 分鐘
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {boxes.length} 個籤盒
          </span>
          {campaign.description && (
            <p className="w-full text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {campaign.description}
            </p>
          )}
        </div>

        {/* ── Prize gallery ───────────────────────────────────────────────── */}
        {prizes.length > 0 && (
          <section aria-label="賞品一覽">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              賞品一覽
            </h2>
            <PrizeGallery prizes={prizes} />
          </section>
        )}

        {/* ── Main grid + sidebar ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

          {/* ── Left: box tabs + ticket grid ─────────────────────────────── */}
          <div className="space-y-4 min-w-0">

            {/* Box tabs */}
            {boxes.length > 0 && (
              <div
                role="tablist"
                aria-label="籤盒"
                className="flex gap-1.5 overflow-x-auto pb-1"
              >
                {boxes.map((box) => {
                  const drawnCount = box.totalTickets - box.remainingTickets;
                  const pct = Math.round((drawnCount / box.totalTickets) * 100);
                  return (
                    <button
                      key={box.id}
                      role="tab"
                      aria-selected={selectedBoxId === box.id}
                      type="button"
                      onClick={() => setSelectedBoxId(box.id)}
                      className={cn(
                        "shrink-0 flex flex-col items-start px-3.5 py-2 rounded-xl text-sm font-medium transition-all",
                        selectedBoxId === box.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600",
                      )}
                    >
                      <span>{box.name}</span>
                      <span className={cn("text-[10px] tabular-nums mt-0.5", selectedBoxId === box.id ? "text-indigo-200" : "text-gray-400 dark:text-gray-500")}>
                        已抽 {drawnCount}/{box.totalTickets} ({pct}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ticket board */}
            <section
              aria-label="籤面"
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4"
            >
              {/* Board header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    籤面
                  </h2>
                  {selectedBox && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      剩 {selectedBox.remainingTickets} / {selectedBox.totalTickets} 張
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
                    可抽
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200 inline-block" />
                    已抽
                  </span>
                  {isMyTurn && selectionMode === "manual" && (
                    <span className="flex items-center gap-1 text-indigo-500">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border-2 border-amber-500 ring-1 ring-amber-400 inline-block" />
                      已選
                    </span>
                  )}
                </div>
              </div>

              {/* Grid */}
              {ticketsLoading ? (
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : currentTickets.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                  暫無籤面資料
                </div>
              ) : (
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(10, Math.ceil(Math.sqrt(currentTickets.length * 1.2)))}, minmax(0, 1fr))`,
                  }}
                >
                  {currentTickets.map((ticket) => (
                    <TicketCell
                      key={ticket.id}
                      ticket={ticket}
                      isSelectable={isMyTurn && selectionMode === "manual"}
                      isSelected={selectedTicketIds.includes(ticket.id)}
                      onSelect={handleSelectTicket}
                    />
                  ))}
                </div>
              )}

              {/* Selection count badge (manual mode) */}
              {isMyTurn && selectionMode === "manual" && selectedTicketIds.length > 0 && (
                <div className="mt-3 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    已選 {selectedTicketIds.length} 張
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketIds([])}
                    className="text-[10px] text-amber-500 hover:text-amber-700 underline"
                  >
                    清除選擇
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────────── */}
          <aside className="space-y-4" aria-label="側欄">

            {/* Queue / My Turn panel */}
            {(isInQueue || isMyTurn) && (
              <>
                {isInQueue && pageMode.type === "IN_QUEUE" && (
                  <QueueStatusCard
                    entry={pageMode.entry}
                    onLeave={handleLeaveQueue}
                    isLeaving={isLeaving}
                  />
                )}
                {isMyTurn && pageMode.type === "MY_TURN" && detail && (
                  <MyTurnPanel
                    entry={pageMode.entry}
                    countdown={pageMode.countdown}
                    pricePerDraw={campaign.pricePerDraw}
                    playerPoints={playerPoints}
                    selectedTicketIds={selectedTicketIds}
                    selectionMode={selectionMode}
                    quantity={drawQuantity}
                    animMode={animMode}
                    isSubmitting={isSubmitting}
                    onSelectionModeChange={setSelectionMode}
                    onQuantityChange={setDrawQuantity}
                    onAnimModeChange={setAnimMode}
                    onConfirmDraw={handleConfirmDraw}
                    onEndTurn={handleEndTurn}
                  />
                )}
              </>
            )}

            {/* Spectator notice */}
            {pageMode.type === "SPECTATING" && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">正在觀戰</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {pageMode.drawerNickname} 抽籤中...
                </p>
              </div>
            )}

            {/* Recent wins */}
            <RecentWins records={recentWins} />

            {/* Campaign info card */}
            {campaign.coverImageUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={campaign.coverImageUrl}
                  alt={campaign.title}
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* ── Sticky bottom action bar ──────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
        style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.08)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {actionError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mb-2 text-center">{actionError}</p>
          )}
          <div className="flex items-center gap-3">
            {/* Points display */}
            {player && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500 dark:text-gray-400 text-xs">你的點數</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {playerPoints.toLocaleString()}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">點</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Queue info */}
            {pageMode.type === "BROWSING" && !activeDrawSession && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                目前無人排隊
              </span>
            )}
            {pageMode.type === "BROWSING" && activeDrawSession && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                {activeDrawSession.nickname} 正在抽籤
              </span>
            )}

            {/* Primary CTA */}
            {pageMode.type === "BROWSING" && (
              <button
                data-testid="join-queue-btn"
                type="button"
                onClick={handleJoinQueue}
                disabled={isJoining || campaign.status !== "ACTIVE" || !selectedBox}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-sm active:scale-95"
              >
                {isJoining ? "加入中..." : "加入排隊"}
              </button>
            )}

            {pageMode.type === "IN_QUEUE" && (
              <>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                  等待中，請稍候...
                </span>
                <button
                  type="button"
                  onClick={handleLeaveQueue}
                  disabled={isLeaving}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {isLeaving ? "處理中..." : "離開排隊"}
                </button>
              </>
            )}

            {pageMode.type === "MY_TURN" && (
              <>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                  輪到你了！
                </span>
                <button
                  type="button"
                  onClick={handleConfirmDraw}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-sm active:scale-95"
                >
                  {isSubmitting ? "抽籤中..." : "快速抽取"}
                </button>
              </>
            )}

            {pageMode.type === "SPECTATING" && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                觀戰中
              </span>
            )}

            {pageMode.type === "DRAWING" && (
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                揭曉中... ({pageMode.animIndex + 1}/{pageMode.tickets.length})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {chatRoomId && <ChatPanel roomId={chatRoomId} />}

      {/* ── Floating reaction overlay ─────────────────────────────────────── */}
      {chatRoomId && (
        <div className="fixed inset-0 pointer-events-none z-30" aria-hidden="true">
          <ReactionOverlay emoji={currentEmoji} />
        </div>
      )}
    </div>
  );
}
