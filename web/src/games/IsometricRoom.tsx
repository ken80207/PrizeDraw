"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  color: string;
  pos: IsoPoint;
  targetPos: IsoPoint | null;
  path: IsoPoint[];
  state: CharacterState;
  direction: Direction;
  isPlayer: boolean;
  bubble: { text: string; color: string; expiry: number; type: "chat" | "prize" } | null;
}

type TileType = "FLOOR" | "WALL" | "SHELF" | "COUNTER" | "CARPET" | "EMPTY";

interface Tile { type: TileType }

export interface IsometricRoomProps {
  npcCount?: number;
  onStateChange?: (info: { yourPos: IsoPoint; queue: string[]; activeDrawer: string | null }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 600;
const CANVAS_H = 400;

const MAP_W = 12;
const MAP_H = 12;
const TILE_W = 52;
const TILE_H = 28;

// Screen origin — where iso (0,0) maps to screen
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = 60;

// Character display constants
const CHAR_R = 12;

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

// 0=floor, 1=wall, 2=shelf, 3=counter, 4=carpet, 5=empty
const MAP_DATA: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 4, 4, 4, 4, 4, 0, 0, 0, 1],
  [1, 0, 0, 4, 4, 4, 4, 4, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const TILE_TYPES: Record<number, TileType> = {
  0: "FLOOR", 1: "WALL", 2: "SHELF", 3: "COUNTER", 4: "CARPET", 5: "EMPTY",
};

function buildTileMap(): Tile[][] {
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
      while (node) {
        path.unshift(node.pos);
        node = node.parent;
      }
      return path.slice(1); // skip start position
    }

    if (closed.has(ck)) continue;
    closed.add(ck);

    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    for (const d of dirs) {
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
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

const TILE_COLORS: Record<TileType, { top: string; left: string; right: string; stroke: string }> = {
  FLOOR:   { top: "#1e2d3d", left: "#162233", right: "#14202e", stroke: "#263548" },
  WALL:    { top: "#374151", left: "#1f2937", right: "#111827", stroke: "#4b5563" },
  SHELF:   { top: "#78350f", left: "#451a03", right: "#3a1502", stroke: "#92400e" },
  COUNTER: { top: "#1e40af", left: "#1e3a8a", right: "#1e3270", stroke: "#3b82f6" },
  CARPET:  { top: "#4c1d95", left: "#2e1065", right: "#27005a", stroke: "#6d28d9" },
  EMPTY:   { top: "transparent", left: "transparent", right: "transparent", stroke: "transparent" },
};

const TILE_LABELS: Partial<Record<TileType, string>> = {
  SHELF: "展架", COUNTER: "櫃台",
};

function drawTile(ctx: CanvasRenderingContext2D, isoX: number, isoY: number, type: TileType) {
  if (type === "EMPTY") return;
  const s = isoToScreen({ isoX, isoY });
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const col = TILE_COLORS[type];
  const wallH = type === "WALL" ? 24 : type === "SHELF" || type === "COUNTER" ? 18 : 0;

  // Top face (diamond)
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x, s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.fillStyle = col.top;
  ctx.fill();
  ctx.strokeStyle = col.stroke;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (wallH > 0) {
    // Left face
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y);
    ctx.lineTo(s.x, s.y + hh);
    ctx.lineTo(s.x, s.y + hh + wallH);
    ctx.lineTo(s.x - hw, s.y + wallH);
    ctx.closePath();
    ctx.fillStyle = col.left;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + hh);
    ctx.lineTo(s.x + hw, s.y);
    ctx.lineTo(s.x + hw, s.y + wallH);
    ctx.lineTo(s.x, s.y + hh + wallH);
    ctx.closePath();
    ctx.fillStyle = col.right;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Label on shelf/counter
    const label = TILE_LABELS[type];
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, s.x, s.y);
    }
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  t: number,
) {
  const s = isoToScreen(char.pos);
  const bobY = char.state === "WALKING" ? Math.sin(t * 10) * 2 : 0;
  const cy = s.y - bobY;

  ctx.save();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 2, CHAR_R * 0.9, CHAR_R * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body circle
  const grd = ctx.createRadialGradient(s.x - 3, cy - 3, 1, s.x, cy, CHAR_R);
  grd.addColorStop(0, lightenColor(char.color, 40));
  grd.addColorStop(1, char.color);
  ctx.fillStyle = grd;
  ctx.strokeStyle = char.isPlayer ? "#fbbf24" : "rgba(255,255,255,0.3)";
  ctx.lineWidth = char.isPlayer ? 2.5 : 1.5;
  ctx.shadowColor = char.isPlayer ? "#fbbf24" : char.color;
  ctx.shadowBlur = char.isPlayer ? 8 : 4;
  ctx.beginPath();
  ctx.arc(s.x, cy, CHAR_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Celebration sparkles
  if (char.state === "CELEBRATING") {
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + t * 3;
      const dist = CHAR_R + 8 + Math.sin(t * 5 + i) * 3;
      const sx = s.x + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      ctx.fillStyle = "#fbbf24";
      ctx.globalAlpha = 0.8 + Math.sin(t * 8 + i) * 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Nickname label
  ctx.fillStyle = char.isPlayer ? "#fbbf24" : "rgba(255,255,255,0.85)";
  ctx.font = `${char.isPlayer ? "bold " : ""}10px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(char.nickname, s.x, cy - CHAR_R - 2);

  // State indicator dot
  const stateColors: Record<CharacterState, string> = {
    IDLE: "#94a3b8", WALKING: "#22c55e",
    QUEUING: "#f59e0b", DRAWING: "#ec4899",
    CELEBRATING: "#fbbf24",
  };
  ctx.fillStyle = stateColors[char.state];
  ctx.beginPath();
  ctx.arc(s.x + CHAR_R - 3, cy - CHAR_R + 3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Bubble
  if (char.bubble && Date.now() < char.bubble.expiry) {
    drawBubble(ctx, char.bubble.text, char.bubble.color, s.x, cy - CHAR_R - 14, char.bubble.type);
  }
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  x: number,
  y: number,
  type: "chat" | "prize",
) {
  const padding = 6;
  ctx.font = `bold 11px system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const bw = tw + padding * 2;
  const bh = 20;
  const bx = x - bw / 2;
  const by = y - bh;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = type === "prize" ? 12 : 6;

  // Bubble background
  ctx.fillStyle = type === "prize" ? "rgba(0,0,0,0.85)" : "rgba(15,23,42,0.9)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 5);
  ctx.fill();
  ctx.stroke();

  // Pointer
  ctx.beginPath();
  ctx.moveTo(x - 5, by + bh);
  ctx.lineTo(x, by + bh + 6);
  ctx.lineTo(x + 5, by + bh);
  ctx.closePath();
  ctx.fillStyle = type === "prize" ? "rgba(0,0,0,0.85)" : "rgba(15,23,42,0.9)";
  ctx.fill();

  ctx.shadowBlur = 0;

  // Text
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

// ─────────────────────────────────────────────────────────────────────────────
// NPC management
// ─────────────────────────────────────────────────────────────────────────────

const NPC_COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];
const WALKABLE_TILES: IsoPoint[] = [];
for (let row = 0; row < MAP_H; row++) {
  for (let col = 0; col < MAP_W; col++) {
    const code = MAP_DATA[row]?.[col] ?? 1;
    if (code === 0 || code === 4) {
      WALKABLE_TILES.push({ isoX: col, isoY: row });
    }
  }
}

function randomWalkableTile(): IsoPoint {
  const idx = Math.floor(Math.random() * WALKABLE_TILES.length);
  return WALKABLE_TILES[idx] ?? { isoX: 5, isoY: 8 };
}

function makeNpc(id: number): Character {
  return {
    id: `NPC_${String(id).padStart(2, "0")}`,
    nickname: `NPC_${String(id).padStart(2, "0")}`,
    color: NPC_COLORS[id % NPC_COLORS.length] ?? "#6366f1",
    pos: randomWalkableTile(),
    targetPos: null,
    path: [],
    state: "IDLE",
    direction: "SOUTH",
    isPlayer: false,
    bubble: null,
  };
}

const GRADES = ["A賞", "B賞", "C賞", "D賞"];
const DRAW_MESSAGES = [
  "好厲害！", "哇！", "感謝！", "耶！✨", "好的！", "來了！",
  "必中！", "加油！", "期待！",
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function IsometricRoom({ npcCount = 3, onStateChange }: IsometricRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tileMapRef = useRef<Tile[][]>(buildTileMap());

  // Characters
  const playerRef = useRef<Character>({
    id: "PLAYER",
    nickname: "你",
    color: "#fbbf24",
    pos: { isoX: 5, isoY: 9 },
    targetPos: null,
    path: [],
    state: "IDLE",
    direction: "SOUTH",
    isPlayer: true,
    bubble: null,
  });

  const npcsRef = useRef<Character[]>(
    Array.from({ length: Math.min(npcCount, 6) }, (_, i) => makeNpc(i + 1)),
  );

  // Rebuild NPCs when count changes
  useEffect(() => {
    npcsRef.current = Array.from({ length: Math.min(npcCount, 6) }, (_, i) => makeNpc(i + 1));
  }, [npcCount]);

  const activeDrawerRef = useRef<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const timeRef = useRef(0);
  const lastNpcMoveRef = useRef(0);
  const lastDrawRef = useRef(0);

  const [chatInput, setChatInput] = useState("");
  const [statusInfo, setStatusInfo] = useState({ yourPos: { isoX: 5, isoY: 9 }, queue: [] as string[], activeDrawer: null as string | null });

  // Move player on canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    },
    [],
  );

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const player = playerRef.current;
    player.bubble = {
      text: chatInput.slice(0, 20),
      color: "#a78bfa",
      expiry: Date.now() + 3500,
      type: "chat",
    };
    setChatInput("");
  }, [chatInput]);

  const simulateDraw = useCallback(() => {
    // Pick a random NPC to draw
    const npc = npcsRef.current[Math.floor(Math.random() * npcsRef.current.length)];
    if (!npc) return;
    activeDrawerRef.current = npc.id;
    npc.state = "DRAWING";

    // Move to counter
    const counterPos = { isoX: 5, isoY: 6 };
    const path = findPath(npc.pos, counterPos);
    npc.path = path.length > 0 ? path : [];
    npc.targetPos = counterPos;
    if (path.length > 0) npc.state = "WALKING";

    // After a delay, reveal prize
    setTimeout(() => {
      const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "D賞";
      npc.state = "CELEBRATING";
      npc.bubble = {
        text: `✨ ${grade}！`,
        color: grade === "A賞" ? "#fbbf24" : grade === "B賞" ? "#38bdf8" : grade === "C賞" ? "#34d399" : "#a78bfa",
        expiry: Date.now() + 5000,
        type: "prize",
      };
      activeDrawerRef.current = null;

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
          }, Math.random() * 1500);
        }
      }

      setTimeout(() => {
        npc.state = "IDLE";
      }, 3000);
    }, 3500);
  }, []);

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
    setTimeout(() => { player.state = "IDLE"; }, 3000);
  }, []);

  // RAF loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = Date.now();
    timeRef.current += 0.016;
    const t = timeRef.current;

    // ── Move characters along paths ────────────────────────────────────────
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
      const speed = 0.06;

      if (dist < speed + 0.01) {
        char.pos = next;
        char.path.shift();
        if (char.path.length === 0) {
          char.state = activeDrawerRef.current === char.id ? "DRAWING" : "IDLE";
        }
      } else {
        char.pos = { isoX: char.pos.isoX + (dx / dist) * speed, isoY: char.pos.isoY + (dy / dist) * speed };
        // Direction
        if (Math.abs(dx) > Math.abs(dy)) {
          char.direction = dx > 0 ? "EAST" : "WEST";
        } else {
          char.direction = dy > 0 ? "SOUTH" : "NORTH";
        }
      }
    };

    moveCharacter(playerRef.current);
    for (const npc of npcsRef.current) moveCharacter(npc);

    // NPC random movement
    if (now - lastNpcMoveRef.current > 3000 + Math.random() * 2000) {
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

    // Auto-simulate a draw occasionally
    if (now - lastDrawRef.current > 8000 + Math.random() * 4000 && !activeDrawerRef.current) {
      lastDrawRef.current = now;
      if (Math.random() > 0.4) simulateDraw();
    }

    // Update status info
    setStatusInfo({
      yourPos: snapToGrid(playerRef.current.pos),
      queue: queueRef.current,
      activeDrawer: activeDrawerRef.current,
    });

    // ── Draw ──────────────────────────────────────────────────────────────
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw tiles in isometric order (back to front)
    const tileMap = tileMapRef.current;
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const tile = tileMap[row]?.[col];
        if (tile) drawTile(ctx, col, row, tile.type);
      }
    }

    // Collect all characters and sort by isoX + isoY for proper depth
    const allChars: Character[] = [playerRef.current, ...npcsRef.current];
    allChars.sort((a, b) => (a.pos.isoX + a.pos.isoY) - (b.pos.isoX + b.pos.isoY));

    // Draw characters
    for (const char of allChars) {
      drawCharacter(ctx, char, t);
    }

    // UI overlay: top bar
    ctx.fillStyle = "rgba(10,15,26,0.8)";
    ctx.fillRect(0, 0, CANVAS_W, 36);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("2.5D 一番賞虛擬商店  |  點擊地板移動角色", 12, 18);

    // Player indicator in corner
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`你的位置 (${Math.round(playerRef.current.pos.isoX)}, ${Math.round(playerRef.current.pos.isoY)})`, CANVAS_W - 12, 18);

    rafRef.current = requestAnimationFrame(loop);
  }, [simulateDraw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  useEffect(() => {
    onStateChange?.(statusInfo);
  }, [statusInfo, onStateChange]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-2xl border border-gray-700 shadow-2xl block cursor-pointer"
        style={{ background: "#0a0f1a" }}
        onClick={handleCanvasClick}
      />

      {/* Controls */}
      <div className="w-full max-w-[600px] grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Chat */}
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="輸入訊息..."
            maxLength={20}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-all"
          >
            發送
          </button>
        </div>

        {/* Simulate draw */}
        <button
          onClick={simulateDraw}
          disabled={!!activeDrawerRef.current}
          className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-all"
        >
          觸發 NPC 抽獎
        </button>

        {/* Prize bubble buttons */}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <span className="text-xs text-gray-500 flex items-center">添加獎品氣泡:</span>
          {["A賞", "B賞", "C賞", "D賞"].map((g) => (
            <button
              key={g}
              onClick={() => addPrizeBubble(g)}
              className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-xs font-semibold transition-all"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Info panel */}
      <div className="w-full max-w-[600px] grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-800/60 border border-gray-800 p-2.5">
          <p className="text-xs text-gray-600 mb-0.5">你的位置</p>
          <p className="text-xs font-mono font-semibold text-gray-200">
            ({statusInfo.yourPos.isoX}, {statusInfo.yourPos.isoY})
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/60 border border-gray-800 p-2.5">
          <p className="text-xs text-gray-600 mb-0.5">在場 NPC</p>
          <p className="text-xs font-mono font-semibold text-gray-200">
            {npcsRef.current.length} 人
          </p>
        </div>
        <div className="rounded-lg bg-gray-800/60 border border-gray-800 p-2.5">
          <p className="text-xs text-gray-600 mb-0.5">目前抽獎者</p>
          <p className="text-xs font-mono font-semibold text-pink-400">
            {statusInfo.activeDrawer ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
