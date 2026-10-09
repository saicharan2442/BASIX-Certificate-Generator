import * as XLSX from "xlsx";
import type { FieldKey } from "./types";

/**
 * Excel (xlsx/xls) import: workbook parsing, header detection,
 * column auto-mapping and a ready-made sample file.
 */

export interface SheetData {
  name: string;
  headers: string[];
  /** Index of the header row inside the raw grid */
  headerRow: number;
  /** Trimmed string cells, rows with at least one non-empty cell */
  rows: string[][];
  totalCells: number;
}

export interface WorkbookData {
  fileName: string;
  sheets: SheetData[];
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/ /g, " ").trim();
}

function parseSheet(ws: XLSX.WorkSheet, name: string): SheetData | null {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    // Typed Excel dates render in the canonical certificate format,
    // typed percentages render as "92.5%".
    dateNF: "dd mmm yyyy",
  });
  const grid = aoa.map((row) => row.map(cellToString));
  const nonEmptyCount = (r: string[]) => r.filter((c) => c !== "").length;

  let headerRow = -1;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    if (nonEmptyCount(grid[i]) >= 2) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return null;

  const headers = grid[headerRow].map((h, i) => h || `Column ${i + 1}`);
  const rows = grid.slice(headerRow + 1).filter((r) => nonEmptyCount(r) > 0);
  // Normalise row lengths
  const width = headers.length;
  const fixed = rows.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
  return { name, headers, headerRow, rows: fixed, totalCells: grid.flat().filter((c) => c !== "").length };
}

export async function readWorkbook(file: File): Promise<WorkbookData> {
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    throw new Error("This file could not be opened — is it a valid Excel workbook (.xlsx / .xls)?");
  }
  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    const parsed = parseSheet(wb.Sheets[name], name);
    if (parsed) sheets.push(parsed);
  }
  if (!sheets.length) {
    throw new Error("No worksheet with a header row and data was found in this file.");
  }
  return { fileName: file.name, sheets };
}

const SYNONYMS: Record<FieldKey, string[]> = {
  studentId: [
    "studentid", "student id", "id", "stdid", "std id", "rollno", "roll no",
    "rollnumber", "enrollment", "enrolment", "enrollmentno", "regno", "reg no",
    "admissionno", "admission no", "candidateid", "certificateid", "certificate no",
    "certificateno", "serialno", "slno",
  ],
  studentName: [
    "studentname", "student name", "name", "fullname", "full name",
    "candidatename", "candidate name", "student",
  ],
  courseName: [
    "coursename", "course name", "course", "course title", "program",
    "programme", "programname", "module", "subject", "training",
  ],
  marks: [
    "marks", "marksobtained", "marks obtained", "score", "percentage",
    "percent", "mark", "grade", "result", "obtainedmarks", "marks (%)",
    "marks%", "obtained",
  ],
  date: [
    "date", "completiondate", "completion date", "date of completion",
    "completedon", "completed on", "issuedate", "issue date", "issued",
    "certificationdate", "passingdate", "finishdate",
  ],
  duration: [
    "duration", "courseduration", "course duration", "length", "period",
    "span", "months", "days", "hours", "time",
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%() ]/g, " ").replace(/\s+/g, " ").trim();
const squash = (s: string) => norm(s).replace(/ /g, "");

/** Best-effort automatic column mapping, returned as field → column index. */
export function autoMapColumns(headers: string[]): Partial<Record<FieldKey, number>> {
  const result: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  const normHeaders = headers.map(norm);
  const squashHeaders = headers.map(squash);

  (Object.keys(SYNONYMS) as FieldKey[]).forEach((field) => {
    const syns = SYNONYMS[field];
    // Pass 1: exact matches (normalised or squashed)
    for (const syn of syns) {
      const idx = normHeaders.findIndex(
        (h, i) => !used.has(i) && (h === norm(syn) || squashHeaders[i] === squash(syn)),
      );
      if (idx !== -1) {
        result[field] = idx;
        used.add(idx);
        return;
      }
    }
    // Pass 2: header starts-with / contains the synonym
    for (const syn of syns) {
      const s = squash(syn);
      if (s.length < 3) continue;
      const idx = squashHeaders.findIndex(
        (h, i) => !used.has(i) && (h.startsWith(s) || h.includes(s)),
      );
      if (idx !== -1) {
        result[field] = idx;
        used.add(idx);
        return;
      }
    }
  });
  return result;
}

/** Sample workbook — 8 valid students + 5 rows that demo each validation failure. */
export function buildSampleWorkbook(): Blob {
  const header = ["Student ID", "Student Name", "Course Name", "Marks Obtained", "Completion Date", "Duration"];
  const rows = [
    ["BASIX-2001", "Aisha Rahman", "Diploma in Computer Applications", "92.5%", "07 Oct 2025", "3 Months"],
    ["BASIX-2002", "Ravi Kumar", "Basic Computer Course", "88%", "07/10/2025", "30 Days"],
    ["BASIX-2003", "Fatima Noor", "Advanced Excel & Data Entry", "76.25%", "2025-10-07", "60 Hours"],
    ["BASIX-2004", "Joseph Mathew", "Tally ERP with GST", "81%", "9 October 2025", "6 Weeks"],
    ["BASIX-2005", "Priya Sharma", "Diploma in Computer Applications", "95.5%", "10 Oct 2025", "3 Months"],
    ["BASIX-2006", "Arun Patel", "Web Design Fundamentals", "67%", "11-10-2025", "45 Days"],
    ["BASIX-2007", "Meera Iyer", "Office Automation", "90%", "12 Oct 2025", "2 Months"],
    ["BASIX-2008", "Mohammed Abdullah Rahman Chowdhury", "Diploma in Computer Applications", "84.5%", "12 Oct 2025", "3 Months"],
    // —— the rows below intentionally fail validation, for training ——
    ["", "Name Missing ID", "Basic Computer Course", "90%", "12 Oct 2025", "30 Days"],
    ["BASIX-2009", "", "Tally ERP with GST", "90%", "12 Oct 2025", "30 Days"],
    ["BASIX-2010", "Bad Marks Example", "Office Automation", "104%", "12 Oct 2025", "30 Days"],
    ["BASIX-2011", "Bad Date Example", "Web Design Fundamentals", "71%", "yesterday", "30 Days"],
    ["BASIX-2001", "Duplicate ID Example", "Advanced Excel & Data Entry", "66%", "13 Oct 2025", "60 Hours"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 34 }, { wch: 15 }, { wch: 16 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
