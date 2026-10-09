import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect } from "react";
import { Loader2, X, type LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger" | "subtle" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-navy-700 text-white hover:bg-navy-600 shadow-sm",
  gold: "bg-gold-500 text-navy-900 hover:bg-gold-400 shadow-sm font-semibold",
  outline: "bg-white text-navy-800 border border-navy-200 hover:border-navy-400 hover:bg-navy-50",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-100/70",
  subtle: "bg-navy-100/70 text-navy-800 hover:bg-navy-100",
  danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm",
};

const buttonSizes = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap font-medium tracking-tight transition-all duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
        "disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        Icon && <Icon className="size-4" strokeWidth={2.2} />
      )}
      {children}
    </button>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  hover,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-navy-100 bg-white shadow-[0_1px_2px_rgba(13,27,62,0.05),0_8px_24px_-12px_rgba(13,27,62,0.12)]",
        hover && "transition-all duration-200 hover:shadow-[0_2px_4px_rgba(13,27,62,0.06),0_16px_40px_-12px_rgba(13,27,62,0.22)] hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Section header ----------------------------- */

export function SectionHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {kicker && (
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">
            {kicker}
          </div>
        )}
        <h2 className="text-xl font-bold tracking-tight text-navy-900">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------- Inputs --------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-navy-800">
        {label}
        {error && <span className="text-[11px] font-medium text-red-600">{error}</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] leading-snug text-navy-400">{hint}</span>}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-navy-900 placeholder:text-navy-300 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500",
          invalid ? "border-red-300 bg-red-50/40" : "border-navy-200 hover:border-navy-300",
          className,
        )}
        {...rest}
      />
    );
  },
);

export function SelectInput({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-900 transition-colors hover:border-navy-300",
        "focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ---------------------------------- Toggle --------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("group inline-flex cursor-pointer items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed")}
    >
      <span
        className={cn(
          "relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-gold-500" : "bg-navy-200 group-hover:bg-navy-300",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
      {label && <span className="text-[13px] font-medium text-navy-700">{label}</span>}
    </button>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

type Tone = "navy" | "gold" | "green" | "red" | "amber" | "gray";

const tones: Record<Tone, string> = {
  navy: "bg-navy-100 text-navy-800",
  gold: "bg-gold-100 text-gold-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  gray: "bg-gray-100 text-gray-600",
};

export function Badge({ tone = "navy", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight", tones[tone], className)}>
      {children}
    </span>
  );
}

/* -------------------------------- Progress bar ------------------------------ */

export function ProgressBar({
  value,
  className,
  animated,
}: {
  value: number;
  className?: string;
  animated?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-navy-100", className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-500 to-gold-400 transition-all duration-300", animated && "progress-sheen")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* --------------------------------- Empty state ------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 px-8 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-navy-400 shadow-sm">
        <Icon className="size-7" strokeWidth={1.6} />
      </div>
      <div className="text-[15px] font-bold text-navy-800">{title}</div>
      {body && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-navy-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ----------------------------------- Alert ---------------------------------- */

export function Alert({
  tone = "amber",
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: "amber" | "red" | "blue" | "green";
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-navy-200 bg-navy-50 text-navy-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3.5", styles, className)}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0 opacity-70" />}
      <div className="min-w-0">
        <div className="text-[13px] font-bold">{title}</div>
        {children && <div className="mt-0.5 text-[12.5px] leading-relaxed opacity-85">{children}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative max-h-[88vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <div className="text-[15px] font-bold text-navy-900">{title}</div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
            aria-label="Close"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[calc(88vh-8.5rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-navy-100 bg-navy-50/50 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
