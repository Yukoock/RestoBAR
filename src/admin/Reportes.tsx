// Centro de reportes (B6.2): tarjetas por categoría, buscador, favoritos, «último generado» y vista previa con PDF, Excel y envío.
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, ChevronRight, FileSpreadsheet, FileText, MessageCircle, Search, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { bs, cx, fecha, fechaHora, porcentaje, sinTildes } from "@/lib/formato";
import { CANALES, inicioDelDia, pagado } from "@/lib/datos";
import { cantidad, nivelStock } from "@/lib/catalogo";
import { exportarFilas } from "@/lib/exportar";
import type { Ingrediente, Pedido, Perfil } from "@/lib/tipos";
import { Button, Card, DateRangePicker, EmptyState, ErrorState, Modal, SearchInput, Skeleton, type Periodo } from "@/components/ui";

interface Resultado { cols: string[]; filas: (string | number)[][]; resumen?: string }
type Generador = (desde: Date, hasta: Date) => Promise<Resultado>;

const rango = (desde: Date, hasta: Date) => [desde.toISOString(), hasta.toISOString()] as const;
async function pedidosEn(desde: Date, hasta: Date): Promise<Pedido[]> {
  const [a, b] = rango(desde, hasta);
  const { data, error } = await supabase.from("pedidos").select("*, pedido_items(producto_id, nombre, cantidad, precio_unitario)").gte("created_at", a).lt("created_at", b).order("created_at");
  if (error) throw error;
  return (data || []) as Pedido[];
}
const validos = (ps: Pedido[]) => ps.filter(p => p.estado !== "anulado");
const suma = (ps: Pedido[]) => ps.filter(pagado).reduce((x, p) => x + Number(p.total), 0);

const REPORTES: Record<string, [string, string, Generador][]> = {
  Ventas: [
    ["ventas-dia", "Ventas por día", async (d, h) => {
      const ps = validos(await pedidosEn(d, h)), dias = [...new Set(ps.map(p => fecha(p.created_at)))];
      const filas = dias.map(x => { const del = ps.filter(p => fecha(p.created_at) === x), v = suma(del), n = del.filter(pagado).length; return [x, del.length, bs(v), bs(n ? v / n : 0)]; });
      return { cols: ["Día", "Pedidos", "Ventas cobradas", "Ticket promedio"], filas, resumen: `Total ${bs(suma(ps))} en ${ps.length} pedidos.` };
    }],
    ["ventas-producto", "Ventas por producto", async (d, h) => {
      const m: Record<string, { n: string; c: number; v: number }> = {};
      validos(await pedidosEn(d, h)).forEach(p => (p.pedido_items || []).forEach(i => { const k = i.producto_id || i.nombre; m[k] = m[k] || { n: i.nombre, c: 0, v: 0 }; m[k].c += i.cantidad; m[k].v += i.cantidad * Number(i.precio_unitario); }));
      const lista = Object.values(m).sort((a, b) => b.v - a.v), tot = lista.reduce((a, x) => a + x.v, 0) || 1;
      return { cols: ["Producto", "Cantidad", "Monto", "Del total"], filas: lista.map(x => [x.n, x.c, bs(x.v), porcentaje((x.v / tot) * 100)]), resumen: lista[0] ? `El más vendido es ${lista[0].n} con ${porcentaje((lista[0].v / tot) * 100)} de las ventas.` : undefined };
    }],
    ["ventas-canal", "Ventas por canal", async (d, h) => {
      const ps = validos(await pedidosEn(d, h));
      return { cols: ["Canal", "Pedidos", "Ventas cobradas"], filas: (Object.keys(CANALES) as (keyof typeof CANALES)[]).map(c => { const del = ps.filter(p => p.canal === c); return [CANALES[c].nombre, del.length, bs(suma(del))]; }).filter(f => f[1]) };
    }],
    ["descuentos", "Descuentos", async (d, h) => {
      const ps = validos(await pedidosEn(d, h)).filter(p => Number(p.propina) > 0);
      return { cols: ["Pedido", "Fecha", "Propina", "Total"], filas: ps.map(p => [`#${p.numero}`, fechaHora(p.created_at), bs(p.propina), bs(p.total)]),
        resumen: "Este sistema todavía no registra descuentos por pedido. Aquí ves las propinas cobradas, que también cambian el total." };
    }],
  ],
  Inventario: [
    ["stock", "Stock actual", async () => {
      const { data, error } = await supabase.from("ingredientes").select("*").order("nombre"); if (error) throw error;
      const ins = (data || []) as Ingrediente[], valor = ins.reduce((a, i) => a + Math.max(0, Number(i.stock)) * Number(i.costo_unitario), 0);
      return { cols: ["Insumo", "Stock", "Mínimo", "Estado", "Valor"], filas: ins.map(i => [i.nombre, `${cantidad(i.stock)} ${i.unidad}`, `${cantidad(i.minimo)} ${i.unidad}`, nivelStock(i)[0], bs(Math.max(0, Number(i.stock)) * Number(i.costo_unitario))]), resumen: `El inventario vale ${bs(valor)} a costo promedio.` };
    }],
    ["historico-ingrediente", "Histórico por ingrediente", async (d, h) => {
      const [a, b] = rango(d, h);
      const { data, error } = await supabase.from("movimientos_inventario").select("tipo, cantidad, ingredientes(nombre, unidad)").gte("created_at", a).lt("created_at", b); if (error) throw error;
      const m: Record<string, { u: string; e: number; s: number; v: number }> = {};
      (data as unknown as { tipo: string; cantidad: number; ingredientes: { nombre: string; unidad: string } }[]).forEach(x => { const k = x.ingredientes?.nombre || "—"; m[k] = m[k] || { u: x.ingredientes?.unidad || "", e: 0, s: 0, v: 0 }; if (x.tipo === "venta") m[k].v += -x.cantidad; else if (x.cantidad > 0) m[k].e += x.cantidad; else m[k].s += -x.cantidad; });
      return { cols: ["Insumo", "Entradas", "Salidas", "Usado en ventas", "Neto"], filas: Object.entries(m).map(([n, x]) => [n, `${cantidad(x.e)} ${x.u}`, `${cantidad(x.s)} ${x.u}`, `${cantidad(x.v)} ${x.u}`, `${cantidad(x.e - x.s - x.v)} ${x.u}`]) };
    }],
    ["salidas", "Salidas", async (d, h) => {
      const [a, b] = rango(d, h);
      const { data, error } = await supabase.from("movimientos_inventario").select("created_at, tipo, cantidad, motivo, ingredientes(nombre, unidad)").in("tipo", ["salida", "ajuste"]).lt("cantidad", 0).gte("created_at", a).lt("created_at", b).order("created_at"); if (error) throw error;
      return { cols: ["Fecha", "Insumo", "Cantidad", "Motivo"], filas: (data as unknown as { created_at: string; cantidad: number; motivo: string; ingredientes: { nombre: string; unidad: string } }[]).map(x => [fechaHora(x.created_at), x.ingredientes?.nombre, `${cantidad(-x.cantidad)} ${x.ingredientes?.unidad}`, x.motivo || ""]), resumen: "Mermas, daños y consumo del personal (las ventas se ven en el histórico)." };
    }],
  ],
  Finanzas: [
    ["situacion", "Situación del negocio", async (d, h) => {
      const ps = validos(await pedidosEn(d, h)).filter(pagado);
      const { data: prods } = await supabase.from("productos").select("id, costo");
      const costoDe = (id: string | null) => Number(prods?.find(p => p.id === id)?.costo || 0);
      const ventas = suma(ps), costo = ps.reduce((a, p) => a + (p.pedido_items || []).reduce((b, i) => b + i.cantidad * costoDe(i.producto_id), 0), 0);
      const { data: gs, error } = await supabase.from("gastos").select("monto").gte("fecha", d.toISOString().slice(0, 10)).lt("fecha", h.toISOString().slice(0, 10)); if (error) throw error;
      const gastos = (gs || []).reduce((a, g) => a + Number(g.monto), 0), resultado = ventas - costo - gastos;
      return { cols: ["Concepto", "Monto"], filas: [["Ventas cobradas", bs(ventas)], ["− Costo de lo vendido (según recetas)", bs(-costo)], ["= Ganancia bruta", bs(ventas - costo)], ["− Gastos y retiros", bs(-gastos)], ["= Resultado del periodo", bs(resultado)]],
        resumen: resultado >= 0 ? `El negocio dejó ${bs(resultado)} en el periodo.` : `En el periodo los gastos superaron la ganancia por ${bs(-resultado)}.` };
    }],
    ["gastos", "Gastos", async (d, h) => {
      const { data, error } = await supabase.from("gastos").select("monto, categorias_gasto(nombre)").gte("fecha", d.toISOString().slice(0, 10)).lt("fecha", h.toISOString().slice(0, 10)); if (error) throw error;
      const m: Record<string, { n: number; v: number }> = {};
      (data as unknown as { monto: number; categorias_gasto: { nombre: string } | null }[]).forEach(g => { const k = g.categorias_gasto?.nombre || "Sin categoría"; m[k] = m[k] || { n: 0, v: 0 }; m[k].n++; m[k].v += Number(g.monto); });
      const tot = Object.values(m).reduce((a, x) => a + x.v, 0) || 1;
      return { cols: ["Categoría", "Cantidad", "Monto", "Del total"], filas: Object.entries(m).sort((a, b) => b[1].v - a[1].v).map(([k, x]) => [k, x.n, bs(x.v), porcentaje((x.v / tot) * 100)]) };
    }],
    ["cobros-qr", "Cobros QR", async (d, h) => {
      const ps = validos(await pedidosEn(d, h)).filter(p => p.pago_metodo === "qr" || p.pago_metodo === "mixto");
      return { cols: ["Pedido", "Fecha", "Estado", "Monto por QR"], filas: ps.map(p => [`#${p.numero}`, fechaHora(p.pagado_at || p.created_at), p.pago_pendiente ? "Pendiente de abono" : "Exitosa", bs(p.pago_metodo === "mixto" ? Number(p.total) - Number(p.pago_efectivo || 0) : p.total)]) };
    }],
  ],
  Control: [
    ["anulados", "Pedidos anulados", async (d, h) => {
      const ps = (await pedidosEn(d, h)).filter(p => p.estado === "anulado");
      return { cols: ["Pedido", "Fecha", "Canal", "Motivo", "Total"], filas: ps.map(p => [`#${p.numero}`, fechaHora(p.created_at), CANALES[p.canal].nombre, p.motivo_anulacion || "", bs(p.total)]), resumen: `${ps.length} pedidos anulados por ${bs(ps.reduce((a, p) => a + Number(p.total), 0))}.` };
    }],
    ["delivery", "Envíos por delivery", async (d, h) => {
      const ps = validos(await pedidosEn(d, h)).filter(p => p.delivery_estado);
      const ESTADO = { asignado: "Asignado", recogido: "Recogido", en_camino: "En camino", entregado: "Entregado" };
      return { cols: ["Pedido", "Fecha", "Cliente", "Dirección", "Estado", "Envío", "Total"], filas: ps.map(p => [`#${p.numero}`, fechaHora(p.created_at), p.cliente || "", p.direccion || "Sin dirección", ESTADO[p.delivery_estado!], bs(p.envio), bs(p.total)]) };
    }],
    ["meseros", "Actividad por mesero", async (d, h) => {
      const ps = validos(await pedidosEn(d, h));
      const { data } = await supabase.from("perfiles").select("id, nombre, rol").eq("rol", "mesero");
      return { cols: ["Mesero", "Pedidos", "Ventas cobradas", "Ticket promedio"], filas: ((data || []) as Perfil[]).map(m => { const del = ps.filter(p => p.mesero_id === m.id), n = del.filter(pagado).length, v = suma(del); return [m.nombre, del.length, bs(v), bs(n ? v / n : 0)]; }) };
    }],
  ],
};
const TODOS = Object.entries(REPORTES).flatMap(([cat, rs]) => rs.map(([id, nombre, gen]) => ({ id, nombre, gen, cat })));
const leerLS = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardarLS = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };

export function Reportes() {
  const [q, setQ] = useState("");
  const [fav, setFav] = useState<string[]>(() => leerLS("restobar-rep-fav", ["ventas-dia", "situacion"]));
  const [ultimo, setUltimo] = useState<{ id: string; t: number } | null>(() => leerLS("restobar-rep-ultimo", null));
  const [abierto, setAbierto] = useState<string | null>(null);
  useEffect(() => guardarLS("restobar-rep-fav", fav), [fav]);
  const t = sinTildes(q);
  const abrir = (id: string) => { setAbierto(id); const u = { id, t: Date.now() }; setUltimo(u); guardarLS("restobar-rep-ultimo", u); };
  const rep = TODOS.find(r => r.id === abierto);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput id="rep-q" value={q} onChange={setQ} placeholder="Buscar un reporte" />
        {ultimo && TODOS.find(r => r.id === ultimo.id) && <span className="text-sm text-ink-3">Último generado: <button type="button" onClick={() => abrir(ultimo.id)} className="font-semibold text-brand-text underline">{TODOS.find(r => r.id === ultimo.id)!.nombre}</button> · {fechaHora(ultimo.t)}</span>}
      </div>
      {fav.length > 0 && !q && (
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-3">Favoritos:</span>
          {fav.map(id => TODOS.find(r => r.id === id)).filter(Boolean).map(r => <Button key={r!.id} size="sm" icon={Star} onClick={() => abrir(r!.id)}>{r!.nombre}</Button>)}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.keys(REPORTES).map(cat => {
          const items = TODOS.filter(r => r.cat === cat && sinTildes(r.nombre).includes(t));
          if (!items.length) return null;
          return (
            <Card key={cat}>
              <h3 className="font-bold">{cat}</h3>
              <ul className="flex flex-col">{items.map(r => (
                <li key={r.id} className="flex items-center border-b border-line last:border-0">
                  <button type="button" onClick={() => abrir(r.id)} className="flex min-h-11 flex-1 items-center justify-between px-1 text-left font-medium hover:text-brand-text">{r.nombre}<ChevronRight size={16} /></button>
                  <button type="button" aria-pressed={fav.includes(r.id)} aria-label={`${fav.includes(r.id) ? "Quitar de" : "Agregar a"} favoritos: ${r.nombre}`} data-tip="Favorito"
                    onClick={() => setFav(f => f.includes(r.id) ? f.filter(x => x !== r.id) : [...f, r.id])} className="tip grid h-11 w-11 place-items-center text-ink-3 aria-pressed:text-maiz">
                    <Star size={18} fill={fav.includes(r.id) ? "currentColor" : "none"} />
                  </button>
                </li>
              ))}</ul>
            </Card>
          );
        })}
      </div>
      {t && !TODOS.some(r => sinTildes(r.nombre).includes(t)) && <Card><EmptyState icon={Search} titulo="No hay reportes con ese nombre" texto="Prueba con «ventas», «stock» o «gastos»." /></Card>}
      {rep && <VistaPrevia id={rep.id} nombre={rep.nombre} gen={rep.gen} onClose={() => setAbierto(null)} />}
    </div>
  );
}

function VistaPrevia({ id, nombre, gen, onClose }: { id: string; nombre: string; gen: Generador; onClose: () => void }) {
  const { config } = useConfig();
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [res, setRes] = useState<Resultado | null>(null), [error, setError] = useState<unknown>(null), [intento, setIntento] = useState(0);
  const [programar, setProgramar] = useState(false);
  const { desde, hasta } = useMemo(() => ({ desde: inicioDelDia(periodo === "hoy" ? 0 : periodo === "7d" ? 6 : 29), hasta: inicioDelDia(-1) }), [periodo]);
  const sub = `${fecha(desde)} al ${fecha(new Date(hasta.getTime() - 1))}`;
  useEffect(() => { setRes(null); setError(null); gen(desde, hasta).then(setRes).catch(setError); }, [id, desde, hasta, intento]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal titulo={nombre} onClose={onClose} ancho={820}
      pie={<>
        <Button icon={CalendarClock} onClick={() => setProgramar(true)}>Programar envío</Button>
        <span className="flex-1" />
        <Button icon={FileSpreadsheet} disabled={!res?.filas.length} onClick={() => res && exportarFilas("excel", nombre, sub, res.cols, res.filas, config)}>Excel</Button>
        <Button variant="primary" icon={FileText} disabled={!res?.filas.length} onClick={() => res && exportarFilas("pdf", nombre, sub, res.cols, res.filas, config)}>PDF</Button>
      </>}>
      <div className="flex flex-wrap items-center justify-between gap-3"><DateRangePicker value={periodo} onChange={setPeriodo} /><span className="text-sm text-ink-3">{sub}</span></div>
      {error ? <ErrorState error={error} onRetry={() => setIntento(i => i + 1)} /> : !res ? <div className="flex flex-col gap-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} h={28} />)}</div> : (
        <>
          {res.resumen && <p className="rounded-md bg-brand-soft px-3.5 py-2.5 text-brand-text">{res.resumen}</p>}
          {res.filas.length === 0 ? <EmptyState icon={BarChart3} titulo="No hay datos en este periodo" texto="Prueba con un periodo más largo." /> : (
            <div className="max-h-[50vh] overflow-auto rounded-md border border-line">
              <table className="w-full text-[15px]">
                <thead className="sticky top-0 bg-surface-2"><tr>{res.cols.map((c, i) => <th key={c} className={cx("px-3 py-2 text-[13px] font-semibold text-ink-3", i ? "text-right" : "text-left")}>{c}</th>)}</tr></thead>
                <tbody>{res.filas.map((f, i) => <tr key={i} className="border-t border-line">{f.map((v, j) => <td key={j} className={cx("px-3 py-2", j > 0 && "num text-right")}>{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      {programar && res && <Programar nombre={nombre} sub={sub} res={res} onClose={() => setProgramar(false)} />}
    </Modal>
  );
}

// El envío automático necesita un servidor que corra solo (Edge Functions), que el curso deja fuera. Aquí se envía en un toque.
function Programar({ nombre, sub, res, onClose }: { nombre: string; sub: string; res: Resultado; onClose: () => void }) {
  const { config } = useConfig();
  const texto = `*${config.nombre} · ${nombre}*\n${sub}\n${res.resumen ? res.resumen + "\n" : ""}\n${res.filas.slice(0, 15).map(f => f.join(" · ")).join("\n")}`;
  const [tel, setTel] = useState(config.whatsapp || "");
  return (
    <Modal titulo="Programar envío" onClose={onClose} ancho={460}>
      <p className="text-ink-2">El envío automático cada día necesita un servidor que trabaje solo, y en este curso no usamos Edge Functions. Mientras tanto, envíalo con un toque al cerrar la caja:</p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="pr-tel">WhatsApp que recibe el reporte<input id="pr-tel" inputMode="numeric" value={tel} onChange={e => setTel(e.target.value.replace(/\D/g, ""))} /></label>
      <a className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#1E8A4C] px-4 font-semibold text-white", tel.length < 8 && "pointer-events-none opacity-50")} href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><MessageCircle size={18} />Enviar ahora por WhatsApp</a>
    </Modal>
  );
}
