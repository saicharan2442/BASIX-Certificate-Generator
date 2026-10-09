import { jsPDF } from "jspdf";
import { certificateFileName } from "./filenames";
import { renderCertificate } from "./renderer";
import type { LayoutConfig, StudentRecord } from "./types";

/**
 * PDF creation. The rendered certificate canvas is embedded full-bleed on
 * a 3:2 landscape page (297×198 mm) — the same artwork space as the
 * reference canvas, so positions hold exactly.
 */

export const PAGE_W_MM = 297;
export const PAGE_H_MM = 198;

export type ImageFormat = "jpeg" | "png";

export interface PdfQuality {
  /** 2 ≈ 263 DPI at 297 mm width, 3 ≈ 395 DPI */
  scale: 1 | 2 | 3;
  format: ImageFormat;
  jpegQuality: number;
}

export const DEFAULT_QUALITY: PdfQuality = {
  scale: 2,
  format: "jpeg",
  jpegQuality: 0.96,
};

export interface GeneratedCertificate {
  blob: Blob;
  fileName: string;
  warnings: string[];
  widthPx: number;
  heightPx: number;
}

export async function generateCertificatePdf(
  rec: StudentRecord,
  layout: LayoutConfig,
  quality: PdfQuality = DEFAULT_QUALITY,
): Promise<GeneratedCertificate> {
  const { canvas, warnings } = await renderCertificate(rec, layout, {
    scale: quality.scale,
  });

  const dataUrl =
    quality.format === "png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", quality.jpegQuality);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PAGE_W_MM, PAGE_H_MM],
    compress: quality.format !== "png",
  });
  doc.setProperties({
    title: `BASIX Certificate — ${rec.studentName}`,
    subject: rec.courseName,
    author: "BASIX Computer Education",
    keywords: "BASIX, certificate, completion",
    creator: "BASIX Certificate Generator",
  });
  doc.addImage(
    dataUrl,
    quality.format === "png" ? "PNG" : "JPEG",
    0,
    0,
    PAGE_W_MM,
    PAGE_H_MM,
    undefined,
    "FAST",
  );

  return {
    blob: doc.output("blob"),
    fileName: certificateFileName(rec.studentId, rec.studentName),
    warnings,
    widthPx: canvas.width,
    heightPx: canvas.height,
  };
}
