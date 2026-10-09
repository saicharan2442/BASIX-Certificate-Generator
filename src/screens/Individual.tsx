import { useMemo, useState } from "react";
import {
  Eraser, FileDown, FolderDown, FolderOpen, FolderSearch, Save, ShieldCheck, Wand2,
} from "lucide-react";
import { Badge, Button, Card, Field, SectionHeader, TextInput } from "../components/ui";
import { CertificatePreview } from "../components/CertificatePreview";
import { useToast } from "../components/Toast";
import { useApp } from "../state/app";
import { emptyRecord, SAMPLE_RECORD, type FieldKey, type StudentRecord } from "../lib/types";
import { FIELD_KEYS, FIELD_LABELS } from "../lib/layout";
import { validateRecord } from "../lib/validators";
import { generateCertificatePdf } from "../lib/pdf";
import { downloadBlob } from "../lib/zip";
import { addHistory } from "../lib/history";
import { forgetOutputFolder, pickOutputFolder, saveBlobToFolder } from "../lib/fsAccess";
import { certificateFileName } from "../lib/filenames";
import type { RenderResult } from "../lib/renderer";

const HINTS: Record<FieldKey, string> = {
  studentId: "e.g. BASIX-2025-1042",
  studentName: "Exactly as it should appear on the certificate",
  courseName: "e.g. Diploma in Computer Applications",
  marks: "e.g. 92% or 92.5%",
  date: "e.g. 07 Oct 2025 (07/10/2025 also works)",
  duration: "e.g. 30 Days, 3 Months, 60 Hours",
};

declare global {
  interface Window {
    showSaveFilePicker?: (opts?: unknown) => Promise<{
      createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
      name?: string;
    }>;
  }
}

export function IndividualScreen() {
  const { layout, assetsVersion, outputDir, setOutputDir } = useApp();
  const toast = useToast();
  const [form, setForm] = useState<StudentRecord>(emptyRecord());
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "folder" | "saveas">(null);
  const [metrics, setMetrics] = useState<RenderResult | null>(null);

  const { issues, cleaned, valid } = useMemo(() => validateRecord(form), [form]);

  const set = (key: FieldKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const ensureDir = async (): Promise<FileSystemDirectoryHandle | null> => {
    if (outputDir) return outputDir;
    const picked = await pickOutputFolder();
    if (!picked) return null;
    setOutputDir(picked);
    return picked;
  };

  const doGenerate = async (mode: "pdf" | "folder" | "saveas") => {
    setTouched(true);
    if (!valid) {
      toast.warning("Fix the highlighted fields first", "The certificate below is a draft until every field is valid.");
      return;
    }
    setBusy(mode);
    try {
      const result = await generateCertificatePdf(cleaned, layout);
      if (mode === "folder") {
        const dir = await ensureDir();
        if (!dir) {
          setBusy(null);
          return; // user cancelled the picker
        }
        const finalName = await saveBlobToFolder(dir, result.fileName, result.blob);
        toast.success("Certificate saved to folder", `${finalName} → ${dir.name}`);
      } else if (mode === "saveas" && window.showSaveFilePicker) {
        const handle = await window
          .showSaveFilePicker({
            suggestedName: result.fileName,
            types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
          })
          .catch(() => null);
        setBusy(null);
        if (!handle) return;
        const writable = await handle.createWritable();
        await writable.write(result.blob);
        await writable.close();
        toast.success("Certificate saved", handle.name ?? result.fileName);
      } else {
        downloadBlob(result.blob, result.fileName);
        toast.success("Certificate downloaded", `${result.fileName} — check your Downloads folder.`);
      }
      addHistory({
        kind: "individual",
        fileName: result.fileName,
        total: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
        destination: mode === "folder" ? "folder" : "download",
      });
      if (result.warnings.length) {
        result.warnings.forEach((w) => toast.warning("Fit warning", w));
      }
    } catch (err) {
      toast.error("PDF generation failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const nameFitted = metrics?.fitted.studentName;
  const nameShrunk = nameFitted !== undefined && nameFitted < layout.fields.studentName.fontSize - 0.5;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Mode B"
        title="Individual Certificate"
        description="Type one student's details, review the live preview of the actual template, then generate a single print-ready PDF."
        actions={
          <Button variant="ghost" icon={Wand2} onClick={() => { setForm(SAMPLE_RECORD); setTouched(false); }}>
            Fill with sample
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ------------------------------- form ------------------------------- */}
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="size-4 text-gold-600" />
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-navy-500">
              Student details
            </span>
          </div>
          <div className="space-y-4">
            {FIELD_KEYS.map((key) => (
              <Field
                key={key}
                label={FIELD_LABELS[key]}
                hint={HINTS[key]}
                error={touched ? issues[key] : undefined}
              >
                <TextInput
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  invalid={touched && !!issues[key]}
                  placeholder={HINTS[key]}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Button
              variant="gold"
              size="lg"
              icon={FileDown}
              loading={busy === "pdf"}
              onClick={() => doGenerate("pdf")}
              className="col-span-2"
            >
              Preview &amp; Generate PDF
            </Button>
            <Button
              variant="primary"
              icon={Save}
              loading={busy === "saveas"}
              onClick={() => doGenerate("saveas")}
            >
              Save As…
            </Button>
            <Button
              variant="primary"
              icon={FolderDown}
              loading={busy === "folder"}
              onClick={() => doGenerate("folder")}
            >
              {outputDir ? "Save to Folder" : "Choose Folder & Save"}
            </Button>
            <Button
              variant="outline"
              icon={Eraser}
              onClick={() => { setForm(emptyRecord()); setTouched(false); }}
            >
              Clear Form
            </Button>
            <Button
              variant="outline"
              icon={FolderOpen}
              onClick={() => {
                if (outputDir) {
                  toast.info("Output folder", `Certificates are written straight into “${outputDir.name}”. Browsers cannot pop Explorer open — the folder you picked is the destination.`);
                } else if (window.showDirectoryPicker) {
                  pickOutputFolder().then((h) => {
                    if (h) { setOutputDir(h); toast.success("Output folder set", `Future certificates go to “${h.name}”.`); }
                  });
                } else {
                  toast.info("About saving files", "PDFs are delivered through your browser's normal Downloads folder.");
                }
              }}
            >
              {outputDir ? "Output Folder Set" : "Set Output Folder"}
            </Button>
          </div>

          {outputDir && (
            <button
              onClick={async () => { await forgetOutputFolder(); setOutputDir(null); toast.info("Output folder cleared", "Future saves will use the browser Downloads folder."); }}
              className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-navy-400 transition-colors hover:text-navy-700"
            >
              <FolderSearch className="size-3.5" />
              Writing to “{outputDir.name}” — click to stop using it
            </button>
          )}
        </Card>

        {/* ------------------------------ preview ------------------------------ */}
        <div className="space-y-4">
          <Card className="overflow-hidden bg-gradient-to-b from-navy-50/60 to-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-navy-500">
                  Live preview
                </span>
                {valid ? (
                  <Badge tone="green">Ready to print</Badge>
                ) : (
                  <Badge tone="amber">Draft — {Object.keys(issues).length} field{Object.keys(issues).length === 1 ? "" : "s"} to fix</Badge>
                )}
                {nameShrunk && (
                  <Badge tone="navy">Name auto-fit to {Math.round(nameFitted!)}px</Badge>
                )}
              </div>
              <span className="text-[11px] text-navy-400">
                Preview and PDF use the identical renderer
              </span>
            </div>
            <CertificatePreview
              record={cleaned}
              layout={layout}
              scale={1.6}
              refreshKey={assetsVersion}
              onRendered={setMetrics}
            />
            {metrics?.warnings.map((w, i) => (
              <p key={i} className="mt-2 flex items-start gap-1.5 text-[11.5px] font-medium text-amber-700">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {w}
              </p>
            ))}
          </Card>

          <Card className="flex items-center gap-3 px-5 py-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
              <FileDown className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-navy-900">
                {valid ? certificateFileName(cleaned.studentId, cleaned.studentName) : "BASIX_Certificate_<ID>_<Name>.pdf"}
              </div>
              <div className="text-[11.5px] text-navy-500">
                297 × 198 mm landscape · sharp print-ready output · Windows-safe filename, never overwrites an existing file
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
