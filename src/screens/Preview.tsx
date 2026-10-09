import { useState } from "react";
import { Expand, Frame, Grid3x3, Shrink, X } from "lucide-react";
import { Badge, Button, Card, SectionHeader, SelectInput, Toggle } from "../components/ui";
import { CertificatePreview } from "../components/CertificatePreview";
import { useApp } from "../state/app";
import { LONG_NAME_RECORD, SAMPLE_RECORD, emptyRecord, type StudentRecord } from "../lib/types";
import { useEffect } from "react";
import { getTemplateInfo } from "../lib/template";
import { cn } from "../utils/cn";

/** Full-size certificate review screen. */
export function PreviewScreen() {
  const { layout, assetsVersion } = useApp();
  const [choice, setChoice] = useState("sample");
  const [guides, setGuides] = useState(true);
  const [reference, setReference] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [hasSample, setHasSample] = useState(false);

  useEffect(() => {
    getTemplateInfo("sample").then((t) => setHasSample(!!t.img));
  }, [assetsVersion]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const record: StudentRecord =
    choice === "sample" ? SAMPLE_RECORD : choice === "long" ? LONG_NAME_RECORD : emptyRecord();

  const preview = (
    <CertificatePreview
      record={record}
      layout={layout}
      scale={1.8}
      refreshKey={assetsVersion}
      showGuides={guides}
      showReference={reference}
    />
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Review"
        title="Certificate Preview"
        description="Inspect the exact artwork that goes into every PDF. The same renderer paints this view, the live previews and the exported files."
        actions={
          <Button variant="gold" icon={Expand} onClick={() => setFullscreen(true)}>
            Fullscreen review
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
        <SelectInput value={choice} onChange={(e) => setChoice(e.target.value)} className="w-auto">
          <option value="sample">Sample student</option>
          <option value="long">Very long name (auto-fit test)</option>
          <option value="blank">Blank fields</option>
        </SelectInput>
        <Toggle checked={guides} onChange={setGuides} label={<span className="flex items-center gap-1.5"><Grid3x3 className="size-3.5" /> Field guides</span>} />
        <Toggle
          checked={reference}
          onChange={setReference}
          disabled={!hasSample}
          label={<span className="flex items-center gap-1.5"><Frame className="size-3.5" /> Reference overlay{hasSample ? "" : " (not installed)"}</span>}
        />
        <div className="ml-auto flex items-center gap-2">
          <Shrink className="size-4 text-navy-400" />
          <input
            type="range" min={50} max={160} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-36 accent-gold-500"
          />
          <Expand className="size-4 text-navy-400" />
          <Badge tone="navy">{zoom}%</Badge>
        </div>
      </Card>

      <div className="rounded-2xl border border-navy-100 bg-gradient-to-br from-navy-100/40 via-navy-50/40 to-gold-50/40 p-6 md:p-10">
        <div className="mx-auto transition-all duration-200" style={{ maxWidth: `${(zoom / 100) * 100}%` }}>
          {preview}
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-navy-950/95 p-4 backdrop-blur md:p-8">
          <div className="mb-3 flex items-center justify-between text-navy-200">
            <span className={cn("text-[13px] font-semibold")}>
              Fullscreen review — {choice === "sample" ? "sample student" : choice === "long" ? "long name" : "blank fields"}
            </span>
            <button onClick={() => setFullscreen(false)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[12.5px] font-semibold hover:bg-white/20">
              <X className="size-4" /> Close (Esc)
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="max-h-full w-full max-w-[1400px]" onKeyDown={(e) => e.key === "Escape" && setFullscreen(false)}>
              {preview}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
