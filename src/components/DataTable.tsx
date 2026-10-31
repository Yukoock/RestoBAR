// DataTable (B4): un solo patrón de tabla para Pedidos, Productos, Ingredientes, Compras, Proveedores,
// Gastos, Facturas, Usuarios y Mesas. En celular (menos de 768 px) se convierte en tarjetas.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Columns3, FileSpreadsheet, FileText, Printer, Search, X, type LucideIcon } from "lucide-react";
import { cx, sinTildes } from "@/lib/formato";
import { useDebounce, useMedia } from "@/lib/hooks";
import { Button, SearchInput } from "./ui/controles";
import { Menu, type ItemMenu } from "./ui/contenedores";
import { Chip, EmptyState, ErrorState, Skeleton } from "./ui/estados";

export interface Columna<T> {
  clave: string;
  titulo: string;
  render?: (fila: T) => ReactNode;
  /** Texto plano para exportar e imprimir */
  texto?: (fila: T) => string | number;
  /** Valor para ordenar. Si no se da, la columna no se ordena. */
  orden?: (fila: T) => string | number;
  derecha?: boolean;
  oculta?: boolean;
}
export interface Filtro<T> { id: string; titulo: string; f: (fila: T) => boolean }

interface Props<T> {
  id: string;
  titulo: string;
  filas: T[];
  clave: (fila: T) => string;
  columnas: Columna<T>[];
  cargando?: boolean;
  error?: unknown;
  onReintentar?: () => void;
  buscar?: (fila: T) => string;
  filtros?: Filtro<T>[];
  filtroInicial?: string;
  /** Una sola acción visible por fila (B4); el resto va en «⋯» */
  accion?: { titulo: string; icon?: LucideIcon; onClick: (fila: T) => void };
  menu?: (fila: T) => (ItemMenu | "-" | false | null | undefined)[];
  masivas?: { titulo: string; icon?: LucideIcon; peligro?: boolean; onClick: (filas: T[]) => void }[];
  onFila?: (fila: T) => void;
  arriba?: ReactNode;
  vacio?: { icon: LucideIcon; titulo: string; texto?: string; accion?: { label: string; icon?: LucideIcon; onClick: () => void } };
  tarjeta?: (fila: T) => ReactNode;
  onExportar?: (tipo: "excel" | "pdf" | "imprimir", filas: T[], columnas: Columna<T>[]) => void;
}

export function DataTable<T>(p: Props<T>) {
  const movil = useMedia("(max-width: 767px)");
  const [q, setQ] = useState("");
  const qDeb = useDebounce(q, 300);
  const [filtro, setFiltro] = useState(p.filtroInicial || p.filtros?.[0]?.id || "");
  const [orden, setOrden] = useState<{ clave: string; dir: "asc" | "desc" } | null>(null);
  const [ocultas, setOcultas] = useState<string[]>(() => {
    try { const g = localStorage.getItem("restobar-cols-" + p.id); if (g) return JSON.parse(g); } catch { /* nada */ }
    return p.columnas.filter(c => c.oculta).map(c => c.clave);
  });
  const [sel, setSel] = useState<string[]>([]);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(20);
  const [verCols, setVerCols] = useState(false);
  const refCols = useRef<HTMLDivElement>(null);

  useEffect(() => { if (p.filtroInicial) setFiltro(p.filtroInicial); }, [p.filtroInicial]);
  useEffect(() => { setPagina(0); }, [qDeb, filtro, porPagina]);
  useEffect(() => { try { localStorage.setItem("restobar-cols-" + p.id, JSON.stringify(ocultas)); } catch { /* nada */ } }, [ocultas, p.id]);
  useEffect(() => {
    if (!verCols) return;
    const f = (e: MouseEvent) => { if (refCols.current && !refCols.current.contains(e.target as Node)) setVerCols(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, [verCols]);

  const porFiltro = useMemo(() => Object.fromEntries((p.filtros || []).map(f => [f.id, p.filas.filter(f.f)])), [p.filas, p.filtros]);
  const visibles = useMemo(() => {
    let r = p.filtros ? porFiltro[filtro] || p.filas : p.filas;
    if (qDeb && p.buscar) { const t = sinTildes(qDeb); r = r.filter(x => sinTildes(p.buscar!(x)).includes(t)); }
    if (orden) {
      const c = p.columnas.find(x => x.clave === orden.clave);
      if (c?.orden) r = [...r].sort((a, b) => { const A = c.orden!(a), B = c.orden!(b); return (A > B ? 1 : A < B ? -1 : 0) * (orden.dir === "asc" ? 1 : -1); });
    }
    return r;
  }, [p.filas, porFiltro, filtro, qDeb, orden, p.columnas, p.buscar, p.filtros]);

  const cols = p.columnas.filter(c => !ocultas.includes(c.clave));
  const totalPag = Math.max(1, Math.ceil(visibles.length / porPagina));
  const pag = Math.min(pagina, totalPag - 1);
  const filasPag = visibles.slice(pag * porPagina, pag * porPagina + porPagina);
  const elegidas = p.filas.filter(f => sel.includes(p.clave(f)));
  const todasPag = filasPag.length > 0 && filasPag.every(f => sel.includes(p.clave(f)));
  const hayAcciones = !!(p.accion || p.menu);
  const ordenar = (c: Columna<T>) => c.orden && setOrden(o => !o || o.clave !== c.clave ? { clave: c.clave, dir: "asc" } : o.dir === "asc" ? { clave: c.clave, dir: "desc" } : null);
  const exportar = (t: "excel" | "pdf" | "imprimir") => p.onExportar?.(t, visibles, cols);
  const desde = visibles.length ? pag * porPagina + 1 : 0, hasta = Math.min(visibles.length, pag * porPagina + porPagina);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {p.buscar && <SearchInput id={p.id + "-buscar"} value={q} onChange={setQ} placeholder="Buscar en la tabla" />}
        <div className="flex flex-wrap items-center gap-2">
          {p.arriba}
          <div ref={refCols} className="relative">
            <Button variant="ghost" icon={Columns3} aria-expanded={verCols} onClick={() => setVerCols(!verCols)}>Columnas</Button>
            {verCols && (
              <div role="group" aria-label="Mostrar u ocultar columnas" className="absolute right-0 top-[calc(100%+4px)] z-[70] flex min-w-[220px] flex-col rounded-md bg-surface p-1.5 shadow-2">
                {p.columnas.filter(c => c.titulo).map(c => (
                  <label key={c.clave} className="flex min-h-10 cursor-pointer items-center gap-2.5 whitespace-nowrap px-3">
                    <input type="checkbox" checked={!ocultas.includes(c.clave)} onChange={e => setOcultas(o => e.target.checked ? o.filter(x => x !== c.clave) : [...o, c.clave])} />{c.titulo}
                  </label>
                ))}
              </div>
            )}
          </div>
          {p.onExportar && <Menu label="Exportar" items={[{ label: "Exportar a Excel", icon: FileSpreadsheet, onClick: () => exportar("excel") }, { label: "Exportar a PDF", icon: FileText, onClick: () => exportar("pdf") }, { label: "Imprimir", icon: Printer, onClick: () => exportar("imprimir") }]} />}
        </div>
      </div>

      {p.filtros && (
        <div role="group" aria-label="Filtros" className="flex flex-wrap gap-2">
          {p.filtros.map(f => <Chip key={f.id} activo={filtro === f.id} contador={porFiltro[f.id]?.length ?? 0} onClick={() => setFiltro(f.id)}>{f.titulo}</Chip>)}
        </div>
      )}

      {p.masivas && elegidas.length > 0 && (
        <div role="region" aria-label="Acciones para las filas elegidas" className="flex flex-wrap items-center gap-2.5 rounded-md bg-brand-soft px-3.5 py-2.5">
          <strong className="num">{elegidas.length} elegidas</strong>
          {p.masivas.map(m => <Button key={m.titulo} icon={m.icon} variant={m.peligro ? "danger" : "secondary"} onClick={() => { m.onClick(elegidas); setSel([]); }}>{m.titulo}</Button>)}
          <Button variant="ghost" icon={X} onClick={() => setSel([])}>Quitar selección</Button>
        </div>
      )}

      {p.error ? (
        <div className="rounded-md bg-surface shadow-1"><ErrorState error={p.error} onRetry={p.onReintentar || (() => location.reload())} /></div>
      ) : p.cargando ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface p-3.5 shadow-1" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-4"><Skeleton h={18} w="18%" /><Skeleton h={18} w="42%" /><Skeleton h={18} w="20%" /></div>)}
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-md bg-surface shadow-1">
          {qDeb || (p.filtros && filtro !== (p.filtroInicial || p.filtros[0].id))
            ? <EmptyState icon={Search} titulo="No hay resultados" texto="Prueba con otra palabra o quita los filtros." accion={{ label: "Quitar filtros", icon: X, onClick: () => { setQ(""); setFiltro(p.filtroInicial || p.filtros?.[0]?.id || ""); } }} />
            : <EmptyState {...(p.vacio || { icon: Search, titulo: "Todavía no hay registros" })} />}
        </div>
      ) : movil ? (
        <ul className="flex flex-col gap-2.5">
          {filasPag.map(f => (
            <li key={p.clave(f)} onClick={p.onFila ? () => p.onFila!(f) : undefined} className={cx("flex flex-col gap-2 rounded-md bg-surface p-3.5 shadow-1", p.onFila && "cursor-pointer")}>
              {p.tarjeta ? p.tarjeta(f) : cols.filter(c => c.titulo).map(c => (
                <div key={c.clave} className="flex justify-between gap-3 text-[15px]"><span className="text-[13px] text-ink-3">{c.titulo}</span><span className="text-right">{c.render ? c.render(f) : String(c.texto?.(f) ?? "")}</span></div>
              ))}
              {hayAcciones && (
                <div className="flex items-center gap-1 border-t border-line pt-2" onClick={e => e.stopPropagation()}>
                  {p.accion && <Button icon={p.accion.icon} onClick={() => p.accion!.onClick(f)}>{p.accion.titulo}</Button>}
                  {p.menu && <Menu items={p.menu(f)} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-md bg-surface shadow-1">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {p.masivas && <th className="sticky top-0 z-[2] h-11 w-11 border-b border-line bg-surface-2 px-3"><input type="checkbox" aria-label="Elegir todas las filas de esta página" checked={todasPag}
                  onChange={e => setSel(s => e.target.checked ? [...new Set([...s, ...filasPag.map(p.clave)])] : s.filter(k => !filasPag.some(f => p.clave(f) === k)))} /></th>}
                {cols.map(c => {
                  const act = orden?.clave === c.clave;
                  return (
                    <th key={c.clave} aria-sort={act ? (orden!.dir === "asc" ? "ascending" : "descending") : c.orden ? "none" : undefined}
                      className={cx("sticky top-0 z-[2] h-11 whitespace-nowrap border-b border-line bg-surface-2 px-3 text-[13px] font-semibold text-ink-3", c.derecha ? "text-right" : "text-left")}>
                      {c.orden ? (
                        <button type="button" onClick={() => ordenar(c)} className="inline-flex items-center gap-1 py-2">
                          {c.titulo}{act ? (orden!.dir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ChevronDown size={14} className="opacity-50" />}
                        </button>
                      ) : c.titulo}
                    </th>
                  );
                })}
                {hayAcciones && <th className="sticky right-0 top-0 z-[3] w-px border-b border-line bg-surface-2 shadow-[-1px_0_0_var(--line)]"><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody>
              {filasPag.map(f => {
                const k = p.clave(f), elegida = sel.includes(k);
                return (
                  <tr key={k} onClick={p.onFila ? () => p.onFila!(f) : undefined} className={cx("group border-b border-line last:border-0", p.onFila && "cursor-pointer")}>
                    {p.masivas && <td className={cx("px-3", elegida ? "bg-brand-soft" : "group-hover:bg-surface-2")} onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Elegir fila" checked={elegida} onChange={e => setSel(s => e.target.checked ? [...s, k] : s.filter(x => x !== k))} /></td>}
                    {cols.map(c => <td key={c.clave} className={cx("px-3 py-2.5 align-middle", c.derecha && "num text-right", elegida ? "bg-brand-soft" : p.onFila && "group-hover:bg-surface-2")}>{c.render ? c.render(f) : String(c.texto?.(f) ?? "")}</td>)}
                    {hayAcciones && (
                      <td className="sticky right-0 whitespace-nowrap bg-surface shadow-[-1px_0_0_var(--line)] group-hover:bg-surface-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 px-1">
                          {p.accion && <Button variant="ghost" icon={p.accion.icon} onClick={() => p.accion!.onClick(f)}>{p.accion.titulo}</Button>}
                          {p.menu && <Menu items={p.menu(f)} />}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!p.cargando && !p.error && visibles.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3">
          <span className="num">Mostrando {desde}–{hasta} de {visibles.length}</span>
          <label className="flex items-center gap-2">Filas
            <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))} className="!min-h-9 !w-auto !px-2">{[8, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Página anterior" data-tip="Página anterior" disabled={pag === 0} onClick={() => setPagina(pag - 1)} className="tip grid h-11 w-11 place-items-center rounded-sm hover:bg-surface-2 disabled:opacity-35"><ChevronLeft size={18} /></button>
            <span className="num">{pag + 1} / {totalPag}</span>
            <button type="button" aria-label="Página siguiente" data-tip="Página siguiente" disabled={pag >= totalPag - 1} onClick={() => setPagina(pag + 1)} className="tip grid h-11 w-11 place-items-center rounded-sm hover:bg-surface-2 disabled:opacity-35"><ChevronRight size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
