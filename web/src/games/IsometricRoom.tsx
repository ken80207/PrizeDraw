"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlotMachine } from "./SlotMachine";
import { ClawMachine } from "./ClawMachine";
import { GachaMachine } from "./GachaMachine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IsoPoint { isoX: number; isoY: number }
interface ScreenPoint { x: number; y: number }

type CharacterState = "IDLE" | "WALKING" | "QUEUING" | "DRAWING" | "CELEBRATING";
type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";

interface Character {
  id: string;
  nickname: string;
  shirtColor: string;
  skinColor: string;
  pos: IsoPoint;
  targetPos: IsoPoint | null;
  path: IsoPoint[];
  state: CharacterState;
  direction: Direction;
  isPlayer: boolean;
  bubble: { text: string; color: string; expiry: number; type: "chat" | "prize" } | null;
  bobPhase: number;
  // Idle animation state
  idleAction: "none" | "phone" | "stretch" | "look";
  idleActionExpiry: number;
  headTurnOffset: number; // -1 | 0 | 1 px shift
  nextHeadTurnAt: number;
  // Visual sound indicators
  exclamationExpiry: number;
}

type TileType = "FLOOR" | "WALL" | "COUNTER" | "CARPET" | "EMPTY";

// Player draw flow phase machine
type RoomPhase = "EXPLORING" | "AT_COUNTER" | "SELECTING_GAME" | "PLAYING" | "RESULT";

type MiniGameKey = "slot" | "claw" | "gacha";

export interface IsometricRoomProps {
  npcCount?: number;
  onStateChange?: (info: { yourPos: IsoPoint; queue: string[]; activeDrawer: string | null }) => void;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  resultPrizeName?: string;
  playerNickname?: string;
}

// Counter tile: center between iso (6,4) and (7,4)
const COUNTER_TILE: IsoPoint = { isoX: 6.5, isoY: 4 };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 640;
const CANVAS_H = 460;

const MAP_W = 14;
const MAP_H = 14;
const TILE_W = 56;
const TILE_H = 30;

const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = 55;

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate transforms
// ─────────────────────────────────────────────────────────────────────────────

function isoToScreen(p: IsoPoint): ScreenPoint {
  return {
    x: ORIGIN_X + (p.isoX - p.isoY) * (TILE_W / 2),
    y: ORIGIN_Y + (p.isoX + p.isoY) * (TILE_H / 2),
  };
}

function screenToIso(s: ScreenPoint): IsoPoint {
  const dx = s.x - ORIGIN_X;
  const dy = s.y - ORIGIN_Y;
  const isoX = (dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2;
  const isoY = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return { isoX, isoY };
}

function snapToGrid(p: IsoPoint): IsoPoint {
  return { isoX: Math.round(p.isoX), isoY: Math.round(p.isoY) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Map definition
// ─────────────────────────────────────────────────────────────────────────────
// 0=floor 1=wall 3=counter 4=carpet 5=empty
const MAP_DATA: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 4, 4, 0, 3, 3, 0, 4, 4, 0, 0, 1],
  [1, 0, 0, 4, 4, 0, 0, 0, 0, 4, 4, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
];

const TILE_TYPES: Record<number, TileType> = {
  0: "FLOOR", 1: "WALL", 3: "COUNTER", 4: "CARPET", 5: "EMPTY",
};

function buildTileMap(): { type: TileType }[][] {
  return MAP_DATA.map((row) => row.map((code) => ({ type: TILE_TYPES[code] ?? "FLOOR" })));
}

function isWalkable(isoX: number, isoY: number): boolean {
  const col = Math.round(isoX);
  const row = Math.round(isoY);
  if (col < 0 || col >= MAP_W || row < 0 || row >= MAP_H) return false;
  const code = MAP_DATA[row]?.[col] ?? 1;
  return code === 0 || code === 4;
}

// Simple A* pathfinding
function findPath(from: IsoPoint, to: IsoPoint): IsoPoint[] {
  const start = snapToGrid(from);
  const goal = snapToGrid(to);
  if (!isWalkable(goal.isoX, goal.isoY)) return [];

  type Node = { pos: IsoPoint; g: number; f: number; parent: Node | null };
  const key = (p: IsoPoint) => `${Math.round(p.isoX)},${Math.round(p.isoY)}`;
  const heuristic = (a: IsoPoint, b: IsoPoint) =>
    Math.abs(a.isoX - b.isoX) + Math.abs(a.isoY - b.isoY);

  const open: Node[] = [{ pos: start, g: 0, f: heuristic(start, goal), parent: null }];
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const ck = key(current.pos);
    if (ck === key(goal)) {
      const path: IsoPoint[] = [];
      let node: Node | null = current;
      while (node) { path.unshift(node.pos); node = node.parent; }
      return path.slice(1);
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const d of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
      const nx = current.pos.isoX + d.dx;
      const ny = current.pos.isoY + d.dy;
      if (!isWalkable(nx, ny)) continue;
      const np: IsoPoint = { isoX: nx, isoY: ny };
      const nk = key(np);
      if (closed.has(nk)) continue;
      const g = current.g + 1;
      open.push({ pos: np, g, f: g + heuristic(np, goal), parent: current });
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkle particle system
// ─────────────────────────────────────────────────────────────────────────────

interface Sparkle {
  x: number; y: number; vx: number; vy: number;
  life: number; size: number; color: string; rotation: number; rotSpeed: number;
}

const SPARKLE_COLORS = ["#fbbf24", "#f59e0b", "#fde68a", "#fff", "#fb923c", "#f472b6", "#a78bfa"];

function spawnSparkles(x: number, y: number, count: number): Sparkle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      size: 2 + Math.random() * 4,
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)] ?? "#fbbf24",
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Float-up symbol particle system (♪ notes, ✨ sparkles, etc.)
// ─────────────────────────────────────────────────────────────────────────────

interface FloatSymbol {
  x: number; y: number;
  symbol: string;
  color: string;
  alpha: number;
  vy: number;
  vx: number;
  life: number; // 0..1 countdown
  size: number;
}

function spawnFloatSymbols(x: number, y: number, symbol: string, color: string, count: number): FloatSymbol[] {
  return Array.from({ length: count }, (_, i) => ({
    x: x + (Math.random() - 0.5) * 20,
    y,
    symbol,
    color,
    alpha: 1,
    vy: -(0.6 + Math.random() * 0.8),
    vx: (Math.random() - 0.5) * 0.6,
    life: 1,
    size: 10 + Math.random() * 4,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Room Drawing — Back wall, shelves, counter
// ─────────────────────────────────────────────────────────────────────────────

function drawRoom(ctx: CanvasRenderingContext2D, t: number) {
  // ── Sky / background gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bgGrad.addColorStop(0, "#1a0a2e");
  bgGrad.addColorStop(1, "#0a0f1a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Back wall — far left corner ──
  // The back wall in isometric view spans from iso (0,0) to (MAP_W, 0) and (0, 0) to (0, MAP_H)
  // We draw a solid polygon behind the floor tiles

  // Back wall LEFT face (along isoY = 0 axis, left side)
  const wallTopLeft = isoToScreen({ isoX: 0, isoY: 0 });
  const wallTopRight = isoToScreen({ isoX: MAP_W, isoY: 0 });
  const wallBottomLeft = isoToScreen({ isoX: 0, isoY: MAP_H });
  const wallH = 120; // wall height in pixels

  // Left back wall panel
  const lwGrad = ctx.createLinearGradient(0, wallTopLeft.y - wallH, 0, wallTopLeft.y);
  lwGrad.addColorStop(0, "#2d1f4e");
  lwGrad.addColorStop(1, "#1a1230");
  ctx.fillStyle = lwGrad;
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - wallH);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y - wallH);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y);
  ctx.closePath();
  ctx.fill();

  // Right back wall panel (along isoX = 0)
  const rwGrad = ctx.createLinearGradient(wallTopLeft.x, 0, wallTopRight.x, 0);
  rwGrad.addColorStop(0, "#231a3d");
  rwGrad.addColorStop(1, "#342855");
  ctx.fillStyle = rwGrad;
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - wallH);
  ctx.lineTo(wallTopRight.x, wallTopRight.y - wallH);
  ctx.lineTo(wallTopRight.x, wallTopRight.y);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y);
  ctx.closePath();
  ctx.fill();

  // ── Wall panel lines (subtle horizontal banding) ──
  // Left wall panels (vertical bands along isoY=0 direction)
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#9f7ec0";
  ctx.lineWidth = 0.7;
  const panelStep = 18;
  for (let py = wallTopLeft.y - wallH + panelStep; py < wallTopLeft.y; py += panelStep) {
    // Left wall (goes from wallTopLeft to wallBottomLeft horizontally)
    const lerpT = (py - (wallTopLeft.y - wallH)) / wallH;
    const lx0 = wallTopLeft.x + (wallBottomLeft.x - wallTopLeft.x) * lerpT;
    ctx.beginPath();
    ctx.moveTo(lx0, py);
    ctx.lineTo(wallBottomLeft.x, py + (wallBottomLeft.y - wallTopLeft.y) * lerpT);
    ctx.stroke();
  }
  // Right wall panels
  for (let py = wallTopLeft.y - wallH + panelStep; py < wallTopLeft.y; py += panelStep) {
    const lerpT = (py - (wallTopLeft.y - wallH)) / wallH;
    const rx0 = wallTopLeft.x + (wallTopRight.x - wallTopLeft.x) * lerpT;
    ctx.beginPath();
    ctx.moveTo(rx0, py);
    ctx.lineTo(wallTopRight.x, wallTopRight.y - wallH + (py - (wallTopLeft.y - wallH)));
    ctx.stroke();
  }
  ctx.restore();

  // ── Baseboard — dark strip where wall meets floor ──
  const baseH = 7;
  // Left wall baseboard
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#110820";
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - baseH);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y - baseH);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y);
  ctx.closePath();
  ctx.fill();
  // Right wall baseboard
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - baseH);
  ctx.lineTo(wallTopRight.x, wallTopRight.y - baseH);
  ctx.lineTo(wallTopRight.x, wallTopRight.y);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Ambient occlusion — soft shadow where wall meets floor ──
  // Left wall AO
  ctx.save();
  const aoGradL = ctx.createLinearGradient(0, wallTopLeft.y - 12, 0, wallTopLeft.y + 5);
  aoGradL.addColorStop(0, "rgba(0,0,0,0)");
  aoGradL.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = aoGradL;
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - 12);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y - 12);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y + 5);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Wall edge line (top of walls)
  ctx.strokeStyle = "#5b3f8a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - wallH);
  ctx.lineTo(wallBottomLeft.x, wallBottomLeft.y - wallH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - wallH);
  ctx.lineTo(wallTopRight.x, wallTopRight.y - wallH);
  ctx.stroke();

  // Corner accent line
  ctx.strokeStyle = "#7c5fc0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wallTopLeft.x, wallTopLeft.y - wallH);
  ctx.lineTo(wallTopLeft.x, wallTopLeft.y);
  ctx.stroke();

  // ── Prize display shelves on the back wall ──
  // Three grade display cases positioned along the right back wall
  const displayData = [
    { iso: { isoX: 2, isoY: 1 }, grade: "A賞", color: "#f59e0b", glow: "#fbbf24", label: "A賞" },
    { iso: { isoX: 6, isoY: 1 }, grade: "B賞", color: "#38bdf8", glow: "#0ea5e9", label: "B賞" },
    { iso: { isoX: 10, isoY: 1 }, grade: "C賞", color: "#34d399", glow: "#10b981", label: "C賞" },
  ];

  for (const disp of displayData) {
    const sc = isoToScreen(disp.iso);
    drawPrizeDisplay(ctx, sc.x, sc.y - wallH + 20, disp.color, disp.glow, disp.label, t);
  }

  // ── Poster on right back wall ──
  drawPoster(ctx, t);

  // ── Hanging banner ──
  drawHangingBanner(ctx, t);

  // ── Ceiling pendant lights (drawn early so floor glow is under tiles) ──
  drawCeilingLights(ctx, t);

  // ── Floor tiles ──
  drawFloor(ctx, t);

  // ── Entrance mat + neon sign ──
  drawEntranceMat(ctx);
  drawNeonSign(ctx, t);
}

function drawPrizeDisplay(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string, glow: string, label: string, t: number
) {
  const w = 44, h = 54;

  // Glow behind the cabinet
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18 + Math.sin(t * 2) * 4;
  const glowGrad = ctx.createRadialGradient(x, y + h / 2, 5, x, y + h / 2, w * 1.2);
  glowGrad.addColorStop(0, `${glow}33`);
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x - w, y - 5, w * 2, h + 10);
  ctx.restore();

  // Cabinet body (3D box)
  // Top face
  ctx.fillStyle = "#3d2d6e";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y, w, h, 4);
  ctx.fill();

  // Glass front
  const glassGrad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  glassGrad.addColorStop(0, "rgba(255,255,255,0.08)");
  glassGrad.addColorStop(0.3, "rgba(255,255,255,0.03)");
  glassGrad.addColorStop(1, "rgba(255,255,255,0.01)");
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 3, y + 3, w - 6, h - 6, 2);
  ctx.fill();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Prize box bobbing animation
  const bobOffset = Math.sin(t * 1.8 + x * 0.05) * 2;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  const boxGrad2 = ctx.createLinearGradient(x - w / 3, y + 10 + bobOffset, x + w / 3, y + h - 10 + bobOffset);
  boxGrad2.addColorStop(0, color);
  boxGrad2.addColorStop(1, `${color}44`);
  ctx.fillStyle = boxGrad2;
  ctx.beginPath();
  ctx.roundRect(x - 12, y + 12 + bobOffset, 24, 24, 3);
  ctx.fill();
  ctx.restore();

  // Glass reflection — diagonal highlight stripe
  ctx.save();
  ctx.globalAlpha = 0.18;
  const reflGrad = ctx.createLinearGradient(x - w / 2 + 4, y + 4, x - w / 2 + 18, y + 20);
  reflGrad.addColorStop(0, "rgba(255,255,255,0.9)");
  reflGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = reflGrad;
  ctx.beginPath();
  // Thin diagonal stripe
  ctx.moveTo(x - w / 2 + 5, y + 5);
  ctx.lineTo(x - w / 2 + 16, y + 5);
  ctx.lineTo(x - w / 2 + 8, y + 22);
  ctx.lineTo(x - w / 2 + 2, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = color;
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + h - 8);

  // Price tag below cabinet
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#fef3c7";
  ctx.font = "6px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("100 點/抽", x, y + h + 3);
  ctx.restore();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y, w, h, 4);
  ctx.stroke();
}

function drawPoster(ctx: CanvasRenderingContext2D, t: number) {
  // Position the poster on the right back wall
  const sc = isoToScreen({ isoX: 12, isoY: 1 });
  const px = sc.x - 10;
  const py = sc.y - 105;
  const pw = 50, ph = 68;

  // Poster background
  const pGrad = ctx.createLinearGradient(px, py, px, py + ph);
  pGrad.addColorStop(0, "#4c1d95");
  pGrad.addColorStop(1, "#1e1040");
  ctx.fillStyle = pGrad;
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 3);
  ctx.fill();
  ctx.stroke();

  // Top strip
  const stripGrad = ctx.createLinearGradient(px, py, px + pw, py);
  stripGrad.addColorStop(0, "#7c3aed");
  stripGrad.addColorStop(1, "#db2777");
  ctx.fillStyle = stripGrad;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 14, [3, 3, 0, 0]);
  ctx.fill();

  // Title text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("一番賞", px + pw / 2, py + 7);

  // Star decoration
  const pulse = 0.8 + Math.sin(t * 3) * 0.2;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillText("★", px + pw / 2, py + 34);
  ctx.restore();

  // Bottom text
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 6px system-ui, sans-serif";
  ctx.fillText("大賞", px + pw / 2, py + ph - 10);
  ctx.fillText("絶賛開催中!", px + pw / 2, py + ph - 3);
}

// ── Hanging Banner / Flag ──────────────────────────────────────────────────

function drawHangingBanner(ctx: CanvasRenderingContext2D, t: number) {
  // Banner hangs from the top of the back-right wall, slightly right of center
  const anchorSc = isoToScreen({ isoX: 7, isoY: 0 });
  const ax = anchorSc.x + 10;
  const ay = anchorSc.y - 105; // at top of wall

  const bannerW = 22;
  const bannerH = 56;
  const swayAmp = 2.5;

  // Generate wavy flag vertices using sin
  // Banner is a quadrilateral: top-left, top-right, bottom-right (waved), bottom-left (waved)
  const segments = 8;
  const points: Array<{ x: number; y: number }> = [];

  // Left edge (attachment pole side — less sway)
  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const sway = Math.sin(t * 2.2 + frac * Math.PI * 1.5) * swayAmp * frac * 0.3;
    points.push({ x: ax + sway, y: ay + frac * bannerH });
  }

  // Right edge (free end — more sway)
  for (let i = segments; i >= 0; i--) {
    const frac = i / segments;
    const sway = Math.sin(t * 2.2 + frac * Math.PI * 1.5 + 0.4) * swayAmp * (1 - frac * 0.3);
    points.push({ x: ax + bannerW + sway, y: ay + frac * bannerH });
  }

  // Background fill (gradient red/gold)
  const bannerGrad = ctx.createLinearGradient(ax, ay, ax + bannerW, ay + bannerH);
  bannerGrad.addColorStop(0, "#dc2626");
  bannerGrad.addColorStop(0.5, "#b91c1c");
  bannerGrad.addColorStop(1, "#7f1d1d");
  ctx.save();
  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const pt of points.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.fillStyle = bannerGrad;
  ctx.fill();

  // Gold border
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Pennant point at bottom (triangle tip)
  const leftBottomX = ax + Math.sin(t * 2.2 + Math.PI * 1.5) * swayAmp * 0.3;
  const rightBottomX = ax + bannerW + Math.sin(t * 2.2 + Math.PI * 1.5 + 0.4) * swayAmp;
  const tipX = (leftBottomX + rightBottomX) / 2 + Math.sin(t * 2.2) * 1.5;
  const tipY = ay + bannerH + 14;

  ctx.save();
  ctx.shadowColor = "#ef4444";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.moveTo(leftBottomX, ay + bannerH);
  ctx.lineTo(rightBottomX, ay + bannerH);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Horizontal gold stripe
  const stripeY = ay + 12;
  const stripeAnchorSway = Math.sin(t * 2.2 + 0.3) * swayAmp * 0.15;
  const stripeEndSway = Math.sin(t * 2.2 + Math.PI + 0.3) * swayAmp;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(ax + stripeAnchorSway, stripeY);
  ctx.lineTo(ax + bannerW + stripeEndSway, stripeY);
  ctx.lineTo(ax + bannerW + stripeEndSway, stripeY + 3);
  ctx.lineTo(ax + stripeAnchorSway, stripeY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Text "一番賞" — rotated slightly with the banner sway
  const midSway = Math.sin(t * 2.2 + 0.7) * swayAmp * 0.5;
  const textX = ax + bannerW / 2 + midSway;
  const textAngle = Math.sin(t * 2.2) * 0.03;
  ctx.save();
  ctx.translate(textX, ay + bannerH / 2 + 8);
  ctx.rotate(textAngle);
  ctx.fillStyle = "#fef3c7";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Write vertically stacked
  ctx.fillText("一", 0, -10);
  ctx.fillText("番", 0, 0);
  ctx.fillText("賞", 0, 10);
  ctx.restore();

  // Hanging string
  ctx.save();
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  const topSway = Math.sin(t * 2.2) * swayAmp * 0.1;
  ctx.beginPath();
  ctx.moveTo(ax + bannerW / 2 + topSway, ay - 8);
  ctx.lineTo(ax + bannerW / 2 + topSway, ay + 1);
  ctx.stroke();
  // Small ring at top
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ax + bannerW / 2 + topSway, ay - 9, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ── Ceiling Light Fixtures ─────────────────────────────────────────────────

function drawCeilingLights(ctx: CanvasRenderingContext2D, t: number) {
  // Three pendant lights hanging from the ceiling
  const wallTopRight = isoToScreen({ isoX: MAP_W, isoY: 0 });
  const wallTopLeft = isoToScreen({ isoX: 0, isoY: MAP_H });
  const wallCorner = isoToScreen({ isoX: 0, isoY: 0 });

  const fixturePositions = [
    // Spread across the room ceiling area
    { x: wallCorner.x - 60,  y: wallCorner.y - 70, phase: 0 },
    { x: (wallCorner.x + wallTopRight.x) / 2, y: (wallCorner.y + wallTopRight.y) / 2 - 65, phase: 1.3 },
    { x: (wallCorner.x + wallTopLeft.x) / 2,  y: (wallCorner.y + wallTopLeft.y) / 2 - 65,  phase: 2.6 },
  ];

  for (const fix of fixturePositions) {
    const pulse = 0.82 + Math.sin(t * 1.6 + fix.phase) * 0.18;
    const wireLen = 22 + Math.sin(t * 0.4 + fix.phase) * 1;

    // Ceiling wire
    ctx.save();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fix.x, fix.y);
    ctx.lineTo(fix.x, fix.y + wireLen);
    ctx.stroke();

    // Pendant shade (trapezoid)
    const shadeTopW = 10;
    const shadeBotW = 18;
    const shadeH = 10;
    const shadeY = fix.y + wireLen;
    const shadeGrad = ctx.createLinearGradient(fix.x, shadeY, fix.x, shadeY + shadeH);
    shadeGrad.addColorStop(0, "#1f2937");
    shadeGrad.addColorStop(1, "#111827");
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.moveTo(fix.x - shadeTopW / 2, shadeY);
    ctx.lineTo(fix.x + shadeTopW / 2, shadeY);
    ctx.lineTo(fix.x + shadeBotW / 2, shadeY + shadeH);
    ctx.lineTo(fix.x - shadeBotW / 2, shadeY + shadeH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Bulb glow at bottom of shade
    const bulbY = shadeY + shadeH;
    const bulbR = 4;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = "#fef3c7";
    ctx.shadowBlur = 14;
    const bulbGrad = ctx.createRadialGradient(fix.x, bulbY, 0, fix.x, bulbY, bulbR * 2);
    bulbGrad.addColorStop(0, "#fffde7");
    bulbGrad.addColorStop(0.4, "#fef08a");
    bulbGrad.addColorStop(1, "transparent");
    ctx.fillStyle = bulbGrad;
    ctx.beginPath();
    ctx.arc(fix.x, bulbY, bulbR * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffde7";
    ctx.beginPath();
    ctx.arc(fix.x, bulbY, bulbR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floor glow cone — soft warm ellipse on the floor below
    // Project the light down to its floor position
    const floorGlowY = fix.y + 180; // approximate floor y for this part of the room
    const coneGrad = ctx.createRadialGradient(fix.x, floorGlowY, 10, fix.x, floorGlowY, 65);
    coneGrad.addColorStop(0, `rgba(255, 230, 120, ${0.10 * pulse})`);
    coneGrad.addColorStop(0.5, `rgba(255, 200, 80, ${0.05 * pulse})`);
    coneGrad.addColorStop(1, "rgba(255,180,40,0)");
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.ellipse(fix.x, floorGlowY, 65, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Light cone shape (triangle from shade to floor)
    ctx.save();
    ctx.globalAlpha = 0.025 * pulse;
    const coneTopHalf = shadeBotW / 2 + 2;
    const coneBotHalf = 55;
    const coneFillGrad = ctx.createLinearGradient(fix.x, bulbY, fix.x, floorGlowY);
    coneFillGrad.addColorStop(0, "rgba(255,240,160,0.6)");
    coneFillGrad.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = coneFillGrad;
    ctx.beginPath();
    ctx.moveTo(fix.x - coneTopHalf, bulbY);
    ctx.lineTo(fix.x + coneTopHalf, bulbY);
    ctx.lineTo(fix.x + coneBotHalf, floorGlowY);
    ctx.lineTo(fix.x - coneBotHalf, floorGlowY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

// ── Neon OPEN Sign ─────────────────────────────────────────────────────────

function drawNeonSign(ctx: CanvasRenderingContext2D, t: number) {
  // Positioned above the entrance gap (cols 5-6, bottom of map)
  const mat1 = isoToScreen({ isoX: 5, isoY: 13 });
  const mat2 = isoToScreen({ isoX: 6, isoY: 13 });
  const cx = (mat1.x + mat2.x) / 2;
  const cy = (mat1.y + mat2.y) / 2 - 68;

  // Flicker: occasional brief dimming
  const flickerSeed = Math.floor(t * 8) % 17;
  const flicker = flickerSeed === 3 || flickerSeed === 11 ? 0.25 : 1.0;
  const pulse = (0.85 + Math.sin(t * 3.2) * 0.15) * flicker;

  const signW = 56;
  const signH = 22;

  ctx.save();

  // Sign backing box
  ctx.fillStyle = "rgba(5,5,15,0.88)";
  ctx.strokeStyle = "rgba(150,80,200,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - signW / 2 - 4, cy - signH / 2 - 4, signW + 8, signH + 8, 5);
  ctx.fill();
  ctx.stroke();

  // Neon glow effect
  ctx.globalAlpha = pulse;
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 16 + Math.sin(t * 2.4) * 4;

  // "OPEN" text in neon green
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 14px system-ui, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OPEN", cx - 4, cy + 1);

  // Second glow pass for intensity
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = pulse * 0.4;
  ctx.fillText("OPEN", cx - 4, cy + 1);

  ctx.restore();

  // Japanese text below
  ctx.save();
  ctx.globalAlpha = pulse * 0.8;
  ctx.shadowColor = "#ff6ec7";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ff6ec7";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("営業中", cx + 16, cy + 1);
  ctx.restore();

  // Vertical divider between OPEN and 営業中
  ctx.save();
  ctx.globalAlpha = pulse * 0.5;
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 7, cy - 7);
  ctx.lineTo(cx + 7, cy + 8);
  ctx.stroke();
  ctx.restore();
}

function drawFloor(ctx: CanvasRenderingContext2D, t: number) {
  // Draw floor tiles with wood plank effect in isometric order
  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const code = MAP_DATA[row]?.[col] ?? 1;
      if (code === 1 || code === 5) continue;
      drawFloorTile(ctx, col, row, code, t);
    }
  }
}

function drawFloorTile(ctx: CanvasRenderingContext2D, isoX: number, isoY: number, code: number, _t: number) {
  const s = isoToScreen({ isoX, isoY });
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  const isCarpet = code === 4;
  const isCounter = code === 3;
  if (isCounter) return;

  if (isCarpet) {
    // Red carpet / display platform
    const variation = ((isoX + isoY) % 2 === 0) ? 0 : 10;
    const topColor = `rgba(${60 + variation}, ${15}, ${80 + variation}, 0.9)`;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y - hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x - hw, s.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.strokeStyle = "#5b1080";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Carpet side edges
    const edgeH = 6;
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x, s.y + hh + edgeH);
    ctx.lineTo(s.x - hw, s.y + edgeH);
    ctx.closePath();
    ctx.fillStyle = "#1a0a2e";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s.x, s.y + hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x + hw, s.y + edgeH);
    ctx.lineTo(s.x, s.y + hh + edgeH);
    ctx.closePath();
    ctx.fillStyle = "#230f3d";
    ctx.fill();
    return;
  }

  // ── Wood planks — 4 planks running diagonally across the tile ──
  // Each plank is a thin parallelogram band within the diamond.
  // We clip to the tile diamond then draw each plank band.
  const PLANK_COUNT = 4;
  // Deterministic per-tile seed for color variation
  const tileSeed = ((isoX * 7 + isoY * 13) | 0) % 16;

  ctx.save();
  // Clip to diamond
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x, s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.clip();

  // Base gradient fill first (warm wood under-layer)
  const baseR = 68 + (tileSeed % 8) * 6;
  const baseG = 36 + (tileSeed % 6) * 4;
  const baseB = 8 + (tileSeed % 4) * 2;
  const tileGrad = ctx.createLinearGradient(s.x - hw, s.y - hh, s.x + hw, s.y + hh);
  tileGrad.addColorStop(0, `rgb(${baseR + 10},${baseG + 6},${baseB + 2})`);
  tileGrad.addColorStop(1, `rgb(${baseR - 8},${baseG - 4},${baseB})`);
  ctx.fillStyle = tileGrad;
  ctx.fillRect(s.x - hw - 1, s.y - hh - 1, TILE_W + 2, TILE_H + 2);

  // Individual plank bands — each runs from upper-right to lower-left (diagonal)
  for (let p = 0; p < PLANK_COUNT; p++) {
    // Plank offset along the tile's diagonal axis (isoX + isoY direction)
    const t0 = p / PLANK_COUNT;
    const t1 = (p + 0.92) / PLANK_COUNT; // slight gap between planks

    // The isometric tile's diagonal goes from top-right to bottom-left.
    // We parameterise along the perpendicular axis (isoX - isoY direction).
    // In screen space: perpendicular axis is dx = hw, dy = hh (right-and-down).
    // Plank band spans from t0*2-1 to t1*2-1 along this axis.
    const perpX = hw; // full width of perpendicular vector
    const perpY = hh;

    // Four corners of the plank band (parallelogram)
    const p0x = s.x + perpX * (t0 * 2 - 1);
    const p0y = s.y + perpY * (t0 * 2 - 1);
    const p1x = s.x + perpX * (t1 * 2 - 1);
    const p1y = s.y + perpY * (t1 * 2 - 1);

    // Extend each edge along the plank direction (opposite perpendicular)
    const extX = hw * 1.5;
    const extY = -hh * 1.5;

    // Plank color varies slightly per plank and per tile
    const variation = ((tileSeed + p * 3) % 12) - 6;
    const pr = Math.min(255, Math.max(0, baseR + variation));
    const pg = Math.min(255, Math.max(0, baseG + variation / 2));
    const pb = Math.min(255, Math.max(0, baseB));

    const plankGrad = ctx.createLinearGradient(p0x, p0y, p1x, p1y);
    plankGrad.addColorStop(0, `rgb(${pr + 8},${pg + 4},${pb + 1})`);
    plankGrad.addColorStop(0.5, `rgb(${pr},${pg},${pb})`);
    plankGrad.addColorStop(1, `rgb(${pr - 6},${pg - 3},${pb})`);

    ctx.fillStyle = plankGrad;
    ctx.beginPath();
    ctx.moveTo(p0x - extX, p0y - extY);
    ctx.lineTo(p0x + extX, p0y + extY);
    ctx.lineTo(p1x + extX, p1y + extY);
    ctx.lineTo(p1x - extX, p1y - extY);
    ctx.closePath();
    ctx.fill();

    // Wood grain lines — very thin, low opacity streaks along the plank
    ctx.save();
    ctx.globalAlpha = 0.06 + (p % 2) * 0.03;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.4;
    const midT = (t0 + t1) / 2;
    const gmx = s.x + perpX * (midT * 2 - 1);
    const gmy = s.y + perpY * (midT * 2 - 1);
    // Two faint grain lines per plank
    for (let g = 0; g < 2; g++) {
      const gOffset = (g - 0.5) * 0.15;
      const gx = gmx + perpX * gOffset;
      const gy = gmy + perpY * gOffset;
      ctx.beginPath();
      ctx.moveTo(gx - extX, gy - extY);
      ctx.lineTo(gx + extX, gy + extY);
      ctx.stroke();
    }
    ctx.restore();

    // Dark seam between planks
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#1a0800";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(p0x - extX, p0y - extY);
    ctx.lineTo(p0x + extX, p0y + extY);
    ctx.stroke();
    ctx.restore();
  }

  // Warm light highlight — upper-left corner catch-light
  ctx.save();
  ctx.globalAlpha = 0.07;
  const hlGrad = ctx.createRadialGradient(s.x - hw * 0.3, s.y - hh * 0.6, 0, s.x, s.y, hw * 1.2);
  hlGrad.addColorStop(0, "#ffe8c0");
  hlGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hlGrad;
  ctx.fillRect(s.x - hw - 1, s.y - hh - 1, TILE_W + 2, TILE_H + 2);
  ctx.restore();

  ctx.restore(); // end clip

  // Tile edge stroke
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x, s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.strokeStyle = `rgb(${baseR - 15},${baseG - 8},${baseB - 2})`;
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawCounterBlock(ctx: CanvasRenderingContext2D, t: number) {
  // Draw the main prize draw counter as a 3D isometric box
  // Located at iso (6,4) and (7,4) — two tiles wide
  const counterPositions = [
    { isoX: 6, isoY: 4 },
    { isoX: 7, isoY: 4 },
  ];

  for (const cp of counterPositions) {
    const s = isoToScreen(cp);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const blockH = 36;

    // Top face
    const topGrad = ctx.createLinearGradient(s.x - hw, s.y, s.x + hw, s.y + hh);
    topGrad.addColorStop(0, "#4338ca");
    topGrad.addColorStop(1, "#312e81");
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x - hw, s.y);
    ctx.closePath();
    ctx.fill();

    // Left face
    const leftGrad = ctx.createLinearGradient(s.x - hw, s.y, s.x - hw, s.y + blockH);
    leftGrad.addColorStop(0, "#1e3a8a");
    leftGrad.addColorStop(1, "#1e2060");
    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x, s.y + hh + blockH);
    ctx.lineTo(s.x - hw, s.y + blockH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Right face
    const rightGrad = ctx.createLinearGradient(s.x, s.y, s.x + hw, s.y + blockH);
    rightGrad.addColorStop(0, "#1e3270");
    rightGrad.addColorStop(1, "#141850");
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x + hw, s.y + blockH);
    ctx.lineTo(s.x, s.y + hh + blockH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Top edge
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x - hw, s.y);
    ctx.closePath();
    ctx.stroke();
  }

  // Counter label between the two tiles
  const midS = isoToScreen({ isoX: 6.5, isoY: 4 });
  const pulse = 0.85 + Math.sin(t * 2.5) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#93c5fd";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("抽獎台", midS.x, midS.y - 5);
  ctx.restore();

  // Glowing draw box on top
  ctx.save();
  ctx.shadowColor = "#6366f1";
  ctx.shadowBlur = 12 + Math.sin(t * 3) * 4;
  const boxS = isoToScreen({ isoX: 6.5, isoY: 4 });
  ctx.fillStyle = "#4338ca";
  ctx.strokeStyle = "#818cf8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxS.x - 16, boxS.y - 28, 32, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0e7ff";
  ctx.font = "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DRAW", boxS.x, boxS.y - 19);
  ctx.restore();
}

function drawEntranceMat(ctx: CanvasRenderingContext2D) {
  // Entrance at bottom of map (gap in wall at col 5-6)
  const matS1 = isoToScreen({ isoX: 5, isoY: 12.5 });
  const matS2 = isoToScreen({ isoX: 6, isoY: 12.5 });

  // Welcome mat — stretched between iso points
  const centerX = (matS1.x + matS2.x) / 2;
  const centerY = (matS1.y + matS2.y) / 2;
  const matW = 80, matH = 28;

  ctx.fillStyle = "#7c2d12";
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(centerX - matW / 2, centerY - matH / 2, matW, matH, 4);
  ctx.fill();
  ctx.stroke();

  // Mat pattern
  ctx.fillStyle = "#fca5a5";
  ctx.font = "bold 7px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WELCOME", centerX, centerY - 3);
  ctx.fillStyle = "#f87171";
  ctx.font = "6px system-ui, sans-serif";
  ctx.fillText("歡迎光臨", centerX, centerY + 7);

  // Door frame hint
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(matS1.x - TILE_W / 2, matS1.y);
  ctx.lineTo(matS1.x - TILE_W / 2, matS1.y - 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(matS2.x + TILE_W / 2, matS2.y);
  ctx.lineTo(matS2.x + TILE_W / 2, matS2.y - 50);
  ctx.stroke();
}

function drawQueueRope(ctx: CanvasRenderingContext2D) {
  // Draw a velvet rope from counter to entrance
  const counterS = isoToScreen({ isoX: 6, isoY: 5 });
  const entranceS = isoToScreen({ isoX: 5.5, isoY: 11 });

  ctx.save();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 4]);
  ctx.lineDashOffset = 0;
  ctx.shadowColor = "#d97706";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(counterS.x, counterS.y);
  // Zigzag waypoints for queue rope
  const midX = (counterS.x + entranceS.x) / 2;
  ctx.bezierCurveTo(
    counterS.x - 30, counterS.y + 30,
    entranceS.x + 30, entranceS.y - 30,
    entranceS.x, entranceS.y
  );
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Rope poles
  const poles = [counterS, { x: midX - 20, y: counterS.y + 60 }, entranceS];
  for (const pole of poles) {
    // Pole post
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pole.x - 3, pole.y - 16, 6, 16, 1);
    ctx.fill();
    ctx.stroke();
    // Pole top ball
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(pole.x, pole.y - 18, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAmbientLighting(ctx: CanvasRenderingContext2D, _t: number) {
  // Warm golden overhead ambient fill — blends ceiling light warmth across the scene
  const lightX = CANVAS_W / 2;
  const lightY = CANVAS_H * 0.25;

  const ambientGrad = ctx.createRadialGradient(lightX, lightY, 10, lightX, lightY, 280);
  ambientGrad.addColorStop(0, "rgba(255, 200, 80, 0.06)");
  ambientGrad.addColorStop(0.5, "rgba(255, 150, 40, 0.03)");
  ambientGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawAmbientParticles(ctx: CanvasRenderingContext2D, t: number) {
  // Floating dust / sparkle particles
  const particleCount = 12;
  for (let i = 0; i < particleCount; i++) {
    const phase = (t * 0.3 + i * 0.7) % 1;
    // Each particle travels from bottom to top
    const startX = 80 + (i * 47) % (CANVAS_W - 160);
    const x = startX + Math.sin(t * 0.8 + i * 1.3) * 20;
    const y = CANVAS_H - phase * CANVAS_H;
    const alpha = Math.sin(phase * Math.PI) * 0.35;
    const size = 1 + Math.sin(t * 2 + i) * 0.5;

    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = SPARKLE_COLORS[i % SPARKLE_COLORS.length] ?? "#fbbf24";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Character drawing
// ─────────────────────────────────────────────────────────────────────────────

function drawCharacter(ctx: CanvasRenderingContext2D, char: Character, t: number) {
  const s = isoToScreen(char.pos);
  const isWalking = char.state === "WALKING";
  const isCelebrating = char.state === "CELEBRATING";
  const isDrawing = char.state === "DRAWING";

  // Bob animation + idle breathing
  const bobY = isWalking ? Math.sin(t * 10 + char.bobPhase) * 2.5 : 0;
  const celebBob = isCelebrating ? Math.abs(Math.sin(t * 8 + char.bobPhase)) * 4 : 0;
  // Subtle breathing when idle: ±1px body height oscillation
  const breatheY = (!isWalking && !isCelebrating) ? Math.sin(t * 1.8 + char.bobPhase) * 1.0 : 0;
  const offsetY = -bobY - celebBob - breatheY;

  const cx = s.x;
  const cy = s.y + offsetY;

  ctx.save();

  // Drop shadow on floor
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, s.y + 4, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Player glow ring
  if (char.isPlayer) {
    ctx.save();
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, s.y + 3, 12, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Leg walk animation
  const legSwing = isWalking ? Math.sin(t * 10 + char.bobPhase) * 3 : 0;
  const legBaseY = cy + 16;
  const legW = 5;
  const legH = 10;

  // Left leg
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(cx - 6 - legSwing, legBaseY, legW, legH, 2);
  ctx.fill();

  // Right leg
  ctx.beginPath();
  ctx.roundRect(cx + 1 + legSwing, legBaseY, legW, legH, 2);
  ctx.fill();

  // Shoes
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(cx - 7 - legSwing, legBaseY + legH - 2, 7, 4, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 0 + legSwing, legBaseY + legH - 2, 7, 4, 2);
  ctx.fill();

  // Body (shirt)
  const bodyGrad = ctx.createLinearGradient(cx - 8, cy + 2, cx + 8, cy + 16);
  bodyGrad.addColorStop(0, lightenColor(char.shirtColor, 30));
  bodyGrad.addColorStop(1, char.shirtColor);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = darkenColor(char.shirtColor, 20);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - 8, cy + 2, 16, 15, 3);
  ctx.fill();
  ctx.stroke();

  // Arms — idle action influences arm positions
  const armSwing = isWalking ? Math.sin(t * 10 + char.bobPhase + Math.PI) * 4 : 0;
  const drawRaise = isDrawing ? -8 : 0;
  // Phone action: right arm raised, held near face
  const phoneRaise = char.idleAction === "phone" ? -10 : 0;
  // Stretch action: both arms raised outward
  const stretchRaise = char.idleAction === "stretch" ? -6 : 0;
  const stretchSpread = char.idleAction === "stretch" ? 3 : 0;

  // Left arm
  ctx.fillStyle = char.shirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 13 + armSwing - stretchSpread, cy + 3 + drawRaise + stretchRaise, 5, 12, 2);
  ctx.fill();
  // Right arm
  ctx.beginPath();
  ctx.roundRect(cx + 8 - armSwing + stretchSpread, cy + 3 - drawRaise + stretchRaise + phoneRaise, 5, 12, 2);
  ctx.fill();

  // Phone prop: small rectangle near face
  if (char.idleAction === "phone") {
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(cx + 9, cy - 7 + phoneRaise, 5, 8, 1);
    ctx.fill();
    ctx.stroke();
    // Phone screen glow
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(cx + 10, cy - 6 + phoneRaise, 3, 5, 0.5);
    ctx.fill();
    ctx.restore();
  }

  // Hands
  ctx.fillStyle = char.skinColor;
  ctx.beginPath();
  ctx.arc(cx - 10 + armSwing - stretchSpread, cy + 15 + drawRaise + stretchRaise, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 10 - armSwing + stretchSpread, cy + 15 - drawRaise + stretchRaise + phoneRaise, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = char.skinColor;
  ctx.beginPath();
  ctx.roundRect(cx - 3, cy - 4, 6, 6, 1);
  ctx.fill();

  // Head — head turn shifts it slightly left/right
  const hx = cx + char.headTurnOffset;
  const headGrad = ctx.createRadialGradient(hx - 2, cy - 12, 1, hx, cy - 10, 9);
  headGrad.addColorStop(0, lightenColor(char.skinColor, 20));
  headGrad.addColorStop(1, char.skinColor);
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = darkenColor(char.skinColor, 15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hx, cy - 10, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes (shifted with head turn)
  const eyeOffsetX = char.headTurnOffset * 0.5;
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(hx - 3 + eyeOffsetX, cy - 11, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + 3 + eyeOffsetX, cy - 11, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Smile (wider when celebrating)
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (isCelebrating) {
    ctx.arc(hx, cy - 9, 4, 0.2, Math.PI - 0.2);
  } else {
    ctx.arc(hx, cy - 8, 3, 0.3, Math.PI - 0.3);
  }
  ctx.stroke();

  // Hair (simple top)
  ctx.fillStyle = darkenColor(char.shirtColor, 40);
  ctx.beginPath();
  ctx.ellipse(hx, cy - 17, 7, 4, 0, Math.PI, 0);
  ctx.fill();

  // Thought bubble "..." for queuing characters
  if (char.state === "QUEUING") {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(30,30,60,0.85)";
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hx - 10, cy - 30, 20, 12, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c4b5fd";
    ctx.font = "bold 8px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("...", hx, cy - 24);
    ctx.restore();
  }

  // Player crown indicator
  if (char.isPlayer) {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("▶", cx, cy - 22);
  }

  // Drawing sparkles
  if (isDrawing) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + t * 4;
      const dist = 16 + Math.sin(t * 6 + i) * 4;
      const sx = cx - 10 + Math.cos(angle) * dist * 0.5;
      const sy = cy + 5 + Math.sin(angle) * dist * 0.5;
      ctx.save();
      ctx.fillStyle = "#fbbf24";
      ctx.globalAlpha = 0.7 + Math.sin(t * 8 + i) * 0.3;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 6;
      drawStar(ctx, sx, sy, 2.5, 5);
      ctx.restore();
    }
  }

  // Celebration sparkles
  if (isCelebrating) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 2;
      const dist = 20 + Math.sin(t * 5 + i) * 5;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy - 5 + Math.sin(angle) * dist * 0.6;
      ctx.save();
      ctx.fillStyle = SPARKLE_COLORS[i % SPARKLE_COLORS.length] ?? "#fbbf24";
      ctx.globalAlpha = 0.8 + Math.sin(t * 10 + i) * 0.2;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      drawStar(ctx, sx, sy, 2, 4);
      ctx.restore();
    }
  }

  ctx.restore();

  // Name label
  ctx.save();
  ctx.fillStyle = char.isPlayer ? "#fbbf24" : "rgba(200,200,255,0.9)";
  ctx.font = `${char.isPlayer ? "bold " : ""}9px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(char.nickname, cx, cy - 22);
  ctx.restore();

  // State dot
  const stateDotColors: Record<CharacterState, string> = {
    IDLE: "#64748b", WALKING: "#22c55e",
    QUEUING: "#f59e0b", DRAWING: "#ec4899", CELEBRATING: "#fbbf24",
  };
  ctx.fillStyle = stateDotColors[char.state];
  ctx.beginPath();
  ctx.arc(cx + 8, cy - 18, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bubble
  if (char.bubble && Date.now() < char.bubble.expiry) {
    drawBubble(ctx, char.bubble.text, char.bubble.color, cx, cy - 26, char.bubble.type);
  }

  // "!" exclamation pop indicator (reaction to draw events)
  if (char.exclamationExpiry > 0 && Date.now() < char.exclamationExpiry) {
    const exProgress = 1 - (char.exclamationExpiry - Date.now()) / 1200;
    const exY = cy - 28 - exProgress * 12;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - exProgress * 1.4);
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("!", cx, exY);
    ctx.restore();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string, color: string,
  x: number, y: number,
  type: "chat" | "prize",
) {
  const padding = 7;
  ctx.font = `bold 11px system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const bw = tw + padding * 2;
  const bh = 22;
  const bx = x - bw / 2;
  const by = y - bh;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = type === "prize" ? 14 : 6;

  // Bubble background
  const bubbleBg = type === "prize"
    ? ctx.createLinearGradient(bx, by, bx + bw, by + bh)
    : null;
  if (bubbleBg) {
    bubbleBg.addColorStop(0, "rgba(0,0,0,0.9)");
    bubbleBg.addColorStop(1, `${color}22`);
    ctx.fillStyle = bubbleBg;
  } else {
    ctx.fillStyle = "rgba(15,23,42,0.92)";
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.fillStyle = type === "prize" ? "rgba(0,0,0,0.9)" : "rgba(15,23,42,0.92)";
  ctx.beginPath();
  ctx.moveTo(x - 5, by + bh);
  ctx.lineTo(x, by + bh + 7);
  ctx.lineTo(x + 5, by + bh);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, by + bh / 2);
  ctx.restore();
}

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC management
// ─────────────────────────────────────────────────────────────────────────────

const SHIRT_COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];
const SKIN_TONES = ["#fcd9b0", "#f4c28a", "#e8a96a", "#d4895a", "#c07040", "#a05830"];

const WALKABLE_TILES: IsoPoint[] = [];
for (let row = 1; row < MAP_H - 1; row++) {
  for (let col = 1; col < MAP_W - 1; col++) {
    if (isWalkable(col, row)) WALKABLE_TILES.push({ isoX: col, isoY: row });
  }
}

function randomWalkableTile(): IsoPoint {
  // Prefer lower half of map (crowd area)
  const filtered = WALKABLE_TILES.filter((t) => t.isoY >= 6);
  const pool = filtered.length > 0 ? filtered : WALKABLE_TILES;
  return pool[Math.floor(Math.random() * pool.length)] ?? { isoX: 5, isoY: 9 };
}

function makeNpc(id: number): Character {
  return {
    id: `NPC_${String(id).padStart(2, "0")}`,
    nickname: `NPC${String(id).padStart(2, "0")}`,
    shirtColor: SHIRT_COLORS[id % SHIRT_COLORS.length] ?? "#6366f1",
    skinColor: SKIN_TONES[id % SKIN_TONES.length] ?? "#fcd9b0",
    pos: randomWalkableTile(),
    targetPos: null,
    path: [],
    state: "IDLE",
    direction: "SOUTH",
    isPlayer: false,
    bubble: null,
    bobPhase: Math.random() * Math.PI * 2,
    idleAction: "none",
    idleActionExpiry: 0,
    headTurnOffset: 0,
    nextHeadTurnAt: Date.now() + 2000 + Math.random() * 4000,
    exclamationExpiry: 0,
  };
}

const GRADES = ["A賞", "B賞", "C賞", "D賞"];
const DRAW_MESSAGES = ["好厲害！", "哇！", "羨慕！", "耶！", "好的！", "來了！", "必中！", "期待！", "恭喜！"];
const NPC_REACTIONS = ["哇！", "好厲害！", "恭喜！", "A賞！！", "羨慕！", "太強了！"];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Grade helpers
// ─────────────────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    "A賞": "#f59e0b",
    "B賞": "#3b82f6",
    "C賞": "#10b981",
    "D賞": "#a855f7",
  };
  return map[grade] ?? "#6366f1";
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable confetti data (generated once per result to avoid per-render Math.random)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfettiPiece {
  left: string;
  delay: string;
  color: string;
  rotate: string;
}

function makeConfetti(count: number): ConfettiPiece[] {
  const palette = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#a855f7", "#ec4899"];
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      left: `${(i * 3.7 + 5) % 100}%`,
      delay: `${((i * 0.073) % 1.5).toFixed(2)}s`,
      color: palette[i % palette.length] ?? "#f59e0b",
      rotate: `${(i * 37) % 360}deg`,
    });
  }
  return pieces;
}

export function IsometricRoom({
  npcCount = 4,
  onStateChange,
  onDrawResult,
  resultGrade,
  resultPrizeName,
  playerNickname = "你",
}: IsometricRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tileMapRef = useRef(buildTileMap());

  // ── Player draw flow ──
  const [phase, setPhase] = useState<RoomPhase>("EXPLORING");
  const phaseRef = useRef<RoomPhase>("EXPLORING");
  const [activeGame, setActiveGame] = useState<MiniGameKey | null>(null);
  const [lastResult, setLastResult] = useState<{ grade: string; prizeName: string } | null>(null);
  // Counter button position in canvas-local pixels (updated each frame)
  const [counterBtnPos, setCounterBtnPos] = useState<{ x: number; y: number } | null>(null);

  // ── Transition states for smooth animated phase changes ──
  // "visible" = fully shown; "entering" = animating in; "leaving" = animating out
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [gameVisible, setGameVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  // Stable confetti data for the current result (avoids per-render Math.random)
  const confettiRef = useRef<ConfettiPiece[]>(makeConfetti(30));

  // Keep phaseRef in sync so the RAF loop can read it without stale closure.
  // Also drives the CSS transition visibility flags so overlays animate in/out.
  const setPhaseSync = useCallback((p: RoomPhase) => {
    phaseRef.current = p;
    setPhase(p);
    // Selector fades in/out
    setSelectorVisible(p === "SELECTING_GAME");
    // Game modal fades in/out
    setGameVisible(p === "PLAYING");
    // Result overlay fades in/out
    setResultVisible(p === "RESULT");
  }, []);

  const playerRef = useRef<Character>({
    id: "PLAYER",
    nickname: playerNickname,
    shirtColor: "#fbbf24",
    skinColor: "#fcd9b0",
    pos: { isoX: 6, isoY: 10 },
    targetPos: null,
    path: [],
    state: "IDLE",
    direction: "SOUTH",
    isPlayer: true,
    bubble: null,
    bobPhase: 0,
    idleAction: "none",
    idleActionExpiry: 0,
    headTurnOffset: 0,
    nextHeadTurnAt: Date.now() + 3000,
    exclamationExpiry: 0,
  });

  const npcsRef = useRef<Character[]>(
    Array.from({ length: Math.min(npcCount, 7) }, (_, i) => makeNpc(i + 1))
  );

  useEffect(() => {
    npcsRef.current = Array.from({ length: Math.min(npcCount, 7) }, (_, i) => makeNpc(i + 1));
  }, [npcCount]);

  const activeDrawerRef = useRef<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const timeRef = useRef(0);
  const lastNpcMoveRef = useRef(0);
  const lastDrawRef = useRef(0);
  const sparklesRef = useRef<Sparkle[]>([]);
  const floatSymbolsRef = useRef<FloatSymbol[]>([]);
  const flashRef = useRef(0);
  const lastAmbientSparkleRef = useRef(0);

  const [chatInput, setChatInput] = useState("");
  const [statusInfo, setStatusInfo] = useState({
    yourPos: { isoX: 6, isoY: 10 } as IsoPoint,
    queue: [] as string[],
    activeDrawer: null as string | null,
  });

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const isoRaw = screenToIso({ x: sx, y: sy });
    const target = snapToGrid(isoRaw);
    if (!isWalkable(target.isoX, target.isoY)) return;
    const player = playerRef.current;
    const path = findPath(player.pos, target);
    if (path.length > 0) {
      player.path = path;
      player.targetPos = target;
      player.state = "WALKING";
    }
  }, []);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    playerRef.current.bubble = {
      text: chatInput.slice(0, 20),
      color: "#a78bfa",
      expiry: Date.now() + 3500,
      type: "chat",
    };
    setChatInput("");
  }, [chatInput]);

  const simulateDraw = useCallback(() => {
    const npc = npcsRef.current[Math.floor(Math.random() * npcsRef.current.length)];
    if (!npc) return;
    activeDrawerRef.current = npc.id;
    npc.state = "WALKING";

    // Move to counter area
    const counterPos = { isoX: 6 + (Math.random() > 0.5 ? 0 : 1), isoY: 5 };
    const path = findPath(npc.pos, counterPos);
    npc.path = path.length > 0 ? path : [];
    npc.targetPos = counterPos;

    setTimeout(() => {
      npc.state = "DRAWING";
      // After drawing pause, reveal prize
      setTimeout(() => {
        const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "D賞";
        const gradeColors: Record<string, string> = {
          "A賞": "#fbbf24", "B賞": "#38bdf8", "C賞": "#34d399", "D賞": "#a78bfa",
        };
        npc.state = "CELEBRATING";
        npc.bubble = {
          text: `✨ ${grade}！`,
          color: gradeColors[grade] ?? "#fbbf24",
          expiry: Date.now() + 5000,
          type: "prize",
        };
        activeDrawerRef.current = null;

        // Flash + sparkles for A賞
        if (grade === "A賞") {
          flashRef.current = 1;
          const counterS = isoToScreen({ isoX: 6.5, isoY: 4 });
          sparklesRef.current = [
            ...sparklesRef.current,
            ...spawnSparkles(counterS.x, counterS.y, 40),
          ];
        } else {
          const npcS = isoToScreen(npc.pos);
          sparklesRef.current = [
            ...sparklesRef.current,
            ...spawnSparkles(npcS.x, npcS.y - 10, 15),
          ];
        }

        // Floating music note from counter
        const counterNote = isoToScreen({ isoX: 6.5, isoY: 4 });
        floatSymbolsRef.current = [
          ...floatSymbolsRef.current,
          ...spawnFloatSymbols(counterNote.x, counterNote.y - 10, "♪", "#fbbf24", 3),
        ];

        // Other NPCs react
        for (const other of npcsRef.current) {
          if (other.id !== npc.id && Math.random() > 0.4) {
            setTimeout(() => {
              other.bubble = {
                text: DRAW_MESSAGES[Math.floor(Math.random() * DRAW_MESSAGES.length)] ?? "！",
                color: "#94a3b8",
                expiry: Date.now() + 2500,
                type: "chat",
              };
              other.exclamationExpiry = Date.now() + 1200;
            }, Math.random() * 1500);
          }
        }

        setTimeout(() => { npc.state = "IDLE"; }, 3500);
      }, 2500);
    }, (path.length * 500) + 500);
  }, []);

  const handleGameResult = useCallback((grade: string) => {
    const prize = resultPrizeName ?? `${grade} 獎品`;
    setLastResult({ grade, prizeName: prize });
    // Regenerate stable confetti for this result
    confettiRef.current = makeConfetti(30);
    setPhaseSync("RESULT");

    // Player state → celebrating
    const player = playerRef.current;
    player.state = "CELEBRATING";
    const gradeColor: Record<string, string> = {
      "A賞": "#fbbf24", "B賞": "#38bdf8", "C賞": "#34d399", "D賞": "#a78bfa",
    };
    const color = gradeColor[grade] ?? "#fbbf24";
    player.bubble = { text: `✨ ${grade}！`, color, expiry: Date.now() + 4000, type: "prize" };

    // A賞 special effects
    if (grade === "A賞") {
      flashRef.current = 1;
      const ps = isoToScreen(player.pos);
      sparklesRef.current = [...sparklesRef.current, ...spawnSparkles(ps.x, ps.y - 10, 60)];
      // Burst of ♪ notes
      floatSymbolsRef.current = [
        ...floatSymbolsRef.current,
        ...spawnFloatSymbols(ps.x, ps.y - 20, "♪", "#fbbf24", 5),
        ...spawnFloatSymbols(ps.x, ps.y - 20, "♪", "#f472b6", 3),
      ];
    } else {
      const ps = isoToScreen(player.pos);
      sparklesRef.current = [...sparklesRef.current, ...spawnSparkles(ps.x, ps.y - 10, 20)];
      floatSymbolsRef.current = [
        ...floatSymbolsRef.current,
        ...spawnFloatSymbols(ps.x, ps.y - 20, "♪", "#a78bfa", 2),
      ];
    }

    // NPC chat bubbles reacting
    for (const npc of npcsRef.current) {
      if (Math.random() > 0.4) {
        const delay = Math.random() * 1200;
        setTimeout(() => {
          npc.bubble = {
            text: NPC_REACTIONS[Math.floor(Math.random() * NPC_REACTIONS.length)] ?? "！",
            color: "#94a3b8",
            expiry: Date.now() + 2500,
            type: "chat",
          };
          npc.exclamationExpiry = Date.now() + 1200;
        }, delay);
      }
    }

    // Notify parent
    onDrawResult?.(grade, prize);

    // After 3s return to exploring
    setTimeout(() => {
      player.state = "IDLE";
      setLastResult(null);
      setPhaseSync("EXPLORING");
      setActiveGame(null);
    }, 3000);
  }, [resultPrizeName, onDrawResult, setPhaseSync]);

  const startGame = useCallback((key: MiniGameKey) => {
    setActiveGame(key);
    setPhaseSync("PLAYING");
    playerRef.current.state = "DRAWING";
  }, [setPhaseSync]);

  const addPrizeBubble = useCallback((grade: string) => {
    const player = playerRef.current;
    const gradeColor: Record<string, string> = {
      "A賞": "#fbbf24", "B賞": "#38bdf8", "C賞": "#34d399", "D賞": "#a78bfa",
    };
    player.state = "CELEBRATING";
    player.bubble = {
      text: `✨ ${grade}！`,
      color: gradeColor[grade] ?? "#fbbf24",
      expiry: Date.now() + 5000,
      type: "prize",
    };
    if (grade === "A賞") {
      flashRef.current = 1;
      const ps = isoToScreen(player.pos);
      sparklesRef.current = [...sparklesRef.current, ...spawnSparkles(ps.x, ps.y - 10, 50)];
    }
    setTimeout(() => { player.state = "IDLE"; }, 3500);
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = Date.now();
    timeRef.current += 0.016;
    const t = timeRef.current;

    // ── Move characters ──
    const moveCharacter = (char: Character) => {
      if (char.path.length === 0) {
        if (char.state === "WALKING") char.state = "IDLE";
        return;
      }
      const next = char.path[0];
      if (!next) return;
      const dx = next.isoX - char.pos.isoX;
      const dy = next.isoY - char.pos.isoY;
      const dist = Math.hypot(dx, dy);
      const speed = 0.07;
      if (dist < speed + 0.01) {
        char.pos = next;
        char.path.shift();
        if (char.path.length === 0 && char.state === "WALKING") {
          char.state = activeDrawerRef.current === char.id ? "DRAWING" : "IDLE";
        }
      } else {
        char.pos = {
          isoX: char.pos.isoX + (dx / dist) * speed,
          isoY: char.pos.isoY + (dy / dist) * speed,
        };
        char.direction = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? "EAST" : "WEST")
          : (dy > 0 ? "SOUTH" : "NORTH");
      }
    };

    moveCharacter(playerRef.current);
    for (const npc of npcsRef.current) moveCharacter(npc);

    // ── Counter proximity check (player draw flow) ──
    {
      const player = playerRef.current;
      const dist =
        Math.abs(player.pos.isoX - COUNTER_TILE.isoX) +
        Math.abs(player.pos.isoY - COUNTER_TILE.isoY);
      const currentPhase = phaseRef.current;
      if (dist <= 2.5 && currentPhase === "EXPLORING") {
        setPhaseSync("AT_COUNTER");
      } else if (dist > 3 && currentPhase === "AT_COUNTER") {
        setPhaseSync("EXPLORING");
      }

      // Keep counter button position updated (in canvas-local px, then scaled to %)
      const counterSc = isoToScreen(COUNTER_TILE);
      setCounterBtnPos({ x: counterSc.x, y: counterSc.y - 55 });
    }

    // NPC random wander
    if (now - lastNpcMoveRef.current > 3500 + Math.random() * 2000) {
      lastNpcMoveRef.current = now;
      for (const npc of npcsRef.current) {
        if (npc.state !== "IDLE") continue;
        if (Math.random() > 0.5) continue;
        const dest = randomWalkableTile();
        const path = findPath(npc.pos, dest);
        if (path.length > 0) {
          npc.path = path;
          npc.targetPos = dest;
          npc.state = "WALKING";
        }
      }
    }

    // NPC idle actions: breathing is handled in drawCharacter via t.
    // Here we handle head turns and random idle actions.
    const allNpcs = npcsRef.current;
    for (const npc of allNpcs) {
      if (npc.state !== "IDLE") {
        // Clear idle action when walking/drawing
        npc.idleAction = "none";
        continue;
      }

      // Head turn timer
      if (now >= npc.nextHeadTurnAt) {
        const turnDir = Math.random();
        npc.headTurnOffset = turnDir < 0.33 ? -1.5 : turnDir < 0.66 ? 1.5 : 0;
        npc.nextHeadTurnAt = now + 1500 + Math.random() * 3500;
      }

      // Idle action timer
      if (now >= npc.idleActionExpiry) {
        const roll = Math.random();
        if (roll < 0.15) {
          npc.idleAction = "phone";
          npc.idleActionExpiry = now + 2000 + Math.random() * 3000;
        } else if (roll < 0.22) {
          npc.idleAction = "stretch";
          npc.idleActionExpiry = now + 800 + Math.random() * 1200;
        } else if (roll < 0.30) {
          npc.idleAction = "look";
          npc.idleActionExpiry = now + 600 + Math.random() * 1000;
        } else {
          npc.idleAction = "none";
          npc.idleActionExpiry = now + 2000 + Math.random() * 4000;
        }
      }
    }

    // Auto draw simulation
    if (now - lastDrawRef.current > 9000 + Math.random() * 4000 && !activeDrawerRef.current) {
      lastDrawRef.current = now;
      if (Math.random() > 0.35) simulateDraw();
    }

    // Update sparkles
    sparklesRef.current = sparklesRef.current
      .filter((sp) => sp.life > 0)
      .map((sp) => ({
        ...sp,
        x: sp.x + sp.vx,
        y: sp.y + sp.vy,
        vy: sp.vy + 0.15,
        life: sp.life - 0.02,
        rotation: sp.rotation + sp.rotSpeed,
      }));

    // Update float symbols (♪ notes, etc.)
    floatSymbolsRef.current = floatSymbolsRef.current
      .filter((fs) => fs.life > 0)
      .map((fs) => ({
        ...fs,
        x: fs.x + fs.vx,
        y: fs.y + fs.vy,
        life: fs.life - 0.012,
        alpha: fs.life,
      }));

    // Ambient sparkles near prize displays (every ~3s)
    if (now - lastAmbientSparkleRef.current > 3000 + Math.random() * 2000) {
      lastAmbientSparkleRef.current = now;
      const displayData2 = [
        { iso: { isoX: 2, isoY: 1 } },
        { iso: { isoX: 6, isoY: 1 } },
        { iso: { isoX: 10, isoY: 1 } },
      ];
      const randDisp = displayData2[Math.floor(Math.random() * displayData2.length)];
      if (randDisp) {
        const wallH2 = 120;
        const sc2 = isoToScreen(randDisp.iso);
        floatSymbolsRef.current = [
          ...floatSymbolsRef.current,
          ...spawnFloatSymbols(sc2.x, sc2.y - wallH2 + 20, "✨", "#fde68a", 2),
        ];
      }
    }

    // Flash decay
    if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.02);

    // Update status
    setStatusInfo({
      yourPos: snapToGrid(playerRef.current.pos),
      queue: queueRef.current,
      activeDrawer: activeDrawerRef.current,
    });

    // ── DRAW FRAME ──
    // Background + room
    drawRoom(ctx, t);

    // Draw counter 3D blocks (before characters for depth)
    drawCounterBlock(ctx, t);

    // Queue rope
    drawQueueRope(ctx);

    // Depth-sort all characters by isoX + isoY
    const allChars: Character[] = [playerRef.current, ...npcsRef.current];
    allChars.sort((a, b) => (a.pos.isoX + a.pos.isoY) - (b.pos.isoX + b.pos.isoY));
    for (const char of allChars) drawCharacter(ctx, char, t);

    // Sparkles (on top)
    for (const sp of sparklesRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life);
      ctx.fillStyle = sp.color;
      ctx.shadowColor = sp.color;
      ctx.shadowBlur = 8;
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.rotation);
      drawStar(ctx, 0, 0, sp.size, 4);
      ctx.restore();
    }

    // Float symbols: ♪ notes, ✨ sparkle indicators
    for (const fs of floatSymbolsRef.current) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fs.alpha);
      ctx.shadowColor = fs.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = fs.color;
      ctx.font = `${fs.size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fs.symbol, fs.x, fs.y);
      ctx.restore();
    }

    // Ambient lighting & particles
    drawAmbientLighting(ctx, t);
    drawAmbientParticles(ctx, t);

    // Darken room behind mini-game modal
    if (phaseRef.current === "PLAYING" || phaseRef.current === "RESULT") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // A賞 win flash
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(251,191,36,${flashRef.current * 0.3})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── UI Overlay ──
    // Top bar
    const barGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    barGrad.addColorStop(0, "rgba(88,28,135,0.92)");
    barGrad.addColorStop(0.5, "rgba(126,34,206,0.92)");
    barGrad.addColorStop(1, "rgba(88,28,135,0.92)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, CANVAS_W, 32);

    ctx.fillStyle = "#e9d5ff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("一番賞抽獎房間  |  點擊地板移動角色", 12, 16);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      `你: (${Math.round(playerRef.current.pos.isoX)}, ${Math.round(playerRef.current.pos.isoY)})`,
      CANVAS_W - 12, 16
    );

    rafRef.current = requestAnimationFrame(loop);
  }, [simulateDraw, setPhaseSync]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  useEffect(() => {
    onStateChange?.(statusInfo);
  }, [statusInfo, onStateChange]);

  // Keep tileMap reference stable
  void tileMapRef.current;

  // Convert canvas-local px coordinates to percentage-based CSS positions
  // so they scale correctly when the canvas is shrunk via maxWidth / aspect ratio.
  const counterBtnStyle = counterBtnPos
    ? {
        left: `${(counterBtnPos.x / CANVAS_W) * 100}%`,
        top: `${(counterBtnPos.y / CANVAS_H) * 100}%`,
        transform: "translate(-50%, -100%)",
      }
    : undefined;

  // Effective result grade: prop override or mini-game callback value
  const effectiveResultGrade = resultGrade ?? "D賞";

  return (
    <>
      {/* ── Custom keyframe animations ── */}
      <style>{`
        @keyframes iso-scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes iso-slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes iso-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes iso-confettiFall {
          0%   { opacity: 1; transform: translateY(-20vh) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes iso-pulseRing {
          0%   { transform: scale(1);   opacity: 0.35; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes iso-overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes iso-overlayOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .iso-selector-enter { animation: iso-overlayIn 300ms ease-out forwards; }
        .iso-selector-leave { animation: iso-overlayOut 250ms ease-in forwards; }
        .iso-game-enter    { animation: iso-overlayIn 300ms ease-out forwards; }
        .iso-game-leave    { animation: iso-overlayOut 250ms ease-in forwards; }
        .iso-result-enter  { animation: iso-overlayIn 400ms ease-out forwards; }
        .iso-result-leave  { animation: iso-overlayOut 400ms ease-in forwards; }
        .iso-card-0 { animation: iso-slideUp 350ms ease-out 0ms   both; }
        .iso-card-1 { animation: iso-slideUp 350ms ease-out 100ms both; }
        .iso-card-2 { animation: iso-slideUp 350ms ease-out 200ms both; }
      `}</style>

      <div className="flex flex-col items-center gap-4">
        {/* Canvas container — must be relative so HTML overlays position correctly */}
        <div
          className="relative rounded-2xl"
          style={{ width: "100%", maxWidth: `${CANVAS_W}px` }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-2xl border border-purple-800/60 shadow-2xl block cursor-pointer w-full h-auto"
            style={{ background: "#0a0f1a" }}
            onClick={phase === "EXPLORING" || phase === "AT_COUNTER" ? handleCanvasClick : undefined}
          />

          {/* ── Draw button — shows when near counter, glows and pulses ── */}
          {phase === "AT_COUNTER" && counterBtnStyle && (
            <div className="absolute z-10" style={counterBtnStyle}>
              <button
                onClick={() => setPhaseSync("SELECTING_GAME")}
                className="relative px-6 py-3 rounded-2xl font-black text-lg text-white
                  bg-gradient-to-r from-amber-500 to-orange-500
                  transition-shadow duration-200
                  animate-bounce
                  whitespace-nowrap"
                style={{
                  boxShadow: "0 0 20px rgba(245,158,11,0.55), 0 4px 12px rgba(0,0,0,0.35)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 32px rgba(245,158,11,0.75), 0 4px 16px rgba(0,0,0,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 20px rgba(245,158,11,0.55), 0 4px 12px rgba(0,0,0,0.35)";
                }}
              >
                🎰 抽獎！
                {/* Pulsing ring */}
                <span
                  className="absolute inset-0 rounded-2xl border-2 border-amber-400 pointer-events-none"
                  style={{ animation: "iso-pulseRing 1.4s ease-out infinite" }}
                />
              </button>
              {/* Arrow pointing down */}
              <div className="text-amber-400 text-center mt-1 animate-bounce text-xl select-none">▼</div>
            </div>
          )}

          {/* ── Game selector overlay ── */}
          {(phase === "SELECTING_GAME" || (!selectorVisible && phase === "AT_COUNTER" && false)) && (
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl ${selectorVisible ? "iso-selector-enter" : "iso-selector-leave"}`}
              style={{ backgroundColor: "rgba(0,0,0,0.58)" }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setPhaseSync("AT_COUNTER");
              }}
            >
              <div
                className="flex flex-col items-center gap-5 mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <p
                  className="text-white font-black text-xl tracking-wide"
                  style={{ textShadow: "0 0 20px rgba(245,158,11,0.7), 0 0 40px rgba(245,158,11,0.3)" }}
                >
                  ✨ 選擇抽獎方式
                </p>

                {/* Premium card grid */}
                <div className="grid grid-cols-3 gap-4 max-w-md">
                  {(
                    [
                      { key: "slot" as MiniGameKey, icon: "🎰", name: "拉霸機", hint: "拉桿試手氣！" },
                      { key: "claw" as MiniGameKey, icon: "🪝", name: "夾娃娃", hint: "精準操控！" },
                      { key: "gacha" as MiniGameKey, icon: "🥚", name: "扭蛋機", hint: "轉出驚喜！" },
                    ] as const
                  ).map((g, idx) => (
                    <button
                      key={g.key}
                      onClick={() => startGame(g.key)}
                      className={`iso-card-${idx} group relative overflow-hidden rounded-2xl border-2 border-white/20 p-4 text-left transition-transform duration-200 hover:scale-105 active:scale-95`}
                      style={{
                        background: "linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                      }}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget;
                        btn.style.borderColor = "rgba(245,158,11,0.6)";
                        btn.style.boxShadow = "0 0 30px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget;
                        btn.style.borderColor = "rgba(255,255,255,0.2)";
                        btn.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.1)";
                      }}
                    >
                      {/* Icon */}
                      <div className="text-5xl mb-3 group-hover:animate-bounce">{g.icon}</div>
                      {/* Name */}
                      <div className="text-white font-bold text-sm leading-tight">{g.name}</div>
                      {/* Hint */}
                      <div className="text-white/50 text-xs mt-1">{g.hint}</div>
                      {/* Hover glow overlay */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                        style={{ background: "linear-gradient(to top, rgba(245,158,11,0.10), transparent)" }}
                      />
                    </button>
                  ))}
                </div>

                {/* Cancel */}
                <button
                  onClick={() => setPhaseSync("AT_COUNTER")}
                  className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors duration-150 px-4 py-1.5 rounded-full border border-white/10 hover:border-white/25"
                >
                  <span className="text-base leading-none">✕</span> 取消
                </button>
              </div>
            </div>
          )}

          {/* ── Mini-game modal ── */}
          {(phase === "PLAYING") && activeGame && (
            <div
              className={`absolute inset-0 flex items-center justify-center z-20 rounded-2xl pointer-events-auto ${gameVisible ? "iso-game-enter" : "iso-game-leave"}`}
              style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.40)" }}
            >
              {/* Back button */}
              <button
                onClick={() => setPhaseSync("SELECTING_GAME")}
                className="absolute top-3 left-3 z-30 flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-full border border-white/15 hover:border-white/35 bg-black/30 hover:bg-black/50"
              >
                ← 返回
              </button>

              <div className="w-[340px] max-h-[480px] overflow-hidden rounded-2xl shadow-2xl">
                {activeGame === "slot" && (
                  <SlotMachine
                    resultGrade={effectiveResultGrade}
                    prizeName={resultPrizeName}
                    onResult={handleGameResult}
                  />
                )}
                {activeGame === "claw" && (
                  <ClawMachine
                    resultGrade={effectiveResultGrade}
                    prizeName={resultPrizeName}
                    onResult={handleGameResult}
                  />
                )}
                {activeGame === "gacha" && (
                  <GachaMachine
                    resultGrade={effectiveResultGrade}
                    prizeName={resultPrizeName}
                    onResult={handleGameResult}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Result celebration overlay ── */}
          {phase === "RESULT" && lastResult && (
            <div
              className={`absolute inset-0 z-30 flex items-center justify-center rounded-2xl pointer-events-none ${resultVisible ? "iso-result-enter" : "iso-result-leave"}`}
            >
              {/* Radial golden burst */}
              <div
                className="absolute inset-0 animate-pulse rounded-2xl"
                style={{
                  background: lastResult.grade === "A賞"
                    ? "radial-gradient(circle, rgba(245,158,11,0.40) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 70%)",
                }}
              />

              {/* Prize card — springs in */}
              <div
                className="relative bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 text-center"
                style={{ animation: "iso-scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
              >
                <div className="text-6xl mb-4">🎊</div>
                {/* Grade badge */}
                <div
                  className="inline-block px-4 py-1.5 rounded-full text-white font-black text-xl mb-3"
                  style={{ background: gradeColor(lastResult.grade) }}
                >
                  {lastResult.grade}
                </div>
                <div className="text-gray-800 font-bold text-lg">{lastResult.prizeName}</div>
                <div className="text-gray-400 text-sm mt-2">已存入賞品庫</div>
              </div>

              {/* Confetti — only for A賞 */}
              {lastResult.grade === "A賞" && (
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  {confettiRef.current.map((piece, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-3 rounded-sm"
                      style={{
                        left: piece.left,
                        top: 0,
                        background: piece.color,
                        transform: `rotate(${piece.rotate})`,
                        animation: `iso-confettiFall 2s ease-in ${piece.delay} forwards`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full max-w-[640px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="輸入訊息..."
              maxLength={20}
              className="flex-1 bg-gray-900/80 border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim()}
              className="px-3 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold transition-all"
            >
              發送
            </button>
          </div>

          <button
            onClick={simulateDraw}
            disabled={!!activeDrawerRef.current}
            className="px-4 py-2 rounded-lg bg-pink-700 hover:bg-pink-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold transition-all"
          >
            觸發 NPC 抽獎
          </button>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <span className="text-xs text-gray-500 flex items-center">添加獎品氣泡:</span>
            {["A賞", "B賞", "C賞", "D賞"].map((g) => (
              <button
                key={g}
                onClick={() => addPrizeBubble(g)}
                className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-white text-xs font-semibold transition-all border border-gray-700"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Info panel */}
        <div className="w-full max-w-[640px] grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-900/60 border border-purple-900/40 p-2.5">
            <p className="text-xs text-gray-600 mb-0.5">你的位置</p>
            <p className="text-xs font-mono font-semibold text-gray-300">
              ({statusInfo.yourPos.isoX}, {statusInfo.yourPos.isoY})
            </p>
          </div>
          <div className="rounded-lg bg-gray-900/60 border border-purple-900/40 p-2.5">
            <p className="text-xs text-gray-600 mb-0.5">在場 NPC</p>
            <p className="text-xs font-mono font-semibold text-gray-300">
              {npcsRef.current.length} 人
            </p>
          </div>
          <div className="rounded-lg bg-gray-900/60 border border-purple-900/40 p-2.5">
            <p className="text-xs text-gray-600 mb-0.5">目前抽獎者</p>
            <p className="text-xs font-mono font-semibold text-pink-400">
              {statusInfo.activeDrawer ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
