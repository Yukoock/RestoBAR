// Delivery (B6.6): app del repartidor. Entregas asignadas, mapa (Leaflet + OpenStreetMap, sin API de pago),
// contacto con el cliente y pasos Asignado → Recogido → En camino → Entregado.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bike, Camera, Check, ChevronLeft, Copy, LogOut, MessageCircle, Navigation, Phone } from "lucide-react";
import { Mapa } from "@/components/Mapa";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { bs, cx, iniciales, mensajeError, minutosDesde } from "@/lib/formato";
import { useConsulta, pagado } from "@/lib/datos";
import { subirComprobante } from "@/lib/fotos";
import type { Pedido } from "@/lib/tipos";
import { Badge, Button, Chip, EmptyState, IconButton, Skeleton, Switch, useAvisar } from "@/components/ui";

type Paso = NonNullable<Pedido["delivery_estado"]>;
const PASOS: [Paso, string][] = [["asignado", "Asignado"], ["recogido", "Recogido"], ["en_camino", "En camino"], ["entregado", "Entregado"]];
const GRUPOS = { asig: (p: Pedido) => p.delivery_estado === "asignado", curso: (p: Pedido) => p.delivery_estado === "recogido" || p.delivery_estado === "en_camino", ent: (p: Pedido) => p.delivery_estado === "entregado" };

export function Delivery() {
  useTitulo("Delivery");
  const { perfil, salir } = useAuth();
  const [disponible, setDisponible] = useState(() => localStorage.getItem("restobar-repartidor-disponible") !== "0");
  const [grupo, setGrupo] = useState<keyof typeof GRUPOS>("asig");
  const [sel, setSel] = useState<string | null>(null);
  const desde = new Date(Date.now() - 36 * 3600000).toISOString();
  // El repartidor solo ve sus entregas (lo asegura la base de datos); el Dueño y el cajero ven todas
  const { datos: pedidos, cargando } = useConsulta<Pedido[]>("entregas", () => {
    let q = supabase.from("pedidos").select("*, pedido_items(*)").not("delivery_estado", "is", null).neq("estado", "anulado").gte("created_at", desde).order("created_at", { ascending: false });
    if (perfil?.rol === "repartidor") q = q.eq("repartidor_id", perfil.id);
    return q as never;
  }, [], ["pedidos", "pedido_items"]);
  useEffect(() => { localStorage.setItem("restobar-repartidor-disponible", disponible ? "1" : "0"); }, [disponible]);
  const p = pedidos.find(x => x.id === sel);
  if (p) return <Entrega p={p} onVolver={() => setSel(null)} />;
  const lista = pedidos.filter(GRUPOS[grupo]);
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg">
      <header className="sticky top-0 z-10 flex min-h-[60px] items-center gap-2.5 border-b border-line bg-surface px-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-r-delivery text-sm font-bold text-on-role">{iniciales(perfil?.nombre || "?")}</span>
        <div className="flex flex-1 flex-col leading-tight"><strong>{perfil?.nombre}</strong><small className="text-ink-3">{disponible ? "Disponible" : "No disponible"}</small></div>
        <Switch id="disponible" ocultarTexto label="Disponible para entregas" checked={disponible} onChange={setDisponible} />
        <IconButton icon={LogOut} label="Cerrar sesión" onClick={salir} />
      </header>
      {!disponible && <p className="bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">Estás como no disponible. Igual ves tus entregas pendientes.</p>}
      <div className="flex flex-wrap gap-2 px-3.5 pt-3">
        {([["asig", "Asignados"], ["curso", "En curso"], ["ent", "Entregados"]] as const).map(([k, t]) => <Chip key={k} activo={grupo === k} contador={pedidos.filter(GRUPOS[k]).length} onClick={() => setGrupo(k)}>{t}</Chip>)}
      </div>
      <ul className="flex flex-col gap-2.5 p-3.5">
        {cargando && [1, 2, 3].map(i => <li key={i}><Skeleton h={110} r={12} /></li>)}
        {!cargando && lista.length === 0 && <li><EmptyState icon={Bike} titulo="Nada por aquí" texto={grupo === "asig" ? "Cuando la caja te asigne un pedido, aparece aquí." : "Todavía no hay entregas en este grupo."} /></li>}
        {lista.map(x => (
          <li key={x.id}>
            <button type="button" onClick={() => setSel(x.id)} className="flex w-full flex-col gap-2 rounded-md border border-l-[5px] border-line border-l-r-delivery bg-surface p-3.5 text-left">
              <span className="flex justify-between gap-2"><strong className="num">#{x.numero} · {x.cliente || "Sin nombre"}</strong><strong className="num">{bs(x.total)}</strong></span>
              {x.direccion ? <span className="text-sm">{x.direccion}</span> : <Badge tono="bad" icon={AlertTriangle}>Faltan datos: dirección</Badge>}
              <span className="flex flex-wrap gap-1.5">
                <Badge tono={pagado(x) ? "ok" : x.pago_pendiente ? "info" : "warn"} punto>{pagado(x) ? `Pagado (${x.pago_metodo === "qr" ? "QR" : "caja"})` : x.pago_pendiente ? "QR por validar" : "Cobrar al entregar"}</Badge>
                <Badge tono={["listo", "entregado"].includes(x.estado) ? "ok" : "neutral"}>{["listo", "entregado"].includes(x.estado) ? "Listo en cocina" : `En cocina · ${minutosDesde(x.created_at)} min`}</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Entrega({ p, onVolver }: { p: Pedido; onVolver: () => void }) {
  const { config } = useConfig();
  const avisar = useAvisar();
  const [enviando, setEnviando] = useState(false);
  const foto = useRef<HTMLInputElement>(null);
  const idx = PASOS.findIndex(x => x[0] === p.delivery_estado);
  const cocinaLista = ["listo", "entregado"].includes(p.estado);
  const tel = (p.telefono || "").replace(/\D/g, "");
  const telCompleto = tel.length === 8 ? "591" + tel : tel;
  const busqueda = encodeURIComponent(`${p.direccion || ""}, ${config.ciudad || "Santa Cruz de la Sierra, Bolivia"}`);

  async function paso(nuevo: Paso) {
    setEnviando(true);
    const cambios: Partial<Pedido> = { delivery_estado: nuevo };
    if (nuevo === "entregado") {
      cambios.estado = "entregado";
      if (!pagado(p) && !p.pago_pendiente) { cambios.pago_metodo = "efectivo"; cambios.pago_pendiente = false; cambios.pago_efectivo = Number(p.total); }
    }
    const { error } = await supabase.from("pedidos").update(cambios).eq("id", p.id);
    setEnviando(false);
    if (error) avisar(mensajeError(error), "bad");
    else avisar(nuevo === "entregado" ? `Pedido #${p.numero} entregado${!pagado(p) && !p.pago_pendiente ? ` · cobraste ${bs(p.total)}` : ""}` : `Pedido #${p.numero}: ${PASOS.find(x => x[0] === nuevo)![1].toLowerCase()}`);
  }
  async function subirFoto(f: File) {
    setEnviando(true);
    try { await subirComprobante("entregas", `pedido-${p.numero}`, f); avisar("Foto de entrega guardada"); } catch (e) { avisar(mensajeError(e), "bad"); } finally { setEnviando(false); }
  }
  async function copiar() { try { await navigator.clipboard.writeText(p.direccion || ""); avisar("Dirección copiada"); } catch { avisar("No se pudo copiar", "bad"); } }

  const accion: [string, (() => void) | null, boolean] =
    p.delivery_estado === "asignado" ? (cocinaLista ? ["Marcar como recogido", () => paso("recogido"), false] : ["Esperando a cocina…", null, true])
      : p.delivery_estado === "recogido" ? ["Salir a entregar", () => paso("en_camino"), false]
        : p.delivery_estado === "en_camino" ? [pagado(p) || p.pago_pendiente ? "Entregado" : `Cobré ${bs(p.total)} · entregado`, () => paso("entregado"), false]
          : ["Agregar foto de entrega", () => foto.current?.click(), false];
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg pb-28">
      <header className="sticky top-0 z-[500] flex min-h-[60px] items-center gap-2 border-b border-line bg-surface px-2">
        <IconButton icon={ChevronLeft} label="Volver a las entregas" onClick={onVolver} /><strong className="flex-1 text-lg">Entrega #{p.numero}</strong>
      </header>
      <Mapa direccion={p.direccion} ciudad={config.ciudad} />
      <div className="flex flex-col gap-3 p-3.5">
        {!p.direccion && <div className="flex items-center gap-3 rounded-md bg-bad-soft px-3.5 py-3 text-bad"><AlertTriangle size={20} /><div><strong>Faltan datos: dirección</strong><p className="text-sm">Llama al cliente antes de salir.</p></div></div>}
        <div><strong>{p.cliente || "Sin nombre"}</strong><p className="text-sm">{p.direccion || "Sin dirección"}</p>{p.telefono && <p className="num text-sm text-ink-3">{p.telefono}</p>}</div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${p.telefono || ""}`} className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface font-semibold", !tel && "pointer-events-none opacity-40")}><Phone size={18} />Llamar</a>
          <a href={`https://wa.me/${telCompleto}?text=${encodeURIComponent(`Hola, soy el repartidor de ${config.nombre}. Voy con tu pedido #${p.numero}.`)}`} target="_blank" rel="noopener" className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface font-semibold", !tel && "pointer-events-none opacity-40")}><MessageCircle size={18} />WhatsApp</a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${busqueda}`} target="_blank" rel="noopener" className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface font-semibold", !p.direccion && "pointer-events-none opacity-40")}><Navigation size={18} />Abrir en Maps</a>
          <Button icon={Copy} disabled={!p.direccion} onClick={copiar}>Copiar dirección</Button>
        </div>
        <ol className="flex justify-between gap-1 text-xs font-semibold text-ink-3">
          {PASOS.map(([k, t], i) => (
            <li key={k} className={cx("flex flex-1 flex-col items-center gap-1 text-center", i <= idx && "text-ink")}>
              <i aria-hidden="true" className={cx("grid h-6 w-6 place-items-center rounded-full border-2", i <= idx ? "border-ok bg-ok text-white" : "border-line bg-surface")}>{i <= idx && <Check size={12} strokeWidth={3} />}</i>{t}
            </li>
          ))}
        </ol>
        <ul className="flex flex-col">
          {(p.pedido_items || []).map(i => <li key={i.id} className="grid grid-cols-[34px_1fr_auto] gap-2 border-b border-dashed border-line py-1.5"><span className="num">{i.cantidad} ×</span><span>{i.nombre}{i.nota && <em className="block text-[13px] not-italic text-accent-deep">{i.nota}</em>}</span><span className="num">{bs(i.cantidad * Number(i.precio_unitario))}</span></li>)}
          <li className="grid grid-cols-[34px_1fr_auto] gap-2 border-b border-dashed border-line py-1.5"><span /><span>Envío</span><span className="num">{bs(p.envio)}</span></li>
        </ul>
        <div className="flex items-baseline justify-between"><span>{pagado(p) ? "Ya está pagado" : p.pago_pendiente ? "Pagó con QR (por validar)" : "Cobrar al entregar"}</span><strong className="num font-display text-2xl">{bs(p.total)}</strong></div>
      </div>
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }} />
      {/* La barra no tapa el mapa ni el contenido: la página deja un espacio igual a su altura */}
      <div className="fixed inset-x-0 bottom-0 z-[500] mx-auto max-w-md border-t border-line bg-surface px-3.5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <Button variant="role" rol="var(--r-delivery)" size="lg" className="w-full" icon={p.delivery_estado === "entregado" ? Camera : undefined} loading={enviando} disabled={accion[2]} onClick={accion[1] || undefined}>{accion[0]}</Button>
      </div>
    </div>
  );
}
