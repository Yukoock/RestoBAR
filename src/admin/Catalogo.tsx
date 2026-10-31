// Catálogo (B6.2): Categorías, Menú del día y Banners.
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Check, Image as ImageIcon, Info, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx, mensajeError } from "@/lib/formato";
import { useConsulta, inicioDelDia } from "@/lib/datos";
import { useProductos, useCategorias } from "@/lib/catalogo";
import { subirFoto } from "@/lib/fotos";
import type { Banner, Categoria, MenuDelDia } from "@/lib/tipos";
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, ErrorState, FormField, Modal, ProductPhoto, Skeleton, Stepper, Switch, useAvisar } from "@/components/ui";
import { Barra } from "@/components/graficos";

/* ================= Categorías ================= */
export function Categorias() {
  const avisar = useAvisar();
  const { datos: categorias, cargando, error, recargar } = useCategorias();
  const { datos: productos } = useProductos();
  const [editar, setEditar] = useState<Categoria | "nueva" | null>(null);
  const [borrar, setBorrar] = useState<Categoria | null>(null);
  const cuenta = (id: string) => productos.filter(p => p.categoria_id === id).length;
  async function mover(i: number, d: -1 | 1) {
    const a = categorias[i], b = categorias[i + d];
    const r = await Promise.all([supabase.from("categorias").update({ orden: b.orden }).eq("id", a.id), supabase.from("categorias").update({ orden: a.orden }).eq("id", b.id)]);
    const e = r.find(x => x.error)?.error; if (e) avisar(mensajeError(e), "bad");
  }
  async function visible(c: Categoria, v: boolean) {
    const { error } = await supabase.from("categorias").update({ visible: v }).eq("id", c.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(v ? `${c.nombre} se muestra en el menú` : `${c.nombre} quedó oculta en la tienda y el QR`);
  }
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end"><Button variant="primary" icon={Plus} onClick={() => setEditar("nueva")}>Nueva categoría</Button></div>
      <div className="overflow-x-auto rounded-md bg-surface shadow-1">
        {cargando ? <div className="flex flex-col gap-3 p-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} h={36} />)}</div> : categorias.length === 0 ? (
          <EmptyState icon={Tags} titulo="Todavía no hay categorías" texto="Crea las secciones del menú en el orden en que quieres que aparezcan." accion={{ label: "Nueva categoría", icon: Plus, onClick: () => setEditar("nueva") }} />
        ) : (
          <table className="w-full text-[15px]">
            <thead><tr className="bg-surface-2 text-[13px] text-ink-3"><th className="px-3 py-2.5 text-left font-semibold">Orden</th><th className="px-3 text-left font-semibold">Categoría</th><th className="px-3 text-right font-semibold">Productos</th><th className="px-3 text-left font-semibold">Visible</th><th /></tr></thead>
            <tbody>{categorias.map((c, i) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-2"><span className="flex items-center">
                  <button type="button" aria-label={`Subir ${c.nombre}`} data-tip="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="tip grid h-11 w-11 place-items-center disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" aria-label={`Bajar ${c.nombre}`} data-tip="Bajar" disabled={i === categorias.length - 1} onClick={() => mover(i, 1)} className="tip grid h-11 w-11 place-items-center disabled:opacity-30"><ArrowDown size={16} /></button>
                  <span className="num w-6 text-center">{i + 1}</span>
                </span></td>
                <td className="px-3 font-semibold">{c.nombre}</td>
                <td className="num px-3 text-right">{cuenta(c.id)}</td>
                <td className="px-3"><Switch id={"vis-" + c.id} ocultarTexto label={`${c.nombre} visible`} checked={c.visible} onChange={v => visible(c, v)} /></td>
                <td className="px-2 text-right"><span className="inline-flex">
                  <button type="button" aria-label={`Renombrar ${c.nombre}`} data-tip="Renombrar" onClick={() => setEditar(c)} className="tip grid h-11 w-11 place-items-center text-ink-2"><Pencil size={16} /></button>
                  <button type="button" aria-label={`Eliminar ${c.nombre}`} data-tip="Eliminar" onClick={() => setBorrar(c)} className="tip grid h-11 w-11 place-items-center text-ink-2 hover:text-bad"><Trash2 size={16} /></button>
                </span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editar && <EditarCategoria c={editar === "nueva" ? null : editar} orden={categorias.length + 1} onClose={() => setEditar(null)} />}
      {borrar && <ConfirmDialog titulo={`¿Eliminar «${borrar.nombre}»?`} peligro confirmar="Eliminar" onClose={() => setBorrar(null)}
        texto={cuenta(borrar.id) ? `Sus ${cuenta(borrar.id)} productos quedan «Sin categoría» hasta que les asignes otra.` : "La categoría está vacía."}
        onConfirm={async () => { const { error } = await supabase.from("categorias").delete().eq("id", borrar.id); if (error) avisar(mensajeError(error), "bad"); else avisar(`${borrar.nombre} eliminada`); }} />}
    </div>
  );
}
function EditarCategoria({ c, orden, onClose }: { c: Categoria | null; orden: number; onClose: () => void }) {
  const avisar = useAvisar();
  const [nombre, setNombre] = useState(c?.nombre || ""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    if (nombre.trim().length < 2) return setError("Escribe el nombre de la categoría.");
    setEnviando(true);
    const { error } = c ? await supabase.from("categorias").update({ nombre: nombre.trim() }).eq("id", c.id) : await supabase.from("categorias").insert({ nombre: nombre.trim(), orden });
    setEnviando(false);
    if (error) return setError(/duplicate|unique/i.test(error.message) ? "Ya hay una categoría con ese nombre." : mensajeError(error));
    avisar(c ? "Categoría renombrada" : `Categoría «${nombre.trim()}» creada`); onClose();
  }
  return (
    <Modal titulo={c ? "Renombrar categoría" : "Nueva categoría"} onClose={onClose} ancho={420} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <FormField id="cat-n" label="Nombre" error={error}><input id="cat-n" data-autofocus value={nombre} onChange={e => { setNombre(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && ok()} /></FormField>
    </Modal>
  );
}

/* ================= Menú del día ================= */
export function MenuDelDiaPantalla() {
  const avisar = useAvisar();
  const hoy = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
  const { datos: menu, cargando, error, recargar } = useConsulta<MenuDelDia[]>("menu-dia-" + hoy, () => supabase.from("menu_del_dia").select("*").eq("fecha", hoy) as never, [], ["menu_del_dia"]);
  const { datos: productos } = useProductos();
  const { datos: categorias } = useCategorias();
  const { datos: vendidos } = useConsulta<{ producto_id: string | null; cantidad: number }[]>("vendidos-hoy", () =>
    supabase.from("pedido_items").select("producto_id, cantidad, pedidos!inner(estado, created_at)").gte("pedidos.created_at", inicioDelDia().toISOString()).neq("pedidos.estado", "anulado") as never, [], ["pedido_items", "pedidos"]);
  const [nuevo, setNuevo] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [local, setLocal] = useState<Record<string, number>>({});
  const vendido = (pid: string) => vendidos.filter(v => v.producto_id === pid).reduce((a, v) => a + v.cantidad, 0);

  function preparado(m: MenuDelDia, n: number) {
    setLocal(x => ({ ...x, [m.id]: n }));
    clearTimeout(timers.current[m.id]);
    timers.current[m.id] = setTimeout(async () => {
      const { error } = await supabase.from("menu_del_dia").update({ preparado: n }).eq("id", m.id);
      if (error) return avisar(mensajeError(error), "bad");
      const p = productos.find(x => x.id === m.producto_id);
      if (p?.agotado && n > vendido(p.id)) {
        await supabase.from("productos").update({ agotado: false }).eq("id", p.id);
        avisar(`${p.nombre} vuelve a estar disponible: quedan ${n - vendido(p.id)}`);
      }
    }, 600);
  }
  async function cambiar(m: MenuDelDia, c: Partial<MenuDelDia>) {
    const { error } = await supabase.from("menu_del_dia").update(c).eq("id", m.id);
    if (error) avisar(mensajeError(error), "bad");
  }
  async function agregar() {
    const { error } = await supabase.from("menu_del_dia").insert({ fecha: hoy, producto_id: nuevo, preparado: 20 });
    if (error) avisar(mensajeError(error), "bad"); else setNuevo("");
  }
  async function quitar(m: MenuDelDia) {
    const { error } = await supabase.from("menu_del_dia").delete().eq("id", m.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar("Quitado del menú del día");
  }
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md bg-surface-2 px-3.5 py-3 text-ink-2"><Info size={20} /><p>Cuando se vende todo lo preparado, el plato se marca <strong>Agotado</strong> solo, en todos los canales. Si preparas más, vuelve a estar disponible.</p></div>
      {cargando ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} h={280} r={12} />)}</div> : menu.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} titulo="Todavía no armaste el menú del día" texto="Agrega los platos que preparaste hoy y cuántas porciones hay de cada uno." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menu.map(m => {
            const p = productos.find(x => x.id === m.producto_id); if (!p) return null;
            const prep = local[m.id] ?? m.preparado, v = vendido(p.id), queda = Math.max(0, prep - v);
            return (
              <article key={m.id} className={cx("flex flex-col overflow-hidden rounded-md bg-surface shadow-1", !m.disponible && "opacity-70")}>
                <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={categorias.find(c => c.id === p.categoria_id)?.nombre} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-none" />
                <div className="flex flex-col gap-2.5 p-3.5">
                  <div className="flex items-center justify-between gap-2"><strong>{p.nombre}</strong>{p.agotado ? <Badge tono="bad" icon={X}>Agotado</Badge> : <Badge tono="ok" icon={Check}><span className="num">Quedan {queda}</span></Badge>}</div>
                  <Barra valor={v} max={prep} color={queda === 0 ? "var(--bad)" : queda < prep * 0.2 ? "var(--warn)" : "var(--brand)"} />
                  <span className="num text-sm text-ink-3">Vendido {v} de {prep} preparados</span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Switch id={"md-" + m.id} label="Disponible hoy" checked={m.disponible} onChange={d => cambiar(m, { disponible: d })} />
                    <Stepper value={prep} label={`Preparado de ${p.nombre}`} onChange={n => preparado(m, n)} />
                  </div>
                  <Button variant="ghost" size="sm" icon={Trash2} className="self-start" onClick={() => quitar(m)}>Quitar del menú del día</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <select aria-label="Plato para agregar al menú del día" value={nuevo} onChange={e => setNuevo(e.target.value)} className="!w-auto min-w-[240px] flex-1 sm:flex-none">
          <option value="">Elige un plato…</option>
          {productos.filter(p => p.en_menu && !menu.some(m => m.producto_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <Button icon={Plus} disabled={!nuevo} onClick={agregar}>Agregar al menú del día</Button>
      </div>
    </div>
  );
}

/* ================= Banners ================= */
export function Banners() {
  const avisar = useAvisar();
  const { datos: banners, cargando, error, recargar } = useConsulta<Banner[]>("banners", () => supabase.from("banners").select("*").order("orden") as never, [], ["banners"]);
  const { datos: productos } = useProductos();
  const [borrar, setBorrar] = useState<Banner | null>(null);
  async function nuevo() {
    const { error } = await supabase.from("banners").insert({ titulo: "Nueva promoción", subtitulo: "", donde: ["tienda", "pantalla"], activo: false, orden: banners.length + 1 });
    if (error) avisar(mensajeError(error), "bad"); else avisar("Banner creado. Completa sus datos y actívalo.");
  }
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><Button variant="primary" icon={Plus} onClick={nuevo}>Nuevo banner</Button></div>
      {cargando ? <Skeleton h={300} r={12} /> : banners.length === 0 ? (
        <Card><EmptyState icon={ImageIcon} titulo="Todavía no hay banners" texto="Las promociones se muestran en la tienda online y en la pantalla del cliente cuando no hay un pedido." accion={{ label: "Nuevo banner", icon: Plus, onClick: nuevo }} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banners.map(b => <BannerCard key={b.id + b.foto_url} b={b} productos={productos} onBorrar={() => setBorrar(b)} />)}
        </div>
      )}
      {borrar && <ConfirmDialog titulo={`¿Eliminar «${borrar.titulo}»?`} peligro confirmar="Eliminar" texto="Deja de mostrarse en la tienda y en la pantalla del cliente." onClose={() => setBorrar(null)}
        onConfirm={async () => { const { error } = await supabase.from("banners").delete().eq("id", borrar.id); if (error) avisar(mensajeError(error), "bad"); else avisar("Banner eliminado"); }} />}
    </div>
  );
}
function BannerCard({ b, productos, onBorrar }: { b: Banner; productos: ReturnType<typeof useProductos>["datos"]; onBorrar: () => void }) {
  const avisar = useAvisar();
  const [f, setF] = useState(b);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const prod = productos.find(p => p.id === f.producto_id);
  const cambios = JSON.stringify(f) !== JSON.stringify(b);
  async function guardar(datos: Partial<Banner> = f) {
    const { error } = await supabase.from("banners").update(datos).eq("id", b.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar("Banner guardado");
  }
  async function subir(file: File) {
    setSubiendo(true);
    try { const url = await subirFoto("productos", "banners", "banner", file, 16 / 9); setF(x => ({ ...x, foto_url: url })); await guardar({ foto_url: url }); }
    catch (e) { avisar(mensajeError(e), "bad"); } finally { setSubiendo(false); }
  }
  return (
    <Card className={cx(!f.activo && "opacity-75")}>
      <div className="ilus overflow-hidden rounded-sm" style={{ aspectRatio: "16 / 9" }}>
        {f.foto_url ? <img src={f.foto_url} alt="" /> : prod ? <ProductPhoto codigo={prod.codigo} nombre={prod.nombre} fotoUrl={prod.foto_url} className="!h-full !rounded-none" /> : <div className="grid h-full place-items-center text-ink-3"><ImageIcon size={32} /></div>}
      </div>
      <input ref={archivo} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) subir(x); e.target.value = ""; }} />
      <Button size="sm" icon={ImageIcon} loading={subiendo} className="self-start" onClick={() => archivo.current?.click()}>{f.foto_url ? "Cambiar foto" : "Subir foto"}</Button>
      <FormField id={"bt-" + b.id} label="Título"><input id={"bt-" + b.id} value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} /></FormField>
      <FormField id={"bs-" + b.id} label="Subtítulo"><input id={"bs-" + b.id} value={f.subtitulo || ""} onChange={e => setF({ ...f, subtitulo: e.target.value })} /></FormField>
      <FormField id={"bp-" + b.id} label="Plato que promociona" hint="Si no subes foto, se usa la del plato. «Lo quiero» lo pone en el carrito.">
        <select id={"bp-" + b.id} value={f.producto_id || ""} onChange={e => setF({ ...f, producto_id: e.target.value || null })}><option value="">Ninguno</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </FormField>
      <span className="text-sm font-semibold">Dónde se muestra</span>
      <div className="flex flex-wrap gap-2">{([["tienda", "Tienda online"], ["pantalla", "Pantalla del cliente"]] as const).map(([k, t]) =>
        <Chip key={k} activo={f.donde.includes(k)} onClick={() => setF({ ...f, donde: f.donde.includes(k) ? f.donde.filter(x => x !== k) : [...f.donde, k] })}>{t}</Chip>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Switch id={"ba-" + b.id} label={f.activo ? "Activo" : "Apagado"} checked={f.activo} onChange={v => { setF({ ...f, activo: v }); guardar({ activo: v }); }} />
        <span className="flex gap-1.5">
          <Button variant="ghost" icon={Trash2} onClick={onBorrar}>Eliminar</Button>
          <Button variant="primary" disabled={!cambios} onClick={() => guardar()}>Guardar</Button>
        </span>
      </div>
    </Card>
  );
}
