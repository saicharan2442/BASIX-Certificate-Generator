import type { FieldConfig, FieldKey, LayoutConfig } from "./types";

/** Reference canvas — the certificate artwork space. */
export const CANVAS_W = 1536;
export const CANVAS_H = 1024;

export const FIELD_KEYS: FieldKey[] = [
  "studentId",
  "studentName",
  "courseName",
  "marks",
  "date",
  "duration",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  studentId: "Student ID",
  studentName: "Student Name",
  courseName: "Course Name",
  marks: "Marks Obtained",
  date: "Completion Date",
  duration: "Duration",
};

const LAYOUT_KEY = "basix.layout.v2";
export const LAYOUT_VERSION = 2;

/**
 * Initial text-box positions from the BASIX certificate specification.
 * X/Y are top-left coordinates on the 1536×1024 canvas; text is
 * vertically centred inside each box by default.
 */
export function defaultLayout(): LayoutConfig {
  return {
    version: LAYOUT_VERSION,
    fields: {
      studentId: {
        x: 1223.5,
        y: 189.5,
        w: 239,
        h: 21,
        fontFamily: '"Poppins", sans-serif',
        fontSize: 16,
        fontWeight: 500,
        italic: false,
        color: "#22314f",
        align: "left",
        valign: "middle",
        letterSpacing: 0.5,
        uppercase: false,
        autoFit: true,
        minFontSize: 11,
      },
      studentName: {
        x: 326.3,
        y: 454.2,
        w: 916.7,
        h: 96.1,
        fontFamily: '"Angeletta", "Great Vibes", "Segoe Script", cursive',
        fontSize: 72,
        fontWeight: 400,
        italic: false,
        color: "#14294f",
        align: "center",
        valign: "middle",
        letterSpacing: 0,
        uppercase: false,
        autoFit: true,
        minFontSize: 30,
      },
      // Course name has no published box in the spec; this default is
      // centred in the typical course line area and is fully editable.
      courseName: {
        x: 441.7,
        y: 622.5,
        w: 652.6,
        h: 26,
        fontFamily: '"Poppins", sans-serif',
        fontSize: 19,
        fontWeight: 600,
        italic: false,
        color: "#8a6d1a",
        align: "center",
        valign: "middle",
        letterSpacing: 2.5,
        uppercase: true,
        autoFit: true,
        minFontSize: 11,
      },
      marks: {
        x: 1319.9,
        y: 582.2,
        w: 101.5,
        h: 33.1,
        fontFamily:
          '"Noto Serif Ethiopic Condensed", "Noto Serif Ethiopic", "Noto Serif", serif',
        fontSize: 24,
        fontWeight: 600,
        italic: false,
        color: "#22314f",
        align: "center",
        valign: "middle",
        letterSpacing: 0,
        uppercase: false,
        autoFit: true,
        minFontSize: 13,
      },
      date: {
        x: 691.7,
        y: 717,
        w: 148.7,
        h: 21,
        fontFamily: '"Poppins", sans-serif',
        fontSize: 16,
        fontWeight: 500,
        italic: false,
        color: "#22314f",
        align: "left",
        valign: "middle",
        letterSpacing: 0.5,
        uppercase: false,
        autoFit: true,
        minFontSize: 11,
      },
      duration: {
        x: 677.3,
        y: 776.2,
        w: 175.8,
        h: 21,
        fontFamily: '"Poppins", sans-serif',
        fontSize: 16,
        fontWeight: 500,
        italic: false,
        color: "#22314f",
        align: "left",
        valign: "middle",
        letterSpacing: 0.5,
        uppercase: false,
        autoFit: true,
        minFontSize: 11,
      },
    },
  };
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Merge a partial stored layout over the defaults (forward compatible). */
export function normalizeLayout(input: unknown): LayoutConfig {
  const base = defaultLayout();
  if (!input || typeof input !== "object") return base;
  const fields = (input as { fields?: Record<string, Partial<FieldConfig>> }).fields;
  if (!fields || typeof fields !== "object") return base;
  for (const key of FIELD_KEYS) {
    const src = fields[key];
    if (!src || typeof src !== "object") continue;
    const dst = base.fields[key];
    if (isNum(src.x)) dst.x = src.x;
    if (isNum(src.y)) dst.y = src.y;
    if (isNum(src.w) && src.w > 0) dst.w = src.w;
    if (isNum(src.h) && src.h > 0) dst.h = src.h;
    if (typeof src.fontFamily === "string" && src.fontFamily.trim()) dst.fontFamily = src.fontFamily;
    if (isNum(src.fontSize) && src.fontSize > 0) dst.fontSize = src.fontSize;
    if (isNum(src.fontWeight)) dst.fontWeight = src.fontWeight;
    if (typeof src.italic === "boolean") dst.italic = src.italic;
    if (typeof src.color === "string" && src.color.trim()) dst.color = src.color;
    if (src.align === "left" || src.align === "center" || src.align === "right") dst.align = src.align;
    if (src.valign === "top" || src.valign === "middle" || src.valign === "bottom") dst.valign = src.valign;
    if (isNum(src.letterSpacing)) dst.letterSpacing = src.letterSpacing;
    if (typeof src.uppercase === "boolean") dst.uppercase = src.uppercase;
    if (typeof src.autoFit === "boolean") dst.autoFit = src.autoFit;
    if (isNum(src.minFontSize) && src.minFontSize > 0) dst.minFontSize = src.minFontSize;
  }
  return base;
}

export function loadLayout(): LayoutConfig {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaultLayout();
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(layout: LayoutConfig): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* storage full / private mode — settings simply won't persist */
  }
}

export function resetLayout(): LayoutConfig {
  const d = defaultLayout();
  saveLayout(d);
  return d;
}

export function exportLayoutJson(layout: LayoutConfig): string {
  return JSON.stringify(layout, null, 2);
}

export function importLayoutJson(text: string): LayoutConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const layout = normalizeLayout(parsed);
  // Reject files that clearly are not layout configs.
  const src = (parsed as { fields?: object } | null)?.fields;
  if (!src) {
    throw new Error("This JSON does not contain certificate field settings.");
  }
  return layout;
}
