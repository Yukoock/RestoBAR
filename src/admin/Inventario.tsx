// Inventario (B6.2): Ingredientes, Recetas y costos, y Movimientos.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, FileSpreadsheet, History, Minus, Pencil, Plus, ShoppingCart, Trash2, Utensils } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { bs, cx, fecha, fechaHora, leerMonto, mensajeError, porcentaje, sinTildes } from "@/lib/formato";
import { useConsulta, usePerfiles } from "@/lib/datos";
import { useIngredientes, useProductos, useCategorias, costoDe, margen, tonoMargen, nivelStock, cantidad } from "@/lib/catalogo";
import { abrirImpresion, exportarTabla } from "@/lib/exportar";
import type { Ingrediente, MovimientoInventario } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, FormField, Modal, ProductPhoto, Seg, Skeleton, useAvisar } from "@/components/ui";
import { Barra } from "@/components/graficos";

const COLOR_NIVEL = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--info)", neutral: "var(--ink-3)" };

/* ================= Ingredientes ================= */
export function Ingredientes() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: lista, cargando, error, recargar } = useIngredientes();
  const { datos: productos } = useProductos();
  const [entrada, setEntrada] = useState<Ingrediente | null>(null), [editar, setEditar] = useState<Ingrediente | "nuevo" | null>(null);
  const [kardex, setKardex] = useState<Ingrediente | null>(null), [comp, setComp] = useState<Ingrediente | null>(null), [borrar, setBorrar] = useState<Ingrediente | null>(null);
  const bajos = lista.filter(i => Number(i.stock) < Number(i.minimo));
  function ordenDeCompra(insumos: Ingrediente[]) {
    const filas = insumos.map(i => { const pedir = Math.max(Number(i.minimo) * 2 - Number(i.stock), Number(i.minimo)); return `<tr><td>${i.nombre}</td><td class="der">${cantidad(i.stock)} ${i.unidad}</td><td class="der">${cantidad(i.minimo)} ${i.unidad}</td><td class="der"><strong>${cantidad(Math.ceil(pedir * 10) / 10)} ${i.unidad}</strong></td><td class="der">${bs(pedir * Number(i.costo_unitario))}</td></tr>`; }).join("");
    abrirImpresion("Orden de compra", `<h1>${config.nombre} · Orden de compra</h1><p class="muted">${fecha(Date.now())} · Sugerido: llegar al doble del mínimo</p>
      <table><thead><tr><th>Insumo</th><th class="der">Hay</th><th class="der">Mínimo</th><th class="der">Pedir</th><th class="der">Costo aprox.</th></tr></thead><tbody>${filas}</tbody></table>`);
  }
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-4">
      {bajos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-bad-soft px-3.5 py-3 text-bad">
          <AlertTriangle size={20} /><div className="min-w-[200px] flex-1"><strong>{bajos.length} insumos bajo el mínimo</strong><p className="text-sm">{bajos.map(b => b.nombre).join(", ")}</p></div>
          <Button icon={ShoppingCart} onClick={() => ordenDeCompra(bajos)}>Crear orden de compra</Button>
        </div>
      )}
      <DataTable<Ingrediente> id="ingredientes" titulo="Ingredientes" filas={lista} clave={i => i.id} cargando={cargando} buscar={i => i.nombre}
        arriba={<Button variant="primary" icon={Plus} onClick={() => setEditar("nuevo")}>Nuevo insumo</Button>}
        filtros={[{ id: "todos", titulo: "Todos", f: () => true }, { id: "bien", titulo: "Bien", f: i => nivelStock(i)[1] === "ok" }, { id: "bajo", titulo: "Bajo", f: i => nivelStock(i)[1] === "warn" }, { id: "reponer", titulo: "Reponer ya", f: i => nivelStock(i)[1] === "bad" }]}
        columnas={[
          { clave: "nombre", titulo: "Insumo", render: i => <strong>{i.nombre}</strong>, texto: i => i.nombre, orden: i => i.nombre },
          { clave: "stock", titulo: "Stock", derecha: true, texto: i => `${cantidad(i.stock)} ${i.unidad}`, orden: i => Number(i.stock) },
          { clave: "nivel", titulo: "Nivel", render: i => <Barra valor={Number(i.stock)} max={Number(i.minimo) * 2.5} color={COLOR_NIVEL[nivelStock(i)[1]]} /> },
          { clave: "minimo", titulo: "Mínimo", derecha: true, texto: i => `${cantidad(i.minimo)} ${i.unidad}`, orden: i => Number(i.minimo) },
          { clave: "estado", titulo: "Estado", render: i => { const [t, tono] = nivelStock(i); return <Badge tono={tono} punto>{t}</Badge>; }, texto: i => nivelStock(i)[0], orden: i => Number(i.stock) / (Number(i.minimo) || 1) },
          { clave: "costo", titulo: "Costo unitario", derecha: true, texto: i => `${bs(i.costo_unitario)} / ${i.unidad}`, orden: i => Number(i.costo_unitario) },
        ]}
        accion={{ titulo: "Entrada", icon: Plus, onClick: setEntrada }}
        menu={i => [{ label: "Kardex", icon: History, onClick: () => setKardex(i) }, { label: "Editar", icon: Pencil, onClick: () => setEditar(i) }, { label: "Composición", icon: Utensils, onClick: () => setComp(i) }, "-", { label: "Eliminar", icon: Trash2, peligro: true, onClick: () => setBorrar(i) }]}
        masivas={[{ titulo: "Crear orden de compra", icon: ShoppingCart, onClick: ordenDeCompra }]}
        onExportar={(t, f, c) => exportarTabla(t, "Ingredientes", f, c, config)}
        vacio={{ icon: Boxes, titulo: "Todavía no hay insumos", texto: "Agrega lo que compras para cocinar: carne, arroz, harina…", accion: { label: "Nuevo insumo", icon: Plus, onClick: () => setEditar("nuevo") } }} />
      {entrada && <MovimientoModal tipo="entrada" ingredientes={lista} inicial={entrada} onClose={() => setEntrada(null)} />}
      {editar && <EditarInsumo i={editar === "nuevo" ? null : editar} onClose={() => setEditar(null)} />}
      {kardex && <Kardex i={kardex} onClose={() => setKardex(null)} />}
      {comp && (
        <Modal titulo={`¿Dónde se usa ${comp.nombre}?`} onClose={() => setComp(null)} ancho={480}>
          {(() => { const usos = productos.filter(p => p.recetas.some(r => r.ingrediente_id === comp.id)); return usos.length ? (
            <ul className="flex flex-col">{usos.map(p => <li key={p.id} className="flex justify-between border-b border-line py-2"><span>{p.nombre}</span><span className="num text-ink-3">{cantidad(p.recetas.find(r => r.ingrediente_id === comp.id)!.cantidad)} {comp.unidad} por porción</span></li>)}</ul>
          ) : <p className="text-ink-3">Ninguna receta usa este insumo todavía.</p>; })()}
        </Modal>
      )}
      {borrar && <ConfirmDialog titulo={`¿Eliminar ${borrar.nombre}?`} peligro confirmar="Eliminar" onClose={() => setBorrar(null)}
        texto="Se borra junto con su historial de movimientos. Si alguna receta lo usa, primero quítalo de esa receta."
        onConfirm={async () => { const { error } = await supabase.from("ingredientes").delete().eq("id", borrar.id); if (error) avisar(/foreign key|violates/i.test(error.message) ? `${borrar.nombre} está en una receta. Quítalo de la receta primero.` : mensajeError(error), "bad"); else avisar(`${borrar.nombre} eliminado`); }} />}
    </div>
  );
}

function EditarInsumo({ i, onClose }: { i: Ingrediente | null; onClose: () => void }) {
  const avisar = useAvisar();
  const [f, setF] = useState({ nombre: i?.nombre || "", unidad: i?.unidad || "kg", minimo: i ? cantidad(i.minimo) : "", costo: i ? cantidad(i.costo_unitario) : "", stock: "" });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    if (f.nombre.trim().length < 2) return setError("Escribe el nombre del insumo.");
    setEnviando(true);
    const datos = { nombre: f.nombre.trim(), unidad: f.unidad, minimo: leerMonto(f.minimo), costo_unitario: leerMonto(f.costo) };
    const { error } = i ? await supabase.from("ingredientes").update(datos).eq("id", i.id) : await supabase.from("ingredientes").insert({ ...datos, stock: leerMonto(f.stock) });
    setEnviando(false);
    if (error) return setError(/unique|duplicate/i.test(error.message) ? "Ya existe un insumo con ese nombre." : mensajeError(error));
    avisar(i ? `${datos.nombre} actualizado` : `${datos.nombre} agregado`); onClose();
  }
  return (
    <Modal titulo={i ? `Editar ${i.nombre}` : "Nuevo insumo"} onClose={onClose} ancho={460} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <FormField id="in-n" label="Nombre"><input id="in-n" data-autofocus value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></FormField>
      <FormField id="in-u" label="Unidad"><Seg value={f.unidad} onChange={v => setF({ ...f, unidad: v })} label="Unidad" opciones={[["kg", "kg"], ["litro", "litro"], ["unidad", "unidad"]]} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="in-m" label={`Mínimo (${f.unidad})`} hint="Bajo esto, aparece la alerta"><input id="in-m" inputMode="decimal" value={f.minimo} onChange={e => setF({ ...f, minimo: e.target.value })} /></FormField>
        <FormField id="in-c" label={`Costo por ${f.unidad} (Bs)`}><input id="in-c" inputMode="decimal" value={f.costo} onChange={e => setF({ ...f, costo: e.target.value })} /></FormField>
      </div>
      {!i && <FormField id="in-s" label={`Stock inicial (${f.unidad})`} hint="Lo que tienes hoy. Después cambia con compras, entradas y ventas."><input id="in-s" inputMode="decimal" value={f.stock} onChange={e => setF({ ...f, stock: e.target.value })} /></FormField>}
      {i && <p className="text-sm text-ink-3">El stock no se edita aquí: usa «Entrada» o Movimientos para que quede el registro.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

function MovimientoModal({ tipo, ingredientes, inicial, onClose }: { tipo: "entrada" | "salida"; ingredientes: Ingrediente[]; inicial?: Ingrediente; onClose: () => void }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [ins, setIns] = useState(inicial?.id || ingredientes[0]?.id || "");
  const [cant, setCant] = useState(""), [costo, setCosto] = useState(""), [motivo, setMotivo] = useState(tipo === "entrada" ? "Compra en el mercado" : "Merma");
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const i = ingredientes.find(x => x.id === ins);
  async function ok() {
    const n = leerMonto(cant);
    if (!i) return setError("Elige un insumo.");
    if (!(n > 0)) return setError("Escribe una cantidad mayor a cero.");
    if (tipo === "salida" && n > Number(i.stock)) return setError(`Solo hay ${cantidad(i.stock)} ${i.unidad}. Revisa la cantidad.`);
    setEnviando(true);
    try {
      // Entrada con costo: actualiza el costo promedio del insumo
      const c = leerMonto(costo);
      if (tipo === "entrada" && c > 0) {
        const s = Math.max(Number(i.stock), 0), prom = (s * Number(i.costo_unitario) + n * c) / (s + n);
        const { error } = await supabase.from("ingredientes").update({ costo_unitario: Math.round(prom * 100) / 100 }).eq("id", i.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("movimientos_inventario").insert({ ingrediente_id: i.id, tipo, cantidad: tipo === "entrada" ? n : -n, motivo, creado_por: perfil?.id });
      if (error) throw error;
      avisar(`${tipo === "entrada" ? "Entrada" : "Salida"} registrada: ${cantidad(n)} ${i.unidad} de ${i.nombre}`); onClose();
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo={tipo === "entrada" ? `Entrada${inicial ? " de " + inicial.nombre : ""}` : "Registrar salida"} onClose={onClose} ancho={460}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      {!inicial && <FormField id="mv-i" label="Insumo"><select id="mv-i" value={ins} onChange={e => setIns(e.target.value)}>{ingredientes.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></FormField>}
      <FormField id="mv-c" label={`Cantidad (${i?.unidad || ""})`} hint={i ? `Hay ${cantidad(i.stock)} ${i.unidad}` : undefined}><input id="mv-c" data-autofocus inputMode="decimal" value={cant} onChange={e => { setCant(e.target.value); setError(""); }} /></FormField>
      {tipo === "entrada" && <FormField id="mv-p" label={`Costo por ${i?.unidad || "unidad"} (opcional)`} hint="Si lo escribes, se actualiza el costo promedio"><input id="mv-p" inputMode="decimal" value={costo} onChange={e => setCosto(e.target.value)} /></FormField>}
      <FormField id="mv-m" label="Motivo"><select id="mv-m" value={motivo} onChange={e => setMotivo(e.target.value)}>{(tipo === "entrada" ? ["Compra en el mercado", "Devolución", "Ajuste de inventario"] : ["Merma", "Se dañó o venció", "Consumo del personal", "Ajuste de inventario"]).map(x => <option key={x}>{x}</option>)}</select></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

function Kardex({ i, onClose }: { i: Ingrediente; onClose: () => void }) {
  const { datos, cargando } = useConsulta<MovimientoInventario[]>("kardex-" + i.id, () => supabase.from("movimientos_inventario").select("*").eq("ingrediente_id", i.id).order("created_at", { ascending: false }).limit(60) as never, [], ["movimientos_inventario"]);
  let saldo = Number(i.stock);
  const filas = datos.map(m => { const s = saldo; saldo -= Number(m.cantidad); return { ...m, saldo: s }; });
  return (
    <Modal titulo={`Kardex · ${i.nombre}`} onClose={onClose} ancho={620}>
      {cargando ? <Skeleton h={160} /> : filas.length === 0 ? <p className="text-ink-3">Todavía no hay movimientos de este insumo.</p> : (
        <table className="w-full text-[15px]">
          <thead><tr className="text-[13px] text-ink-3"><th className="py-2 text-left font-semibold">Fecha</th><th className="py-2 text-left font-semibold">Movimiento</th><th className="py-2 text-right font-semibold">Cantidad</th><th className="py-2 text-right font-semibold">Saldo</th></tr></thead>
          <tbody>{filas.map(m => <tr key={m.id} className="border-t border-line"><td className="num py-2">{fechaHora(m.created_at)}</td><td className="py-2">{m.motivo || m.tipo}</td><td className={cx("num py-2 text-right", m.cantidad < 0 && "text-bad")}>{m.cantidad > 0 ? "+" : ""}{cantidad(m.cantidad)} {i.unidad}</td><td className="num py-2 text-right">{cantidad(m.saldo)}</td></tr>)}</tbody>
        </table>
      )}
    </Modal>
  );
}

/* ================= Recetas y costos ================= */
export function Recetas() {
  const { datos: productos, cargando, error, recargar } = useProductos();
  const { datos: ingredientes } = useIngredientes();
  const { datos: categorias } = useCategorias();
  const conReceta = productos.filter(p => p.recetas.length);
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  if (cargando) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} h={200} r={12} />)}</div>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-3">{conReceta.length} de {productos.length} platos tienen receta. <Link to="/admin/productos" className="font-semibold text-brand-text underline">Arma las que faltan en Productos › Receta</Link>.</p>
      {conReceta.length === 0 ? <Card><EmptyState icon={ClipboardList} titulo="Todavía no hay recetas" texto="Abre un producto, entra a la pestaña Receta y agrega los insumos de una porción." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {conReceta.map(p => {
            const c = costoDe(p, ingredientes), m = margen(Number(p.precio), c);
            const alcanza = p.recetas.map(r => { const i = ingredientes.find(x => x.id === r.ingrediente_id); return { nombre: i?.nombre || "", n: i ? Math.floor(Number(i.stock) / Number(r.cantidad)) : 0 }; }).sort((a, b) => a.n - b.n);
            return (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={categorias.find(x => x.id === p.categoria_id)?.nombre} fotoUrl={p.foto_url} cuadrada className="!w-[72px] flex-none" />
                  <div className="min-w-0"><strong>{p.nombre}</strong><p className="text-sm text-ink-3">{p.recetas.length} insumos por porción</p>
                    <Link to={`/admin/productos?producto=${p.codigo}&tab=receta`} className="text-sm font-semibold text-brand-text underline">Editar receta</Link></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([["Precio", bs(p.precio)], ["Costo", bs(c)], ["Ganancia", bs(Number(p.precio) - c)]] as const).map(([t, v]) => <div key={t} className="flex flex-col rounded-sm bg-surface-2 px-3 py-2"><span className="text-xs text-ink-3">{t}</span><strong className="num">{v}</strong></div>)}
                  <div className="flex flex-col rounded-sm bg-surface-2 px-3 py-2"><span className="text-xs text-ink-3">Margen</span><span><Badge tono={tonoMargen(m)}>{porcentaje(m)}</Badge></span></div>
                </div>
                <p className={cx("text-sm", alcanza[0].n < 10 && "font-semibold text-bad")}>Alcanza para <strong className="num">{alcanza[0].n} unidades</strong>; lo primero que se acaba es <strong>{alcanza[0].nombre.toLowerCase()}</strong>.</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= Movimientos ================= */
type Mov = MovimientoInventario & { ingredientes: { nombre: string; unidad: string } | null };
export function Movimientos() {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { datos: movs, cargando, error, recargar } = useConsulta<Mov[]>("movimientos", () => supabase.from("movimientos_inventario").select("*, ingredientes(nombre, unidad)").order("created_at", { ascending: false }).limit(1000) as never, [], ["movimientos_inventario"]);
  const { datos: ingredientes } = useIngredientes();
  const { datos: perfiles } = usePerfiles();
  const [form, setForm] = useState<"entrada" | "salida" | null>(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const nombre = (id: string | null) => perfiles.find(p => p.id === id)?.nombre || (id ? "—" : "Sistema");
  const TIPOS = { entrada: ["Entrada", "ok"], salida: ["Salida", "warn"], venta: ["Venta", "info"], ajuste: ["Ajuste", "neutral"] } as const;

  function plantilla() {
    const csv = "﻿insumo;tipo;cantidad;motivo\r\n" + ingredientes.slice(0, 3).map(i => `${i.nombre};entrada;1;Compra en el mercado`).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "plantilla-movimientos.csv"; a.click();
  }
  // Carga masiva: un archivo .csv guardado desde Excel con columnas insumo; tipo; cantidad; motivo
  async function cargaMasiva(f: File) {
    setCargandoArchivo(true);
    try {
      const texto = (await f.text()).replace(/^﻿/, "");
      const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const sep = lineas[0].includes(";") ? ";" : ",";
      const filas = lineas.slice(1).map(l => l.split(sep).map(x => x.replace(/^"|"$/g, "").trim()));
      const malas: string[] = [];
      const registros = filas.flatMap((c, k) => {
        const i = ingredientes.find(x => sinTildes(x.nombre) === sinTildes(c[0]));
        const tipo = sinTildes(c[1]) === "salida" ? "salida" : sinTildes(c[1]) === "entrada" ? "entrada" : null;
        const n = leerMonto(c[2] || "");
        if (!i || !tipo || !(n > 0)) { malas.push(`fila ${k + 2}`); return []; }
        return [{ ingrediente_id: i.id, tipo, cantidad: tipo === "entrada" ? n : -n, motivo: c[3] || "Carga masiva", creado_por: perfil?.id }];
      });
      if (registros.length) { const { error } = await supabase.from("movimientos_inventario").insert(registros); if (error) throw error; }
      avisar(`${registros.length} movimientos registrados${malas.length ? ` · revisa ${malas.slice(0, 4).join(", ")}: insumo, tipo o cantidad no válidos` : ""}`, malas.length ? "info" : "ok");
    } catch (e) { avisar(mensajeError(e), "bad"); } finally { setCargandoArchivo(false); }
  }
  const botones = (
    <>
      <Button variant="primary" icon={ArrowDownToLine} onClick={() => setForm("entrada")}>Entrada</Button>
      <Button icon={ArrowUpFromLine} onClick={() => setForm("salida")}>Salida</Button>
      <input ref={archivo} type="file" accept=".csv,text/csv" hidden onChange={e => { const x = e.target.files?.[0]; if (x) cargaMasiva(x); e.target.value = ""; }} />
      <Button icon={FileSpreadsheet} loading={cargandoArchivo} onClick={() => archivo.current?.click()}>Carga masiva (Excel)</Button>
    </>
  );
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">Carga masiva: en Excel usa las columnas <strong>insumo · tipo (entrada o salida) · cantidad · motivo</strong> y guárdalo como CSV. <button type="button" onClick={plantilla} className="font-semibold text-brand-text underline">Descargar plantilla</button></p>
      <DataTable<Mov> id="movimientos" titulo="Movimientos" filas={movs} clave={m => m.id} cargando={cargando} arriba={botones}
        buscar={m => `${m.ingredientes?.nombre || ""} ${m.motivo || ""}`}
        filtros={[{ id: "todos", titulo: "Todos", f: () => true }, { id: "entrada", titulo: "Entradas", f: m => m.tipo === "entrada" }, { id: "salida", titulo: "Salidas", f: m => m.tipo === "salida" }, { id: "venta", titulo: "Ventas", f: m => m.tipo === "venta" }]}
        columnas={[
          { clave: "fecha", titulo: "Fecha", texto: m => fechaHora(m.created_at), orden: m => m.created_at },
          { clave: "tipo", titulo: "Tipo", render: m => <Badge tono={TIPOS[m.tipo][1]}>{TIPOS[m.tipo][0]}</Badge>, texto: m => TIPOS[m.tipo][0], orden: m => m.tipo },
          { clave: "insumo", titulo: "Insumo", texto: m => m.ingredientes?.nombre || "—", orden: m => m.ingredientes?.nombre || "" },
          { clave: "cantidad", titulo: "Cantidad", derecha: true, render: m => <span className={cx(m.cantidad < 0 && "text-bad")}>{m.cantidad > 0 ? "+" : ""}{cantidad(m.cantidad)} {m.ingredientes?.unidad}</span>, texto: m => `${cantidad(m.cantidad)} ${m.ingredientes?.unidad || ""}`, orden: m => Number(m.cantidad) },
          { clave: "motivo", titulo: "Motivo", texto: m => m.motivo || "" },
          { clave: "quien", titulo: "Registró", texto: m => nombre(m.creado_por) },
        ]}
        onExportar={(t, f, c) => exportarTabla(t, "Movimientos de inventario", f, c, config)}
        vacio={{ icon: Minus, titulo: "Todavía no hay movimientos", texto: "Registra una entrada cuando llegue mercadería, o una salida si algo se dañó. Las ventas descuentan solas según la receta; las compras suman solas.", accion: { label: "Registrar la primera entrada", icon: ArrowDownToLine, onClick: () => setForm("entrada") } }} />
      {form && <MovimientoModal tipo={form} ingredientes={ingredientes} onClose={() => setForm(null)} />}
    </div>
  );
}
