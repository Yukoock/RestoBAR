// Configuración (B6.2): Negocio, Operación, Impresión, Seguridad y Marca y web.
// Barra fija «Tienes cambios sin guardar · Descartar · Guardar» y ayuda «?» en cada opción técnica.
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { useTema, type Tema } from "@/lib/tema";
import { bs, cx, fechaHora, leerMonto, mensajeError } from "@/lib/formato";
import { useConsulta } from "@/lib/datos";
import { subirFoto } from "@/lib/fotos";
import { abrirImpresion } from "@/lib/exportar";
import { ESTACIONES } from "@/lib/catalogo";
import type { NegocioConfig, ZonaEnvio } from "@/lib/tipos";
import { Button, Card, FormField, LogoIcono, Modal, PalabraLogo, Seg, Skeleton, Switch, useAvisar } from "@/components/ui";

const TABS: [string, string][] = [["negocio", "Negocio"], ["operacion", "Operación"], ["impresion", "Impresión"], ["seguridad", "Seguridad"], ["marca", "Marca y web"]];
const EDITABLES: (keyof NegocioConfig)[] = ["nombre", "lema", "logo_url", "whatsapp", "direccion", "ciudad", "nit", "horario", "hora_abre", "hora_cierra", "color",
  "propina_sugerida", "demora_min", "escalado_min", "envio", "comision_qr", "intentos_pin", "facturacion_activa", "qr_cobro_url"];

/* Preferencias de impresión de ESTE equipo (cada tablet o computadora imprime lo suyo) */
export type DestinoImpresion = "tickets" | "cocina" | "horno" | "parrilla" | "bebidas" | "postres";
const CLAVE_IMP = "restobar-impresion";
export function leerImpresion(): Record<DestinoImpresion, boolean> {
  try { return { tickets: true, cocina: false, horno: false, parrilla: false, bebidas: false, postres: false, ...JSON.parse(localStorage.getItem(CLAVE_IMP) || "{}") }; }
  catch { return { tickets: true, cocina: false, horno: false, parrilla: false, bebidas: false, postres: false }; }
}

export function Configuracion() {
  const { config, cargada } = useConfig();
  const avisar = useAvisar();
  const [tab, setTab] = useState("negocio");
  const original = () => Object.fromEntries(EDITABLES.map(k => [k, config[k]])) as Partial<NegocioConfig>;
  const [f, setF] = useState<Partial<NegocioConfig>>(original);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (cargada) setF(original()); }, [cargada]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambios = JSON.stringify(f) !== JSON.stringify(original());
  const up = <K extends keyof NegocioConfig>(k: K, v: NegocioConfig[K]) => setF(x => ({ ...x, [k]: v }));

  async function guardar() {
    if (!f.nombre?.trim()) { setTab("negocio"); return avisar("Escribe el nombre del negocio.", "bad"); }
    if (f.whatsapp && !/^\d{8,15}$/.test(f.whatsapp)) { setTab("negocio"); return avisar("El WhatsApp va solo con números y el código de país (591…).", "bad"); }
    setGuardando(true);
    const { error } = await supabase.from("negocio_config").update({ ...f, nombre: f.nombre.trim() }).eq("id", 1);
    setGuardando(false);
    if (error) avisar(mensajeError(error), "bad"); else avisar("Configuración guardada. El nombre y los datos se actualizaron en todo el sistema.");
  }
  if (!cargada) return <Skeleton h={360} r={12} />;
  return (
    <div className="flex flex-col gap-4 pb-20">
      <div role="tablist" className="sin-barra flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, t]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
          className={cx("min-h-11 whitespace-nowrap border-b-[3px] px-3.5 font-semibold", tab === k ? "border-accent text-brand-text" : "border-transparent text-ink-3")}>{t}</button>)}
      </div>
      {tab === "negocio" && <Negocio f={f} up={up} />}
      {tab === "operacion" && <Operacion f={f} up={up} />}
      {tab === "impresion" && <Impresion />}
      {tab === "seguridad" && <Seguridad f={f} up={up} />}
      {tab === "marca" && <Marca f={f} up={up} />}
      {cambios && (
        <div role="region" aria-label="Cambios sin guardar" className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2.5 rounded-md bg-ink py-2.5 pl-4 pr-3 text-bg shadow-2">
          <span className="flex-1 font-semibold">Tienes cambios sin guardar</span>
          <Button variant="ghost" className="!text-bg hover:!bg-white/10" onClick={() => setF(original())}>Descartar</Button>
          <Button variant="primary" loading={guardando} onClick={guardar}>Guardar</Button>
        </div>
      )}
    </div>
  );
}
type Props = { f: Partial<NegocioConfig>; up: <K extends keyof NegocioConfig>(k: K, v: NegocioConfig[K]) => void };

function Negocio({ f, up }: Props) {
  const avisar = useAvisar();
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  async function subir(x: File) {
    setSubiendo(true);
    try { up("logo_url", await subirFoto("marca", "logo", "logo", x, 1)); avisar("Logo listo. Toca «Guardar» para usarlo en todo el sistema."); }
    catch (e) { avisar(mensajeError(e), "bad"); } finally { setSubiendo(false); }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        {f.logo_url ? <img src={f.logo_url} alt="Logo" className="h-16 w-16 rounded-md bg-white object-contain p-1 shadow-1" /> : <LogoIcono tamano={64} />}
        <div className="flex-1"><strong className="font-display text-lg">{f.nombre}</strong><p className="text-sm text-ink-3">Vista previa del logo: va en el menú, los tickets, la tienda, la pantalla del cliente y el ícono de la pestaña.</p></div>
        <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const x = e.target.files?.[0]; if (x) subir(x); e.target.value = ""; }} />
        <Button icon={ImagePlus} loading={subiendo} onClick={() => archivo.current?.click()}>{f.logo_url ? "Cambiar logo" : "Subir logo"}</Button>
        {f.logo_url && <Button variant="ghost" icon={Trash2} onClick={() => up("logo_url", null)}>Usar el de fábrica</Button>}
      </div>
      <FormField id="cf-n" label="Nombre del negocio" hint="Se usa en títulos, tickets, pantalla del cliente y la pestaña del navegador"><input id="cf-n" value={f.nombre || ""} onChange={e => up("nombre", e.target.value)} /></FormField>
      <FormField id="cf-l" label="Eslogan (opcional)"><input id="cf-l" value={f.lema || ""} onChange={e => up("lema", e.target.value)} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cf-w" label="WhatsApp del negocio" ayuda="Solo números, con 591 delante. Lo usan la tienda y el botón de soporte."><input id="cf-w" inputMode="numeric" value={f.whatsapp || ""} onChange={e => up("whatsapp", e.target.value.replace(/\D/g, ""))} /></FormField>
        <FormField id="cf-nit" label="NIT" ayuda="Sale en los tickets y las facturas."><input id="cf-nit" inputMode="numeric" value={f.nit || ""} onChange={e => up("nit", e.target.value.replace(/\D/g, ""))} /></FormField>
      </div>
      <FormField id="cf-d" label="Dirección"><input id="cf-d" value={f.direccion || ""} onChange={e => up("direccion", e.target.value)} /></FormField>
      <FormField id="cf-c" label="Ciudad"><input id="cf-c" value={f.ciudad || ""} onChange={e => up("ciudad", e.target.value)} /></FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="cf-h" label="Horario (texto)" hint="Ej.: Lunes a domingo 10:00–23:30"><input id="cf-h" value={f.horario || ""} onChange={e => up("horario", e.target.value)} /></FormField>
        <FormField id="cf-ha" label="Abre a las" ayuda="La tienda online solo recibe pedidos dentro de este horario."><input id="cf-ha" type="time" value={(f.hora_abre || "").slice(0, 5)} onChange={e => up("hora_abre", e.target.value)} /></FormField>
        <FormField id="cf-hc" label="Cierra a las"><input id="cf-hc" type="time" value={(f.hora_cierra || "").slice(0, 5)} onChange={e => up("hora_cierra", e.target.value)} /></FormField>
      </div>
    </Card>
  );
}

function Operacion({ f, up }: Props) {
  const zonas = (f.envio || []) as ZonaEnvio[];
  const cambiarZona = (i: number, c: Partial<ZonaEnvio>) => up("envio", zonas.map((z, j) => j === i ? { ...z, ...c } : z));
  return (
    <Card>
      <FormField id="cf-p" label="Propina sugerida" ayuda="El cajero la ve elegida al cobrar; el cliente puede no darla."><Seg value={String(f.propina_sugerida ?? 10)} onChange={v => up("propina_sugerida", Number(v) as 0 | 5 | 10)} label="Propina sugerida" opciones={[["0", "No sugerir"], ["5", "5 %"], ["10", "10 %"]]} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cf-e" label="Escalar llamadas sin respuesta después de (min)" ayuda="Pasado este tiempo, la llamada aparece en Incidencias y en la campana."><input id="cf-e" type="number" min={1} max={60} value={f.escalado_min ?? 3} onChange={e => up("escalado_min", Number(e.target.value))} /></FormField>
        <FormField id="cf-m" label="Minutos para «demorado» en cocina" ayuda="El cronómetro de la comanda se pone rojo al pasar este tiempo."><input id="cf-m" type="number" min={5} max={120} value={f.demora_min ?? 20} onChange={e => up("demora_min", Number(e.target.value))} /></FormField>
      </div>
      <QrBanco f={f} up={up} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cf-q" label="Comisión del banco por QR (%)" ayuda="Se descuenta en Cobros QR para mostrar el neto a recibir."><input id="cf-q" inputMode="decimal" value={String(f.comision_qr ?? 0).replace(".", ",")} onChange={e => up("comision_qr", Math.min(10, leerMonto(e.target.value)))} /></FormField>
        <FormField id="cf-i" label="Idioma"><select id="cf-i" value="es" disabled><option value="es">Español (Bolivia)</option></select></FormField>
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">Zonas de delivery<span tabIndex={0} data-tip="La tienda online cobra el envío según la zona que elija el cliente." aria-label="La tienda online cobra el envío según la zona que elija el cliente." className="tip inline-grid h-5 w-5 cursor-help place-items-center rounded-full bg-surface-3 text-xs font-bold text-ink-2">?</span></span>
        {zonas.map((z, i) => (
          <div key={i} className="flex items-center gap-2">
            <input aria-label="Nombre de la zona" value={z.nombre} onChange={e => cambiarZona(i, { nombre: e.target.value })} placeholder="Ej.: Hasta el 4.º anillo" />
            <input aria-label="Costo de envío en Bs" className="!w-28" inputMode="decimal" value={String(z.costo).replace(".", ",")} onChange={e => cambiarZona(i, { costo: leerMonto(e.target.value) })} />
            <button type="button" aria-label={`Quitar la zona ${z.nombre}`} className="grid h-11 w-11 flex-none place-items-center text-ink-3 hover:text-bad" onClick={() => up("envio", zonas.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
          </div>
        ))}
        <Button variant="ghost" icon={Plus} className="self-start" onClick={() => up("envio", [...zonas, { id: "z" + Date.now().toString(36), nombre: "", costo: 10 }])}>Agregar zona</Button>
        {zonas.length > 0 && <p className="text-sm text-ink-3">{zonas.map(z => `${z.nombre || "Sin nombre"}: ${bs(z.costo)}`).join(" · ")}</p>}
      </div>
    </Card>
  );
}

function Impresion() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const [pref, setPref] = useState(leerImpresion);
  const guardar = (k: DestinoImpresion, v: boolean) => { const n = { ...pref, [k]: v }; setPref(n); try { localStorage.setItem(CLAVE_IMP, JSON.stringify(n)); } catch { /* nada */ } avisar("Guardado en este equipo"); };
  const destinos: [DestinoImpresion, string][] = [["tickets", "Tickets de venta"], ...ESTACIONES.map(([k, t]) => [k, `Comandas de ${t.toLowerCase()}`] as [DestinoImpresion, string])];
  function prueba(t: string) {
    abrirImpresion("Prueba de impresión", `<div class="ticket"><p class="c"><strong style="font-size:16px">${config.nombre}</strong><br>Prueba de impresión</p><hr><p>${t}<br>${fechaHora(Date.now())}</p><hr><p class="c">Si lees esto, la impresora funciona.</p></div>`, "80mm auto");
  }
  return (
    <Card>
      <p className="text-ink-2">Esto se guarda <strong>en este equipo</strong>: así la tablet de la caja imprime tickets y la de la parrilla, solo sus comandas. La impresora se elige en la ventana de impresión del navegador; elige la térmica y márcala como predeterminada.</p>
      {destinos.map(([k, t]) => (
        <div key={k} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <Switch id={"imp-" + k} label={`Imprimir ${t.toLowerCase()} en este equipo`} checked={pref[k]} onChange={v => guardar(k, v)} />
          <Button size="sm" icon={Printer} onClick={() => prueba(t)}>Imprimir prueba</Button>
        </div>
      ))}
    </Card>
  );
}

function Seguridad({ f, up }: Props) {
  const avisar = useAvisar();
  const [pin, setPin] = useState(false);
  const { datos: auditoria, cargando } = useConsulta<{ id: number; quien_nombre: string | null; accion: string; detalle: Record<string, unknown> | null; created_at: string }[]>("auditoria",
    () => supabase.from("auditoria").select("id, quien_nombre, accion, detalle, created_at").order("created_at", { ascending: false }).limit(20) as never, [], ["auditoria"]);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong>PIN de anulación</strong><p className="text-sm text-ink-3">Se pide para anular pedidos y facturas, y para reabrir la caja. Guárdalo solo para quien deba usarlo.</p></div>
          <Button onClick={() => setPin(true)}>Cambiar PIN</Button>
        </div>
        <FormField id="cf-int" label="Intentos antes del bloqueo" ayuda="Tras estos intentos fallidos seguidos, la ventana del PIN se bloquea 5 minutos en ese equipo.">
          <input id="cf-int" type="number" min={1} max={10} className="!w-28" value={f.intentos_pin ?? 3} onChange={e => up("intentos_pin", Number(e.target.value))} />
        </FormField>
      </Card>
      <Card>
        <h3 className="font-bold">Auditoría reciente</h3>
        {cargando ? <Skeleton h={120} /> : auditoria.length === 0 ? <p className="text-ink-3">Todavía no hay acciones registradas.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-[15px]"><tbody>
            {auditoria.map(a => <tr key={a.id} className="border-t border-line first:border-0"><td className="num whitespace-nowrap py-2 pr-3 text-ink-3">{fechaHora(a.created_at)}</td><td className="py-2 pr-3">{a.quien_nombre || "Sistema"}</td><td className="py-2">{a.accion}{a.detalle?.motivo ? <span className="text-ink-3"> · {String(a.detalle.motivo)}</span> : a.detalle?.antes != null ? <span className="text-ink-3"> · {bs(Number(a.detalle.antes))} → {bs(Number(a.detalle.despues))}</span> : null}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
      {pin && <NuevoPin onClose={() => setPin(false)} ok={() => avisar("PIN de anulación cambiado. Quedó registrado en la auditoría.")} />}
    </div>
  );
}
function NuevoPin({ onClose, ok }: { onClose: () => void; ok: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function guardar() {
    if (!/^\d{4}$/.test(a)) return setError("El PIN debe tener 4 números.");
    if (a !== b) return setError("Los dos PIN no coinciden.");
    if (a === "1234") return setError("Elige un PIN distinto al de ejemplo (1234).");
    setEnviando(true);
    const { error } = await supabase.rpc("cambiar_pin_anulacion", { p_pin: a });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    ok(); onClose();
  }
  return (
    <Modal titulo="Cambiar PIN de anulación" onClose={onClose} ancho={380} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={guardar}>Guardar</Button></>}>
      <FormField id="np-a" label="PIN nuevo"><input id="np-a" data-autofocus type="password" inputMode="numeric" maxLength={4} value={a} onChange={e => { setA(e.target.value.replace(/\D/g, "")); setError(""); }} /></FormField>
      <FormField id="np-b" label="Repite el PIN"><input id="np-b" type="password" inputMode="numeric" maxLength={4} value={b} onChange={e => { setB(e.target.value.replace(/\D/g, "")); setError(""); }} /></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

function Marca({ f, up }: Props) {
  const [tema, setTema] = useTema();
  const color = f.color || "#12402F";
  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="cf-col" label="Color de marca" hint="De fábrica: verde del monte #12402F. Cambia botones, menú lateral y títulos.">
          <span className="flex items-center gap-2"><input id="cf-col" type="color" className="h-11 w-16 cursor-pointer rounded-sm border border-line" value={color} onChange={e => up("color", e.target.value.toUpperCase())} /><code>{color}</code>
            {color.toUpperCase() !== "#12402F" && <Button size="sm" variant="ghost" onClick={() => up("color", "#12402F")}>Volver al de fábrica</Button>}</span>
        </FormField>
        <FormField id="cf-tema" label="Apariencia en este equipo" ayuda="Automática sigue al modo claro u oscuro del celular o la computadora.">
          <Seg<Tema> value={tema} onChange={setTema} label="Apariencia" opciones={[["auto", "Automática"], ["light", "Clara"], ["dark", "Oscura"]]} />
        </FormField>
      </div>
      <Switch id="cf-fact" label="Facturación activa" checked={!!f.facturacion_activa} onChange={v => up("facturacion_activa", v)} />
      <span className="text-sm font-semibold">Vista previa</span>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line p-4" style={{ ["--brand" as string]: color }}>
        <LogoIcono tamano={40} /><PalabraLogo />
        <span className="flex-1" />
        <span className="inline-flex min-h-11 items-center rounded-sm px-4 font-semibold text-white" style={{ background: color }}>Cobrar Bs 112,00</span>
      </div>
    </Card>
  );
}

// QR de cobro del banco: la imagen del QR fijo que da la app del banco (QR Simple).
// Se muestra en la caja, en la pantalla del cliente y al pagar en la tienda online.
function QrBanco({ f, up }: Props) {
  const avisar = useAvisar();
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  async function subir(x: File) {
    setSubiendo(true);
    try { up("qr_cobro_url", await subirFoto("marca", "qr", "qr-cobro", x, 1)); avisar("QR listo. Toca «Guardar» para usarlo en la caja y la tienda."); }
    catch (e) { avisar(mensajeError(e), "bad"); } finally { setSubiendo(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-line p-3">
      {f.qr_cobro_url ? <img src={f.qr_cobro_url} alt="QR de cobro del banco" className="h-28 w-28 rounded-sm bg-white object-contain p-1" />
        : <span className="grid h-28 w-28 place-items-center rounded-sm bg-surface-2 text-center text-xs text-ink-3">Sin QR del banco</span>}
      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <strong className="flex items-center gap-1.5 text-sm">QR de cobro del banco<span tabIndex={0} data-tip="En la app de tu banco, busca «Cobrar con QR» o «Mi QR», guarda la imagen y súbela aquí." aria-label="En la app de tu banco, busca «Cobrar con QR» o «Mi QR», guarda la imagen y súbela aquí." className="tip inline-grid h-5 w-5 cursor-help place-items-center rounded-full bg-surface-3 text-xs font-bold text-ink-2">?</span></strong>
        <p className="text-sm text-ink-3">Es el QR fijo de tu cuenta. El cliente escribe el monto que le muestra la caja o la tienda.</p>
        <span className="flex flex-wrap gap-2">
          <input ref={archivo} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) subir(x); e.target.value = ""; }} />
          <Button size="sm" loading={subiendo} onClick={() => archivo.current?.click()}>{f.qr_cobro_url ? "Cambiar QR" : "Subir QR del banco"}</Button>
          {f.qr_cobro_url && <Button size="sm" variant="ghost" onClick={() => up("qr_cobro_url", null)}>Quitar</Button>}
        </span>
      </div>
    </div>
  );
}
