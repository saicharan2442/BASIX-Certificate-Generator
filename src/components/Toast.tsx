import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../utils/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  push: (tone: ToastTone, title: string, body?: string) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
  warning: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const STYLES: Record<ToastTone, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: "border-emerald-200", iconColor: "text-emerald-500" },
  error: { icon: XCircle, ring: "border-red-200", iconColor: "text-red-500" },
  info: { icon: Info, ring: "border-navy-200", iconColor: "text-navy-500" },
  warning: { icon: AlertTriangle, ring: "border-amber-200", iconColor: "text-amber-500" },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, body?: string) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-4), { id, tone, title, body }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, b) => push("success", t, b),
      error: (t, b) => push("error", t, b),
      info: (t, b) => push("info", t, b),
      warning: (t, b) => push("warning", t, b),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLES[t.tone];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 px-4 py-3 shadow-[0_12px_32px_-10px_rgba(13,27,62,0.35)] backdrop-blur animate-toast-in",
                s.ring,
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", s.iconColor)} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-navy-900">{t.title}</div>
                {t.body && <div className="mt-0.5 text-[12px] leading-snug text-navy-500">{t.body}</div>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="mt-0.5 text-navy-300 transition-colors hover:text-navy-600"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
