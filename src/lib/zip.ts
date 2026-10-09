import JSZip from "jszip";
import { saveAs } from "file-saver";

/** ZIP packaging + browser download helpers. */

export interface ZipItem {
  name: string;
  blob: Blob;
}

/**
 * Build a ZIP that contains ONLY the certificate PDFs — never the source
 * Excel file, config JSONs or temporary images.
 */
export async function buildCertificatesZip(items: ZipItem[]): Promise<Blob> {
  if (!items.length) throw new Error("There are no certificates to add to the ZIP.");
  const zip = new JSZip();
  for (const item of items) {
    zip.file(item.name, item.blob);
  }
  // PDFs barely compress; STORE keeps big batches fast.
  return zip.generateAsync({
    type: "blob",
    compression: "STORE",
    comment: "BASIX Certificates",
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  saveAs(blob, fileName);
}

/** Minimal CSV writer with correct quoting. */
export function toCsv(rows: string[][]): string {
  const esc = (cell: string) => {
    if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
