// Mesero (B6.5): app de celular. Mesas que llaman primero, detalle de la mesa, tomar pedido con fotos y opciones,
// y modo sin conexión: el pedido queda guardado y se envía solo al volver la red.
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Check, ChevronLeft, Download, Layers, LogOut, Minus, Plus, Receipt, Search, Shuffle, Split, Users, WifiOff, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/config";
import { bs, cx, iniciales, mensajeError, minutosDesde, sinTildes } from "@/lib/formato";
import { useAhora, useEnLinea } from "@/lib/hooks";
import { useMesas, usePedidosAbiertos, useLlamadasActivas, estadoMesa, ESTADO_MESA, etiquetaEstado, type EstadoMesa } from "@/lib/datos";
import { useMenuVenta, enviarPedido, encolar, vaciarCola, useCola, esErrorDeRed, sumarLinea, totalLineas, cantidadLineas, sonar, type Linea } from "@/lib/operacion";
import type { Mesa, Pedido } from "@/lib/tipos";
import type { ProductoCompleto } from "@/lib/catalogo";
import { Badge, BottomSheet, Button, Chip, EmptyState, IconButton, Menu, ProductPhoto, SearchInput, Skeleton, useAvisar } from "@/components/ui";

const ICONO: Record<EstadoMesa, typeof Check> = { libre: Check, ocupada: Users, cuenta: Receipt, llamando: Bell };
const BORDE: Record<EstadoMesa, string> = { libre: "border-l-ok", ocupada: "border-l-warn", cuenta: "border-l-bad bg-bad-soft", llamando: "border-l-info bg-info-soft" };
const TEXTO: Record<EstadoMesa, string> = { libre: "text-ok", ocupada: "text-warn", cuenta: "text-bad", llamando: "text-info" };
let eventoInstalar: (Event & { prompt: () => void }) | null = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); eventoInstalar = e as typeof eventoInstalar; });

export function Mesero() {
  useTitulo("Mesero");
  const { perfil, salir } = useAuth();
  const avisar = useAvisar();
  const enLinea = useEnLinea();
  const cola = useCola();
  const { datos: mesas, cargando } = useMesas();
  const { datos: abiertos } = usePedidosAbiertos();
  const { datos: llamadas, cargando: cargandoLlamadas } = useLlamadasActivas();
  const [filtro, setFiltro] = useState<"todas" | EstadoMesa | "mias">("todas");
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [tomar, setTomar] = useState(false);
  const [banner, setBanner] = useState(() => localStorage.getItem("restobar-banner-alertas") !== "0" && typeof Notification !== "undefined" && Notification.permission !== "granted");
  const llamadasVistas = useRef<Set<string> | null>(null);
  useAhora(20000);
  const miZona = perfil?.zona || null;
  const estado = (m: Mesa) => estadoMesa(m.id, abiertos, llamadas);

  // Al volver la conexión se envían los pedidos guardados
  useEffect(() => {
    if (!enLinea || !cola.length) return;
    vaciarCola().then(n => n && avisar(`Volvió la conexión: ${n} pedido(s) enviados a cocina`));
  }, [enLinea]); // eslint-disable-line react-hooks/exhaustive-deps
  // Llamada nueva en mi zona: sonido, vibración y notificación
  useEffect(() => {
    if (cargandoLlamadas) return;
    if (!llamadasVistas.current) { llamadasVistas.current = new Set(llamadas.map(l => l.id)); return; }
    llamadas.forEach(l => {
      if (llamadasVistas.current!.has(l.id)) return;
      llamadasVistas.current!.add(l.id);
      const m = mesas.find(x => x.id === l.mesa_id);
      if (!m || (miZona && m.zona !== miZona)) return;
      sonar("llamada"); navigator.vibrate?.([200, 100, 200]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification(`Mesa ${m.numero} te llama`, { body: l.motivo, icon: "/icono-192.png", tag: l.id });
      avisar(`Mesa ${m.numero} te llama: ${l.motivo}`, "info", { label: "Ver", onClick: () => setMesaId(m.id) });
    });
  }, [llamadas, cargandoLlamadas]); // eslint-disable-line react-hooks/exhaustive-deps

  async function activarAlertas() {
    if (typeof Notification === "undefined") return avisar("Este celular no permite notificaciones. Igual sonará cuando la app esté abierta.", "info");
    const r = await Notification.requestPermission();
    sonar("llamada");
    if (r === "granted") { setBanner(false); avisar("Alertas activadas en este celular"); } else avisar("No se dio permiso. Puedes activarlo en los ajustes del navegador.", "info");
  }
  function instalar() {
    if (eventoInstalar) { eventoInstalar.prompt(); eventoInstalar = null; }
    else avisar("Abre el menú del navegador y elige «Agregar a pantalla de inicio» o «Instalar app».", "info");
  }

  const mesa = mesas.find(m => m.id === mesaId);
  if (mesa && tomar) return <TomarPedido mesa={mesa} onVolver={() => setTomar(false)} onEnviado={() => setTomar(false)} enLinea={enLinea} />;
  if (mesa) return <DetalleMesa mesa={mesa} mesas={mesas} abiertos={abiertos} llamadas={llamadas} cola={cola.filter(b => b.mesa_id === mesa.id)} onVolver={() => setMesaId(null)} onAgregar={() => setTomar(true)} onMesa={setMesaId} />;

  const conEstado = mesas.map(m => ({ m, e: estado(m), p: abiertos.find(p => p.mesa_id === m.id), l: llamadas.find(l => l.mesa_id === m.id) }));
  const cuenta = (k: typeof filtro) => conEstado.filter(x => k === "todas" || (k === "mias" ? !miZona || x.m.zona === miZona : x.e === k)).length;
  const lista = conEstado.filter(x => filtro === "todas" || (filtro === "mias" ? !miZona || x.m.zona === miZona : x.e === filtro))
    .sort((a, b) => Number(b.e === "llamando") - Number(a.e === "llamando") || Number(b.e === "cuenta") - Number(a.e === "cuenta") || a.m.numero - b.m.numero);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
      <header className="sticky top-0 z-10 flex min-h-[60px] items-center gap-2.5 border-b border-line bg-surface px-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-r-mesero text-sm font-bold text-on-role">{iniciales(perfil?.nombre || "?")}</span>
        <div className="flex flex-1 flex-col leading-tight"><strong>Hola, {perfil?.nombre.split(" ")[0]}</strong><small className="text-ink-3">{miZona || "Todas las zonas"}{!enLinea && " · sin conexión"}</small></div>
        <Menu label="Menú del mesero" items={[{ label: "Activar alertas", icon: BellRing, onClick: activarAlertas }, { label: "Instalar app", icon: Download, onClick: instalar }, "-", { label: "Cerrar sesión", icon: LogOut, onClick: salir }]} />
      </header>
      {!enLinea && <div className="flex items-center gap-2 bg-warn-soft px-3.5 py-2.5 text-sm font-semibold text-warn"><WifiOff size={18} />Sin conexión: los pedidos se guardan y se envían al volver.</div>}
      {cola.length > 0 && <div className="bg-warn-soft px-3.5 pb-2.5 text-sm text-warn">{cola.length} pedido(s) esperando para enviarse: {cola.map(b => b.etiqueta).join(", ")}</div>}
      {banner && (
        <div className="mx-3.5 mt-3 flex items-center gap-2.5 rounded-md bg-maiz-soft py-2 pl-3 pr-1.5 text-sm">
          <Bell size={20} className="flex-none" /><span className="flex-1">Activa las alertas para saber cuándo te llama una mesa.</span>
          <Button size="sm" onClick={activarAlertas}>Activar</Button>
          <IconButton icon={X} label="Cerrar aviso" onClick={() => { setBanner(false); localStorage.setItem("restobar-banner-alertas", "0"); }} />
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 px-3.5 pt-3">
        {([["libre", "Libres"], ["ocupada", "Ocupadas"], ["llamando", "Llamando"], ["mias", "Mis mesas"]] as const).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(filtro === k ? "todas" : k)}
            className={cx("flex flex-col items-center rounded-md border px-1 py-2 text-xs font-semibold", k === "llamando" && cuenta(k) ? "border-transparent bg-info-soft text-info" : "border-line bg-surface text-ink-2", filtro === k && "shadow-[inset_0_0_0_2px_var(--brand)]")}>
            <strong className="num font-display text-[22px]">{cuenta(k)}</strong>{t}
          </button>
        ))}
      </div>
      <div className="sin-barra flex gap-2 overflow-x-auto px-3.5 pt-3">
        {([["todas", "Todas"], ["llamando", "Llamando"], ["cuenta", "Pidieron la cuenta"], ["ocupada", "Ocupadas"], ["libre", "Libres"], ["mias", "Mis mesas"]] as const).map(([k, t]) => <Chip key={k} activo={filtro === k} onClick={() => setFiltro(k)}>{t}</Chip>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        {cargando ? [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} h={92} r={12} />) : lista.length === 0 ? <div className="col-span-2"><EmptyState icon={Search} titulo="No hay mesas con ese filtro" /></div> : lista.map(({ m, e, p, l }) => {
          const Ic = ICONO[e];
          return (
            <button key={m.id} type="button" onClick={() => setMesaId(m.id)} className={cx("flex min-h-[92px] flex-col gap-1 rounded-md border border-l-[5px] border-line bg-surface p-3 text-left", BORDE[e])}>
              <span className="flex items-center justify-between"><strong className="num font-display text-xl">Mesa {m.numero}</strong>{e === "llamando" && <BellRing size={20} className="animate-bounce text-info" aria-hidden="true" />}</span>
              <span className={cx("flex items-center gap-1 text-xs font-bold", TEXTO[e])}><Ic size={14} strokeWidth={2} />{ESTADO_MESA[e].nombre}</span>
              <small className="text-[13px] text-ink-3">{l ? `${l.motivo} · ` : ""}{p ? bs(p.total) : `${m.capacidad} sillas`}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetalleMesa({ mesa, mesas, abiertos, llamadas, cola, onVolver, onAgregar, onMesa }:
  { mesa: Mesa; mesas: Mesa[]; abiertos: Pedido[]; llamadas: ReturnType<typeof useLlamadasActivas>["datos"]; cola: { etiqueta: string; lineas: Linea[] }[]; onVolver: () => void; onAgregar: () => void; onMesa: (id: string) => void }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [hoja, setHoja] = useState<"transferir" | "unir" | "dividir" | null>(null);
  const p = abiertos.find(x => x.mesa_id === mesa.id);
  const l = llamadas.find(x => x.mesa_id === mesa.id);
  const e = estadoMesa(mesa.id, abiertos, llamadas), Ic = ICONO[e];
  const libres = mesas.filter(m => estadoMesa(m.id, abiertos, llamadas) === "libre");
  const conCuenta = mesas.filter(m => m.id !== mesa.id && abiertos.some(x => x.mesa_id === m.id));
  async function atender() {
    const { error } = await supabase.from("llamadas").update({ atendida_por: perfil?.id, atendida_at: new Date().toISOString() }).eq("id", l!.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar("Avisamos a la mesa que vas en camino");
  }
  async function pedirCuenta() {
    const { error } = await supabase.from("pedidos").update({ pidio_cuenta: true }).eq("id", p!.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(`Mesa ${mesa.numero} pidió la cuenta · la caja ya la ve`);
  }
  async function transferir(m: Mesa) {
    const { error } = await supabase.from("pedidos").update({ mesa_id: m.id }).eq("id", p!.id);
    if (error) return avisar(mensajeError(error), "bad");
    avisar(`Cuenta pasada de la Mesa ${mesa.numero} a la Mesa ${m.numero}`); setHoja(null); onMesa(m.id);
  }
  async function unir(m: Mesa) {
    const otro = abiertos.find(x => x.mesa_id === m.id)!;
    const { error } = await supabase.rpc("unir_pedidos", { p_destino: p!.id, p_origen: otro.id });
    if (error) return avisar(mensajeError(error), "bad");
    avisar(`Mesas ${mesa.numero} y ${m.numero} unidas en una sola cuenta`); setHoja(null);
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg pb-28">
      <header className="sticky top-0 z-10 flex min-h-[60px] items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton icon={ChevronLeft} label="Volver a las mesas" onClick={onVolver} />
        <strong className="flex-1 text-lg">Mesa {mesa.numero}</strong>
        <Badge tono={ESTADO_MESA[e].tono} icon={Ic}>{ESTADO_MESA[e].nombre}</Badge>
      </header>
      <div className="flex flex-col gap-3 p-3.5">
        {l && (
          <div className="flex items-center gap-3 rounded-md bg-info-soft px-3.5 py-3 text-info">
            <BellRing size={20} /><div className="flex-1"><strong>Te llaman: {l.motivo}</strong><p className="num text-sm">Hace {Math.max(1, minutosDesde(l.created_at))} min</p></div>
            <Button variant="role" rol="var(--r-mesero)" onClick={atender}>Atender</Button>
          </div>
        )}
        {cola.map((b, i) => <div key={i} className="flex items-center gap-3 rounded-md bg-warn-soft px-3.5 py-3 text-warn"><WifiOff size={20} /><div><strong>Pedido guardado sin enviar</strong><p className="text-sm">{cantidadLineas(b.lineas)} productos · se envía al volver la red</p></div></div>)}
        {p ? (
          <div className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-1">
            <div className="flex items-center justify-between"><strong>Pedido #{p.numero}</strong><Badge tono={etiquetaEstado(p)[1]}>{etiquetaEstado(p)[0]}</Badge></div>
            <ul className="flex flex-col">{(p.pedido_items || []).map(i => (
              <li key={i.id} className="grid grid-cols-[34px_1fr_auto] items-baseline gap-2 border-b border-dashed border-line py-1.5"><span className="num">{i.cantidad} ×</span><span>{i.nombre}{i.nota && <em className="block text-[13px] font-semibold not-italic text-accent-deep">{i.nota}</em>}</span><span className="num">{bs(i.cantidad * Number(i.precio_unitario))}</span></li>
            ))}</ul>
            <div className="flex items-baseline justify-between"><span>Total de la mesa</span><strong className="num font-display text-2xl">{bs(p.total)}</strong></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={Shuffle} disabled={!libres.length} onClick={() => setHoja("transferir")}>Transferir</Button>
              <Button size="sm" icon={Layers} disabled={!conCuenta.length} onClick={() => setHoja("unir")}>Unir mesas</Button>
              <Button size="sm" icon={Split} onClick={() => setHoja("dividir")}>Dividir cuenta</Button>
            </div>
          </div>
        ) : !cola.length && <EmptyState icon={Users} titulo="Mesa sin pedido" texto="Toca «Agregar» para tomar el pedido." />}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md gap-2 border-t border-line bg-surface px-3.5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <Button size="lg" icon={Receipt} className="flex-1" disabled={!p || p.pidio_cuenta} onClick={pedirCuenta}>{p?.pidio_cuenta ? "Cuenta pedida" : "Pedir cuenta"}</Button>
        <Button size="lg" variant="role" rol="var(--r-mesero)" icon={Plus} className="flex-1" onClick={onAgregar}>Agregar</Button>
      </div>
      {hoja === "transferir" && (
        <BottomSheet titulo="Transferir a otra mesa" onClose={() => setHoja(null)}>
          <p className="text-sm text-ink-3">Solo se muestran las mesas libres.</p>
          <div className="grid grid-cols-5 gap-2">{libres.map(m => <button key={m.id} type="button" onClick={() => transferir(m)} className="num min-h-12 rounded-sm border border-line font-bold">{m.numero}</button>)}</div>
        </BottomSheet>
      )}
      {hoja === "unir" && (
        <BottomSheet titulo="Unir con otra mesa" onClose={() => setHoja(null)}>
          <p className="text-sm">Lo que pidió la otra mesa pasa a la cuenta de la Mesa {mesa.numero}.</p>
          <div className="grid grid-cols-5 gap-2">{conCuenta.map(m => <button key={m.id} type="button" onClick={() => unir(m)} className="num min-h-12 rounded-sm border border-line bg-warn-soft font-bold">{m.numero}</button>)}</div>
        </BottomSheet>
      )}
      {hoja === "dividir" && p && (
        <BottomSheet titulo="Dividir cuenta" onClose={() => setHoja(null)}>
          {[2, 3, 4, 5].map(n => <div key={n} className="flex justify-between border-b border-line py-3"><span>{n} personas</span><strong className="num">{bs(Number(p.total) / n)} cada una</strong></div>)}
          <p className="text-sm text-ink-3">La caja cobra con la misma división.</p>
        </BottomSheet>
      )}
    </div>
  );
}

function TomarPedido({ mesa, onVolver, onEnviado, enLinea }: { mesa: Mesa; onVolver: () => void; onEnviado: () => void; enLinea: boolean }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { productos, categorias, nombreCat, cargando } = useMenuVenta("salon");
  const [cat, setCat] = useState("todos"), [q, setQ] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [hoja, setHoja] = useState<ProductoCompleto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const prods = useMemo(() => productos.filter(p => (cat === "todos" || p.categoria_id === cat) && (!q || sinTildes(p.nombre).includes(sinTildes(q)))), [productos, cat, q]);
  const cant = (id: string) => lineas.filter(l => l.producto_id === id).reduce((a, l) => a + l.cantidad, 0);
  const sumar = (p: ProductoCompleto, d: number) => { if (p.agotado && d > 0) return avisar(`${p.nombre} está agotado`, "bad"); setLineas(ls => sumarLinea(ls, p.id, d)); };
  async function enviar() {
    const datos = { canal: "mesa" as const, lineas, mesa_id: mesa.id, mesero_id: perfil?.id, creado_por: perfil?.id };
    setEnviando(true);
    try {
      if (!enLinea) throw new Error("Failed to fetch");
      const p = await enviarPedido(datos);
      avisar(`Mesa ${mesa.numero}: enviado a cocina · pedido #${p.numero}`);
    } catch (e) {
      if (!esErrorDeRed(e)) { setEnviando(false); return avisar(mensajeError(e), "bad"); }
      encolar(datos, `Mesa ${mesa.numero}`);
      avisar("Sin conexión: el pedido quedó guardado y se envía al volver la red", "info");
    }
    setEnviando(false); onEnviado();
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg pb-28">
      <header className="sticky top-0 z-10 flex min-h-[60px] items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton icon={ChevronLeft} label="Volver a la mesa" onClick={onVolver} /><strong className="flex-1 text-lg">Mesa {mesa.numero} · Tomar pedido</strong>
      </header>
      <div className="flex flex-col gap-3 px-3.5 pt-3">
        <SearchInput id="m-q" value={q} onChange={setQ} placeholder="Buscar plato" className="!max-w-none" />
        <div className="sin-barra flex gap-2 overflow-x-auto"><Chip activo={cat === "todos"} onClick={() => setCat("todos")}>Todos</Chip>{categorias.map(c => <Chip key={c.id} activo={cat === c.id} onClick={() => setCat(c.id)}>{c.nombre}</Chip>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        {cargando && [1, 2, 3, 4].map(i => <Skeleton key={i} h={180} r={12} />)}
        {prods.map(p => (
          <div key={p.id} className="flex flex-col gap-1 rounded-md bg-surface p-1.5 pb-2 shadow-1">
            <button type="button" disabled={p.agotado} onClick={() => setHoja(p)} aria-label={`Opciones de ${p.nombre}`} className="relative overflow-hidden rounded-lg">
              <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-lg" />
              {p.agotado && <span className="absolute left-2 top-2 rounded-sm bg-ink px-2 text-xs font-bold text-bg">Agotado</span>}
              {cant(p.id) > 0 && <span className="num absolute right-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 font-extrabold text-on-accent">{cant(p.id)}</span>}
            </button>
            <span className="min-h-[35px] px-0.5 text-sm font-semibold leading-tight">{p.nombre}</span>
            <span className="flex items-center justify-between px-0.5 text-sm font-bold"><span className="num">{bs(p.precio)}</span>
              {cant(p.id) ? (
                <span className="inline-flex items-center rounded-full border border-line"><button type="button" aria-label={`Quitar 1 ${p.nombre}`} onClick={() => sumar(p, -1)} className="grid h-11 w-11 place-items-center"><Minus size={16} /></button><span className="num w-5 text-center">{cant(p.id)}</span><button type="button" aria-label={`Sumar 1 ${p.nombre}`} onClick={() => sumar(p, 1)} className="grid h-11 w-11 place-items-center"><Plus size={16} /></button></span>
              ) : <button type="button" disabled={p.agotado} aria-label={`Agregar ${p.nombre}`} onClick={() => sumar(p, 1)} className="grid h-11 w-11 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-35"><Plus size={18} /></button>}
            </span>
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-line bg-surface px-3.5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <Button variant="primary" size="lg" className="w-full" loading={enviando} disabled={!lineas.length} onClick={enviar}>Enviar a cocina ({cantidadLineas(lineas)}) · {bs(totalLineas(lineas, productos))}</Button>
      </div>
      {hoja && <HojaOpciones p={hoja} categoria={nombreCat(hoja.categoria_id)} onClose={() => setHoja(null)} onOk={(n, nota) => setLineas(ls => sumarLinea(ls, hoja.id, n, nota))} />}
    </div>
  );
}

function HojaOpciones({ p, categoria, onClose, onOk }: { p: ProductoCompleto; categoria?: string; onClose: () => void; onOk: (cantidad: number, nota: string) => void }) {
  const [sel, setSel] = useState<string[]>([]), [nota, setNota] = useState(""), [n, setN] = useState(1);
  const texto = [...sel, nota.trim()].filter(Boolean).join(", ").slice(0, 120);
  return (
    <BottomSheet titulo={p.nombre} onClose={onClose} pie={<Button variant="primary" size="lg" className="w-full" onClick={() => { onOk(n, texto); onClose(); }}>Agregar {n} · {bs(Number(p.precio) * n)}</Button>}>
      <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={categoria} fotoUrl={p.foto_url} />
      {p.descripcion && <p className="text-sm">{p.descripcion}</p>}
      {p.modificadores.length > 0 && <>
        <span className="text-[13px] font-semibold text-ink-3">Opciones rápidas</span>
        <div className="flex flex-wrap gap-2">{[...p.modificadores].sort((a, b) => a.orden - b.orden).map(m => <Chip key={m.id} activo={sel.includes(m.nombre)} onClick={() => setSel(s => s.includes(m.nombre) ? s.filter(x => x !== m.nombre) : [...s, m.nombre])}>{m.nombre}</Chip>)}</div>
      </>}
      <label htmlFor="h-nota" className="text-[13px] font-semibold text-ink-3">Nota para cocina</label>
      <input id="h-nota" value={nota} maxLength={60} placeholder="Ej.: sin cebolla" onChange={e => setNota(e.target.value)} />
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink-3">Cantidad</span>
        <span className="inline-flex items-center rounded-full border border-line"><button type="button" aria-label="Quitar 1" onClick={() => setN(Math.max(1, n - 1))} className="grid h-11 w-11 place-items-center"><Minus size={18} /></button><span className="num w-7 text-center font-bold">{n}</span><button type="button" aria-label="Sumar 1" onClick={() => setN(n + 1)} className="grid h-11 w-11 place-items-center"><Plus size={18} /></button></span>
      </div>
    </BottomSheet>
  );
}
