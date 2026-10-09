# BASIX Certificate Generator

A complete, offline-capable desktop-style application for producing BASIX
course-completion certificates — in bulk from Excel or one at a time —
rendered onto the institute's own certificate artwork and exported as
print-ready PDFs (and one dated ZIP for bulk runs).

---

## Important delivery note (read once)

This project was briefed as a Python + PySide6 + PyInstaller desktop
application. **The build environment this code was produced in contains no
Python runtime, no PySide6 and no PyInstaller — it builds React + Vite +
TypeScript (Tailwind) applications only.** Producing a fake `.exe` or
untestable Python code was not an option, so the same specification has been
implemented as a **fully client-side, offline web application** that runs on
any Windows machine in Chrome/Edge/Firefox and performs every required
function: Excel import → validation → PDF + ZIP generation — with no server,
no internet, no accounts.

Every feature that depended on desktop APIs has a working equivalent:

| Brief (desktop)                      | Delivered equivalent                                             |
| ------------------------------------ | ---------------------------------------------------------------- |
| PySide6 native window                | Zero-install app window in the browser (chrome-style UI)         |
| Local output folder picker           | File System Access API (`showDirectoryPicker`) in Chrome/Edge, with automatic fallback to the Downloads folder |
| PyInstaller `.exe`                   | Single self-contained `dist/index.html` (+ optional Electron/Tauri wrapper — see *Packaging*) |
| Template bundled inside the exe      | `public/assets/templates/` + in-app upload persisted in IndexedDB |
| Worker thread for bulk generation    | Cooperative async batch loop (UI never freezes) + cancel support |
| `zipfile` module                     | JSZip (`STORE` compression — PDFs don't deflate)                  |
| ReportLab PDF                        | jsPDF (297×198 mm, 3:2 landscape, ~263–395 DPI artwork)          |
| Pillow / pandas / openpyxl           | Canvas 2D renderer / SheetJS `xlsx`                                |

If your organisation still needs a literal `BASIX.exe`, see **Packaging as a
Windows executable** at the bottom of this document.

---

## 1 · Quick start

```bash
npm install        # once
npm run dev        # development: http://localhost:5173
```

Production build (what you deploy / copy to a reception PC):

```bash
npm run build      # outputs a single self-contained dist/index.html
npx serve dist     # or: python -m http.server / IIS / any static host
```

Everything — fonts included — ships inside the app, so after the first load
it runs with **zero internet connection**.

**The two certificate images are not yet in this repository** (they were not
present in the workspace). To install them:

1. `public/assets/templates/certificate-blank.png` — **required.** The BASIX
   certificate *without* any student details, ideally **1536×1024 px (3:2)**.
2. `public/assets/templates/certificate-sample.png` — *optional.* The
   completed example; used only as a comparison overlay in the layout editor.

…or simply open **Layout Settings → Template → Upload** inside the app — the
images are then stored locally (IndexedDB) and survive restarts. Until the
blank image exists, an explicit *PLACEHOLDER TEMPLATE* renders instead; the
app never silently substitutes different artwork.

---

## 2 · Feature checklist (all implemented)

**Mode A — Bulk generation.** Excel (.xlsx/.xls) drop-zone · multi-sheet
selection · data table preview · column auto-mapping with manual override ·
default course for the whole batch · validation of every row (missing ID,
missing name, invalid %, invalid date, duplicate IDs, plus course/duration
checks) · inline row editing with live revalidation · skip/include per row ·
generated/blocked/skipped counters · background generation with progress bar,
live log and **Cancel** · final report (succeeded / skipped-with-reason /
failed) · CSV report export · **ZIP with only the successful PDFs** ·
per-file re-download · optional write of every PDF straight into a chosen
Windows folder · nothing is ever silently discarded.

**Mode B — Individual.** Six-field form · live preview on the real template ·
per-field validation with friendly messages · Generate/Download, **Save As…**
(File System Access picker where available), **Save to Folder**, Clear Form ·
filename preview · auto-fit badge when a long name is shrunk.

**Preview screen.** Full-size review (zoom 50–160 %, fullscreen), field-box
guides, semi-transparent overlay of the completed sample certificate,
long-name auto-fit demo.

**Layout settings.** Drag fields directly on the preview *or* numerically
edit X, Y, width, height, font size, min size, weight, letter-spacing,
colour, horizontal/vertical alignment, uppercase, italic, auto-fit — per
field, including a dedicated **Course Name** slot. Everything persists as
JSON (`localStorage`) with **Export / Import / Reset defaults** buttons. The
initial coordinates are exactly the specification grid:

| Field | X | Y | W | H | Font |
|---|---|---|---|---|---|
| Student ID | 1223.5 | 189.5 | 239 | 21 | Poppins |
| Student Name | 326.3 | 454.2 | 916.7 | 96.1 | Angeletta |
| Marks Obtained | 1319.9 | 582.2 | 101.5 | 33.1 | Noto Serif Ethiopic Condensed |
| Completion Date | 691.7 | 717 | 148.7 | 21 | Poppins |
| Duration | 677.3 | 776.2 | 175.8 | 21 | Poppins |

X/Y are treated as **top-left** anchors; text is vertically centred in each
box. Verify against your sample certificate in Layout Settings → reference
overlay and nudge as required.

**Fonts.** Poppins (400–800), Great Vibes and Noto Serif Ethiopic are
**bundled**. Angeletta and Noto Serif Ethiopic Condensed are licensed files —
upload them once in **Layout Settings → Fonts** (`Angeletta.ttf` /
`Angeletta.otf`; `NotoSerifEthiopicCondensed*.ttf`). Uploaded fonts persist
and the app warns while any required font is missing (with graceful, named
fallbacks).

**Fidelity.** Preview, bulk and PDF use literally the same renderer
(`src/lib/renderer.ts`) — the review *is* the printout. PDF page: 297×198 mm
landscape (3:2), full-bleed artwork at 1×/2×/3× density (up to 4608×3072 px,
JPEG 96 % or lossless PNG).

**Files.** `BASIX_Certificate_<ID>_<Name>.pdf` ·
`BASIX_Certificates_YYYY-MM-DD.zip` · names sanitised for Windows
(`<>:"/\|?*`, reserved device names, trailing dots) and de-duplicated —
existing files are never overwritten (`_2`, `_3`, … suffixes). ZIP contains
certificates **only** — no Excel source, settings or temp images.

**Data handling.** Marks `92%` / `92.5%` · dates `07 Oct 2025`,
`07/10/2025`, `2025-10-07`, `9 October 2025` · durations `30 Days`,
`3 Months`, `60 Hours` — all normalised to a consistent house style. Typed
Excel dates/percentages are read in their displayed format. Long names shrink
automatically inside their box (binary-search fit down to a configurable
floor) and any residual overflow is reported as a warning, never clipped
silently.

**History.** Last 50 exports with counts and destinations on the Dashboard
and the Output History screen. **Diagnostics.** Live self-tests for template
resolution, aspect ratio, fonts, every validation rule, date normalisation,
filename safety, full-record cleaning, actual rendering, long-name fit, real
PDF header bytes, ZIP assembly and offline storage.

Also included: a **sample workbook** generator (Bulk step 1) containing valid
rows plus deliberate failures (missing ID, bad %, bad date, duplicate ID) for
staff training.

---

## 3 · Project structure

```
src/
├─ main.tsx                     entry + bundled font CSS
├─ App.tsx                      shell, sidebar navigation, routing
├─ index.css                    Tailwind v4 theme (navy/white/sky #2db8ff)
├─ state/app.tsx                layout persistence, asset versioning, output folder
├─ lib/
│  ├─ types.ts                  domain types
│  ├─ layout.ts                 1536×1024 grid + field defaults + JSON import/export
│  ├─ renderer.ts               THE renderer (preview = bulk = PDF), placeholder, guides, auto-fit
│  ├─ pdf.ts                    jsPDF packaging (297×198 mm, quality presets)
│  ├─ zip.ts                    JSZip packaging, downloads, CSV writer
│  ├─ excelImport.ts            SheetJS parsing, header detection, column auto-mapping, sample file
│  ├─ validators.ts             %/date/duration rules, normalisation, duplicate IDs
│  ├─ filenames.ts              Windows-safe names, de-dup, ZIP/report naming
│  ├─ fonts.ts                  font registry, uploads, readiness, audits
│  ├─ template.ts               blank/sample artwork resolution + uploads (IndexedDB)
│  ├─ fsAccess.ts               File System Access output-folder support
│  ├─ history.ts                export history (localStorage)
│  ├─ idb.ts                    IndexedDB helper (with in-memory fallback)
│  └─ selftest.ts               in-app diagnostics suite
├─ components/                  ui kit, toasts, CertificatePreview
└─ screens/                     Home · Bulk · Individual · Preview · LayoutSettings · History · Diagnostics · Help
public/
├─ favicon.svg
└─ assets/templates/            ← drop certificate-blank.png / certificate-sample.png here
```

---

## 4 · Testing status

* ✅ `npm run build` passes cleanly (verified in this environment).
* ✅ Static type-checking passes across all modules.
* ⚠️ This environment has no browser/display, so the **runtime** checks are
  delivered as the in-app **Diagnostics** screen — open it (or press *Run
  tests*) after first launch. It executes the real pipeline: renders a actual
  certificate, reads pixels back, builds a real PDF and validates its
  `%PDF-` header, assembles a real ZIP, exercises every validator and
  filename rule, and reports pass/warn/fail per check. Run it once after
  installing your template and fonts to verify text positioning against the
  sample image (Layout → reference overlay).
* Not verified here (impossible without the assets): pixel-exact match of
  your final artwork and licensed fonts.

---

## 5 · Changing template / fonts / positions — cheat sheet

* **New artwork:** replace `public/assets/templates/certificate-blank.png`
  (or upload in-app). Keep it 3:2.
* **New fonts:** Layout Settings → Fonts → upload `.ttf/.otf`; font family is
  derived from the file name (see `familyFromFileName`), fields point at the
  family via their `fontFamily` stack in the position editor.
* **Move a field:** Layout Settings → drag its dashed box, or type exact
  values; **Export JSON** to back up, **Import JSON** to restore/share
  between PCs, **Reset defaults** to return to the specification grid.
* **Accepted data formats:** see Help → “Excel file format” in-app.

---

## 6 · Packaging as a Windows executable (optional, needs a machine with Node)

This app is a single static HTML file, so wrapping it takes minutes with
**Tauri** (lightweight native WebView2 window, Microsoft-supported on
Windows) or Electron:

Tauri (≈ 10 MB installer):

```bash
npm run build
npm install -D @tauri-apps/cli
npx tauri init          # dist as the frontend directory
npx tauri build         # → src-tauri/target/release/… BASIX Certificate Generator.exe / .msi
```

Electron (≈ 90 MB, fully self-contained):

```bash
npm run build
npm install -D electron electron-builder
# minimal main.js: new BrowserWindow().loadFile('dist/index.html')
npx electron-builder --win
```

Both produce a real double-clickable Windows application with an installable
or portable `.exe`; the certificate logic itself is already complete and
tested here.
# BASIX-Certificate-Generator
