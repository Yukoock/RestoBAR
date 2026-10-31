// Productos (B6.2): tabla con foto, costo desde la receta, margen y «En el menú»; editor en Drawer con pestañas
// y «Subir fotos del menú en lote» (empareja P01.jpg con el producto P01).
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, ExternalLink, Images, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { bs, cx, leerMonto, mensajeError, porcentaje } from "@/lib/formato";
import { useProductos, useCategorias, useIngredientes, costoDe, margen, tonoMargen, cantidad, siguienteCodigo, ESTACIONES, type ProductoCompleto } from "@/lib/catalogo";
import { subirFoto } from "@/lib/fotos";
import { exportarTabla } from "@/lib/exportar";
import type { Categoria, Ingrediente, Producto } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Chip, ConfirmDialog, Drawer, EmptyState, FormField, ProductPhoto, Switch, useAvisar } from "@/components/ui";

export function Productos() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const [params, setParams] = useSearchParams();
  const { datos: productos, cargando, error, recargar } = useProductos();
  const { datos: categorias } = useCategorias();
  const { datos: ingredientes } = useIngredientes();
  const [borrar, setBorrar] = useState<ProductoCompleto | null>(null);
  const [subiendo, setSubiendo] = useState("");
  const lote = useRef<HTMLInputElement>(null);
  const editar = params.get("producto");
  const abrir = (codigo: string | null, tab?: string) => setParams(prev => { const n = new URLSearchParams(prev); if (codigo) n.set("producto", codigo); else { n.delete("producto"); n.delete("tab"); } if (tab) n.set("tab", tab); return n; });
  const cat = (id: string | null) => categorias.find(c => c.id === id);
  const costo = (p: ProductoCompleto) => costoDe(p, ingredientes);

  async function cambiar(p: Producto, cambios: Partial<Producto>, texto: string) {
    const { error } = await supabase.from("productos").update(cambios).eq("id", p.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(texto);
  }
  async function subirLote(files: FileList) {
    const lista = [...files];
    let ok = 0; const sin: string[] = [], fallas: string[] = [];
    for (const [k, f] of lista.entries()) {
      setSubiendo(`Subiendo ${k + 1} de ${lista.length}…`);
      const m = f.name.match(/^(P\d{2,3})\b/i), p = m && productos.find(x => x.codigo === m[1].toUpperCase());
      if (!p) { sin.push(f.name); continue; }
      try {
        const url = await subirFoto("productos", "menu", p.codigo, f);
        const { error } = await supabase.from("productos").update({ foto_url: url }).eq("id", p.id);
        if (error) throw error;
        ok++;
      } catch (e) { fallas.push(`${f.name}: ${mensajeError(e)}`); }
    }
    setSubiendo("");
    avisar(`${ok} fotos subidas y emparejadas${sin.length ? ` · ${sin.length} sin código de producto (${sin.slice(0, 2).join(", ")})` : ""}${fallas.length ? ` · ${fallas.length} no se pudieron subir` : ""}`, sin.length || fallas.length ? "info" : "ok");
  }
  async function duplicar(p: ProductoCompleto) {
    const codigo = await siguienteCodigo();
    const { id: _id, modificadores, recetas, ...resto } = p;
    void _id;
    const { data, error } = await supabase.from("productos").insert({ ...resto, codigo, nombre: p.nombre + " (copia)", favorito: false }).select("id").single();
    if (error) return avisar(mensajeError(error), "bad");
    if (modificadores.length) await supabase.from("modificadores").insert(modificadores.map(m => ({ producto_id: data.id, nombre: m.nombre, orden: m.orden })));
    if (recetas.length) await supabase.from("recetas").insert(recetas.map(r => ({ producto_id: data.id, ingrediente_id: r.ingrediente_id, cantidad: r.cantidad })));
    avisar(`Duplicado como ${codigo}`); abrir(codigo);
  }

  return (
    <>
      <input ref={lote} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files?.length) subirLote(e.target.files); e.target.value = ""; }} />
      <DataTable<ProductoCompleto> id="productos" titulo="Productos" filas={productos} clave={p => p.id} cargando={cargando} error={error} onReintentar={recargar}
        arriba={<>
          <Button icon={Images} loading={!!subiendo} onClick={() => lote.current?.click()}>{subiendo || "Subir fotos del menú en lote"}</Button>
          <Button variant="primary" icon={Plus} onClick={() => abrir("nuevo")}>Agregar producto</Button>
        </>}
        filtros={[
          { id: "todos", titulo: "Todos", f: () => true },
          ...categorias.map(c => ({ id: c.id, titulo: c.nombre, f: (p: ProductoCompleto) => p.categoria_id === c.id })),
          { id: "sin", titulo: "Sin categoría", f: p => !p.categoria_id },
          { id: "agotados", titulo: "Agotados", f: p => p.agotado },
        ]}
        buscar={p => `${p.codigo} ${p.nombre} ${p.descripcion || ""}`}
        columnas={[
          { clave: "foto", titulo: "Foto", render: p => <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={cat(p.categoria_id)?.nombre} fotoUrl={p.foto_url} cuadrada className="!w-11 !rounded-lg" /> },
          { clave: "nombre", titulo: "Producto", render: p => <span className="flex flex-col"><strong>{p.nombre}</strong><small className="text-ink-3">{p.codigo}{p.favorito ? " · Favorito de la casa" : ""}</small></span>, texto: p => p.nombre, orden: p => p.nombre },
          { clave: "categoria", titulo: "Categoría", render: p => cat(p.categoria_id)?.nombre || <span className="text-ink-3">Sin categoría</span>, texto: p => cat(p.categoria_id)?.nombre || "Sin categoría", orden: p => cat(p.categoria_id)?.orden ?? 99 },
          { clave: "precio", titulo: "Precio", derecha: true, render: p => bs(p.precio), texto: p => bs(p.precio), orden: p => Number(p.precio) },
          { clave: "costo", titulo: "Costo", derecha: true, render: p => <span title={p.recetas.length ? "Calculado de la receta" : "Aproximado: arma la receta para calcularlo"}>{bs(costo(p))}</span>, texto: p => bs(costo(p)), orden: costo },
          { clave: "margen", titulo: "Margen", derecha: true, render: p => { const m = margen(Number(p.precio), costo(p)); return <Badge tono={tonoMargen(m)}>{porcentaje(m)}</Badge>; }, texto: p => porcentaje(margen(Number(p.precio), costo(p))), orden: p => margen(Number(p.precio), costo(p)) },
          { clave: "stock", titulo: "Stock", render: p => p.agotado ? <Badge tono="bad" icon={X}>Agotado</Badge> : p.stock != null ? <span className="num">{p.stock} u.</span> : <span className="text-ink-3">Por receta</span>, texto: p => p.agotado ? "Agotado" : p.stock ?? "", orden: p => p.agotado ? -1 : p.stock ?? 9999 },
          { clave: "menu", titulo: "En el menú", render: p => <span onClick={e => e.stopPropagation()}><Switch id={"menu-" + p.id} ocultarTexto label={`${p.nombre} en el menú`} checked={p.en_menu} onChange={v => cambiar(p, { en_menu: v }, v ? `${p.nombre} vuelve al menú` : `${p.nombre} ya no se muestra en el menú`)} /></span>, texto: p => p.en_menu ? "Sí" : "No" },
        ]}
        onFila={p => abrir(p.codigo)} accion={{ titulo: "Editar", icon: Pencil, onClick: p => abrir(p.codigo) }}
        menu={p => [
          { label: "Duplicar", icon: Copy, onClick: () => duplicar(p) },
          { label: "Ver en la tienda", icon: ExternalLink, onClick: () => window.open(`/tienda#${p.codigo}`, "_blank", "noopener") },
          "-",
          { label: "Eliminar", icon: Trash2, peligro: true, onClick: () => setBorrar(p) },
        ]}
        masivas={[
          { titulo: "Marcar agotados", icon: X, onClick: async fs => { await supabase.from("productos").update({ agotado: true }).in("id", fs.map(f => f.id)); avisar(`${fs.length} productos marcados como agotados`); } },
          { titulo: "Quitar agotado", onClick: async fs => { await supabase.from("productos").update({ agotado: false }).in("id", fs.map(f => f.id)); avisar(`${fs.length} productos disponibles otra vez`); } },
        ]}
        onExportar={(t, f, c) => exportarTabla(t, "Productos", f, c, config)}
        vacio={{ icon: UtensilsCrossed, titulo: "Todavía no hay productos", texto: "Agrega tu primer plato. Luego sube las fotos en lote con sus códigos.", accion: { label: "Agregar producto", icon: Plus, onClick: () => abrir("nuevo") } }} />
      {editar && (editar === "nuevo" || productos.length > 0) && (
        <EditorProducto key={editar} producto={productos.find(p => p.codigo === editar)} categorias={categorias} ingredientes={ingredientes}
          tabInicial={params.get("tab") || "general"} onClose={() => abrir(null)} />
      )}
      {borrar && <ConfirmDialog titulo={`¿Eliminar «${borrar.nombre}»?`} peligro confirmar="Eliminar" onClose={() => setBorrar(null)}
        texto="Deja de verse en todos los canales. Los pedidos anteriores conservan su nombre y su precio."
        onConfirm={async () => { const { error } = await supabase.from("productos").delete().eq("id", borrar.id); if (error) avisar(mensajeError(error), "bad"); else avisar(`${borrar.nombre} eliminado`); }} />}
    </>
  );
}

type Form = Omit<Producto, "id"> & { mods: string[]; receta: { ingrediente_id: string; cantidad: number }[] };
const TABS: [string, string][] = [["general", "General"], ["precio", "Precio y variantes"], ["receta", "Receta"], ["fotos", "Fotos"], ["canales", "Disponibilidad por canal"]];

function EditorProducto({ producto, categorias, ingredientes, tabInicial, onClose }: { producto?: ProductoCompleto; categorias: Categoria[]; ingredientes: Ingrediente[]; tabInicial: string; onClose: () => void }) {
  const avisar = useAvisar();
  const inicial = useMemo<Form>(() => producto ? {
    ...producto, mods: [...producto.modificadores].sort((a, b) => a.orden - b.orden).map(m => m.nombre),
    receta: producto.recetas.map(r => ({ ingrediente_id: r.ingrediente_id, cantidad: Number(r.cantidad) })),
  } : {
    codigo: "", nombre: "", nombre_en: "", descripcion: "", precio: 0, costo: 0, categoria_id: categorias[0]?.id || null, estacion: "cocina", foto_url: null,
    canales: { salon: true, mostrador: true, delivery: true, tienda: true }, favorito: false, agotado: false, en_menu: true, stock: null, mods: [], receta: [],
  }, [producto]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<Form>(inicial);
  const [tab, setTab] = useState(TABS.some(t => t[0] === tabInicial) ? tabInicial : "general");
  const [precioTxt, setPrecioTxt] = useState(producto ? String(producto.precio).replace(".", ",") : "");
  const [mod, setMod] = useState(""), [error, setError] = useState(""), [guardando, setGuardando] = useState(false), [subiendo, setSubiendo] = useState(false);
  const [nuevoIng, setNuevoIng] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!producto) siguienteCodigo().then(c => setF(x => ({ ...x, codigo: x.codigo || c }))); }, [producto]);
  const up = <K extends keyof Form>(k: K, v: Form[K]) => { setF(x => ({ ...x, [k]: v })); setError(""); };
  const cambios = JSON.stringify(f) !== JSON.stringify(inicial);
  const costo = f.receta.length ? f.receta.reduce((a, r) => a + r.cantidad * Number(ingredientes.find(i => i.id === r.ingrediente_id)?.costo_unitario || 0), 0) : Number(f.costo || 0);
  const m = margen(Number(f.precio), costo);

  async function guardar() {
    if (!f.nombre.trim()) { setTab("general"); return setError("Escribe el nombre del producto."); }
    if (!(Number(f.precio) > 0)) { setTab("precio"); return setError("Escribe un precio mayor a cero."); }
    if ((f.descripcion || "").length > 120) { setTab("general"); return setError("La descripción puede tener hasta 120 caracteres."); }
    setGuardando(true);
    try {
      const { mods, receta } = f;
      // Solo las columnas de la tabla productos (sin id, fechas ni listas relacionadas)
      const fila = {
        codigo: f.codigo, nombre: f.nombre.trim(), nombre_en: f.nombre_en || null, descripcion: f.descripcion || null, precio: Number(f.precio),
        costo: Math.round(costo * 100) / 100, categoria_id: f.categoria_id, estacion: f.estacion, foto_url: f.foto_url, canales: f.canales,
        favorito: f.favorito, agotado: f.agotado, en_menu: f.en_menu, stock: f.stock,
      };
      let id = producto?.id;
      if (id) { const { error } = await supabase.from("productos").update(fila).eq("id", id); if (error) throw error; }
      else { const { data, error } = await supabase.from("productos").insert(fila).select("id").single(); if (error) throw error; id = data.id; }
      // Modificadores y receta: se reemplazan por la versión del editor
      if (JSON.stringify(mods) !== JSON.stringify(inicial.mods)) {
        await supabase.from("modificadores").delete().eq("producto_id", id);
        if (mods.length) { const { error } = await supabase.from("modificadores").insert(mods.map((n, i) => ({ producto_id: id, nombre: n, orden: i + 1 }))); if (error) throw error; }
      }
      if (JSON.stringify(receta) !== JSON.stringify(inicial.receta)) {
        await supabase.from("recetas").delete().eq("producto_id", id);
        if (receta.length) { const { error } = await supabase.from("recetas").insert(receta.map(r => ({ producto_id: id, ...r }))); if (error) throw error; }
      }
      avisar(producto ? `Cambios guardados en ${f.nombre}` : `${f.nombre} agregado al menú`);
      onClose();
    } catch (e) { setError(mensajeError(e)); } finally { setGuardando(false); }
  }
  async function subir(file: File) {
    setSubiendo(true);
    try { up("foto_url", await subirFoto("productos", "menu", f.codigo || "nuevo", file)); }
    catch (e) { setError(mensajeError(e)); } finally { setSubiendo(false); }
  }
  const nombreCat = categorias.find(c => c.id === f.categoria_id)?.nombre;
  const etiqueta = (t: string) => t === "Receta" && f.receta.length ? `Receta (${f.receta.length})` : t;

  return (
    <Drawer titulo={producto ? f.nombre || "Producto" : "Nuevo producto"} sub={f.codigo} onClose={onClose}
      pie={<>{cambios && <span className="text-sm text-ink-3">Tienes cambios sin guardar</span>}<span className="flex-1" /><Button variant="ghost" onClick={onClose}>Descartar</Button><Button variant="primary" loading={guardando} onClick={guardar}>Guardar</Button></>}>
      <div role="tablist" className="sin-barra -mx-1 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, t]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
          className={cx("min-h-11 whitespace-nowrap border-b-[3px] px-3.5 font-semibold", tab === k ? "border-accent text-brand-text" : "border-transparent text-ink-3")}>{etiqueta(t)}</button>)}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}

      {tab === "general" && (
        <div className="flex flex-col gap-3.5">
          <FormField id="p-nombre" label="Nombre"><input id="p-nombre" value={f.nombre} onChange={e => up("nombre", e.target.value)} /></FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="p-cat" label="Categoría"><select id="p-cat" value={f.categoria_id || ""} onChange={e => up("categoria_id", e.target.value || null)}>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}<option value="">Sin categoría</option></select></FormField>
            <FormField id="p-est" label="Estación de cocina" ayuda="La comanda sale en la pantalla de esta estación."><select id="p-est" value={f.estacion} onChange={e => up("estacion", e.target.value as Producto["estacion"])}>{ESTACIONES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></FormField>
          </div>
          <FormField id="p-desc" label="Descripción corta" hint={`${(f.descripcion || "").length} de 120 caracteres`}><textarea id="p-desc" rows={3} maxLength={120} value={f.descripcion || ""} onChange={e => up("descripcion", e.target.value)} /></FormField>
          <FormField id="p-en" label="Nombre en inglés (opcional)"><input id="p-en" value={f.nombre_en || ""} onChange={e => up("nombre_en", e.target.value)} /></FormField>
          <FormField id="p-mod" label="Modificadores" hint="Opciones rápidas que el mesero toca al tomar el pedido. Toca una para quitarla.">
            <div className="flex flex-wrap gap-2">{f.mods.map(x => <Chip key={x} activo onClick={() => up("mods", f.mods.filter(y => y !== x))}>{x} <X size={14} /></Chip>)}</div>
            <div className="flex gap-2">
              <input id="p-mod" value={mod} placeholder="Ej.: sin cebolla" onChange={e => setMod(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && mod.trim()) { e.preventDefault(); up("mods", [...new Set([...f.mods, mod.trim()])]); setMod(""); } }} />
              <Button icon={Plus} disabled={!mod.trim()} onClick={() => { up("mods", [...new Set([...f.mods, mod.trim()])]); setMod(""); }}>Agregar</Button>
            </div>
          </FormField>
          <div className="flex flex-wrap gap-x-6">
            <Switch id="p-fav" label="Favorito de la casa" checked={f.favorito} onChange={v => up("favorito", v)} />
            <Switch id="p-ago" label="Agotado" checked={f.agotado} onChange={v => up("agotado", v)} />
            <Switch id="p-menu" label="En el menú" checked={f.en_menu} onChange={v => up("en_menu", v)} />
          </div>
        </div>
      )}

      {tab === "precio" && (
        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="p-precio" label="Precio de venta (Bs)"><input id="p-precio" inputMode="decimal" value={precioTxt} placeholder="38,00" onChange={e => { setPrecioTxt(e.target.value); up("precio", leerMonto(e.target.value)); }} /></FormField>
            <FormField id="p-costo" label="Costo por porción (Bs)" hint={f.receta.length ? "Se calcula solo desde la receta" : "Aproximado: arma la receta para calcularlo"}>
              <input id="p-costo" inputMode="decimal" disabled={!!f.receta.length} value={f.receta.length ? cantidad(Math.round(costo * 100) / 100) : String(f.costo).replace(".", ",")} onChange={e => up("costo", leerMonto(e.target.value))} />
            </FormField>
          </div>
          <FormField id="p-stock" label="Stock por unidad (opcional)" hint="Solo para bebidas embotelladas. Al entregar el pedido se descuenta; en 0 queda agotado.">
            <input id="p-stock" inputMode="numeric" value={f.stock ?? ""} onChange={e => up("stock", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0))} />
          </FormField>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col rounded-sm bg-surface-2 px-3 py-2.5"><span className="text-xs text-ink-3">Ganancia por plato</span><strong className="num text-lg">{bs(Number(f.precio) - costo)}</strong></div>
            <div className="flex flex-col rounded-sm bg-surface-2 px-3 py-2.5"><span className="text-xs text-ink-3">Margen</span><span><Badge tono={tonoMargen(m)}>{porcentaje(m)}</Badge></span></div>
          </div>
          <p className="text-sm text-ink-3">Verde desde 60 %, ámbar entre 45 % y 60 %, rojo por debajo de 45 %.</p>
        </div>
      )}

      {tab === "receta" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-3">Insumos de <strong>una porción</strong>. Al entregar el pedido se descuentan del inventario.</p>
          {f.receta.length === 0 ? <EmptyState icon={UtensilsCrossed} titulo="Este plato no tiene receta todavía" texto="Agrega los insumos de una porción y el costo se calcula solo." /> : (
            <table className="w-full text-[15px]">
              <thead><tr className="text-[13px] text-ink-3"><th className="py-2 text-left font-semibold">Insumo</th><th className="py-2 text-left font-semibold">Cantidad</th><th className="py-2 text-right font-semibold">Costo</th><th /></tr></thead>
              <tbody>{f.receta.map((r, k) => { const i = ingredientes.find(x => x.id === r.ingrediente_id); return (
                <tr key={r.ingrediente_id} className="border-t border-line">
                  <td className="py-1.5">{i?.nombre}</td>
                  <td className="py-1.5"><span className="flex items-center gap-1.5"><input aria-label={`Cantidad de ${i?.nombre}`} inputMode="decimal" className="!w-24" defaultValue={cantidad(r.cantidad)} onBlur={e => { const n = leerMonto(e.target.value); if (n > 0) up("receta", f.receta.map((x, j) => j === k ? { ...x, cantidad: n } : x)); }} />{i?.unidad}</span></td>
                  <td className="num py-1.5 text-right">{bs(r.cantidad * Number(i?.costo_unitario || 0))}</td>
                  <td className="text-right"><button type="button" aria-label={`Quitar ${i?.nombre}`} className="grid h-10 w-10 place-items-center text-ink-3 hover:text-bad" onClick={() => up("receta", f.receta.filter((_, j) => j !== k))}><Trash2 size={16} /></button></td>
                </tr>
              ); })}
                <tr className="border-t-2 border-line font-bold"><td className="py-2">Costo por porción</td><td /><td className="num py-2 text-right">{bs(costo)}</td><td /></tr>
              </tbody>
            </table>
          )}
          <div className="flex gap-2">
            <select aria-label="Insumo para agregar" value={nuevoIng} onChange={e => setNuevoIng(e.target.value)}>
              <option value="">Elige un insumo…</option>
              {ingredientes.filter(i => !f.receta.some(r => r.ingrediente_id === i.id)).map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
            </select>
            <Button icon={Plus} disabled={!nuevoIng} onClick={() => { up("receta", [...f.receta, { ingrediente_id: nuevoIng, cantidad: 0.1 }]); setNuevoIng(""); }}>Agregar</Button>
          </div>
        </div>
      )}

      {tab === "fotos" && (
        <div className="flex flex-col gap-3">
          <ProductPhoto codigo={f.codigo} nombre={f.nombre || "Producto"} categoria={nombreCat} fotoUrl={f.foto_url} className="max-w-sm" />
          <input ref={archivo} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) subir(x); e.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button icon={Images} loading={subiendo} onClick={() => archivo.current?.click()}>{f.foto_url ? "Cambiar foto" : "Subir foto"}</Button>
            {f.foto_url && <Button variant="ghost" icon={Trash2} onClick={() => up("foto_url", null)}>Quitar foto</Button>}
          </div>
          <p className="text-sm text-ink-3">Se recorta al centro en 4:3 y se comprime antes de subirla. Sin foto, se muestra la ilustración del plato.</p>
        </div>
      )}

      {tab === "canales" && (
        <div className="flex flex-col">
          {([["salon", "Salón (mesero y QR de mesa)"], ["mostrador", "Mostrador y para llevar"], ["delivery", "Delivery"], ["tienda", "Tienda online"]] as const).map(([k, t]) =>
            <Switch key={k} id={"can-" + k} label={t} checked={f.canales[k]} onChange={v => up("canales", { ...f.canales, [k]: v })} />)}
        </div>
      )}
    </Drawer>
  );
}
