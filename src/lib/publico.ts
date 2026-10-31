// Piezas de las vistas públicas (tienda, QR de mesa, llamar al mesero): menú visible, carrito y seguimiento del pedido.
import { useCallback, useEffect, useState } from "react";
import { supabase, idDispositivo } from "./supabase";
import { useConsulta } from "./datos";
import type { Banner, Categoria, NegocioConfig } from "./tipos";
import type { ProductoCompleto } from "./catalogo";

export function useMenuPublico() {
  const { datos: productos, cargando, error, recargar } = useConsulta<ProductoCompleto[]>("menu-publico",
    () => supabase.from("productos").select("id, codigo, nombre, nombre_en, descripcion, precio, categoria_id, estacion, foto_url, canales, favorito, agotado, en_menu, modificadores(id, nombre, orden)").eq("en_menu", true).order("nombre") as never, [], ["productos"]);
  const { datos: categorias } = useConsulta<Categoria[]>("categorias-publicas", () => supabase.from("categorias").select("*").eq("visible", true).order("orden") as never, [], ["categorias"]);
  const { datos: banners } = useConsulta<Banner[]>("banners-publicos", () => supabase.from("banners").select("*").eq("activo", true).order("orden") as never, [], ["banners"]);
  const visibles = productos.filter(p => !p.categoria_id || categorias.some(c => c.id === p.categoria_id));
  const nombreCat = (id: string | null) => categorias.find(c => c.id === id)?.nombre;
  return { productos: visibles, categorias: categorias.filter(c => visibles.some(p => p.categoria_id === c.id)), banners, nombreCat, cargando, error, recargar };
}

/** ¿Recibe pedidos ahora? Interruptor de la caja + horario de atención (hora de Bolivia del celular). */
export function estaAbierto(c: NegocioConfig, ahora = new Date()) {
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  const [ha, ma] = c.hora_abre.split(":").map(Number), [hc, mc] = c.hora_cierra.split(":").map(Number);
  return c.local_abierto && m >= ha * 60 + ma && m < hc * 60 + mc;
}

export interface ItemCarrito { producto_id: string; cantidad: number; nota: string }
/** Carrito guardado en este celular (no se pierde si se cierra la página) */
export function useCarrito(clave: string) {
  const k = "restobar-carrito-" + clave;
  const [items, setItems] = useState<ItemCarrito[]>(() => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(k, JSON.stringify(items)); } catch { /* nada */ } }, [k, items]);
  const sumar = useCallback((producto_id: string, d: number, nota = "") => setItems(ls => {
    const i = ls.findIndex(l => l.producto_id === producto_id && l.nota === nota);
    if (i < 0) return d > 0 ? [...ls, { producto_id, cantidad: d, nota }] : ls;
    return ls.map((l, j) => j === i ? { ...l, cantidad: Math.min(50, l.cantidad + d) } : l).filter(l => l.cantidad > 0);
  }), []);
  return { items, sumar, vaciar: () => setItems([]), cantidad: items.reduce((a, i) => a + i.cantidad, 0) };
}

export interface ResultadoPedido { id: string; numero: number; codigo: string; total: number }
export async function pedirPublico(args: {
  canal: "qr" | "web"; items: ItemCarrito[]; mesa_numero?: number; mesa_token?: string; cliente?: string; telefono?: string;
  direccion?: string; zona_envio?: string; recoger?: boolean;
}): Promise<ResultadoPedido> {
  const { data, error } = await supabase.rpc("crear_pedido_publico", {
    p_canal: args.canal, p_items: args.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, nota: i.nota || null })),
    p_dispositivo: idDispositivo(), p_mesa_numero: args.mesa_numero ?? null, p_mesa_token: args.mesa_token ?? null,
    p_cliente: args.cliente || null, p_telefono: args.telefono || null, p_direccion: args.direccion || null,
    p_zona_envio: args.zona_envio || null, p_recoger: !!args.recoger,
  });
  if (error) throw error;
  return data as ResultadoPedido;
}

export interface Seguimiento {
  numero: number; estado: string; delivery_estado: string | null; pagado: boolean; total: number;
  creado: string; enviado: string | null; preparando: string | null; listo: string | null; en_camino: string | null; entregado: string | null;
  items: { nombre: string; cantidad: number }[];
}
/** Estado del pedido para el cliente: se consulta cada 8 segundos (el público no recibe tiempo real de los pedidos) */
export function useSeguimiento(id: string | null, codigo: string | null) {
  const [s, setS] = useState<Seguimiento | null>(null), [error, setError] = useState<unknown>(null), [noExiste, setNoExiste] = useState(false);
  useEffect(() => {
    if (!id || !codigo) return;
    let vivo = true;
    const cargar = async () => {
      const { data, error } = await supabase.rpc("seguimiento_pedido", { p_pedido_id: id, p_codigo: codigo });
      if (!vivo) return;
      if (error) setError(error); else if (!data) setNoExiste(true); else { setS(data as Seguimiento); setError(null); }
    };
    cargar();
    const i = setInterval(cargar, 8000);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearInterval(i); document.removeEventListener("visibilitychange", alVolver); };
  }, [id, codigo]);
  return { s, error, noExiste };
}
