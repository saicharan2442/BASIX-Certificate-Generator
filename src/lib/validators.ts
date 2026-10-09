import type { FieldKey, StudentRecord } from "./types";

/**
 * Validation + normalisation for the six certificate fields.
 * Each rule returns either `{ ok: true, value }` (possibly reformatted)
 * or `{ ok: false, message }` with a receptionist-friendly explanation.
 */

export type RuleResult = { ok: true; value: string } | { ok: false; message: string };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Canonical date rendering used on certificates, e.g. 07 Oct 2025. */
export function formatCertDate(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function realDate(year: number, month0: number, day: number): Date | null {
  if (month0 < 0 || month0 > 11) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month0, day);
  if (d.getFullYear() !== year || d.getMonth() !== month0 || d.getDate() !== day) return null;
  return d;
}

function fullYear(y: number): number {
  if (y < 100) return y <= 49 ? 2000 + y : 1900 + y;
  return y;
}

/**
 * Parse a date in any of the accepted formats:
 *   07 Oct 2025 · 7 October 2025 · 07/10/2025 · 07-10-2025 · 07.10.25
 *   2025-10-07 · Oct 07, 2025
 * Numeric D/M order is day-first (`DD/MM/YYYY`), the institute's convention.
 */
export function parseCertDate(raw: string): Date | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return realDate(+m[1], +m[2] - 1, +m[3]);

  m = /^(\d{1,2})[\s.\/-]*([A-Za-z]{3,9})[\s.,\/-]*(\d{2,4})$/.exec(s);
  if (m && m[2].toLowerCase() in MONTH_INDEX) {
    return realDate(fullYear(+m[3]), MONTH_INDEX[m[2].toLowerCase()], +m[1]);
  }

  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(s);
  if (m && m[1].toLowerCase() in MONTH_INDEX) {
    return realDate(fullYear(+m[3]), MONTH_INDEX[m[1].toLowerCase()], +m[2]);
  }

  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(s);
  if (m) return realDate(fullYear(+m[3]), +m[2] - 1, +m[1]);

  return null;
}

function trimZeros(numeric: string): string {
  if (!numeric.includes(".")) return numeric;
  return numeric.replace(/\.?0+$/, "");
}

export const RULES: Record<
  FieldKey,
  (raw: string) => RuleResult
> = {
  studentId(raw) {
    const v = raw.trim();
    if (!v) return { ok: false, message: "Student ID is required." };
    if (v.length > 40) return { ok: false, message: "Student ID is longer than 40 characters." };
    return { ok: true, value: v };
  },
  studentName(raw) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) return { ok: false, message: "Student name is required." };
    if (v.length < 2) return { ok: false, message: "Student name looks too short." };
    if (v.length > 70) return { ok: false, message: "Student name is longer than 70 characters." };
    return { ok: true, value: v };
  },
  courseName(raw) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) return { ok: false, message: "Course name is required." };
    return { ok: true, value: v };
  },
  /** Accepts 92 · 92% · 92.5% — reformatted to a consistent n% style. */
  marks(raw) {
    const v = raw.trim();
    if (!v) return { ok: false, message: "Marks are required." };
    const m = /^(\d+(?:\.\d{1,2})?)\s*%?$/.exec(v);
    if (!m) return { ok: false, message: `Marks "${v}" is not a percentage like 92% or 92.5%.` };
    const n = Number(m[1]);
    if (n > 100) return { ok: false, message: `Marks ${m[1]}% is above 100%.` };
    return { ok: true, value: `${trimZeros(m[1])}%` };
  },
  date(raw) {
    const v = raw.trim();
    if (!v) return { ok: false, message: "Completion date is required." };
    const d = parseCertDate(v);
    if (!d) {
      return { ok: false, message: `Date "${v}" is not recognised — use a format like 07 Oct 2025.` };
    }
    if (d.getFullYear() < 1990 || d.getFullYear() > 2100) {
      return { ok: false, message: `Date year ${d.getFullYear()} looks wrong.` };
    }
    return { ok: true, value: formatCertDate(d) };
  },
  /** Accepts 30 Days · 3 Months · 60 Hours (and weeks/years), normalised to Title case. */
  duration(raw) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) return { ok: false, message: "Duration is required." };
    const m = /^(\d+(?:\.\d+)?)\s*(hours?|hrs?|days?|weeks?|months?|years?)$/i.exec(v);
    if (!m) {
      return { ok: false, message: `Duration "${v}" is not recognised — use e.g. 30 Days, 3 Months or 60 Hours.` };
    }
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    let word: string = unit;
    if (/^hrs?$/.test(unit)) word = n === 1 ? "hour" : "hours";
    return { ok: true, value: `${trimZeros(m[1])} ${word[0].toUpperCase()}${word.slice(1)}` };
  },
};

/** Validate & normalise one record. Returns the issues map plus cleaned data. */
export function validateRecord(rec: StudentRecord): {
  issues: Partial<Record<FieldKey, string>>;
  cleaned: StudentRecord;
  valid: boolean;
} {
  const issues: Partial<Record<FieldKey, string>> = {};
  const cleaned = { ...rec };
  (Object.keys(RULES) as FieldKey[]).forEach((key) => {
    const r = RULES[key](rec[key] ?? "");
    if (r.ok) cleaned[key] = r.value;
    else issues[key] = r.message;
  });
  return { issues, cleaned, valid: Object.keys(issues).length === 0 };
}

/** Finds duplicate Student IDs (case-insensitive, trimmed). */
export function markDuplicateIds<T extends { data: StudentRecord; duplicateKey: boolean }>(
  rows: T[],
): void {
  const firstSeen = new Map<string, number>();
  rows.forEach((row) => {
    const id = row.data.studentId.trim().toLowerCase();
    row.duplicateKey = false;
    if (!id) return;
    if (firstSeen.has(id)) {
      row.duplicateKey = true;
      rows[firstSeen.get(id)!].duplicateKey = true;
    } else {
      firstSeen.set(id, rows.indexOf(row));
    }
  });
}

/** Index of the first other row sharing the same ID (for messages), or -1. */
export function duplicatePartner<T extends { data: StudentRecord }>(
  rows: T[],
  at: number,
): number {
  const id = rows[at].data.studentId.trim().toLowerCase();
  if (!id) return -1;
  for (let i = 0; i < rows.length; i++) {
    if (i !== at && rows[i].data.studentId.trim().toLowerCase() === id) return i;
  }
  return -1;
}
