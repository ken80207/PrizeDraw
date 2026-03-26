"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeRoomROProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  resultGrade?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas resolution — slightly wider than Anime for the isometric feel
// ─────────────────────────────────────────────────────────────────────────────

const W = 520;
const H = 400;

// ─────────────────────────────────────────────────────────────────────────────
// RO colour palette
// ─────────────────────────────────────────────────────────────────────────────

const RO = {
  // Interior background
  bgWall:       "#e8d5b8",   // warm parchment wall
  bgWallTop:    "#c8b090",   // darker top wall
  bgWallLine:   "#b89870",   // wall mortar lines
  // Wooden beams
  beamFill:     "#7a5030",
  beamDark:     "#5a3820",
  beamLight:    "#a07850",
  // Window
  windowFrame:  "#6a4828",
  windowGlass:  "rgba(200,230,255,0.5)",
  windowLight:  "rgba(255,240,200,0.35)",
  // Torch / lantern
  torchOrange:  "#ff8820",
  torchYellow:  "#ffdd44",
  torchGlow:    "rgba(255,150,50,0.35)",
  // Floor — stone tile
  floorA:       "#b8a898",
  floorB:       "#a89880",
  floorLine:    "#887060",
  floorShadow:  "rgba(0,0,0,0.15)",
  // Display stands
  standFill:    "#d4b888",
  standDark:    "#a07848",
  standTop:     "#c8a870",
  // Counter / desk
  counterFill:  "#c8a870",
  counterTop:   "#e8c898",
  counterFront: "#a07848",
  // Grades
  gradeA:       "#f5c518",
  gradeB:       "#5599ee",
  gradeC:       "#44aa55",
  gradeD:       "#ff88aa",
  // Grade glow
  glowA:        "rgba(245,197,24,0.65)",
  glowB:        "rgba(85,153,238,0.55)",
  glowC:        "rgba(68,170,85,0.50)",
  glowD:        "rgba(255,255,255,0.40)",
  // Pillar of light
  pillarA:      "rgba(255,220,80,0.75)",
  pillarB:      "rgba(100,180,255,0.65)",
  pillarC:      "rgba(80,220,100,0.55)",
  pillarD:      "rgba(255,255,255,0.40)",
  // Characters
  skin:         "#ffddbb",
  skinDark:     "#ddaa88",
  hairColors:   ["#2a1800", "#883300", "#224488", "#662288", "#227744", "#aa3300", "#666666"],
  // Outline
  ink:          "#1a0d00",
  // Text
  sysText:      "#ffee44",
  dialogBg:     "#0a1a2a",
  dialogBorder: "#3a5a7a",
  dialogText:   "#ddeeff",
  dialogTitle:  "#ffdd88",
  // Emote bubble
  emoteBg:      "#ffffff",
  emoteBorder:  "#888888",
  // Shadow blob
  shadowBlob:   "rgba(0,0,0,0.22)",
  // Sparkle
  sparkle:      "#ffe066",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grade data
// ─────────────────────────────────────────────────────────────────────────────

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;
type Grade = (typeof GRADES)[number];

const PRIZE_NAMES: Record<Grade, string> = {
  "A賞": "限定公仔",
  "B賞": "周邊商品",
  "C賞": "貼紙組",
  "D賞": "明信片",
};

const GRADE_GLOW: Record<Grade, string> = {
  "A賞": RO.glowA,
  "B賞": RO.glowB,
  "C賞": RO.glowC,
  "D賞": RO.glowD,
};

const GRADE_PILLAR: Record<Grade, string> = {
  "A賞": RO.pillarA,
  "B賞": RO.pillarB,
  "C賞": RO.pillarC,
  "D賞": RO.pillarD,
};

const GRADE_DMG: Record<Grade, string> = {
  "A賞": "9999999!",
  "B賞": "Hit! 5000",
  "C賞": "Hit! 1000",
  "D賞": "Miss...",
};

const GRADE_DMG_COLOR: Record<Grade, string> = {
  "A賞": "#ffd700",
  "B賞": "#88bbff",
  "C賞": "#88ee99",
  "D賞": "#aaaaaa",
};

// ─────────────────────────────────────────────────────────────────────────────
// Emotes
// ─────────────────────────────────────────────────────────────────────────────

const EMOTES = ["!", "?", "...", "♥", "★", "!", "?"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// RO job classes
// ─────────────────────────────────────────────────────────────────────────────

type JobClass = "novice" | "knight" | "wizard" | "archer" | "priest" | "merchant";

const JOB_COLORS: Record<JobClass, { body: string; trim: string; hair: string }> = {
  novice:   { body: "#eeddbb", trim: "#aa8855",  hair: "#4a2800" },
  knight:   { body: "#7788aa", trim: "#ddcc88",  hair: "#443322" },
  wizard:   { body: "#441166", trim: "#8844cc",  hair: "#2244aa" },
  archer:   { body: "#446633", trim: "#88aa44",  hair: "#883300" },
  priest:   { body: "#eeeeff", trim: "#aaaaff",  hair: "#888888" },
  merchant: { body: "#cc9944", trim: "#886622",  hair: "#2a1800" },
};

// ─────────────────────────────────────────────────────────────────────────────
// NPC / character type
// ─────────────────────────────────────────────────────────────────────────────

type Emote = typeof EMOTES[number] | null;

interface Character {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  job: JobClass;
  hairColor: string;
  speed: number;
  bobPhase: number;
  emote: Emote;
  emoteTimer: number;
  isPlayer: boolean;
  isDrawing: boolean;
  drawTimer: number;
  gradeResult: Grade | null;
  facing: "left" | "right";
}

// ─────────────────────────────────────────────────────────────────────────────
// Room layout
// ─────────────────────────────────────────────────────────────────────────────

const WALL_H = 170;          // wall band height (including beams)
const FLOOR_Y = WALL_H;      // where floor starts
const COUNTER_X = W / 2 - 70;
const COUNTER_Y = FLOOR_Y + 20;
const COUNTER_W = 140;
const COUNTER_H = 40;
// Draw zone: in front of counter
const DRAW_ZONE_X = W / 2;
const DRAW_ZONE_Y = COUNTER_Y + COUNTER_H + 36;

// Display stands along back wall
const STANDS = [
  { x: 60,  y: FLOOR_Y - 2, grade: "A賞" as Grade },
  { x: 170, y: FLOOR_Y - 2, grade: "B賞" as Grade },
  { x: 280, y: FLOOR_Y - 2, grade: "C賞" as Grade },
  { x: 390, y: FLOOR_Y - 2, grade: "D賞" as Grade },
];

// Torches on walls
const TORCHES = [
  { x: 30,  y: 90 },
  { x: W - 30, y: 90 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Drop light / damage types
// ─────────────────────────────────────────────────────────────────────────────

interface LightPillar {
  x: number;
  grade: Grade;
  life: number;
  maxLife: number;
}

interface DamageNum {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  isCrit: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — character sprite drawing (RO isometric-ish 2D sprite style)
// ─────────────────────────────────────────────────────────────────────────────

function drawShadowBlob(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = RO.shadowBlob;
  ctx.fill();
  ctx.restore();
}

function drawROCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  job: JobClass,
  bobOffset: number,
  facing: "left" | "right" = "right",
  scale = 1.0,
): void {
  ctx.save();
  ctx.translate(x, y + bobOffset);
  if (facing === "left") ctx.scale(-1, 1);
  ctx.scale(scale, scale);

  const colors = JOB_COLORS[job];

  // Legs
  const legH = 14;
  const legW = 6;
  ctx.beginPath();
  ctx.rect(-legW - 1, 0, legW, legH);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(1, 0, legW, legH);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Shoes
  for (const lx of [-legW - 1, 1]) {
    ctx.beginPath();
    ctx.rect(lx - 1, legH - 3, legW + 3, 5);
    ctx.fillStyle = RO.ink;
    ctx.fill();
  }

  // Body / torso
  const bodyW = 18;
  const bodyH = 20;
  ctx.beginPath();
  ctx.rect(-bodyW / 2, -bodyH, bodyW, bodyH);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Trim / class details
  ctx.beginPath();
  ctx.rect(-bodyW / 2, -bodyH, bodyW, 5);
  ctx.fillStyle = colors.trim;
  ctx.fill();

  // Arms
  const armW = 5;
  const armH = 14;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(side * (bodyW / 2), -bodyH + 3, side * armW, armH);
    ctx.fillStyle = colors.body;
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Weapon / class item
  if (job === "knight") {
    // Sword on right side
    ctx.beginPath();
    ctx.moveTo(bodyW / 2 + armW, -bodyH - 4);
    ctx.lineTo(bodyW / 2 + armW + 3, -bodyH + 8);
    ctx.strokeStyle = "#aabbcc";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bodyW / 2 + armW - 4, -bodyH + 1);
    ctx.lineTo(bodyW / 2 + armW + 8, -bodyH + 1);
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (job === "wizard") {
    // Staff on right
    ctx.beginPath();
    ctx.moveTo(bodyW / 2 + armW + 1, -bodyH - 10);
    ctx.lineTo(bodyW / 2 + armW + 1, 6);
    ctx.strokeStyle = "#553388";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bodyW / 2 + armW + 1, -bodyH - 10, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#cc44ff";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (job === "archer") {
    // Bow on right
    ctx.beginPath();
    ctx.arc(bodyW / 2 + armW + 2, -bodyH + 6, 8, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.strokeStyle = "#443300";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Bowstring
    ctx.beginPath();
    ctx.moveTo(bodyW / 2 + armW + 2 + 8 * Math.sin(-0.6 * Math.PI), -bodyH + 6 + 8 * (-Math.cos(-0.6 * Math.PI) * 0.6));
    ctx.lineTo(bodyW / 2 + armW + 2 + 8 * Math.sin(0.6 * Math.PI), -bodyH + 6 + 8 * (-Math.cos(0.6 * Math.PI) * 0.6));
    ctx.strokeStyle = "#ccbbaa";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else if (job === "priest") {
    // Cross staff
    const sx = bodyW / 2 + armW + 1;
    ctx.beginPath();
    ctx.moveTo(sx, -bodyH - 8);
    ctx.lineTo(sx, 6);
    ctx.strokeStyle = "#d4aa44";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 5, -bodyH - 2);
    ctx.lineTo(sx + 5, -bodyH - 2);
    ctx.strokeStyle = "#d4aa44";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (job === "merchant") {
    // Apron overlay
    ctx.beginPath();
    ctx.rect(-5, -bodyH + 6, 10, bodyH - 4);
    ctx.fillStyle = "#eeeecc";
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Head (slightly chibi — bigger than body proportion)
  const headR = 11;
  ctx.beginPath();
  ctx.arc(0, -bodyH - headR + 2, headR, 0, Math.PI * 2);
  ctx.fillStyle = RO.skin;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Soft shading on head (watercolor-ish)
  const headShade = ctx.createRadialGradient(3, -bodyH - headR, 1, 0, -bodyH - headR + 2, headR);
  headShade.addColorStop(0, "rgba(255,255,255,0.25)");
  headShade.addColorStop(1, "rgba(150,90,50,0.15)");
  ctx.beginPath();
  ctx.arc(0, -bodyH - headR + 2, headR, 0, Math.PI * 2);
  ctx.fillStyle = headShade;
  ctx.fill();

  // Eyes
  const eyeY = -bodyH - headR + 4;
  ctx.beginPath();
  ctx.arc(-4, eyeY, 2, 0, Math.PI * 2);
  ctx.fillStyle = RO.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, eyeY, 2, 0, Math.PI * 2);
  ctx.fillStyle = RO.ink;
  ctx.fill();
  // Eye shine
  ctx.beginPath();
  ctx.arc(-3.2, eyeY - 0.8, 0.7, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4.8, eyeY - 0.8, 0.7, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();

  // Mouth
  ctx.beginPath();
  ctx.arc(0, eyeY + 4, 2.5, 0, Math.PI);
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Hair based on job
  ctx.beginPath();
  ctx.arc(0, -bodyH - headR + 2, headR, -Math.PI, 0);
  ctx.fillStyle = colors.hair;
  ctx.fill();

  // Class-specific hat/headgear
  if (job === "novice") {
    // Cute hat (small top hat)
    ctx.beginPath();
    ctx.ellipse(0, -bodyH - headR * 2 + 3, 7, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ddaa66";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-4, -bodyH - headR * 2 + 3 - 8, 8, 8);
    ctx.fillStyle = "#ddaa66";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -bodyH - headR * 2 + 3 - 8, 8, 8);
  } else if (job === "wizard") {
    // Pointy witch hat
    ctx.beginPath();
    ctx.moveTo(0, -bodyH - headR * 2 - 10);
    ctx.lineTo(-10, -bodyH - headR + 1);
    ctx.lineTo(10, -bodyH - headR + 1);
    ctx.closePath();
    ctx.fillStyle = "#330066";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -bodyH - headR + 1, 12, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#440088";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (job === "knight") {
    // Helmet
    ctx.beginPath();
    ctx.arc(0, -bodyH - headR + 2, headR + 1, -Math.PI, 0);
    ctx.fillStyle = "#aabbdd";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Visor
    ctx.beginPath();
    ctx.rect(-6, -bodyH - headR + 2, 12, 6);
    ctx.fillStyle = "#667788";
    ctx.fill();
  } else if (job === "archer") {
    // Green hood
    ctx.beginPath();
    ctx.arc(0, -bodyH - headR + 2, headR, -Math.PI, 0);
    ctx.fillStyle = "#336622";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (job === "priest") {
    // White veil / headpiece
    ctx.beginPath();
    ctx.arc(0, -bodyH - headR + 2, headR, -Math.PI, 0);
    ctx.fillStyle = "#eeeeff";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (job === "merchant") {
    // Bandana / cap
    ctx.beginPath();
    ctx.ellipse(0, -bodyH - headR * 2 + 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#cc8833";
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw emote bubble above character head */
function drawEmoteBubble(ctx: CanvasRenderingContext2D, x: number, y: number, emote: string): void {
  const bW = Math.max(22, emote.length * 9 + 10);
  const bH = 22;
  const bx = x - bW / 2;
  const by = y - bH - 4;

  // Bubble
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(bx, by, bW, bH, 6);
  ctx.fillStyle = RO.emoteBg;
  ctx.fill();
  ctx.strokeStyle = RO.emoteBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(x - 4, by + bH);
  ctx.lineTo(x, by + bH + 6);
  ctx.lineTo(x + 4, by + bH);
  ctx.closePath();
  ctx.fillStyle = RO.emoteBg;
  ctx.fill();
  ctx.strokeStyle = RO.emoteBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Emote text
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#333333";
  ctx.fillText(emote, x, by + bH - 6);
  ctx.restore();
}

/** Draw a RO-style display stand with item */
function drawDisplayStand(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  grade: Grade,
  tick: number,
): void {
  const sw = 72;
  const sh = 66;

  // Stand base
  ctx.save();
  ctx.translate(x, y);

  // Back panel
  ctx.beginPath();
  ctx.rect(-sw / 2, -sh, sw, sh - 8);
  ctx.fillStyle = RO.standFill;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Top shelf edge (isometric-ish perspective)
  ctx.beginPath();
  ctx.moveTo(-sw / 2, -sh);
  ctx.lineTo(sw / 2, -sh);
  ctx.lineTo(sw / 2 + 5, -sh - 5);
  ctx.lineTo(-sw / 2 + 5, -sh - 5);
  ctx.closePath();
  ctx.fillStyle = RO.standTop;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Front ledge
  ctx.beginPath();
  ctx.rect(-sw / 2 - 2, -8, sw + 4, 8);
  ctx.fillStyle = RO.standDark;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Grade color panel inside stand
  const color = grade === "A賞" ? RO.gradeA : grade === "B賞" ? RO.gradeB : grade === "C賞" ? RO.gradeC : RO.gradeD;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fillRect(-sw / 2 + 4, -sh + 4, sw - 8, sh - 16);
  ctx.globalAlpha = 1;

  // Item glow
  const glowColor = GRADE_GLOW[grade];
  const glowRadius = 20 + Math.sin(tick * 0.05) * 4;
  const grd = ctx.createRadialGradient(0, -sh * 0.55, 2, 0, -sh * 0.55, glowRadius);
  grd.addColorStop(0, glowColor);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(-glowRadius, -sh + glowRadius * 0.5, glowRadius * 2, glowRadius * 2);

  // Item rotation + drawing
  ctx.save();
  ctx.translate(0, -sh * 0.52);
  ctx.rotate(Math.sin(tick * 0.03) * 0.15);
  const itemSize = 28;
  if (grade === "A賞") {
    // Card
    ctx.beginPath();
    ctx.roundRect(-itemSize * 0.4, -itemSize * 0.52, itemSize * 0.8, itemSize, 3);
    ctx.fillStyle = "#fff8dd";
    ctx.fill();
    ctx.strokeStyle = RO.gradeA;
    ctx.lineWidth = 2;
    ctx.stroke();
    const spikes = 5;
    const or = 7; const ir = 3;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? or : ir;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r - 2);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 2);
    }
    ctx.closePath();
    ctx.fillStyle = RO.gradeA;
    ctx.fill();
  } else if (grade === "B賞") {
    // Blue gemstone
    const d = itemSize * 0.42;
    ctx.beginPath();
    ctx.moveTo(0, -d); ctx.lineTo(d * 0.65, -d * 0.2);
    ctx.lineTo(d * 0.65, d * 0.2); ctx.lineTo(0, d);
    ctx.lineTo(-d * 0.65, d * 0.2); ctx.lineTo(-d * 0.65, -d * 0.2);
    ctx.closePath();
    const gg = ctx.createLinearGradient(-d, -d, d, d);
    gg.addColorStop(0, "#aaddff"); gg.addColorStop(1, "#2244aa");
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = "#1133aa";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (grade === "C賞") {
    // Green herb
    ctx.beginPath();
    ctx.moveTo(0, itemSize * 0.45);
    ctx.bezierCurveTo(0, 0, -itemSize * 0.3, -itemSize * 0.1, -itemSize * 0.1, -itemSize * 0.35);
    ctx.strokeStyle = "#336633";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    for (const [lx, ly, rot] of [[-0.2, 0, -0.5], [0.25, -0.15, 0.6], [-0.05, -0.3, -0.3]] as [number, number, number][]) {
      ctx.save();
      ctx.translate(lx * itemSize, ly * itemSize);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, itemSize * 0.22, itemSize * 0.11, 0, 0, Math.PI * 2);
      ctx.fillStyle = RO.gradeC;
      ctx.fill();
      ctx.strokeStyle = "#226622";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Poring (D grade)
    ctx.beginPath();
    ctx.ellipse(0, 3, itemSize * 0.4, itemSize * 0.36, 0, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(-4, -2, 2, 0, 3, itemSize * 0.4);
    pg.addColorStop(0, "#ffd0dd"); pg.addColorStop(1, "#ee6688");
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Eyes
    for (const ex of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(ex, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = RO.ink;
      ctx.fill();
    }
    // Mouth
    ctx.beginPath();
    ctx.arc(0, 6, 3, 0, Math.PI);
    ctx.strokeStyle = RO.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Grade label
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(grade, 0, -4);
  ctx.fillStyle = RO.ink;
  ctx.font = "7px sans-serif";
  ctx.fillText(grade === "A賞" ? "限定公仔" : grade === "B賞" ? "周邊商品" : grade === "C賞" ? "貼紙組" : "明信片", 0, 3);

  ctx.restore();
}

/** Draw the merchant counter / desk */
function drawCounter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  // Counter front face (isometric feel)
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w + 8, y + h - 6);
  ctx.lineTo(x + 8, y + h - 6);
  ctx.closePath();
  ctx.fillStyle = RO.counterFront;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Counter top face
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + 8, y - 6);
  ctx.lineTo(x + 8, y - 6);
  ctx.closePath();
  ctx.fillStyle = RO.counterTop;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Counter body
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = RO.counterFill;
  ctx.fill();
  ctx.strokeStyle = RO.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Label on counter
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = RO.ink;
  ctx.fillText("交易櫃台", x + w / 2, y + h / 2 + 4);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Character factory
// ─────────────────────────────────────────────────────────────────────────────

const ALL_JOBS: JobClass[] = ["knight", "wizard", "archer", "priest", "merchant"];

function makeCharacters(npcCount: number): Character[] {
  const chars: Character[] = [];

  // Player (novice)
  chars.push({
    id: 0,
    x: W / 2 + 80,
    y: H - 70,
    tx: W / 2 + 80,
    ty: H - 70,
    job: "novice",
    hairColor: RO.hairColors[0]!,
    speed: 1.2,
    bobPhase: 0,
    emote: null,
    emoteTimer: 0,
    isPlayer: true,
    isDrawing: false,
    drawTimer: 0,
    gradeResult: null,
    facing: "left",
  });

  // NPC characters
  const npcPositions = [
    [80, H - 80], [W - 100, H - 80], [130, H - 110],
    [W - 150, H - 100], [200, H - 90],
  ];
  for (let i = 0; i < Math.min(npcCount, 5); i++) {
    const [nx, ny] = npcPositions[i] ?? [100 + i * 70, H - 80];
    chars.push({
      id: i + 1,
      x: nx!, y: ny!,
      tx: nx!, ty: ny!,
      job: ALL_JOBS[i % ALL_JOBS.length]!,
      hairColor: RO.hairColors[(i + 1) % RO.hairColors.length]!,
      speed: 0.6 + i * 0.1,
      bobPhase: i * 1.4,
      emote: null,
      emoteTimer: 0,
      isPlayer: false,
      isDrawing: false,
      drawTimer: 0,
      gradeResult: null,
      facing: i % 2 === 0 ? "right" : "left",
    });
  }

  return chars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeRoom_RO({
  npcCount = 3,
  onDrawResult,
  resultGrade,
}: PrizeRoomROProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const charsRef = useRef<Character[]>([]);
  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pillarsRef = useRef<LightPillar[]>([]);
  const dmgNumsRef = useRef<DamageNum[]>([]);
  const sysMsgRef = useRef<{ text: string; life: number } | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogNpcJob, setDialogNpcJob] = useState<JobClass>("merchant");

  // Init characters on mount / npcCount change
  useEffect(() => {
    charsRef.current = makeCharacters(npcCount);
  }, [npcCount]);

  // NPC auto-wander
  useEffect(() => {
    const wander = setInterval(() => {
      const chars = charsRef.current;
      chars.forEach((c) => {
        if (c.isPlayer || c.isDrawing) return;
        if (Math.random() < 0.4) {
          const range = 60;
          c.tx = Math.max(30, Math.min(W - 30, c.x + (Math.random() - 0.5) * range));
          c.ty = Math.max(FLOOR_Y + 30, Math.min(H - 30, c.y + (Math.random() - 0.5) * 30));
          c.facing = c.tx > c.x ? "right" : "left";
        }
        // Random emote
        if (Math.random() < 0.15 && c.emoteTimer <= 0) {
          c.emote = EMOTES[Math.floor(Math.random() * EMOTES.length)]!;
          c.emoteTimer = 90;
        }
      });
    }, 1800);
    return () => clearInterval(wander);
  }, []);

  // NPC auto-draw
  useEffect(() => {
    const drawTimer = setInterval(() => {
      const chars = charsRef.current;
      const availableNpcs = chars.filter((c) => !c.isPlayer && !c.isDrawing);
      if (availableNpcs.length === 0) return;
      const npc = availableNpcs[Math.floor(Math.random() * availableNpcs.length)]!;
      // Walk to counter
      npc.tx = COUNTER_X + COUNTER_W / 2 + (Math.random() - 0.5) * 20;
      npc.ty = DRAW_ZONE_Y;
      npc.facing = "right";
      npc.isDrawing = true;
      npc.drawTimer = 120;
      npc.emote = "!";
      npc.emoteTimer = 60;

      // After reaching counter, spawn result
      setTimeout(() => {
        const grade = ((): Grade => {
          const r = Math.random();
          if (r < 0.05) return "A賞";
          if (r < 0.25) return "B賞";
          if (r < 0.60) return "C賞";
          return "D賞";
        })();
        npc.gradeResult = grade;
        npc.isDrawing = false;

        // Emote based on grade
        npc.emote = grade === "A賞" ? "★" : grade === "B賞" ? "!" : "?";
        npc.emoteTimer = 120;

        // Light pillar
        pillarsRef.current.push({
          x: npc.tx,
          grade,
          life: 100,
          maxLife: 100,
        });

        // Damage number
        dmgNumsRef.current.push({
          x: npc.tx,
          y: npc.ty - 40,
          vy: -1.5,
          text: GRADE_DMG[grade],
          color: GRADE_DMG_COLOR[grade],
          life: 90,
          maxLife: 90,
          isCrit: grade === "A賞",
        });

        // System message
        const pn = PRIZE_NAMES[grade];
        sysMsgRef.current = { text: `[系統] ${npc.job} 獲得 ${grade}（${pn}）！`, life: 180 };

        onDrawResult?.(grade, pn);

        // Wander away after draw
        setTimeout(() => {
          npc.tx = 50 + Math.random() * (W - 100);
          npc.ty = FLOOR_Y + 60 + Math.random() * (H - FLOOR_Y - 80);
          npc.gradeResult = null;
        }, 1800);
      }, 1500);
    }, 4000);

    return () => clearInterval(drawTimer);
  }, [onDrawResult]);

  // Canvas click — move player
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (W / rect.width);
    const cy = (e.clientY - rect.top) * (H / rect.height);

    // Check if clicked merchant NPC (for dialog)
    const chars = charsRef.current;
    const merchant = chars.find((c) => c.job === "merchant" && !c.isPlayer);
    if (merchant) {
      const dx = cx - merchant.x;
      const dy = cy - merchant.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        setDialogNpcJob("merchant");
        setDialogOpen(true);
        return;
      }
    }

    // Close dialog if open and click elsewhere
    if (dialogOpen) { setDialogOpen(false); return; }

    // Move player
    const player = chars.find((c) => c.isPlayer);
    if (player && cy > FLOOR_Y) {
      player.tx = Math.max(20, Math.min(W - 20, cx));
      player.ty = Math.max(FLOOR_Y + 20, Math.min(H - 20, cy));
      player.facing = player.tx > player.x ? "right" : "left";
    }
  }, [dialogOpen]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      tickRef.current += 1;
      const t = tickRef.current;
      ctx.clearRect(0, 0, W, H);

      // ── Back wall ─────────────────────────────────────────────────────────
      const wallGrd = ctx.createLinearGradient(0, 0, 0, WALL_H);
      wallGrd.addColorStop(0, RO.bgWallTop);
      wallGrd.addColorStop(1, RO.bgWall);
      ctx.fillStyle = wallGrd;
      ctx.fillRect(0, 0, W, WALL_H);

      // Brick / mortar lines on wall
      const brickH = 18;
      const brickW = 55;
      for (let row = 0; row < Math.ceil(WALL_H / brickH); row++) {
        const offset = row % 2 === 0 ? 0 : brickW / 2;
        for (let col = -1; col < Math.ceil(W / brickW) + 1; col++) {
          const bx = col * brickW + offset;
          const by = row * brickH;
          ctx.strokeStyle = RO.bgWallLine;
          ctx.lineWidth = 0.7;
          ctx.strokeRect(bx, by, brickW, brickH);
        }
      }

      // ── Wooden ceiling beams ──────────────────────────────────────────────
      const beamPositions = [W * 0.2, W * 0.5, W * 0.8];
      for (const bx of beamPositions) {
        // Main beam (horizontal)
        ctx.beginPath();
        ctx.rect(0, 8, W, 18);
        ctx.fillStyle = RO.beamFill;
        ctx.fill();
        ctx.strokeStyle = RO.beamDark;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Bottom highlight
        ctx.beginPath();
        ctx.rect(0, 8, W, 4);
        ctx.fillStyle = RO.beamLight;
        ctx.fill();

        // Vertical support beams
        ctx.beginPath();
        ctx.rect(bx - 10, 0, 20, WALL_H);
        ctx.fillStyle = RO.beamFill;
        ctx.fill();
        ctx.strokeStyle = RO.beamDark;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(bx - 10, 0, 4, WALL_H);
        ctx.fillStyle = RO.beamLight;
        ctx.fill();
      }

      // ── Window (center-top) ───────────────────────────────────────────────
      const winX = W / 2 - 40;
      const winY = 18;
      const winW = 80;
      const winH = 60;
      ctx.beginPath();
      ctx.rect(winX, winY, winW, winH);
      ctx.fillStyle = RO.windowGlass;
      ctx.fill();
      ctx.strokeStyle = RO.windowFrame;
      ctx.lineWidth = 4;
      ctx.stroke();
      // Window cross
      ctx.beginPath();
      ctx.moveTo(W / 2, winY); ctx.lineTo(W / 2, winY + winH);
      ctx.moveTo(winX, winY + winH / 2); ctx.lineTo(winX + winW, winY + winH / 2);
      ctx.strokeStyle = RO.windowFrame;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Light rays from window
      for (let ri = 0; ri < 4; ri++) {
        const angle = -0.3 + ri * 0.15;
        const rayLen = 140 + ri * 20;
        ctx.save();
        ctx.globalAlpha = 0.12 + Math.sin(t * 0.02 + ri) * 0.03;
        ctx.beginPath();
        ctx.moveTo(winX + winW * (0.2 + ri * 0.2), winY + winH);
        ctx.lineTo(winX + winW * (0.2 + ri * 0.2) + Math.sin(angle) * rayLen, winY + winH + Math.cos(angle) * rayLen * 0.5 + rayLen * 0.5);
        ctx.lineTo(winX + winW * (0.2 + ri * 0.2) + Math.sin(angle) * rayLen + 30, winY + winH + Math.cos(angle) * rayLen * 0.5 + rayLen * 0.5);
        ctx.closePath();
        ctx.fillStyle = RO.windowLight;
        ctx.fill();
        ctx.restore();
      }

      // ── Torches on walls ──────────────────────────────────────────────────
      for (const torch of TORCHES) {
        const flicker = 0.8 + Math.sin(t * 0.15 + torch.x) * 0.2;
        // Torch glow
        ctx.save();
        ctx.globalAlpha = 0.3 * flicker;
        const tGrd = ctx.createRadialGradient(torch.x, torch.y, 2, torch.x, torch.y, 35);
        tGrd.addColorStop(0, RO.torchYellow);
        tGrd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tGrd;
        ctx.fillRect(torch.x - 35, torch.y - 35, 70, 70);
        ctx.restore();
        // Torch bracket
        ctx.beginPath();
        ctx.rect(torch.x - 5, torch.y, 10, 16);
        ctx.fillStyle = "#443322";
        ctx.fill();
        ctx.strokeStyle = RO.ink;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Flame
        ctx.save();
        ctx.globalAlpha = flicker;
        ctx.beginPath();
        ctx.moveTo(torch.x, torch.y);
        ctx.bezierCurveTo(torch.x - 7, torch.y - 12, torch.x + 7, torch.y - 18, torch.x, torch.y - 22);
        ctx.bezierCurveTo(torch.x - 4, torch.y - 14, torch.x + 4, torch.y - 8, torch.x, torch.y);
        ctx.fillStyle = RO.torchOrange;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(torch.x, torch.y - 4);
        ctx.bezierCurveTo(torch.x - 3, torch.y - 12, torch.x + 3, torch.y - 16, torch.x, torch.y - 18);
        ctx.fillStyle = RO.torchYellow;
        ctx.fill();
        ctx.restore();
      }

      // ── Stone floor ───────────────────────────────────────────────────────
      const floorRows = Math.ceil((H - FLOOR_Y) / 22) + 1;
      for (let row = 0; row < floorRows; row++) {
        const perspective = 1 + row * 0.08;
        const tileW = 65 * perspective;
        const tileH = 18 + row * 1.5;
        const fy = FLOOR_Y + row * 20;
        const startX = -tileW + ((row % 2) * tileW * 0.5);
        for (let col = 0; col < Math.ceil(W / tileW) + 2; col++) {
          const fx = startX + col * tileW;
          ctx.beginPath();
          ctx.rect(fx, fy, tileW - 1.5, tileH);
          const shade = (row + col) % 2 === 0 ? RO.floorA : RO.floorB;
          ctx.fillStyle = shade;
          ctx.fill();
          ctx.strokeStyle = RO.floorLine;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      // Floor shadow near wall
      const floorFog = ctx.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 30);
      floorFog.addColorStop(0, RO.floorShadow);
      floorFog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = floorFog;
      ctx.fillRect(0, FLOOR_Y, W, 30);

      // ── Display stands ────────────────────────────────────────────────────
      for (const stand of STANDS) {
        drawDisplayStand(ctx, stand.x, stand.y, stand.grade, t);
      }

      // ── Counter / desk ────────────────────────────────────────────────────
      drawCounter(ctx, COUNTER_X, COUNTER_Y, COUNTER_W, COUNTER_H);

      // Merchant NPC — always at counter
      const chars = charsRef.current;
      const merchant = chars.find((c) => c.job === "merchant" && !c.isPlayer);
      if (merchant) {
        drawShadowBlob(ctx, COUNTER_X + COUNTER_W / 2, COUNTER_Y + 2);
        drawROCharacter(ctx, COUNTER_X + COUNTER_W / 2, COUNTER_Y - 2, "merchant", 0, "right");
        // "Click me!" prompt
        if (Math.floor(t / 30) % 2 === 0) {
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = RO.sysText;
          ctx.fillText("點擊對話", COUNTER_X + COUNTER_W / 2, COUNTER_Y - 40);
        }
      }

      // ── Other characters (non-merchant NPCs + player) ─────────────────────
      // Sort by Y for painter's algorithm
      const drawableChars = [...chars].filter((c) => !c.isPlayer && c.job !== "merchant");
      const player = chars.find((c) => c.isPlayer);
      const sorted = [...drawableChars];
      if (player) sorted.push(player);
      sorted.sort((a, b) => a.y - b.y);

      for (const ch of sorted) {
        // Move toward target
        const dx = ch.tx - ch.x;
        const dy = ch.ty - ch.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1.5) {
          const spd = ch.speed;
          ch.x += (dx / dist) * spd;
          ch.y += (dy / dist) * spd;
        }

        ch.bobPhase += 0.05;
        const bob = Math.sin(ch.bobPhase) * 1.8;

        // Shadow
        drawShadowBlob(ctx, ch.x, ch.y + 2);

        // Character
        drawROCharacter(ctx, ch.x, ch.y, ch.job, bob, ch.facing, ch.isPlayer ? 1.1 : 1.0);

        // Player indicator
        if (ch.isPlayer) {
          ctx.beginPath();
          ctx.arc(ch.x, ch.y - 58, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ffee44";
          ctx.fill();
          ctx.strokeStyle = RO.ink;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Emote
        if (ch.emote && ch.emoteTimer > 0) {
          ch.emoteTimer -= 1;
          drawEmoteBubble(ctx, ch.x, ch.y - 55, ch.emote);
          if (ch.emoteTimer <= 0) ch.emote = null;
        }

        // Draw timer
        if (ch.isDrawing && ch.drawTimer > 0) {
          ch.drawTimer -= 1;
          if (ch.drawTimer <= 0) ch.isDrawing = false;
        }

        // Grade result badge
        if (ch.gradeResult) {
          const gradeColor = ch.gradeResult === "A賞" ? RO.gradeA : ch.gradeResult === "B賞" ? RO.gradeB : ch.gradeResult === "C賞" ? RO.gradeC : RO.gradeD;
          ctx.beginPath();
          ctx.roundRect(ch.x - 14, ch.y - 72, 28, 14, 3);
          ctx.fillStyle = gradeColor;
          ctx.fill();
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "#fff";
          ctx.fillText(ch.gradeResult, ch.x, ch.y - 62);
        }
      }

      // ── Light pillars ─────────────────────────────────────────────────────
      pillarsRef.current = pillarsRef.current.filter((pl) => pl.life > 0);
      for (const pl of pillarsRef.current) {
        pl.life -= 1;
        const alpha2 = Math.min(1, pl.life / 20) * 0.75;
        const pilColor = GRADE_PILLAR[pl.grade];
        ctx.save();
        ctx.globalAlpha = alpha2;
        const pGrd = ctx.createLinearGradient(0, 0, 0, H);
        pGrd.addColorStop(0, pilColor);
        pGrd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = pGrd;
        ctx.fillRect(pl.x - 18, 0, 36, H);
        // Sparkles for A grade
        if (pl.grade === "A賞") {
          for (let si = 0; si < 6; si++) {
            const sa = (si / 6) * Math.PI * 2 + t * 0.08;
            const sx2 = pl.x + Math.cos(sa) * 22;
            const sy2 = H * 0.5 + Math.sin(sa) * 15;
            ctx.beginPath();
            ctx.arc(sx2, sy2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = RO.sparkle;
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // ── Damage numbers ────────────────────────────────────────────────────
      dmgNumsRef.current = dmgNumsRef.current.filter((dn) => dn.life > 0);
      for (const dn of dmgNumsRef.current) {
        dn.life -= 1;
        dn.y += dn.vy;
        dn.vy *= 0.97;
        const alpha2 = Math.min(1, dn.life / 20);
        ctx.save();
        ctx.globalAlpha = alpha2;
        ctx.font = `${dn.isCrit ? "bold italic" : "bold"} ${dn.isCrit ? 20 : 14}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.fillText(dn.text, dn.x + 1.5, dn.y + 1.5);
        ctx.fillStyle = dn.color;
        ctx.fillText(dn.text, dn.x, dn.y);
        if (dn.isCrit) {
          ctx.font = "bold 9px sans-serif";
          ctx.fillStyle = "#fff";
          ctx.fillText("CRITICAL!", dn.x, dn.y - 16);
        }
        ctx.restore();
      }

      // ── System message ────────────────────────────────────────────────────
      if (sysMsgRef.current) {
        const sm = sysMsgRef.current;
        sm.life -= 1;
        if (sm.life <= 0) sysMsgRef.current = null;
        else {
          const alpha2 = Math.min(1, sm.life / 30);
          ctx.save();
          ctx.globalAlpha = alpha2;
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "#000";
          ctx.fillText(sm.text, W / 2 + 1, 17);
          ctx.fillStyle = RO.sysText;
          ctx.fillText(sm.text, W / 2, 16);
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Handle "draw" button in dialog
  const handleDialogDraw = useCallback(() => {
    setDialogOpen(false);
    const chars = charsRef.current;
    const player = chars.find((c) => c.isPlayer);
    if (!player) return;

    const grade = ((): Grade => {
      if (resultGrade && GRADES.includes(resultGrade as Grade)) return resultGrade as Grade;
      const r = Math.random();
      if (r < 0.05) return "A賞";
      if (r < 0.25) return "B賞";
      if (r < 0.60) return "C賞";
      return "D賞";
    })();

    player.tx = DRAW_ZONE_X;
    player.ty = DRAW_ZONE_Y;
    player.emote = "!";
    player.emoteTimer = 60;

    setTimeout(() => {
      player.gradeResult = grade;
      player.emote = grade === "A賞" ? "★" : grade === "B賞" ? "!" : grade === "C賞" ? "?" : "...";
      player.emoteTimer = 160;

      pillarsRef.current.push({ x: player.x, grade, life: 120, maxLife: 120 });
      dmgNumsRef.current.push({
        x: player.x,
        y: player.y - 50,
        vy: -1.8,
        text: GRADE_DMG[grade],
        color: GRADE_DMG_COLOR[grade],
        life: 100,
        maxLife: 100,
        isCrit: grade === "A賞",
      });

      const pn = PRIZE_NAMES[grade];
      sysMsgRef.current = { text: `[系統] 玩家獲得 ${grade}（${pn}）！`, life: 200 };
      onDrawResult?.(grade, pn);

      setTimeout(() => { player.gradeResult = null; }, 2200);
    }, 1200);
  }, [resultGrade, onDrawResult]);

  return (
    <div className="relative flex flex-col items-center select-none" style={{ fontFamily: "sans-serif" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        className="cursor-pointer"
        style={{ imageRendering: "auto", maxWidth: "100%" }}
      />

      {/* RO-style dialogue box */}
      {dialogOpen && (
        <div
          className="absolute bottom-0 left-0 right-0 mx-auto"
          style={{
            background: RO.dialogBg,
            border: `2px solid ${RO.dialogBorder}`,
            borderRadius: "4px",
            padding: "12px 16px",
            maxWidth: 480,
            color: RO.dialogText,
            fontFamily: "sans-serif",
            fontSize: 13,
          }}
        >
          <p style={{ color: RO.dialogTitle, fontWeight: "bold", marginBottom: 6 }}>
            [{dialogNpcJob === "merchant" ? "商人" : dialogNpcJob}] 歡迎來到一番賞商店！
          </p>
          <p style={{ marginBottom: 10, lineHeight: 1.6 }}>
            要來試試手氣嗎？每一抽都是命運的考驗！<br />
            最稀有的 A賞 只有 5% 機率，勇者才能獲得。
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDialogDraw}
              style={{
                background: "#4a8a3a",
                color: "#fff",
                border: "1px solid #6aaa5a",
                borderRadius: 3,
                padding: "4px 14px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              抽獎
            </button>
            <button
              onClick={() => setDialogOpen(false)}
              style={{
                background: "#3a4a5a",
                color: "#ccc",
                border: "1px solid #5a6a7a",
                borderRadius: 3,
                padding: "4px 14px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              離開
            </button>
          </div>
        </div>
      )}

      <p className="mt-1 text-xs opacity-50" style={{ color: "#ffee88" }}>
        點擊地板移動角色 — 點擊商人NPC對話抽獎
      </p>
    </div>
  );
}
