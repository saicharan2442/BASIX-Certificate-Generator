import { idbDel, idbGet, idbSet } from "./idb";

/**
 * Certificate template resolution.
 *
 * Priority for the blank certificate background:
 *   1. A template uploaded in-app (persisted in IndexedDB).
 *   2. A file dropped into the app bundle at
 *      public/assets/templates/certificate-blank.(png|jpg|jpeg)
 *   3. "missing" — the renderer draws an explicit placeholder and every
 *      relevant screen shows a setup notice. We never silently substitute
 *      a different certificate artwork.
 *
 * The completed/sample certificate (certificate-sample.*) is optional and
 * only used as a visual reference overlay in the layout editor.
 */

export type TemplateKind = "blank" | "sample";

export interface TemplateInfo {
  kind: TemplateKind;
  source: "custom" | "bundled" | "missing";
  img: HTMLImageElement | null;
  path: string;
  width: number;
  height: number;
  aspectOk: boolean;
}

const CANDIDATES: Record<TemplateKind, string[]> = {
  blank: [
    "assets/templates/certificate-blank.png",
    "assets/templates/certificate-blank.jpg",
    "assets/templates/certificate-blank.jpeg",
  ],
  sample: [
    "assets/templates/certificate-sample.png",
    "assets/templates/certificate-sample.jpg",
    "assets/templates/certificate-sample.jpeg",
  ],
};

const IDB_KEYS: Record<TemplateKind, string> = {
  blank: "template:blank",
  sample: "template:sample",
};

function withBase(rel: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return base + rel;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

async function imageAtUrl(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\//i.test(type)) return null;
    return await loadImage(url);
  } catch {
    return null;
  }
}

/** Object URLs created for uploaded blobs, so we can revoke them. */
const objectUrls = new Map<TemplateKind, string>();
const cache = new Map<TemplateKind, TemplateInfo>();
const listeners = new Set<(kind: TemplateKind) => void>();

export function onTemplateChange(fn: (kind: TemplateKind) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(kind: TemplateKind): void {
  listeners.forEach((fn) => fn(kind));
}

export function invalidateTemplate(kind?: TemplateKind): void {
  if (kind) cache.delete(kind);
  else cache.clear();
}

export async function getTemplateInfo(kind: TemplateKind): Promise<TemplateInfo> {
  const cached = cache.get(kind);
  if (cached) return cached;

  // 1) Uploaded custom file
  try {
    const blob = await idbGet<Blob>(IDB_KEYS[kind]);
    if (blob && blob.size > 0) {
      let url = objectUrls.get(kind);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      objectUrls.set(kind, url);
      const img = await loadImage(url);
      const info = finish(kind, "custom", img, "Uploaded file");
      cache.set(kind, info);
      return info;
    }
  } catch {
    /* fall through to bundled */
  }

  // 2) Bundled file placed in public/assets/templates
  for (const rel of CANDIDATES[kind]) {
    const img = await imageAtUrl(withBase(rel));
    if (img) {
      const info = finish(kind, "bundled", img, rel);
      cache.set(kind, info);
      return info;
    }
  }

  // 3) Missing
  const info: TemplateInfo = {
    kind,
    source: "missing",
    img: null,
    path: CANDIDATES[kind][0],
    width: 0,
    height: 0,
    aspectOk: false,
  };
  cache.set(kind, info);
  return info;
}

function finish(
  kind: TemplateKind,
  source: "custom" | "bundled",
  img: HTMLImageElement,
  path: string,
): TemplateInfo {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ratio = w / h;
  return {
    kind,
    source,
    img,
    path,
    width: w,
    height: h,
    aspectOk: Math.abs(ratio - 1.5) < 0.01,
  };
}

/** Store a user-uploaded template (PNG/JPG). Throws if the file is not a valid image. */
export async function setCustomTemplate(kind: TemplateKind, file: File): Promise<TemplateInfo> {
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url);
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("That file could not be read as an image. Use a PNG or JPG.");
  } finally {
    URL.revokeObjectURL(url);
  }
  await idbSet(IDB_KEYS[kind], file);
  cache.delete(kind);
  const info = await getTemplateInfo(kind);
  notify(kind);
  return info;
}

export async function clearCustomTemplate(kind: TemplateKind): Promise<void> {
  await idbDel(IDB_KEYS[kind]);
  const url = objectUrls.get(kind);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(kind);
  cache.delete(kind);
  notify(kind);
}
