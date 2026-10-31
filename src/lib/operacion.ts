// Piezas que comparten Cajero, Cocina, Mesero y Delivery: crear pedidos, cola sin conexión, sonido y pantalla del cliente.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useConsulta, pagado } from "./datos";
import { useCategorias, useProductos, type ProductoCompleto } from "./catalogo";
import type { Canal, Pedido } from "./tipos";

/* ---------- Productos para vender ---------- */
export function useMenuVenta(canal: "salon" | "mostrador" | "delivery" | "tienda") {
  const { datos: productos, cargando } = useProductos();
  const { datos: categorias } = useCategorias();
  const lista = useMemo(() => productos.filter(p => p.en_menu && p.canales?.[canal] !== false), [productos, canal]);
  const nombreCat = (id: string | null) => categorias.find(c => c.id === id)?.nombre;
  return { productos: lista, categorias: categorias.filter(c => lista.some(p => p.categoria_id === c.id)), nombreCat, cargando };
}
export interface Linea { producto_id: string; cantidad: number; nota: string }
export const totalLineas = (ls: Linea[], ps: ProductoCompleto[]) => ls.reduce((a, l) => a + l.cantidad * Number(ps.find(p => p.id === l.producto_id)?.precio || 0), 0);
export const cantidadLineas = (ls: Linea[]) => ls.reduce((a, l) => a + l.cantidad, 0);
export function sumarLinea(ls: Linea[], producto_id: string, d: number, nota = ""): Linea[] {
  const i = ls.findIndex(l => l.producto_id === producto_id && l.nota === nota);
  if (i < 0) return d > 0 ? [...ls, { producto_id, cantidad: d, nota }] : ls;
  return ls.map((l, j) => j === i ? { ...l, cantidad: l.cantidad + d } : l).filter(l => l.cantidad > 0);
}

/* ---------- Crear pedidos desde el personal ---------- */
export interface NuevoPedido {
  canal: Canal; lineas: Linea[]; mesa_id?: string | null; cliente?: string | null; telefono?: string | null;
  direccion?: string | null; envio?: number; mesero_id?: string | null; creado_por?: string | null;
}
/** Crea el pedido, o si la mesa ya tiene una cuenta abierta, le suma los productos. Devuelve el pedido. */
export async function enviarPedido(n: NuevoPedido): Promise<{ id: string; numero: number }> {
  let destino: { id: string; numero: number } | null = null;
  if (n.mesa_id) {
    const { data } = await supabase.from("pedidos").select("id, numero").eq("mesa_id", n.mesa_id).neq("estado", "anulado")
      .or("pago_metodo.is.null,pago_pendiente.eq.true").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) destino = data;
  }
  if (destino) {
    const { error } = await supabase.from("pedidos").update({ estado: "cocina", pidio_cuenta: false }).eq("id", destino.id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("pedidos").insert({
      canal: n.canal, mesa_id: n.mesa_id || null, cliente: n.cliente || null, telefono: n.telefono || null,
      direccion: n.canal === "delivery" ? n.direccion || null : null, envio: n.envio || 0, estado: "cocina",
      mesero_id: n.mesero_id || null, creado_por: n.creado_por || null, delivery_estado: n.canal === "delivery" ? "asignado" : null,
    }).select("id, numero").single();
    if (error) throw error;
    destino = data;
  }
  // Nombre y precio los pone la base de datos desde el producto (no se pueden cambiar desde aquí)
  const { error } = await supabase.from("pedido_items").insert(n.lineas.map(l => ({ pedido_id: destino!.id, producto_id: l.producto_id, cantidad: l.cantidad, nota: l.nota || null, nombre: null, precio_unitario: null })));
  if (error) throw error;
  return destino!;
}

export const esErrorDeRed = (e: unknown) => /failed to fetch|network|load failed|fetch/i.test(String((e as Error)?.message || e));

/* ---------- Cola sin conexión (Mesero, B6.5) ---------- */
const CLAVE_COLA = "restobar-cola-pedidos";
export interface Borrador extends NuevoPedido { id: string; creado: number; etiqueta: string }
export const leerCola = (): Borrador[] => { try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || "[]"); } catch { return []; } };
const guardarCola = (c: Borrador[]) => { try { localStorage.setItem(CLAVE_COLA, JSON.stringify(c)); } catch { /* sin espacio */ } window.dispatchEvent(new Event("restobar-cola")); };
export function encolar(n: NuevoPedido, etiqueta: string) { guardarCola([...leerCola(), { ...n, id: crypto.randomUUID(), creado: Date.now(), etiqueta }]); }
/** Reenvía los borradores guardados. Devuelve cuántos se enviaron. */
export async function vaciarCola(): Promise<number> {
  let enviados = 0;
  for (const b of leerCola()) {
    try { await enviarPedido(b); enviados++; guardarCola(leerCola().filter(x => x.id !== b.id)); }
    catch (e) { if (esErrorDeRed(e)) break; guardarCola(leerCola().filter(x => x.id !== b.id)); } // si el error no es de red, no se reintenta
  }
  return enviados;
}
export function useCola() {
  const [cola, setCola] = useState(leerCola);
  useEffect(() => { const f = () => setCola(leerCola()); window.addEventListener("restobar-cola", f); window.addEventListener("storage", f); return () => { window.removeEventListener("restobar-cola", f); window.removeEventListener("storage", f); }; }, []);
  return cola;
}

/* ---------- Sonido corto (el navegador solo deja sonar después de que la persona tocó algo) ---------- */
let ctx: AudioContext | null = null;
export function sonar(tipo: "aviso" | "gracias" | "llamada" = "aviso") {
  try {
    ctx = ctx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notas = tipo === "gracias" ? [660, 880, 1100] : tipo === "llamada" ? [990, 740, 990, 740] : [880, 660];
    notas.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(), t0 = ctx!.currentTime + i * 0.15;
      o.frequency.value = f; o.connect(g); g.connect(ctx!.destination);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.start(t0); o.stop(t0 + 0.15);
    });
  } catch { /* sin audio */ }
}

/* ---------- Pantalla del cliente (B6.9): la caja le avisa qué mostrar ---------- */
export interface MensajePantalla { pedidoId: string | null; fase: "espera" | "pedido" | "qr" | "pagado"; monto?: number }
const CANAL_PANTALLA = "restobar-pantalla";
let bc: BroadcastChannel | null = null;
export function enviarPantalla(m: MensajePantalla) {
  try { bc = bc || new BroadcastChannel(CANAL_PANTALLA); bc.postMessage(m); } catch { /* navegador sin BroadcastChannel */ }
  try { localStorage.setItem(CANAL_PANTALLA, JSON.stringify({ ...m, t: Date.now() })); } catch { /* nada */ }
}
export function usePantallaCaja(): MensajePantalla {
  const [m, setM] = useState<MensajePantalla>(() => { try { return JSON.parse(localStorage.getItem(CANAL_PANTALLA) || "") as MensajePantalla; } catch { return { pedidoId: null, fase: "espera" }; } });
  useEffect(() => {
    let c: BroadcastChannel | null = null;
    try { c = new BroadcastChannel(CANAL_PANTALLA); c.onmessage = e => setM(e.data); } catch { /* nada */ }
    const f = (e: StorageEvent) => { if (e.key === CANAL_PANTALLA && e.newValue) setM(JSON.parse(e.newValue)); };
    window.addEventListener("storage", f);
    return () => { c?.close(); window.removeEventListener("storage", f); };
  }, []);
  return m;
}

/* ---------- Caja abierta y cuánto debe haber ---------- */
export function useCajaAbierta() {
  const { datos: caja } = useConsulta<{ id: string; fondo: number; abierta_at: string } | null>("caja-abierta",
    () => supabase.from("caja_sesiones").select("id, fondo, abierta_at").is("cerrada_at", null).maybeSingle() as never, null, ["caja_sesiones"]);
  const { datos: cobrados } = useConsulta<Pick<Pedido, "pago_metodo" | "pago_pendiente" | "total" | "pago_efectivo">[]>("caja-efectivo-" + (caja?.id || ""),
    () => supabase.from("pedidos").select("pago_metodo, pago_pendiente, total, pago_efectivo").gte("pagado_at", caja?.abierta_at || new Date().toISOString()).neq("estado", "anulado") as never, [], ["pedidos"]);
  const { datos: movs } = useConsulta<{ tipo: string; monto: number }[]>("caja-movs-" + (caja?.id || ""),
    () => supabase.from("caja_movimientos").select("tipo, monto").eq("sesion_id", caja?.id || "00000000-0000-0000-0000-000000000000") as never, [], ["caja_movimientos"]);
  const efectivo = cobrados.filter(p => pagado(p as Pedido)).reduce((a, p) => a + (p.pago_metodo === "efectivo" ? Number(p.total) : p.pago_metodo === "mixto" ? Number(p.pago_efectivo || 0) : 0), 0);
  const debe = caja ? Number(caja.fondo) + efectivo + movs.reduce((a, m) => a + (m.tipo === "ingreso" ? 1 : -1) * Number(m.monto), 0) : 0;
  return { caja, debe };
}
