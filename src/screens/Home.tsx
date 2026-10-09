import { useEffect, useState } from "react";
import {
  Archive, ArrowRight, Award, Eye, FileSpreadsheet, History as HistoryIcon,
  Image as ImageIcon, MonitorCheck, Settings2, UserRound, AlertTriangle, Type,
} from "lucide-react";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { CertificatePreview } from "../components/CertificatePreview";
import { useApp } from "../state/app";
import { SAMPLE_RECORD } from "../lib/types";
import { historyStats, loadHistory } from "../lib/history";
import { auditFonts } from "../lib/fonts";
import { getTemplateInfo } from "../lib/template";
import type { ScreenId } from "../App";
import { cn } from "../utils/cn";

interface NavCard {
  id: ScreenId;
  icon: typeof Eye;
  title: string;
  body: string;
  accent: "gold" | "navy" | "green";
}

const NAV: NavCard[] = [
  { id: "bulk", icon: FileSpreadsheet, title: "Bulk Generation", body: "Import Excel → validate rows → all PDFs + one ZIP.", accent: "gold" },
  { id: "individual", icon: UserRound, title: "Individual Certificate", body: "Type one student, preview live, print a single PDF.", accent: "navy" },
  { id: "preview", icon: Eye, title: "Certificate Preview", body: "Full-size review with field guides and reference overlay.", accent: "navy" },
  { id: "layout", icon: Settings2, title: "Layout Settings", body: "Template, fonts, and exact X/Y of every field.", accent: "green" },
  { id: "history", icon: HistoryIcon, title: "Output History", body: "Recent exports and lifetime certificate counts.", accent: "navy" },
  { id: "diagnostics", icon: MonitorCheck, title: "Diagnostics", body: "Live self-tests of the whole generation pipeline.", accent: "green" },
];

const ACCENTS = {
  gold: "bg-gold-100 text-gold-700 group-hover:bg-gold-500 group-hover:text-navy-900",
  navy: "bg-navy-100 text-navy-600 group-hover:bg-navy-700 group-hover:text-white",
  green: "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white",
};

export function HomeScreen({ go }: { go: (s: ScreenId) => void }) {
  const { layout, assetsVersion } = useApp();
  const [tplBlank, setTplBlank] = useState<boolean | null>(null);
  const [tplSample, setTplSample] = useState<boolean | null>(null);

  useEffect(() => {
    getTemplateInfo("blank").then((t) => setTplBlank(!!t.img));
    getTemplateInfo("sample").then((t) => setTplSample(!!t.img));
  }, [assetsVersion]);

  const history = loadHistory();
  const stats = historyStats(history);
  const missingFonts = auditFonts().filter((f) => f.requirement.required && !f.loaded);

  const setupNeeded = tplBlank === false || missingFonts.length > 0;

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-[0_24px_60px_-24px_rgba(10,22,48,0.6)]">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[420px] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[380px] rounded-full bg-navy-500/25 blur-3xl" />
        <div className="relative grid items-center gap-8 px-7 py-8 md:px-10 md:py-10 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">
              <Award className="size-3.5" /> BASIX Computer Education
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-[40px]">
              Certificates, printed<br className="hidden md:block" /> in under a minute.
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-navy-200">
              Import a whole class from Excel or type a single student — every certificate is rendered on the real BASIX artwork, validated, and packed into one dated ZIP. Fully offline.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" icon={FileSpreadsheet} onClick={() => go("bulk")}>
                Start bulk batch
              </Button>
              <Button
                size="lg"
                variant="outline"
                icon={UserRound}
                onClick={() => go("individual")}
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:border-white/50"
              >
                Single certificate
              </Button>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl bg-gold-500/20 ring-1 ring-gold-400/30" />
            <div className="relative">
              <CertificatePreview
                record={SAMPLE_RECORD}
                layout={layout}
                scale={1.2}
                refreshKey={assetsVersion}
                className="shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* setup alert */}
      {setupNeeded && (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-amber-900">Setup checklist</div>
              <ul className="mt-1.5 space-y-1 text-[13px] text-amber-800">
                {tplBlank === false && (
                  <li className="flex items-center gap-2">
                    <ImageIcon className="size-4 shrink-0" />
                    Blank certificate artwork is not installed — a labelled placeholder renders until you add <span className="font-mono">certificate-blank.png</span>.
                  </li>
                )}
                {tplSample === false && (
                  <li className="flex items-center gap-2">
                    <ImageIcon className="size-4 shrink-0" />
                    Optional <span className="font-mono">certificate-sample.png</span> not found — editor comparison overlay is off.
                  </li>
                )}
                {missingFonts.map((f) => (
                  <li key={f.requirement.family} className="flex items-center gap-2">
                    <Type className="size-4 shrink-0" />
                    Font <b>{f.requirement.family}</b> missing for {f.requirement.usedFor} — falling back to <i>{f.fallback}</i>.
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="primary" size="lg" icon={Settings2} onClick={() => go("layout")}>
              Open Layout Settings
            </Button>
          </div>
        </Card>
      )}

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Certificates produced", value: stats.certificates },
          { label: "Exports performed", value: stats.exports },
          { label: "Success rate", value: `${stats.successRate}%` },
        ].map((s, i) => (
          <Card key={s.label} className="relative overflow-hidden p-5" hover>
            <div className={cn("absolute inset-y-0 left-0 w-1", i === 2 ? "bg-gold-500" : "bg-navy-700")} />
            <div className="text-3xl font-extrabold tracking-tight text-navy-900">{s.value}</div>
            <div className="text-[12px] font-semibold text-navy-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* nav cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <Card key={n.id} hover className="group cursor-pointer p-5" onClick={() => go(n.id)}>
              <div className="flex items-start justify-between">
                <div className={cn("flex size-11 items-center justify-center rounded-xl transition-colors", ACCENTS[n.accent])}>
                  <Icon className="size-5.5" strokeWidth={1.9} />
                </div>
                <ArrowRight className="size-4.5 text-navy-200 transition-all group-hover:translate-x-1 group-hover:text-gold-500" />
              </div>
              <div className="mt-4 text-[15px] font-bold text-navy-900">{n.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-navy-500">{n.body}</p>
            </Card>
          );
        })}
      </div>

      {/* recent exports */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-3.5">
          <span className="text-[14px] font-bold text-navy-900">Recent exports</span>
          {history.length > 0 && (
            <Badge tone="navy" className="cursor-pointer" >
              <span onClick={() => go("history")}>View all</span>
            </Badge>
          )}
        </div>
        {history.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing exported yet"
            body="Run a bulk batch or generate a single certificate — exports are logged here."
          />
        ) : (
          <table className="w-full text-[12.5px]">
            <tbody>
              {history.slice(0, 5).map((e) => (
                <tr key={e.id} className="border-t border-navy-50 first:border-t-0">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      {e.kind === "bulk" ? <Archive className="size-4 text-gold-600" /> : <UserRound className="size-4 text-navy-500" />}
                      <span className="max-w-[320px] truncate font-mono text-[11.5px] text-navy-800">{e.fileName}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-navy-500">{new Date(e.at).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</td>
                  <td className="px-3 py-3"><Badge tone="green">{e.succeeded} ok</Badge></td>
                  <td className="px-3 py-3"><Badge tone={e.skipped ? "amber" : "gray"}>{e.skipped} skipped</Badge></td>
                  <td className="px-3 py-3"><Badge tone={e.failed ? "red" : "gray"}>{e.failed} failed</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
