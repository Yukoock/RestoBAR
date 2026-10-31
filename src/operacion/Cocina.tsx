// Cocina (B6.4): siempre oscura. Tres columnas, cronómetro con color, filtro por estación, sonido y comandas impresas.
// Tocar la comanda la avanza; mantenerla presionada la devuelve a la columna anterior.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, History, LogOut, Maximize, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { cx, hora, mensajeError, mmss } from "@/lib/formato";
import { useAhora, useEnLinea } from "@/lib/hooks";
import { useConsulta, useMesas, usePedidos, inicioDelDia, CANALES } from "@/lib/datos";
import { sonar } from "@/lib/operacion";
import { abrirImpresion } from "@/lib/exportar";
import { ESTACIONES } from "@/lib/catalogo";
import { leerImpresion } from "@/admin/Configuracion";
import type { Estacion, EstadoPedido, Pedido } from "@/lib/tipos";
import { Button, Chip, IconButton, LogoIcono, Modal, Skeleton, useAvisar } from "@/components/ui";

const SIGUIENTE: Record<string, EstadoPedido> = { cocina: "preparando", preparando: "listo", listo: "entregado" };
const ANTERIOR: Record<string, EstadoPedido> = { preparando: "cocina", listo: "preparando" };
const leerSet = (k: string) => { try { return new Set<string>(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set<string>(); } };
const guardarSet = (k: string, s: Set<string>) => { try { localStorage.setItem(k, JSON.stringify([...s].slice(-300))); } catch { /* nada */ } };

export function Cocina() {
  useTitulo("Cocina");
  const { config } = useConfig();
  const { salir } = useAuth();
  const avisar = useAvisar();
  const enLinea = useEnLinea();
  const ahora = useAhora(1000);
  const { datos: activos, cargando } = useConsulta<Pedido[]>("cocina-activos", () => supabase.from("pedidos").select("*, pedido_items(*)").in("estado", ["cocina", "preparando", "listo"]).order("enviado_at") as never, [], ["pedidos", "pedido_items"]);
  const { datos: hoy } = usePedidos(useMemo(() => inicioDelDia(), []));
  const { datos: mesas } = useMesas();
  const [estacion, setEstacion] = useState<Estacion | "todas">(() => (localStorage.getItem("restobar-cocina-estacion") as Estacion) || "todas");
  const [sonido, setSonido] = useState<boolean | null>(() => { const v = sessionStorage.getItem("restobar-cocina-sonido"); return v === null ? null : v === "1"; });
  const [historial, setHistorial] = useState(false);
  const [vistos, setVistos] = useState(() => leerSet("restobar-cocina-vistos"));
  const conocidos = useRef<Map<string, string> | null>(null);
  const demora = config.demora_min * 60000;
  const numMesa = (p: Pedido) => mesas.find(m => m.id === p.mesa_id)?.numero;
  const items = (p: Pedido) => (p.pedido_items || []).filter(i => estacion === "todas" || i.estacion === estacion);

  useEffect(() => { localStorage.setItem("restobar-cocina-estacion", estacion); }, [estacion]);
  useEffect(() => { if (sonido !== null) sessionStorage.setItem("restobar-cocina-sonido", sonido ? "1" : "0"); }, [sonido]);
  // Comanda nueva (o con productos agregados): suena e imprime en la estación que corresponde
  useEffect(() => {
    if (cargando) return;
    const marca = (p: Pedido) => `${p.enviado_at}|${(p.pedido_items || []).length}`;
    if (!conocidos.current) { conocidos.current = new Map(activos.map(p => [p.id, marca(p)])); return; }
    const pref = leerImpresion();
    activos.forEach(p => {
      if (p.estado !== "cocina" || conocidos.current!.get(p.id) === marca(p)) return;
      conocidos.current!.set(p.id, marca(p));
      setVistos(v => { const n = new Set(v); n.delete(p.id); guardarSet("restobar-cocina-vistos", n); return n; });
      if (sonido) sonar();
      ESTACIONES.forEach(([e, t]) => {
        const suyos = (p.pedido_items || []).filter(i => i.estacion === e);
        if (pref[e] && suyos.length) imprimirComanda(p, suyos, t, numMesa(p));
      });
    });
  }, [activos, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  function imprimirComanda(p: Pedido, its: NonNullable<Pedido["pedido_items"]>, est: string, mesa?: number) {
    abrirImpresion(`Comanda ${p.numero}`, `<div class="ticket"><p class="c"><strong style="font-size:18px">${mesa ? "MESA " + mesa : CANALES[p.canal].nombre.toUpperCase()}</strong><br>Comanda #${p.numero} · ${est} · ${hora(Date.now())}</p><hr>
      ${its.map(i => `<p style="font-size:15px"><strong>${i.cantidad} × ${i.nombre}</strong>${i.nota ? `<br><strong>» ${i.nota.toUpperCase()}</strong>` : ""}</p>`).join("")}<hr><p class="c">${its.reduce((a, i) => a + i.cantidad, 0)} en total</p></div>`, "80mm auto");
  }
  async function mover(p: Pedido, a: EstadoPedido) {
    const { error } = await supabase.from("pedidos").update({ estado: a }).eq("id", p.id);
    if (error) avisar(mensajeError(error), "bad");
    else if (a === "entregado") avisar(`#${p.numero} entregado`);
  }
  const tocar = (p: Pedido) => {
    if (!vistos.has(p.id)) setVistos(v => { const n = new Set(v); n.add(p.id); guardarSet("restobar-cocina-vistos", n); return n; });
    // Delivery y tienda se entregan desde la app del repartidor: en cocina terminan en «Listo»
    if (p.estado === "listo" && p.delivery_estado) return avisar("Este pedido lo recoge el repartidor desde su app", "info");
    mover(p, SIGUIENTE[p.estado]);
  };
  const visibles = activos.filter(p => items(p).length);
  const entregadosHoy = hoy.filter(p => p.estado === "entregado" && p.entregado_at);
  const demoradas = visibles.filter(p => p.estado !== "listo" && ahora - new Date(p.enviado_at || p.created_at).getTime() > demora).length;
  const pantallaCompleta = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { avisar("Este navegador no permite pantalla completa", "info"); } };

  return (
    <div className="tema-oscuro flex min-h-screen flex-col gap-3 bg-[#0A0F0D] px-4 pb-6 pt-3.5 text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link to="/" aria-label="Portada"><LogoIcono tamano={34} /></Link>
          <strong className="font-display text-[26px]">Cocina</strong>
          <span className={cx("flex items-center gap-1.5 text-sm font-semibold", enLinea ? "text-ok" : "text-bad")}><i className={cx("h-2 w-2 rounded-full", enLinea ? "bg-ok" : "bg-bad")} />{enLinea ? "En línea" : "Sin conexión"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {([["Nuevas", visibles.filter(p => p.estado === "cocina").length], ["En preparación", visibles.filter(p => p.estado === "preparando").length], ["Listas", visibles.filter(p => p.estado === "listo").length], ["Demoradas", demoradas], ["Entregadas hoy", entregadosHoy.length]] as const).map(([t, n]) => (
            <span key={t} className={cx("flex items-baseline gap-1.5 rounded-sm px-3 py-1.5 text-sm", t === "Demoradas" && n ? "bg-bad-soft text-bad" : "bg-surface text-ink-2")}><strong className="num font-display text-2xl">{n}</strong>{t}</span>
          ))}
        </div>
        <div className="flex">
          <IconButton icon={sonido ? Volume2 : VolumeX} label={sonido ? "Silenciar" : "Activar sonido"} onClick={() => { setSonido(!sonido); if (!sonido) sonar(); }} />
          <IconButton icon={Maximize} label="Pantalla completa" onClick={pantallaCompleta} />
          <IconButton icon={History} label="Historial de hoy" onClick={() => setHistorial(true)} />
          <IconButton icon={LogOut} label="Cerrar sesión" onClick={salir} />
        </div>
      </header>
      <div role="group" aria-label="Estación" className="flex flex-wrap gap-2">
        <Chip activo={estacion === "todas"} onClick={() => setEstacion("todas")} contador={activos.length}>Todas</Chip>
        {ESTACIONES.map(([k, t]) => <Chip key={k} activo={estacion === k} onClick={() => setEstacion(k)} contador={activos.filter(p => (p.pedido_items || []).some(i => i.estacion === k)).length}>{t}</Chip>)}
      </div>
      <div className="grid flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-3">
        {([["cocina", "Nuevas"], ["preparando", "En preparación"], ["listo", "Listo para entregar"]] as const).map(([e, t]) => {
          const lista = visibles.filter(p => p.estado === e);
          return (
            <section key={e} aria-label={t} className="flex min-h-[300px] flex-col gap-3 rounded-md bg-[#0F1713] p-3">
              <h2 className="flex justify-between font-display text-lg text-ink-2">{t}<span className="num">{lista.length}</span></h2>
              {cargando && <Skeleton h={160} r={12} />}
              {!cargando && lista.length === 0 && <p className="px-1 py-5 text-ink-3">{e === "cocina" ? "Sin comandas nuevas. Las de los meseros, la caja y la tienda llegan aquí solas." : "Nada por ahora."}</p>}
              {lista.map(p => <Comanda key={p.id} p={p} items={items(p)} mesa={numMesa(p)} ahora={ahora} demora={demora} nueva={!vistos.has(p.id) && p.estado === "cocina"} onTocar={() => tocar(p)} onAtras={() => ANTERIOR[p.estado] && mover(p, ANTERIOR[p.estado])} />)}
            </section>
          );
        })}
      </div>
      {sonido === null && (
        <Modal titulo="¿Activamos el sonido?" onClose={() => setSonido(false)} ancho={420}
          pie={<><Button variant="ghost" onClick={() => setSonido(false)}>Continuar sin sonido</Button><Button variant="primary" icon={Volume2} onClick={() => { setSonido(true); sonar(); }}>Activar y probar</Button></>}>
          <p>Suena un aviso corto cada vez que llega una comanda nueva.</p>
        </Modal>
      )}
      {historial && (
        <Modal titulo="Entregadas hoy" onClose={() => setHistorial(false)} ancho={560}>
          {entregadosHoy.length === 0 ? <p className="text-ink-3">Todavía no se entregó nada hoy.</p> : (
            <ul className="flex flex-col">{entregadosHoy.slice().sort((a, b) => b.entregado_at!.localeCompare(a.entregado_at!)).map(p => (
              <li key={p.id} className="num flex justify-between gap-3 border-b border-line py-2"><span>#{p.numero} · {numMesa(p) ? `Mesa ${numMesa(p)}` : CANALES[p.canal].nombre}</span><span className="text-ink-3">{hora(p.entregado_at!)}{p.listo_at && p.enviado_at ? ` · ${Math.max(1, Math.round((new Date(p.listo_at).getTime() - new Date(p.enviado_at).getTime()) / 60000))} min en cocina` : ""}</span></li>
            ))}</ul>
          )}
        </Modal>
      )}
    </div>
  );
}

function Comanda({ p, items, mesa, ahora, demora, nueva, onTocar, onAtras }:
  { p: Pedido; items: NonNullable<Pedido["pedido_items"]>; mesa?: number; ahora: number; demora: number; nueva: boolean; onTocar: () => void; onAtras: () => void }) {
  const t = ahora - new Date(p.enviado_at || p.created_at).getTime();
  const color = p.estado === "listo" || t < 8 * 60000 ? "ok" : t < demora ? "warn" : "bad";
  const presion = useRef<ReturnType<typeof setTimeout>>(), larga = useRef(false);
  const empaque = p.canal === "llevar" ? ["Para llevar"] as const : p.delivery_estado ? ["Delivery"] as const : null;
  const sig = { cocina: "empezar", preparando: "marcar listo", listo: p.delivery_estado ? "esperar al repartidor" : "entregar" }[p.estado as "cocina"];
  return (
    <button type="button"
      onPointerDown={() => { larga.current = false; presion.current = setTimeout(() => { larga.current = true; onAtras(); }, 650); }}
      onPointerUp={() => clearTimeout(presion.current)} onPointerLeave={() => clearTimeout(presion.current)}
      onClick={() => { if (!larga.current) onTocar(); }}
      onKeyDown={e => { if (e.key === "Backspace") onAtras(); }}
      aria-label={`Comanda ${p.numero}, ${mesa ? "Mesa " + mesa : CANALES[p.canal].nombre}. Toca para ${sig}. Mantén presionado para regresar.`}
      className={cx("flex w-full cursor-pointer select-none flex-col gap-2 rounded-md border-t-[6px] bg-surface p-3.5 text-left active:scale-[.99]",
        color === "ok" ? "border-ok" : color === "warn" ? "border-warn" : "border-bad", nueva && "animate-pulse shadow-[0_0_0_4px_var(--maiz)]")}>
      <span className="flex items-baseline justify-between gap-2.5">
        <strong className="font-display text-[28px] font-extrabold">{mesa ? `Mesa ${mesa}` : CANALES[p.canal].nombre}</strong>
        <span className={cx("num font-display text-[26px] font-extrabold", color === "ok" ? "text-ok" : color === "warn" ? "text-warn" : "text-bad")}>{mmss(t)}</span>
      </span>
      <span className="num text-[15px] text-ink-3">#{p.numero} · entró {hora(p.enviado_at || p.created_at)}{p.cliente ? " · " + p.cliente : ""}</span>
      {empaque && <span className="inline-flex items-center gap-1.5 self-start rounded-sm bg-info-soft px-2.5 py-0.5 font-bold text-info">{empaque[0] === "Delivery" ? <Bike size={16} /> : <ShoppingBag size={16} />}{empaque[0]}</span>}
      <ul className="flex flex-col gap-2 text-[21px] font-semibold leading-tight">
        {items.map(i => (
          <li key={i.id} className="flex gap-2.5"><b className="num min-w-9 text-2xl text-maiz">{i.cantidad}</b>
            <span className="flex flex-col items-start">{i.nombre}{i.nota && <span className="mt-1 rounded-sm bg-accent px-2 py-0.5 text-[15px] font-extrabold tracking-wide text-on-accent">{i.nota.toUpperCase()}</span>}</span></li>
        ))}
      </ul>
      <span className="border-t border-line pt-2 text-[13px] text-ink-3">Toca para {sig}{p.estado !== "cocina" && " · mantén presionado para regresar"}</span>
    </button>
  );
}
