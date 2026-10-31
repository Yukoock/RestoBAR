// Clientes (CRM): ficha de cada cliente con su historial, grupos (frecuentes, nuevos, dejaron de venir, cumpleaños),
// programa de puntos con premio y promociones por WhatsApp. Cada pedido con teléfono se une solo a su cliente (schema.sql · 6b).
import { useMemo, useState } from "react";
import { Cake, Check, Gift, HeartHandshake, MessageCircle, Pencil, Plus, Send, Settings2, Star, Trash2, UserRound, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { bs, cx, fecha, iniciales, leerMonto, mensajeError, minutosDesde } from "@/lib/formato";
import { useConsulta, CANALES, etiquetaEstado } from "@/lib/datos";
import { exportarTabla } from "@/lib/exportar";
import type { ClienteResumen, Pedido } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, ConfirmDialog, Drawer, FormField, Modal, Skeleton, Switch, useAvisar, type Tono } from "@/components/ui";

/* ---------- Grupos de clientes ---------- */
type Grupo = "frecuente" | "nuevo" | "riesgo" | "ocasional" | "sin_compras";
const GRUPO: Record<Grupo, [string, Tono]> = {
  frecuente: ["Frecuente", "ok"], nuevo: ["Nuevo", "info"], riesgo: ["Dejó de venir", "warn"], ocasional: ["Ocasional", "neutral"], sin_compras: ["Sin compras", "neutral"],
};
const dias = (t: string | null) => t == null ? Infinity : minutosDesde(t) / 1440;
function grupoDe(c: ClienteResumen, diasRiesgo: number): Grupo {
  if (!c.visitas) return "sin_compras";
  if (c.visitas >= 2 && dias(c.ultima_visita) > diasRiesgo) return "riesgo";
  if (c.visitas >= 4) return "frecuente";
  if (dias(c.primera_visita) <= 30) return "nuevo";
  return "ocasional";
}
const cumpleEsteMes = (c: ClienteResumen) => !!c.cumpleanos && Number(c.cumpleanos.slice(5, 7)) === new Date().getMonth() + 1;
const fechaDB = (f: string) => fecha(f + "T12:00:00");
const telVisible = (t: string | null) => t ? `+${t.slice(0, 3)} ${t.slice(3)}` : "—";
const promedio = (c: ClienteResumen) => c.visitas ? Number(c.total_gastado) / c.visitas : 0;
const wa = (tel: string, texto: string) => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
const useClientes = () => useConsulta<ClienteResumen[]>("clientes", () => supabase.from("clientes_resumen").select("*").order("total_gastado", { ascending: false }) as never, [], ["clientes", "pedidos"]);

export function Clientes() {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { datos: clientes, cargando, error, recargar } = useClientes();
  const [ficha, setFicha] = useState<ClienteResumen | null>(null);
  const [editar, setEditar] = useState<ClienteResumen | "nuevo" | null>(null);
  const [promo, setPromo] = useState(false), [programa, setPrograma] = useState(false);
  const esDueno = perfil?.rol === "dueno";
  const g = (c: ClienteResumen) => grupoDe(c, config.crm_dias_riesgo);
  const conteo = useMemo(() => {
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    return {
      total: clientes.length,
      nuevosMes: clientes.filter(c => c.primera_visita && new Date(c.primera_visita) >= mes).length,
      frecuentes: clientes.filter(c => g(c) === "frecuente").length,
      riesgo: clientes.filter(c => g(c) === "riesgo").length,
      cumple: clientes.filter(cumpleEsteMes).length,
      premio: clientes.filter(c => c.puntos >= config.crm_puntos_premio).length,
    };
  }, [clientes, config.crm_dias_riesgo, config.crm_puntos_premio]); // eslint-disable-line react-hooks/exhaustive-deps
  // La ficha abierta se actualiza sola cuando cambian los datos (por ejemplo, después de canjear)
  const fichaActual = ficha && (clientes.find(c => c.id === ficha.id) || ficha);

  const tiles: [string, number, typeof Users][] = [["Clientes", conteo.total, Users], ["Nuevos este mes", conteo.nuevosMes, UserRound], ["Frecuentes", conteo.frecuentes, Star],
    ["Dejaron de venir", conteo.riesgo, HeartHandshake], ["Cumplen años este mes", conteo.cumple, Cake], ["Con premio listo", conteo.premio, Gift]];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([t, n, Ic]) => (
          <div key={t} className="flex items-center gap-3 rounded-md bg-surface px-4 py-3 shadow-1">
            <Ic size={20} className="flex-none text-brand-text" aria-hidden="true" />
            <div className="flex flex-col"><span className="text-sm text-ink-3">{t}</span>{cargando ? <Skeleton h={22} w={40} /> : <strong className="num font-display text-lg">{n}</strong>}</div>
          </div>
        ))}
      </div>
      <DataTable<ClienteResumen> id="clientes" titulo="Clientes" filas={clientes} clave={c => c.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={c => `${c.nombre} ${c.telefono || ""} ${c.correo || ""} ${c.etiquetas.join(" ")}`}
        arriba={<>
          <Button variant="primary" icon={Plus} onClick={() => setEditar("nuevo")}>Nuevo cliente</Button>
          <Button icon={Send} onClick={() => setPromo(true)}>Enviar promoción</Button>
          {esDueno && <Button icon={Settings2} onClick={() => setPrograma(true)}>Programa de puntos</Button>}
        </>}
        filtros={[
          { id: "todos", titulo: "Todos", f: () => true },
          { id: "frecuente", titulo: "Frecuentes", f: c => g(c) === "frecuente" },
          { id: "nuevo", titulo: "Nuevos", f: c => g(c) === "nuevo" },
          { id: "riesgo", titulo: "Dejaron de venir", f: c => g(c) === "riesgo" },
          { id: "cumple", titulo: "Cumpleaños del mes", f: cumpleEsteMes },
          { id: "premio", titulo: "Con premio listo", f: c => c.puntos >= config.crm_puntos_premio },
        ]}
        columnas={[
          { clave: "nombre", titulo: "Cliente", texto: c => c.nombre, orden: c => c.nombre,
            render: c => <span className="flex items-center gap-2.5"><span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand text-[13px] font-bold text-on-brand">{iniciales(c.nombre)}</span><span className="flex flex-col"><strong>{c.nombre}</strong><small className="num text-ink-3">{telVisible(c.telefono)}</small></span></span> },
          { clave: "telefono", titulo: "WhatsApp", oculta: true, texto: c => c.telefono || "" },
          { clave: "grupo", titulo: "Grupo", texto: c => GRUPO[g(c)][0], orden: c => GRUPO[g(c)][0], render: c => <Badge tono={GRUPO[g(c)][1]} punto>{GRUPO[g(c)][0]}</Badge> },
          { clave: "visitas", titulo: "Visitas", derecha: true, texto: c => c.visitas, orden: c => c.visitas },
          { clave: "total", titulo: "Total gastado", derecha: true, texto: c => bs(c.total_gastado), orden: c => Number(c.total_gastado) },
          { clave: "promedio", titulo: "Ticket promedio", derecha: true, texto: c => c.visitas ? bs(promedio(c)) : "—", orden: promedio },
          { clave: "ultima", titulo: "Última visita", texto: c => c.ultima_visita ? fecha(c.ultima_visita) : "—", orden: c => c.ultima_visita || "" },
          { clave: "puntos", titulo: "Puntos", derecha: true, texto: c => c.puntos, orden: c => c.puntos,
            render: c => <span className={cx("num inline-flex items-center gap-1", c.puntos >= config.crm_puntos_premio && "font-bold text-ok")}>{c.puntos >= config.crm_puntos_premio && <Gift size={14} aria-label="Premio listo" />}{c.puntos}</span> },
        ]}
        onFila={setFicha}
        accion={{ titulo: "Ver ficha", icon: UserRound, onClick: setFicha }}
        menu={c => [
          !!c.telefono && { label: "Escribir por WhatsApp", icon: MessageCircle, onClick: () => wa(c.telefono!, `Hola ${c.nombre.split(" ")[0]}, te escribimos de ${config.nombre}.`) },
          { label: "Editar datos", icon: Pencil, onClick: () => setEditar(c) },
        ]}
        onExportar={(t, f, c) => exportarTabla(t, "Clientes", f, c, config)}
        vacio={{ icon: Users, titulo: "Todavía no hay clientes", texto: "Se agregan solos con cada pedido que lleva teléfono (tienda online, delivery o caja). También puedes agregarlos a mano.", accion: { label: "Nuevo cliente", icon: Plus, onClick: () => setEditar("nuevo") } }} />

      {fichaActual && <Ficha c={fichaActual} grupo={g(fichaActual)} onClose={() => setFicha(null)} onEditar={() => setEditar(fichaActual)} />}
      {editar && <EditarCliente c={editar === "nuevo" ? null : editar} onClose={() => setEditar(null)} onBorrado={() => { setEditar(null); setFicha(null); }} esDueno={esDueno} />}
      {promo && <Promocion clientes={clientes} grupo={g} onClose={() => setPromo(false)} />}
      {programa && <Programa onClose={() => setPrograma(false)} onGuardado={() => { avisar("Programa de puntos actualizado"); recargar(); }} />}
    </div>
  );
}

/* ---------- Ficha del cliente ---------- */
type PedidoFicha = Pick<Pedido, "id" | "numero" | "canal" | "total" | "estado" | "pago_metodo" | "pago_pendiente" | "created_at"> & { pedido_items: { nombre: string; cantidad: number }[] };
function Ficha({ c, grupo, onClose, onEditar }: { c: ClienteResumen; grupo: Grupo; onClose: () => void; onEditar: () => void }) {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: pedidos, cargando } = useConsulta<PedidoFicha[]>("ficha-" + c.id,
    () => supabase.from("pedidos").select("id, numero, canal, total, estado, pago_metodo, pago_pendiente, created_at, pedido_items(nombre, cantidad)").eq("cliente_id", c.id).order("created_at", { ascending: false }).limit(50) as never, [], ["pedidos"]);
  const [canjear, setCanjear] = useState(false);
  const favoritos = useMemo(() => {
    const m = new Map<string, number>();
    pedidos.filter(p => p.estado !== "anulado").forEach(p => p.pedido_items.forEach(i => m.set(i.nombre, (m.get(i.nombre) || 0) + i.cantidad)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [pedidos]);
  const meta = config.crm_puntos_premio, avance = Math.min(100, Math.round((Math.max(0, c.puntos) / meta) * 100)), listo = c.puntos >= meta;
  const nombre1 = c.nombre.split(" ")[0];
  return (
    <Drawer titulo={c.nombre} sub={`${GRUPO[grupo][0]} · cliente desde ${fecha(c.created_at)}`} onClose={onClose}
      pie={<>
        {c.telefono && <Button variant="primary" icon={MessageCircle} onClick={() => wa(c.telefono!, `Hola ${nombre1}, te escribimos de ${config.nombre}.`)}>WhatsApp</Button>}
        <Button icon={Pencil} onClick={onEditar}>Editar datos</Button>
      </>}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {([["Visitas", String(c.visitas)], ["Total gastado", bs(c.total_gastado)], ["Ticket promedio", c.visitas ? bs(promedio(c)) : "—"], ["Última visita", c.ultima_visita ? fecha(c.ultima_visita) : "—"]] as [string, string][]).map(([t, v]) => (
          <div key={t} className="flex flex-col rounded-md bg-surface-2 px-3 py-2"><span className="text-[13px] text-ink-3">{t}</span><strong className="num font-display">{v}</strong></div>
        ))}
      </div>

      <section className="flex flex-col gap-2 rounded-md border border-line p-3.5" aria-label="Puntos">
        <div className="flex items-center gap-2"><Gift size={18} className="text-accent" aria-hidden="true" /><strong className="flex-1">Puntos</strong><span className="num font-display text-xl font-extrabold">{c.puntos}</span><span className="text-sm text-ink-3">/ {meta}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance hacia el premio"><div className={cx("h-full rounded-full", listo ? "bg-ok" : "bg-maiz")} style={{ width: `${avance}%` }} /></div>
        <p className="text-sm text-ink-2">{listo ? <>¡Tiene el premio listo! <strong>{config.crm_premio}</strong>.</> : <>Le faltan <strong className="num">{meta - c.puntos}</strong> puntos para «{config.crm_premio}». Gana 1 punto por cada {bs(config.crm_bs_por_punto)}.</>}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={listo ? "primary" : "secondary"} icon={Check} disabled={!listo} onClick={() => setCanjear(true)}>Canjear premio</Button>
          {c.telefono && <Button size="sm" variant="ghost" icon={MessageCircle} onClick={() => wa(c.telefono!, listo ? `¡Hola ${nombre1}! Ya juntaste ${c.puntos} puntos en ${config.nombre}: tienes de premio ${config.crm_premio}. ¡Te esperamos!` : `¡Hola ${nombre1}! Llevas ${c.puntos} puntos en ${config.nombre}. Te faltan ${meta - c.puntos} para ${config.crm_premio}.`)}>Avisarle sus puntos</Button>}
        </div>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        <dt className="text-ink-3">WhatsApp</dt><dd className="num">{telVisible(c.telefono)}</dd>
        <dt className="text-ink-3">Correo</dt><dd>{c.correo || "—"}</dd>
        <dt className="text-ink-3">Cumpleaños</dt><dd>{c.cumpleanos ? <>{fechaDB(c.cumpleanos).slice(0, 5)}{cumpleEsteMes(c) && <Badge tono="info" icon={Cake}>Este mes</Badge>}</> : "—"}</dd>
        <dt className="text-ink-3">Promociones</dt><dd>{c.acepta_promos ? "Acepta recibirlas" : "No quiere recibirlas"}</dd>
        {c.etiquetas.length > 0 && <><dt className="text-ink-3">Etiquetas</dt><dd className="flex flex-wrap gap-1">{c.etiquetas.map(e => <Badge key={e}>{e}</Badge>)}</dd></>}
        {c.notas && <><dt className="text-ink-3">Notas</dt><dd className="whitespace-pre-line">{c.notas}</dd></>}
      </dl>

      {favoritos.length > 0 && (
        <section><h3 className="mb-1.5 font-bold">Lo que más pide</h3>
          <ol className="flex flex-col gap-1">{favoritos.map(([n, q], i) => <li key={n} className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-maiz text-[13px] font-extrabold text-on-maiz">{i + 1}</span><span className="flex-1">{n}</span><span className="num text-ink-3">{q} {q === 1 ? "vez" : "veces"}</span></li>)}</ol>
        </section>
      )}

      <section><h3 className="mb-1.5 font-bold">Historial de pedidos</h3>
        {cargando ? <div className="flex flex-col gap-2"><Skeleton h={44} /><Skeleton h={44} /></div>
          : !pedidos.length ? <p className="text-sm text-ink-3">Todavía no tiene pedidos.</p>
          : <ul className="flex flex-col">{pedidos.map(p => { const [et, tono] = etiquetaEstado(p as Pedido); const C = CANALES[p.canal]; return (
              <li key={p.id} className="flex items-center gap-3 border-b border-dashed border-line py-2 last:border-0">
                <span className="flex flex-1 flex-col"><span className="num font-semibold">#{p.numero} · {fecha(p.created_at)}</span><small className="text-ink-3">{C.nombre} · {p.pedido_items.map(i => `${i.cantidad} × ${i.nombre}`).join(", ")}</small></span>
                <Badge tono={tono}>{et}</Badge><span className="num w-24 text-right font-semibold">{bs(p.total)}</span>
              </li>); })}</ul>}
      </section>

      {canjear && <ConfirmDialog titulo={`¿Canjear el premio de ${nombre1}?`} confirmar="Canjear" texto={<>Entrega <strong>{config.crm_premio}</strong>. Se descuentan {meta} puntos y queda registrado.</>}
        onClose={() => setCanjear(false)}
        onConfirm={async () => { const { data, error } = await supabase.rpc("canjear_puntos", { p_cliente: c.id }); if (error) avisar(mensajeError(error), "bad"); else { avisar(`Premio entregado. Le quedan ${data} puntos.`); window.dispatchEvent(new Event("restobar-cambio")); } }} />}
    </Drawer>
  );
}

/* ---------- Nuevo cliente / editar ---------- */
function EditarCliente({ c, onClose, onBorrado, esDueno }: { c: ClienteResumen | null; onClose: () => void; onBorrado: () => void; esDueno: boolean }) {
  const avisar = useAvisar();
  const [f, setF] = useState({ nombre: c?.nombre || "", telefono: c?.telefono || "", correo: c?.correo || "", cumpleanos: c?.cumpleanos || "", etiquetas: c?.etiquetas.join(", ") || "", notas: c?.notas || "", acepta_promos: c?.acepta_promos ?? true });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false), [borrar, setBorrar] = useState(false);
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF(x => ({ ...x, [k]: v })); setError(""); };
  async function ok() {
    if (f.nombre.trim().length < 2) return setError("Escribe el nombre del cliente.");
    let tel = f.telefono.replace(/\D/g, ""); if (tel.length === 8) tel = "591" + tel;
    if (tel && !/^\d{9,15}$/.test(tel)) return setError("El WhatsApp va con 8 números (o con 591 delante).");
    if (f.correo && !/^\S+@\S+\.\S+$/.test(f.correo.trim())) return setError("Escribe un correo válido.");
    setEnviando(true);
    const datos = { nombre: f.nombre.trim(), telefono: tel || null, correo: f.correo.trim() || null, cumpleanos: f.cumpleanos || null, notas: f.notas.trim() || null, acepta_promos: f.acepta_promos,
      etiquetas: [...new Set(f.etiquetas.split(",").map(e => e.trim()).filter(Boolean))] };
    const { error } = c ? await supabase.from("clientes").update(datos).eq("id", c.id) : await supabase.from("clientes").insert(datos);
    setEnviando(false);
    if (error) return setError(/unique|duplicate/i.test(error.message) ? "Ya hay un cliente con ese WhatsApp. Búscalo en la lista." : mensajeError(error));
    avisar(c ? "Datos del cliente guardados" : `${datos.nombre} agregado`); onClose();
  }
  return (
    <Modal titulo={c ? `Editar a ${c.nombre}` : "Nuevo cliente"} onClose={onClose} ancho={520}
      pie={<>{c && esDueno && <Button variant="ghost" icon={Trash2} className="mr-auto !text-bad" onClick={() => setBorrar(true)}>Eliminar</Button>}<Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <FormField id="cl-n" label="Nombre"><input id="cl-n" data-autofocus value={f.nombre} onChange={e => up("nombre", e.target.value)} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cl-t" label="WhatsApp" hint="8 números, ej.: 70012345"><input id="cl-t" inputMode="tel" value={f.telefono} onChange={e => up("telefono", e.target.value.replace(/[^\d+ ]/g, ""))} /></FormField>
        <FormField id="cl-b" label="Cumpleaños"><input id="cl-b" type="date" value={f.cumpleanos} onChange={e => up("cumpleanos", e.target.value)} /></FormField>
      </div>
      <FormField id="cl-c" label="Correo (opcional)"><input id="cl-c" type="email" value={f.correo} onChange={e => up("correo", e.target.value)} /></FormField>
      <FormField id="cl-e" label="Etiquetas" hint="Separadas por coma, ej.: vegetariano, empresa, cumpleañero"><input id="cl-e" value={f.etiquetas} onChange={e => up("etiquetas", e.target.value)} /></FormField>
      <FormField id="cl-o" label="Notas" hint="Gustos, alergias, mesa preferida…"><textarea id="cl-o" rows={3} value={f.notas} onChange={e => up("notas", e.target.value)} /></FormField>
      <Switch id="cl-p" checked={f.acepta_promos} onChange={v => up("acepta_promos", v)} label="Acepta recibir promociones por WhatsApp" />
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      {borrar && c && <ConfirmDialog titulo={`¿Eliminar a ${c.nombre}?`} peligro confirmar="Eliminar" texto="Sus pedidos se conservan, pero sin cliente, y se pierden sus puntos." onClose={() => setBorrar(false)}
        onConfirm={async () => { const { error } = await supabase.from("clientes").delete().eq("id", c.id); if (error) avisar(mensajeError(error), "bad"); else { avisar(`${c.nombre} eliminado`); onBorrado(); } }} />}
    </Modal>
  );
}

/* ---------- Promoción por WhatsApp ---------- */
type Destino = "todos" | "frecuente" | "nuevo" | "riesgo" | "cumple" | "premio";
const TEXTOS: Record<Destino, string> = {
  todos: "¡Hola {nombre}! Esta semana en {negocio} tenemos una promo especial para ti. ¡Te esperamos!",
  frecuente: "¡Hola {nombre}! Gracias por ser cliente frecuente de {negocio}. Tu próxima visita tiene un detalle de la casa.",
  nuevo: "¡Hola {nombre}! Gracias por visitarnos en {negocio}. ¿Qué te pareció? Vuelve pronto y prueba nuestro plato del día.",
  riesgo: "¡Hola {nombre}! Te extrañamos en {negocio}. Vuelve esta semana y te invitamos un refresco con tu pedido.",
  cumple: "¡Feliz cumpleaños, {nombre}! En {negocio} te regalamos un postre en tu visita de este mes.",
  premio: "¡Hola {nombre}! Ya juntaste {puntos} puntos en {negocio}: tienes de premio {premio}. ¡Ven a canjearlo!",
};
function Promocion({ clientes, grupo, onClose }: { clientes: ClienteResumen[]; grupo: (c: ClienteResumen) => Grupo; onClose: () => void }) {
  const { config } = useConfig();
  const [destino, setDestino] = useState<Destino>("riesgo");
  const [texto, setTexto] = useState(TEXTOS.riesgo);
  const [enviados, setEnviados] = useState<string[]>([]);
  const lista = clientes.filter(c => c.telefono && c.acepta_promos && (
    destino === "todos" || (destino === "cumple" ? cumpleEsteMes(c) : destino === "premio" ? c.puntos >= config.crm_puntos_premio : grupo(c) === destino)));
  const armar = (c: ClienteResumen) => texto.replace(/\{nombre\}/g, c.nombre.split(" ")[0]).replace(/\{negocio\}/g, config.nombre).replace(/\{puntos\}/g, String(c.puntos)).replace(/\{premio\}/g, config.crm_premio);
  const elegir = (d: Destino) => { setDestino(d); setTexto(TEXTOS[d]); setEnviados([]); };
  return (
    <Modal titulo="Enviar promoción por WhatsApp" onClose={onClose} ancho={620} pie={<Button variant="primary" onClick={onClose}>Listo</Button>}>
      <FormField id="pr-d" label="¿A quiénes?">
        <select id="pr-d" value={destino} onChange={e => elegir(e.target.value as Destino)}>
          <option value="riesgo">Dejaron de venir</option><option value="frecuente">Frecuentes</option><option value="nuevo">Nuevos</option>
          <option value="cumple">Cumplen años este mes</option><option value="premio">Con premio listo</option><option value="todos">Todos</option>
        </select>
      </FormField>
      <FormField id="pr-t" label="Mensaje" hint="{nombre}, {negocio}, {puntos} y {premio} se cambian solos por los datos de cada cliente"><textarea id="pr-t" rows={3} value={texto} onChange={e => setTexto(e.target.value)} /></FormField>
      <p className="text-sm text-ink-3">WhatsApp no permite envíos masivos desde un celular: presiona «Enviar» en cada cliente y se abre su chat con el mensaje listo. Solo aparecen los que aceptan promociones.</p>
      {!lista.length ? <p className="rounded-md bg-surface-2 p-3 text-sm">No hay clientes con WhatsApp en este grupo.</p> : (
        <>
          <p className="text-sm font-semibold"><span className="num">{enviados.length}</span> de <span className="num">{lista.length}</span> enviados</p>
          <ul className="flex max-h-[300px] flex-col overflow-auto rounded-md border border-line">
            {lista.map(c => { const ya = enviados.includes(c.id); return (
              <li key={c.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
                <span className="flex flex-1 flex-col"><strong>{c.nombre}</strong><small className="num text-ink-3">{telVisible(c.telefono)}</small></span>
                <Button size="sm" variant={ya ? "ghost" : "secondary"} icon={ya ? Check : Send} onClick={() => { wa(c.telefono!, armar(c)); setEnviados(e => e.includes(c.id) ? e : [...e, c.id]); }}>{ya ? "Enviado" : "Enviar"}</Button>
              </li>); })}
          </ul>
        </>
      )}
    </Modal>
  );
}

/* ---------- Programa de puntos (solo Dueño) ---------- */
function Programa({ onClose, onGuardado }: { onClose: () => void; onGuardado: () => void }) {
  const { config } = useConfig();
  const [f, setF] = useState({ bs: String(config.crm_bs_por_punto).replace(".", ","), meta: String(config.crm_puntos_premio), premio: config.crm_premio, dias: String(config.crm_dias_riesgo) });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    const bsPunto = leerMonto(f.bs), meta = Number(f.meta), diasR = Number(f.dias);
    if (!(bsPunto > 0)) return setError("Escribe cuántos Bs equivalen a 1 punto.");
    if (!Number.isInteger(meta) || meta < 1) return setError("Los puntos para el premio deben ser un número entero.");
    if (f.premio.trim().length < 3) return setError("Escribe cuál es el premio.");
    if (!Number.isInteger(diasR) || diasR < 7 || diasR > 365) return setError("Los días deben estar entre 7 y 365.");
    setEnviando(true);
    const { error } = await supabase.from("negocio_config").update({ crm_bs_por_punto: bsPunto, crm_puntos_premio: meta, crm_premio: f.premio.trim(), crm_dias_riesgo: diasR }).eq("id", 1);
    setEnviando(false);
    if (error) return setError(/column/i.test(error.message) ? "Falta actualizar la base de datos: vuelve a ejecutar schema.sql en Supabase." : mensajeError(error));
    onGuardado(); onClose();
  }
  const ejemplo = leerMonto(f.bs) > 0 && Number(f.meta) > 0 ? leerMonto(f.bs) * Number(f.meta) : 0;
  return (
    <Modal titulo="Programa de puntos" onClose={onClose} ancho={480} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="pp-b" label="Bs por cada punto"><input id="pp-b" inputMode="decimal" data-autofocus value={f.bs} onChange={e => { setF({ ...f, bs: e.target.value }); setError(""); }} /></FormField>
        <FormField id="pp-m" label="Puntos para el premio"><input id="pp-m" inputMode="numeric" value={f.meta} onChange={e => { setF({ ...f, meta: e.target.value.replace(/\D/g, "") }); setError(""); }} /></FormField>
      </div>
      <FormField id="pp-p" label="Premio"><input id="pp-p" value={f.premio} onChange={e => { setF({ ...f, premio: e.target.value }); setError(""); }} /></FormField>
      <FormField id="pp-d" label="«Dejó de venir» después de (días)" hint="Clientes con 2 visitas o más que no vuelven en este tiempo"><input id="pp-d" inputMode="numeric" value={f.dias} onChange={e => { setF({ ...f, dias: e.target.value.replace(/\D/g, "") }); setError(""); }} /></FormField>
      {ejemplo > 0 && <p className="rounded-md bg-surface-2 p-3 text-sm">Un cliente gana el premio cuando junta <strong className="num">{bs(ejemplo)}</strong> en consumo (sin contar envío ni propina).</p>}
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
