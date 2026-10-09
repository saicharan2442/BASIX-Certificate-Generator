import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadLayout, saveLayout } from "../lib/layout";
import type { FieldConfig, FieldKey, LayoutConfig } from "../lib/types";
import { loadStoredCustomFonts } from "../lib/fonts";
import { getStoredOutputFolder } from "../lib/fsAccess";

/**
 * Shared application state: layout configuration (persisted), an asset
 * version counter (bumped when templates/fonts change so every preview
 * re-renders), and the optional File System Access output folder.
 */

interface AppState {
  layout: LayoutConfig;
  updateField: (key: FieldKey, patch: Partial<FieldConfig>) => void;
  replaceLayout: (l: LayoutConfig) => void;
  assetsVersion: number;
  bumpAssets: () => void;
  outputDir: FileSystemDirectoryHandle | null;
  setOutputDir: (h: FileSystemDirectoryHandle | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutConfig>(() => loadLayout());
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [outputDir, setOutputDirState] = useState<FileSystemDirectoryHandle | null>(null);

  useEffect(() => {
    // Warm up persisted custom fonts + remembered folder at startup.
    loadStoredCustomFonts().then((loaded) => {
      if (loaded.length) setAssetsVersion((v) => v + 1);
    });
    getStoredOutputFolder().then((h) => {
      if (h) setOutputDirState(h);
    });
  }, []);

  const replaceLayout = useCallback((l: LayoutConfig) => {
    setLayout(l);
    saveLayout(l);
  }, []);

  const updateField = useCallback((key: FieldKey, patch: Partial<FieldConfig>) => {
    setLayout((prev) => {
      const next: LayoutConfig = {
        ...prev,
        fields: { ...prev.fields, [key]: { ...prev.fields[key], ...patch } },
      };
      saveLayout(next);
      return next;
    });
  }, []);

  const bumpAssets = useCallback(() => setAssetsVersion((v) => v + 1), []);

  const setOutputDir = useCallback((h: FileSystemDirectoryHandle | null) => {
    setOutputDirState(h);
  }, []);

  const value = useMemo<AppState>(
    () => ({ layout, updateField, replaceLayout, assetsVersion, bumpAssets, outputDir, setOutputDir }),
    [layout, updateField, replaceLayout, assetsVersion, bumpAssets, outputDir, setOutputDir],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
