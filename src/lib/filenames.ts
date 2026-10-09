/** Windows-safe file naming for PDFs, ZIPs and reports. */

// NOTE: the control-character range is built with fromCharCode so the
// source file contains no literal control bytes.
const CONTROL_CHARS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + "]",
  "g",
);
const ILLEGAL = /[<>:"/\\|?*]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Make a single name segment safe for Windows (and sane everywhere). */
export function sanitizePart(raw: string, maxLen = 60): string {
  let s = (raw ?? "")
    .normalize("NFKC")
    .replace(ILLEGAL, "-")
    .replace(CONTROL_CHARS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, ""); // Windows forbids trailing dots/spaces
  s = s.replace(/ /g, "_");
  if (!s) s = "UNKNOWN";
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/[_-]+$/g, "");
  if (WINDOWS_RESERVED.test(s)) s = `_${s}`;
  return s;
}

/** BASIX_Certificate_<ID>_<Name>.pdf */
export function certificateFileName(studentId: string, studentName: string): string {
  return `BASIX_Certificate_${sanitizePart(studentId)}_${sanitizePart(studentName)}.pdf`;
}

function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return [name, ""];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Ensure the name does not collide with `taken` (case-insensitive).
 * Appends _2, _3 … before the extension and registers the result.
 */
export function uniqueName(name: string, taken: Set<string>): string {
  const [base, ext] = splitExt(name);
  let candidate = name;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}_${n}${ext}`;
    n += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** BASIX_Certificates_2026-10-09.zip */
export function zipFileName(d = new Date()): string {
  return `BASIX_Certificates_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.zip`;
}

export function reportFileName(d = new Date()): string {
  return `BASIX_Report_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}.csv`;
}
