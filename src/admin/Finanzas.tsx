// Finanzas (B6.2): Cobros QR y Facturación.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Download, FileText, Mail, MessageCircle, Pause, Play, Receipt, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { bs, cx, fecha, hora, mensajeError } from "@/lib/formato";
import { useAhora } from "@/lib/hooks";
import { useConsulta, inicioDelDia } from "@/lib/datos";
import { abrirImpresion, exportarTabla } from "@/lib/exportar";
import type { Pedido } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, EmptyState, ErrorState, FormField, Modal, PinDialog, Skeleton, StatCard, Switch, useAvisar } from "@/components/ui";

/* ================= Cobros QR ================= */
type Cobro = Pick<Pedido, "id" | "numero" | "canal" | "cliente" | "total" | "pago_metodo" | "pago_pendiente" | "pago_efectivo" | "pagado_at" | "created_at" | "estado">;
export function CobrosQR() {
  const { config } = useConfig();
  const ahora = useAhora(1000);
  const [pausa, setPausa] = useState(false);
  const [cobros, setCobros] = useState<Cobro[]>([]), [cargando, setCargando] = useState(true), [error, setError] = useState<unknown>(null);
  const [ultima, setUltima] = useState(Date.now());
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("pedidos").select("id, numero, canal, cliente, total, pago_metodo, pago_pendiente, pago_efectivo, pagado_at, created_at, estado")
      .in("pago_metodo", ["qr", "mixto"]).neq("estado", "anulado").gte("created_at", inicioDelDia(29).toISOString()).order("created_at", { ascending: false });
    if (error) setError(error); else { setCobros((data || []) as Cobro[]); setError(null); }
    setCargando(false); setUltima(Date.now());
  }, []);
  // Se actualiza en tiempo real y además cada 15 s; «Pausar» congela la lista para revisarla con calma
  useEffect(() => {
    cargar();
    if (pausa) return;
    const i = setInterval(cargar, 15000);
    const canal = supabase.channel("rt-cobros-qr").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => cargar()).subscribe();
    return () => { clearInterval(i); supabase.removeChannel(canal); };
  }, [pausa, cargar]);
  const montoQR = (c: Cobro) => c.pago_metodo === "mixto" ? Number(c.total) - Number(c.pago_efectivo || 0) : Number(c.total);
  const r = useMemo(() => {
    const total = cobros.reduce((a, c) => a + montoQR(c), 0), comision = total * (Number(config.comision_qr) / 100);
    const dias = [...new Set(cobros.map(c => fecha(c.pagado_at || c.created_at)))];
    return { total, comision, neto: total - comision, exitosas: cobros.filter(c => !c.pago_pendiente).length, pendientes: cobros.filter(c => c.pago_pendiente).length, dias };
  }, [cobros, config.comision_qr]);
  const etiquetaDia = (d: string) => d === fecha(Date.now()) ? "Hoy" : d === fecha(Date.now() - 86400000) ? "Ayer" : d;
  if (error) return <Card><ErrorState error={error} onRetry={cargar} /></Card>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <i aria-hidden="true" className={cx("h-2.5 w-2.5 rounded-full", pausa ? "bg-ink-3" : "animate-pulse bg-ok")} />
          {pausa ? "En pausa" : `Actualizado hace ${Math.max(0, Math.floor((ahora - ultima) / 1000))} s`} · últimos 30 días
        </span>
        <Button variant="ghost" icon={pausa ? Play : Pause} onClick={() => setPausa(!pausa)}>{pausa ? "Reanudar" : "Pausar"}</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard cargando={cargando} label="Total cobrado" valor={bs(r.total)} />
        <StatCard cargando={cargando} label={`Comisión (${String(config.comision_qr).replace(".", ",")} %)`} valor={bs(r.comision)} />
        <StatCard cargando={cargando} label="Neto a recibir" valor={bs(r.neto)} />
        <StatCard cargando={cargando} label="Exitosas" valor={r.exitosas} />
        <StatCard cargando={cargando} label="Pendientes de abono" valor={r.pendientes} onClick={r.pendientes ? () => { location.href = "/admin/pedidos?filtro=qr"; } : undefined} />
      </div>
      {Number(config.comision_qr) === 0 && <p className="text-sm text-ink-3">Si tu banco cobra comisión por QR, escríbela en <Link to="/admin/configuracion" className="font-semibold text-brand-text underline">Configuración › Operación</Link>.</p>}
      {cargando ? <Skeleton h={220} r={12} /> : cobros.length === 0 ? <Card><EmptyState icon={Receipt} titulo="Todavía no hay cobros por QR" texto="Cuando la caja cobre con QR o un cliente pague la tienda con QR, aparece aquí." /></Card> : r.dias.map(d => {
        const del = cobros.filter(c => fecha(c.pagado_at || c.created_at) === d);
        return (
          <section key={d} className="overflow-hidden rounded-md bg-surface shadow-1" aria-label={etiquetaDia(d)}>
            <div className="flex flex-wrap justify-between gap-3 bg-surface-2 px-3.5 py-3 text-sm"><strong>{etiquetaDia(d)}</strong><span className="num">{del.length} cobros · subtotal <strong>{bs(del.reduce((a, c) => a + montoQR(c), 0))}</strong></span></div>
            <table className="w-full text-[15px]"><tbody>{del.map(c => (
              <tr key={c.id} className="border-t border-line">
                <td className="num w-16 px-3.5 py-2.5">{hora(c.pagado_at || c.created_at)}</td>
                <td className="px-2 py-2.5"><Link to={`/admin/pedidos?pedido=${c.id}`} className="font-semibold hover:underline">Pedido #{c.numero}</Link>{c.cliente && <span className="text-ink-3"> · {c.cliente}</span>}{c.pago_metodo === "mixto" && <span className="text-ink-3"> · parte por QR</span>}</td>
                <td className="px-2 py-2.5"><Badge tono={c.pago_pendiente ? "info" : "ok"} punto>{c.pago_pendiente ? "Pendiente de abono" : "Exitosa"}</Badge></td>
                <td className="num px-3.5 py-2.5 text-right">{bs(montoQR(c))}</td>
              </tr>
            ))}</tbody></table>
          </section>
        );
      })}
    </div>
  );
}

/* ================= Facturación ================= */
interface Factura { id: string; numero: number; pedido_id: string | null; razon_social: string; nit: string; total: number; cuf: string | null; estado: "Válida" | "Anulada"; motivo_anulacion: string | null; ambiente_pruebas: boolean; created_at: string }
export function Facturacion() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const { datos: facturas, cargando, error, recargar } = useConsulta<Factura[]>("facturas", () => supabase.from("facturas").select("*").order("numero", { ascending: false }) as never, [], ["facturas"]);
  const [anular, setAnular] = useState<Factura | null>(null), [reenviar, setReenviar] = useState<Factura | null>(null);
  async function cambiar(campo: "facturacion_pruebas" | "facturacion_activa", v: boolean) {
    const { error } = await supabase.from("negocio_config").update({ [campo]: v }).eq("id", 1);
    if (error) avisar(mensajeError(error), "bad"); else avisar(campo === "facturacion_pruebas" ? (v ? "Ambiente de pruebas activado: las facturas nuevas van marcadas «PRUEBAS»" : "Ambiente de pruebas desactivado") : v ? "Facturación activada" : "Facturación desactivada");
  }
  function pdf(f: Factura) {
    abrirImpresion(`Factura ${f.numero}`, `<div style="max-width:640px">${f.ambiente_pruebas ? `<p style="background:#9A6210;color:#fff;font-weight:800;letter-spacing:.14em;text-align:center;padding:6px">PRUEBAS · SIN VALOR FISCAL</p>` : ""}
      <h1>${config.nombre}</h1><p class="muted">${config.direccion || ""} · ${config.ciudad || ""}<br>NIT ${config.nit || "—"}</p>
      <h1 style="margin-top:16px">FACTURA N.º ${f.numero}</h1>${f.estado === "Anulada" ? `<p style="color:#B42318;font-weight:800">ANULADA · ${f.motivo_anulacion || ""}</p>` : ""}
      <table><tr><th>Fecha</th><td>${fecha(f.created_at)} ${hora(f.created_at)}</td></tr><tr><th>Razón social</th><td>${f.razon_social}</td></tr><tr><th>NIT/CI</th><td>${f.nit}</td></tr>
      <tr><th>CUF</th><td>${f.cuf || "Sin conexión con Impuestos (fuera del alcance del curso)"}</td></tr><tr class="tot"><td>TOTAL</td><td class="der">${bs(f.total)}</td></tr></table></div>`);
  }
  if (!config.facturacion_activa) return (
    <Card><EmptyState icon={FileText} titulo="La facturación está desactivada" texto="Actívala para crear facturas desde los pedidos." accion={{ label: "Activar facturación", onClick: () => cambiar("facturacion_activa", true) }} /></Card>
  );
  return (
    <div className="relative flex flex-col gap-4">
      {config.facturacion_pruebas && <div aria-label="Ambiente de pruebas" className="pointer-events-none fixed -right-12 top-7 z-30 rotate-45 bg-warn px-14 py-1.5 text-[13px] font-extrabold tracking-[.14em] text-white shadow-1">PRUEBAS</div>}
      <Card className="!flex-row flex-wrap items-center justify-between">
        <div className="flex items-center gap-3"><span className="h-3 w-3 flex-none rounded-full bg-ok" aria-hidden="true" /><div><strong>Registro de facturas activo</strong><p className="text-sm text-ink-3">Las facturas se guardan con su PDF. La conexión directa con Impuestos queda fuera de este curso.</p></div></div>
        <Switch id="fact-pruebas" label="Ambiente de pruebas" checked={config.facturacion_pruebas} onChange={v => cambiar("facturacion_pruebas", v)} />
      </Card>
      <DataTable<Factura> id="facturas" titulo="Facturas" filas={facturas} clave={f => f.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={f => `${f.numero} ${f.razon_social} ${f.nit}`}
        filtros={[{ id: "todas", titulo: "Todas", f: () => true }, { id: "validas", titulo: "Válidas", f: f => f.estado === "Válida" }, { id: "anuladas", titulo: "Anuladas", f: f => f.estado === "Anulada" }, { id: "pruebas", titulo: "De prueba", f: f => f.ambiente_pruebas }]}
        columnas={[
          { clave: "numero", titulo: "N.º", render: f => <strong className="num">{f.numero}</strong>, texto: f => f.numero, orden: f => f.numero },
          { clave: "fecha", titulo: "Fecha", texto: f => fecha(f.created_at), orden: f => f.created_at },
          { clave: "razon", titulo: "Razón social", texto: f => f.razon_social, orden: f => f.razon_social },
          { clave: "nit", titulo: "NIT/CI", texto: f => f.nit },
          { clave: "total", titulo: "Total", derecha: true, texto: f => bs(f.total), orden: f => Number(f.total) },
          { clave: "cuf", titulo: "CUF", render: f => f.cuf ? <span className="flex items-center gap-1"><code className="text-sm">{f.cuf.slice(0, 6)}…{f.cuf.slice(-4)}</code>
            <button type="button" aria-label="Copiar CUF" data-tip="Copiar CUF" className="tip grid h-9 w-9 place-items-center" onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(f.cuf!); avisar("CUF copiado"); } catch { avisar("No se pudo copiar", "bad"); } }}><Copy size={16} /></button></span>
            : <span className="text-ink-3">—</span>, texto: f => f.cuf || "" },
          { clave: "estado", titulo: "Estado", render: f => <span className="flex gap-1.5"><Badge tono={f.estado === "Válida" ? "ok" : "bad"} punto>{f.estado}</Badge>{f.ambiente_pruebas && <Badge tono="warn">Prueba</Badge>}</span>, texto: f => f.estado },
        ]}
        accion={{ titulo: "Ver PDF", icon: FileText, onClick: pdf }}
        menu={f => [
          { label: "Descargar", icon: Download, onClick: () => pdf(f) },
          { label: "Reenviar por WhatsApp o correo", icon: MessageCircle, onClick: () => setReenviar(f) },
          "-",
          f.estado === "Válida" && { label: "Anular", icon: Trash2, peligro: true, onClick: () => setAnular(f) },
        ]}
        onExportar={(t, fs, c) => exportarTabla(t, "Facturas", fs, c, config)}
        vacio={{ icon: FileText, titulo: "Todavía no hay facturas", texto: "Créalas desde Pedidos: abre un pedido y toca «Crear factura»." }} />
      <p className="text-sm text-ink-3">«Descargar»: en la ventana de impresión elige «Guardar como PDF».</p>
      {anular && <PinDialog titulo="Anular factura" onClose={() => setAnular(null)} onConfirm={async (pin, motivo) => {
        const { error } = await supabase.rpc("anular_factura", { p_id: anular.id, p_pin: pin, p_motivo: motivo });
        if (error) throw error;
        avisar(`Factura ${anular.numero} anulada`);
      }} />}
      {reenviar && <Reenviar f={reenviar} nombre={config.nombre} onClose={() => setReenviar(null)} />}
    </div>
  );
}
function Reenviar({ f, nombre, onClose }: { f: Factura; nombre: string; onClose: () => void }) {
  const [tel, setTel] = useState(""), [correo, setCorreo] = useState("");
  const texto = `Hola ${f.razon_social}, te enviamos tu factura N.º ${f.numero} de ${nombre} por ${bs(f.total)}. ¡Gracias por tu visita!`;
  return (
    <Modal titulo={`Reenviar factura ${f.numero}`} onClose={onClose} ancho={460}>
      <p className="text-sm text-ink-3">Primero descarga el PDF; luego adjúntalo en el chat o en el correo.</p>
      <FormField id="rf-t" label="WhatsApp del cliente" hint="Solo números, con 591 delante"><input id="rf-t" data-autofocus inputMode="numeric" value={tel} onChange={e => setTel(e.target.value.replace(/\D/g, ""))} /></FormField>
      <a className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#1E8A4C] px-4 font-semibold text-white", tel.length < 8 && "pointer-events-none opacity-50")} href={`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><MessageCircle size={18} />Abrir WhatsApp</a>
      <FormField id="rf-c" label="Correo del cliente"><input id="rf-c" type="email" value={correo} onChange={e => setCorreo(e.target.value)} /></FormField>
      <a className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line px-4 font-semibold", !/^\S+@\S+\.\S+$/.test(correo) && "pointer-events-none opacity-50")} href={`mailto:${correo}?subject=${encodeURIComponent(`Factura ${f.numero} · ${nombre}`)}&body=${encodeURIComponent(texto)}`}><Mail size={18} />Abrir el correo</a>
    </Modal>
  );
}
