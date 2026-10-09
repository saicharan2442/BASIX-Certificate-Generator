import { idbDel, idbGet, idbSet } from "./idb";

/**
 * File System Access API (Chrome/Edge on Windows): lets the operator pick a
 * real output folder once; certificates and ZIPs are then written straight
 * into it without extra "Save as…" clicks. Browsers without the API fall
 * back to normal downloads — nothing is lost or silently skipped.
 */

const DIR_KEY = "output:directory";

interface DirPickerWindow {
  showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  }
}

export function folderPickerSupported(): boolean {
  return typeof (window as DirPickerWindow).showDirectoryPicker === "function";
}

export async function pickOutputFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker;
  if (!picker) return null;
  try {
    const handle = await picker({ mode: "readwrite" });
    await idbSet(DIR_KEY, handle);
    return handle;
  } catch (err) {
    // User cancelled — not an error worth surfacing.
    if ((err as DOMException)?.name === "AbortError") return null;
    throw err;
  }
}

export async function getStoredOutputFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await idbGet<FileSystemDirectoryHandle>(DIR_KEY);
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function forgetOutputFolder(): Promise<void> {
  await idbDel(DIR_KEY);
}

async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const anyHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  if (!anyHandle.queryPermission || !anyHandle.requestPermission) return true;
  const opts = { mode: "readwrite" };
  if ((await anyHandle.queryPermission(opts)) === "granted") return true;
  if (!request) return false;
  return (await anyHandle.requestPermission(opts)) === "granted";
}

export async function ensureFolderPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    return await verifyPermission(handle, true);
  } catch {
    return false;
  }
}

async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name, { create: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a blob into the folder, never overwriting an existing file —
 * "name.pdf", "name_2.pdf", "name_3.pdf" … Returns the actual name used.
 */
export async function saveBlobToFolder(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob,
): Promise<string> {
  const ok = await ensureFolderPermission(dir);
  if (!ok) throw new Error("Permission to write to the selected folder was not granted.");

  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";

  let candidate = fileName;
  let n = 2;
  while (await fileExists(dir, candidate)) {
    candidate = `${base}_${n}${ext}`;
    n += 1;
  }

  const fh = await dir.getFileHandle(candidate, { create: true });
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
  return candidate;
}
