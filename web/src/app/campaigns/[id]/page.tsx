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
import { useTranslations } from "next-intl";
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
import { toast } from "@/components/Toast";
import { FavoriteButton } from "@/components/FavoriteButton";

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
  isFavorited?: boolean;
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

// Status and animation labels are resolved via i18n at call sites.

const DRAW_QUANTITIES = [1, 3, 5, 12] as const;

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function makePrizePlaceholder(grade: string, name: string): string {
  const colors: Record<string, [string, string]> = {
    A: ["#f59e0b", "#fbbf24"], B: ["#3b82f6", "#60a5fa"],
    C: ["#10b981", "#34d399"], D: ["#a855f7", "#c084fc"],
  };
  const key = grade.charAt(0);
  const [c1, c2] = colors[key] ?? ["#6366f1", "#818cf8"];
  const icon = key === "A" ? "👑" : key === "B" ? "💎" : key === "C" ? "🌟" : "🎁";
  const safe = (name || "獎品").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="340" height="480" viewBox="0 0 340 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="340" height="480" rx="16" fill="url(#g)"/><text x="170" y="180" text-anchor="middle" font-size="72">${icon}</text><text x="170" y="260" text-anchor="middle" font-family="system-ui" font-size="36" font-weight="900" fill="white">${grade}</text><text x="170" y="310" text-anchor="middle" font-family="system-ui" font-size="18" fill="white" opacity="0.85">${safe}</text></svg>`)}`;
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

// Prize grade color mapping for dark theme ticket cells
const GRADE_DARK: Record<string, string> = {
  "A賞": "bg-amber-900/40",
  "B賞": "bg-blue-900/40",
  "C賞": "bg-emerald-900/40",
  "D賞": "bg-purple-900/40",
  "E賞": "bg-secondary-container/40",
  "Last賞": "bg-amber-800/50",
  "LAST賞": "bg-amber-800/50",
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
  const t = useTranslations("campaign");
  const isDrawn = ticket.status === "DRAWN";
  const gradeStyle = ticket.grade ? (GRADE_DARK[ticket.grade] ?? "bg-surface-container-high") : "";

  return (
    <button
      type="button"
      aria-label={isDrawn ? `${ticket.position} ${t("ticketDrawn")} ${ticket.grade ?? ""}` : `${ticket.position} ${t("ticketAvailable")}`}
      aria-pressed={isSelected}
      disabled={isDrawn || (!isSelectable && !isSelected)}
      onClick={() => !isDrawn && isSelectable && onSelect(ticket.id)}
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg flex flex-col items-center justify-center text-xs transition-all duration-150",
        isDrawn
          ? cn(gradeStyle || "bg-surface-container-high", "cursor-default")
          : isSelectable
          ? cn(
              "bg-primary/15 hover:bg-primary/25 cursor-pointer",
              isSelected && "ring-2 ring-primary bg-primary/30 scale-105 shadow-md",
            )
          : "bg-primary/10 cursor-default",
      )}
    >
      {/* Ticket number — always visible */}
      <span className={cn(
        "select-none font-bold tabular-nums text-[10px] leading-none",
        isDrawn ? "text-on-surface/40 absolute top-0.5 left-1 z-10" : "text-primary text-sm",
      )}>
        {ticket.position.toString().padStart(2, "0")}
      </span>

      {isDrawn && (
        <>
          {ticket.prizePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.prizePhotoUrl}
              alt={ticket.grade ?? ""}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          ) : (
            <span className="text-base select-none mt-0.5">
              {ticket.grade === "A賞" ? "🥇" :
               ticket.grade === "B賞" ? "🥈" :
               ticket.grade?.includes("Last") ? "🌟" : "🎁"}
            </span>
          )}
          {/* Grade badge overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-bold text-primary text-center py-0.5 leading-tight truncate px-0.5">
            {ticket.grade}
          </div>
          {/* Drawn-by label */}
          {ticket.drawnByNickname && (
            <div className="absolute top-0 right-0 left-3 truncate bg-black/40 px-0.5 text-right text-[7px] text-on-surface/60">
              {ticket.drawnByNickname}
            </div>
          )}
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prize Gallery
// ─────────────────────────────────────────────────────────────────────────────

function useStatusLabel() {
  const t = useTranslations("campaign");
  return (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: t("statusActive"),
      SOLD_OUT: t("statusSoldOut"),
      INACTIVE: t("statusInactive"),
      DRAFT: t("statusDraft"),
    };
    return map[status] ?? status;
  };
}

function useAnimLabel() {
  const t = useTranslations("campaign");
  return (mode: string) => {
    const map: Record<string, string> = {
      TEAR: t("animTear"),
      SCRATCH: t("animScratch"),
      FLIP: t("animFlip"),
      INSTANT: t("animInstant"),
    };
    return map[mode] ?? mode;
  };
}

function PrizeGallery({ prizes }: { prizes: PrizeDefinitionDto[] }) {
  return (
    <div className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {prizes.map((prize) => (
        <div key={prize.id} className="w-24 shrink-0 snap-start">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high gacha-glow">
            {prize.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.photos[0]}
                alt={prize.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl select-none">
                {prize.grade === "A賞" ? "🥇" :
                 prize.grade === "B賞" ? "🥈" :
                 prize.grade?.includes("Last") ? "🌟" : "🎁"}
              </span>
            )}
          </div>
          <div className="mt-1.5 space-y-0.5">
            <GradeBadge grade={prize.grade} className="text-[10px] px-1.5 py-0" />
            <p className="line-clamp-2 text-xs font-medium leading-tight text-on-surface">
              {prize.name}
            </p>
            {prize.ticketCount !== null && (
              <p className="text-[10px] text-on-surface-variant">
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
  const t = useTranslations("campaign");
  if (records.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {t("recentWins")}
      </h3>
      <div className="space-y-1.5">
        {records.slice(0, 5).map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-lg bg-surface-container-high px-2.5 py-2"
          >
            {r.prizePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.prizePhotoUrl}
                alt={r.prizeName}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-base">
                🏆
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="truncate text-[11px] font-medium text-on-surface">
                  {r.nickname}
                </span>
                <GradeBadge grade={r.grade} className="text-[9px] px-1 py-0" />
              </div>
              <p className="truncate text-[10px] text-on-surface-variant">{r.prizeName}</p>
            </div>
            <time className="shrink-0 self-end text-[9px] text-on-surface-variant">
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
  const t = useTranslations("campaign");
  const ahead = Math.max(0, entry.position - 1);
  return (
    <div className="space-y-3 rounded-xl bg-surface-container p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          {t("queueing")}
        </span>
        <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {t("queueTotal", { count: entry.queueLength })}
        </span>
      </div>
      <div className="py-2 text-center">
        <div className="font-headline text-4xl font-black text-primary">
          #{entry.position}
        </div>
        <div className="mt-1 text-xs text-on-surface-variant">
          {ahead === 0 ? t("queueAlmostYourTurn") : t("queueAhead", { count: ahead })}
        </div>
      </div>
      <button
        type="button"
        onClick={onLeave}
        disabled={isLeaving}
        className="w-full rounded-lg border border-error/30 bg-error-container/10 py-2 text-sm font-medium text-error transition-colors disabled:opacity-50 hover:bg-error-container/20"
      >
        {isLeaving ? t("processingAction") : t("leaveQueue")}
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
  onTopUp: () => void;
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
  onTopUp,
}: MyTurnPanelProps) {
  const t = useTranslations("campaign");
  const getAnimLabel = useAnimLabel();
  const cost = selectionMode === "manual" ? selectedTicketIds.length * pricePerDraw : quantity * pricePerDraw;
  const canAfford = playerPoints >= cost;
  const canDraw =
    !isSubmitting &&
    canAfford &&
    (selectionMode === "random" ? quantity > 0 : selectedTicketIds.length > 0);

  const countdownColor =
    countdown <= 30 ? "text-error animate-pulse" :
    countdown <= 60 ? "text-primary" :
    "text-tertiary";

  return (
    <div className="space-y-4 rounded-xl bg-surface-container p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-headline text-sm font-bold text-on-surface">{t("yourTurnHeader")}</span>
        <span className={cn("font-black text-xl tabular-nums", countdownColor)}>
          {formatCountdown(countdown)}
        </span>
      </div>

      {/* Selection mode */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-on-surface-variant">{t("selectionMethod")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["manual", "random"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSelectionModeChange(m)}
              className={cn(
                "rounded-lg py-2 text-xs font-semibold transition-all",
                selectionMode === m
                  ? "amber-gradient text-on-primary shadow-sm"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface",
              )}
            >
              {m === "manual" ? t("manualSelect") : t("randomSelect")}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity (random mode only) */}
      {selectionMode === "random" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-on-surface-variant">{t("drawQuantity")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DRAW_QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuantityChange(q)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  quantity === q
                    ? "amber-gradient text-on-primary shadow-sm"
                    : "bg-surface-container-high text-on-surface-variant hover:text-on-surface",
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
        <p className="text-xs text-on-surface-variant">
          {t("selectionCount", { count: selectedTicketIds.length })}
        </p>
      )}

      {/* Animation mode */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-on-surface-variant">{t("revealMethod")}</p>
        <div className="flex flex-wrap gap-1.5">
          {(["SCRATCH", "TEAR", "FLIP", "INSTANT"] as AnimationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onAnimModeChange(m)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                animMode === m
                  ? "bg-secondary/20 text-secondary ring-1 ring-secondary/40"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface",
              )}
            >
              {getAnimLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Cost */}
      <div className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
        canAfford
          ? "bg-surface-container-high"
          : "bg-error-container/20",
      )}>
        <span className="text-on-surface-variant">{t("cost")}</span>
        <span className={cn("font-bold tabular-nums", canAfford ? "text-primary" : "text-error")}>
          {t("costPoints", { cost: cost.toLocaleString() })}
          {!canAfford && <span className="ml-1 text-xs font-normal">{t("insufficientPointsInline")}</span>}
        </span>
      </div>

      {!canAfford && cost > 0 && (
        <button
          type="button"
          onClick={onTopUp}
          className="w-full rounded-xl bg-primary/10 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
        >
          前往儲值
        </button>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onConfirmDraw}
          disabled={!canDraw}
          className="w-full rounded-xl py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 amber-gradient text-on-primary shadow-sm hover:shadow-md"
        >
          {isSubmitting ? t("drawing") : t("confirmDraw")}
        </button>
        <button
          type="button"
          onClick={onEndTurn}
          className="w-full rounded-xl bg-surface-container-high py-2 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          {t("endTurn")}
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
  const t = useTranslations("campaign");
  const getAnimLabel = useAnimLabel();
  const handleRevealed = useCallback(() => {
    setTimeout(onClose, 1500);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-error-container/30 px-2 py-0.5 text-xs font-bold text-error">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
            LIVE
          </span>
          {animationMode && (
            <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs text-secondary">
              {getAnimLabel(animationMode)}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-on-surface">
          {t("watchingPlayer", { nickname: drawerNickname })}
        </p>
      </div>

      {/* Animation area */}
      <div
        className="relative overflow-hidden rounded-2xl"
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
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-container-low">
            <div className="space-y-3 text-center">
              <span className="material-symbols-outlined animate-pulse block text-6xl text-primary">
                confirmation_number
              </span>
              <p className="text-sm text-on-surface-variant">{t("drawInProgress")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {t("closeSpectator")}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function CampaignDetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-dim">
      {/* Header */}
      <div className="bg-surface-container-low py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-16 rounded-lg bg-surface-container-high" />
          <Skeleton className="h-7 flex-1 rounded-lg bg-surface-container-high" />
          <Skeleton className="h-6 w-24 rounded-full bg-surface-container-high" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Prize gallery skeleton */}
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-24 shrink-0 space-y-2">
              <Skeleton className="h-24 w-24 rounded-xl bg-surface-container" />
              <Skeleton className="h-3 w-16 rounded-full bg-surface-container" />
            </div>
          ))}
        </div>
        {/* Main layout skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-xl bg-surface-container" />
              <Skeleton className="h-9 w-28 rounded-xl bg-surface-container" />
            </div>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: 80 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg bg-surface-container" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl bg-surface-container" />
            <Skeleton className="h-48 rounded-xl bg-surface-container" />
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
  const t = useTranslations("campaign");
  const getStatusLabel = useStatusLabel();

  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const player = useAuthStore((s) => s.player);
  const chatRoomId = id ? `kuji:${id}` : "";

  // Remote state
  const [detail, setDetail] = useState<KujiCampaignDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Tickets per box (keyed by boxId)
  const [ticketMap, setTicketMap] = useState<Map<string, TicketDto[]>>(new Map());
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [playerPoints, setPlayerPoints] = useState(0);
  const [spectatorCount] = useState(0);
  const [recentWins, setRecentWins] = useState<WinRecord[]>([]);

  // Page state machine
  const [pageMode, dispatch] = useReducer(pageReducer, { type: "BROWSING" });

  // Selection state
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<"manual" | "random">("random");
  const [drawQuantity, setDrawQuantity] = useState<number>(1);
  const [animMode, setAnimMode] = useState<AnimationMode>("SCRATCH");

  // UI state
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [isTopUpProcessing, setIsTopUpProcessing] = useState(false);

  // Realtime hooks
  const { activeDrawSession, lastRevealed, clearRevealed } = useDrawSync(id);
  const drawInputSync = useDrawInputSync(id);
  const { currentEmoji } = useReactionQueue();

  // Countdown timer
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
        toast.info(t("turnExpired"));
        dispatch({ type: "ANIMATION_DONE" });
      }
    }, 1000);
  }, [t]);

  // Start countdown when entering MY_TURN
  useEffect(() => {
    if (pageMode.type === "MY_TURN") {
      startCountdown(pageMode.entry.sessionExpiresAt, detail?.campaign.drawSessionSeconds ?? 300);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [pageMode.type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Load campaign detail
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<KujiCampaignDetailDto>(`/api/v1/campaigns/kuji/${id}`)
      .then((data) => {
        setDetail(data);
        setSelectedBoxId(data.boxes[0]?.id ?? null);
        // Fetch real draw records to populate the recent wins feed
        apiClient.get<Array<{
          ticketId: string;
          position: number;
          grade: string;
          prizeName: string;
          prizePhotoUrl: string | null;
          playerNickname: string;
          drawnAt: string;
        }>>(`/api/v1/campaigns/${id}/draw-records?limit=20`)
          .then((records) => {
            setRecentWins(records.map((r) => ({
              id: r.ticketId,
              nickname: r.playerNickname,
              grade: r.grade,
              prizeName: r.prizeName,
              prizePhotoUrl: r.prizePhotoUrl,
              at: r.drawnAt,
            })));
          })
          .catch(() => {}); // silently fail if endpoint not available
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "載入失敗");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Load player wallet points
  useEffect(() => {
    if (!player) return;
    apiClient
      .get<{ drawPoints: number }>("/api/v1/players/me/wallet")
      .then((w) => setPlayerPoints(w.drawPoints))
      .catch(() => setPlayerPoints(0));
  }, [player]);

  // Load tickets for selected box
  useEffect(() => {
    if (!id || !selectedBoxId) return;
    if (ticketMap.has(selectedBoxId)) return;
    setTicketsLoading(true);
    apiClient
      .get<TicketDto[]>(`/api/v1/campaigns/kuji/${id}/boxes/${selectedBoxId}/tickets`)
      .then((tickets) => {
        const sorted = (tickets ?? []).sort((a, b) => a.position - b.position);
        setTicketMap((prev) => new Map(prev).set(selectedBoxId, sorted));
      })
      .catch(() => {
        // Leave ticketMap empty for this box; the UI will show an empty grid
      })
      .finally(() => setTicketsLoading(false));
  }, [id, selectedBoxId, ticketMap]);

  // Spectator draw sync → show spectator overlay
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

  // WebSocket board updates: mark tickets drawn
  useEffect(() => {
    if (!lastRevealed) return;
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

  // Derived
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

  // Handlers
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
      const entry = await apiClient.post<QueueEntryDto>(`/api/v1/draws/kuji/queue/join`, {
        ticketBoxId: selectedBoxId,
      });
      if (entry.status === "ACTIVE") {
        dispatch({ type: "QUEUE_ACTIVATED", entry });
      } else {
        dispatch({ type: "JOIN_QUEUE", entry });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "加入排隊失敗");
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
        await apiClient.delete(`/api/v1/draws/kuji/queue/leave`);
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
          ? { ticketBoxId: selectedBoxId, quantity: drawQuantity, mode: "RANDOM", animationMode: animMode }
          : { ticketBoxId: selectedBoxId, ticketIds: selectedTicketIds, mode: "MANUAL", animationMode: animMode };

      const result = await apiClient.post<DrawResultDto>(`/api/v1/draws/kuji`, body);

      // Immediately mark drawn tickets in the local grid
      setTicketMap((prev) => {
        const next = new Map(prev);
        const current = next.get(selectedBoxId);
        if (current) {
          const updated = [...current];
          for (const drawn of result.tickets) {
            const idx = updated.findIndex((t) => t.id === drawn.ticketId);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                status: "DRAWN",
                grade: drawn.grade,
                prizeName: drawn.prizeName,
                prizePhotoUrl: drawn.prizePhotoUrl,
                drawnByNickname: player?.nickname ?? null,
              };
            }
          }
          next.set(selectedBoxId, updated);
        }
        return next;
      });
      // Update remaining count locally
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          boxes: prev.boxes.map((b) =>
            b.id === selectedBoxId
              ? { ...b, remainingTickets: Math.max(0, b.remainingTickets - result.tickets.length) }
              : b,
          ),
        };
      });

      dispatch({ type: "START_DRAWING", tickets: result.tickets });
      setSelectedTicketIds([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "抽獎失敗";
      if (msg.includes("Insufficient") || msg.includes("點數不足") || msg.includes("insufficient")) {
        setShowTopUpDialog(true);
      } else {
        setActionError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedBoxId, selectionMode, drawQuantity, selectedTicketIds, animMode, availableTickets, detail]);

  // Refresh ticket grid + campaign detail from server
  const refreshAfterDraw = useCallback(() => {
    if (selectedBoxId) {
      apiClient
        .get<TicketDto[]>(`/api/v1/campaigns/kuji/${id}/boxes/${selectedBoxId}/tickets`)
        .then((tickets) => {
          const sorted = (tickets ?? []).sort((a, b) => a.position - b.position);
          setTicketMap((prev) => new Map(prev).set(selectedBoxId, sorted));
        })
        .catch(() => {});
    }
    apiClient
      .get<KujiCampaignDetailDto>(`/api/v1/campaigns/kuji/${id}`)
      .then((d) => setDetail(d))
      .catch(() => {});
  }, [id, selectedBoxId]);

  const handleEndTurn = useCallback(async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    dispatch({ type: "ANIMATION_DONE" });
    refreshAfterDraw();
  }, [refreshAfterDraw]);

  // Queue activation is handled by WebSocket push from server
  // When server sends QUEUE_ACTIVATED event, the WebSocket handler dispatches it

  // Render guards
  if (loading) return <CampaignDetailSkeleton />;

  if (loadError || !detail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">
            sentiment_dissatisfied
          </span>
        </div>
        <p className="text-on-surface-variant">{loadError ?? t("notFound")}</p>
        <button
          type="button"
          onClick={() => router.push("/campaigns")}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all amber-gradient text-on-primary hover:shadow-md"
        >
          {t("backToList")}
        </button>
      </div>
    );
  }

  const { campaign, boxes, prizes } = detail;
  const statusLabel = getStatusLabel(campaign.status);
  const isMyTurn = pageMode.type === "MY_TURN";
  const isInQueue = pageMode.type === "IN_QUEUE";
  const isDrawing = pageMode.type === "DRAWING";

  // Current animation in multi-draw sequence
  const currentDrawTicket =
    pageMode.type === "DRAWING" ? pageMode.tickets[pageMode.animIndex] : null;

  // Render
  return (
    <div className="min-h-screen bg-surface-dim pb-28">

      {/* Spectator overlay (another player is drawing) */}
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

      {/* Draw animation overlay (my draw) */}
      {isDrawing && currentDrawTicket && (
        <AnimatedReveal
          mode={animMode}
          prizePhotoUrl={currentDrawTicket.prizePhotoUrl || makePrizePlaceholder(currentDrawTicket.grade, currentDrawTicket.prizeName)}
          prizeGrade={currentDrawTicket.grade}
          prizeName={currentDrawTicket.prizeName}
          onRevealed={() => {
            if (pageMode.type === "DRAWING") {
              if (pageMode.animIndex + 1 < pageMode.tickets.length) {
                dispatch({ type: "NEXT_ANIMATION" });
              } else {
                dispatch({ type: "ANIMATION_DONE" });
                refreshAfterDraw();
              }
            }
          }}
          onDismiss={() => { dispatch({ type: "ANIMATION_DONE" }); refreshAfterDraw(); }}
        />
      )}

      {/* Top nav bar */}
      <header className="sticky top-0 z-30 bg-surface-container-low shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6 lg:px-8">
          {/* Back */}
          <Link
            href="/campaigns"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base leading-none">arrow_back</span>
            <span className="hidden sm:inline">{t("backToList")}</span>
          </Link>

          <div className="h-5 w-px shrink-0 bg-surface-container-highest" />

          {/* Title */}
          <h1 className="flex-1 truncate font-headline text-sm font-bold text-on-surface sm:text-base">
            {campaign.title}
          </h1>

          {/* Favorite button */}
          <FavoriteButton
            campaignType="kuji"
            campaignId={campaign.id}
            initialFavorited={campaign.isFavorited ?? false}
            className="shrink-0 text-2xl px-1"
          />

          {/* Live indicators */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm leading-none text-secondary">
                visibility
              </span>
              <span data-testid="spectator-count" className="tabular-nums font-medium">
                {spectatorCount.toLocaleString()}
              </span>
              <span className="hidden sm:inline">{t("viewers2")}</span>
            </span>
            {activeDrawSession && (
              <span className="flex animate-pulse items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                LIVE
              </span>
            )}
            <StatusBadge status={statusLabel} />
          </div>
        </div>

        {/* Active draw progress bar */}
        {activeDrawSession && (
          <div className="h-0.5 bg-surface-container-highest">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500"
              style={{ width: `${Math.round(activeDrawSession.progress * 100)}%` }}
            />
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 lg:px-8">

        {/* Campaign hero strip */}
        <div className="overflow-hidden rounded-2xl bg-surface-container">
          {campaign.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="h-32 w-full object-cover sm:h-48"
            />
          )}
          <div className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge status={t("ichibanBadge")} />
              <span className="text-xs text-on-surface-variant">
                {t("pricePerDrawMeta", { price: campaign.pricePerDraw.toLocaleString() })}
              </span>
              <span className="text-xs text-on-surface-variant">
                {t("sessionMinutes", { minutes: Math.floor(campaign.drawSessionSeconds / 60) })}
              </span>
              <span className="text-xs text-on-surface-variant">
                {t("boxCount", { count: boxes.length })}
              </span>
            </div>
            {campaign.description && (
              <p className="text-xs leading-relaxed text-on-surface-variant">
                {campaign.description}
              </p>
            )}
          </div>
        </div>

        {/* Prize gallery */}
        {prizes.length > 0 && (
          <section aria-label={t("prizeListTitle")} className="rounded-2xl bg-surface-container p-4">
            <h2 className="mb-3 font-headline text-sm font-bold text-on-surface">{t("prizeListTitle")}</h2>
            <PrizeGallery prizes={prizes} />
          </section>
        )}

        {/* Main grid + sidebar */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">

          {/* Left: box tabs + ticket grid */}
          <div className="min-w-0 space-y-4">

            {/* Box tabs */}
            {boxes.length > 0 && (
              <div
                role="tablist"
                aria-label={t("boxTabsLabel")}
                className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1"
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
                        "shrink-0 flex flex-col items-start rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
                        selectedBoxId === box.id
                          ? "amber-gradient text-on-primary shadow-sm"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface gacha-glow",
                      )}
                    >
                      <span>{box.name}</span>
                      <span className={cn(
                        "mt-0.5 text-[10px] tabular-nums",
                        selectedBoxId === box.id ? "text-on-primary/70" : "text-on-surface-variant",
                      )}>
                        {t("boxDrawnPct", { drawn: drawnCount, total: box.totalTickets, pct })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ticket board */}
            <section
              aria-label={t("ticketBoardTitle")}
              className="rounded-2xl bg-surface-container p-3 sm:p-4"
            >
              {/* Board header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-sm font-bold text-on-surface">{t("ticketBoardTitle")}</h2>
                  {selectedBox && (
                    <span className="text-xs tabular-nums text-on-surface-variant">
                      {t("ticketRemaining", { remaining: selectedBox.remainingTickets, total: selectedBox.totalTickets })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/20" />
                    {t("ticketAvailable")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-surface-container-high" />
                    {t("ticketDrawn")}
                  </span>
                  {isMyTurn && selectionMode === "manual" && (
                    <span className="flex items-center gap-1 text-primary">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30 ring-1 ring-primary" />
                      {t("ticketSelected")}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid */}
              {ticketsLoading ? (
                <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg bg-surface-container-high" />
                  ))}
                </div>
              ) : currentTickets.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-on-surface-variant">
                  {t("ticketNoData")}
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
                <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                  <span className="text-xs font-medium text-primary">
                    {t("selectionCount", { count: selectedTicketIds.length })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketIds([])}
                    className="text-[10px] text-primary/70 underline hover:text-primary"
                  >
                    {t("clearSelection")}
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4" aria-label={t("sidebarLabel")}>

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
                    onTopUp={() => setShowTopUpDialog(true)}
                  />
                )}
              </>
            )}

            {/* Spectator notice */}
            {pageMode.type === "SPECTATING" && (
              <div className="rounded-xl bg-surface-container p-3 text-center">
                <div className="mb-1 flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                  <span className="text-xs font-bold text-error">{t("spectating")}</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {t("spectatorDrawing", { nickname: pageMode.drawerNickname })}
                </p>
              </div>
            )}

            {/* Recent wins */}
            <RecentWins records={recentWins} />

            {/* Campaign cover image */}
            {campaign.coverImageUrl && (
              <div className="overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={campaign.coverImageUrl}
                  alt={campaign.title}
                  className="h-32 w-full object-cover"
                />
              </div>
            )}
          </aside>
        </div>
      {/* Top-up dialog */}
      {showTopUpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold text-on-surface">
                點數不足
              </h3>
              <button
                type="button"
                onClick={() => setShowTopUpDialog(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-sm text-on-surface-variant">
              目前持有 <span className="font-bold text-primary">{playerPoints.toLocaleString()}</span> 點，請選擇儲值金額
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 3000, 5000, 10000, 50000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setTopUpAmount(amount)}
                  className={`rounded-xl py-3 text-sm font-bold transition-all ${
                    topUpAmount === amount
                      ? "amber-gradient text-on-primary shadow-md"
                      : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isTopUpProcessing}
              onClick={async () => {
                setIsTopUpProcessing(true);
                try {
                  const res = await apiClient.post<{ pointsCredited: number; newBalance: number }>(
                    "/api/v1/payment/mock-topup",
                    { points: topUpAmount },
                  );
                  setPlayerPoints(res.newBalance);
                  setShowTopUpDialog(false);
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : "儲值失敗");
                  setShowTopUpDialog(false);
                } finally {
                  setIsTopUpProcessing(false);
                }
              }}
              className="w-full amber-gradient py-3.5 rounded-xl font-headline font-bold text-on-primary text-sm shadow-lg disabled:opacity-60"
            >
              {isTopUpProcessing ? "處理中..." : `儲值 ${topUpAmount.toLocaleString()} 點`}
            </button>
          </div>
        </div>
      )}

      </main>

      {/* Sticky bottom action bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 bg-surface-container-low"
        style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.3)" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          {actionError && (
            <p className="mb-2 text-center text-xs text-error">{actionError}</p>
          )}
          <div className="flex items-center gap-3">
            {/* Points display */}
            {player && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-xs text-on-surface-variant">{t("yourPoints")}</span>
                <span className="font-bold tabular-nums text-primary">
                  {playerPoints.toLocaleString()}
                </span>
                <span className="text-xs text-on-surface-variant">{t("pointsUnit")}</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Queue info */}
            {pageMode.type === "BROWSING" && !activeDrawSession && (
              <span className="text-xs text-on-surface-variant">{t("noQueueNow")}</span>
            )}
            {pageMode.type === "BROWSING" && activeDrawSession && (
              <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                {t("someoneDrawing", { nickname: activeDrawSession.nickname })}
              </span>
            )}

            {/* Primary CTA */}
            {pageMode.type === "BROWSING" && (
              <button
                data-testid="join-queue-btn"
                type="button"
                onClick={handleJoinQueue}
                disabled={isJoining || campaign.status !== "ACTIVE" || !selectedBox}
                className="rounded-xl px-6 py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 amber-gradient text-on-primary shadow-sm hover:shadow-md active:scale-95 gold-glow"
              >
                {isJoining ? t("joiningQueue") : t("joinQueueBtn")}
              </button>
            )}

            {pageMode.type === "IN_QUEUE" && (
              <>
                <span className="animate-pulse text-xs font-medium text-secondary">
                  {t("waitingPlease")}
                </span>
                <button
                  type="button"
                  onClick={handleLeaveQueue}
                  disabled={isLeaving}
                  className="rounded-xl bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  {isLeaving ? t("processingAction") : t("leaveQueue")}
                </button>
              </>
            )}

            {pageMode.type === "MY_TURN" && (
              <>
                <span className="animate-pulse font-bold text-primary text-xs">
                  {t("yourTurnHeader")}
                </span>
                <button
                  type="button"
                  onClick={handleConfirmDraw}
                  disabled={isSubmitting}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50 amber-gradient text-on-primary shadow-sm active:scale-95"
                >
                  {isSubmitting ? t("drawing") : t("quickDraw")}
                </button>
              </>
            )}

            {pageMode.type === "SPECTATING" && (
              <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                {t("watchingBadge")}
              </span>
            )}

            {pageMode.type === "DRAWING" && (
              <span className="text-xs font-medium text-secondary">
                {t("revealing", { current: pageMode.animIndex + 1, total: pageMode.tickets.length })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel */}
      {chatRoomId && <ChatPanel roomId={chatRoomId} />}

      {/* Floating reaction overlay */}
      {chatRoomId && (
        <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
          <ReactionOverlay emoji={currentEmoji} />
        </div>
      )}
    </div>
  );
}
