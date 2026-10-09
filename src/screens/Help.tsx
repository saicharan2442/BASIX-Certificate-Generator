import { CircleHelp, FileSpreadsheet, FileType2, FolderOpen, Images, KeyRound, LocateFixed, PackageCheck, ShieldCheck } from "lucide-react";
import { Card, SectionHeader } from "../components/ui";
import type { ReactNode } from "react";

function QA({ title, icon: Icon, children }: { title: string; icon: typeof CircleHelp; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-navy-100 bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-navy-600 transition-colors group-open:bg-gold-100 group-open:text-gold-700">
          <Icon className="size-4.5" />
        </span>
        <span className="text-[14px] font-bold text-navy-900">{title}</span>
        <span className="ml-auto text-navy-300 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-navy-50 px-5 py-4 text-[13px] leading-relaxed text-navy-600">
        {children}
      </div>
    </details>
  );
}

const code = (s: string) => (
  <code className="rounded bg-navy-100 px-1.5 py-0.5 font-mono text-[11.5px] text-navy-800">{s}</code>
);

/** Operator guide — plain language, no technical background assumed. */
export function HelpScreen() {
  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Guide"
        title="Help & Setup"
        description="Everything a receptionist or administrator needs to run certificates day to day."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <QA title="Excel file format for bulk generation" icon={FileSpreadsheet}>
            <p className="mb-2">One header row, then one student per row. Column names are matched automatically; you can always re-map them in step 2. Expected columns:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Student ID</b> — required, unique. Also accepted: ID, Roll No, Reg No…</li>
              <li><b>Student Name</b> — required.</li>
              <li><b>Course Name</b> — or set one default course for the whole batch.</li>
              <li><b>Marks Obtained</b> — {code("92%")} or {code("92.5%")} (plain numbers also work).</li>
              <li><b>Completion Date</b> — {code("07 Oct 2025")}, {code("07/10/2025")}, {code("2025-10-07")}…</li>
              <li><b>Duration</b> — {code("30 Days")}, {code("3 Months")}, {code("60 Hours")}…</li>
            </ul>
            <p className="mt-2">Real typed dates and percentages in Excel are read in their displayed format. Use Bulk → “Download sample workbook” for a ready-made example (including rows that intentionally fail, so staff can practise the validation screen).</p>
          </QA>

          <QA title="Installing the real certificate artwork" icon={Images}>
            <p className="mb-2">Drop the institute's blank certificate (no student text) at {code("public/assets/templates/certificate-blank.png")} before building, or use <b>Layout Settings → Template → Upload</b> — the upload is kept on this computer. Ideal: <b>1536×1024 px (3:2)</b> PNG at ≥ 260 DPI equivalent.</p>
            <p>The completed example goes to {code("certificate-sample.png")} — it is only used as a comparison overlay in the position editor. Until the blank image is installed, an explicit placeholder renders instead, so nothing is ever silently substituted.</p>
          </QA>

          <QA title="Licensed fonts (Angeletta, Noto Serif Ethiopic Condensed)" icon={FileType2}>
            <p className="mb-2">Poppins, Great Vibes and Noto Serif Ethiopic travel inside the app. The two licensed fonts are uploaded once via <b>Layout Settings → Fonts → Upload font file</b>:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{code("Angeletta.ttf")} / {code("Angeletta.otf")} → student names (while missing, <i>Great Vibes</i> stands in)</li>
              <li>{code("NotoSerifEthiopicCondensed*.ttf")} → the marks value (while missing, the regular width is used)</li>
            </ul>
            <p className="mt-2">Fonts persist in the browser profile; Layout Settings shows ✓ Ready for each once installed.</p>
          </QA>

          <QA title="Adjusting a field's position" icon={LocateFixed}>
            <p>Open <b>Layout Settings</b>, click a field chip (or drag its dashed box straight on the preview), then fine-tune X / Y / width / height / size / colour / alignment. Turn on <b>Field guides</b> on the Preview screen to cross-check every box at once, and the <b>Reference overlay</b> to compare against the completed certificate. Use <b>Export JSON</b> to keep a backup before experimenting.</p>
          </QA>
        </div>

        <div className="space-y-4">
          <QA title="Where do files go? (output folder)" icon={FolderOpen}>
            <p className="mb-2">By default, PDFs and ZIPs arrive like any browser download (usually <i>Downloads</i>, following the browser's "ask where to save" setting).</p>
            <p>In Chrome or Edge you can instead pick a real folder once — e.g. {code("D:\BASIX\Certificates")} — via <b>Individual → Choose Folder &amp; Save</b>. After that, bulk runs write every PDF (and optionally the ZIP) directly into it. Existing files are never overwritten: {code("_2")}, {code("_3")}… suffixes are added automatically.</p>
          </QA>

          <QA title="Fixing invalid rows" icon={CircleHelp}>
            <p className="mb-2">The validation table highlights the exact cell and reason: missing ID, missing name, marks above 100% or not a number, an unparseable date, a duplicate ID. Open the row with the pencil icon and correct it — validation re-runs live. Rows you cannot fix stay <b>skipped</b>: they are excluded from the ZIP but always listed in the final report and the CSV export, so no student quietly disappears.</p>
          </QA>

          <QA title="ZIP contents & filenames" icon={PackageCheck}>
            <p>ZIP = only the successfully generated certificate PDFs, named {code("BASIX_Certificate_<ID>_<Name>.pdf")}. The archive itself is dated: {code("BASIX_Certificates_2026-10-09.zip")}. Characters Windows forbids in filenames are cleaned up automatically, and same-name duplicates get numbered suffixes.</p>
          </QA>

          <QA title="Privacy & offline behaviour" icon={ShieldCheck}>
            <p>Everything runs on this computer: Excel parsing, rendering, PDF and ZIP creation happen in RAM. Nothing is uploaded, tracked or synced. After the first load the app works without any internet connection.</p>
          </QA>

          <QA title="Keyboard & accessibility notes" icon={KeyRound}>
            <p>All dialogs close with <kbd className="rounded bg-navy-100 px-1.5 py-0.5 text-[11px]">Esc</kbd>. Controls are reachable with Tab; the position editor also accepts precise numeric input so a mouse is never required for pixel-exact placement.</p>
          </QA>
        </div>
      </div>

      <Card className="border-gold-200 bg-gold-50/60 p-5 text-[12.5px] leading-relaxed text-navy-700">
        <b className="text-navy-900">Reference grid:</b> 1536 × 1024 px (3:2). Spec boxes — Student ID (1223.5, 189.5, 239, 21), Name (326.3, 454.2, 916.7, 96.1), Marks (1319.9, 582.2, 101.5, 33.1), Date (691.7, 717, 148.7, 21), Duration (677.3, 776.2, 175.8, 21). X/Y are top-left coordinates; every box can be adjusted in Layout Settings.
      </Card>
    </div>
  );
}
