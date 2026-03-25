"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomNeonProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution
// ─────────────────────────────────────────────────────────────────────────────

const W = 480;
const H = 360;

// ─────────────────────────────────────────────────────────────────────────────
// Neon palette
// ─────────────────────────────────────────────────────────────────────────────

const NEO = {
  bg:       "#0a0a1a",
  bgFloor:  "#0d0d22",
  pink:     "#ff00ff",
  cyan:     "#00ffff",
  green:    "#00ff66",
  yellow:   "#ffff00",
  orange:   "#ff6600",
  white:    "#ffffff",
  dimPink:  "rgba(255,0,255,0.3)",
  dimCyan:  "rgba(0,255,255,0.25)",
  floorGrid:"rgba(0,255,255,0.07)",
  wallTrim: "#ff00ff",
  gradeA:   "#ffd700",
  gradeB:   "#00ffff",
  gradeC:   "#00ff66",
  gradeD:   "#ff00ff",
};

const GRADE_COL: Record<string, string> = {
  "A賞": NEO.gradeA,
  "B賞": NEO.gradeB,
  "C賞": NEO.gradeC,
  "D賞": NEO.gradeD,
};

// NPC outline colors (wireframe-style)
const NPC_COLORS = [NEO.pink, NEO.green, NEO.yellow, NEO.orange, NEO.cyan, NEO.pink];

// ─────────────────────────────────────────────────────────────────────────────
// Room layout constants
// ─────────────────────────────────────────────────────────────────────────────

// Floor region (top = wall, bottom = entrance area)
const FLOOR_TOP = 80;
const FLOOR_BOTTOM = H - 30;
const FLOOR_LEFT = 10;
const FLOOR_RIGHT = W - 10;

// Counter position
const COUNTER_X = W / 2 - 60;
const COUNTER_Y = 100;
const COUNTER_W = 120;
const COUNTER_H = 28;

// Shelf positions (left + right walls)
const SHELVES = [
  { x: 14, y: 88, w: 52, grades: ["A賞", "B賞"] },
  { x: 14, y: 140, w: 52, grades: ["C賞", "D賞"] },
  { x: W - 66, y: 88, w: 52, grades: ["B賞", "C賞"] },
  { x: W - 66, y: 140, w: 52, grades: ["A賞", "D賞"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Neon draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function neonStroke(ctx: CanvasRenderingContext2D, color: string, blur: number, lw = 1.5) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.lineWidth = lw;
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontSize: number, blur = 14, align: CanvasTextAlign = "center") {
  ctx.save();
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur * 0.35;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function neonRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur = 12, lw = 1.5) {
  ctx.save();
  neonStroke(ctx, color, blur, lw);
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = blur * 0.3;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function clearGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// Draw Tron grid on floor
function drawFloorGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = NEO.floorGrid;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  const GRID = 28;
  // Perspective-ish: horizontal lines only, with slight converge
  for (let y = FLOOR_TOP; y <= FLOOR_BOTTOM; y += GRID) {
    const t = (y - FLOOR_TOP) / (FLOOR_BOTTOM - FLOOR_TOP);
    const lx = FLOOR_LEFT + (W * 0.1) * (1 - t);
    const rx = FLOOR_RIGHT - (W * 0.1) * (1 - t);
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(rx, y);
    ctx.stroke();
  }
  // Vertical lines
  for (let x = FLOOR_LEFT + GRID; x < FLOOR_RIGHT; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_TOP);
    ctx.lineTo(x, FLOOR_BOTTOM);
    ctx.stroke();
  }
  ctx.restore();
}

// Scanline overlay
function drawScanlines(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#000";
  for (let y = offset % 3; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Draw wireframe neon character (silhouette — outline only, no fill)
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  blur: number,
  facing: "left" | "right" | "down" | "up",
  size = 1,
) {
  const s = size;
  ctx.save();
  neonStroke(ctx, color, blur, 1.5);

  // Head (circle, outline only)
  ctx.beginPath();
  ctx.arc(x, y - 14 * s, 5 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 9 * s);
  ctx.lineTo(x, y + 2 * s);
  ctx.stroke();

  // Arms
  const armAngle = facing === "left" ? -0.3 : facing === "right" ? 0.3 : 0;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 6 * s);
  ctx.lineTo(x + Math.cos(Math.PI + armAngle) * 7 * s, y - 6 * s + Math.sin(armAngle) * 4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 6 * s, y - 6 * s);
  ctx.lineTo(x + Math.cos(armAngle) * 7 * s, y - 6 * s + Math.sin(armAngle) * 4 * s);
  ctx.stroke();

  // Legs
  const legSpread = facing === "left" || facing === "right" ? 0.3 : 0;
  ctx.beginPath();
  ctx.moveTo(x, y + 2 * s);
  ctx.lineTo(x - (3 + legSpread * 4) * s, y + 12 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 2 * s);
  ctx.lineTo(x + (3 + legSpread * 4) * s, y + 12 * s);
  ctx.stroke();

  ctx.restore();
}

// Draw neon speech bubble
function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  const pad = 5;
  ctx.save();
  ctx.font = `bold 9px "Courier New", monospace`;
  const tw = ctx.measureText(text).width;
  const bw = tw + pad * 2;
  const bh = 14;
  const bx = x - bw / 2;
  const by = y - 24;

  // Bubble bg
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(bx, by, bw, bh);
  neonRect(ctx, bx, by, bw, bh, color, 8, 1);

  // Tail
  ctx.beginPath();
  neonStroke(ctx, color, 6, 1);
  ctx.moveTo(x - 3, by + bh);
  ctx.lineTo(x, by + bh + 5);
  ctx.lineTo(x + 3, by + bh);
  ctx.stroke();

  neonText(ctx, text, x, by + bh / 2, color, 8, 10);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Character / NPC types
// ─────────────────────────────────────────────────────────────────────────────

type CharState = "idle" | "walking" | "drawing" | "celebrating";
type FacingDir = "left" | "right" | "down" | "up";

interface Character {
  id: string;
  x: number;
  y: number;
  tx: number;   // target x
  ty: number;   // target y
  color: string;
  state: CharState;
  facing: FacingDir;
  bubble: string | null;
  bubbleTimer: number;
  walkPhase: number;
  // Movement trail
  trail: { x: number; y: number; alpha: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating neon particles
// ─────────────────────────────────────────────────────────────────────────────

interface FloatParticle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  alpha: number;
  size: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function randomFloorPos(): { x: number; y: number } {
  return {
    x: clamp(FLOOR_LEFT + 30 + Math.random() * (FLOOR_RIGHT - FLOOR_LEFT - 60), FLOOR_LEFT + 20, FLOOR_RIGHT - 20),
    y: clamp(FLOOR_TOP + 30 + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP - 60), FLOOR_TOP + 20, FLOOR_BOTTOM - 20),
  };
}

function facingFromDelta(dx: number, dy: number): FacingDir {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

const CHAT_MESSAGES = ["DRAW!", "WOW!", "NICE!", "JACKPOT", "EPIC!", "LUCKY!", "GG!"];
const PRIZE_GRADES = ["A賞", "B賞", "C賞", "D賞"];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Neon({
  npcCount = 3,
  onDrawResult,
  resultGrade,
  playerNickname = "YOU",
}: PrizeRoomNeonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const pulseT = useRef(0);
  const scanOffset = useRef(0);

  // Characters
  const playerRef = useRef<Character>({
    id: "player",
    x: W / 2, y: H * 0.75,
    tx: W / 2, ty: H * 0.75,
    color: NEO.cyan,
    state: "idle",
    facing: "down",
    bubble: null,
    bubbleTimer: 0,
    walkPhase: 0,
    trail: [],
  });

  const npcsRef = useRef<Character[]>([]);

  // Floating particles
  const floatParticles = useRef<FloatParticle[]>([]);

  // NPC auto-move timer
  const npcTimers = useRef<number[]>([]);
  const npcDrawTimer = useRef(0);

  // Light cone (soft radial on floor around player)
  const [, forceRedraw] = useState(0);

  // ── Initialize NPCs ────────────────────────────────────────────────────────
  useEffect(() => {
    const count = clamp(npcCount, 1, 6);
    npcsRef.current = Array.from({ length: count }, (_, i) => {
      const pos = randomFloorPos();
      return {
        id: `npc${i}`,
        x: pos.x, y: pos.y,
        tx: pos.x, ty: pos.y,
        color: NPC_COLORS[i % NPC_COLORS.length]!,
        state: "idle" as CharState,
        facing: "down" as FacingDir,
        bubble: null,
        bubbleTimer: 0,
        walkPhase: 0,
        trail: [],
      };
    });
    npcTimers.current = Array.from({ length: count }, () => 1500 + Math.random() * 2000);

    // Init floating particles
    const colors = [NEO.pink, NEO.cyan, NEO.green, NEO.yellow, NEO.orange];
    floatParticles.current = Array.from({ length: 22 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.15 - Math.random() * 0.3,
      color: colors[i % colors.length]!,
      alpha: 0.25 + Math.random() * 0.4,
      size: 1 + Math.random() * 1.5,
    }));

    forceRedraw(k => k + 1);
  }, [npcCount]);

  // ── Move character towards target ──────────────────────────────────────────
  function moveChar(char: Character, dt: number) {
    const dx = char.tx - char.x;
    const dy = char.ty - char.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1.5) {
      char.x = char.tx;
      char.y = char.ty;
      if (char.state === "walking") char.state = "idle";
      return;
    }
    const speed = 70; // px/s
    const step = (speed * dt) / 1000;
    const frac = Math.min(1, step / dist);
    // Store trail point
    if (char.trail.length === 0 || Math.hypot(char.x - char.trail[0]!.x, char.y - char.trail[0]!.y) > 6) {
      char.trail.unshift({ x: char.x, y: char.y, alpha: 0.7 });
      if (char.trail.length > 8) char.trail.pop();
    }
    char.x += dx * frac;
    char.y += dy * frac;
    char.facing = facingFromDelta(dx, dy);
    char.state = "walking";
    char.walkPhase += dt * 0.008;
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    pulseT.current += dt * 0.003;
    scanOffset.current += dt * 0.06;
    const t = pulseT.current;

    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = NEO.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Ceiling / top wall ────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(255,0,255,0.04)";
    ctx.fillRect(0, 0, W, FLOOR_TOP);
    neonRect(ctx, 0, 0, W, FLOOR_TOP, NEO.pink, 8, 1);

    // ── Wall neon trim (sides) ────────────────────────────────────────────────
    neonRect(ctx, 0, FLOOR_TOP, 10, FLOOR_BOTTOM - FLOOR_TOP, NEO.pink, 6, 1);
    neonRect(ctx, W - 10, FLOOR_TOP, 10, FLOOR_BOTTOM - FLOOR_TOP, NEO.pink, 6, 1);

    // ── Floor ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = NEO.bgFloor;
    ctx.fillRect(FLOOR_LEFT, FLOOR_TOP, FLOOR_RIGHT - FLOOR_LEFT, FLOOR_BOTTOM - FLOOR_TOP);
    drawFloorGrid(ctx);

    // ── Floating particles ────────────────────────────────────────────────────
    for (const p of floatParticles.current) {
      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W + 4;
      if (p.x > W + 4) p.x = -4;
      ctx.save();
      ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t * 2.5 + p.x * 0.1));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Shelves ───────────────────────────────────────────────────────────────
    for (const shelf of SHELVES) {
      // Shelf frame
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(shelf.x, shelf.y, shelf.w, 26);
      neonRect(ctx, shelf.x, shelf.y, shelf.w, 26, NEO.pink, 8, 1);

      // Prize boxes
      const boxW = shelf.w / 2 - 4;
      for (let i = 0; i < 2; i++) {
        const grade = shelf.grades[i] ?? "C賞";
        const col = GRADE_COL[grade] ?? NEO.cyan;
        const bx = shelf.x + 2 + i * (boxW + 2);
        const by = shelf.y + 4;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.5 + shelf.x * 0.05);
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.1 * pulse;
        ctx.fillStyle = col;
        ctx.fillRect(bx, by, boxW, 18);
        ctx.restore();
        neonRect(ctx, bx, by, boxW, 18, col, 6 + 4 * pulse, 1);
        neonText(ctx, grade[0] ?? "", bx + boxW / 2, by + 9, col, 8, 8);
      }
    }

    // ── Neon signs on wall ────────────────────────────────────────────────────
    // "一番賞" (center top wall)
    const signPulse = 0.7 + 0.3 * Math.sin(t * 1.5);
    ctx.save();
    ctx.globalAlpha = signPulse;
    neonText(ctx, "一番賞", W / 2, 32, NEO.pink, 18, 28);
    ctx.restore();

    // "OPEN" sign (right side of wall)
    const openPulse = Math.sin(t * 3) > 0 ? 1 : 0.4;
    ctx.save();
    ctx.globalAlpha = openPulse;
    neonText(ctx, "OPEN", W - 50, 46, NEO.green, 11, 16);
    ctx.restore();

    // ── Counter ───────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H);
    neonRect(ctx, COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H, NEO.cyan, 12, 2);

    // "DRAW" pulsing text on counter
    const drawPulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.5));
    ctx.save();
    ctx.globalAlpha = drawPulse;
    neonText(ctx, "DRAW", COUNTER_X + COUNTER_W / 2, COUNTER_Y + COUNTER_H / 2, NEO.yellow, 11, 18);
    ctx.restore();

    // ── Player light cone (radial gradient on floor) ─────────────────────────
    const player = playerRef.current;
    const radGrad = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 40);
    radGrad.addColorStop(0, "rgba(0,255,255,0.08)");
    radGrad.addColorStop(1, "rgba(0,255,255,0)");
    ctx.save();
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Draw NPCs (behind counter sorting) ───────────────────────────────────
    const allChars: Character[] = [...npcsRef.current, player];
    // Sort by Y for depth
    allChars.sort((a, b) => a.y - b.y);

    for (const char of allChars) {
      const isPlayer = char.id === "player";
      const col = char.color;
      const blur = isPlayer ? 16 : 10;

      // Movement trail
      for (let i = 0; i < char.trail.length; i++) {
        const tp = char.trail[i]!;
        tp.alpha -= dt * 0.003;
        if (tp.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = tp.alpha * 0.5;
          ctx.fillStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y + 12, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      char.trail = char.trail.filter((tp) => tp.alpha > 0);

      // Shadow on floor
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(char.x, char.y + 14, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Wireframe character
      drawCharacter(ctx, char.x, char.y, col, blur, char.facing);

      // Name tag
      const tag = isPlayer ? playerNickname : `NPC${char.id.replace("npc", "")}`;
      neonText(ctx, tag, char.x, char.y - 28, col, 7, 8);

      // State indicator dot
      const dotCol =
        char.state === "walking" ? NEO.green :
        char.state === "drawing" ? NEO.yellow :
        char.state === "celebrating" ? NEO.orange :
        "transparent";
      if (dotCol !== "transparent") {
        ctx.save();
        ctx.fillStyle = dotCol;
        ctx.shadowColor = dotCol;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(char.x + 8, char.y - 22, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Speech / prize bubble
      if (char.bubble && char.bubbleTimer > 0) {
        drawBubble(ctx, char.bubble, char.x, char.y - 24, col);
      }
    }

    clearGlow(ctx);

    // ── Scanlines ─────────────────────────────────────────────────────────────
    drawScanlines(ctx, scanOffset.current);
  }, [playerNickname]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = useCallback((ts: number) => {
    const dt = Math.min(ts - lastTime.current, 100);
    lastTime.current = ts;

    const player = playerRef.current;
    moveChar(player, dt);
    if (player.bubbleTimer > 0) {
      player.bubbleTimer -= dt;
      if (player.bubbleTimer <= 0) player.bubble = null;
    }

    // NPC auto-wander + draw
    npcDrawTimer.current -= dt;
    if (npcDrawTimer.current <= 0) {
      npcDrawTimer.current = 3000 + Math.random() * 4000;
      // Pick random NPC to draw
      const npcs = npcsRef.current;
      if (npcs.length > 0) {
        const npc = npcs[Math.floor(Math.random() * npcs.length)]!;
        npc.tx = COUNTER_X + COUNTER_W / 2;
        npc.ty = COUNTER_Y + COUNTER_H + 20;
        npc.state = "walking";
        const grade = PRIZE_GRADES[Math.floor(Math.random() * PRIZE_GRADES.length)]!;
        setTimeout(() => {
          npc.state = "drawing";
          npc.bubble = grade;
          npc.bubbleTimer = 2000;
          onDrawResult?.(grade, "限定公仔");
          setTimeout(() => {
            npc.state = "celebrating";
            const pos = randomFloorPos();
            npc.tx = pos.x;
            npc.ty = pos.y;
            setTimeout(() => { npc.state = "idle"; }, 2000);
          }, 1200);
        }, 1200);
      }
    }

    for (let i = 0; i < npcsRef.current.length; i++) {
      const npc = npcsRef.current[i]!;
      npcTimers.current[i] = (npcTimers.current[i] ?? 0) - dt;
      if (npcTimers.current[i]! <= 0 && npc.state === "idle") {
        npcTimers.current[i] = 2000 + Math.random() * 3000;
        const pos = randomFloorPos();
        npc.tx = pos.x;
        npc.ty = pos.y;
        npc.state = "walking";
        // Random chat
        if (Math.random() < 0.35) {
          npc.bubble = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)]!;
          npc.bubbleTimer = 1800;
        }
      }
      moveChar(npc, dt);
      if (npc.bubbleTimer > 0) {
        npc.bubbleTimer -= dt;
        if (npc.bubbleTimer <= 0) npc.bubble = null;
      }
    }

    // If resultGrade changes, show it on player
    if (resultGrade && player.bubble !== resultGrade) {
      player.bubble = resultGrade;
      player.bubbleTimer = 2500;
      player.state = "celebrating";
      setTimeout(() => { playerRef.current.state = "idle"; }, 2500);
    }

    draw(dt);
    animRef.current = requestAnimationFrame(animate);
  }, [draw, onDrawResult, resultGrade]);

  // ── Start/stop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Click to move player ───────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;

    // Only allow movement on the floor area
    if (ny < FLOOR_TOP + 10 || ny > FLOOR_BOTTOM - 10 || nx < FLOOR_LEFT + 10 || nx > FLOOR_RIGHT - 10) return;

    const player = playerRef.current;
    player.tx = clamp(nx, FLOOR_LEFT + 12, FLOOR_RIGHT - 12);
    player.ty = clamp(ny, FLOOR_TOP + 12, FLOOR_BOTTOM - 12);
    player.state = "walking";
  }, []);

  return (
    <div
      className="flex items-center justify-center w-full"
      style={{ background: NEO.bg, padding: 6 }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleClick}
        style={{
          width: "100%",
          maxWidth: W,
          cursor: "crosshair",
          display: "block",
        }}
      />
    </div>
  );
}
