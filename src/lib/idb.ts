/**
 * Tiny promise wrapper over IndexedDB used to persist the uploaded
 * certificate template, custom font files and the output-folder handle.
 * Falls back to an in-memory map when IndexedDB is unavailable.
 */

const DB_NAME = "basix-certificate-studio";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback = new Map<string, unknown>();
let usingFallback = false;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
  return dbPromise;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (usingFallback) {
    memoryFallback.set(key, value);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    memoryFallback.set(key, value);
  } catch {
    usingFallback = true;
    memoryFallback.set(key, value);
  }
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (memoryFallback.has(key)) return memoryFallback.get(key) as T;
  if (usingFallback) return undefined;
  try {
    const db = await openDb();
    const out = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    if (out !== undefined) memoryFallback.set(key, out);
    return out;
  } catch {
    usingFallback = true;
    return undefined;
  }
}

export async function idbDel(key: string): Promise<void> {
  memoryFallback.delete(key);
  if (usingFallback) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    usingFallback = true;
  }
}

export async function idbKeysWithPrefix(prefix: string): Promise<string[]> {
  const keys = new Set<string>(
    [...memoryFallback.keys()].filter((k) => k.startsWith(prefix)),
  );
  if (usingFallback) return [...keys];
  try {
    const db = await openDb();
    const all = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () =>
        resolve(req.result.filter((k): k is string => typeof k === "string"));
      req.onerror = () => reject(req.error);
    });
    all.filter((k) => k.startsWith(prefix)).forEach((k) => keys.add(k));
  } catch {
    usingFallback = true;
  }
  return [...keys];
}
