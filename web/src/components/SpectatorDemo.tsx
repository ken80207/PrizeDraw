"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveSpectatorRoom } from "@/components/LiveSpectatorRoom";
import type { LiveSpectatorRoomProps } from "@/components/LiveSpectatorRoom";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SpectatorDemoProps {
  animationMode?: "TEAR" | "SCRATCH" | "FLIP";
  /** 1 = normal, 2 = 2× speed, 5 = 5× speed */
  speed?: 1 | 2 | 5;
  simulateChat?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static demo data
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_NICKNAMES = [
  "阿豪", "小萱", "勇者王", "玲玲", "炎龍", "夜貓子",
  "雷神", "星星", "小胖", "翔翔", "超強達人", "幸運女神",
];

const FAKE_PRIZES = [
  { grade: "A賞", prizeName: "限定公仔" },
  { grade: "B賞", prizeName: "壓克力立牌" },
  { grade: "C賞", prizeName: "手機架" },
  { grade: "D賞", prizeName: "鑰匙圈" },
  { grade: "A賞", prizeName: "特大布偶" },
  { grade: "最後賞", prizeName: "全套組" },
];

const FAKE_CHAT: Array<{ nickname: string; message: string; isReaction: boolean }> = [
  { nickname: "阿豪", message: "加油！！！", isReaction: false },
  { nickname: "小萱", message: "🎉", isReaction: true },
  { nickname: "勇者王", message: "抽到A賞啦！！", isReaction: false },
  { nickname: "玲玲", message: "我也要排隊", isReaction: false },
  { nickname: "炎龍", message: "🔥", isReaction: true },
  { nickname: "夜貓子", message: "這個活動超棒的", isReaction: false },
  { nickname: "雷神", message: "👏", isReaction: true },
  { nickname: "星星", message: "希望下一個是我", isReaction: false },
  { nickname: "小胖", message: "已排到第3位！", isReaction: false },
  { nickname: "翔翔", message: "😱", isReaction: true },
  { nickname: "超強達人", message: "這個C賞也很可愛", isReaction: false },
  { nickname: "幸運女神", message: "❤️", isReaction: true },
  { nickname: "阿豪", message: "快到了！！衝！", isReaction: false },
  { nickname: "小萱", message: "加油加油加油", isReaction: false },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function timeAgoLabel(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分前`;
  return `${Math.floor(m / 60)}小時前`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo component
// ─────────────────────────────────────────────────────────────────────────────

type ChatMessage = LiveSpectatorRoomProps["chatMessages"][number];
type Win = LiveSpectatorRoomProps["recentWins"][number];

let _msgIdCounter = 0;

export function SpectatorDemo({
  animationMode = "SCRATCH",
  speed = 1,
  simulateChat = true,
}: SpectatorDemoProps) {
  // ── Simulation state ────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [currentDrawerNickname, setCurrentDrawerNickname] = useState(pickRandom(FAKE_NICKNAMES));
  const [isDrawing, setIsDrawing] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | undefined>(undefined);
  const [queueLength, setQueueLength] = useState(randomBetween(3, 8));
  const [viewerCount, setViewerCount] = useState(randomBetween(12, 30));
  const [recentWins, setRecentWins] = useState<Win[]>(() => {
    return [
      { ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "5分前" },
      { ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "12分前" },
      { ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "20分前" },
    ];
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Track when wins were recorded (for live timeAgo updates)
  const winTimesRef = useRef<number[]>([Date.now() - 300000, Date.now() - 720000, Date.now() - 1200000]);
  const chatIndexRef = useRef(0);
  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Draw duration: 10 seconds at 1× speed
  const DRAW_DURATION_MS = 10_000 / speed;
  const IDLE_DURATION_MS = 2_500 / speed;

  // ── Live timeAgo updates (every 10s) ─────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRecentWins((prev) =>
        prev.map((w, i) => ({
          ...w,
          timeAgo: timeAgoLabel(now - (winTimesRef.current[i] ?? now)),
        })),
      );
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Viewer count drift (every 3s) ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setViewerCount((v) => Math.max(5, v + randomBetween(-2, 3)));
    }, 3_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-play loop ─────────────────────────────────────────────────────────
  const startDraw = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setIsDrawing(true);
    setCurrentDrawerNickname(pickRandom(FAKE_NICKNAMES));
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - (startTimeRef.current ?? now);
      const p = Math.min(elapsed / DRAW_DURATION_MS, 1);
      progressRef.current = p;
      setProgress(p);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Reveal — add a win and start idle
        const prize = pickRandom(FAKE_PRIZES);
        const winner = currentDrawerNickname;
        const now2 = Date.now();
        winTimesRef.current = [now2, ...winTimesRef.current].slice(0, 8);
        setRecentWins((prev) => [
          { ...prize, nickname: winner, timeAgo: "剛才" },
          ...prev,
        ].slice(0, 8));
        setQueueLength((v) => Math.max(0, v - 1));

        // Short idle, then next draw
        setIsDrawing(false);
        rafRef.current = null;
        setTimeout(startDraw, IDLE_DURATION_MS);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAW_DURATION_MS, IDLE_DURATION_MS]);

  // Start auto-play on mount
  useEffect(() => {
    const firstDelay = setTimeout(startDraw, 800);
    return () => {
      clearTimeout(firstDelay);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart when speed or animationMode changes
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsDrawing(false);
    const t = setTimeout(startDraw, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, animationMode]);

  // ── Simulated chat ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!simulateChat) return;

    const pushMessage = () => {
      const template = FAKE_CHAT[chatIndexRef.current % FAKE_CHAT.length]!;
      chatIndexRef.current += 1;
      const msg: ChatMessage = {
        id: `demo-${++_msgIdCounter}`,
        nickname: template.nickname,
        message: template.message,
        isReaction: template.isReaction,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, msg].slice(-60));
    };

    // Push an initial batch for immediate content
    for (let i = 0; i < 4; i++) pushMessage();

    const jitter = () => randomBetween(1200, 3500) / speed;
    const schedule = () => {
      const id = setTimeout(() => {
        pushMessage();
        schedule();
      }, jitter());
      return id;
    };

    const firstId = schedule();
    return () => clearTimeout(firstId);
  }, [simulateChat, speed]);

  // ── Queue actions ──────────────────────────────────────────────────────────
  const handleJoinQueue = useCallback(() => {
    setQueueLength((v) => v + 1);
    setQueuePosition(queueLength + 1);
  }, [queueLength]);

  const handleLeaveQueue = useCallback(() => {
    setQueueLength((v) => Math.max(0, v - 1));
    setQueuePosition(undefined);
  }, []);

  // ── User-sent messages ─────────────────────────────────────────────────────
  const handleSendMessage = useCallback((message: string) => {
    const msg: ChatMessage = {
      id: `user-${++_msgIdCounter}`,
      nickname: "你",
      message,
      isReaction: false,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, msg].slice(-60));
  }, []);

  const handleSendReaction = useCallback((emoji: string) => {
    const msg: ChatMessage = {
      id: `user-reaction-${++_msgIdCounter}`,
      nickname: "你",
      message: emoji,
      isReaction: true,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, msg].slice(-60));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LiveSpectatorRoom
      campaignId="demo-campaign"
      campaignTitle="一番賞 Re:Zero 第三彈"
      currentDrawer={
        isDrawing
          ? {
              playerId: "demo-player",
              nickname: currentDrawerNickname,
              animationMode,
              progress,
            }
          : null
      }
      queuePosition={queuePosition}
      queueLength={queueLength}
      viewerCount={viewerCount}
      recentWins={recentWins}
      chatMessages={chatMessages}
      onSendMessage={handleSendMessage}
      onSendReaction={handleSendReaction}
      onJoinQueue={handleJoinQueue}
      onLeaveQueue={handleLeaveQueue}
    />
  );
}
