import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, FileUp, FolderOpen, Image as ImageIcon, Move, RotateCcw, Type, Upload,
  CheckCircle2, AlertTriangle, Trash2, FileJson2, Pipette,
} from "lucide-react";
import { Alert, Badge, Button, Card, Field, SectionHeader, SelectInput, TextInput, Toggle } from "../components/ui";
import { CertificatePreview } from "../components/CertificatePreview";
import { useToast } from "../components/Toast";
import { useApp } from "../state/app";
import {
  exportLayoutJson, importLayoutJson, resetLayout, FIELD_KEYS, FIELD_LABELS,
} from "../lib/layout";
import type { FieldKey } from "../lib/types";
import { SAMPLE_RECORD, LONG_NAME_RECORD, emptyRecord } from "../lib/types";
import {
  addCustomFont, auditFonts, listCustomFonts, loadStoredCustomFonts, removeCustomFont,
} from "../lib/fonts";
import { clearCustomTemplate, getTemplateInfo, setCustomTemplate, type TemplateInfo } from "../lib/template";
import { downloadBlob } from "../lib/zip";
import { cn } from "../utils/cn";

const WEIGHTS = [300, 400, 500, 600, 700, 800];

export function LayoutSettingsScreen() {
  const { layout, updateField, replaceLayout, assetsVersion, bumpAssets, outputDir } = useApp();
  const toast = useToast();

  const [active, setActive] = useState<FieldKey>("studentName");
  const [previewChoice, setPreviewChoice] = useState<"sample" | "long" | "blank">("sample");
  const [showReference, setShowReference] = useState(false);
  const [blankInfo, setBlankInfo] = useState<TemplateInfo | null>(null);
  const [sampleInfo, setSampleInfo] = useState<TemplateInfo | null>(null);
  const [fontAuditTick, setFontAuditTick] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  const refreshTemplates = useCallback(async () => {
    setBlankInfo(await getTemplateInfo("blank"));
    setSampleInfo(await getTemplateInfo("sample"));
  }, []);

  useEffect(() => {
    loadStoredCustomFonts().then((l) => l.length && bumpAssets());
    refreshTemplates();
  }, [refreshTemplates, bumpAssets]);

  const field = layout.fields[active];

  const num = (v: string): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const patchNum = (patch: { [K in "x" | "y" | "w" | "h" | "fontSize" | "minFontSize" | "letterSpacing" | "fontWeight"]?: number | null }) => {
    const clean: Partial<typeof field> = {};
    (Object.entries(patch) as Array<[string, number | null]>).forEach(([k, v]) => {
      if (v !== null) (clean as Record<string, number>)[k] = v;
    });
    if (Object.keys(clean).length) updateField(active, clean);
  };

  const uploadTemplate = async (kind: "blank" | "sample", file: File) => {
    try {
      const info = await setCustomTemplate(kind, file);
      await refreshTemplates();
      bumpAssets();
      toast.success(
        kind === "blank" ? "Blank certificate installed" : "Reference image installed",
        `${info.width}×${info.height}px${info.aspectOk ? "" : " — warning: not a 3:2 image, it will be stretched."}`,
      );
    } catch (err) {
      toast.error("Could not use that image", err instanceof Error ? err.message : String(err));
    }
  };

  const uploadFont = async (file: File) => {
    try {
      const f = await addCustomFont(file);
      setFontAuditTick((t) => t + 1);
      bumpAssets();
      toast.success(`Font “${f.family}” installed`, "It now renders on certificates and persists across restarts.");
    } catch (err) {
      toast.error("Font could not be loaded", err instanceof Error ? err.message : String(err));
    }
  };

  const audit = auditFonts();
  const missing = audit.filter((a) => a.requirement.required && !a.loaded);
  const custom = listCustomFonts();

  const record =
    previewChoice === "sample" ? SAMPLE_RECORD : previewChoice === "long" ? LONG_NAME_RECORD : emptyRecord();

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Configuration"
        title="Layout Settings"
        description="Template artwork, licensed fonts, and the exact position of every dynamic field on the 1536×1024 certificate grid."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={() => downloadBlob(new Blob([exportLayoutJson(layout)], { type: "application/json" }), "basix-layout-settings.json")}>
              Export JSON
            </Button>
            <Button variant="outline" icon={FileUp} onClick={() => importRef.current?.click()}>
              Import JSON
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  replaceLayout(importLayoutJson(await f.text()));
                  toast.success("Layout imported", "All field positions were replaced by the file's values.");
                } catch (err) {
                  toast.error("Import failed", err instanceof Error ? err.message : String(err));
                }
              }}
            />
            <Button
              variant="danger"
              icon={RotateCcw}
              onClick={() => {
                replaceLayout(resetLayout());
                toast.info("Positions reset", "Every field is back at the specification's default coordinates.");
              }}
            >
              Reset defaults
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ------------------------------- editor ------------------------------ */}
        <div className="space-y-4">
          {/* field selector */}
          <div className="flex flex-wrap items-center gap-2">
            {FIELD_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",
                  active === k
                    ? "bg-gold-500 text-navy-900 shadow"
                    : "bg-white text-navy-600 ring-1 ring-navy-150 hover:ring-gold-400",
                )}
              >
                {FIELD_LABELS[k]}
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-1.5 text-[11.5px] text-navy-400 md:flex">
              <Move className="size-3.5" /> Drag any box on the preview to move it
            </span>
          </div>

          <CertificatePreview
            record={record}
            layout={layout}
            scale={1.6}
            refreshKey={assetsVersion}
            activeField={active}
            showReference={showReference}
            onFieldDrag={(key, x, y) => {
              setActive(key);
              updateField(key, { x, y });
            }}
            onFieldSelect={setActive}
          />

          {/* preview controls */}
          <div className="flex flex-wrap items-center gap-3">
            <SelectInput
              value={previewChoice}
              onChange={(e) => setPreviewChoice(e.target.value as typeof previewChoice)}
              className="w-auto"
            >
              <option value="sample">Preview: sample student</option>
              <option value="long">Preview: very long name</option>
              <option value="blank">Preview: blank fields</option>
            </SelectInput>
            <Toggle
              checked={showReference}
              onChange={setShowReference}
              label={
                sampleInfo?.img
                  ? "Compare with completed certificate"
                  : "Reference overlay (needs certificate-sample.png)"
              }
              disabled={!sampleInfo?.img}
            />
          </div>

          {/* numeric editor */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[14px] font-bold text-navy-900">{FIELD_LABELS[active]}</div>
              <Badge tone="gold"><Pipette className="size-3" /> live on this certificate</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="X (px)"><TextInput type="number" step="0.1" value={field.x} onChange={(e) => patchNum({ x: num(e.target.value) })} /></Field>
              <Field label="Y (px)"><TextInput type="number" step="0.1" value={field.y} onChange={(e) => patchNum({ y: num(e.target.value) })} /></Field>
              <Field label="Width (px)"><TextInput type="number" step="0.1" value={field.w} onChange={(e) => patchNum({ w: num(e.target.value) })} /></Field>
              <Field label="Height (px)"><TextInput type="number" step="0.1" value={field.h} onChange={(e) => patchNum({ h: num(e.target.value) })} /></Field>
              <Field label="Font size"><TextInput type="number" step="0.5" value={field.fontSize} onChange={(e) => patchNum({ fontSize: num(e.target.value) })} /></Field>
              <Field label="Min size (auto-fit)"><TextInput type="number" step="0.5" value={field.minFontSize} onChange={(e) => patchNum({ minFontSize: num(e.target.value) })} /></Field>
              <Field label="Weight">
                <SelectInput value={field.fontWeight} onChange={(e) => updateField(active, { fontWeight: Number(e.target.value) })}>
                  {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                </SelectInput>
              </Field>
              <Field label="Letter spacing"><TextInput type="number" step="0.1" value={field.letterSpacing} onChange={(e) => patchNum({ letterSpacing: num(e.target.value) })} /></Field>
              <Field label="Color"><div className="flex h-10 items-center gap-2 rounded-xl border border-navy-200 px-2.5">
                <input type="color" value={field.color} onChange={(e) => updateField(active, { color: e.target.value })} className="size-6 cursor-pointer rounded border-0 bg-transparent" />
                <span className="font-mono text-[12px] text-navy-700">{field.color}</span>
              </div></Field>
              <Field label="Horizontal align">
                <SelectInput value={field.align} onChange={(e) => updateField(active, { align: e.target.value as typeof field.align })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </SelectInput>
              </Field>
              <Field label="Vertical align">
                <SelectInput value={field.valign} onChange={(e) => updateField(active, { valign: e.target.value as typeof field.valign })}>
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </SelectInput>
              </Field>
              <Field label="Font family stack">
                <TextInput
                  value={field.fontFamily}
                  onChange={(e) => updateField(active, { fontFamily: e.target.value })}
                  className="font-mono text-[11.5px]"
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Toggle checked={field.autoFit} onChange={(v) => updateField(active, { autoFit: v })} label="Auto-shrink to fit box" />
              <Toggle checked={field.uppercase} onChange={(v) => updateField(active, { uppercase: v })} label="UPPERCASE" />
              <Toggle checked={field.italic} onChange={(v) => updateField(active, { italic: v })} label="Italic" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-navy-400">
              Coordinates are top-left anchored on the 1536×1024 reference grid. The specification's
              default bottom edges put Student ID at y 189.5, the name band at y 454.2, marks at y 582.2,
              date at y 717 and duration at y 776.2 — edit anything that your printed reference shows
              differently, and it applies instantly to preview, bulk and PDF output.
            </p>
          </Card>
        </div>

        {/* ------------------------- template & fonts ------------------------- */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="size-4 text-gold-600" />
              <span className="text-[14px] font-bold text-navy-900">Certificate template</span>
            </div>
            {blankInfo?.img ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img src={blankInfo.img.src} alt="Blank certificate" className="w-full rounded-lg ring-1 ring-navy-100" />
                <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                  <Badge tone={blankInfo.aspectOk ? "green" : "amber"}>
                    {blankInfo.width}×{blankInfo.height}px{blankInfo.aspectOk ? " · 3:2 ✓" : " · not 3:2!"}
                  </Badge>
                  <Badge tone="navy">{blankInfo.source === "custom" ? "Uploaded copy" : "Bundled file"}</Badge>
                </div>
              </div>
            ) : (
              <Alert tone="amber" icon={AlertTriangle} title="Blank certificate not installed" className="mb-3">
                Place <span className="font-mono">certificate-blank.png</span> in
                <span className="font-mono"> public/assets/templates/</span> or upload it here.
                A clearly-labelled placeholder is used until then.
              </Alert>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadTemplate("blank", f); }} />
                <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-700 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-navy-600">
                  <Upload className="size-4" /> {blankInfo?.img ? "Replace" : "Upload"} blank certificate
                </span>
              </label>
              {blankInfo?.source === "custom" && (
                <Button variant="danger" size="sm" icon={Trash2}
                  onClick={async () => { await clearCustomTemplate("blank"); await refreshTemplates(); bumpAssets(); toast.info("Custom template removed", "The bundled file will be used if present."); }}>
                  Remove
                </Button>
              )}
            </div>
            <div className="mt-4 border-t border-navy-100 pt-4">
              <div className="mb-2 text-[12px] font-semibold text-navy-600">Completed-certificate reference (optional)</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadTemplate("sample", f); }} />
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-100 px-3 text-[12px] font-semibold text-navy-700 transition-colors hover:bg-navy-150">
                    <Upload className="size-3.5" /> {sampleInfo?.img ? "Replace" : "Upload"} sample image
                  </span>
                </label>
                {sampleInfo?.img && <Badge tone="green"><CheckCircle2 className="size-3" /> {sampleInfo.width}×{sampleInfo.height}px</Badge>}
                {sampleInfo?.source === "custom" && (
                  <Button variant="ghost" size="sm" icon={Trash2}
                    onClick={async () => { await clearCustomTemplate("sample"); await refreshTemplates(); bumpAssets(); }}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5" key={fontAuditTick}>
            <div className="mb-3 flex items-center gap-2">
              <Type className="size-4 text-gold-600" />
              <span className="text-[14px] font-bold text-navy-900">Fonts</span>
            </div>
            <div className="space-y-2.5">
              {audit.map((a) => (
                <div key={a.requirement.family} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-navy-800">{a.requirement.family}</div>
                    <div className="text-[11px] text-navy-400">{a.requirement.usedFor}</div>
                    {!a.loaded && a.requirement.required && (
                      <div className="mt-0.5 text-[11px] text-amber-700">{a.requirement.note} Currently falls back to {a.fallback}.</div>
                    )}
                  </div>
                  {a.loaded
                    ? <Badge tone="green"><CheckCircle2 className="size-3" /> Ready</Badge>
                    : a.requirement.required
                      ? <Badge tone="amber"><AlertTriangle className="size-3" /> Missing</Badge>
                      : <Badge tone="gray">fallback</Badge>}
                </div>
              ))}
            </div>
            <label className="mt-4 block cursor-pointer">
              <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadFont(f); }} />
              <span className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 text-[12.5px] font-semibold text-navy-600 transition-colors hover:border-gold-400 hover:text-navy-800">
                <Upload className="size-4" /> Upload font file (.ttf / .otf)
              </span>
            </label>
            {custom.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {custom.map((f) => (
                  <div key={f.key} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-[12px]">
                    <span className="font-semibold text-navy-700">{f.family} <span className="font-normal text-navy-400">· {f.fileName}</span></span>
                    <button className="text-navy-400 hover:text-red-600" onClick={async () => { await removeCustomFont(f.key); setFontAuditTick((t) => t + 1); bumpAssets(); }}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {missing.length > 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
                {missing.length} required font{missing.length === 1 ? " is" : "s are"} missing. Certificates still render —
                the named fallback is used — but upload the licensed files for a pixel-true match.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <FolderOpen className="size-4 text-gold-600" />
              <span className="text-[14px] font-bold text-navy-900">Output folder</span>
            </div>
            {outputDir ? (
              <p className="text-[12.5px] text-navy-600">PDFs/ZIPs can be written straight into <span className="font-bold text-navy-900">“{outputDir.name}”</span>. Manage it from the Individual screen.</p>
            ) : (
              <p className="text-[12.5px] text-navy-500">No folder picked — files arrive through the browser's Downloads folder. Pick one from the Individual screen (Chrome/Edge).</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-navy-400">
              <FileJson2 className="size-4 shrink-0" />
              Layout is stored locally as JSON and can be versioned or shared between workstations.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
