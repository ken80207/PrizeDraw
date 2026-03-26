"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveSpectatorRoom } from "@/components/LiveSpectatorRoom";
import type { LiveSpectatorRoomProps } from "@/components/LiveSpectatorRoom";
import type { TouchFrame } from "@/hooks/useDrawInputSync";

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

// ─────────────────────────────────────────────────────────────────────────────
// Scratch path generation — a realistic zigzag finger path across the canvas
// ─────────────────────────────────────────────────────────────────────────────

interface PathPoint {
  x: number; // normalised 0-1
  y: number; // normalised 0-1
}

/**
 * Generates a realistic scratch path that covers the card with overlapping
 * horizontal strokes — mimics how someone would actually scratch a card.
 *
 * Returns an array of {x, y} waypoints (normalised 0-1). The simulator will
 * interpolate between them at 60fps to produce continuous touch frames.
 */
function buildScratchPath(): PathPoint[] {
  const points: PathPoint[] = [];

  // Number of horizontal rows (strokes)
  const ROWS = 8;
  // Horizontal margin
  const MARGIN = 0.08;

  for (let row = 0; row < ROWS; row++) {
    const y = MARGIN + (row / (ROWS - 1)) * (1 - MARGIN * 2);
    // Alternate left-to-right and right-to-left
    const goRight = row % 2 === 0;
    const x0 = goRight ? MARGIN : 1 - MARGIN;
    const x1 = goRight ? 1 - MARGIN : MARGIN;

    // Add slight vertical wobble for realism
    const wobble = (Math.sin(row * 2.7) * 0.03);

    // Start of stroke
    points.push({ x: x0, y: y + wobble });

    // Mid-stroke points with small natural jitter
    const MID_POINTS = 4;
    for (let m = 1; m <= MID_POINTS; m++) {
      const t = m / (MID_POINTS + 1);
      const mx = x0 + (x1 - x0) * t;
      const jitterY = Math.sin(m * 1.9 + row * 3.1) * 0.015;
      points.push({ x: mx, y: y + wobble + jitterY });
    }

    // End of stroke
    points.push({ x: x1, y: y + wobble });

    // Brief lift between rows (represented as a gap — handled by isDown=false)
    // We'll insert a "lift" marker as a special point with isDown=false
    if (row < ROWS - 1) {
      const nextY = MARGIN + ((row + 1) / (ROWS - 1)) * (1 - MARGIN * 2);
      const nextX = goRight ? 1 - MARGIN : MARGIN; // stay at current end
      points.push({ x: nextX, y: (y + nextY) / 2 }); // lift marker
    }
  }

  return points;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  const [currentFrame, setCurrentFrame] = useState<TouchFrame | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawerNickname, setCurrentDrawerNickname] = useState(pickRandom(FAKE_NICKNAMES));
  const [currentPlayerId, setCurrentPlayerId] = useState("demo-player-1");
  const [queuePosition, setQueuePosition] = useState<number | undefined>(undefined);
  const [queueLength, setQueueLength] = useState(randomBetween(3, 8));
  const [viewerCount, setViewerCount] = useState(randomBetween(12, 30));
  const [recentWins, setRecentWins] = useState<Win[]>(() => [
    { id: "w0", ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "5分前" },
    { id: "w1", ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "12分前" },
    { id: "w2", ...pickRandom(FAKE_PRIZES), nickname: pickRandom(FAKE_NICKNAMES), timeAgo: "20分前" },
  ]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const winTimesRef = useRef<number[]>([
    Date.now() - 300_000,
    Date.now() - 720_000,
    Date.now() - 1_200_000,
  ]);
  const chatIndexRef = useRef(0);
  const playerIdCounterRef = useRef(1);

  // Scratch path simulation state
  const scratchPathRef = useRef<PathPoint[]>([]);
  const pathIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Target: advance ~5-6 path points per frame at 60fps for natural scratch speed.
  // At speed=1: covers the whole path in ~3 seconds (realistic scratch card speed).
  const POINTS_PER_FRAME = speed * 0.8;

  // ── Live timeAgo updates (every 10s) ────────────────────────────────────
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

  // ── Viewer count drift ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setViewerCount((v) => Math.max(5, v + randomBetween(-2, 3)));
    }, 3_000);
    return () => clearInterval(id);
  }, []);

  // ── Touch path simulator — runs at 60fps using requestAnimationFrame ─────
  const startDraw = useCallback(() => {
    // Build a fresh scratch path for this session
    scratchPathRef.current = buildScratchPath();
    pathIndexRef.current = 0;

    const nickname = pickRandom(FAKE_NICKNAMES);
    const playerId = `demo-player-${++playerIdCounterRef.current}`;

    setCurrentDrawerNickname(nickname);
    setCurrentPlayerId(playerId);
    setIsDrawing(true);
    setCurrentFrame(null);

    let floatIndex = 0;

    const tick = () => {
      const path = scratchPathRef.current;

      // Advance by POINTS_PER_FRAME (can be fractional — use float accumulation)
      floatIndex += POINTS_PER_FRAME;
      const intIndex = Math.min(Math.floor(floatIndex), path.length - 1);

      if (intIndex >= path.length - 1) {
        // Path completed — emit a "lift" frame then end
        const last = path[path.length - 1]!;
        setCurrentFrame({
          x: last.x,
          y: last.y,
          isDown: false,
          timestamp: Date.now(),
        });
        // === RESULT PHASE ===
        // The drawer's session stays visible — spectators see what the drawer sees.
        // We keep isDrawing=true so the animation component stays mounted.
        // The result (scratched card revealing prize) remains on screen.
        // Only when the NEXT drawer starts do we transition.

        // Add win to feed immediately
        const prize = pickRandom(FAKE_PRIZES);
        const winId = `w-${Date.now()}`;
        const now2 = Date.now();
        winTimesRef.current = [now2, ...winTimesRef.current].slice(0, 8);
        setRecentWins((prev) =>
          [{ id: winId, ...prize, nickname, timeAgo: "剛才" }, ...prev].slice(0, 8),
        );

        rafRef.current = null;

        // Simulate: drawer stays on result screen for a realistic amount of time
        // (real users look at result, celebrate, maybe screenshot)
        // Then drawer "leaves" and next person starts
        const DRAWER_STAYS_MS = (8_000 + randomBetween(0, 6_000)) / speed; // 8~14 seconds
        idleTimerRef.current = setTimeout(() => {
          // Drawer leaves → brief transition gap → next drawer starts
          setIsDrawing(false);
          setCurrentFrame(null);
          setQueueLength((v) => Math.max(0, v - 1));

          // Short gap between draws (simulates queue advancing)
          const QUEUE_ADVANCE_MS = (1_500 + randomBetween(0, 1_000)) / speed;
          idleTimerRef.current = setTimeout(startDraw, QUEUE_ADVANCE_MS);
        }, DRAWER_STAYS_MS);
        return;
      }

      const point = path[intIndex]!;

      // Determine isDown: we treat every point as "down" EXCEPT the "lift"
      // markers we inserted between rows. A lift marker is detected by checking
      // if the previous and next points are on different rows (y jump > 0.06).
      const prevPoint = intIndex > 0 ? path[intIndex - 1] : null;
      const nextPoint = intIndex < path.length - 1 ? path[intIndex + 1] : null;
      const isLift =
        prevPoint !== null &&
        nextPoint !== null &&
        Math.abs(point.y - prevPoint.y) > 0.05 &&
        Math.abs(nextPoint.y - point.y) > 0.05;

      setCurrentFrame({
        x: point.x,
        y: point.y,
        isDown: !isLift,
        timestamp: Date.now(),
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [POINTS_PER_FRAME, speed]);

  // Start simulation on mount
  useEffect(() => {
    const t = setTimeout(startDraw, 800);
    return () => {
      clearTimeout(t);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart when speed or animationMode changes
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
    rafRef.current = null;
    idleTimerRef.current = null;
    setIsDrawing(false);
    setCurrentFrame(null);
    const t = setTimeout(startDraw, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, animationMode]);

  // ── Simulated chat ────────────────────────────────────────────────────────
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

    // Push initial batch
    for (let i = 0; i < 4; i++) pushMessage();

    const jitter = () => randomBetween(1200, 3500) / speed;
    const schedule = (): ReturnType<typeof setTimeout> => {
      const id = setTimeout(() => {
        pushMessage();
        schedule();
      }, jitter());
      return id;
    };

    const firstId = schedule();
    return () => clearTimeout(firstId);
  }, [simulateChat, speed]);

  // ── Queue actions ─────────────────────────────────────────────────────────
  const handleJoinQueue = useCallback(() => {
    setQueueLength((v) => v + 1);
    setQueuePosition(queueLength + 1);
  }, [queueLength]);

  const handleLeaveQueue = useCallback(() => {
    setQueueLength((v) => Math.max(0, v - 1));
    setQueuePosition(undefined);
  }, []);

  // ── User-sent messages ────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <LiveSpectatorRoom
      campaignId="demo-campaign"
      campaignTitle="一番賞 Re:Zero 第三彈"
      currentDrawer={
        isDrawing
          ? {
              playerId: currentPlayerId,
              nickname: currentDrawerNickname,
              animationMode,
              currentFrame,
              prizeGrade: "A賞",
              prizeName: "限定公仔 Re:Zero 雷姆",
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
