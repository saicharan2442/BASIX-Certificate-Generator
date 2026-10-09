import { CANVAS_H, CANVAS_W, FIELD_KEYS, FIELD_LABELS } from "./layout";
import { ensureFontsReady } from "./fonts";
import { getTemplateInfo, type TemplateInfo, invalidateTemplate } from "./template";
import type { FieldConfig, FieldKey, LayoutConfig, StudentRecord } from "./types";

/**
 * Canvas certificate renderer.
 *
 * ONE code path paints both the on-screen preview and the PDF export, so
 * what the operator reviews is exactly what gets printed.
 */

export interface RenderOptions {
  /** Output pixel density multiplier (1 = 1536×1024, 2 = 3072×2048 …). */
  scale?: number;
  /** Draw dashed guides around every text box. */
  showGuides?: boolean;
  /** Overlay the completed/sample certificate at low opacity for comparison. */
  showReference?: boolean;
  referenceOpacity?: number;
  /** Highlight this one field's box (layout editor). */
  activeField?: FieldKey | null;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** Actual px size used per field after auto-fit. */
  fitted: Record<FieldKey, number>;
  /** Fields auto-fit could not fully contain. */
  warnings: string[];
  template: TemplateInfo;
}

const VALUE_OF: Record<FieldKey, (r: StudentRecord) => string> = {
  studentId: (r) => r.studentId,
  studentName: (r) => r.studentName,
  courseName: (r) => r.courseName,
  marks: (r) => r.marks,
  date: (r) => r.date,
  duration: (r) => r.duration,
};

export function fontString(f: FieldConfig, size: number): string {
  const style = f.italic ? "italic " : "";
  return `${style}${f.fontWeight} ${size}px ${f.fontFamily}`;
}

interface Measured {
  width: number;
  fits: boolean;
}

function measureWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FieldConfig,
  size: number,
): Measured {
  ctx.font = fontString(f, size);
  let width = ctx.measureText(text).width;
  if (f.letterSpacing > 0 && text.length > 1) {
    width += f.letterSpacing * (text.length - 1);
  }
  const fits = width <= f.w + 0.5 && size <= f.h + 0.5;
  return { width, fits };
}

/**
 * Largest font size (≤ configured, ≥ minFontSize) that keeps the text
 * inside its box. If autoFit is off the configured size is returned.
 */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FieldConfig,
): number {
  if (!f.autoFit) return f.fontSize;
  if (!text) return f.fontSize;
  let size = Math.min(f.fontSize, f.h);
  const first = measureWithSpacing(ctx, text, f, size);
  if (first.fits) return size;
  // Binary search between minFontSize and the failing size.
  let lo = Math.min(f.minFontSize, size - 1);
  let hi = size;
  for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (measureWithSpacing(ctx, text, f, mid).fits) lo = mid;
    else hi = mid;
  }
  return lo;
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  f: FieldConfig,
  size: number,
): void {
  ctx.font = fontString(f, size);
  ctx.fillStyle = f.color;

  const spacing = f.letterSpacing > 0 ? f.letterSpacing : 0;
  let total = ctx.measureText(text).width;
  if (spacing > 0 && text.length > 1) total += spacing * (text.length - 1);

  let x: number;
  if (f.align === "center") x = f.x + (f.w - total) / 2;
  else if (f.align === "right") x = f.x + f.w - total;
  else x = f.x;

  let y: number;
  if (f.valign === "top") {
    ctx.textBaseline = "top";
    y = f.y;
  } else if (f.valign === "bottom") {
    ctx.textBaseline = "bottom";
    y = f.y + f.h;
  } else {
    ctx.textBaseline = "middle";
    y = f.y + f.h / 2;
  }

  ctx.textAlign = "left";
  if (spacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

/** Explicit, honest placeholder used until the real BASIX blank template is installed. */
export function drawPlaceholder(ctx: CanvasRenderingContext2D): void {
  const W = CANVAS_W;
  const H = CANVAS_H;

  // Paper
  ctx.fillStyle = "#fafaf6";
  ctx.fillRect(0, 0, W, H);

  // Borders — navy + sky double frame
  ctx.strokeStyle = "#122852";
  ctx.lineWidth = 10;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = "#2db8ff";
  ctx.lineWidth = 3;
  ctx.strokeRect(66, 66, W - 132, H - 132);

  // Sky L-ticks at each outer corner
  ctx.strokeStyle = "#2db8ff";
  ctx.lineWidth = 7;
  const L = 60;
  const corners: Array<[number, number, number, number]> = [
    [44, 44, 1, 1],
    [W - 44, 44, -1, 1],
    [44, H - 44, 1, -1],
    [W - 44, H - 44, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * L, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * L);
    ctx.stroke();
  }

  // Medallion
  ctx.strokeStyle = "#2db8ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, 210, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 210, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#122852";
  ctx.font = "800 46px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B", W / 2, 214);

  ctx.fillStyle = "#0c9de6";
  ctx.font = "600 28px \"Poppins\", sans-serif";
  ctx.fillText("P L A C E H O L D E R   T E M P L A T E", W / 2, 330);

  ctx.fillStyle = "#122852";
  ctx.font = "800 78px \"Poppins\", sans-serif";
  ctx.fillText("BASIX Certificate", W / 2, 428);

  // Divider
  ctx.strokeStyle = "#2db8ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 160, 486);
  ctx.lineTo(W / 2 + 160, 486);
  ctx.stroke();

  ctx.fillStyle = "#5b657c";
  ctx.font = "400 27px \"Poppins\", sans-serif";
  ctx.fillText("The blank certificate image was not found.", W / 2, 548);
  ctx.fillText("Drop certificate-blank.png into public/assets/templates/", W / 2, 592);
  ctx.fillText("or upload it in Layout Settings → Template.", W / 2, 632);

  ctx.fillStyle = "#9aa3b5";
  ctx.font = "400 19px \"Poppins\", sans-serif";
  ctx.fillText("Rendering positions, fonts and PDF export work with this placeholder too,", W / 2, 764);
  ctx.fillText("so alignment can be verified before the real artwork is installed.", W / 2, 798);
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  layout: LayoutConfig,
  active: FieldKey | null,
): void {
  for (const key of FIELD_KEYS) {
    const f = layout.fields[key];
    const isActive = key === active;
    ctx.save();
    ctx.lineWidth = isActive ? 3 : 1.5;
    ctx.setLineDash(isActive ? [2, 0] : [7, 5]);
    ctx.strokeStyle = isActive ? "#2db8ff" : "rgba(226, 57, 84, 0.85)";
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.setLineDash([]);
    // Label chip
    ctx.font = "600 13px \"Poppins\", sans-serif";
    const label = FIELD_LABELS[key];
    const tw = ctx.measureText(label).width;
    const chipH = 20;
    const chipW = tw + 14;
    let chipY = f.y - chipH - 4;
    if (chipY < 0) chipY = f.y + f.h + 4;
    ctx.fillStyle = isActive ? "rgba(45, 184, 255, 0.95)" : "rgba(18, 40, 82, 0.9)";
    ctx.beginPath();
    ctx.roundRect(f.x, chipY, chipW, chipH, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, f.x + 7, chipY + chipH / 2);
    ctx.restore();
  }
}

export async function renderCertificate(
  rec: StudentRecord,
  layout: LayoutConfig,
  opts: RenderOptions = {},
): Promise<RenderResult> {
  const scale = Math.max(0.1, Math.min(4, opts.scale ?? 1));
  await ensureFontsReady(layout);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CANVAS_W * scale);
  canvas.height = Math.round(CANVAS_H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not supported by this browser.");
  ctx.scale(scale, scale);

  const blank = await getTemplateInfo("blank");
  if (blank.img) {
    ctx.drawImage(blank.img, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    drawPlaceholder(ctx);
  }

  if (opts.showReference) {
    const sample = await getTemplateInfo("sample");
    if (sample.img) {
      ctx.save();
      ctx.globalAlpha = opts.referenceOpacity ?? 0.45;
      ctx.drawImage(sample.img, 0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
    }
  }

  const fitted = {} as Record<FieldKey, number>;
  const warnings: string[] = [];

  for (const key of FIELD_KEYS) {
    const f = layout.fields[key];
    let text = (VALUE_OF[key](rec) ?? "").trim();
    if (!text) {
      fitted[key] = f.fontSize;
      continue;
    }
    if (f.uppercase) text = text.toUpperCase();

    const size = fitFontSize(ctx, text, f);
    fitted[key] = size;
    if (f.autoFit) {
      const m = measureWithSpacing(ctx, text, f, size);
      if (!m.fits && size <= f.minFontSize + 0.01) {
        warnings.push(
          `${FIELD_LABELS[key]} may overflow its box — “${text.length > 26 ? text.slice(0, 26) + "…" : text}” is too long even at the minimum size.`,
        );
      }
    }
    ctx.save();
    drawTrackedText(ctx, text, f, size);
    ctx.restore();
  }

  if (opts.showGuides) {
    drawGuides(ctx, layout, opts.activeField ?? null);
  }

  return { canvas, fitted, warnings, template: blank };
}

/** Force re-resolution (used after template replacement). */
export function refreshTemplateCache(): void {
  invalidateTemplate();
}
