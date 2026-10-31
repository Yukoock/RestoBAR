// Lectura de datos con tiempo real (B7): cuando cambia un pedido, una llamada o una mesa, todas las pantallas se actualizan solas.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bike, Globe, QrCode, ShoppingBag, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { supabase } from "./supabase";
import type { Canal, Llamada, Mesa, Pedido, Perfil } from "./tipos";
import type { Tono } from "@/components/ui/estados";

interface Estado<T> { datos: T; cargando: boolean; error: unknown; recargar: () => void }

/** Carga una consulta y la vuelve a pedir cuando cambian las tablas indicadas (con 300 ms de espera para agrupar cambios). */
export function useConsulta<T>(clave: string, cargar: () => PromiseLike<{ data: T | null; error: unknown }>, inicial: T, tablas: string[] = []): Estado<T> {
  const [datos, setDatos] = useState<T>(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const ref = useRef(cargar); ref.current = cargar;
  const recargar = useCallback(() => {
    ref.current().then(({ data, error }) => { if (error) setError(error); else { setDatos((data ?? inicial) as T); setError(null); } setCargando(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCargando(true); recargar();
    if (!tablas.length) return;
    let t: ReturnType<typeof setTimeout>;
    const pedir = () => { clearTimeout(t); t = setTimeout(recargar, 300); };
    const canal = supabase.channel(`rt-${clave}-${Math.random().toString(36).slice(2, 8)}`);
    tablas.forEach(tabla => canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, pedir));
    canal.subscribe();
    // Cambios hechos desde este mismo equipo (ver lib/supabase.ts) y al volver a la pestaña o a la red
    const alVolver = () => { if (document.visibilityState === "visible") pedir(); };
    window.addEventListener("restobar-cambio", pedir); window.addEventListener("online", pedir); document.addEventListener("visibilitychange", alVolver);
    return () => { clearTimeout(t); supabase.removeChannel(canal); window.removeEventListener("restobar-cambio", pedir); window.removeEventListener("online", pedir); document.removeEventListener("visibilitychange", alVolver); };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return { datos, cargando, error, recargar };
}

export const inicioDelDia = (diasAtras = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - diasAtras); return d; };

const COLS_PEDIDO = "*, pedido_items(id, pedido_id, producto_id, nombre, precio_unitario, cantidad, nota, estacion)";
export function usePedidos(desde: Date) {
  const iso = desde.toISOString();
  return useConsulta<Pedido[]>("pedidos-" + iso, () => supabase.from("pedidos").select(COLS_PEDIDO).gte("created_at", iso).order("created_at", { ascending: false }).limit(2000) as never, [], ["pedidos", "pedido_items"]);
}
/** Pedidos que siguen abiertos (sin importar el día) para el estado de las mesas */
export function usePedidosAbiertos() {
  return useConsulta<Pedido[]>("abiertos", () => supabase.from("pedidos").select(COLS_PEDIDO).neq("estado", "anulado").or("pago_metodo.is.null,pago_pendiente.eq.true").order("created_at") as never, [], ["pedidos", "pedido_items"]);
}
export function useMesas() {
  return useConsulta<Mesa[]>("mesas", () => supabase.from("mesas").select("*").order("numero") as never, [], ["mesas"]);
}
export function useLlamadasActivas() {
  return useConsulta<Llamada[]>("llamadas", () => supabase.from("llamadas").select("*").is("atendida_at", null).eq("cancelada", false).order("created_at") as never, [], ["llamadas"]);
}
export function usePerfiles() {
  return useConsulta<Perfil[]>("perfiles", () => supabase.from("perfiles").select("id, nombre, correo, rol, zona, activo").order("nombre") as never, [], ["perfiles"]);
}

/* ---------- Reglas de B7: etiquetas y estado de las mesas ---------- */
export const pagado = (p: Pedido) => !!p.pago_metodo && !p.pago_pendiente;
export const abierto = (p: Pedido) => p.estado !== "anulado" && !pagado(p);

export const CANALES: Record<Canal, { nombre: string; color: string; icono: LucideIcon }> = {
  mesa: { nombre: "Mesa", color: "var(--r-mesero)", icono: UtensilsCrossed },
  qr: { nombre: "QR de mesa", color: "var(--r-cliente)", icono: QrCode },
  mostrador: { nombre: "Mostrador", color: "var(--r-cajero)", icono: Store },
  llevar: { nombre: "Para llevar", color: "var(--r-cocina)", icono: ShoppingBag },
  delivery: { nombre: "Delivery", color: "var(--r-delivery)", icono: Bike },
  web: { nombre: "Tienda online", color: "var(--r-tienda)", icono: Globe },
};
export const METODOS: Record<string, string> = { efectivo: "Efectivo", qr: "QR Simple", tarjeta: "Tarjeta", mixto: "Mixto" };
const NOMBRE_ESTADO = { borrador: "Borrador", cocina: "Enviado a cocina", preparando: "En preparación", listo: "Listo", entregado: "Entregado", anulado: "Anulado" };

export function etiquetaEstado(p: Pedido): [string, Tono] {
  if (p.estado === "anulado") return ["Anulado", "bad"];
  if (p.estado === "entregado" && pagado(p)) return ["Pagado", "ok"];
  return [NOMBRE_ESTADO[p.estado], p.estado === "listo" ? "ok" : p.estado === "entregado" ? "neutral" : "warn"];
}
export function etiquetaPago(p: Pedido): [string, Tono] {
  if (!p.pago_metodo) return ["Sin cobrar", "warn"];
  if (p.pago_pendiente) return ["QR por validar", "info"];
  return [METODOS[p.pago_metodo], "ok"];
}
export type EstadoMesa = "libre" | "ocupada" | "cuenta" | "llamando";
export function estadoMesa(mesaId: string, abiertos: Pedido[], llamadas: Llamada[]): EstadoMesa {
  if (llamadas.some(l => l.mesa_id === mesaId)) return "llamando";
  const p = abiertos.find(x => x.mesa_id === mesaId);
  if (p?.pidio_cuenta) return "cuenta";
  return p ? "ocupada" : "libre";
}
export const ESTADO_MESA: Record<EstadoMesa, { nombre: string; tono: Tono }> = {
  libre: { nombre: "Libre", tono: "ok" }, ocupada: { nombre: "Ocupada", tono: "warn" }, cuenta: { nombre: "Pidió la cuenta", tono: "bad" }, llamando: { nombre: "Llamando", tono: "info" },
};
