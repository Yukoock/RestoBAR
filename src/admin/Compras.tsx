// Compras, Proveedores y Gastos (B6.2).
import { useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Eye, FileImage, MessageCircle, Pencil, Plus, ShoppingBag, Trash2, Truck, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { bs, fecha, leerMonto, mensajeError } from "@/lib/formato";
import { useConsulta, usePerfiles } from "@/lib/datos";
import { useIngredientes, cantidad } from "@/lib/catalogo";
import { subirComprobante, verComprobante } from "@/lib/fotos";
import { exportarTabla } from "@/lib/exportar";
import type { CategoriaGasto, Compra, Gasto, Proveedor } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, ConfirmDialog, FormField, Modal, Switch, useAvisar } from "@/components/ui";

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fechaDB = (f: string) => fecha(f + "T12:00:00");
const useProveedores = () => useConsulta<Proveedor[]>("proveedores", () => supabase.from("proveedores").select("*").order("nombre") as never, [], ["proveedores"]);

/* ================= Compras ================= */
export function Compras() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: compras, cargando, error, recargar } = useConsulta<Compra[]>("compras", () => supabase.from("compras").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }) as never, [], ["compras"]);
  const { datos: proveedores } = useProveedores();
  const [nueva, setNueva] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const camara = useRef<HTMLInputElement>(null), paraId = useRef<string>("");
  const prov = (id: string | null) => proveedores.find(p => p.id === id)?.nombre || "—";
  async function adjuntar(file: File) {
    const id = paraId.current; setSubiendo(id);
    try {
      const ruta = await subirComprobante("compras", id, file);
      const { error } = await supabase.from("compras").update({ foto_url: ruta }).eq("id", id);
      if (error) throw error;
      avisar("Foto de la factura adjunta");
    } catch (e) { avisar(mensajeError(e), "bad"); } finally { setSubiendo(null); }
  }
  async function estado(c: Compra, e: Compra["estado"]) {
    const { error } = await supabase.from("compras").update({ estado: e }).eq("id", c.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(`Compra ${c.numero}: ${e === "Recibida" ? "pagada" : e.toLowerCase()}`);
  }
  return (
    <>
      <input ref={camara} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={e => { const x = e.target.files?.[0]; if (x) adjuntar(x); e.target.value = ""; }} />
      <DataTable<Compra> id="compras" titulo="Compras" filas={compras} clave={c => c.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={c => `${c.numero} ${prov(c.proveedor_id)} ${c.detalle || ""}`}
        arriba={<Button variant="primary" icon={Plus} onClick={() => setNueva(true)}>Registrar compra</Button>}
        filtros={[{ id: "todos", titulo: "Todas", f: () => true }, { id: "pagar", titulo: "Por pagar", f: c => c.estado === "Por pagar" }, { id: "sinfoto", titulo: "Sin foto de factura", f: c => !c.foto_url }]}
        columnas={[
          { clave: "numero", titulo: "N.º", render: c => <strong className="num">{c.numero}</strong>, texto: c => c.numero, orden: c => c.numero },
          { clave: "fecha", titulo: "Fecha", texto: c => fechaDB(c.fecha), orden: c => c.fecha },
          { clave: "proveedor", titulo: "Proveedor", texto: c => prov(c.proveedor_id), orden: c => prov(c.proveedor_id) },
          { clave: "detalle", titulo: "Detalle", texto: c => c.detalle || "" },
          { clave: "total", titulo: "Total", derecha: true, texto: c => bs(c.total), orden: c => Number(c.total) },
          { clave: "foto", titulo: "Factura", render: c => c.foto_url ? <Badge tono="ok" icon={FileImage}>Adjunta</Badge>
            : <span onClick={e => e.stopPropagation()}><Button size="sm" icon={Camera} loading={subiendo === c.id} onClick={() => { paraId.current = c.id; camara.current?.click(); }}>Adjuntar con cámara</Button></span>, texto: c => c.foto_url ? "Adjunta" : "Sin foto" },
          { clave: "estado", titulo: "Estado", render: c => <Badge tono={c.estado === "Por pagar" ? "warn" : c.estado === "Anulada" ? "bad" : "ok"} punto>{c.estado}</Badge>, texto: c => c.estado, orden: c => c.estado },
        ]}
        menu={c => [
          !!c.foto_url && { label: "Ver factura", icon: Eye, onClick: () => verComprobante(c.foto_url!).catch(e => avisar(mensajeError(e), "bad")) },
          c.estado === "Por pagar" && { label: "Marcar como pagada", icon: CheckCircle2, onClick: () => estado(c, "Recibida") },
          c.estado === "Recibida" && { label: "Marcar por pagar", onClick: () => estado(c, "Por pagar") },
        ]}
        onExportar={(t, f, c) => exportarTabla(t, "Compras", f, c, config)}
        vacio={{ icon: ShoppingBag, titulo: "Todavía no hay compras", texto: "Registra lo que compras: el stock sube solo y se actualiza el costo promedio de los insumos y de las recetas.", accion: { label: "Registrar compra", icon: Plus, onClick: () => setNueva(true) } }} />
      {nueva && <NuevaCompra proveedores={proveedores} siguiente={`C-${String(compras.length + 1).padStart(4, "0")}`} onClose={() => setNueva(false)} />}
    </>
  );
}

function NuevaCompra({ proveedores, siguiente, onClose }: { proveedores: Proveedor[]; siguiente: string; onClose: () => void }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { datos: ingredientes } = useIngredientes();
  const [f, setF] = useState({ numero: siguiente, fecha: hoyISO(), proveedor_id: proveedores[0]?.id || "", estado: "Recibida" as Compra["estado"] });
  const [lineas, setLineas] = useState<{ ingrediente_id: string; cantidad: string; costo: string }[]>([{ ingrediente_id: "", cantidad: "", costo: "" }]);
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const total = lineas.reduce((a, l) => a + leerMonto(l.cantidad) * leerMonto(l.costo), 0);
  const up = (k: number, c: Partial<(typeof lineas)[0]>) => { setLineas(ls => ls.map((l, j) => j === k ? { ...l, ...c } : l)); setError(""); };
  async function ok() {
    const validas = lineas.filter(l => l.ingrediente_id && leerMonto(l.cantidad) > 0);
    if (!validas.length) return setError("Agrega al menos un insumo con su cantidad.");
    setEnviando(true);
    try {
      const detalle = validas.map(l => { const i = ingredientes.find(x => x.id === l.ingrediente_id)!; return `${i.nombre} ${cantidad(leerMonto(l.cantidad))} ${i.unidad}`; }).join(", ");
      const { data, error } = await supabase.from("compras").insert({ ...f, proveedor_id: f.proveedor_id || null, detalle, total: Math.round(total * 100) / 100, creado_por: perfil?.id }).select("id").single();
      if (error) throw error;
      // Cada línea sube el stock y recalcula el costo promedio (lo hace la base de datos)
      const { error: e2 } = await supabase.from("compra_items").insert(validas.map(l => ({ compra_id: data.id, ingrediente_id: l.ingrediente_id, cantidad: leerMonto(l.cantidad), costo_unitario: leerMonto(l.costo) })));
      if (e2) throw e2;
      avisar(`Compra ${f.numero} registrada · stock y costo promedio actualizados`); onClose();
    } catch (e) { setError(/unique|duplicate/i.test(String((e as Error).message)) ? "Ya existe una compra con ese número." : mensajeError(e)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo="Registrar compra" onClose={onClose} ancho={680} pie={<><span className="num mr-auto font-bold">Total {bs(total)}</span><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Registrar compra</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="c-n" label="N.º"><input id="c-n" value={f.numero} onChange={e => setF({ ...f, numero: e.target.value })} /></FormField>
        <FormField id="c-f" label="Fecha"><input id="c-f" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></FormField>
        <FormField id="c-e" label="Estado"><select id="c-e" value={f.estado} onChange={e => setF({ ...f, estado: e.target.value as Compra["estado"] })}><option value="Recibida">Pagada</option><option value="Por pagar">Por pagar</option></select></FormField>
      </div>
      <FormField id="c-p" label="Proveedor"><select id="c-p" value={f.proveedor_id} onChange={e => setF({ ...f, proveedor_id: e.target.value })}><option value="">Sin proveedor</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></FormField>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Insumos comprados</span>
        {lineas.map((l, k) => { const i = ingredientes.find(x => x.id === l.ingrediente_id); return (
          <div key={k} className="grid grid-cols-[1fr_90px_110px_44px] items-center gap-2 max-sm:grid-cols-2">
            <select aria-label="Insumo" value={l.ingrediente_id} onChange={e => up(k, { ingrediente_id: e.target.value })}><option value="">Elige…</option>{ingredientes.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select>
            <input aria-label={`Cantidad${i ? " en " + i.unidad : ""}`} placeholder={i?.unidad || "Cant."} inputMode="decimal" value={l.cantidad} onChange={e => up(k, { cantidad: e.target.value })} />
            <input aria-label="Costo unitario en Bs" placeholder="Bs c/u" inputMode="decimal" value={l.costo} onChange={e => up(k, { costo: e.target.value })} />
            <button type="button" aria-label="Quitar línea" disabled={lineas.length === 1} onClick={() => setLineas(ls => ls.filter((_, j) => j !== k))} className="grid h-11 w-11 place-items-center text-ink-3 disabled:opacity-30"><X size={18} /></button>
          </div>
        ); })}
        <Button variant="ghost" icon={Plus} className="self-start" onClick={() => setLineas(ls => [...ls, { ingrediente_id: "", cantidad: "", costo: "" }])}>Agregar insumo</Button>
      </div>
      <p className="text-sm text-ink-3">Después podrás adjuntar la foto de la factura desde la tabla, con la cámara del celular.</p>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

/* ================= Proveedores ================= */
export function Proveedores() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: proveedores, cargando, error, recargar } = useProveedores();
  const { datos: ultimas } = useConsulta<{ proveedor_id: string; fecha: string }[]>("ultimas-compras", () => supabase.from("compras").select("proveedor_id, fecha").order("fecha", { ascending: false }) as never, [], ["compras"]);
  const [editar, setEditar] = useState<Proveedor | "nuevo" | null>(null), [borrar, setBorrar] = useState<Proveedor | null>(null);
  const ultima = (id: string) => ultimas.find(u => u.proveedor_id === id)?.fecha;
  return (
    <>
      <DataTable<Proveedor> id="proveedores" titulo="Proveedores" filas={proveedores} clave={p => p.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={p => `${p.nombre} ${p.rubro || ""}`} arriba={<Button variant="primary" icon={Plus} onClick={() => setEditar("nuevo")}>Nuevo proveedor</Button>}
        columnas={[
          { clave: "nombre", titulo: "Nombre", render: p => <strong>{p.nombre}</strong>, texto: p => p.nombre, orden: p => p.nombre },
          { clave: "rubro", titulo: "Rubro", texto: p => p.rubro || "", orden: p => p.rubro || "" },
          { clave: "whatsapp", titulo: "WhatsApp", texto: p => p.whatsapp ? `+${p.whatsapp.slice(0, 3)} ${p.whatsapp.slice(3)}` : "—" },
          { clave: "ultima", titulo: "Última compra", texto: p => ultima(p.id) ? fechaDB(ultima(p.id)!) : "Sin compras", orden: p => ultima(p.id) || "" },
        ]}
        accion={{ titulo: "Escribir", icon: MessageCircle, onClick: p => p.whatsapp ? window.open(`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Hola, le escribimos de ${config.nombre}.`)}`, "_blank", "noopener") : avisar("Este proveedor no tiene WhatsApp. Agrégalo con Editar.", "info") }}
        menu={p => [{ label: "Editar", icon: Pencil, onClick: () => setEditar(p) }, "-", { label: "Eliminar", icon: Trash2, peligro: true, onClick: () => setBorrar(p) }]}
        onExportar={(t, f, c) => exportarTabla(t, "Proveedores", f, c, config)}
        vacio={{ icon: Truck, titulo: "Todavía no hay proveedores", texto: "Agrega a quién le compras para escribirle por WhatsApp desde aquí.", accion: { label: "Nuevo proveedor", icon: Plus, onClick: () => setEditar("nuevo") } }} />
      {editar && <EditarProveedor p={editar === "nuevo" ? null : editar} onClose={() => setEditar(null)} />}
      {borrar && <ConfirmDialog titulo={`¿Eliminar ${borrar.nombre}?`} peligro confirmar="Eliminar" texto="Sus compras anteriores se conservan, sin proveedor." onClose={() => setBorrar(null)}
        onConfirm={async () => { const { error } = await supabase.from("proveedores").delete().eq("id", borrar.id); if (error) avisar(mensajeError(error), "bad"); else avisar(`${borrar.nombre} eliminado`); }} />}
    </>
  );
}
function EditarProveedor({ p, onClose }: { p: Proveedor | null; onClose: () => void }) {
  const avisar = useAvisar();
  const [f, setF] = useState({ nombre: p?.nombre || "", rubro: p?.rubro || "", whatsapp: p?.whatsapp || "" });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    if (f.nombre.trim().length < 2) return setError("Escribe el nombre del proveedor.");
    if (f.whatsapp && !/^\d{8,15}$/.test(f.whatsapp)) return setError("El WhatsApp va solo con números y el código de país, por ejemplo 59170000000.");
    setEnviando(true);
    const datos = { nombre: f.nombre.trim(), rubro: f.rubro.trim() || null, whatsapp: f.whatsapp || null };
    const { error } = p ? await supabase.from("proveedores").update(datos).eq("id", p.id) : await supabase.from("proveedores").insert(datos);
    setEnviando(false);
    if (error) return setError(/unique|duplicate/i.test(error.message) ? "Ya existe un proveedor con ese nombre." : mensajeError(error));
    avisar(p ? "Proveedor actualizado" : `${datos.nombre} agregado`); onClose();
  }
  return (
    <Modal titulo={p ? `Editar ${p.nombre}` : "Nuevo proveedor"} onClose={onClose} ancho={440} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <FormField id="pv-n" label="Nombre"><input id="pv-n" data-autofocus value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></FormField>
      <FormField id="pv-r" label="Rubro" hint="Ej.: carnes, verduras, bebidas"><input id="pv-r" value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })} /></FormField>
      <FormField id="pv-w" label="WhatsApp" hint="Solo números, con 591 delante"><input id="pv-w" inputMode="numeric" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value.replace(/\D/g, "") })} /></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

/* ================= Gastos ================= */
export function Gastos() {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { datos: gastos, cargando, error, recargar } = useConsulta<Gasto[]>("gastos", () => supabase.from("gastos").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(1000) as never, [], ["gastos"]);
  const { datos: categorias } = useConsulta<CategoriaGasto[]>("cat-gastos", () => supabase.from("categorias_gasto").select("*").order("nombre") as never, [], ["categorias_gasto"]);
  const { datos: perfiles } = usePerfiles();
  const [nuevo, setNuevo] = useState(false), [borrar, setBorrar] = useState<Gasto | null>(null);
  const hoy = hoyISO(), mes = hoy.slice(0, 7);
  const catNombre = (id: string | null) => categorias.find(c => c.id === id)?.nombre || "Sin categoría";
  const totales = useMemo(() => ({ hoy: gastos.filter(g => g.fecha === hoy).reduce((a, g) => a + Number(g.monto), 0), mes: gastos.filter(g => g.fecha.startsWith(mes)).reduce((a, g) => a + Number(g.monto), 0) }), [gastos, hoy, mes]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="flex flex-col rounded-md bg-surface px-4 py-3 shadow-1"><span className="text-sm text-ink-3">Hoy</span><strong className="num font-display text-lg">{bs(totales.hoy)}</strong></div>
        <div className="flex flex-col rounded-md bg-surface px-4 py-3 shadow-1"><span className="text-sm text-ink-3">Este mes</span><strong className="num font-display text-lg">{bs(totales.mes)}</strong></div>
      </div>
      <DataTable<Gasto> id="gastos" titulo="Gastos" filas={gastos} clave={g => g.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={g => `${g.detalle} ${catNombre(g.categoria_id)}`} arriba={<Button variant="primary" icon={Plus} onClick={() => setNuevo(true)}>Registrar gasto</Button>}
        filtros={[{ id: "todos", titulo: "Todos", f: () => true }, { id: "hoy", titulo: "Hoy", f: g => g.fecha === hoy }, { id: "mes", titulo: "Este mes", f: g => g.fecha.startsWith(mes) }, ...categorias.map(c => ({ id: c.id, titulo: c.nombre, f: (g: Gasto) => g.categoria_id === c.id }))]}
        columnas={[
          { clave: "fecha", titulo: "Fecha", texto: g => fechaDB(g.fecha), orden: g => g.fecha },
          { clave: "categoria", titulo: "Categoría", texto: g => catNombre(g.categoria_id), orden: g => catNombre(g.categoria_id) },
          { clave: "detalle", titulo: "Detalle", texto: g => g.detalle },
          { clave: "monto", titulo: "Monto", derecha: true, texto: g => bs(g.monto), orden: g => Number(g.monto) },
          { clave: "registro", titulo: "Registró", texto: g => perfiles.find(p => p.id === g.creado_por)?.nombre || "—" },
        ]}
        menu={g => perfil?.rol === "dueno" ? [{ label: "Eliminar", icon: Trash2, peligro: true, onClick: () => setBorrar(g) }] : []}
        onExportar={(t, f, c) => exportarTabla(t, "Gastos", f, c, config)}
        vacio={{ icon: Wallet, titulo: "Todavía no hay gastos", texto: "Registra lo que sale del negocio: insumos de último momento, servicios, sueldos o retiros del dueño.", accion: { label: "Registrar gasto", icon: Plus, onClick: () => setNuevo(true) } }} />
      {nuevo && <NuevoGasto categorias={categorias} onClose={() => setNuevo(false)} />}
      {borrar && <ConfirmDialog titulo="¿Eliminar este gasto?" peligro confirmar="Eliminar" texto={`${borrar.detalle} · ${bs(borrar.monto)}. Si salió de la caja, el movimiento de caja se mantiene.`} onClose={() => setBorrar(null)}
        onConfirm={async () => { const { error } = await supabase.from("gastos").delete().eq("id", borrar.id); if (error) avisar(mensajeError(error), "bad"); else avisar("Gasto eliminado"); }} />}
    </div>
  );
}
function NuevoGasto({ categorias, onClose }: { categorias: CategoriaGasto[]; onClose: () => void }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [f, setF] = useState({ fecha: hoyISO(), categoria_id: categorias[0]?.id || "", detalle: "", monto: "" });
  const [deCaja, setDeCaja] = useState(true);
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    const n = leerMonto(f.monto);
    if (f.detalle.trim().length < 3) return setError("Escribe el detalle, por ejemplo «Garrafa de gas».");
    if (!(n > 0)) return setError("Escribe un monto mayor a cero.");
    setEnviando(true);
    try {
      const { error } = await supabase.from("gastos").insert({ fecha: f.fecha, categoria_id: f.categoria_id || null, detalle: f.detalle.trim(), monto: n, creado_por: perfil?.id });
      if (error) throw error;
      // Si salió del cajón, también se resta en el cierre de caja
      if (deCaja) {
        const { data: caja } = await supabase.from("caja_sesiones").select("id").is("cerrada_at", null).maybeSingle();
        if (caja) {
          const esRetiro = /retiro/i.test(categorias.find(c => c.id === f.categoria_id)?.nombre || "");
          await supabase.from("caja_movimientos").insert({ sesion_id: caja.id, tipo: esRetiro ? "retiro" : "gasto", monto: n, detalle: f.detalle.trim(), creado_por: perfil?.id });
        } else avisar("No hay caja abierta: el gasto se guardó, pero no se restó del cajón.", "info");
      }
      avisar(`Gasto registrado: ${f.detalle.trim()} · ${bs(n)}`); onClose();
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo="Registrar gasto o retiro" onClose={onClose} ancho={460} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Registrar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="g-f" label="Fecha"><input id="g-f" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></FormField>
        <FormField id="g-c" label="Categoría"><select id="g-c" value={f.categoria_id} onChange={e => setF({ ...f, categoria_id: e.target.value })}>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></FormField>
      </div>
      <FormField id="g-d" label="Detalle" hint="Ej.: retiro del dueño, hielo, garrafa"><input id="g-d" data-autofocus value={f.detalle} onChange={e => { setF({ ...f, detalle: e.target.value }); setError(""); }} /></FormField>
      <FormField id="g-m" label="Monto (Bs)"><input id="g-m" inputMode="decimal" value={f.monto} onChange={e => { setF({ ...f, monto: e.target.value }); setError(""); }} /></FormField>
      <Switch id="g-caja" label="Se pagó con efectivo de la caja" checked={deCaja} onChange={setDeCaja} />
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
