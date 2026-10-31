// Contenedores (B3): Card, StatCard, Modal, Drawer, BottomSheet y Menu «⋯».
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/formato";
import { IconButton } from "./controles";
import { Skeleton } from "./estados";

export function Card({ className, children, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("flex min-w-0 flex-col gap-3 rounded-md bg-surface p-[18px] shadow-1", className)} {...p}>{children}</div>;
}

export function Sparkline({ datos, color = "var(--brand)" }: { datos: number[]; color?: string }) {
  if (datos.length < 2) return null;
  const max = Math.max(...datos), min = Math.min(...datos), W = 100, H = 34;
  const pts = datos.map((v, i) => [(i / (datos.length - 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const fin = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[34px] w-full" aria-hidden="true">
      <path d={`${d} L${W} ${H} L0 ${H}Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={fin[0]} cy={fin[1]} r="2.5" fill={color} />
    </svg>
  );
}

export function StatCard({ label, valor, delta, comparacion, serie, color, cargando, onClick }:
  { label: string; valor: ReactNode; delta?: number; comparacion?: string; serie?: number[]; color?: string; cargando?: boolean; onClick?: () => void }) {
  if (cargando) return <Card><Skeleton h={14} w="50%" /><Skeleton h={30} w="70%" /><Skeleton h={34} /></Card>;
  const contenido = (
    <>
      <span className="text-sm font-semibold text-ink-3">{label}</span>
      <strong className="num font-display text-xl font-extrabold">{valor}</strong>
      {delta != null && (
        <span className={cx("text-[13px] font-bold", delta >= 0 ? "text-ok" : "text-bad")}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} % <span className="font-medium text-ink-3">{comparacion}</span>
        </span>
      )}
      {serie && <Sparkline datos={serie} color={color} />}
    </>
  );
  const clase = "flex min-w-0 flex-col gap-1.5 rounded-md bg-surface p-[18px] text-left shadow-1";
  return onClick
    ? <button type="button" onClick={onClick} className={cx(clase, "hover:shadow-[0_0_0_2px_var(--brand)]")}>{contenido}</button>
    : <div className={clase}>{contenido}</div>;
}

// Cierra con Escape y devuelve el foco a donde estaba al cerrar
function useDialogo(alCerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>("[data-autofocus]") || el)?.focus();
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", f);
    return () => { window.removeEventListener("keydown", f); previo?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}
const Capa = ({ children, onClose, className }: { children: ReactNode; onClose: () => void; className?: string }) =>
  createPortal(
    <div className={cx("anim-aparece fixed inset-0 z-[80] grid bg-[var(--scrim)]", className)} onMouseDown={e => e.target === e.currentTarget && onClose()}>{children}</div>,
    document.body,
  );
const Cabecera = ({ titulo, sub, onClose }: { titulo: string; sub?: string; onClose: () => void }) => (
  <header className="flex items-start justify-between gap-3 px-[22px] pb-2.5 pr-[18px] pt-[18px]">
    <div><h2 className="text-lg font-extrabold">{titulo}</h2>{sub && <p className="text-sm text-ink-3">{sub}</p>}</div>
    <IconButton icon={X} label="Cerrar" onClick={onClose} />
  </header>
);

export function Modal({ titulo, onClose, children, pie, ancho = 560 }: { titulo: string; onClose: () => void; children: ReactNode; pie?: ReactNode; ancho?: number }) {
  const ref = useDialogo(onClose);
  return (
    <Capa onClose={onClose} className="place-items-center p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} style={{ maxWidth: ancho }}
        className="flex max-h-[calc(100vh-32px)] w-full flex-col rounded-lg bg-surface shadow-2 outline-none">
        <Cabecera titulo={titulo} onClose={onClose} />
        <div className="flex flex-col gap-3.5 overflow-auto px-[22px] pb-[18px]">{children}</div>
        {pie && <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line px-[18px] py-3.5">{pie}</footer>}
      </div>
    </Capa>
  );
}

export function Drawer({ titulo, sub, onClose, children, pie }: { titulo: string; sub?: string; onClose: () => void; children: ReactNode; pie?: ReactNode }) {
  const ref = useDialogo(onClose);
  return (
    <Capa onClose={onClose} className="justify-items-end">
      <aside ref={ref} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}
        className="anim-entra flex h-full w-[min(560px,100vw)] flex-col bg-surface shadow-2 outline-none">
        <Cabecera titulo={titulo} sub={sub} onClose={onClose} />
        <div className="flex flex-1 flex-col gap-3.5 overflow-auto px-[22px] pb-[22px]">{children}</div>
        {pie && <footer className="flex flex-wrap items-center gap-2.5 border-t border-line px-[18px] py-3.5">{pie}</footer>}
      </aside>
    </Capa>
  );
}

export function BottomSheet({ titulo, onClose, children, pie }: { titulo: string; onClose: () => void; children: ReactNode; pie?: ReactNode }) {
  const ref = useDialogo(onClose);
  return (
    <Capa onClose={onClose} className="items-end justify-items-center">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}
        className="anim-sube flex max-h-[88vh] w-full max-w-[560px] flex-col rounded-t-lg bg-surface outline-none">
        <div className="mx-auto mt-2 h-1 w-10 rounded bg-surface-3" aria-hidden="true" />
        <Cabecera titulo={titulo} onClose={onClose} />
        <div className="flex flex-col gap-3 overflow-auto px-[18px] pb-4">{children}</div>
        {pie && <footer className="border-t border-line px-[18px] pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{pie}</footer>}
      </div>
    </Capa>
  );
}

export interface ItemMenu { label: string; icon?: LucideIcon; onClick: () => void; peligro?: boolean }
// Menú «⋯»: aquí van las acciones secundarias y las destructivas (B2)
export function Menu({ items, label = "Más acciones" }: { items: (ItemMenu | "-" | false | null | undefined)[]; label?: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div ref={ref} className="relative inline-flex">
      <IconButton icon={MoreHorizontal} label={label} aria-haspopup="menu" aria-expanded={abierto} onClick={e => { e.stopPropagation(); setAbierto(!abierto); }} />
      {abierto && (
        <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-[70] flex min-w-[220px] flex-col rounded-md bg-surface p-1.5 shadow-2">
          {items.filter(Boolean).map((it, i) => it === "-" ? <hr key={i} className="my-1 border-line" /> : (
            <button key={i} type="button" role="menuitem" onClick={e => { e.stopPropagation(); setAbierto(false); (it as ItemMenu).onClick(); }}
              className={cx("flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-sm px-3 text-left font-medium hover:bg-surface-2", (it as ItemMenu).peligro && "text-bad")}>
              {(() => { const Ic = (it as ItemMenu).icon; return Ic ? <Ic size={18} aria-hidden="true" /> : null; })()}
              {(it as ItemMenu).label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
