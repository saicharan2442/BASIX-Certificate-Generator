import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, MonitorCheck, Play, XCircle } from "lucide-react";
import { Badge, Button, Card, SectionHeader } from "../components/ui";
import { runDiagnostics, type TestResult } from "../lib/selftest";
import { useToast } from "../components/Toast";
import { cn } from "../utils/cn";

const ICON = {
  pass: <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />,
  warn: <AlertTriangle className="size-4.5 shrink-0 text-amber-500" />,
  fail: <XCircle className="size-4.5 shrink-0 text-red-500" />,
};

/** Environment + pipeline verification, executed live in this browser. */
export function DiagnosticsScreen() {
  const toast = useToast();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setResults([]);
    try {
      const r = await runDiagnostics();
      setResults(r);
      setRanAt(new Date());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const counts = {
    pass: results.filter((r) => r.status === "pass").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
  };

  const copy = async () => {
    const text = results
      .map((r) => `[${r.status.toUpperCase().padEnd(4)}] ${r.name}: ${r.detail}`)
      .join("\n");
    await navigator.clipboard.writeText(
      `BASIX Certificate Generator — diagnostics (${ranAt?.toISOString()})\n${text}`,
    );
    toast.success("Results copied", "Paste them into any email or ticket to share this workstation's status.");
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Verification"
        title="Diagnostics & Self-Tests"
        description="Real checks executed against the live rendering, PDF and ZIP pipeline in this browser — not a simulation."
        actions={
          <>
            <Button variant="outline" icon={ClipboardCopy} onClick={copy} disabled={!results.length}>
              Copy results
            </Button>
            <Button variant="gold" icon={running ? Loader2 : Play} onClick={run} loading={running}>
              {results.length ? "Run again" : "Run tests"}
            </Button>
          </>
        }
      />

      {results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-6" /></div>
            <div><div className="text-2xl font-extrabold text-navy-900">{counts.pass}</div><div className="text-[12px] font-semibold text-navy-500">Passed</div></div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><AlertTriangle className="size-6" /></div>
            <div><div className="text-2xl font-extrabold text-navy-900">{counts.warn}</div><div className="text-[12px] font-semibold text-navy-500">Warnings</div></div>
          </Card>
          <Card className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-red-100 text-red-600"><XCircle className="size-6" /></div>
            <div><div className="text-2xl font-extrabold text-navy-900">{counts.fail}</div><div className="text-[12px] font-semibold text-navy-500">Failed</div></div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {running && results.length === 0 ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-navy-500">
            <Loader2 className="size-5 animate-spin" />
            Executing render, PDF, ZIP and storage checks…
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-navy-50/70 text-left">
                <th className="w-14 px-5 py-3" />
                <th className="px-3 py-3 font-bold text-navy-500">Check</th>
                <th className="px-3 py-3 font-bold text-navy-500">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-navy-50">
                  <td className="px-5 py-2.5">{ICON[r.status]}</td>
                  <td className="px-3 py-2.5 font-semibold text-navy-800">{r.name}</td>
                  <td className={cn("px-3 py-2.5", r.status === "fail" ? "text-red-700" : r.status === "warn" ? "text-amber-800" : "text-navy-600")}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {results.length > 0 && (
          <div className="flex items-center justify-between border-t border-navy-100 bg-navy-50/50 px-5 py-3 text-[12px] text-navy-500">
            <span className="flex items-center gap-2">
              <MonitorCheck className="size-4" />
              Preview fidelity, long-name auto-fit, validators, filename safety, PDF %PDF header and ZIP assembly are all exercised above.
            </span>
            {ranAt && <Badge tone="navy">ran {ranAt.toLocaleTimeString()}</Badge>}
          </div>
        )}
      </Card>
    </div>
  );
}
