import { idbDel, idbGet, idbKeysWithPrefix, idbSet } from "./idb";
import type { LayoutConfig } from "./types";
import { FIELD_KEYS } from "./layout";

/**
 * Font registry. Poppins, Great Vibes and Noto Serif Ethiopic are bundled
 * with the app (offline). Angeletta and Noto Serif Ethiopic Condensed are
 * licensed/commercial files — the user uploads them once and they persist.
 */

export interface FontRequirement {
  family: string;
  required: boolean;
  bundled: boolean;
  usedFor: string;
  note?: string;
}

export const FONT_REQUIREMENTS: FontRequirement[] = [
  {
    family: "Poppins",
    required: true,
    bundled: true,
    usedFor: "Student ID, completion date, duration",
  },
  {
    family: "Angeletta",
    required: true,
    bundled: false,
    usedFor: "Student name (script style)",
    note: "Licensed script font — upload Angeletta.ttf/.otf for an exact match.",
  },
  {
    family: "Noto Serif Ethiopic Condensed",
    required: true,
    bundled: false,
    usedFor: "Marks obtained value",
    note: "Upload the Condensed cut for an exact match; regular width is bundled.",
  },
  {
    family: "Great Vibes",
    required: false,
    bundled: true,
    usedFor: "Script fallback while Angeletta is missing",
  },
  {
    family: "Noto Serif Ethiopic",
    required: false,
    bundled: true,
    usedFor: "Serif fallback for the marks value",
  },
];

export interface CustomFont {
  key: string;
  family: string;
  fileName: string;
  size: number;
}

interface StoredFont {
  family: string;
  fileName: string;
  size: number;
  blob: Blob;
}

const GENERIC = new Set(["sans-serif", "serif", "cursive", "monospace", "system-ui"]);

/** First non-generic family in a CSS family stack, unquoted. */
export function firstFamily(stack: string): string {
  for (const part of stack.split(",")) {
    const fam = part.trim().replace(/^['"]|['"]$/g, "");
    if (fam && !GENERIC.has(fam.toLowerCase())) return fam;
  }
  return "";
}

let sessionLoaded = false;
const sessionFamilies = new Map<string, CustomFont>();

/** Load custom fonts persisted from earlier sessions. Call once at startup. */
export async function loadStoredCustomFonts(): Promise<CustomFont[]> {
  if (sessionLoaded) return [...sessionFamilies.values()];
  sessionLoaded = true;
  const keys = await idbKeysWithPrefix("font:");
  for (const key of keys) {
    try {
      const stored = await idbGet<StoredFont>(key);
      if (!stored?.blob) continue;
      const face = new FontFace(stored.family, await stored.blob.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      sessionFamilies.set(key, {
        key,
        family: stored.family,
        fileName: stored.fileName,
        size: stored.size,
      });
    } catch {
      /* a corrupt stored font should not break startup */
    }
  }
  return [...sessionFamilies.values()];
}

function titleCase(s: string): string {
  return s.replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

/** Derive the CSS family name a font file should be registered under. */
export function familyFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/i, "");
  const norm = base.toLowerCase().replace(/[^a-z]/g, "");
  if (norm.startsWith("angeletta")) return "Angeletta";
  if (norm.includes("notoserifethiopic") && norm.includes("condensed")) {
    return "Noto Serif Ethiopic Condensed";
  }
  if (norm.includes("notoserifethiopic")) return "Noto Serif Ethiopic";
  if (norm.includes("greatvibes")) return "Great Vibes";
  if (norm === "poppins" || norm.startsWith("poppins")) return "Poppins";
  return titleCase(base.replace(/[-_]+/g, " ").trim());
}

/** Register + persist a user-supplied font file. */
export async function addCustomFont(file: File): Promise<CustomFont> {
  const family = familyFromFileName(file.name);
  const buffer = await file.arrayBuffer();
  const face = new FontFace(family, buffer);
  await face.load();
  document.fonts.add(face);
  const key = `font:${family.toLowerCase()}`;
  const stored: StoredFont = { family, fileName: file.name, size: file.size, blob: file };
  await idbSet(key, stored);
  sessionFamilies.set(key, { key, family, fileName: file.name, size: file.size });
  return sessionFamilies.get(key)!;
}

export async function removeCustomFont(key: string): Promise<void> {
  sessionFamilies.delete(key);
  await idbDel(key);
  // Note: already-registered FontFaces stay in document.fonts for the
  // session (the FontFace API has no removal); a reload fully clears it.
}

export function listCustomFonts(): CustomFont[] {
  return [...sessionFamilies.values()];
}

export function fontLoaded(family: string, weight = 400): boolean {
  try {
    return document.fonts.check(`${weight} 16px "${family}"`);
  } catch {
    return false;
  }
}

export interface FontStatus {
  requirement: FontRequirement;
  loaded: boolean;
  /** Family that will actually paint if this one is missing */
  fallback: string;
}

export function auditFonts(): FontStatus[] {
  const fallbacks: Record<string, string> = {
    Angeletta: "Great Vibes",
    "Noto Serif Ethiopic Condensed": "Noto Serif Ethiopic",
    Poppins: "sans-serif",
  };
  return FONT_REQUIREMENTS.map((req) => ({
    requirement: req,
    loaded: fontLoaded(req.family),
    fallback: fallbacks[req.family] ?? "sans-serif",
  }));
}

/** Wait until every first-family used by the layout is actually measurable. */
export async function ensureFontsReady(layout: LayoutConfig): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const jobs: Promise<unknown>[] = [];
  for (const key of FIELD_KEYS) {
    const f = layout.fields[key];
    const fam = firstFamily(f.fontFamily);
    if (!fam) continue;
    jobs.push(
      document.fonts
        .load(`${f.italic ? "italic " : ""}${f.fontWeight} ${f.fontSize}px "${fam}"`, "BASIX-0129Ag")
        .catch(() => undefined),
    );
  }
  jobs.push(document.fonts.ready.catch(() => undefined));
  await Promise.all(jobs);
}
