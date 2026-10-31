// Pedido desde la mesa (B6.8) y Llamar al mesero (B6.10): se abren con el QR pegado en cada mesa (/mesa/N?t=… y /llamar/N?t=…).
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Bell, BellRing, Check, Minus, Plus, QrCode, Receipt, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig, useTitulo } from "@/lib/config";
import { bs, cx, mensajeError, sinTildes } from "@/lib/formato";
import { useAhora } from "@/lib/hooks";
import { useMenuPublico, useCarrito, pedirPublico, useSeguimiento } from "@/lib/publico";
import type { ProductoCompleto } from "@/lib/catalogo";
import { BottomSheet, Button, Chip, EmptyState, ErrorState, Logo, ProductPhoto, SearchInput, Skeleton, useAvisar } from "@/components/ui";

interface InfoMesa { numero: number; zona: string; pedido_abierto: { numero: number; total: number } | null }
function useInfoMesa(numero: number, token: string) {
  const [info, setInfo] = useState<InfoMesa | null | undefined>(undefined), [error, setError] = useState<unknown>(null);
  const cargar = async () => {
    const { data, error } = await supabase.rpc("info_mesa", { p_numero: numero, p_token: token });
    if (error) setError(error); else setInfo((data as InfoMesa) || null);
  };
  useEffect(() => { cargar(); const i = setInterval(cargar, 15000); return () => clearInterval(i); }, [numero, token]); // eslint-disable-line react-hooks/exhaustive-deps
  return { info, error, recargar: cargar };
}
function QrInvalido() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <span className="grid h-16 w-16 place-items-center rounded-full bg-maiz-soft text-warn"><QrCode size={30} /></span>
      <h1 className="text-xl font-extrabold">Escanea el QR de tu mesa</h1>
      <p className="text-ink-2">Este enlace no es válido o el QR fue renovado. Escanea el código pegado en tu mesa o pide ayuda al mesero.</p>
    </main>
  );
}

/* ================= Pedido desde la mesa ================= */
export function PedidoMesa() {
  const { numero } = useParams(), [q] = useSearchParams();
  const n = Number(numero), token = q.get("t") || "";
  useTitulo(`Mesa ${n}`);
  const avisar = useAvisar();
  const { info, error: errInfo, recargar: recargarInfo } = useInfoMesa(n, token);
  const { productos, categorias, nombreCat, cargando, error, recargar } = useMenuPublico();
  const carrito = useCarrito("mesa-" + n);
  const [cat, setCat] = useState("todos"), [buscar, setBuscar] = useState("");
  const [hoja, setHoja] = useState<"confirmar" | "llamar" | null>(null), [opciones, setOpciones] = useState<ProductoCompleto | null>(null);
  const [nombre, setNombre] = useState(() => localStorage.getItem("restobar-nombre-mesa") || "");
  const [enviando, setEnviando] = useState(false);
  const [seguir, setSeguir] = useState<{ id: string; codigo: string } | null>(() => { try { return JSON.parse(sessionStorage.getItem("restobar-pedido-mesa-" + n) || "null"); } catch { return null; } });
  const { s } = useSeguimiento(seguir?.id || null, seguir?.codigo || null);
  const enSalon = useMemo(() => productos.filter(p => p.canales?.salon !== false), [productos]);
  const lista = enSalon.filter(p => (cat === "todos" || p.categoria_id === cat) && (!buscar || sinTildes(p.nombre).includes(sinTildes(buscar))));
  const favoritos = enSalon.filter(p => p.favorito);
  const cant = (id: string) => carrito.items.filter(i => i.producto_id === id).reduce((a, i) => a + i.cantidad, 0);
  const total = carrito.items.reduce((a, i) => a + i.cantidad * Number(enSalon.find(p => p.id === i.producto_id)?.precio || 0), 0);

  if (info === null) return <QrInvalido />;
  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    try { localStorage.setItem("restobar-nombre-mesa", nombre.trim()); } catch { /* nada */ }
    try {
      const r = await pedirPublico({ canal: "qr", items: carrito.items, mesa_numero: n, mesa_token: token, cliente: nombre.trim() || undefined });
      const sg = { id: r.id, codigo: r.codigo }; setSeguir(sg); sessionStorage.setItem("restobar-pedido-mesa-" + n, JSON.stringify(sg));
      carrito.vaciar(); setHoja(null); recargarInfo(); avisar("Tu pedido llegó a la cocina");
    } catch (e) { avisar(mensajeError(e), "bad"); } finally { setEnviando(false); }
  }
  async function pedirCuenta() {
    const { data, error } = await supabase.rpc("pedir_cuenta_mesa", { p_mesa_numero: n, p_mesa_token: token });
    if (error) avisar(mensajeError(error), "bad"); else avisar(data ? "Avisamos que quieres la cuenta. Tu mesero ya va." : "Esta mesa no tiene una cuenta abierta todavía.", data ? "ok" : "info");
  }
  const pasos: [string, boolean][] = s ? [["Recibido", true], ["En cocina", !!s.preparando || ["listo", "entregado"].includes(s.estado)], ["Listo", ["listo", "entregado"].includes(s.estado)]] : [];
  const tarjeta = (p: ProductoCompleto) => (
    <div key={p.id} className="flex flex-col gap-1 rounded-md bg-surface p-1.5 pb-2 shadow-1">
      <button type="button" disabled={p.agotado} onClick={() => setOpciones(p)} aria-label={`Ver opciones de ${p.nombre}`} className="relative overflow-hidden rounded-lg">
        <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-lg" />
        {p.agotado && <span className="absolute left-2 top-2 rounded-sm bg-ink px-2 text-xs font-bold text-bg">Agotado</span>}
        {cant(p.id) > 0 && <span className="num absolute right-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 font-extrabold text-on-accent">{cant(p.id)}</span>}
      </button>
      <span className="min-h-[36px] px-0.5 text-[15px] font-semibold leading-tight">{p.nombre}</span>
      <span className="flex items-center justify-between px-0.5 font-bold"><span className="num">{bs(p.precio)}</span>
        <button type="button" disabled={p.agotado} aria-label={`Agregar ${p.nombre}`} onClick={() => carrito.sumar(p.id, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-35"><Plus size={18} /></button>
      </span>
    </div>
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-bg pb-40 text-[15px]">
      <header className="sticky top-0 z-20 flex min-h-[64px] items-center gap-2.5 border-b border-line bg-surface px-3">
        <Logo tamano={32} className="[&>span:last-child]:hidden" />
        <div className="flex flex-1 flex-col leading-tight"><strong className="text-lg">Mesa {n}</strong><small className="text-sm text-ink-3">Haz tu pedido desde aquí</small></div>
        <button type="button" onClick={() => setHoja("confirmar")} aria-label={`Tu pedido, ${carrito.cantidad} productos`} className="relative grid h-12 w-12 place-items-center rounded-full bg-surface-2">
          <ShoppingBag size={22} />{carrito.cantidad > 0 && <span className="num absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full bg-accent px-1 text-center text-xs font-bold leading-5 text-on-accent">{carrito.cantidad}</span>}
        </button>
      </header>
      {errInfo ? <ErrorState error={errInfo} onRetry={recargarInfo} /> : null}
      {info?.pedido_abierto && <p className="flex items-center gap-2 bg-info-soft px-3.5 py-3 font-semibold text-info"><Receipt size={18} />Lo que pidas se agrega a tu cuenta (pedido #{info.pedido_abierto.numero} · {bs(info.pedido_abierto.total)}).</p>}
      {s && s.estado !== "anulado" && (
        <section className="mx-3.5 mt-3 flex flex-col gap-2.5 rounded-md bg-surface p-3.5 shadow-1" aria-label="Tu pedido">
          <strong>Tu pedido #{s.numero}</strong>
          <ol className="flex justify-between gap-1 text-sm font-semibold">
            {pasos.map(([t, ok]) => <li key={t} className={cx("flex flex-1 flex-col items-center gap-1 text-center", ok ? "text-ink" : "text-ink-3")}><i aria-hidden="true" className={cx("grid h-7 w-7 place-items-center rounded-full border-2", ok ? "border-ok bg-ok text-white" : "border-line")}>{ok && <Check size={14} strokeWidth={3} />}</i>{t}</li>)}
          </ol>
          <span className="text-sm text-ink-3">{["listo", "entregado"].includes(s.estado) ? "¡Ya está listo! Tu mesero lo trae." : "Tiempo estimado: 15 a 20 minutos."}</span>
        </section>
      )}
      {error ? <ErrorState titulo="No se pudo cargar el menú" error={error} onRetry={recargar} /> : cargando || info === undefined ? <div className="grid grid-cols-2 gap-2.5 p-3.5">{[1, 2, 3, 4].map(i => <Skeleton key={i} h={200} r={12} />)}</div> : <>
        {favoritos.length > 0 && (
          <section className="px-3.5 pt-4" aria-labelledby="m-fav">
            <h2 id="m-fav" className="mb-2 text-lg font-extrabold">Favoritos de la casa</h2>
            <div className="sin-barra flex snap-x gap-3 overflow-x-auto pb-1.5">
              {favoritos.map(p => (
                <button key={p.id} type="button" disabled={p.agotado} onClick={() => setOpciones(p)} className="flex w-[230px] flex-none snap-start flex-col gap-1.5 rounded-md bg-surface p-2 text-left shadow-1 disabled:opacity-60">
                  <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-lg" />
                  <span className="font-semibold leading-tight">{p.nombre}</span><strong className="num">{bs(p.precio)}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="flex flex-col gap-2.5 px-3.5 pt-4">
          <h2 className="text-lg font-extrabold">Menú <span className="text-sm font-semibold text-ink-3">({enSalon.length} opciones)</span></h2>
          <SearchInput id="mq-buscar" value={buscar} onChange={setBuscar} placeholder="Buscar plato" className="!max-w-none" />
          <div className="sin-barra flex gap-2 overflow-x-auto">
            <Chip activo={cat === "todos"} onClick={() => setCat("todos")} contador={enSalon.length}>Todos</Chip>
            {categorias.map(c => <Chip key={c.id} activo={cat === c.id} onClick={() => setCat(c.id)} contador={enSalon.filter(p => p.categoria_id === c.id).length}>{c.nombre}</Chip>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-3">{lista.map(tarjeta)}</div>
        {lista.length === 0 && <EmptyState icon={QrCode} titulo="No encontré ese plato" texto="Prueba con otra palabra." />}
      </>}

      {/* Siempre a mano: llamar al mesero y pedir la cuenta */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl flex-col gap-2 border-t border-line bg-surface px-3.5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        {carrito.cantidad > 0 && <Button variant="primary" size="lg" icon={ShoppingBag} onClick={() => setHoja("confirmar")}>Ver mi pedido ({carrito.cantidad}) · {bs(total)}</Button>}
        <div className="flex gap-2">
          <Button size="lg" variant="role" rol="var(--r-mesero)" icon={Bell} className="flex-1" onClick={() => setHoja("llamar")}>Llamar al mesero</Button>
          <Button size="lg" icon={Receipt} className="flex-1" onClick={pedirCuenta}>Pedir la cuenta</Button>
        </div>
      </div>

      {opciones && <Opciones p={opciones} categoria={nombreCat(opciones.categoria_id)} onClose={() => setOpciones(null)} onOk={(c, nota) => carrito.sumar(opciones.id, c, nota)} />}
      {hoja === "confirmar" && (
        <BottomSheet titulo="Confirmar pedido" onClose={() => setHoja(null)}
          pie={carrito.cantidad ? <Button variant="primary" size="lg" className="w-full" loading={enviando} disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : `Enviar a la cocina · ${bs(total)}`}</Button> : undefined}>
          {carrito.cantidad === 0 ? <EmptyState icon={ShoppingBag} titulo="Todavía no elegiste nada" texto="Toca + en un plato para agregarlo." /> : <>
            <ul className="flex flex-col gap-2">{carrito.items.map(i => { const p = enSalon.find(x => x.id === i.producto_id); if (!p) return null; return (
              <li key={i.producto_id + i.nota} className="flex items-center gap-2.5">
                <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} cuadrada className="!w-12 flex-none !rounded-lg" />
                <span className="flex min-w-0 flex-1 flex-col font-semibold">{p.nombre}{i.nota && <small className="font-medium text-accent-deep">{i.nota}</small>}<small className="num font-medium text-ink-3">{bs(p.precio)}</small></span>
                <span className="inline-flex items-center rounded-full border border-line">
                  <button type="button" aria-label={`Quitar 1 ${p.nombre}`} onClick={() => carrito.sumar(i.producto_id, -1, i.nota)} className="grid h-10 w-10 place-items-center"><Minus size={16} /></button>
                  <span className="num w-6 text-center">{i.cantidad}</span>
                  <button type="button" aria-label={`Sumar 1 ${p.nombre}`} onClick={() => carrito.sumar(i.producto_id, 1, i.nota)} className="grid h-10 w-10 place-items-center"><Plus size={16} /></button>
                </span>
              </li>
            ); })}</ul>
            <label htmlFor="mq-nombre" className="text-sm font-semibold">Tu nombre (opcional)</label>
            <input id="mq-nombre" value={nombre} maxLength={40} placeholder="Así te reconoce el mesero" onChange={e => setNombre(e.target.value)} />
            <p className="text-sm text-ink-3">No hace falta crear cuenta. Recordamos tu nombre en este celular.</p>
          </>}
        </BottomSheet>
      )}
      {hoja === "llamar" && <BottomSheet titulo="Llamar al mesero" onClose={() => setHoja(null)}><LlamarContenido n={n} token={token} zona={info?.zona || ""} /></BottomSheet>}
    </div>
  );
}

function Opciones({ p, categoria, onClose, onOk }: { p: ProductoCompleto; categoria?: string; onClose: () => void; onOk: (cantidad: number, nota: string) => void }) {
  const [sel, setSel] = useState<string[]>([]), [nota, setNota] = useState(""), [n, setN] = useState(1);
  return (
    <BottomSheet titulo={p.nombre} onClose={onClose} pie={<Button variant="primary" size="lg" className="w-full" onClick={() => { onOk(n, [...sel, nota.trim()].filter(Boolean).join(", ").slice(0, 120)); onClose(); }}>Agregar {n} · {bs(Number(p.precio) * n)}</Button>}>
      <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={categoria} fotoUrl={p.foto_url} />
      {p.descripcion && <p>{p.descripcion}</p>}
      {(p.modificadores || []).length > 0 && <div className="flex flex-wrap gap-2">{[...p.modificadores].sort((a, b) => a.orden - b.orden).map(m => <Chip key={m.id} activo={sel.includes(m.nombre)} onClick={() => setSel(s => s.includes(m.nombre) ? s.filter(x => x !== m.nombre) : [...s, m.nombre])}>{m.nombre}</Chip>)}</div>}
      <label htmlFor="op-nota" className="text-sm font-semibold">¿Algo para la cocina?</label>
      <input id="op-nota" value={nota} maxLength={60} placeholder="Ej.: sin cebolla" onChange={e => setNota(e.target.value)} />
      <div className="flex items-center justify-between"><span className="text-sm font-semibold">Cantidad</span>
        <span className="inline-flex items-center rounded-full border border-line"><button type="button" aria-label="Quitar 1" onClick={() => setN(Math.max(1, n - 1))} className="grid h-11 w-11 place-items-center"><Minus size={18} /></button><span className="num w-7 text-center font-bold">{n}</span><button type="button" aria-label="Sumar 1" onClick={() => setN(Math.min(20, n + 1))} className="grid h-11 w-11 place-items-center"><Plus size={18} /></button></span>
      </div>
    </BottomSheet>
  );
}

/* ================= Llamar al mesero ================= */
export function LlamarMesero() {
  const { numero } = useParams(), [q] = useSearchParams();
  const n = Number(numero), token = q.get("t") || "";
  useTitulo(`Llamar al mesero · Mesa ${n}`);
  const { info } = useInfoMesa(n, token);
  if (info === null) return <QrInvalido />;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-2 px-4 py-5">
      <Logo />
      {info === undefined ? <Skeleton h={360} r={20} /> : <LlamarContenido n={n} token={token} zona={info.zona} />}
    </main>
  );
}

const MOTIVOS = ["Cuenta", "Agua", "Ayuda con el pedido", "Otro"] as const;
function LlamarContenido({ n, token, zona }: { n: number; token: string; zona: string }) {
  const { config } = useConfig();
  const avisar = useAvisar();
  const ahora = useAhora(1000);
  const clave = "restobar-llamada-" + n;
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]>("Cuenta");
  const [llamada, setLlamada] = useState<{ id: string; t: number } | null>(() => { try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch { return null; } });
  const [estado, setEstado] = useState<{ atendida: boolean; cancelada: boolean; mesero: string | null } | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Se consulta cada 3 segundos si el mesero ya la atendió
  useEffect(() => {
    if (!llamada) return;
    let vivo = true;
    const ver = async () => {
      const { data } = await supabase.rpc("estado_llamada", { p_llamada: llamada.id, p_mesa_token: token });
      if (vivo && data) setEstado(data as typeof estado);
    };
    ver(); const i = setInterval(ver, 3000);
    return () => { vivo = false; clearInterval(i); };
  }, [llamada?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const bloqueo = llamada ? Math.max(0, 30 - Math.floor((ahora - llamada.t) / 1000)) : 0;
  const activa = llamada && estado && !estado.atendida && !estado.cancelada;
  const atendida = llamada && estado?.atendida;
  async function llamar() {
    setEnviando(true);
    const { data, error } = await supabase.rpc("llamar_mesero", { p_mesa_numero: n, p_mesa_token: token, p_motivo: motivo });
    setEnviando(false);
    if (error) return avisar(mensajeError(error), "bad");
    const l = { id: data as string, t: Date.now() }; setLlamada(l); setEstado({ atendida: false, cancelada: false, mesero: null }); localStorage.setItem(clave, JSON.stringify(l));
    navigator.vibrate?.(80);
  }
  async function cancelar() {
    await supabase.rpc("cancelar_llamada", { p_llamada: llamada!.id, p_mesa_token: token });
    setEstado(e => e && { ...e, cancelada: true }); avisar("Llamada cancelada");
  }
  function nueva() { localStorage.removeItem(clave); setLlamada(null); setEstado(null); }
  return (
    <section className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
      <span className="text-ink-3">{zona} · Mesa {n}</span>
      <span className={cx("grid h-36 w-36 place-items-center rounded-full", atendida ? "bg-ok-soft text-ok" : "bg-[color-mix(in_srgb,var(--r-mesero)_14%,var(--surface))] text-r-mesero")}>
        {atendida ? <Check size={64} strokeWidth={2.5} /> : activa ? <BellRing size={64} className="animate-bounce" /> : <Bell size={64} />}
      </span>
      {atendida ? <>
        <h2 className="text-2xl font-extrabold">{estado?.mesero || "Tu mesero"} va en camino</h2>
        <p className="text-ink-2">Ya vio tu aviso. ¡Gracias por tu paciencia!</p>
        <Button onClick={nueva}>Listo</Button>
      </> : activa ? <>
        <h2 className="text-2xl font-extrabold">Avisamos a tu mesero</h2>
        <p className="num text-ink-3">Hace {Math.floor((ahora - llamada!.t) / 1000)} s · {motivo}</p>
        <Button variant="ghost" icon={X} onClick={cancelar}>Cancelar llamada</Button>
      </> : <>
        <h2 className="text-2xl font-extrabold">¿Necesitas algo?</h2>
        <div className="flex flex-wrap justify-center gap-2">{MOTIVOS.map(m => <Chip key={m} activo={motivo === m} onClick={() => setMotivo(m)}>{m}</Chip>)}</div>
      </>}
      {!atendida && (
        <Button variant="role" rol="var(--r-mesero)" size="lg" className="min-h-16 w-full text-[19px]" loading={enviando} disabled={bloqueo > 0 || !!activa} onClick={llamar}>
          {activa ? "Tu mesero ya fue avisado" : bloqueo > 0 ? `Podrás volver a llamar en ${bloqueo} s` : "Llamar al mesero"}
        </Button>
      )}
      <p className="text-sm text-ink-3">{config.nombre} · {config.lema}</p>
    </section>
  );
}
