/** Shared domain types for the BASIX Certificate Generator. */

export type FieldKey =
  | "studentId"
  | "studentName"
  | "courseName"
  | "marks"
  | "date"
  | "duration";

export interface StudentRecord {
  studentId: string;
  studentName: string;
  courseName: string;
  marks: string;
  date: string;
  duration: string;
}

export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";

export interface FieldConfig {
  /** Top-left X on the 1536×1024 canvas */
  x: number;
  /** Top-left Y on the 1536×1024 canvas */
  y: number;
  /** Box width (px at 1536×1024) */
  w: number;
  /** Box height (px at 1536×1024) */
  h: number;
  /** CSS font-family stack, e.g. '"Poppins", sans-serif' */
  fontFamily: string;
  /** Font size in px at 1536×1024 */
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: HAlign;
  valign: VAlign;
  letterSpacing: number;
  uppercase: boolean;
  /** Shrink text until it fits the box (down to minFontSize) */
  autoFit: boolean;
  minFontSize: number;
}

export interface LayoutConfig {
  version: number;
  fields: Record<FieldKey, FieldConfig>;
}

/** Validation state for one imported Excel row. */
export interface BulkRow {
  /** 1-based data row number as shown in the sheet (data rows start at 1). */
  index: number;
  data: StudentRecord;
  /** field -> human readable issue message */
  issues: Partial<Record<FieldKey, string>>;
  skipped: boolean;
  duplicateKey: boolean;
}

export interface GeneratedPdf {
  rowIndex: number;
  data: StudentRecord;
  fileName: string;
  blob: Blob;
  warnings: string[];
}

export interface FailedRecord {
  rowIndex: number;
  data: StudentRecord;
  error: string;
}

export interface SkippedRecord {
  rowIndex: number;
  data: StudentRecord;
  reasons: string[];
}

export interface BatchResult {
  succeeded: GeneratedPdf[];
  failed: FailedRecord[];
  skipped: SkippedRecord[];
}

export interface ExportRecord {
  id: string;
  kind: "bulk" | "individual";
  /** ISO timestamp */
  at: string;
  fileName: string;
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  destination: "download" | "folder";
}

export const emptyRecord = (): StudentRecord => ({
  studentId: "",
  studentName: "",
  courseName: "",
  marks: "",
  date: "",
  duration: "",
});

export const SAMPLE_RECORD: StudentRecord = {
  studentId: "BASIX-2025-1042",
  studentName: "Aisha Rahman",
  courseName: "Diploma in Computer Applications",
  marks: "92.5%",
  date: "07 Oct 2025",
  duration: "3 Months",
};

export const LONG_NAME_RECORD: StudentRecord = {
  studentId: "BASIX-2025-1187",
  studentName: "Muhammad Abdullah Rahman Chowdhury",
  courseName: "Advanced Excel and Data Management",
  marks: "97%",
  date: "09 Oct 2026",
  duration: "60 Hours",
};
