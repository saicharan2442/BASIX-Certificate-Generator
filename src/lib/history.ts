import type { ExportRecord } from "./types";

/** Recent-export history, persisted in localStorage (metadata only). */

const KEY = "basix.history.v1";
const MAX_ENTRIES = 50;

export function loadHistory(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ExportRecord =>
        r && typeof r === "object" && typeof r.fileName === "string" && typeof r.at === "string",
    );
  } catch {
    return [];
  }
}

export function addHistory(entry: Omit<ExportRecord, "id" | "at">): ExportRecord {
  const record: ExportRecord = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const list = [record, ...loadHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
  return record;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Lifetime aggregated stats for the dashboard. */
export function historyStats(list: ExportRecord[]): {
  exports: number;
  certificates: number;
  successRate: number;
} {
  const certificates = list.reduce((n, r) => n + r.succeeded, 0);
  const attempted = list.reduce((n, r) => n + Math.max(r.total, r.succeeded), 0);
  return {
    exports: list.length,
    certificates,
    successRate: attempted > 0 ? Math.round((certificates / attempted) * 100) : 100,
  };
}
