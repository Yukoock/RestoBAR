// Detalle de un pedido (B6.2 Pedidos): datos, productos con notas, línea de tiempo y acciones.
import { useState } from "react";
import { AlertTriangle, Check, FileText, Printer, QrCode, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { bs, fechaHora, hora, mensajeError } from "@/lib/formato";
import { CANALES, etiquetaEstado, etiquetaPago } from "@/lib/datos";
import { imprimirTicket } from "@/lib/exportar";
import type { Pedido, Perfil } from "@/lib/tipos";
import { Badge, Button, Drawer, FormField, Modal, PinDialog, RolTag, useAvisar } from "@/components/ui";

export function EstadoBadge({ p }: { p: Pedido }) {
  const [t, tono] = etiquetaEstado(p);
  return <Badge tono={tono} icon={p.estado === "anulado" ? X : t === "Pagado" ? Check : undefined} punto={p.estado !== "anulado" && t !== "Pagado"}>{t}</Badge>;
}
export function PagoBadge({ p }: { p: Pedido }) {
  const [t, tono] = etiquetaPago(p);
  return <Badge tono={tono} punto>{t}</Badge>;
}
export function CanalTag({ p, mesa }: { p: Pedido; mesa?: number }) {
  const c = CANALES[p.canal];
  return <RolTag color={c.color} icon={c.icono}>{(p.canal === "mesa" || p.canal === "qr") && mesa ? `Mesa ${mesa}` : c.nombre}</RolTag>;
}

export function PedidoDrawer({ p, mesa, perfiles, onClose }: { p: Pedido; mesa?: number; perfiles: Perfil[]; onClose: () => void }) {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [anular, setAnular] = useState(false), [factura, setFactura] = useState(false);
  const nombre = (id: string | null) => perfiles.find(x => x.id === id)?.nombre;
  const delivery = !!p.delivery_estado;
  const dur = (a: string | null, b: string | null) => a && b ? ` · tardó ${Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))} min` : "";
  const pasos: [string, string | null, string][] = [
    ["creado", p.created_at, `Creado${nombre(p.creado_por) ? " por " + nombre(p.creado_por) : p.canal === "web" || p.canal === "qr" ? " por el cliente" : ""}`],
    ["cocina", p.enviado_at, "Enviado a cocina"],
    ["preparando", p.preparando_at, "En preparación"],
    ["listo", p.listo_at, "Listo" + dur(p.enviado_at, p.listo_at)],
    ["entregado", p.entregado_at, "Entregado"],
    ["pagado", p.pagado_at, "Pagado"],
  ];
  async function validarQR() {
    const { error } = await supabase.from("pedidos").update({ pago_pendiente: false }).eq("id", p.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar(`Cobro QR del pedido #${p.numero} validado`);
  }
  return (
    <Drawer titulo={`Pedido #${p.numero}`} sub={`${mesa ? `Mesa ${mesa}` : CANALES[p.canal].nombre} · ${fechaHora(p.created_at)}`} onClose={onClose}
      pie={<>
        {p.estado !== "anulado" && <Button variant="danger" icon={Trash2} onClick={() => setAnular(true)}>Anular</Button>}
        <span className="flex-1" />
        {config.facturacion_activa && p.estado !== "anulado" && <Button icon={FileText} onClick={() => setFactura(true)}>Crear factura</Button>}
        <Button variant="primary" icon={Printer} onClick={() => imprimirTicket(p, config, mesa)}>Imprimir</Button>
      </>}>
      {delivery && !p.direccion && (
        <div className="flex items-center gap-3 rounded-md bg-bad-soft px-3.5 py-3 text-bad"><AlertTriangle size={20} /><div><strong>Faltan datos: dirección</strong><p className="text-sm">Llama al cliente{p.telefono ? ` al ${p.telefono}` : ""} antes de enviarlo a reparto.</p></div></div>
      )}
      {p.pago_metodo && p.pago_pendiente && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-info-soft px-3.5 py-3 text-info">
          <QrCode size={20} /><div className="flex-1"><strong>QR por validar</strong><p className="text-sm">Confirma cuando el abono aparezca en el banco.</p></div>
          <Button variant="primary" onClick={validarQR}>Validar</Button>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Canal</dt><dd><CanalTag p={p} mesa={mesa} /></dd></div>
        <div className="flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Estado</dt><dd><EstadoBadge p={p} /></dd></div>
        <div className="flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Pago</dt><dd><PagoBadge p={p} /></dd></div>
        {p.cliente && <div className="flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Cliente</dt><dd>{p.cliente}{p.telefono && <span className="text-ink-3"> · {p.telefono}</span>}</dd></div>}
        {p.mesero_id && <div className="flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Mesero</dt><dd>{nombre(p.mesero_id) || "—"}</dd></div>}
        {delivery && <div className="col-span-2 flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Dirección</dt><dd>{p.direccion || <span className="text-bad">Sin dirección</span>}</dd></div>}
        {p.motivo_anulacion && <div className="col-span-2 flex flex-col gap-1"><dt className="text-[13px] text-ink-3">Motivo de anulación</dt><dd>{p.motivo_anulacion}</dd></div>}
      </dl>
      <h3 className="mt-2 text-sm font-bold text-ink-3">Productos</h3>
      <ul className="flex flex-col">
        {(p.pedido_items || []).map(i => (
          <li key={i.id} className="grid grid-cols-[40px_1fr_auto] items-baseline gap-2 border-b border-dashed border-line py-2">
            <span className="num">{i.cantidad} ×</span>
            <span>{i.nombre}{i.nota && <em className="block text-[13px] font-semibold not-italic text-accent-deep">{i.nota}</em>}</span>
            <span className="num">{bs(i.cantidad * Number(i.precio_unitario))}</span>
          </li>
        ))}
        {Number(p.envio) > 0 && <li className="grid grid-cols-[40px_1fr_auto] gap-2 border-b border-dashed border-line py-2"><span /><span>Envío</span><span className="num">{bs(p.envio)}</span></li>}
        {Number(p.propina) > 0 && <li className="grid grid-cols-[40px_1fr_auto] gap-2 border-b border-dashed border-line py-2"><span /><span>Propina</span><span className="num">{bs(p.propina)}</span></li>}
        <li className="grid grid-cols-[40px_1fr_auto] gap-2 py-2 text-lg font-bold"><span /><span>Total</span><span className="num">{bs(p.total)}</span></li>
      </ul>
      <h3 className="mt-2 text-sm font-bold text-ink-3">Línea de tiempo</h3>
      <ol className="flex flex-col">
        {pasos.map(([k, t, texto]) => (
          <li key={k} className={`grid grid-cols-[24px_1fr_auto] items-center gap-2.5 py-2 ${t ? "text-ink" : "text-ink-3"}`}>
            <i aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full border-2 ${t ? "border-ok bg-ok text-white" : "border-line bg-surface"}`}>{t && <Check size={12} strokeWidth={3} />}</i>
            <span>{texto}</span><span className="num text-ink-3">{t ? hora(t) : "—"}</span>
          </li>
        ))}
        {p.estado === "anulado" && (
          <li className="grid grid-cols-[24px_1fr_auto] items-center gap-2.5 py-2">
            <i aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-bad text-white"><X size={12} strokeWidth={3} /></i>
            <span>Anulado</span><span className="num text-ink-3">{p.anulado_at ? hora(p.anulado_at) : ""}</span>
          </li>
        )}
      </ol>
      {anular && <PinDialog onClose={() => setAnular(false)} onConfirm={async (pin, motivo) => {
        const { error } = await supabase.rpc("anular_pedido", { p_id: p.id, p_pin: pin, p_motivo: motivo });
        if (error) throw error;
        avisar(`Pedido #${p.numero} anulado. Quedó registrado en la auditoría.`);
      }} />}
      {factura && <CrearFactura p={p} creadoPor={perfil?.id} pruebas={config.facturacion_pruebas} onClose={() => setFactura(false)} />}
    </Drawer>
  );
}

function CrearFactura({ p, creadoPor, pruebas, onClose }: { p: Pedido; creadoPor?: string; pruebas: boolean; onClose: () => void }) {
  const avisar = useAvisar();
  const [razon, setRazon] = useState(p.cliente || ""), [nit, setNit] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function crear() {
    if (razon.trim().length < 2) return setError("Escribe la razón social o el nombre.");
    if (!/^\d{5,15}$/.test(nit.trim())) return setError("Escribe el NIT o CI: solo números.");
    setEnviando(true);
    const { data, error } = await supabase.from("facturas").insert({ pedido_id: p.id, razon_social: razon.trim(), nit: nit.trim(), total: p.total, ambiente_pruebas: pruebas, creado_por: creadoPor }).select("numero").single();
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    avisar(`Factura ${data.numero} creada para el pedido #${p.numero}${pruebas ? " (ambiente de pruebas)" : ""}`);
    onClose();
  }
  return (
    <Modal titulo={`Factura del pedido #${p.numero}`} onClose={onClose} ancho={440}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={crear}>Crear factura · {bs(p.total)}</Button></>}>
      <FormField id="f-razon" label="Razón social o nombre"><input id="f-razon" data-autofocus value={razon} onChange={e => { setRazon(e.target.value); setError(""); }} /></FormField>
      <FormField id="f-nit" label="NIT o CI"><input id="f-nit" inputMode="numeric" value={nit} onChange={e => { setNit(e.target.value.replace(/\D/g, "")); setError(""); }} /></FormField>
      {pruebas && <p className="text-sm text-warn">Ambiente de pruebas: la factura se guarda marcada como «PRUEBAS».</p>}
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
