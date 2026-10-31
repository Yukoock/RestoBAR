// Cajero (B6.3): lista de pedidos, detalle y cobro (efectivo, QR, tarjeta o mixto), nuevo pedido con fotos.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Banknote, Bike, Check, ChefHat, CreditCard, FileText, Lock, LogOut, Minus, Monitor, Plus, Printer, QrCode, Receipt, Shuffle, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { bs, cx, leerMonto, mensajeError, minutosDesde, sinTildes } from "@/lib/formato";
import { useAhora } from "@/lib/hooks";
import { usePedidos, useMesas, usePedidosAbiertos, useLlamadasActivas, usePerfiles, inicioDelDia, pagado, etiquetaPago, estadoMesa, ESTADO_MESA, CANALES } from "@/lib/datos";
import { useMenuVenta, enviarPedido, sumarLinea, totalLineas, enviarPantalla, useCajaAbierta, sonar, type Linea } from "@/lib/operacion";
import { imprimirTicket } from "@/lib/exportar";
import { leerImpresion } from "@/admin/Configuracion";
import type { Canal, Mesa, Pedido } from "@/lib/tipos";
import { Badge, Button, Chip, ConfirmDialog, EmptyState, FormField, Menu, Modal, PalabraLogo, LogoIcono, PinDialog, ProductPhoto, SearchInput, Seg, Skeleton, Switch, useAvisar } from "@/components/ui";
import { CanalTag, EstadoBadge, PagoBadge } from "@/admin/PedidoDrawer";
import { QrCobro } from "@/components/QrCobro";

export function Cajero() {
  useTitulo("Cajero");
  const { perfil, salir } = useAuth();
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: pedidos, cargando } = usePedidos(useMemo(() => inicioDelDia(1), []));
  const { datos: mesas } = useMesas();
  const { caja, debe } = useCajaAbierta();
  const [vista, setVista] = useState<"pedidos" | "nuevo">("pedidos");
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"sin" | "todos" | "pag">("sin");
  const [q, setQ] = useState("");
  const [limpiar, setLimpiar] = useState(false);
  const [ocultosAntes, setOcultosAntes] = useState(() => Number(localStorage.getItem("restobar-ocultar-pagados") || 0));
  const busca = useRef<HTMLInputElement>(null), cobrarRef = useRef<HTMLButtonElement>(null);
  const conocidos = useRef<Set<string> | null>(null);
  useAhora(30000);
  const numMesa = (p: Pedido) => mesas.find(m => m.id === p.mesa_id)?.numero;

  // Aviso cuando llega un pedido de mesa, tienda o delivery (B6.3)
  useEffect(() => {
    if (cargando) return;
    if (!conocidos.current) { conocidos.current = new Set(pedidos.map(p => p.id)); return; }
    pedidos.forEach(p => {
      if (conocidos.current!.has(p.id)) return;
      conocidos.current!.add(p.id);
      if (p.creado_por !== perfil?.id) {
        sonar();
        avisar(`Nuevo pedido #${p.numero} · ${numMesa(p) ? "Mesa " + numMesa(p) : CANALES[p.canal].nombre}`, "info", { label: "Ver", onClick: () => { setVista("pedidos"); setFiltro("todos"); setSel(p.id); } });
      }
    });
  }, [pedidos, cargando]); // eslint-disable-line react-hooks/exhaustive-deps
  // Atajos: N nuevo pedido, F cobrar, / buscar
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); setVista("nuevo"); }
      if (k === "f") { e.preventDefault(); cobrarRef.current?.click(); }
      if (k === "/") { e.preventDefault(); setVista("pedidos"); setTimeout(() => busca.current?.focus()); }
    };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);
  const lista = pedidos.filter(p => p.estado !== "anulado" && !(pagado(p) && new Date(p.pagado_at || 0).getTime() < ocultosAntes));
  const filtrados = lista.filter(p => filtro === "todos" || (filtro === "sin" ? !pagado(p) : pagado(p)))
    .filter(p => !q || sinTildes(`${p.numero} ${p.cliente || ""} mesa ${numMesa(p) || ""} ${CANALES[p.canal].nombre}`).includes(sinTildes(q)));
  const pedido = pedidos.find(p => p.id === sel);
  const elegir = (id: string) => { setSel(id); const p = pedidos.find(x => x.id === id); if (p && !pagado(p)) enviarPantalla({ pedidoId: id, fase: "pedido", monto: Number(p.total) }); };
  async function cambiarLocal(v: boolean) {
    const { error } = await supabase.rpc("cambiar_local_abierto", { p_abierto: v });
    if (error) avisar(mensajeError(error), "bad"); else avisar(v ? "Local abierto: la tienda online recibe pedidos" : "Local cerrado: la tienda online muestra «Cerrado»");
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:h-screen md:grid-cols-[96px_minmax(0,1fr)]">
      <nav aria-label="Cajero" className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-surface p-1.5 md:flex-col md:border-b-0 md:border-r md:px-1.5 md:py-3.5">
        <Link to="/" aria-label="Portada" className="mx-1.5 md:mb-2.5"><LogoIcono tamano={36} /></Link>
        {([["pedidos", "Pedidos", Receipt], ["nuevo", "Nuevo pedido", Plus]] as const).map(([k, t, Ic]) => (
          <button key={k} type="button" aria-current={vista === k ? "page" : undefined} onClick={() => setVista(k)}
            className={cx("flex min-h-[60px] min-w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold md:w-[84px]", vista === k ? "bg-r-cajero text-on-role" : "text-ink-2 hover:bg-surface-2")}><Ic size={22} />{t}</button>
        ))}
        <Link to="/admin/caja" className="flex min-h-[60px] min-w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-xs font-semibold text-ink-2 hover:bg-surface-2 md:w-[84px]"><Wallet size={22} />Caja</Link>
        <a href="/pantalla" target="pantalla-cliente" className="flex min-h-[60px] min-w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-xs font-semibold leading-tight text-ink-2 hover:bg-surface-2 md:w-[84px]"><Monitor size={22} />Pantalla del cliente</a>
        <button type="button" onClick={salir} className="flex min-h-[60px] min-w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold text-ink-2 hover:bg-surface-2 md:mt-auto md:w-[84px]"><LogOut size={22} />Salir</button>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5">
          <div className="flex items-center gap-2"><PalabraLogo /><span className="text-ink-3">· {perfil?.nombre}</span></div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="local-abierto" label={config.local_abierto ? "Local abierto" : "Local cerrado"} checked={config.local_abierto} onChange={cambiarLocal} />
            {caja ? <Badge tono="ok" icon={Wallet}>Caja abierta · debe haber <span className="num">{bs(debe)}</span></Badge> : <Link to="/admin/caja"><Badge tono="neutral" icon={Lock}>Caja cerrada · abrir</Badge></Link>}
            <span className="hidden items-center gap-1.5 text-[13px] text-ink-3 xl:flex" aria-label="Atajos de teclado"><kbd className="rounded border border-b-2 border-line px-1.5">N</kbd> nuevo <kbd className="rounded border border-b-2 border-line px-1.5">F</kbd> cobrar <kbd className="rounded border border-b-2 border-line px-1.5">/</kbd> buscar</span>
          </div>
        </header>
        {vista === "pedidos" ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(300px,400px)_minmax(0,1fr)]">
            <section aria-label="Pedidos" className="flex min-h-0 flex-col gap-2.5 border-line p-3.5 md:border-r">
              <SearchInput ref={busca} id="caj-q" value={q} onChange={setQ} placeholder="Buscar pedido, mesa o cliente" className="!max-w-none flex-none" />
              <div className="flex flex-wrap items-center gap-2">
                {([["sin", "Sin cobrar"], ["todos", "Todos"], ["pag", "Pagados"]] as const).map(([k, t]) => <Chip key={k} activo={filtro === k} onClick={() => setFiltro(k)} contador={lista.filter(p => k === "todos" || (k === "sin" ? !pagado(p) : pagado(p))).length}>{t}</Chip>)}
                <Menu items={[{ label: "Limpiar pagados", icon: Trash2, peligro: true, onClick: () => setLimpiar(true) }]} />
              </div>
              <ul className="flex max-h-[46vh] flex-col gap-2 overflow-auto p-0.5 md:max-h-none md:flex-1">
                {cargando && [1, 2, 3].map(i => <li key={i}><Skeleton h={96} r={12} /></li>)}
                {!cargando && filtrados.length === 0 && <li><EmptyState icon={Receipt} titulo={filtro === "sin" ? "No hay pedidos por cobrar" : "No hay pedidos"} texto="Los pedidos de mesas, tienda y delivery aparecen aquí al instante." accion={{ label: "Nuevo pedido", icon: Plus, onClick: () => setVista("nuevo") }} /></li>}
                {filtrados.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => elegir(p.id)} style={{ "--c": CANALES[p.canal].color } as CSSProperties}
                      className={cx("flex w-full flex-col gap-2 rounded-md border border-l-[5px] border-line border-l-[var(--c)] bg-surface p-3 text-left hover:bg-surface-2", sel === p.id && "bg-brand-soft shadow-[0_0_0_2px_var(--brand)]")}>
                      <span className="flex items-center justify-between gap-2"><CanalTag p={p} mesa={numMesa(p)} /><span className="num text-sm text-ink-3">#{p.numero} · {minutosDesde(p.created_at)} min</span></span>
                      <span className="line-clamp-2 text-sm text-ink-2">{(p.pedido_items || []).map(i => `${i.cantidad} ${i.nombre}`).join(", ")}</span>
                      <span className="flex items-center justify-between gap-2"><span className="flex flex-wrap gap-1.5"><EstadoBadge p={p} />{p.pidio_cuenta && <Badge tono="bad" icon={Receipt}>Pidió la cuenta</Badge>}<PagoBadge p={p} /></span><strong className="num">{bs(p.total)}</strong></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Detalle y cobro" className="min-h-0 overflow-auto px-6 py-5">
              {pedido ? <Cobro key={pedido.id} p={pedido} mesa={numMesa(pedido)} cajaAbierta={!!caja} cobrarRef={cobrarRef} />
                : <EmptyState icon={Banknote} titulo="Elige un pedido para cobrar" texto="O crea uno nuevo con la tecla N." accion={{ label: "Nuevo pedido", icon: Plus, onClick: () => setVista("nuevo") }} />}
            </section>
          </div>
        ) : <NuevoPedidoCaja mesas={mesas} alCrear={(id, cobrarYa) => { setVista("pedidos"); setFiltro("sin"); if (cobrarYa) setTimeout(() => elegir(id), 600); }} />}
      </div>
      {limpiar && <ConfirmDialog titulo="¿Limpiar los pedidos pagados?" texto="Se quitan de esta lista. Siguen guardados en Administración › Pedidos." confirmar="Limpiar" onClose={() => setLimpiar(false)}
        onConfirm={() => { const t = Date.now(); localStorage.setItem("restobar-ocultar-pagados", String(t)); setOcultosAntes(t); avisar("Pedidos pagados quitados de la lista"); }} />}
    </div>
  );
}

function Cobro({ p, mesa, cajaAbierta, cobrarRef }: { p: Pedido; mesa?: number; cajaAbierta: boolean; cobrarRef: React.RefObject<HTMLButtonElement> }) {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: perfiles } = usePerfiles();
  const [propina, setPropina] = useState<number>(config.propina_sugerida);
  const [partes, setPartes] = useState(1);
  const [metodo, setMetodo] = useState<"efectivo" | "qr" | "tarjeta" | "mixto">("efectivo");
  const [recibido, setRecibido] = useState(""), [efMixto, setEfMixto] = useState("");
  const [anular, setAnular] = useState(false), [factura, setFactura] = useState(false), [cobrando, setCobrando] = useState(false);
  const base = Number(p.subtotal) + Number(p.envio);
  const montoPropina = Math.round(base * propina) / 100;
  const tot = base + montoPropina;
  const rec = leerMonto(recibido), efm = Math.min(tot, leerMonto(efMixto)), vuelto = rec - tot;
  const repartidores = perfiles.filter(x => x.rol === "repartidor" && x.activo);
  useEffect(() => { if (!pagado(p)) enviarPantalla({ pedidoId: p.id, fase: metodo === "qr" || metodo === "mixto" ? "qr" : "pedido", monto: metodo === "mixto" ? tot - efm : tot }); }, [metodo, tot, efm, p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const listo = cajaAbierta && (metodo === "efectivo" ? rec >= tot : metodo === "mixto" ? efm > 0 && efm < tot : true);
  const sugerencias = [...new Set([tot, Math.ceil(tot / 10) * 10, Math.ceil(tot / 50) * 50, Math.ceil(tot / 100) * 100, 200].filter(v => v >= tot))].slice(0, 4);

  async function cobrar() {
    if (!listo) return;
    setCobrando(true);
    const cierra = ["mesa", "qr", "mostrador"].includes(p.canal) && p.estado === "listo";
    const { error } = await supabase.from("pedidos").update({
      pago_metodo: metodo, pago_pendiente: false, propina: montoPropina, partes,
      pago_efectivo: metodo === "efectivo" ? rec : metodo === "mixto" ? efm : null, ...(cierra ? { estado: "entregado" } : {}),
    }).eq("id", p.id);
    setCobrando(false);
    if (error) return avisar(mensajeError(error), "bad");
    sonar("gracias");
    enviarPantalla({ pedidoId: p.id, fase: "pagado", monto: tot });
    avisar(`Cobrado · ${mesa ? "Mesa " + mesa : CANALES[p.canal].nombre} · ${bs(tot)}${metodo === "efectivo" && vuelto > 0 ? ` · vuelto ${bs(vuelto)}` : ""}`);
    if (leerImpresion().tickets) imprimirTicket({ ...p, propina: montoPropina, total: tot }, config, mesa);
  }
  async function asignar(id: string) {
    const { error } = await supabase.from("pedidos").update({ repartidor_id: id || null }).eq("id", p.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(id ? `Asignado a ${perfiles.find(x => x.id === id)?.nombre}` : "Sin repartidor asignado");
  }
  async function validarQR() {
    const { error } = await supabase.from("pedidos").update({ pago_pendiente: false }).eq("id", p.id);
    if (error) avisar(mensajeError(error), "bad"); else { avisar(`Cobro QR del pedido #${p.numero} validado`); sonar("gracias"); }
  }

  if (pagado(p) || (p.pago_metodo && p.pago_pendiente)) {
    const pendiente = p.pago_pendiente;
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span className={cx("grid h-[84px] w-[84px] place-items-center rounded-full text-white", pendiente ? "bg-info" : "bg-ok")}>{pendiente ? <QrCode size={40} /> : <Check size={44} strokeWidth={2.5} />}</span>
        <h2 className="text-xl font-extrabold">{pendiente ? "QR por validar" : "Pagado"}</h2>
        <p className="num">{bs(p.total)} · {etiquetaPago(p)[0]}{p.pago_metodo === "efectivo" && Number(p.pago_efectivo) > Number(p.total) ? ` · recibido ${bs(p.pago_efectivo)} · vuelto ${bs(Number(p.pago_efectivo) - Number(p.total))}` : ""}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {pendiente && <Button variant="primary" icon={Check} onClick={validarQR}>Ya llegó el abono · validar</Button>}
          <Button icon={Printer} onClick={() => imprimirTicket(p, config, mesa)}>Imprimir ticket</Button>
          {config.facturacion_activa && <Button icon={FileText} onClick={() => setFactura(true)}>Emitir factura</Button>}
        </div>
        {p.delivery_estado && <AsignarRepartidor p={p} repartidores={repartidores} asignar={asignar} />}
        {factura && <Factura p={p} onClose={() => setFactura(false)} />}
      </div>
    );
  }
  return (
    <div className="flex max-w-[660px] flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-extrabold">Pedido #{p.numero}</h2><p className="text-sm text-ink-3">{mesa ? `Mesa ${mesa}` : CANALES[p.canal].nombre}{p.cliente ? " · " + p.cliente : ""}</p></div>
        <div className="flex items-center gap-1.5"><EstadoBadge p={p} /><Menu items={[{ label: "Anular pedido", icon: Trash2, peligro: true, onClick: () => setAnular(true) }]} /></div>
      </div>
      {p.delivery_estado && <AsignarRepartidor p={p} repartidores={repartidores} asignar={asignar} />}
      <ul className="flex flex-col">
        {(p.pedido_items || []).map(i => (
          <li key={i.id} className="grid grid-cols-[40px_1fr_auto] items-baseline gap-2 border-b border-dashed border-line py-1.5">
            <span className="num">{i.cantidad} ×</span><span>{i.nombre}{i.nota && <em className="block text-[13px] font-semibold not-italic text-accent-deep">{i.nota}</em>}</span><span className="num">{bs(i.cantidad * Number(i.precio_unitario))}</span>
          </li>
        ))}
        {Number(p.envio) > 0 && <li className="grid grid-cols-[40px_1fr_auto] gap-2 border-b border-dashed border-line py-1.5"><span /><span>Envío</span><span className="num">{bs(p.envio)}</span></li>}
      </ul>
      <div className="flex items-baseline justify-between border-t-2 border-line pt-2.5"><span>Total</span><strong className="num font-display text-[34px] font-extrabold">{bs(tot)}</strong></div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1"><span className="text-[13px] font-semibold text-ink-3">Propina</span><Seg value={String(propina)} onChange={v => setPropina(Number(v))} label="Propina" opciones={[["0", "No"], ["5", "5 %"], ["10", "10 %"]]} /></div>
        <div className="flex flex-col gap-1"><span className="text-[13px] font-semibold text-ink-3">Dividir</span><Seg value={String(partes)} onChange={v => setPartes(Number(v))} label="Dividir la cuenta" opciones={[["1", "No"], ["2", "2"], ["3", "3"], ["4", "4"]]} /></div>
      </div>
      {partes > 1 && <p className="num text-sm">Cada persona paga <strong>{bs(tot / partes)}</strong></p>}
      <div role="group" aria-label="Método de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["efectivo", "Efectivo", Banknote], ["qr", "QR", QrCode], ["tarjeta", "Tarjeta", CreditCard], ["mixto", "Mixto", Shuffle]] as const).map(([k, t, Ic]) => (
          <button key={k} type="button" aria-pressed={metodo === k} onClick={() => setMetodo(k)}
            className={cx("flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border font-bold", metodo === k ? "border-brand bg-brand-soft text-brand-text shadow-[inset_0_0_0_2px_var(--brand)]" : "border-line bg-surface text-ink-2")}><Ic size={24} />{t}</button>
        ))}
      </div>
      {metodo === "efectivo" && (
        <div className="flex flex-col gap-2.5 rounded-md bg-surface-2 p-3">
          <div className="flex flex-wrap gap-2">{sugerencias.map(v => <Chip key={v} activo={rec === v} onClick={() => setRecibido(String(v).replace(".", ","))}>{v === tot ? "Exacto" : bs(v)}</Chip>)}</div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-3">Recibido<input inputMode="decimal" value={recibido} placeholder="0,00" onChange={e => setRecibido(e.target.value)} className="!min-h-14 font-display !text-[26px] font-extrabold" /></label>
          {rec > 0 && (vuelto >= 0 ? <p className="num text-[17px] text-ok">Vuelto a devolver: <strong className="text-[22px]">{bs(vuelto)}</strong></p> : <p className="num text-[17px] text-bad">Todavía falta: <strong className="text-[22px]">{bs(-vuelto)}</strong></p>)}
        </div>
      )}
      {(metodo === "qr" || metodo === "mixto") && (
        <div className="flex flex-col gap-2.5 rounded-md bg-surface-2 p-3">
          {metodo === "mixto" && <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-3">Parte en efectivo<input inputMode="decimal" value={efMixto} placeholder="0,00" onChange={e => setEfMixto(e.target.value)} className="!min-h-14 font-display !text-[26px] font-extrabold" /></label>}
          <div className="flex flex-wrap items-center gap-3"><QrCobro monto={metodo === "mixto" ? tot - efm : tot} referencia={`pedido ${p.numero}`} tamano={130} />
            <div><strong className="num">{bs(metodo === "mixto" ? tot - efm : tot)} por QR</strong><p className="flex items-center gap-1 text-sm"><Monitor size={16} />Se muestra en la pantalla del cliente.</p><p className="text-sm text-ink-3">Cobra cuando veas el aviso del banco.</p></div></div>
        </div>
      )}
      {metodo === "tarjeta" && <p className="rounded-md bg-surface-2 p-3 text-sm">Pasa la tarjeta por el POS del banco y cobra cuando salga el comprobante.</p>}
      {!cajaAbierta && <p className="font-semibold text-bad">La caja está cerrada. <Link to="/admin/caja" className="underline">Ábrela en Cierre de caja</Link> para poder cobrar.</p>}
      <button ref={cobrarRef} type="button" disabled={!listo || cobrando} onClick={cobrar}
        className="num flex min-h-[72px] w-full items-center justify-between rounded-md bg-brand px-6 font-display text-2xl font-extrabold text-on-brand hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-45">
        <span>{cobrando ? "Cobrando…" : "Cobrar"}</span><span>{bs(tot)}</span>
      </button>
      {anular && <PinDialog onClose={() => setAnular(false)} onConfirm={async (pin, motivo) => {
        const { error } = await supabase.rpc("anular_pedido", { p_id: p.id, p_pin: pin, p_motivo: motivo }); if (error) throw error;
        enviarPantalla({ pedidoId: null, fase: "espera" }); avisar(`Pedido #${p.numero} anulado`);
      }} />}
    </div>
  );
}

function AsignarRepartidor({ p, repartidores, asignar }: { p: Pedido; repartidores: { id: string; nombre: string }[]; asignar: (id: string) => void }) {
  return (
    <label className="flex w-full max-w-sm items-center gap-2 rounded-md bg-surface-2 p-2.5 text-sm font-semibold">
      <Bike size={18} className="flex-none" /><span className="whitespace-nowrap">Repartidor</span>
      <select value={p.repartidor_id || ""} onChange={e => asignar(e.target.value)} className="!min-h-10"><option value="">Sin asignar</option>{repartidores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select>
    </label>
  );
}

function Factura({ p, onClose }: { p: Pedido; onClose: () => void }) {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [razon, setRazon] = useState(p.cliente || ""), [nit, setNit] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    if (razon.trim().length < 2) return setError("Escribe la razón social o el nombre.");
    if (!/^\d{5,15}$/.test(nit)) return setError("Escribe el NIT o CI: solo números.");
    setEnviando(true);
    const { data, error } = await supabase.from("facturas").insert({ pedido_id: p.id, razon_social: razon.trim(), nit, total: p.total, ambiente_pruebas: config.facturacion_pruebas, creado_por: perfil?.id }).select("numero").single();
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    avisar(`Factura ${data.numero} emitida`); onClose();
  }
  return (
    <Modal titulo={`Factura del pedido #${p.numero}`} onClose={onClose} ancho={420} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Emitir · {bs(p.total)}</Button></>}>
      <FormField id="cf-r" label="Razón social o nombre"><input id="cf-r" data-autofocus value={razon} onChange={e => { setRazon(e.target.value); setError(""); }} /></FormField>
      <FormField id="cf-n" label="NIT o CI"><input id="cf-n" inputMode="numeric" value={nit} onChange={e => { setNit(e.target.value.replace(/\D/g, "")); setError(""); }} /></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

function NuevoPedidoCaja({ mesas, alCrear }: { mesas: Mesa[]; alCrear: (id: string, cobrarYa: boolean) => void }) {
  const { perfil } = useAuth();
  const { config } = useConfig();
  const avisar = useAvisar();
  const [tipo, setTipo] = useState<Canal>("mostrador");
  const { productos, categorias, nombreCat, cargando } = useMenuVenta(tipo === "delivery" ? "delivery" : tipo === "mesa" ? "salon" : "mostrador");
  const { datos: abiertos } = usePedidosAbiertos();
  const { datos: llamadas } = useLlamadasActivas();
  const [cat, setCat] = useState("todos"), [q, setQ] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [mesa, setMesa] = useState<string | null>(null);
  const [cliente, setCliente] = useState(""), [tel, setTel] = useState(""), [dir, setDir] = useState(""), [zona, setZona] = useState(config.envio[0]?.id || "");
  const [enviando, setEnviando] = useState(false);
  const envio = tipo === "delivery" ? Number(config.envio.find(z => z.id === zona)?.costo || 0) : 0;
  const prods = productos.filter(p => (cat === "todos" || p.categoria_id === cat) && (!q || sinTildes(p.nombre).includes(sinTildes(q))));
  const cant = (id: string) => lineas.filter(l => l.producto_id === id).reduce((a, l) => a + l.cantidad, 0);
  const sumar = (id: string, d: number) => { const p = productos.find(x => x.id === id); if (p?.agotado && d > 0) return avisar(`${p.nombre} está agotado`, "bad"); setLineas(ls => sumarLinea(ls, id, d)); };
  const tot = totalLineas(lineas, productos) + envio;
  const valido = lineas.length > 0 && (tipo !== "mesa" || mesa) && (tipo !== "delivery" || cliente.trim());
  async function crear(cobrarYa: boolean) {
    setEnviando(true);
    try {
      const p = await enviarPedido({ canal: tipo, lineas, mesa_id: tipo === "mesa" ? mesa : null, cliente, telefono: tel, direccion: dir, envio, creado_por: perfil?.id });
      avisar(`Pedido #${p.numero} enviado a cocina`); setLineas([]); alCrear(p.id, cobrarYa);
    } catch (e) { avisar(mensajeError(e), "bad"); } finally { setEnviando(false); }
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="Productos" className="flex min-h-0 flex-col gap-2.5 overflow-auto p-4">
        <SearchInput id="np-q" value={q} onChange={setQ} placeholder="Buscar plato" />
        <div className="sin-barra flex gap-2 overflow-x-auto pb-0.5">
          <Chip activo={cat === "todos"} onClick={() => setCat("todos")} contador={productos.length}>Todos</Chip>
          {categorias.map(c => <Chip key={c.id} activo={cat === c.id} onClick={() => setCat(c.id)} contador={productos.filter(p => p.categoria_id === c.id).length}>{c.nombre}</Chip>)}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {cargando && [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} h={170} r={12} />)}
          {prods.map(p => (
            <button key={p.id} type="button" onClick={() => sumar(p.id, 1)} aria-label={`${p.nombre}, ${bs(p.precio)}${p.agotado ? ", agotado" : ""}`}
              className={cx("relative flex flex-col gap-1 rounded-md border border-line bg-surface p-1.5 pb-2.5 text-left hover:border-brand active:scale-[.98]", p.agotado && "cursor-not-allowed")}>
              <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-lg" />
              {cant(p.id) > 0 && <span className="num absolute right-2.5 top-2.5 grid h-[30px] min-w-[30px] place-items-center rounded-full bg-accent px-2 font-extrabold text-on-accent shadow">{cant(p.id)}</span>}
              {p.agotado && <span className="absolute left-3 top-3 rounded-sm bg-ink px-2 py-0.5 text-xs font-bold text-bg">Agotado</span>}
              <span className="px-1 text-sm font-semibold leading-tight">{p.nombre}</span>
              <span className="num px-1 font-bold text-brand-text">{bs(p.precio)}</span>
            </button>
          ))}
        </div>
      </section>
      <aside aria-label="Ticket" className="flex min-h-0 flex-col gap-2.5 overflow-auto border-t border-line bg-surface px-4 pb-4 lg:border-l lg:border-t-0">
        <div className="trenza -mx-4" aria-hidden="true" />
        <Seg<Canal> value={tipo} onChange={setTipo} label="Tipo de pedido" opciones={[["mesa", "Mesa"], ["mostrador", "Mostrador"], ["llevar", "Para llevar"], ["delivery", "Delivery"]]} />
        {tipo === "mesa" && (
          <div role="group" aria-label="Elige la mesa" className="grid grid-cols-5 gap-1.5">
            {mesas.map(m => { const e = estadoMesa(m.id, abiertos, llamadas); return (
              <button key={m.id} type="button" aria-pressed={mesa === m.id} aria-label={`Mesa ${m.numero}, ${ESTADO_MESA[e].nombre}`} onClick={() => setMesa(m.id)}
                className={cx("num flex min-h-11 items-center justify-center rounded-sm border font-bold", mesa === m.id ? "border-brand shadow-[inset_0_0_0_2px_var(--brand)]" : "border-line",
                  e === "libre" ? "bg-surface" : e === "ocupada" ? "bg-warn-soft" : e === "cuenta" ? "bg-bad-soft" : "bg-info-soft")}>{m.numero}</button>
            ); })}
          </div>
        )}
        {tipo === "mesa" && mesa && abiertos.some(p => p.mesa_id === mesa) && <p className="text-sm text-info">Esta mesa ya tiene cuenta abierta: lo nuevo se suma a ella.</p>}
        {(tipo === "llevar" || tipo === "delivery") && <input aria-label={tipo === "llevar" ? "Nombre de quien recoge" : "Nombre del cliente"} placeholder={tipo === "llevar" ? "Nombre de quien recoge" : "Nombre del cliente"} value={cliente} onChange={e => setCliente(e.target.value)} />}
        {tipo === "delivery" && <>
          <input aria-label="Teléfono" placeholder="Teléfono" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} />
          <input aria-label="Dirección de entrega" placeholder="Dirección de entrega" value={dir} onChange={e => setDir(e.target.value)} />
          {config.envio.length > 0 && <select aria-label="Zona de envío" value={zona} onChange={e => setZona(e.target.value)}>{config.envio.map(z => <option key={z.id} value={z.id}>{z.nombre} · {bs(z.costo)}</option>)}</select>}
        </>}
        <ul className="flex flex-1 flex-col gap-2">
          {lineas.length === 0 && <li className="py-5 text-center text-sm text-ink-3">Toca un plato para sumarlo.</li>}
          {lineas.map(l => { const p = productos.find(x => x.id === l.producto_id)!; return (
            <li key={l.producto_id + l.nota} className="flex items-center gap-2.5">
              <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} cuadrada className="!w-11 flex-none !rounded-lg" />
              <span className="flex min-w-0 flex-1 flex-col text-sm font-semibold">{p.nombre}<small className="num font-medium text-ink-3">{bs(p.precio)}</small></span>
              <span className="inline-flex items-center rounded-full border border-line"><button type="button" aria-label={`Quitar 1 ${p.nombre}`} onClick={() => sumar(p.id, -1)} className="grid h-11 w-11 place-items-center"><Minus size={16} /></button><span className="num w-6 text-center font-bold">{l.cantidad}</span><button type="button" aria-label={`Sumar 1 ${p.nombre}`} onClick={() => sumar(p.id, 1)} className="grid h-11 w-11 place-items-center"><Plus size={16} /></button></span>
            </li>
          ); })}
        </ul>
        {envio > 0 && <p className="num text-sm text-ink-3">Envío {bs(envio)}</p>}
        <div className="flex items-baseline justify-between border-t-2 border-line pt-2.5"><span>Total</span><strong className="num font-display text-[30px] font-extrabold">{bs(tot)}</strong></div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" icon={ChefHat} className="flex-1" disabled={!valido} loading={enviando} onClick={() => crear(false)}>Enviar a cocina</Button>
          <Button size="lg" variant="primary" icon={Banknote} className="flex-1" disabled={!valido || enviando} onClick={() => crear(true)}>Cobrar ahora</Button>
        </div>
      </aside>
    </div>
  );
}
