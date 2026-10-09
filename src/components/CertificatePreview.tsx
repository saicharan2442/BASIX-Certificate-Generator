import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldKey, LayoutConfig, StudentRecord } from "../lib/types";
import { renderCertificate, type RenderResult } from "../lib/renderer";
import { cn } from "../utils/cn";

/**
 * Live certificate preview. Paints with the exact renderer used for PDF
 * export, so what you see here is precisely what will be printed.
 */

interface Props {
  record: StudentRecord;
  layout: LayoutConfig;
  /** render resolution multiplier (independent of on-screen size) */
  scale?: number;
  showGuides?: boolean;
  showReference?: boolean;
  referenceOpacity?: number;
  activeField?: FieldKey | null;
  /** bump to force re-render (e.g. template/fonts changed) */
  refreshKey?: unknown;
  className?: string;
  onRendered?: (r: RenderResult) => void;
  /** enables drag-to-move of field boxes (layout editor) */
  onFieldDrag?: (key: FieldKey, x: number, y: number) => void;
  onFieldSelect?: (key: FieldKey) => void;
}

export function CertificatePreview({
  record,
  layout,
  scale = 1.5,
  showGuides,
  showReference,
  referenceOpacity,
  activeField,
  refreshKey,
  className,
  onRendered,
  onFieldDrag,
  onFieldSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;
  const dragRef = useRef<{ key: FieldKey; grabDX: number; grabDY: number } | null>(null);

  const recordJson = useMemo(() => JSON.stringify(record), [record]);
  const layoutJson = useMemo(() => JSON.stringify(layout), [layout]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      renderCertificate(JSON.parse(recordJson), JSON.parse(layoutJson), {
        scale,
        showGuides: showGuides || !!onFieldDrag,
        showReference,
        referenceOpacity,
        activeField,
      })
        .then((result) => {
          if (cancelled) return;
          const host = hostRef.current;
          if (host) {
            result.canvas.style.width = "100%";
            result.canvas.style.height = "auto";
            result.canvas.style.display = "block";
            result.canvas.style.borderRadius = "4px";
            host.replaceChildren(result.canvas);
          }
          onRenderedRef.current?.(result);
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setBusy(false));
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recordJson, layoutJson, scale, showGuides, showReference, referenceOpacity, activeField, refreshKey, onFieldDrag]);

  const canvasPoint = (e: React.PointerEvent): { x: number; y: number } | null => {
    const host = hostRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 1536,
      y: ((e.clientY - rect.top) / rect.height) * 1024,
    };
  };

  const hitField = (x: number, y: number): FieldKey | null => {
    // smallest box first so small fields win over big overlapping ones
    const entries = (Object.entries(layout.fields) as Array<[FieldKey, LayoutConfig["fields"][FieldKey]]>).sort(
      (a, b) => a[1].w * a[1].h - b[1].w * b[1].h,
    );
    for (const [key, f] of entries) {
      if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return key;
    }
    return null;
  };

  return (
    <div
      ref={hostRef}
      className={cn(
        "relative aspect-[3/2] w-full touch-none overflow-hidden rounded-lg bg-[#eceef3] shadow-[0_2px_6px_rgba(13,27,62,0.12),0_24px_48px_-24px_rgba(13,27,62,0.35)] ring-1 ring-navy-900/10 transition-opacity",
        busy && "opacity-90",
        onFieldDrag && "cursor-grab active:cursor-grabbing",
        className,
      )}
      onPointerDown={(e) => {
        if (!onFieldDrag) return;
        const pt = canvasPoint(e);
        if (!pt) return;
        const key = hitField(pt.x, pt.y);
        if (!key) return;
        const f = layout.fields[key];
        dragRef.current = { key, grabDX: pt.x - f.x, grabDY: pt.y - f.y };
        onFieldSelect?.(key);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || !onFieldDrag) return;
        const pt = canvasPoint(e);
        if (!pt) return;
        const f = layout.fields[drag.key];
        const x = Math.round(Math.max(0, Math.min(1536 - f.w, pt.x - drag.grabDX)) * 10) / 10;
        const y = Math.round(Math.max(0, Math.min(1024 - f.h, pt.y - drag.grabDY)) * 10) / 10;
        onFieldDrag(drag.key, x, y);
      }}
      onPointerUp={(e) => {
        dragRef.current = null;
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      }}
    >
      {/* the rendered canvas is injected here */}
    </div>
  );
}
