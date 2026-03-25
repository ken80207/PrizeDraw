"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomPixelProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
  playerNickname?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution (native pixels, CSS-scaled up)
// ─────────────────────────────────────────────────────────────────────────────

const NATIVE_W = 320;
const NATIVE_H = 240;

// Tile dimensions (native pixels)
const TILE = 16;

// Map dimensions in tiles
const MAP_COLS = 20;
const MAP_ROWS = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Retro color palette
// ─────────────────────────────────────────────────────────────────────────────

const PAL = {
  // Floor tiles
  floorA:    "#c4a882",
  floorB:    "#b09068",
  // Wall tiles
  wallA:     "#4a4a5e",
  wallB:     "#3a3a4e",
  wallTop:   "#5a5a6e",
  // Wood
  woodA:     "#8b6914",
  woodB:     "#6b4e0a",
  woodLight: "#ab8934",
  // Shelf prizes
  gradeA:    "#ffd700",
  gradeB:    "#4488ff",
  gradeC:    "#44cc66",
  gradeD:    "#aa66ff",
  // Characters
  skin:      "#f5c5a0",
  hairDark:  "#3a2a1a",
  shadow:    "rgba(0,0,0,0.25)",
  // Player specific
  playerShirt: "#fbbf24",
  npcShirt1:  "#6366f1",
  npcShirt2:  "#ec4899",
  npcShirt3:  "#22c55e",
  npcShirt4:  "#f97316",
  npcShirt5:  "#14b8a6",
  npcShirt6:  "#ef4444",
  // Counter
  counterTop: "#ab8934",
  counterBody: "#8b6914",
  // Rug / waiting area
  rugA:      "#4a2060",
  rugB:      "#3a1850",
  rugBorder: "#7a40a0",
  // UI text
  white:     "#f0f0f0",
  black:     "#000000",
  dark:      "#1a1a2e",
  // Speech bubbles
  bubbleBg:  "#f0f0e8",
  bubbleBdr: "#2a2a2a",
  // Celebration
  confetti:  ["#ffd700", "#ff6644", "#44cc88", "#4488ff", "#dd44ff"],
  // Arrow indicator
  arrowColor: "#ffd700",
  // Entrance
  entranceA:  "#888866",
  entranceB:  "#666644",
};

const NPC_SHIRTS = [
  PAL.npcShirt1, PAL.npcShirt2, PAL.npcShirt3,
  PAL.npcShirt4, PAL.npcShirt5, PAL.npcShirt6,
];

// ─────────────────────────────────────────────────────────────────────────────
// Tile map legend
// 0 = floor, 1 = wall, 2 = shelf, 3 = counter, 4 = rug, 5 = entrance
// ─────────────────────────────────────────────────────────────────────────────

function buildTileMap(): number[][] {
  const R = MAP_ROWS, C = MAP_COLS;
  const map: number[][] = Array.from({ length: R }, () => new Array<number>(C).fill(0));

  // Top wall row (row 0)
  for (let c = 0; c < C; c++) map[0]![c] = 1;

  // Left/right walls
  for (let r = 0; r < R; r++) {
    map[r]![0] = 1;
    map[r]![C - 1] = 1;
  }

  // Bottom wall (except entrance columns)
  for (let c = 0; c < C; c++) {
    if (c < 7 || c > 12) map[R - 1]![c] = 1;
    else map[R - 1]![c] = 5; // entrance
  }

  // Shelves: row 1-3, columns 2-14 (with gaps for aisles)
  for (let c = 2; c <= 5; c++) map[1]![c] = 2;
  for (let c = 7; c <= 10; c++) map[1]![c] = 2;
  for (let c = 12; c <= 15; c++) map[1]![c] = 2;

  // Counter: row 5-6, columns 7-12
  for (let c = 7; c <= 12; c++) {
    map[5]![c] = 3;
    map[6]![c] = 3;
  }

  // Waiting rug area: rows 8-10, columns 6-13
  for (let r = 8; r <= 10; r++) {
    for (let c = 6; c <= 13; c++) {
      map[r]![c] = 4;
    }
  }

  return map;
}

const TILE_MAP = buildTileMap();

// ─────────────────────────────────────────────────────────────────────────────
// Pixel font (3x5 per glyph)
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_FONT: Record<string, number[][]> = {
  "A": [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "B": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  "C": [[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  "D": [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  "E": [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  "H": [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  "I": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  "N": [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  "O": [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  "P": [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  "R": [[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  "S": [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  "T": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  "W": [[1,0,1],[1,0,1],[1,1,1],[1,1,1],[0,1,0]],
  "Z": [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[1,1,1]],
  "!": [[0,1,0],[0,1,0],[0,1,0],[0,0,0],[0,1,0]],
  "賞": [[1,1,1],[1,0,1],[1,1,1],[1,0,0],[1,0,0]],
  "抽": [[1,0,1],[1,1,1],[0,1,0],[1,1,1],[1,0,1]],
  "獎": [[0,1,0],[1,1,1],[0,1,0],[1,0,1],[0,1,0]],
  " ": [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
  "♪": [[0,1,1],[0,1,1],[0,1,0],[1,1,0],[1,1,0]],
};

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  px: number,
  color: string,
) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const glyph = PIXEL_FONT[ch.toUpperCase()] ?? PIXEL_FONT[" "]!;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row]?.[col]) {
          ctx.fillRect(cx + col * px, y + row * px, px, px);
        }
      }
    }
    cx += (3 + 1) * px;
  }
}

function pixelTextWidth(text: string, px: number): number {
  return text.length * (3 + 1) * px;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character types
// ─────────────────────────────────────────────────────────────────────────────

type Direction = "down" | "up" | "left" | "right";
type CharState = "idle" | "walking" | "drawing" | "celebrating";

interface Character {
  id: string;
  tileX: number;      // current tile position (integer during snap, fractional during walk)
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  path: { x: number; y: number }[];
  direction: Direction;
  frame: number;      // 0 or 1 (walk animation frame)
  frameTimer: number;
  shirt: string;
  isPlayer: boolean;
  state: CharState;
  stateTimer: number;
  bubble: { text: string; ttl: number } | null;
  celebrationParticles: { x: number; y: number; vx: number; vy: number; color: string; life: number }[];
  gradeIcon: string | null; // "A賞" etc for prize bubble
}

// ─────────────────────────────────────────────────────────────────────────────
// Pathfinding (simple BFS on tile grid)
// ─────────────────────────────────────────────────────────────────────────────

function isWalkable(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return false;
  const t = TILE_MAP[ty]?.[tx] ?? 1;
  return t === 0 || t === 4 || t === 5; // floor, rug, entrance
}

function bfsFindPath(
  sx: number, sy: number,
  gx: number, gy: number,
): { x: number; y: number }[] {
  if (sx === gx && sy === gy) return [];
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [];
  const visited = new Set<string>();
  queue.push({ x: sx, y: sy, path: [] });
  visited.add(`${sx},${sy}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const moves = [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];
    for (const { dx, dy } of moves) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isWalkable(nx, ny)) {
        const newPath = [...cur.path, { x: nx, y: ny }];
        if (nx === gx && ny === gy) return newPath;
        visited.add(key);
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }
  }
  return []; // no path found
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  const t = TILE_MAP[ty]?.[tx] ?? 0;

  if (t === 1) {
    // Wall: dark gray blocks with highlight
    const alt = (tx + ty) % 2 === 0;
    ctx.fillStyle = alt ? PAL.wallA : PAL.wallB;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.wallTop;
    ctx.fillRect(x, y, TILE, 2);
    ctx.fillRect(x, y, 2, TILE);
    // Stone pattern dots
    ctx.fillStyle = PAL.wallB;
    ctx.fillRect(x + 4, y + 4, 2, 2);
    ctx.fillRect(x + 10, y + 10, 2, 2);
  } else if (t === 0) {
    // Floor: checkerboard brown
    const alt = (tx + ty) % 2 === 0;
    ctx.fillStyle = alt ? PAL.floorA : PAL.floorB;
    ctx.fillRect(x, y, TILE, TILE);
    // Subtle tile grout
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillRect(x, y, 1, TILE);
  } else if (t === 2) {
    // Shelf: wooden backing with colored prize box
    ctx.fillStyle = PAL.woodB;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.woodA;
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
    ctx.fillStyle = PAL.woodLight;
    ctx.fillRect(x, y + TILE - 4, TILE, 1);
    // Prize box on shelf
    const gradeColors = [PAL.gradeA, PAL.gradeB, PAL.gradeC, PAL.gradeD];
    const prizeColor = gradeColors[tx % 4]!;
    ctx.fillStyle = prizeColor;
    ctx.fillRect(x + 3, y + 2, 10, 10);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x + 4, y + 3, 3, 3);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(x + 3, y + 2, 10, 1);
    ctx.fillRect(x + 3, y + 2, 1, 10);
  } else if (t === 3) {
    // Counter: wooden counter top with text
    ctx.fillStyle = PAL.counterBody;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.counterTop;
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillStyle = PAL.woodLight;
    ctx.fillRect(x, y, TILE, 1);
    // "抽" pattern (simplified stripe)
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let i = 0; i < TILE; i += 4) {
      ctx.fillRect(x + i, y + 4, 2, TILE - 4);
    }
  } else if (t === 4) {
    // Rug: purple checkered
    const alt = (tx + ty) % 2 === 0;
    ctx.fillStyle = alt ? PAL.rugA : PAL.rugB;
    ctx.fillRect(x, y, TILE, TILE);
    // Rug border dots
    if (tx === 6 || tx === 13 || ty === 8 || ty === 10) {
      ctx.fillStyle = PAL.rugBorder;
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + TILE - 3, y + TILE - 3, 2, 2);
    }
  } else if (t === 5) {
    // Entrance: striped tile
    const alt = (tx % 2 === 0);
    ctx.fillStyle = alt ? PAL.entranceA : PAL.entranceB;
    ctx.fillRect(x, y, TILE, TILE);
    // Arrow pointing down (entrance indicator)
    ctx.fillStyle = PAL.gradeA;
    ctx.fillRect(x + 6, y + 2, 4, 8);
    ctx.fillRect(x + 4, y + 7, 8, 3);
    ctx.fillRect(x + 6, y + 10, 4, 4);
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  viewOffX: number,
  viewOffY: number,
) {
  // World pixel position (tile-based, fractional for smooth movement)
  const wx = char.tileX * TILE + viewOffX;
  const wy = char.tileY * TILE + viewOffY;

  // Shadow
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  // Simple oval shadow: draw as a series of horizontal lines
  for (let dy = -2; dy <= 2; dy++) {
    const halfW = Math.sqrt(4 - dy * dy) * 2.5;
    ctx.fillRect(Math.round(wx + TILE / 2 - halfW), Math.round(wy + TILE - 2 + dy), Math.round(halfW * 2), 1);
  }

  // Draw body (16x16 sprite)
  const bx = Math.round(wx);
  const by = Math.round(wy);
  const walkFrame = char.frame;

  // Legs (bottom): 6x4 dark
  const legColor = char.isPlayer ? "#3a2a1a" : "#2a2a3a";
  const legOffset = walkFrame === 1 ? 1 : 0; // simple leg bob
  ctx.fillStyle = legColor;
  ctx.fillRect(bx + 5, by + 11 + legOffset, 3, 4);
  ctx.fillRect(bx + 8, by + 11 - legOffset, 3, 4);

  // Body shirt: 6x8
  ctx.fillStyle = char.shirt;
  ctx.fillRect(bx + 4, by + 4, 8, 7);
  // Shirt highlight
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(bx + 5, by + 4, 3, 2);

  // Head: 8x7 skin
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(bx + 4, by, 8, 7);
  // Hair: top 2 rows
  ctx.fillStyle = PAL.hairDark;
  ctx.fillRect(bx + 4, by, 8, 2);
  ctx.fillRect(bx + 4, by + 2, 1, 1);
  ctx.fillRect(bx + 11, by + 2, 1, 1);

  // Eyes (direction-dependent)
  ctx.fillStyle = PAL.white;
  if (char.direction === "down") {
    ctx.fillRect(bx + 6, by + 3, 2, 2);
    ctx.fillRect(bx + 9, by + 3, 2, 2);
    // Pupils
    ctx.fillStyle = PAL.black;
    ctx.fillRect(bx + 7, by + 4, 1, 1);
    ctx.fillRect(bx + 10, by + 4, 1, 1);
  } else if (char.direction === "up") {
    // Back of head — no eyes visible
    ctx.fillStyle = PAL.hairDark;
    ctx.fillRect(bx + 4, by, 8, 5);
  } else {
    // Side view — one eye
    ctx.fillStyle = PAL.white;
    if (char.direction === "right") ctx.fillRect(bx + 9, by + 3, 2, 2);
    else ctx.fillRect(bx + 6, by + 3, 2, 2);
    ctx.fillStyle = PAL.black;
    if (char.direction === "right") ctx.fillRect(bx + 10, by + 4, 1, 1);
    else ctx.fillRect(bx + 6, by + 4, 1, 1);
  }

  // Arms
  ctx.fillStyle = char.shirt;
  if (char.direction !== "left") {
    ctx.fillRect(bx + 2, by + 5, 3, 5);
  }
  if (char.direction !== "right") {
    ctx.fillRect(bx + 11, by + 5, 3, 5);
  }

  // Player arrow indicator
  if (char.isPlayer) {
    ctx.fillStyle = PAL.arrowColor;
    // Down-pointing triangle above head
    ctx.fillRect(bx + 7, by - 6, 2, 1);
    ctx.fillRect(bx + 6, by - 5, 4, 1);
    ctx.fillRect(bx + 5, by - 4, 6, 1);
    ctx.fillRect(bx + 6, by - 3, 4, 1);
    ctx.fillRect(bx + 7, by - 2, 2, 1);
  }

  // Speech / prize bubble
  if (char.bubble && char.bubble.ttl > 0) {
    drawBubble(ctx, bx + TILE / 2, by - 4, char.bubble.text, char.gradeIcon);
  }

  // Celebrating: draw confetti particles
  if (char.state === "celebrating") {
    for (const p of char.celebrationParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(p.life / 20, 1);
      ctx.fillRect(Math.round(p.x + bx), Math.round(p.y + by), 2, 2);
      ctx.globalAlpha = 1;
    }
  }
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  gradeIcon: string | null,
) {
  const px = 1;
  const textW = pixelTextWidth(text, px);
  const bw = textW + 6;
  const bh = 11;
  const bx = cx - Math.floor(bw / 2);
  const by = cy - bh - 8;

  // Bubble bg
  ctx.fillStyle = PAL.bubbleBg;
  ctx.fillRect(bx, by, bw, bh);
  // Border
  ctx.fillStyle = PAL.bubbleBdr;
  ctx.fillRect(bx, by, bw, 1);
  ctx.fillRect(bx, by + bh - 1, bw, 1);
  ctx.fillRect(bx, by, 1, bh);
  ctx.fillRect(bx + bw - 1, by, 1, bh);
  // Tail
  ctx.fillStyle = PAL.bubbleBg;
  ctx.fillRect(cx - 1, by + bh, 3, 2);
  ctx.fillStyle = PAL.bubbleBdr;
  ctx.fillRect(cx - 2, by + bh, 1, 2);
  ctx.fillRect(cx + 2, by + bh, 1, 2);

  // Grade accent color
  if (gradeIcon) {
    const gradeColors: Record<string, string> = {
      "A賞": PAL.gradeA,
      "B賞": PAL.gradeB,
      "C賞": PAL.gradeC,
      "D賞": PAL.gradeD,
    };
    ctx.fillStyle = gradeColors[gradeIcon] ?? PAL.gradeA;
    ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
  }

  // Text
  drawPixelText(ctx, text, bx + 3, by + 3, px, PAL.dark);
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC wander AI
// ─────────────────────────────────────────────────────────────────────────────

const WANDER_TARGETS = [
  { x: 3, y: 5 }, { x: 3, y: 7 }, { x: 3, y: 9 },
  { x: 5, y: 3 }, { x: 5, y: 11 }, { x: 8, y: 12 },
  { x: 10, y: 12 }, { x: 12, y: 12 }, { x: 15, y: 5 },
  { x: 15, y: 8 }, { x: 17, y: 10 }, { x: 17, y: 3 },
];

function pickWanderTarget(charId: string): { x: number; y: number } {
  // Deterministic-ish random based on char id hash
  const hash = charId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return WANDER_TARGETS[(hash + Date.now()) % WANDER_TARGETS.length]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_Pixel({
  npcCount = 3,
  onDrawResult,
  resultGrade,
  playerNickname = "YOU",
}: PrizeRoomPixelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [, forceRender] = useState(0); // for React state sync

  // Characters
  const charsRef = useRef<Character[]>([]);
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null);

  // Walk speed: tiles per second
  const WALK_SPEED = 4; // tiles/sec

  // ── Initialize characters ─────────────────────────────────────────────────
  useEffect(() => {
    const chars: Character[] = [];

    // Player starts near bottom center
    chars.push({
      id: "player",
      tileX: 10,
      tileY: 12,
      targetTileX: 10,
      targetTileY: 12,
      path: [],
      direction: "up",
      frame: 0,
      frameTimer: 0,
      shirt: PAL.playerShirt,
      isPlayer: true,
      state: "idle",
      stateTimer: 0,
      bubble: null,
      celebrationParticles: [],
      gradeIcon: null,
    });

    // NPCs
    for (let i = 0; i < Math.min(npcCount, 6); i++) {
      const startPositions = [
        { x: 3, y: 7 }, { x: 15, y: 7 }, { x: 8, y: 11 },
        { x: 12, y: 11 }, { x: 5, y: 5 }, { x: 17, y: 9 },
      ];
      const pos = startPositions[i] ?? { x: 5 + i * 2, y: 9 };
      chars.push({
        id: `npc${i}`,
        tileX: pos.x,
        tileY: pos.y,
        targetTileX: pos.x,
        targetTileY: pos.y,
        path: [],
        direction: "down",
        frame: 0,
        frameTimer: 0,
        shirt: NPC_SHIRTS[i % NPC_SHIRTS.length]!,
        isPlayer: false,
        state: "idle",
        stateTimer: 2000 + i * 800, // staggered initial wander
        bubble: null,
        celebrationParticles: [],
        gradeIcon: null,
      });
    }

    charsRef.current = chars;
    forceRender(n => n + 1);
  }, [npcCount]);

  // ── Show result prize bubble on player ────────────────────────────────────
  useEffect(() => {
    if (!resultGrade) return;
    const player = charsRef.current.find((c) => c.isPlayer);
    if (!player) return;
    player.bubble = { text: resultGrade, ttl: 180 };
    player.gradeIcon = resultGrade;
    player.state = "celebrating";
    player.stateTimer = 0;
    // Spawn confetti
    player.celebrationParticles = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const speed = 0.5 + Math.random();
      return {
        x: TILE / 2, y: TILE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        color: (PAL.confetti as string[])[i % PAL.confetti.length]!,
        life: 30 + Math.random() * 20,
      };
    });
  }, [resultGrade]);

  // ── Main animation loop ───────────────────────────────────────────────────
  const animate = useCallback((timestamp: number) => {
    const dt = Math.min(timestamp - lastTime.current, 100);
    lastTime.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) {
      animRef.current = requestAnimationFrame(animate);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animRef.current = requestAnimationFrame(animate);
      return;
    }
    ctx.imageSmoothingEnabled = false;

    // Update characters
    updateCharacters(dt);

    // Draw
    drawScene(ctx);

    animRef.current = requestAnimationFrame(animate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCharacters(dt: number) {
    const chars = charsRef.current;
    const speed = (WALK_SPEED * TILE * dt) / 1000; // pixels per frame

    for (const char of chars) {
      // Walk animation frame (toggle every 200ms)
      char.frameTimer += dt;
      if (char.frameTimer > 200 && char.path.length > 0) {
        char.frameTimer = 0;
        char.frame = char.frame === 0 ? 1 : 0;
      }

      // Bubble TTL
      if (char.bubble) {
        char.bubble.ttl -= dt / 16;
        if (char.bubble.ttl <= 0) {
          char.bubble = null;
          char.gradeIcon = null;
        }
      }

      // Update celebration particles
      if (char.state === "celebrating") {
        for (const p of char.celebrationParticles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05; // gravity
          p.life -= 1;
        }
        char.celebrationParticles = char.celebrationParticles.filter((p) => p.life > 0);
        if (char.celebrationParticles.length === 0 && !char.bubble) {
          char.state = "idle";
        }
      }

      // Movement along path
      if (char.path.length > 0) {
        const next = char.path[0]!;
        const dx = next.x - char.tileX;
        const dy = next.y - char.tileY;

        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
          char.direction = dx > 0 ? "right" : "left";
        } else {
          char.direction = dy > 0 ? "down" : "up";
        }

        const dist = Math.sqrt(dx * dx + dy * dy);
        const moveDist = speed / TILE; // in tile units

        if (moveDist >= dist) {
          // Snap to target tile
          char.tileX = next.x;
          char.tileY = next.y;
          char.path.shift();
          if (char.path.length === 0) {
            char.state = char.state === "drawing" ? "drawing" : "idle";
            char.frame = 0;
          }
        } else {
          // Move toward next tile (fractional tiles for smooth movement)
          char.tileX += (dx / dist) * moveDist;
          char.tileY += (dy / dist) * moveDist;
          char.state = "walking";
        }
      }

      // NPC wander AI
      if (!char.isPlayer && char.path.length === 0 && char.state !== "drawing" && char.state !== "celebrating") {
        char.stateTimer -= dt;
        if (char.stateTimer <= 0) {
          // Pick new wander target
          const target = pickWanderTarget(char.id);
          char.path = bfsFindPath(Math.round(char.tileX), Math.round(char.tileY), target.x, target.y);
          char.stateTimer = 2000 + Math.random() * 3000;

          // Occasionally show a bubble
          if (Math.random() < 0.3) {
            const messages = ["★★★", "A賞!", "B賞?", "WOW!", "NICE", "SPIN", "WIN!"];
            char.bubble = {
              text: messages[Math.floor(Math.random() * messages.length)]!,
              ttl: 80,
            };
          }
        }
      }

      // Player: follow click target
      if (char.isPlayer && clickTargetRef.current && char.path.length === 0) {
        const target = clickTargetRef.current;
        char.path = bfsFindPath(Math.round(char.tileX), Math.round(char.tileY), target.x, target.y);
        clickTargetRef.current = null;
      }
    }
  }

  function drawScene(ctx: CanvasRenderingContext2D) {
    // Clear
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

    // Draw all tiles (MAP_ROWS x MAP_COLS)
    for (let ty = 0; ty < MAP_ROWS; ty++) {
      for (let tx = 0; tx < MAP_COLS; tx++) {
        if (tx * TILE < NATIVE_W && ty * TILE < NATIVE_H) {
          drawTile(ctx, tx, ty);
        }
      }
    }

    // Shelf labels above shelves
    const shelfGroups = [
      { tx: 3, grade: "A賞" },
      { tx: 8, grade: "B賞" },
      { tx: 13, grade: "C賞" },
    ];
    for (const { tx, grade } of shelfGroups) {
      const label = `[${grade[0]}]`;
      drawPixelText(ctx, label, tx * TILE + 2, TILE + 2, 1, PAL.gradeA);
    }

    // Counter label
    ctx.fillStyle = PAL.counterTop;
    drawPixelText(ctx, "抽獎", 9 * TILE, 5 * TILE + 3, 1, PAL.white);

    // "PRIZE SHOP" sign on wall
    ctx.fillStyle = "#2a2a3e";
    ctx.fillRect(60, 1, 100, 12);
    ctx.fillStyle = PAL.gradeA;
    ctx.fillRect(60, 1, 100, 1);
    ctx.fillRect(60, 12, 100, 1);
    drawPixelText(ctx, "PRIZE SHOP", 64, 4, 1, PAL.white);

    // Draw characters, sorted by tileY (painter's algorithm)
    const sorted = [...charsRef.current].sort((a, b) => a.tileY - b.tileY);
    for (const char of sorted) {
      drawCharacter(ctx, char, 0, 0);
    }

    // Player name tag
    const player = charsRef.current.find((c) => c.isPlayer);
    if (player) {
      const px = Math.round(player.tileX * TILE);
      const py = Math.round(player.tileY * TILE);
      const nameW = pixelTextWidth(playerNickname, 1);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(px + TILE / 2 - nameW / 2 - 1, py - 14, nameW + 2, 7);
      drawPixelText(ctx, playerNickname, px + TILE / 2 - nameW / 2, py - 13, 1, PAL.arrowColor);
    }

    // ♪ floating music notes (ambient decoration)
    const t = Date.now() / 1000;
    for (let i = 0; i < 3; i++) {
      const noteX = 180 + i * 30;
      const noteY = Math.round(20 + Math.sin(t * 1.5 + i * 2) * 5);
      const noteAlpha = (Math.sin(t + i) + 1) / 2;
      ctx.globalAlpha = noteAlpha * 0.6;
      drawPixelText(ctx, "♪", noteX, noteY, 1, PAL.gradeA);
      ctx.globalAlpha = 1;
    }
  }

  useEffect(() => {
    lastTime.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  // ── Canvas click → player movement ───────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_W / rect.width;
    const scaleY = NATIVE_H / rect.height;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;
    const tx = Math.floor(nx / TILE);
    const ty = Math.floor(ny / TILE);

    if (isWalkable(tx, ty)) {
      clickTargetRef.current = { x: tx, y: ty };
    }
  }, []);

  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ background: PAL.dark, padding: 4 }}
    >
      <canvas
        ref={canvasRef}
        width={NATIVE_W}
        height={NATIVE_H}
        onClick={handleCanvasClick}
        style={{
          imageRendering: "pixelated",
          width: "100%",
          maxWidth: NATIVE_W * 2,
          cursor: "crosshair",
          display: "block",
        }}
      />
    </div>
  );
}
