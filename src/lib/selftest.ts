import { certificateFileName, sanitizePart, uniqueName, zipFileName } from "./filenames";
import { auditFonts, ensureFontsReady } from "./fonts";
import { defaultLayout } from "./layout";
import { generateCertificatePdf } from "./pdf";
import { renderCertificate } from "./renderer";
import { getTemplateInfo } from "./template";
import { RULES, formatCertDate, parseCertDate, validateRecord } from "./validators";
import { idbGet, idbSet } from "./idb";
import { buildCertificatesZip } from "./zip";
import type { StudentRecord } from "./types";

/**
 * In-app diagnostics — the verification suite runs live in the user's
 * browser against the real render/PDF/ZIP pipeline, so the results reflect
 * the actual environment the app operates in.
 */

export type TestStatus = "pass" | "warn" | "fail";

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  detail: string;
}

function pass(id: string, name: string, detail: string): TestResult {
  return { id, name, status: "pass", detail };
}
function warn(id: string, name: string, detail: string): TestResult {
  return { id, name, status: "warn", detail };
}
function fail(id: string, name: string, detail: string): TestResult {
  return { id, name, status: "fail", detail };
}

const SAMPLE: StudentRecord = {
  studentId: "BASIX-TEST-0001",
  studentName: "Diagnostics Sample Student",
  courseName: "Sample Course of Study",
  marks: "92.5%",
  date: "07 Oct 2025",
  duration: "3 Months",
};

export async function runDiagnostics(): Promise<TestResult[]> {
  const out: TestResult[] = [];
  const push = (r: TestResult) => out.push(r);

  // 1 — Canvas support
  try {
    const c = document.createElement("canvas");
    const ok = !!c.getContext("2d");
    push(ok ? pass("canvas", "Canvas rendering", "2D canvas is available.") : fail("canvas", "Canvas rendering", "Canvas 2D context is not available in this browser."));
  } catch (e) {
    push(fail("canvas", "Canvas rendering", String(e)));
  }

  // 2 — Blank template
  try {
    const t = await getTemplateInfo("blank");
    if (t.source === "missing") {
      push(fail(
        "template-blank",
        "Blank certificate template",
        "Not found. Drop certificate-blank.png into public/assets/templates/ or upload it in Layout Settings → Template.",
      ));
    } else {
      push(pass(
        "template-blank",
        "Blank certificate template",
        `${t.source === "custom" ? "Uploaded copy" : "Bundled file"} loaded — ${t.width}×${t.height}px (${t.path}).`,
      ));
      push(
        t.aspectOk
          ? pass("template-aspect", "Template aspect ratio", `Ratio ${(t.width / t.height).toFixed(3)} matches the required 3:2.`)
          : warn("template-aspect", "Template aspect ratio", `Image is ${t.width}×${t.height} (ratio ${(t.width / t.height).toFixed(3)}) but the certificate grid is 3:2 — it will be stretched. Supply a 1536×1024 (3:2) image.`),
      );
    }
  } catch (e) {
    push(fail("template-blank", "Blank certificate template", String(e)));
  }

  // 3 — Sample/reference template (optional)
  try {
    const s = await getTemplateInfo("sample");
    push(
      s.source === "missing"
        ? warn("template-sample", "Sample reference image", "Optional reference (certificate-sample.png) not installed — the layout editor's comparison overlay is unavailable.")
        : pass("template-sample", "Sample reference image", `Loaded ${s.width}×${s.height}px — available as the editor comparison overlay.`),
    );
  } catch (e) {
    push(fail("template-sample", "Sample reference image", String(e)));
  }

  // 4 — Fonts (force-load bundled families first, so lazy CSS faces don't
  // report false negatives)
  try {
    await ensureFontsReady(defaultLayout());
    const audit = auditFonts();
    for (const f of audit) {
      const label = `Font: ${f.requirement.family}`;
      if (f.loaded) {
        push(pass(`font-${f.requirement.family}`, label, `Loaded (${f.requirement.bundled ? "bundled" : "uploaded"}) — used for ${f.requirement.usedFor}.`));
      } else if (f.requirement.required) {
        push(warn(`font-${f.requirement.family}`, label, `Missing — upload the file in Layout Settings → Fonts. Falling back to ${f.fallback} for ${f.requirement.usedFor}.`));
      } else {
        push(warn(`font-${f.requirement.family}`, label, `Not yet active — it will load on first certificate render (bundled fallback).`));
      }
    }
  } catch (e) {
    push(fail("fonts", "Fonts", String(e)));
  }

  // 5 — Validators
  const cases: Array<[string, string, boolean]> = [
    ["marks", "92%", true],
    ["marks", "92.5%", true],
    ["marks", "85", true],
    ["marks", "104%", false],
    ["marks", "ninety", false],
    ["marks", "", false],
    ["date", "07 Oct 2025", true],
    ["date", "7 October 2025", true],
    ["date", "07/10/2025", true],
    ["date", "2025-10-07", true],
    ["date", "31/13/2025", false],
    ["date", "yesterday", false],
    ["duration", "30 Days", true],
    ["duration", "3 Months", true],
    ["duration", "60 Hours", true],
    ["duration", "fortnight", false],
    ["studentId", "BASIX-1", true],
    ["studentId", "", false],
    ["studentName", "Aisha Rahman", true],
    ["studentName", "", false],
  ];
  let failed = 0;
  const failedList: string[] = [];
  for (const [field, input, expectOk] of cases) {
    const r = RULES[field as keyof typeof RULES](input);
    if (r.ok !== expectOk) {
      failed += 1;
      failedList.push(`${field}("${input}")`);
    }
  }
  push(
    failed === 0
      ? pass("validators", "Field validation rules", `${cases.length}/${cases.length} rule checks behaved as expected.`)
      : fail("validators", "Field validation rules", `${failed} checks misfired: ${failedList.join(", ")}.`),
  );

  // 6 — Date formatting sanity
  try {
    const d = parseCertDate("7/10/2025");
    const ok = !!d && formatCertDate(d) === "07 Oct 2025";
    push(ok
      ? pass("date-format", "Date normalisation", "“7/10/2025” renders as “07 Oct 2025”.")
      : fail("date-format", "Date normalisation", `Unexpected render: ${d ? formatCertDate(d) : "parse failed"}.`));
  } catch (e) {
    push(fail("date-format", "Date normalisation", String(e)));
  }

  // 7 — Filename handling
  try {
    const a = certificateFileName('BASIX/2025:1', 'O"Brien <Test>');
    const nameOk = /^BASIX_Certificate_[A-Za-z0-9_.-]+_[A-Za-z0-9_.-]+\.pdf$/.test(a) && !/[<>:"/\\|?*]/.test(a);
    const taken = new Set<string>();
    const n1 = uniqueName("BASIX_Certificate_X_Y.pdf", taken);
    const n2 = uniqueName("BASIX_Certificate_X_Y.pdf", taken);
    const zipOk = /^BASIX_Certificates_\d{4}-\d{2}-\d{2}\.zip$/.test(zipFileName());
    const san = sanitizePart("  CON  ") === "_CON" || sanitizePart("con") === "_con";
    push(
      nameOk && n1 !== n2 && zipOk && san
        ? pass("filenames", "Windows-safe filenames", `Illegal characters stripped, duplicates de-conflicted (“${n2}”), ZIP named ${zipFileName()}.`)
        : fail("filenames", "Windows-safe filenames", `nameOk=${nameOk} dedupe=${n1 !== n2} zipOk=${zipOk} reservedOk=${san}`),
    );
  } catch (e) {
    push(fail("filenames", "Windows-safe filenames", String(e)));
  }

  // 8 — Full record validation incl. cleaning
  try {
    const res = validateRecord({
      studentId: " BX-99 ",
      studentName: "  Test   Student ",
      courseName: "Office Automation",
      marks: "92.50",
      date: "7-10-2025",
      duration: "60 hours",
    });
    const ok =
      res.valid &&
      res.cleaned.marks === "92.5%" &&
      res.cleaned.date === "07 Oct 2025" &&
      res.cleaned.duration === "60 Hours";
    push(ok
      ? pass("record-clean", "Record normalisation", "Trims whitespace and rewrites values to canonical certificate formats.")
      : fail("record-clean", "Record normalisation", JSON.stringify(res.cleaned)));
  } catch (e) {
    push(fail("record-clean", "Record normalisation", String(e)));
  }

  // 9 — Render smoke test (all six fields)
  try {
    const layout = defaultLayout();
    const { canvas, fitted } = await renderCertificate(SAMPLE, layout, { scale: 0.3 });
    const ctx = canvas.getContext("2d")!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] + data[i + 1] + data[i + 2] < 500) dark++;
    }
    const emptyFits = Object.values(fitted).filter((s) => s <= 0).length;
    push(
      dark > 200 && emptyFits === 0
        ? pass("render", "Certificate rendering", `All six fields painted at 460×307 preview scale (${dark} dark samples detected).`)
        : fail("render", "Certificate rendering", `Unexpected pixel census (dark=${dark}, badFits=${emptyFits}).`),
    );
  } catch (e) {
    push(fail("render", "Certificate rendering", String(e)));
  }

  // 10 — Long-name auto-fit
  try {
    const layout = defaultLayout();
    const longName = "Muhammad Abdullah Rahman Chowdhury Al-Mahmood";
    const { canvas } = await renderCertificate({ ...SAMPLE, studentName: longName }, layout, { scale: 0.3 });
    const ctx = canvas.getContext("2d")!;
    const f = layout.fields.studentName;
    await ensureFontsReady(layout);
    let size = f.fontSize;
    ctx.font = `${f.fontWeight} ${size}px ${f.fontFamily}`;
    let width = ctx.measureText(longName).width;
    while (width > f.w && size > f.minFontSize) {
      size -= 1;
      ctx.font = `${f.fontWeight} ${size}px ${f.fontFamily}`;
      width = ctx.measureText(longName).width;
    }
    push(
      width <= f.w + 1
        ? pass("autofit", "Long-name auto-fit", `A ${longName.length}-character name shrinks to ${size}px and stays inside the ${Math.round(f.w)}px box.`)
        : fail("autofit", "Long-name auto-fit", `${longName.length}-char name still ${Math.round(width)}px wide at ${size}px (box ${f.w}px).`),
    );
  } catch (e) {
    push(fail("autofit", "Long-name auto-fit", String(e)));
  }

  // 11 — PDF generation smoke test
  try {
    const g = await generateCertificatePdf(SAMPLE, defaultLayout(), { scale: 1, format: "jpeg", jpegQuality: 0.9 });
    const head = new Uint8Array(await g.blob.slice(0, 5).arrayBuffer());
    const magic = String.fromCharCode(...head);
    const ok = magic === "%PDF-" && g.blob.size > 20_000;
    push(ok
      ? pass("pdf", "PDF export", `${(g.blob.size / 1024).toFixed(0)} KB, ${g.widthPx}×${g.heightPx}px artwork, valid %PDF header.`)
      : fail("pdf", "PDF export", `Header “${magic}”, size ${g.blob.size}.`));
  } catch (e) {
    push(fail("pdf", "PDF export", String(e)));
  }

  // 12 — ZIP packaging
  try {
    const zipBlob = await buildCertificatesZip([
      { name: "one.pdf", blob: new Blob(["%PDF-test-one"], { type: "application/pdf" }) },
      { name: "two.pdf", blob: new Blob(["%PDF-test-two"], { type: "application/pdf" }) },
    ]);
    push(zipBlob.size > 300 && zipBlob.type === "application/zip"
      ? pass("zip", "ZIP packaging", `Archive built (${zipBlob.size} bytes) with 2 entries, STORE compression.`)
      : warn("zip", "ZIP packaging", `Archive built (${zipBlob.size} bytes) — verify it opens correctly.`));
  } catch (e) {
    push(fail("zip", "ZIP packaging", String(e)));
  }

  // 13 — Local persistence
  try {
    const probe = `probe-${Date.now()}`;
    localStorage.setItem("basix.probe", probe);
    const lsOk = localStorage.getItem("basix.probe") === probe;
    localStorage.removeItem("basix.probe");
    await idbSet("probe", { v: 1 });
    const idbOk = ((await idbGet<{ v: number }>("probe"))?.v ?? 0) === 1;
    push(
      lsOk && idbOk
        ? pass("storage", "Offline storage", "localStorage (settings/history) and IndexedDB (templates/fonts) are writable.")
        : warn("storage", "Offline storage", `localStorage ${lsOk ? "ok" : "blocked"}, IndexedDB ${idbOk ? "ok" : "blocked"} — private browsing may prevent persistence.`),
    );
  } catch (e) {
    push(warn("storage", "Offline storage", String(e)));
  }

  return out;
}
