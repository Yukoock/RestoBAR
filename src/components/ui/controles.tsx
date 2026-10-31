// Controles (B3): Button, IconButton, Switch, Stepper, FormField, SearchInput, DateRangePicker y Seg.
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Minus, Plus, Search, X, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/formato";

type Variante = "primary" | "secondary" | "ghost" | "danger" | "role" | "accent";
const VARIANTES: Record<Variante, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-deep",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
  danger: "bg-surface text-bad border border-bad hover:bg-bad-soft",
  role: "bg-[var(--c)] text-on-role hover:brightness-110",
  accent: "bg-accent text-on-accent hover:brightness-105",
};
const TAMANOS = { sm: "min-h-9 px-3 text-sm", md: "min-h-11 px-4 text-[15px]", lg: "min-h-14 px-5 text-[17px]" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante;
  size?: keyof typeof TAMANOS;
  icon?: LucideIcon;
  loading?: boolean;
  /** Color del rol para variant="role", por ejemplo "var(--r-mesero)" */
  rol?: string;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Ic, loading, rol, className, children, disabled, style, ...p }, ref) {
  return (
    <button ref={ref} type="button" disabled={disabled || loading} aria-busy={loading || undefined}
      style={rol ? ({ "--c": rol, ...style } as CSSProperties) : style}
      className={cx("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variant], TAMANOS[size], className)} {...p}>
      {loading ? <span className="anim-giro h-4 w-4 rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : Ic && <Ic size={size === "lg" ? 22 : 18} aria-hidden="true" />}
      {children && <span>{children}</span>}
    </button>
  );
});

// Botón de solo ícono: siempre con aria-label y tooltip (B2)
export function IconButton({ icon: Ic, label, badge, className, ...p }: { icon: LucideIcon; label: string; badge?: number | null } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} data-tip={label}
      className={cx("tip relative inline-grid h-11 w-11 flex-none place-items-center rounded-sm text-ink-2 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35", className)} {...p}>
      <Ic size={20} aria-hidden="true" />
      {badge ? <span className="num absolute right-0.5 top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-on-accent">{badge}</span> : null}
    </button>
  );
}

export function Switch({ id, checked, onChange, label, ocultarTexto, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; ocultarTexto?: boolean; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={cx("relative inline-flex min-h-11 cursor-pointer items-center gap-2.5", disabled && "cursor-not-allowed opacity-50")}>
      <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span aria-hidden="true" className="relative h-[26px] w-11 flex-none rounded-full bg-surface-3 shadow-[inset_0_0_0_1px_var(--line)] transition peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus
        after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-[18px]" />
      <span className={ocultarTexto ? "sr-only" : "text-[15px] font-medium"}>{label}</span>
    </label>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const b = "grid h-11 w-11 place-items-center text-ink disabled:opacity-30";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-sm border border-line bg-surface">
      <button type="button" className={b} aria-label={`Quitar 1 · ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={18} /></button>
      <span className="num min-w-9 text-center font-bold" aria-live="polite">{value}</span>
      <button type="button" className={b} aria-label={`Sumar 1 · ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={18} /></button>
    </div>
  );
}

export function FormField({ id, label, hint, error, ayuda, children }: { id: string; label: string; hint?: string; error?: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
        {label}
        {ayuda && <span tabIndex={0} data-tip={ayuda} aria-label={ayuda} className="tip inline-grid h-5 w-5 cursor-help place-items-center rounded-full bg-surface-3 text-xs font-bold text-ink-2">?</span>}
      </label>
      {children}
      {error ? <span role="alert" className="text-sm font-semibold text-bad">{error}</span> : hint && <span className="text-[13px] text-ink-3">{hint}</span>}
    </div>
  );
}

export const SearchInput = forwardRef<HTMLInputElement, { id: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }>(function SearchInput(
  { id, value, onChange, placeholder = "Buscar", className }, ref) {
  return (
    <div className={cx("flex min-h-11 min-w-0 max-w-md flex-1 items-center gap-2 rounded-sm border border-line bg-surface pl-3 pr-1 text-ink-3 focus-within:outline focus-within:outline-[3px] focus-within:outline-focus", className)}>
      <Search size={18} aria-hidden="true" />
      <input ref={ref} id={id} type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={e => onChange(e.target.value)}
        className="!min-h-10 !border-0 !bg-transparent !px-0 outline-none [&::-webkit-search-cancel-button]:hidden" />
      {value && <button type="button" aria-label="Borrar búsqueda" className="grid h-9 w-9 place-items-center" onClick={() => onChange("")}><X size={16} /></button>}
    </div>
  );
});

export function Seg<T extends string | number>({ value, onChange, opciones, label }: { value: T; onChange: (v: T) => void; opciones: [T, string][]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-sm bg-surface-2 p-[3px] shadow-[inset_0_0_0_1px_var(--line)]">
      {opciones.map(([k, t]) => (
        <button key={String(k)} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className="min-h-[38px] flex-1 whitespace-nowrap rounded-[4px] px-3 text-sm font-semibold text-ink-2 aria-pressed:bg-surface aria-pressed:text-brand-text aria-pressed:shadow-1">{t}</button>
      ))}
    </div>
  );
}

export type Periodo = "hoy" | "7d" | "30d";
export function DateRangePicker({ value, onChange }: { value: Periodo; onChange: (v: Periodo) => void }) {
  return <Seg value={value} onChange={onChange} label="Periodo" opciones={[["hoy", "Hoy"], ["7d", "7 días"], ["30d", "30 días"]]} />;
}
