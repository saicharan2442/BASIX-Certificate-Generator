import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronRight,
  Columns3, Eye, FileDown, FileSpreadsheet, FileText, FolderDown, ListChecks,
  Pencil, Play, RotateCcw, Search, SkipForward, Table2, Upload, Users, XCircle,
} from "lucide-react";
import { Alert, Badge, Button, Card, Field, Modal, ProgressBar, SectionHeader, SelectInput, TextInput, Toggle } from "../components/ui";
import { CertificatePreview } from "../components/CertificatePreview";
import { useToast } from "../components/Toast";
import { useApp } from "../state/app";
import type { BatchResult, BulkRow, FieldKey, StudentRecord } from "../lib/types";
import { FIELD_KEYS, FIELD_LABELS } from "../lib/layout";
import { autoMapColumns, buildSampleWorkbook, readWorkbook, type WorkbookData } from "../lib/excelImport";
import { duplicatePartner, markDuplicateIds, validateRecord } from "../lib/validators";
import { DEFAULT_QUALITY, generateCertificatePdf, type PdfQuality } from "../lib/pdf";
import { buildCertificatesZip, downloadBlob, toCsv } from "../lib/zip";
import { certificateFileName, reportFileName, uniqueName, zipFileName } from "../lib/filenames";
import { addHistory } from "../lib/history";
import { folderPickerSupported, getStoredOutputFolder, pickOutputFolder, saveBlobToFolder } from "../lib/fsAccess";
import { cn } from "../utils/cn";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_META = [
  { n: 1, label: "Excel file", icon: FileSpreadsheet },
  { n: 2, label: "Map columns", icon: Columns3 },
  { n: 3, label: "Validate rows", icon: ListChecks },
  { n: 4, label: "Generate", icon: Play },
  { n: 5, label: "Report & ZIP", icon: Archive },
];

const PAGE_SIZE = 12;

function rowIsValid(r: BulkRow): boolean {
  return !r.duplicateKey && Object.keys(r.issues).length === 0;
}

export function BulkScreen() {
  const { layout, assetsVersion } = useApp();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [wb, setWb] = useState<WorkbookData | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [defaultCourse, setDefaultCourse] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [quality, setQuality] = useState<PdfQuality>(DEFAULT_QUALITY);
  const [writeFolder, setWriteFolder] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<BatchResult | null>(null);
  const cancelRef = useRef(false);

  const sheet = wb?.sheets[sheetIdx] ?? null;

  /* ------------------------------ file intake ----------------------------- */

  const openFile = useCallback(
    async (file: File) => {
      if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
        toast.error("Not an Excel file", "Please choose a .xlsx or .xls workbook.");
        return;
      }
      try {
        const data = await readWorkbook(file);
        setWb(data);
        setSheetIdx(0);
        setRows([]);
        setResult(null);
        setStep(data.sheets.length === 1 ? 2 : 1);
        if (data.sheets.length === 1) {
          setMapping(autoMapColumns(data.sheets[0].headers));
        } else {
          toast.info("Multiple worksheets found", `Choose which sheet contains the student list.`);
        }
      } catch (err) {
        toast.error("Could not read the Excel file", err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const chooseSheet = (i: number) => {
    setSheetIdx(i);
    setMapping(autoMapColumns(wb!.sheets[i].headers));
    setStep(2);
  };

  /* ------------------------------- build rows ------------------------------ */

  const buildRows = useCallback((): BulkRow[] => {
    if (!sheet) return [];
    const built: BulkRow[] = sheet.rows.map((cells, i) => {
      const get = (k: FieldKey) => {
        const col = mapping[k];
        return col === undefined ? "" : (cells[col] ?? "").trim();
      };
      let course = get("courseName");
      if (!course && defaultCourse.trim()) course = defaultCourse.trim();
      const raw: StudentRecord = {
        studentId: get("studentId"),
        studentName: get("studentName"),
        courseName: course,
        marks: get("marks"),
        date: get("date"),
        duration: get("duration"),
      };
      const { issues, cleaned } = validateRecord(raw);
      return { index: i + 1, data: cleaned, issues, skipped: false, duplicateKey: false };
    });
    markDuplicateIds(built);
    built.forEach((r) => {
      if (r.duplicateKey) {
        const partner = duplicatePartner(built, built.indexOf(r));
        r.issues = { ...r.issues, studentId: `Duplicate Student ID — also on row #${partner + 1}.` };
      }
    });
    return built;
  }, [sheet, mapping, defaultCourse]);

  const goValidate = () => {
    if (mapping.studentId === undefined || mapping.studentName === undefined) {
      toast.error("Map the required columns", "Student ID and Student Name must be mapped to Excel columns.");
      return;
    }
    if (mapping.courseName === undefined && !defaultCourse.trim()) {
      toast.error("Course missing", "Map a Course column or type a default course name applied to every row.");
      return;
    }
    const built = buildRows();
    setRows(built);
    setFilter("all");
    setQuery("");
    setPage(0);
    setStep(3);
    const broken = built.filter((r) => !rowIsValid(r)).length;
    if (broken) {
      toast.warning(`${broken} row${broken === 1 ? "" : "s"} need attention`, "Fix them in place or skip them — nothing is generated silently.");
    } else {
      toast.success("All rows look valid", `${built.length} certificates are ready to generate.`);
    }
  };

  /* ------------------------------- row editing ----------------------------- */

  const updateRow = (idx: number, data: StudentRecord) => {
    setRows((prev) => {
      const next = prev.map((r, i) => {
        if (i !== idx) return r;
        const { issues, cleaned } = validateRecord(data);
        return { ...r, data: cleaned, issues };
      });
      markDuplicateIds(next);
      next.forEach((r) => {
        if (r.duplicateKey) {
          const partner = duplicatePartner(next, next.indexOf(r));
          r.issues = { ...r.issues, studentId: `Duplicate Student ID — also on row #${partner + 1}.` };
        } else {
          // Fresh, authoritative re-validation (clears a stale duplicate flag).
          const re = validateRecord(r.data);
          r.issues = re.issues;
        }
      });
      return next;
    });
  };

  const toggleSkip = (idx: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, skipped: !r.skipped } : r)));

  /* -------------------------------- stats ---------------------------------- */

  const stats = useMemo(() => {
    const ready = rows.filter((r) => rowIsValid(r) && !r.skipped).length;
    const needsFix = rows.filter((r) => !rowIsValid(r) && !r.skipped).length;
    const skipped = rows.filter((r) => r.skipped).length;
    return { ready, needsFix, skipped, total: rows.length };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (filter === "issues") list = list.filter((r) => !rowIsValid(r));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.data.studentId.toLowerCase().includes(q) ||
          r.data.studentName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, query]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visibleRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  /* ------------------------------ generation ------------------------------- */

  const pushLog = (line: string) =>
    setLog((prev) => [...prev.slice(-7), line]);

  const runGeneration = async () => {
    const targets = rows.filter((r) => rowIsValid(r) && !r.skipped);
    if (!targets.length) return;

    let dir: FileSystemDirectoryHandle | null = null;
    if (writeFolder) {
      dir = await getStoredOutputFolder();
      if (!dir) dir = await pickOutputFolder();
      if (!dir) {
        toast.warning("No output folder selected", "Certificates will only be collected into the ZIP instead.");
      }
    }

    setRunning(true);
    cancelRef.current = false;
    setProgress({ done: 0, total: targets.length, current: "" });
    setLog([]);

    const batch: BatchResult = { succeeded: [], failed: [], skipped: [] };
    rows
      .filter((r) => r.skipped || !rowIsValid(r))
      .forEach((r) =>
        batch.skipped.push({
          rowIndex: r.index,
          data: r.data,
          reasons: r.skipped
            ? Object.keys(r.issues).length || r.duplicateKey
              ? Object.values(r.issues)
              : ["Skipped by operator"]
            : Object.values(r.issues),
        }),
      );

    const taken = new Set<string>();
    let done = 0;

    for (const row of targets) {
      if (cancelRef.current) {
        batch.skipped.push({ rowIndex: row.index, data: row.data, reasons: ["Batch cancelled by operator"] });
        done += 1;
        setProgress({ done, total: targets.length, current: "" });
        continue;
      }
      try {
        const gen = await generateCertificatePdf(row.data, layout, quality);
        const name = uniqueName(gen.fileName, taken);
        let finalName = name;
        if (dir) {
          try {
            finalName = await saveBlobToFolder(dir, name, gen.blob);
          } catch (err) {
            toast.warning("Could not write into the folder", err instanceof Error ? err.message : String(err));
            dir = null;
          }
        }
        batch.succeeded.push({ rowIndex: row.index, data: row.data, fileName: finalName, blob: gen.blob, warnings: gen.warnings });
        pushLog(`✓ ${finalName}`);
      } catch (err) {
        batch.failed.push({ rowIndex: row.index, data: row.data, error: err instanceof Error ? err.message : String(err) });
        pushLog(`✗ ${row.data.studentName || row.data.studentId} — failed`);
      }
      done += 1;
      setProgress({ done, total: targets.length, current: row.data.studentName });
      await new Promise((r) => setTimeout(r, 0)); // keep the UI fluid
    }

    setResult(batch);
    setRunning(false);
    setStep(5);

    const zip = zipFileName();
    addHistory({
      kind: "bulk",
      fileName: zip,
      total: targets.length,
      succeeded: batch.succeeded.length,
      skipped: batch.skipped.length,
      failed: batch.failed.length,
      destination: dir ? "folder" : "download",
    });
  };

  const downloadZip = async () => {
    if (!result) return;
    try {
      const zipBlob = await buildCertificatesZip(
        result.succeeded.map((s) => ({ name: s.fileName, blob: s.blob })),
      );
      downloadBlob(zipBlob, zipFileName());
      toast.success("ZIP downloaded", `${result.succeeded.length} certificates in ${zipFileName()}.`);
    } catch (err) {
      toast.error("ZIP failed", err instanceof Error ? err.message : String(err));
    }
  };

  const saveZipToFolder = async () => {
    if (!result) return;
    let dir = await getStoredOutputFolder();
    if (!dir) dir = await pickOutputFolder();
    if (!dir) return;
    try {
      const zipBlob = await buildCertificatesZip(
        result.succeeded.map((s) => ({ name: s.fileName, blob: s.blob })),
      );
      const name = await saveBlobToFolder(dir, zipFileName(), zipBlob);
      toast.success("ZIP saved to folder", `${name} → ${dir.name}`);
    } catch (err) {
      toast.error("Could not save ZIP", err instanceof Error ? err.message : String(err));
    }
  };

  const downloadCsvReport = () => {
    if (!result) return;
    const head = ["Row", "Student ID", "Student Name", "Course", "Marks", "Date", "Duration", "Status", "File / Reason"];
    const lines: string[][] = [head];
    result.succeeded.forEach((s) =>
      lines.push([String(s.rowIndex), s.data.studentId, s.data.studentName, s.data.courseName, s.data.marks, s.data.date, s.data.duration, "Generated", s.fileName]));
    result.skipped.forEach((s) =>
      lines.push([String(s.rowIndex), s.data.studentId, s.data.studentName, s.data.courseName, s.data.marks, s.data.date, s.data.duration, "Skipped", s.reasons.join(" | ")]));
    result.failed.forEach((f) =>
      lines.push([String(f.rowIndex), f.data.studentId, f.data.studentName, f.data.courseName, f.data.marks, f.data.date, f.data.duration, "Failed", f.error]));
    downloadBlob(new Blob([toCsv(lines)], { type: "text/csv;charset=utf-8" }), reportFileName());
  };

  const resetBatch = () => {
    setWb(null);
    setSheetIdx(0);
    setMapping({});
    setDefaultCourse("");
    setRows([]);
    setResult(null);
    setLog([]);
    setProgress({ done: 0, total: 0, current: "" });
    setStep(1);
  };

  /* -------------------------------- render --------------------------------- */

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Mode A"
        title="Bulk Certificate Generation"
        description="Import one Excel worksheet, verify every student row, then produce all PDFs plus a single ZIP archive."
        actions={
          step > 1 && !running ? (
            <Button variant="ghost" icon={RotateCcw} onClick={resetBatch}>
              Start new batch
            </Button>
          ) : undefined
        }
      />

      {/* stepper */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-navy-100 bg-white p-2 shadow-sm">
        {STEP_META.map(({ n, label, icon: Icon }, i) => {
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="flex min-w-0 flex-1 items-center">
              <div
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors",
                  active && "bg-navy-700 text-white shadow",
                  done && "text-emerald-700",
                  !done && !active && "text-navy-400",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    active && "bg-gold-500 text-navy-900",
                    done && "bg-emerald-100",
                    !done && !active && "bg-navy-100",
                  )}
                >
                  {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" strokeWidth={2.2} />}
                </span>
                <span className="hidden truncate text-[12.5px] font-semibold md:block">
                  {n}. {label}
                </span>
              </div>
              {i < STEP_META.length - 1 && <div className={cn("mx-1 h-px w-4 shrink-0", done ? "bg-emerald-300" : "bg-navy-100")} />}
            </div>
          );
        })}
      </div>

      {/* ------------------------------ STEP 1 ------------------------------ */}
      {step === 1 && (
        <div className="space-y-5">
          <Card
            className={cn(
              "relative flex flex-col items-center gap-4 border-2 border-dashed px-6 py-16 text-center transition-colors",
              dragOver ? "border-gold-500 bg-gold-50/60" : "border-navy-200",
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) openFile(file);
            }}
          >
            <div className="flex size-16 items-center justify-center rounded-2xl bg-navy-700 text-gold-400 shadow-lg">
              <Upload className="size-8" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-lg font-bold text-navy-900">Drop the Excel file here</div>
              <p className="mt-1 text-[13px] text-navy-500">
                .xlsx or .xls — the file is read entirely on this computer, never uploaded anywhere.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) openFile(f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold-500 px-6 text-[14px] font-semibold text-navy-900 shadow-sm transition-all hover:bg-gold-400">
                  <FileSpreadsheet className="size-4.5" />
                  Choose Excel File
                </span>
              </label>
              <Button
                variant="outline"
                size="lg"
                icon={FileText}
                onClick={() => downloadBlob(buildSampleWorkbook(), "BASIX_Sample_Students.xlsx")}
              >
                Download sample workbook
              </Button>
            </div>
            {wb && (
              <Badge tone="navy" className="mt-2">
                <FileSpreadsheet className="size-3.5" /> {wb.fileName} — {wb.sheets.length} sheet{wb.sheets.length === 1 ? "" : "s"}
              </Badge>
            )}
          </Card>

          {wb && wb.sheets.length > 1 && (
            <Card className="p-6">
              <div className="mb-4 text-[15px] font-bold text-navy-900">Which worksheet holds the students?</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wb.sheets.map((s, i) => (
                  <button
                    key={s.name}
                    onClick={() => chooseSheet(i)}
                    className="group rounded-xl border border-navy-150 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-md"
                  >
                    <Table2 className="mb-2 size-5 text-gold-600" />
                    <div className="truncate text-[13.5px] font-bold text-navy-900">{s.name}</div>
                    <div className="mt-0.5 text-[12px] text-navy-500">
                      {s.rows.length} data rows · {s.headers.length} columns
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ------------------------------ STEP 2 ------------------------------ */}
      {step === 2 && sheet && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="p-6">
            <div className="mb-1 text-[15px] font-bold text-navy-900">Map Excel columns to certificate fields</div>
            <p className="mb-5 text-[12.5px] text-navy-500">
              Sheets: <span className="font-semibold text-navy-700">{sheet.name}</span> · matches were guessed from the header names — adjust anything that looks wrong.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_KEYS.map((key) => {
                const required = key === "studentId" || key === "studentName";
                const mapped = mapping[key];
                return (
                  <Field
                    key={key}
                    label={`${FIELD_LABELS[key]}${required ? " *" : ""}`}
                    className={mapped === undefined && required ? "[&_select]:border-red-300" : undefined}
                  >
                    <SelectInput
                      value={mapped === undefined ? "" : String(mapped)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === "") delete next[key];
                          else next[key] = Number(v);
                          return next;
                        });
                      }}
                    >
                      <option value="">— not mapped —</option>
                      {sheet.headers.map((h, i) => (
                        <option key={`${h}-${i}`} value={i}>
                          {h}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                );
              })}
            </div>

            {mapping.courseName === undefined && (
              <Field label="Default course for every student" hint="Used when no Course column is mapped, or a mapped cell is empty." className="mt-4">
                <TextInput
                  value={defaultCourse}
                  onChange={(e) => setDefaultCourse(e.target.value)}
                  placeholder="e.g. Diploma in Computer Applications"
                />
              </Field>
            )}

            <div className="mt-6 flex gap-2">
              <Button variant="outline" icon={ArrowLeft} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="gold" icon={ListChecks} onClick={goValidate}>
                Continue to validation
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-navy-100 bg-navy-50 px-5 py-3 text-[13px] font-bold text-navy-700">
              First rows of “{sheet.name}”
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-[11.5px]">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr>
                    {sheet.headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-bold text-navy-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-navy-50">
                      {r.map((c, j) => (
                        <td key={j} className="max-w-[160px] truncate px-3 py-2 text-navy-700">
                          {c || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------ STEP 3 ------------------------------ */}
      {step === 3 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green"><CheckCircle2 className="size-3.5" /> {stats.ready} ready</Badge>
              <Badge tone={stats.needsFix ? "amber" : "gray"}><AlertTriangle className="size-3.5" /> {stats.needsFix} need fixing</Badge>
              <Badge tone={stats.skipped ? "red" : "gray"}><SkipForward className="size-3.5" /> {stats.skipped} skipped</Badge>
              <span className="ml-1 text-[12.5px] text-navy-500">of {stats.total} rows</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                  placeholder="Search ID or name…"
                  className="h-9 w-56 rounded-lg border border-navy-200 pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold-500/60"
                />
              </div>
              <Toggle
                checked={filter === "issues"}
                onChange={(v) => { setFilter(v ? "issues" : "all"); setPage(0); }}
                label="Only show issues"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[12.5px]">
              <thead>
                <tr className="bg-navy-50/70 text-left">
                  <th className="px-4 py-2.5 font-bold text-navy-500">#</th>
                  <th className="px-3 py-2.5 font-bold text-navy-500">Status</th>
                  {FIELD_KEYS.map((k) => (
                    <th key={k} className="px-3 py-2.5 font-bold text-navy-500">{FIELD_LABELS[k]}</th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-bold text-navy-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const idx = rows.indexOf(row);
                  const valid = rowIsValid(row);
                  return (
                    <tr key={idx} className={cn("border-t border-navy-50 align-top", row.skipped && "opacity-55")}>
                      <td className="px-4 py-2.5 font-semibold text-navy-400">{row.index}</td>
                      <td className="px-3 py-2.5">
                        {row.skipped ? (
                          <Badge tone="red"><SkipForward className="size-3" /> Skipped</Badge>
                        ) : valid ? (
                          <Badge tone="green"><CheckCircle2 className="size-3" /> Ready</Badge>
                        ) : (
                          <Badge tone="amber"><AlertTriangle className="size-3" /> Fix {Object.keys(row.issues).length}</Badge>
                        )}
                      </td>
                      {FIELD_KEYS.map((k) => (
                        <td key={k} className="max-w-[180px] px-3 py-2.5">
                          <div className={cn("truncate font-medium", row.issues[k] ? "text-red-700" : "text-navy-800")} title={row.data[k]}>
                            {row.data[k] || <span className="text-red-400">missing</span>}
                          </div>
                          {row.issues[k] && (
                            <div className="mt-0.5 flex items-start gap-1 text-[10.5px] leading-snug text-red-600">
                              <AlertTriangle className="mt-px size-3 shrink-0" />
                              {row.issues[k]}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewIdx(idx)}
                            className="rounded-lg p-2 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                            title="Preview certificate"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => setEditIdx(idx)}
                            className="rounded-lg p-2 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                            title="Edit row"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => toggleSkip(idx)}
                            className={cn(
                              "rounded-lg p-2 transition-colors hover:bg-navy-100",
                              row.skipped ? "text-red-500 hover:text-navy-700" : "text-navy-400 hover:text-red-600",
                            )}
                            title={row.skipped ? "Include this row" : "Skip this row"}
                          >
                            {row.skipped ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-navy-400">
                      No rows match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 px-5 py-3.5">
            <div className="flex items-center gap-2 text-[12px] text-navy-500">
              <Button variant="subtle" size="sm" icon={ChevronLeft} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Prev
              </Button>
              <span className="font-semibold text-navy-700">Page {safePage + 1} / {pageCount}</span>
              <Button variant="subtle" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" icon={ArrowLeft} onClick={() => setStep(2)}>
                Mapping
              </Button>
              <Button
                variant="gold"
                size="lg"
                icon={Play}
                disabled={stats.ready === 0}
                onClick={() => setStep(4)}
              >
                Generate {stats.ready} certificate{stats.ready === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------ STEP 4 ------------------------------ */}
      {step === 4 && (
        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="space-y-5 p-6">
            <div>
              <div className="text-[15px] font-bold text-navy-900">Output options</div>
              <p className="mt-1 text-[12.5px] text-navy-500">
                {stats.ready} valid rows · {stats.needsFix} blocked · {stats.skipped} skipped — blocked/skipped rows stay out of the ZIP and appear in the report.
              </p>
            </div>

            <Field label="PDF sharpness" hint="263 DPI at 297 mm width already looks crisp; Ultra is best for premium print.">
              <SelectInput
                value={quality.scale}
                onChange={(e) => setQuality((q) => ({ ...q, scale: Number(e.target.value) as 1 | 2 | 3 }))}
              >
                <option value={1}>Standard · 1536×1024 (fastest)</option>
                <option value={2}>High · 3072×2048 (recommended)</option>
                <option value={3}>Ultra · 4608×3072 (best for print)</option>
              </SelectInput>
            </Field>

            <Field label="Image compression inside the PDF" hint="JPEG keeps the whole ZIP light; PNG is lossless but much heavier.">
              <SelectInput
                value={quality.format}
                onChange={(e) => setQuality((q) => ({ ...q, format: e.target.value as "jpeg" | "png" }))}
              >
                <option value="jpeg">JPEG · 96% quality (recommended)</option>
                <option value="png">PNG · lossless (large files)</option>
              </SelectInput>
            </Field>

            <Toggle
              checked={writeFolder}
              onChange={setWriteFolder}
              label={
                folderPickerSupported()
                  ? "Also save every PDF into a chosen folder"
                  : "Folder writing needs Chrome/Edge — ZIP will contain everything either way"
              }
              disabled={!folderPickerSupported()}
            />

            <div className="rounded-xl bg-navy-50 p-3.5 text-[11.5px] leading-relaxed text-navy-500">
              Example filename:{" "}
              <span className="font-mono text-[11px] text-navy-800">
                {certificateFileName("BASIX-2001", "Aisha Rahman")}
              </span>
              <br />
              ZIP name: <span className="font-mono text-[11px] text-navy-800">{zipFileName()}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" icon={ArrowLeft} disabled={running} onClick={() => setStep(3)}>
                Back
              </Button>
              {!running ? (
                <Button variant="gold" size="lg" icon={Play} onClick={runGeneration}>
                  Start generation
                </Button>
              ) : (
                <Button variant="danger" size="lg" icon={Ban} onClick={() => { cancelRef.current = true; }}>
                  Cancel batch
                </Button>
              )}
            </div>
          </Card>

          <Card className="flex flex-col p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[15px] font-bold text-navy-900">Progress</div>
              <span className="text-[13px] font-semibold text-navy-600">
                {progress.done} / {progress.total || stats.ready}
              </span>
            </div>
            <ProgressBar value={progress.total ? (progress.done / progress.total) * 100 : 0} animated={running} />
            <div className="mt-2 h-5 text-[12.5px] text-navy-500">
              {running
                ? progress.current
                  ? <>Generating certificate for <span className="font-semibold text-navy-800">{progress.current}</span>…</>
                  : "Preparing…"
                : progress.done > 0
                  ? "Batch finished."
                  : "Press “Start generation” to begin. The interface stays responsive throughout."}
            </div>
            <div className="mt-5 min-h-[180px] flex-1 rounded-xl bg-navy-900 p-4 font-mono text-[11.5px] leading-6 text-navy-200">
              {log.length === 0 ? (
                <span className="text-navy-500">// generation log appears here</span>
              ) : (
                log.map((l, i) => (
                  <div key={i} className={cn(l.startsWith("✗") ? "text-red-400" : "text-emerald-300")}>{l}</div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------ STEP 5 ------------------------------ */}
      {step === 5 && result && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-6" /></div>
                <div>
                  <div className="text-2xl font-extrabold text-navy-900">{result.succeeded.length}</div>
                  <div className="text-[12px] font-semibold text-navy-500">Certificates generated</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><SkipForward className="size-6" /></div>
                <div>
                  <div className="text-2xl font-extrabold text-navy-900">{result.skipped.length}</div>
                  <div className="text-[12px] font-semibold text-navy-500">Rows skipped / invalid</div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 text-red-600"><XCircle className="size-6" /></div>
                <div>
                  <div className="text-2xl font-extrabold text-navy-900">{result.failed.length}</div>
                  <div className="text-[12px] font-semibold text-navy-500">Failures during generation</div>
                </div>
              </div>
            </Card>
          </div>

          {result.succeeded.length > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-navy-800 to-navy-700 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="flex size-13 items-center justify-center rounded-2xl bg-gold-500 text-navy-900 shadow-lg">
                  <Archive className="size-6.5" />
                </div>
                <div>
                  <div className="text-lg font-bold">{zipFileName()}</div>
                  <div className="text-[12.5px] text-navy-200">
                    Contains only the {result.succeeded.length} generated certificate PDFs — no Excel file, no config.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Button variant="gold" size="lg" icon={Archive} onClick={downloadZip}>
                  Download ZIP
                </Button>
                {folderPickerSupported() && (
                  <Button variant="outline" size="lg" icon={FolderDown} onClick={saveZipToFolder} className="border-white/30 bg-transparent text-white hover:bg-white/10">
                    Save ZIP to Folder
                  </Button>
                )}
                <Button variant="outline" size="lg" icon={FileText} onClick={downloadCsvReport} className="border-white/30 bg-transparent text-white hover:bg-white/10">
                  CSV report
                </Button>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-navy-100 px-5 py-3.5 text-[14px] font-bold text-navy-800">
              Generated certificates
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-[12.5px]">
                <tbody>
                  {result.succeeded.map((s, i) => (
                    <tr key={i} className="border-t border-navy-50 first:border-t-0">
                      <td className="px-5 py-2.5 text-navy-400">{s.rowIndex}</td>
                      <td className="px-3 py-2.5 font-semibold text-navy-800">{s.data.studentName}</td>
                      <td className="px-3 py-2.5 text-navy-500">{s.data.studentId}</td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 font-mono text-[11px] text-navy-600">{s.fileName}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="subtle" size="sm" icon={FileDown} onClick={() => downloadBlob(s.blob, s.fileName)}>
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {result.succeeded.length === 0 && (
                    <tr><td className="px-5 py-8 text-center text-navy-400" colSpan={5}>No certificates were generated.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {(result.skipped.length > 0 || result.failed.length > 0) && (
            <Card className="overflow-hidden">
              <div className="border-b border-navy-100 px-5 py-3.5 text-[14px] font-bold text-navy-800">
                Skipped &amp; failed rows <span className="font-medium text-navy-400">(nothing was discarded silently)</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {result.skipped.map((s, i) => (
                      <tr key={`s${i}`} className="border-t border-navy-50 first:border-t-0">
                        <td className="px-5 py-2.5 text-navy-400">{s.rowIndex}</td>
                        <td className="px-3 py-2.5 font-semibold text-navy-800">{s.data.studentName || "—"}</td>
                        <td className="px-3 py-2.5 text-navy-500">{s.data.studentId || "—"}</td>
                        <td className="px-3 py-2.5 text-amber-700">{s.reasons.join(" · ")}</td>
                      </tr>
                    ))}
                    {result.failed.map((f, i) => (
                      <tr key={`f${i}`} className="border-t border-navy-50 first:border-t-0">
                        <td className="px-5 py-2.5 text-navy-400">{f.rowIndex}</td>
                        <td className="px-3 py-2.5 font-semibold text-navy-800">{f.data.studentName || "—"}</td>
                        <td className="px-3 py-2.5 text-navy-500">{f.data.studentId || "—"}</td>
                        <td className="px-3 py-2.5 text-red-600">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="gold" icon={RotateCcw} onClick={resetBatch}>Start a new batch</Button>
            <Button variant="outline" icon={Users} onClick={() => setStep(3)}>Review rows again</Button>
          </div>
        </div>
      )}

      {/* --------------------------- edit-row modal -------------------------- */}
      <Modal
        open={editIdx !== null}
        onClose={() => setEditIdx(null)}
        title={editIdx !== null ? `Edit row #${rows[editIdx].index}` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditIdx(null)}>Close</Button>
          </>
        }
      >
        {editIdx !== null && (
          <div className="space-y-4">
            {FIELD_KEYS.map((key) => (
              <Field
                key={key}
                label={FIELD_LABELS[key]}
                error={rows[editIdx].issues[key]}
              >
                <TextInput
                  value={rows[editIdx].data[key]}
                  invalid={!!rows[editIdx].issues[key]}
                  onChange={(e) => updateRow(editIdx, { ...rows[editIdx].data, [key]: e.target.value })}
                />
              </Field>
            ))}
            <Alert tone="blue" title="Validated live">
              The row re-validates as you type; duplicate IDs are re-checked against the whole sheet.
            </Alert>
          </div>
        )}
      </Modal>

      {/* --------------------------- preview modal ---------------------------- */}
      <Modal
        open={previewIdx !== null}
        onClose={() => setPreviewIdx(null)}
        title={previewIdx !== null ? `Preview — row #${rows[previewIdx].index}` : ""}
        wide
      >
        {previewIdx !== null && (
          <CertificatePreview
            record={rows[previewIdx].data}
            layout={layout}
            scale={1.6}
            refreshKey={assetsVersion}
          />
        )}
      </Modal>
    </div>
  );
}
