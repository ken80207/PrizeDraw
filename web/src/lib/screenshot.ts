/**
 * Screenshot / Share utilities.
 *
 * Captures the current game canvas (or any DOM element rendered into a
 * temporary canvas), overlays PrizeDraw branding, and returns a PNG Blob
 * ready for download or Web Share API.
 *
 * No third-party dependencies — everything uses the native Canvas 2D API.
 */

// ── Grade accent colours (matches dev page GRADE_HEX) ──────────────────────

const GRADE_COLOURS: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
  "最後賞": "#f43f5e",
};

function gradeColour(grade: string): string {
  return GRADE_COLOURS[grade] ?? "#6366f1";
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

/**
 * Render an HTMLElement into an offscreen canvas using the browser's
 * built-in foreignObject / drawImage pipeline where available, otherwise
 * fall back to a simple solid-colour placeholder.
 *
 * NOTE: Full DOM-to-canvas rendering (html2canvas style) requires a library;
 * without it we use the element's bounding rect to capture dimensions and
 * draw whatever the element has exposed as an ImageBitmap when possible.
 */
async function elementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const rect = el.getBoundingClientRect();
  const w = Math.max(rect.width, 340);
  const h = Math.max(rect.height, 480);

  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Attempt to grab a snapshot of the element via createImageBitmap on the
  // element itself (works when the element has rendered content that the
  // browser exposes as a paintable source).
  // This is a best-effort approach without html2canvas.
  try {
    // Walk the element's shadow DOM for any canvas children
    const innerCanvas = el.querySelector("canvas");
    if (innerCanvas) {
      const bmp = await createImageBitmap(innerCanvas);
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      return offscreen;
    }
  } catch {
    // Ignore — fall through to placeholder
  }

  // Fallback: dark background with a subtle grid
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  return offscreen;
}

// ── Branded overlay ─────────────────────────────────────────────────────────

function drawBrandedOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prizeGrade: string,
  prizeName: string,
  styleName: string,
): void {
  const accent = gradeColour(prizeGrade);
  const pad = 12;

  // ── Decorative border ──────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(pad / 2, pad / 2, w - pad, h - pad);
  // Corner accents
  const cs = 20; // corner size
  ctx.lineWidth = 4;
  ctx.globalAlpha = 1;
  // Top-left
  ctx.beginPath(); ctx.moveTo(pad, pad + cs); ctx.lineTo(pad, pad); ctx.lineTo(pad + cs, pad); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(w - pad - cs, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + cs); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(pad, h - pad - cs); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + cs, h - pad); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(w - pad - cs, h - pad); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad, h - pad - cs); ctx.stroke();
  ctx.restore();

  // ── Top logo bar ───────────────────────────────────────────────────────────
  const logoH = 36;
  const logoGrad = ctx.createLinearGradient(0, 0, w, 0);
  logoGrad.addColorStop(0, "rgba(88,28,135,0.92)");
  logoGrad.addColorStop(1, "rgba(17,24,39,0.92)");
  ctx.save();
  ctx.fillStyle = logoGrad;
  ctx.fillRect(0, 0, w, logoH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("PrizeDraw", pad + 4, logoH / 2);

  // Style watermark right-aligned in logo bar
  ctx.fillStyle = "rgba(196,181,253,0.8)";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(styleName, w - pad - 4, logoH / 2);
  ctx.textAlign = "left";
  ctx.restore();

  // ── Bottom prize info bar ─────────────────────────────────────────────────
  const barH = 52;
  const barY = h - barH;
  const barGrad = ctx.createLinearGradient(0, barY, 0, h);
  barGrad.addColorStop(0, "rgba(17,24,39,0.0)");
  barGrad.addColorStop(0.2, "rgba(17,24,39,0.88)");
  barGrad.addColorStop(1, "rgba(17,24,39,0.96)");
  ctx.save();
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, barY, w, barH);

  // Grade badge
  const badgeW = 48;
  const badgeH = 22;
  const badgeX = pad + 4;
  const badgeY = h - barH + (barH - badgeH) / 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(prizeGrade, badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Prize name
  ctx.textAlign = "left";
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#f9fafb";
  const nameX = badgeX + badgeW + 8;
  ctx.fillText(prizeName, nameX, h - barH + barH / 2 - 6);

  // Timestamp
  const ts = new Date().toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  ctx.font = "10px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(156,163,175,0.9)";
  ctx.fillText(ts, nameX, h - barH + barH / 2 + 10);

  ctx.restore();
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Capture a game screenshot and return a branded PNG Blob.
 *
 * @param canvasOrElement - The game canvas or wrapping DOM element
 * @param prizeGrade      - e.g. "A賞", "B賞", …
 * @param prizeName       - e.g. "限定公仔"
 * @param styleName       - e.g. "Anime", "WebGL 3D", …
 */
export async function captureGameScreenshot(
  canvasOrElement: HTMLCanvasElement | HTMLElement,
  prizeGrade: string,
  prizeName: string,
  styleName: string,
): Promise<Blob> {
  // Resolve a base canvas
  let baseCanvas: HTMLCanvasElement;

  if (canvasOrElement instanceof HTMLCanvasElement) {
    baseCanvas = canvasOrElement;
  } else {
    baseCanvas = await elementToCanvas(canvasOrElement);
  }

  const w = baseCanvas.width;
  const h = baseCanvas.height;

  // Composite canvas: base image + overlay
  const output = document.createElement("canvas");
  output.width = w;
  output.height = h;
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context for output canvas");

  // Draw base
  ctx.drawImage(baseCanvas, 0, 0, w, h);

  // Draw branded overlay on top
  drawBrandedOverlay(ctx, w, h, prizeGrade, prizeName, styleName);

  return new Promise<Blob>((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob() returned null"));
    }, "image/png");
  });
}

/**
 * Trigger a browser download of the given Blob as a PNG file.
 *
 * @param blob     - PNG blob (from captureGameScreenshot)
 * @param filename - Optional file name; defaults to `prizedraw-<timestamp>.png`
 */
export function downloadScreenshot(blob: Blob, filename?: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `prizedraw-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share the screenshot via the Web Share API when available, otherwise
 * fall back to downloading the file.
 *
 * @param blob - PNG blob (from captureGameScreenshot)
 * @param text - Share message text
 */
export async function shareScreenshot(blob: Blob, text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.share !== undefined &&
    navigator.canShare !== undefined
  ) {
    const file = new File([blob], "prizedraw.png", { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ text, files: [file] });
      return;
    }
  }
  // Fallback: download
  downloadScreenshot(blob);
}
