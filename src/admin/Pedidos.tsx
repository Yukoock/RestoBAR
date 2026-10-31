// Pedidos (B6.2): tabla con filtros por chip y Drawer con la línea de tiempo. El filtro y el pedido abierto van en la URL.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, FileText, Printer, Receipt, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { bs, hora, fecha } from "@/lib/formato";
import { usePedidos, useMesas, usePerfiles, inicioDelDia, etiquetaEstado, etiquetaPago, CANALES } from "@/lib/datos";
import { exportarTabla, imprimirTicket } from "@/lib/exportar";
import type { Pedido } from "@/lib/tipos";
import { DataTable, type Columna } from "@/components/DataTable";
import { DateRangePicker, PinDialog, useAvisar, type Periodo } from "@/components/ui";
import { CanalTag, EstadoBadge, PagoBadge, PedidoDrawer } from "./PedidoDrawer";

export function Pedidos() {
  const { config } = useConfig();
  const avisar = useAvisar();
  const [params, setParams] = useSearchParams();
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const desde = useMemo(() => inicioDelDia(periodo === "hoy" ? 0 : periodo === "7d" ? 6 : 29), [periodo]);
  const { datos: pedidos, cargando, error, recargar } = usePedidos(desde);
  const { datos: mesas } = useMesas();
  const { datos: perfiles } = usePerfiles();
  const [anularId, setAnularId] = useState<Pedido | null>(null);
  const numMesa = (p: Pedido) => mesas.find(m => m.id === p.mesa_id)?.numero;
  const abiertoId = params.get("pedido");
  const abierto = pedidos.find(p => p.id === abiertoId);
  // Si el pedido pedido por la URL es de otro día, se amplía el periodo para encontrarlo
  useEffect(() => { if (abiertoId && !cargando && !abierto && periodo !== "30d") setPeriodo("30d"); }, [abiertoId, cargando, abierto, periodo]);
  const abrir = (id: string | null) => setParams(prev => { const n = new URLSearchParams(prev); if (id) n.set("pedido", id); else n.delete("pedido"); return n; });

  const columnas: Columna<Pedido>[] = [
    { clave: "numero", titulo: "#", render: p => <strong className="num">#{p.numero}</strong>, texto: p => p.numero, orden: p => p.numero },
    { clave: "hora", titulo: "Hora", render: p => <span className="num">{periodo === "hoy" ? "" : fecha(p.created_at).slice(0, 5) + " "}{hora(p.created_at)}</span>, texto: p => `${fecha(p.created_at)} ${hora(p.created_at)}`, orden: p => p.created_at },
    { clave: "canal", titulo: "Mesa / canal", render: p => <CanalTag p={p} mesa={numMesa(p)} />, texto: p => numMesa(p) ? `Mesa ${numMesa(p)}` : CANALES[p.canal].nombre, orden: p => p.canal },
    { clave: "cliente", titulo: "Cliente", render: p => p.cliente || <span className="text-ink-3">—</span>, texto: p => p.cliente || "", orden: p => p.cliente || "" },
    { clave: "total", titulo: "Total", derecha: true, render: p => bs(p.total), texto: p => bs(p.total), orden: p => Number(p.total) },
    { clave: "pago", titulo: "Pago", render: p => <PagoBadge p={p} />, texto: p => etiquetaPago(p)[0], orden: p => etiquetaPago(p)[0] },
    { clave: "estado", titulo: "Estado", render: p => <EstadoBadge p={p} />, texto: p => etiquetaEstado(p)[0], orden: p => p.estado },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DateRangePicker value={periodo} onChange={setPeriodo} />
      <DataTable<Pedido> id="pedidos" titulo="Pedidos" filas={pedidos} clave={p => p.id} columnas={columnas} cargando={cargando} error={error} onReintentar={recargar}
        filtroInicial={params.get("filtro") || "todos"}
        filtros={[
          { id: "todos", titulo: "Todos", f: () => true },
          { id: "sin", titulo: "Sin cobrar", f: p => !p.pago_metodo && p.estado !== "anulado" },
          { id: "qr", titulo: "QR por validar", f: p => !!p.pago_metodo && p.pago_pendiente && p.estado !== "anulado" },
          { id: "cocina", titulo: "En cocina", f: p => p.estado === "cocina" || p.estado === "preparando" },
          { id: "anulados", titulo: "Anulados", f: p => p.estado === "anulado" },
        ]}
        buscar={p => `${p.numero} ${p.cliente || ""} ${numMesa(p) ? "mesa " + numMesa(p) : ""} ${CANALES[p.canal].nombre}`}
        onFila={p => abrir(p.id)}
        accion={{ titulo: "Ver", icon: Eye, onClick: p => abrir(p.id) }}
        menu={p => [
          { label: "Imprimir", icon: Printer, onClick: () => imprimirTicket(p, config, numMesa(p)) },
          config.facturacion_activa && p.estado !== "anulado" && { label: "Crear factura", icon: FileText, onClick: () => abrir(p.id) },
          "-",
          p.estado !== "anulado" && { label: "Anular", icon: Trash2, peligro: true, onClick: () => setAnularId(p) },
        ]}
        onExportar={(t, filas, cols) => exportarTabla(t, "Pedidos", filas, cols, config)}
        vacio={{ icon: Receipt, titulo: "Todavía no hay pedidos en este periodo", texto: "Cuando el cajero, un mesero o la tienda creen un pedido, aparece aquí al instante." }} />
      {abierto && <PedidoDrawer p={abierto} mesa={numMesa(abierto)} perfiles={perfiles} onClose={() => abrir(null)} />}
      {anularId && <PinDialog onClose={() => setAnularId(null)} onConfirm={async (pin, motivo) => {
        const { error } = await supabase.rpc("anular_pedido", { p_id: anularId.id, p_pin: pin, p_motivo: motivo });
        if (error) throw error;
        avisar(`Pedido #${anularId.numero} anulado. Quedó registrado en la auditoría.`);
      }} />}
    </div>
  );
}
