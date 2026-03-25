"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomFlatProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 480;
const H = 380;

// ─────────────────────────────────────────────────────────────────────────────
// Flat design palette
// ─────────────────────────────────────────────────────────────────────────────

const FL = {
  white:       "#ffffff",
  bg:          "#f8fafc",
  floor:       "#f1f5f9",       // light gray floor
  wallBorder:  "#cbd5e1",       // thin wall border lines
  indigo:      "#6366f1",       // counter + player + primary
  indigoDark:  "#4f46e5",
  indigoLight: "#c7d2fe",       // counter accent
  amber:       "#f59e0b",       // A grade
  blue:        "#3b82f6",       // B grade / NPC color
  emerald:     "#10b981",       // C grade / NPC color
  purple:      "#a855f7",       // D grade / NPC color
  slate:       "#1e293b",       // text
  slateLight:  "#94a3b8",       // secondary text
  gray200:     "#e2e8f0",       // shelf rects
  shelfA:      "#fde68a",       // shelf A color
  shelfB:      "#bfdbfe",       // shelf B color
  shelfC:      "#a7f3d0",       // shelf C color
  shelfD:      "#e9d5ff",       // shelf D color
  dot:         "rgba(148,163,184,0.35)", // dot grid
  entranceGap: "#f8fafc",       // entrance gap color
};

const GRADE_COLOR: Record<string, string> = {
  "A賞": FL.amber,
  "B賞": FL.blue,
  "C賞": FL.emerald,
  "D賞": FL.purple,
};

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const PRIZE_NAMES: Record<string, string> = {
  "A賞": "限定公仔", "B賞": "周邊商品", "C賞": "貼紙組", "D賞": "明信片",
};

// ─────────────────────────────────────────────────────────────────────────────
// Room layout constants
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_L = 30;
const ROOM_T = 50;
const ROOM_R = W - 30;
const ROOM_B = H - 30;
const ROOM_W = ROOM_R - ROOM_L;
const ROOM_H = ROOM_B - ROOM_T;

const COUNTER_X = W / 2 - 60;
const COUNTER_Y = ROOM_T + 36;
const COUNTER_W = 120;
const COUNTER_H = 30;
const COUNTER_R = 10;

const DRAW_ZONE_X = COUNTER_X + COUNTER_W / 2;
const DRAW_ZONE_Y = COUNTER_Y + COUNTER_H + 20;

// Shelves flush against top edge
const SHELVES = [
  { x: ROOM_L + 10, y: ROOM_T,  w: 80, h: 14, grade: "A賞" as Grade, color: FL.shelfA },
  { x: ROOM_L + 104, y: ROOM_T, w: 80, h: 14, grade: "B賞" as Grade, color: FL.shelfB },
  { x: ROOM_R - 184, y: ROOM_T, w: 80, h: 14, grade: "C賞" as Grade, color: FL.shelfC },
  { x: ROOM_R - 90, y: ROOM_T,  w: 80, h: 14, grade: "D賞" as Grade, color: FL.shelfD },
];

// Entrance: gap at bottom center
const ENTRANCE_W = 80;
const ENTRANCE_X = W / 2 - ENTRANCE_W / 2;

// NPC palette colors — flat, bold
const NPC_COLORS = [FL.blue, FL.emerald, FL.purple, "#f97316", "#ec4899", "#06b6d4"];

// Queue positions — left of counter, evenly spaced row
const QUEUE_START_X = COUNTER_X - 28;
const QUEUE_Y = DRAW_ZONE_Y + 2;

// ─────────────────────────────────────────────────────────────────────────────
// Character types
// ─────────────────────────────────────────────────────────────────────────────

type CharState = "IDLE" | "MOVING" | "QUEUE" | "DRAWING" | "CELEBRATING" | "WANDERING";

interface Character {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  state: CharState;
  name: string;
  prizeGrade: string | null;
  speechText: string | null;
  speechTimer: number;
  drawTimer: number;
  wanderTimer: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers — flat geometry, no shadows
// ─────────────────────────────────────────────────────────────────────────────

function flatRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function flatText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  color: string,
  weight: "400" | "600" | "700" = "600",
  align: CanvasTextAlign = "center",
  baseline: CanvasTextBaseline = "middle",
): void {
  ctx.save();
  ctx.font = `${weight} ${fontSize}px "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw a flat character: large circle (body) with solid fill */
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  isPlayer: boolean,
): void {
  const { x, y, color, state, prizeGrade, name, speechText } = char;

  const bodyR = isPlayer ? 14 : 12;

  // State-based border pulse for drawing state
  if (state === "DRAWING") {
    ctx.beginPath();
    ctx.arc(x, y, bodyR + 5, 0, Math.PI * 2);
    ctx.fillStyle = GRADE_COLOR["A賞"] + "33";
    ctx.fill();
  }

  // Body circle
  ctx.beginPath();
  ctx.arc(x, y, bodyR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Player gets a white ring indicator
  if (isPlayer) {
    ctx.beginPath();
    ctx.arc(x, y, bodyR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = FL.amber;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Prize dot above character — solid colored dot
  if (prizeGrade && state === "CELEBRATING") {
    const dotColor = GRADE_COLOR[prizeGrade] ?? FL.amber;
    ctx.beginPath();
    ctx.arc(x, y - bodyR - 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  }

  // Name label below
  flatText(ctx, name, x, y + bodyR + 9, 9, FL.slateLight, "400");

  // Speech bubble — clean rounded rect, no tail
  if (speechText) {
    const pad = 6;
    ctx.font = `600 9px "Inter", system-ui, sans-serif`;
    const tw = ctx.measureText(speechText).width;
    const bw = tw + pad * 2;
    const bh = 18;
    const bx = x - bw / 2;
    const by = y - bodyR - bh - 12;

    flatRoundRect(ctx, bx, by, bw, bh, 5, FL.indigo);
    flatText(ctx, speechText, x, by + bh / 2, 9, FL.white, "600");
  }
}

/** Draw the grade symbol inline (small) */
function drawGradeSymbolSmall(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  cx: number, cy: number,
  size: number,
): void {
  const color = GRADE_COLOR[grade] ?? FL.slate;
  ctx.fillStyle = color;

  if (grade === "A賞") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.55);
    ctx.lineTo(cx + size * 0.52, cy + size * 0.45);
    ctx.lineTo(cx - size * 0.52, cy + size * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (grade === "B賞") {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
  } else if (grade === "C賞") {
    const half = size * 0.44;
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
  } else {
    const d = size * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d * 0.65, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d * 0.65, cy);
    ctx.closePath();
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lerp helper
// ─────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Flat({
  npcCount = 3,
  onDrawResult,
  resultGrade,
  playerNickname = "You",
}: PrizeRoomFlatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const frameCount = useRef(0);

  // Modal state for draw result
  const [modal, setModal] = useState<{ grade: string; name: string } | null>(null);

  // ── Character state ─────────────────────────────────────────────────────────
  const playerRef = useRef<Character>({
    id: "player",
    x: W / 2,
    y: ROOM_B - 55,
    targetX: W / 2,
    targetY: ROOM_B - 55,
    color: FL.indigo,
    state: "IDLE",
    name: playerNickname,
    prizeGrade: null,
    speechText: null,
    speechTimer: 0,
    drawTimer: 0,
    wanderTimer: 0,
  });

  const npcsRef = useRef<Character[]>([]);
  const queueRef = useRef<string[]>([]);     // character IDs in queue
  const activeDrawerRef = useRef<string | null>(null);
  const drawBtnVisibleRef = useRef(false);   // show 抽獎 button when player is at counter

  // ── Initialize NPCs ─────────────────────────────────────────────────────────
  useEffect(() => {
    npcsRef.current = Array.from({ length: Math.min(npcCount, 6) }, (_, i) => {
      const angle = (i / Math.max(npcCount, 1)) * Math.PI * 1.4 + 0.2;
      const r = 80 + Math.random() * 60;
      return {
        id: `npc-${i}`,
        x: W / 2 + Math.cos(angle) * r,
        y: H / 2 + 20 + Math.sin(angle) * r * 0.6,
        targetX: W / 2 + Math.cos(angle) * r,
        targetY: H / 2 + 20 + Math.sin(angle) * r * 0.6,
        color: NPC_COLORS[i % NPC_COLORS.length] ?? FL.blue,
        state: "WANDERING" as CharState,
        name: `NPC ${i + 1}`,
        prizeGrade: null,
        speechText: null,
        speechTimer: 0,
        drawTimer: 0,
        wanderTimer: Math.random() * 2000,
      };
    });
  }, [npcCount]);

  // ── Queue management helpers ────────────────────────────────────────────────
  const getQueuePosition = useCallback((queueIdx: number): { x: number; y: number } => {
    return {
      x: QUEUE_START_X - queueIdx * 26,
      y: QUEUE_Y,
    };
  }, []);

  const startDraw = useCallback((charId: string) => {
    activeDrawerRef.current = charId;
    queueRef.current = queueRef.current.filter((id) => id !== charId);

    const char = charId === "player"
      ? playerRef.current
      : npcsRef.current.find((n) => n.id === charId);
    if (!char) return;

    char.state = "DRAWING";
    char.targetX = DRAW_ZONE_X;
    char.targetY = DRAW_ZONE_Y;
    char.drawTimer = 2200;
  }, []);

  const advanceQueue = useCallback(() => {
    activeDrawerRef.current = null;
    if (queueRef.current.length > 0) {
      const nextId = queueRef.current[0];
      if (nextId) setTimeout(() => startDraw(nextId), 400);
    }
  }, [startDraw]);

  // ── Main update loop ────────────────────────────────────────────────────────
  const update = useCallback((dt: number) => {
    const speed = 0.0045;
    const allChars = [playerRef.current, ...npcsRef.current];

    for (const char of allChars) {
      // Smooth position lerp — no walk animation, just slide
      const dx = char.targetX - char.x;
      const dy = char.targetY - char.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const t = Math.min(speed * dt, 1);
        char.x = lerp(char.x, char.targetX, t);
        char.y = lerp(char.y, char.targetY, t);
        if (char.state === "IDLE" && dist > 4) char.state = "MOVING";
        if (char.state === "MOVING" && dist < 3) char.state = "IDLE";
      }

      // Speech timer
      if (char.speechTimer > 0) {
        char.speechTimer -= dt;
        if (char.speechTimer <= 0) char.speechText = null;
      }

      // Draw timer (NPC at counter)
      if (char.state === "DRAWING" && char.drawTimer > 0) {
        char.drawTimer -= dt;
        if (char.drawTimer <= 0) {
          const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "D賞";
          char.prizeGrade = grade;
          char.state = "CELEBRATING";
          char.speechText = `${grade}!`;
          char.speechTimer = 2500;
          onDrawResult?.(grade, PRIZE_NAMES[grade] ?? "");
          if (char.id === "player") {
            setModal({ grade, name: PRIZE_NAMES[grade] ?? "" });
          }
          advanceQueue();
          // Move away from counter
          char.targetX = ROOM_L + 60 + Math.random() * (ROOM_W - 120);
          char.targetY = ROOM_T + 80 + Math.random() * (ROOM_H - 100);
        }
      }

      // Celebration — eventually return to wander
      if (char.state === "CELEBRATING" && char.speechTimer <= 0) {
        char.state = char.id === "player" ? "IDLE" : "WANDERING";
      }

      // NPC wandering: pick new random target periodically
      if (char.state === "WANDERING" || char.state === "IDLE") {
        if (char.id !== "player") {
          char.wanderTimer -= dt;
          if (char.wanderTimer <= 0) {
            char.wanderTimer = 1800 + Math.random() * 2500;
            // Randomly decide to join queue
            if (
              queueRef.current.length < 4 &&
              activeDrawerRef.current !== char.id &&
              !queueRef.current.includes(char.id) &&
              Math.random() < 0.3
            ) {
              queueRef.current.push(char.id);
              char.state = "QUEUE";
              const qIdx = queueRef.current.indexOf(char.id);
              const qPos = getQueuePosition(qIdx);
              char.targetX = qPos.x;
              char.targetY = qPos.y;
              if (!activeDrawerRef.current) {
                setTimeout(() => startDraw(char.id), 200);
              }
            } else {
              // Wander inside room
              const margin = 50;
              char.targetX = ROOM_L + margin + Math.random() * (ROOM_W - margin * 2);
              char.targetY = ROOM_T + 60 + Math.random() * (ROOM_H - 80);
              char.state = "WANDERING";
            }
          }
        }

        // Update queue positions
        for (let qi = 0; qi < queueRef.current.length; qi++) {
          const qId = queueRef.current[qi];
          const qChar = qId === "player"
            ? playerRef.current
            : npcsRef.current.find((n) => n.id === qId);
          if (qChar && qChar.state === "QUEUE") {
            const pos = getQueuePosition(qi);
            qChar.targetX = pos.x;
            qChar.targetY = pos.y;
          }
        }
      }
    }

    // Check if player is near counter
    const px = playerRef.current.x;
    const py = playerRef.current.y;
    const nearCounter =
      Math.abs(px - DRAW_ZONE_X) < 36 &&
      Math.abs(py - DRAW_ZONE_Y) < 36;
    drawBtnVisibleRef.current = nearCounter && playerRef.current.state !== "DRAWING";

  }, [getQueuePosition, startDraw, advanceQueue, onDrawResult]);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fc = frameCount.current;

    // ── Background: pure white ─────────────────────────────────────────────
    ctx.fillStyle = FL.white;
    ctx.fillRect(0, 0, W, H);

    // ── Floor: light gray filled area ─────────────────────────────────────
    flatRoundRect(ctx, ROOM_L, ROOM_T, ROOM_W, ROOM_H, 0, FL.floor);

    // ── Dot grid (like Notion) — very faint dots at grid intersections ─────
    const gridStep = 20;
    ctx.fillStyle = FL.dot;
    for (let gx = ROOM_L + gridStep; gx < ROOM_R; gx += gridStep) {
      for (let gy = ROOM_T + gridStep; gy < ROOM_B; gy += gridStep) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Walls: thin colored border lines at edges ──────────────────────────
    // Top wall (continuous)
    ctx.fillStyle = FL.wallBorder;
    ctx.fillRect(ROOM_L, ROOM_T, ROOM_W, 3);
    // Left wall
    ctx.fillRect(ROOM_L, ROOM_T, 3, ROOM_H);
    // Right wall
    ctx.fillRect(ROOM_R - 3, ROOM_T, 3, ROOM_H);
    // Bottom wall with entrance gap
    ctx.fillRect(ROOM_L, ROOM_B - 3, ENTRANCE_X - ROOM_L, 3);
    ctx.fillRect(ENTRANCE_X + ENTRANCE_W, ROOM_B - 3, ROOM_R - (ENTRANCE_X + ENTRANCE_W), 3);

    // Entrance label
    flatText(ctx, "ENTRANCE", W / 2, ROOM_B + 12, 8, FL.slateLight, "600");

    // ── Shelves flush against top edge ────────────────────────────────────
    for (const shelf of SHELVES) {
      flatRoundRect(ctx, shelf.x, shelf.y, shelf.w, shelf.h, 4, shelf.color);
      // Grade label on shelf
      flatText(ctx, shelf.grade, shelf.x + shelf.w / 2, shelf.y + shelf.h / 2 + 1, 8, FL.slate, "700");
    }

    // ── Counter: rounded rectangle, indigo, centered ──────────────────────
    flatRoundRect(ctx, COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H, COUNTER_R, FL.indigo);
    flatText(ctx, "COUNTER", COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H / 2, 10, FL.white, "700");

    // Counter shimmer line (static)
    ctx.fillStyle = FL.indigoLight;
    ctx.fillRect(COUNTER_X + 10, COUNTER_Y + 3, COUNTER_W - 20, 3);

    // ── Draw zone marker: small indigo circle below counter ────────────────
    ctx.beginPath();
    ctx.arc(DRAW_ZONE_X, DRAW_ZONE_Y, 4, 0, Math.PI * 2);
    ctx.fillStyle = FL.indigoLight;
    ctx.fill();

    // ── Queue line: faint indigo dashed path ──────────────────────────────
    if (queueRef.current.length > 0) {
      ctx.strokeStyle = FL.indigoLight;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(DRAW_ZONE_X, DRAW_ZONE_Y);
      for (let qi = 0; qi < queueRef.current.length; qi++) {
        const pos = getQueuePosition(qi);
        ctx.lineTo(pos.x, pos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 抽獎 button when player is near counter ────────────────────────────
    if (drawBtnVisibleRef.current) {
      const bw = 64;
      const bh = 24;
      const bx = DRAW_ZONE_X - bw / 2;
      const by = DRAW_ZONE_Y - bh - 8;
      flatRoundRect(ctx, bx, by, bw, bh, 12, FL.indigo);
      flatText(ctx, "抽獎", DRAW_ZONE_X, by + bh / 2, 11, FL.white, "700");
    }

    // ── Characters: NPCs first, then player on top ─────────────────────────
    for (const npc of npcsRef.current) {
      drawCharacter(ctx, npc, false);
    }
    drawCharacter(ctx, playerRef.current, true);

    // ── Title / room label ────────────────────────────────────────────────
    flatText(ctx, "PRIZE ROOM", W / 2, ROOM_T - 18, 13, FL.slate, "700");

    // Active draw indicator
    if (activeDrawerRef.current) {
      const aChar = activeDrawerRef.current === "player"
        ? playerRef.current
        : npcsRef.current.find((n) => n.id === activeDrawerRef.current);
      if (aChar) {
        // Pulsing ring drawn in update pass — subtle oscillation
        const pulse = Math.abs(Math.sin(fc * 0.04));
        ctx.beginPath();
        ctx.arc(aChar.x, aChar.y, 18 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = FL.amber;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

  }, [getQueuePosition]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;
    frameCount.current += 1;
    update(dt);
    draw();
    animRef.current = requestAnimationFrame(animate);
  }, [update, draw]);

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Click handler: move player or trigger draw ─────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * (W / rect.width);
    const ny = (e.clientY - rect.top) * (H / rect.height);

    // Check if clicked on 抽獎 button
    if (drawBtnVisibleRef.current) {
      const bw = 64, bh = 24;
      const bx = DRAW_ZONE_X - bw / 2;
      const by = DRAW_ZONE_Y - bh - 8;
      if (nx >= bx && nx <= bx + bw && ny >= by && ny <= by + bh) {
        if (
          playerRef.current.state !== "DRAWING" &&
          playerRef.current.state !== "QUEUE"
        ) {
          if (!activeDrawerRef.current) {
            startDraw("player");
          } else {
            if (!queueRef.current.includes("player")) {
              queueRef.current.push("player");
              playerRef.current.state = "QUEUE";
              const qi = queueRef.current.indexOf("player");
              const pos = getQueuePosition(qi);
              playerRef.current.targetX = pos.x;
              playerRef.current.targetY = pos.y;
            }
          }
          return;
        }
      }
    }

    // Clamp movement inside room with margin
    const margin = 20;
    const clampedX = Math.max(ROOM_L + margin, Math.min(ROOM_R - margin, nx));
    const clampedY = Math.max(ROOM_T + margin, Math.min(ROOM_B - margin, ny));

    playerRef.current.targetX = clampedX;
    playerRef.current.targetY = clampedY;
    if (playerRef.current.state === "IDLE") playerRef.current.state = "MOVING";
  }, [startDraw, getQueuePosition]);

  return (
    <div className="relative flex flex-col items-center w-full" style={{ background: FL.bg }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        style={{
          width: "100%",
          maxWidth: W,
          cursor: "pointer",
          display: "block",
        }}
      />

      {/* Draw result modal — clean card, no shadows */}
      {modal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(248,250,252,0.85)" }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: FL.white,
              borderRadius: 20,
              overflow: "hidden",
              width: 200,
              fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
            }}
          >
            {/* Grade color bar */}
            <div
              style={{
                background: GRADE_COLOR[modal.grade] ?? FL.indigo,
                height: 8,
              }}
            />
            <div style={{ padding: "20px 24px 24px", textAlign: "center" }}>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: GRADE_COLOR[modal.grade] ?? FL.indigo,
                  lineHeight: 1.1,
                  marginBottom: 6,
                }}
              >
                {modal.grade}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: FL.slate,
                  marginBottom: 4,
                }}
              >
                {modal.name}
              </div>
              <div style={{ fontSize: 10, color: FL.slateLight, marginBottom: 16 }}>
                點擊關閉
              </div>
              <div
                style={{
                  background: FL.indigo,
                  color: FL.white,
                  borderRadius: 14,
                  padding: "7px 20px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-block",
                }}
              >
                OK
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
