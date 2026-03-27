"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ScratchReveal } from "@/animations/ScratchReveal";
import { TearReveal } from "@/animations/TearReveal";
import { FlipReveal } from "@/animations/FlipReveal";
import { InstantReveal } from "@/animations/InstantReveal";
import { ReactionOverlay, useReactionQueue } from "@/components/ReactionOverlay";
import type { TouchFrame } from "@/hooks/useDrawInputSync";

/**
 * Spectator version of TearReveal — dispatches synthetic pointer events from remote touch frames
 * so the TearReveal canvas responds exactly as if a local finger were dragging.
 */
function SpectatorTearReveal({
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  currentFrame,
  onRevealed,
}: {
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  currentFrame: TouchFrame | null;
  onRevealed: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasDownRef = useRef(false);

  // Dispatch synthetic pointer events on the TearReveal's canvas
  useEffect(() => {
    if (!containerRef.current || !currentFrame) return;
    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + currentFrame.x * rect.width;
    const clientY = rect.top + currentFrame.y * rect.height;

    if (currentFrame.isDown && !wasDownRef.current) {
      // Finger just went down
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        clientX, clientY, bubbles: true, pointerId: 1,
      }));
      wasDownRef.current = true;
    } else if (currentFrame.isDown && wasDownRef.current) {
      // Finger moving
      canvas.dispatchEvent(new PointerEvent("pointermove", {
        clientX, clientY, bubbles: true, pointerId: 1, buttons: 1,
      }));
    } else if (!currentFrame.isDown && wasDownRef.current) {
      // Finger lifted
      canvas.dispatchEvent(new PointerEvent("pointerup", {
        clientX, clientY, bubbles: true, pointerId: 1,
      }));
      wasDownRef.current = false;
    }
  }, [currentFrame]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wasDownRef.current && containerRef.current) {
        const canvas = containerRef.current.querySelector("canvas");
        if (canvas) {
          canvas.dispatchEvent(new PointerEvent("pointerup", {
            clientX: 0, clientY: 0, bubbles: true, pointerId: 1,
          }));
        }
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <TearReveal
        prizePhotoUrl={prizePhotoUrl}
        prizeGrade={prizeGrade}
        prizeName={prizeName}
        onRevealed={onRevealed}
      />
    </div>
  );
}

/**
 * Spectator version of FlipReveal — auto-flips based on remote progress signal.
 * Shows the prize face (not "?") after flip.
 */
function SpectatorFlipReveal({
  prizePhotoUrl,
  prizeGrade,
  prizeName,
  progress,
  onRevealed,
}: {
  prizePhotoUrl: string;
  prizeGrade: string;
  prizeName: string;
  progress: number;
  onRevealed: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const revealedRef = useRef(false);

  // Auto-flip when we get a progress signal (drawer clicked the card)
  useEffect(() => {
    if (progress > 0 && !flipped) {
      setFlipped(true);
      setTimeout(() => {
        if (!revealedRef.current) {
          revealedRef.current = true;
          onRevealed();
        }
      }, 700);
    }
  }, [progress, flipped, onRevealed]);

  return (
    <div className="flex items-center justify-center w-full h-full" style={{ perspective: "900px" }}>
      <div
        className="relative"
        style={{
          width: "min(280px, 80vw)",
          height: "min(400px, 70vh)",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Front face — card back */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 40%, #9333EA 70%, #A855F7 100%)" }}>
            <div className="text-6xl text-white/80 font-black">?</div>
          </div>
        </div>

        {/* Back face — prize */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden bg-white"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prizePhotoUrl} alt={prizeName} className="w-full h-3/5 object-cover" draggable={false} />
          <div className="h-2/5 flex flex-col items-center justify-center p-4 gap-2">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white"
              style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
            >
              {prizeGrade}
            </span>
            <p className="text-center font-bold text-gray-900 text-sm">{prizeName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveSpectatorRoomProps {
  campaignId: string;
  campaignTitle: string;
  currentDrawer?: {
    playerId: string;
    nickname: string;
    /** "TEAR" | "SCRATCH" | "FLIP" | "INSTANT" */
    animationMode: string;
    /** Current remote touch frame (null between touches). */
    currentFrame: TouchFrame | null;
    /** Prize grade (revealed after draw completes). */
    prizeGrade?: string;
    /** Prize name (revealed after draw completes). */
    prizeName?: string;
  } | null;
  /** Your queue position (1-indexed). Undefined = not in queue. */
  queuePosition?: number;
  queueLength: number;
  viewerCount: number;
  recentWins: Array<{
    id?: string;
    nickname: string;
    grade: string;
    prizeName: string;
    timeAgo: string;
  }>;
  chatMessages: Array<{
    id?: string;
    nickname: string;
    message: string;
    isReaction: boolean;
    timestamp: string;
  }>;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  /** Called when the player clicks "開始抽獎" (queue position = 1). */
  onStartDraw?: () => void;
  /** True when it's YOUR turn to draw (main stage shows your interactive animation). */
  isMyTurn?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["🎉", "😱", "👏", "🔥", "💪", "😂", "❤️", "🎊"];

/** Generate a colorful prize image per grade (not a "?" placeholder) */
function makePrizeImageUrl(grade: string, prizeName: string): string {
  const gradients: Record<string, [string, string]> = {
    A: ["#f59e0b", "#fbbf24"],
    B: ["#3b82f6", "#60a5fa"],
    C: ["#10b981", "#34d399"],
    D: ["#a855f7", "#c084fc"],
  };
  const key = grade.charAt(0);
  const [c1, c2] = gradients[key] ?? ["#6366f1", "#818cf8"];
  const icon = key === "A" ? "👑" : key === "B" ? "💎" : key === "C" ? "🌟" : "🎁";
  const safeName = (prizeName || "獎品").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="300" height="420" rx="16" fill="url(#g)"/><text x="150" y="160" text-anchor="middle" font-size="72">${icon}</text><text x="150" y="240" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="900" fill="white">${grade}</text><text x="150" y="290" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="white" opacity="0.85">${safeName}</text><text x="150" y="380" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="white" opacity="0.5">PrizeDraw</text></svg>`)}`;
}

const HIDDEN_PRIZE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420' viewBox='0 0 300 420'%3E%3Crect width='300' height='420' rx='16' fill='%234F46E5'/%3E%3Ctext x='150' y='200' text-anchor='middle' fill='white' font-size='64'%3E%3F%3C/text%3E%3Ctext x='150' y='260' text-anchor='middle' fill='white' font-size='16' opacity='0.6'%3E%E7%AD%89%E5%BE%85%E6%8F%AD%E6%9B%89%3C/text%3E%3C/svg%3E";

// ─────────────────────────────────────────────────────────────────────────────
// Grade helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeGradient(grade: string): string {
  if (grade.startsWith("A")) return "from-amber-400 to-yellow-300";
  if (grade.startsWith("B")) return "from-blue-500 to-blue-400";
  if (grade.startsWith("C")) return "from-emerald-500 to-emerald-400";
  if (grade.startsWith("D")) return "from-purple-500 to-purple-400";
  return "from-rose-500 to-pink-400";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#f59e0b";
  if (grade.startsWith("B")) return "#3b82f6";
  if (grade.startsWith("C")) return "#10b981";
  if (grade.startsWith("D")) return "#8b5cf6";
  return "#f43f5e";
}

function gradeEmoji(grade: string): string {
  if (grade.startsWith("A")) return "🥇";
  if (grade.startsWith("B")) return "🥈";
  if (grade.startsWith("C")) return "🥉";
  if (grade === "最後賞" || grade === "LAST賞") return "🏆";
  return "🎖️";
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation stage — renders the REAL animation component driven by remote touch
// ─────────────────────────────────────────────────────────────────────────────

interface AnimationStageProps {
  animationMode: string;
  currentFrame: TouchFrame | null;
  prizeGrade: string;
  prizeName: string;
  isRevealed: boolean;
  onRevealed: () => void;
}

function AnimationStage({ animationMode, currentFrame, prizeGrade, prizeName, isRevealed, onRevealed }: AnimationStageProps) {
  // Before reveal: show hidden "?" image to prevent spoilers
  // After reveal (or when scratching — the actual image is underneath): show real prize
  const prizeUrl = makePrizeImageUrl(prizeGrade, prizeName);

  switch (animationMode) {
    case "SCRATCH":
      return (
        <ScratchReveal
          prizePhotoUrl={prizeUrl}
          remoteTouchInput={currentFrame}
          isSpectatorMode={true}
          onRevealed={onRevealed}
        />
      );

    case "TEAR":
      return (
        <SpectatorTearReveal
          prizePhotoUrl={prizeUrl}
          prizeGrade={prizeGrade}
          prizeName={prizeName}
          currentFrame={currentFrame}
          onRevealed={onRevealed}
        />
      );

    case "FLIP":
      return (
        <SpectatorFlipReveal
          prizePhotoUrl={prizeUrl}
          prizeGrade={prizeGrade}
          prizeName={prizeName}
          progress={currentFrame ? 1 : 0}
          onRevealed={onRevealed}
        />
      );

    case "INSTANT":
    default:
      return (
        <InstantReveal
          prizePhotoUrl={prizeUrl}
          prizeGrade={prizeGrade}
          prizeName={prizeName}
          onRevealed={onRevealed}
        />
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DrawerAnimationSlot — keyed by playerId so state fully resets between draws
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerAnimationSlotProps {
  drawer: NonNullable<LiveSpectatorRoomProps["currentDrawer"]>;
}

function DrawerAnimationSlot({ drawer }: DrawerAnimationSlotProps) {
  const [revealed, setRevealed] = useState(false);
  const currentFrame = drawer.currentFrame;
  const isFingerDown = currentFrame?.isDown === true;

  return (
    <>
      {/* Rounded stage frame */}
      <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-primary/20 bg-surface-container-low aspect-[4/3] flex items-center justify-center relative">
        {/* Always show the animation — after reveal, the scratched card with prize stays visible */}
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="relative"
            style={{
              width: "min(280px, 80%)",
              height: "min(400px, 85%)",
            }}
          >
            <AnimationStage
              animationMode={drawer.animationMode}
              currentFrame={currentFrame ?? null}
              prizeGrade={drawer.prizeGrade ?? "A賞"}
              prizeName={drawer.prizeName ?? "獎品"}
              isRevealed={revealed}
              onRevealed={() => setRevealed(true)}
            />
          </div>
        </div>

        {/* Result overlay badge — shows on top of the scratched card */}
        {revealed && (
          <div className="absolute top-3 right-3 z-20 bg-primary-container text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce">
            🎊 已揭曉
          </div>
        )}

        {/* Remote finger position indicator — hide after reveal */}
        {!revealed && isFingerDown && currentFrame && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-20"
            style={{
              left: `${currentFrame.x * 100}%`,
              top: `${currentFrame.y * 100}%`,
            }}
          >
            <div className="absolute w-8 h-8 rounded-full bg-white/20 animate-ping -translate-x-1/2 -translate-y-1/2" />
            <div className="w-5 h-5 rounded-full bg-white/60 border-2 border-white/90 shadow-lg -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live draw stage — the main video-feed-style animation area
// ─────────────────────────────────────────────────────────────────────────────

interface LiveDrawStageProps {
  currentDrawer: LiveSpectatorRoomProps["currentDrawer"];
  campaignTitle: string;
  viewerCount: number;
  onSendReaction: (emoji: string) => void;
  isMyTurn?: boolean;
}

function LiveDrawStage({
  currentDrawer,
  campaignTitle,
  viewerCount,
  onSendReaction,
  isMyTurn,
}: LiveDrawStageProps) {
  const { currentEmoji, pushReaction } = useReactionQueue();

  const handleReaction = (emoji: string) => {
    pushReaction(emoji);
    onSendReaction(emoji);
  };

  const isFingerDown = currentDrawer?.currentFrame?.isDown === true;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar — LIVE badge + campaign title + viewer count */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-1.5 bg-error text-white text-xs font-black px-2.5 py-1 rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
        <span className="text-sm font-semibold text-on-surface truncate">
          {campaignTitle}
        </span>
        <span className="text-sm text-on-surface-variant/50 ml-auto shrink-0 flex items-center gap-1">
          <span>👀</span>
          <span>{viewerCount.toLocaleString()}</span>
        </span>
      </div>

      {/* Status text */}
      {isMyTurn ? (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base font-black text-amber-600 dark:text-amber-400">
            🎯 你正在抽獎！
          </span>
          <span className="text-sm text-on-surface-variant">
            用手指刮開看看
          </span>
        </div>
      ) : currentDrawer ? (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-base font-black text-primary">
            {currentDrawer.nickname}
          </span>
          <span className="text-sm text-on-surface-variant">
            正在{currentDrawer.animationMode === "SCRATCH" ? "刮刮樂" :
                  currentDrawer.animationMode === "TEAR" ? "撕籤" :
                  currentDrawer.animationMode === "FLIP" ? "翻牌" : "抽獎"}中
          </span>
          {isFingerDown && (
            <span className="text-sm text-on-surface-variant/50 animate-pulse">
              😬
            </span>
          )}
        </div>
      ) : (
        <div className="mb-3 text-sm text-on-surface-variant/50">
          等待下一位玩家...
        </div>
      )}

      {/* Main animation container */}
      <div className="relative">
        {isMyTurn ? (
          /* YOUR TURN: interactive scratch card — you can scratch it yourself! */
          <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-400/50 bg-surface-container-low aspect-[4/3] flex items-center justify-center relative">
            <div className="absolute top-3 left-3 z-20 bg-primary-container text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              🎯 你的回合
            </div>
            <div style={{ width: "min(280px, 80%)", height: "min(400px, 85%)" }}>
              <ScratchReveal
                prizePhotoUrl={makePrizeImageUrl("A賞", "限定公仔")}
                onRevealed={() => {
                  /* In real app: send DRAW_REVEALED event, update queue */
                }}
              />
            </div>
          </div>
        ) : currentDrawer ? (
          /* Key on playerId: fully remounts DrawerAnimationSlot between draws,
             resetting revealed state and the animation component's canvas. */
          <DrawerAnimationSlot
            key={currentDrawer.playerId}
            drawer={currentDrawer}
          />
        ) : (
        /* Empty waiting state */
        <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-primary/20 bg-surface-container-low aspect-[4/3] flex items-center justify-center">
          <div className="text-center text-on-surface-variant select-none">
            <div className="text-7xl mb-4 opacity-60">🎰</div>
            <div className="text-base font-semibold text-on-surface-variant">等待中...</div>
            <div className="text-xs text-on-surface-variant mt-1">下一位玩家即將開始</div>
          </div>
        </div>
        )}

        {/* Floating reactions overlay — outside DrawerAnimationSlot so it persists */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
          <ReactionOverlay emoji={currentEmoji} />
        </div>
      </div>

      {/* Reaction bar */}
      <div className="flex items-center gap-1.5 mt-4 justify-center flex-wrap">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-xl transition-all duration-150 hover:scale-110 active:scale-95 shadow-sm"
            aria-label={`送出 ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent wins live feed
// ─────────────────────────────────────────────────────────────────────────────

function RecentWinsFeed({
  wins,
}: {
  wins: LiveSpectatorRoomProps["recentWins"];
}) {
  return (
    <div className="space-y-0 overflow-y-auto max-h-[260px]">
      {wins.length === 0 && (
        <p className="text-xs text-on-surface-variant/50 text-center py-4">
          尚無中獎紀錄
        </p>
      )}
      {wins.map((win, i) => (
        <div
          key={win.id ?? `${win.nickname}-${i}`}
          className="flex items-center gap-2 py-2 px-3 rounded-lg"
          style={{
            animation: i === 0 ? "slideDown 0.3s ease-out" : undefined,
          }}
        >
          <div className="relative shrink-0">
            <span
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradeGradient(win.grade)} flex items-center justify-center text-white text-xs font-black shadow-sm`}
            >
              {win.grade.charAt(0)}
            </span>
            {i === 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                {gradeEmoji(win.grade)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm text-on-surface">
              {win.nickname}
            </span>
            <span className="text-xs text-on-surface-variant ml-1">抽到</span>
            <span
              className="font-bold text-sm ml-1"
              style={{ color: gradeColor(win.grade) }}
            >
              {win.grade}
            </span>
          </div>
          <span className="text-xs text-on-surface-variant/50 shrink-0">
            {win.timeAgo}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue panel
// ─────────────────────────────────────────────────────────────────────────────

function QueuePanel({
  queuePosition,
  queueLength,
  onJoinQueue,
  onLeaveQueue,
  onStartDraw,
}: Pick<LiveSpectatorRoomProps, "queuePosition" | "queueLength" | "onJoinQueue" | "onLeaveQueue" | "onStartDraw">) {
  return (
    <div className="bg-surface-container rounded-xl p-4  shadow-sm">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-on-surface">
        <span>🎫</span> 排隊狀態
      </h3>

      {queuePosition !== undefined && queuePosition === 1 ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 rounded-lg p-3 mb-3 border-2 border-amber-400 dark:border-amber-500/50 animate-pulse">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
            🎉 輪到你了！
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            準備開始抽獎
          </div>
          <button
            onClick={onStartDraw}
            className="mt-2.5 w-full py-2 rounded-lg bg-primary-container hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm transition-colors shadow"
          >
            🎰 開始抽獎
          </button>
          <button
            onClick={onLeaveQueue}
            className="mt-1.5 w-full text-xs text-on-surface-variant/50 hover:text-rose-500 transition-colors"
          >
            放棄排隊
          </button>
        </div>
      ) : queuePosition !== undefined && queuePosition > 1 ? (
        <div className="bg-primary/10 rounded-lg p-3 mb-3 ">
          <div className="text-3xl font-black text-primary leading-none">
            #{queuePosition}
          </div>
          <div className="text-xs text-primary mt-0.5">你的位置 — 前面還有 {queuePosition - 1} 人</div>
          <button
            onClick={onLeaveQueue}
            className="mt-2.5 text-xs text-rose-500 hover:text-rose-600 hover:underline transition-colors"
          >
            離開排隊
          </button>
        </div>
      ) : (
        <button
          onClick={onJoinQueue}
          className="w-full py-2.5 rounded-lg bg-gradient-to-tr from-primary to-primary-container hover:opacity-90 active:scale-95 text-white font-bold text-sm transition-colors mb-3 shadow-sm"
        >
          加入排隊
        </button>
      )}

      <div className="text-xs text-on-surface-variant">
        排隊人數：<span className="font-semibold text-gray-700 dark:text-gray-200">{queueLength}</span> 人
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat panel — instant message display, aggressive auto-scroll
// ─────────────────────────────────────────────────────────────────────────────

interface ChatPanelInlineProps {
  chatMessages: LiveSpectatorRoomProps["chatMessages"];
  onSendMessage: (msg: string) => void;
  asDrawer?: boolean;
  onClose?: () => void;
}

function ChatPanelInline({
  chatMessages,
  onSendMessage,
  asDrawer = false,
  onClose,
}: ChatPanelInlineProps) {
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // Aggressive auto-scroll: always snap to bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    // Snap immediately — no smooth scroll delay
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  // Track scroll position to detect manual scroll-up
  const handleScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleSend = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    onSendMessage(text);
    setChatInput("");
  }, [chatInput, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const panelClass = asDrawer
    ? "flex flex-col bg-surface-container rounded-t-2xl  shadow-2xl h-full"
    : "lg:w-[280px] flex flex-col bg-surface-container rounded-xl  shadow-sm";

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className="px-3 py-3  flex items-center justify-between shrink-0">
        <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
          <span>💬</span>
          <span>聊天室</span>
        </div>
        {asDrawer && onClose && (
          <button
            onClick={onClose}
            className="text-on-surface-variant/50 hover:text-on-surface-variant dark:hover:text-gray-200 text-xl leading-none transition-colors"
            aria-label="關閉聊天"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages — no fade-in delay, instant render */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0"
        style={{ scrollBehavior: "auto" }}
      >
        {chatMessages.length === 0 && (
          <p className="text-xs text-on-surface-variant/50 text-center mt-6">
            搶先發言吧！
          </p>
        )}
        {chatMessages.map((msg, i) => {
          const key = msg.id ?? `${msg.timestamp}-${i}`;
          if (msg.isReaction) {
            return (
              <div key={key} className="text-center py-0.5">
                <span className="text-2xl">{msg.message}</span>
              </div>
            );
          }
          return (
            <div key={key} className="text-sm leading-snug">
              <span className="font-bold text-primary">
                {msg.nickname}
              </span>
              <span className="text-on-surface-variant dark:text-gray-300 ml-1.5 break-words">
                {msg.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3  flex gap-2 shrink-0">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
          onKeyDown={handleKeyDown}
          placeholder="輸入訊息..."
          maxLength={100}
          className="flex-1 bg-surface-container-high rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder-on-surface-variant/50"
        />
        <button
          onClick={handleSend}
          disabled={!chatInput.trim()}
          className="px-3 py-2 bg-gradient-to-tr from-primary to-primary-container hover:opacity-90 active:scale-95 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          送出
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile chat toggle
// ─────────────────────────────────────────────────────────────────────────────

function MobileChatToggle({
  unread,
  onClick,
}: {
  unread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gradient-to-tr from-primary to-primary-container hover:opacity-90 text-white text-sm font-bold shadow-lg transition-all active:scale-95"
      aria-label="開啟聊天"
    >
      <span>💬</span>
      <span>聊天</span>
      {unread && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-page Live Spectator Room using touch-coordinate sync.
 *
 * Instead of a progress bar, spectators see the EXACT SAME animation component
 * as the drawer, driven by the drawer's synced touch coordinates at up to 60fps.
 *
 * Layout:
 *   Desktop (lg+) — 3 columns: Queue/Wins (240px) | Stage (flex-1) | Chat (280px)
 *   Tablet (md)   — 2 columns: Stage | Chat, Queue/Wins below
 *   Mobile        — single column; chat as bottom drawer
 */
export function LiveSpectatorRoom({
  campaignId: _campaignId,
  campaignTitle,
  currentDrawer,
  queuePosition,
  queueLength,
  viewerCount,
  recentWins,
  chatMessages,
  onSendMessage,
  onSendReaction,
  onJoinQueue,
  onLeaveQueue,
  onStartDraw,
  isMyTurn,
}: LiveSpectatorRoomProps) {
  const [mobileChat, setMobileChat] = useState(false);
  // Track unread messages: bump when drawer opens to clear the dot.
  // Stored as a plain number in a ref to avoid setState-in-effect.
  const lastSeenRef = useRef(0);
  const [unread, setUnread] = useState(false);

  // New messages while chat is closed → show unread dot.
  // We derive this in a separate effect to keep it readable.
  useEffect(() => {
    if (!mobileChat && chatMessages.length > lastSeenRef.current) {
      setUnread(true);
    }
    if (mobileChat) {
      lastSeenRef.current = chatMessages.length;
      setUnread(false);
    }
  }, [mobileChat, chatMessages.length]);

  return (
    <div className="relative flex flex-col h-full min-h-screen bg-surface-dim">
      {/* Keyframe animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Desktop / Tablet layout */}
      <div className="flex flex-1 gap-4 p-4 max-w-[1600px] mx-auto w-full">

        {/* Left sidebar — Queue + Wins (lg+) */}
        <aside className="hidden lg:flex flex-col gap-4 w-[240px] shrink-0">
          <QueuePanel
            queuePosition={queuePosition}
            queueLength={queueLength}
            onJoinQueue={onJoinQueue}
            onLeaveQueue={onLeaveQueue}
            onStartDraw={onStartDraw}
          />

          <div className="bg-surface-container rounded-xl p-4  shadow-sm flex-1">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-on-surface">
              <span>🏆</span> 最近中獎
            </h3>
            <RecentWinsFeed wins={recentWins} />
          </div>
        </aside>

        {/* Center — Main Stage */}
        <main className="flex-1 min-w-0">
          <LiveDrawStage
            campaignTitle={campaignTitle}
            viewerCount={viewerCount}
            currentDrawer={currentDrawer}
            onSendReaction={onSendReaction}
            isMyTurn={isMyTurn}
          />

          {/* Tablet: Queue & Wins below stage */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid lg:hidden">
            <QueuePanel
              queuePosition={queuePosition}
              queueLength={queueLength}
              onJoinQueue={onJoinQueue}
              onLeaveQueue={onLeaveQueue}
            />
            <div className="bg-surface-container rounded-xl p-4  shadow-sm">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-on-surface">
                <span>🏆</span> 最近中獎
              </h3>
              <RecentWinsFeed wins={recentWins} />
            </div>
          </div>
        </main>

        {/* Right sidebar — Chat (md+) */}
        <aside className="hidden md:flex">
          <ChatPanelInline
            chatMessages={chatMessages}
            onSendMessage={onSendMessage}
          />
        </aside>
      </div>

      {/* Mobile chat toggle */}
      <MobileChatToggle unread={unread} onClick={() => setMobileChat(true)} />

      {/* Mobile chat bottom drawer */}
      {mobileChat && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="聊天室"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileChat(false)}
          />
          <div className="relative z-10 h-[60vh]">
            <ChatPanelInline
              chatMessages={chatMessages}
              onSendMessage={onSendMessage}
              asDrawer
              onClose={() => setMobileChat(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
