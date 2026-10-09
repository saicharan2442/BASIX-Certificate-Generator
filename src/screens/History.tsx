import { useState } from "react";
import { Archive, Eraser, FileDown, History as HistoryIcon, UserRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionHeader } from "../components/ui";
import { clearHistory, historyStats, loadHistory } from "../lib/history";
import { useToast } from "../components/Toast";
import type { ExportRecord } from "../lib/types";

function when(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function HistoryScreen() {
  const toast = useToast();
  const [entries, setEntries] = useState<ExportRecord[]>(() => loadHistory());
  const stats = historyStats(entries);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Records"
        title="Output History"
        description="Recent exports from this workstation (last 50). File contents live in your Downloads or chosen output folder — regenerate to retrieve a lost file."
        actions={
          entries.length > 0 && (
            <Button
              variant="danger"
              icon={Eraser}
              onClick={() => {
                clearHistory();
                setEntries([]);
                toast.info("History cleared");
              }}
            >
              Clear history
            </Button>
          )
        }
      />

      {entries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="text-3xl font-extrabold text-navy-900">{stats.exports}</div>
            <div className="text-[12px] font-semibold text-navy-500">Exports performed</div>
          </Card>
          <Card className="p-5">
            <div className="text-3xl font-extrabold text-navy-900">{stats.certificates}</div>
            <div className="text-[12px] font-semibold text-navy-500">Certificates produced</div>
          </Card>
          <Card className="p-5">
            <div className="text-3xl font-extrabold text-gold-600">{stats.successRate}%</div>
            <div className="text-[12px] font-semibold text-navy-500">Row success rate</div>
          </Card>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No exports yet"
          body="Generate certificates in Bulk or Individual mode and every export will be logged here."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="bg-navy-50/70 text-left">
                <th className="px-5 py-3 font-bold text-navy-500">Export</th>
                <th className="px-3 py-3 font-bold text-navy-500">Type</th>
                <th className="px-3 py-3 font-bold text-navy-500">When</th>
                <th className="px-3 py-3 text-center font-bold text-navy-500">Generated</th>
                <th className="px-3 py-3 text-center font-bold text-navy-500">Skipped</th>
                <th className="px-3 py-3 text-center font-bold text-navy-500">Failed</th>
                <th className="px-5 py-3 font-bold text-navy-500">Saved via</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-navy-50">
                  <td className="max-w-[280px] truncate px-5 py-3">
                    <span className="flex items-center gap-2 font-medium text-navy-800">
                      {e.kind === "bulk" ? (
                        <Archive className="size-4 shrink-0 text-gold-600" />
                      ) : (
                        <UserRound className="size-4 shrink-0 text-navy-500" />
                      )}
                      <span className="truncate font-mono text-[12px]">{e.fileName}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={e.kind === "bulk" ? "gold" : "navy"}>{e.kind === "bulk" ? "Bulk batch" : "Individual"}</Badge>
                  </td>
                  <td className="px-3 py-3 text-navy-500">{when(e.at)}</td>
                  <td className="px-3 py-3 text-center"><Badge tone="green">{e.succeeded}</Badge></td>
                  <td className="px-3 py-3 text-center"><Badge tone={e.skipped ? "amber" : "gray"}>{e.skipped}</Badge></td>
                  <td className="px-3 py-3 text-center"><Badge tone={e.failed ? "red" : "gray"}>{e.failed}</Badge></td>
                  <td className="px-5 py-3 text-navy-500">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <FileDown className="size-3.5" />
                      {e.destination === "folder" ? "Chosen folder" : "Downloads"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
