// Datos del catálogo y del inventario, con tiempo real y cálculos de costo y margen.
import { supabase } from "./supabase";
import { useConsulta } from "./datos";
import type { Categoria, Ingrediente, Modificador, Producto, Receta } from "./tipos";
import type { Tono } from "@/components/ui/estados";

export type ProductoCompleto = Producto & { modificadores: Modificador[]; recetas: Receta[] };

export const useProductos = () => useConsulta<ProductoCompleto[]>("productos-completos",
  () => supabase.from("productos").select("*, modificadores(*), recetas(*)").order("codigo") as never, [], ["productos", "modificadores", "recetas"]);
export const useCategorias = () => useConsulta<Categoria[]>("categorias",
  () => supabase.from("categorias").select("*").order("orden") as never, [], ["categorias"]);
export const useIngredientes = () => useConsulta<Ingrediente[]>("ingredientes",
  () => supabase.from("ingredientes").select("*").order("nombre") as never, [], ["ingredientes"]);

/** Costo por porción: suma de la receta. Sin receta, el costo aproximado guardado en el producto. */
export function costoDe(p: { costo: number; recetas?: Receta[] }, ingredientes: Ingrediente[]): number {
  if (!p.recetas?.length) return Number(p.costo || 0);
  return p.recetas.reduce((a, r) => a + Number(r.cantidad) * Number(ingredientes.find(i => i.id === r.ingrediente_id)?.costo_unitario || 0), 0);
}
export const margen = (precio: number, costo: number) => precio > 0 ? ((precio - costo) / precio) * 100 : 0;
/** Verde desde 60 %, ámbar entre 45 % y 60 %, rojo por debajo de 45 % */
export const tonoMargen = (m: number): Tono => m >= 60 ? "ok" : m >= 45 ? "warn" : "bad";

export function nivelStock(i: Ingrediente): [string, Tono] {
  if (Number(i.stock) < Number(i.minimo)) return ["Reponer ya", "bad"];
  if (Number(i.stock) < Number(i.minimo) * 1.3) return ["Bajo", "warn"];
  return ["Bien", "ok"];
}
export const cantidad = (n: number) => String(Math.round(Number(n) * 1000) / 1000).replace(".", ",");

export const ESTACIONES: [Producto["estacion"], string][] = [["cocina", "Cocina"], ["horno", "Horno"], ["parrilla", "Parrilla"], ["bebidas", "Bebidas"], ["postres", "Postres"]];

export async function siguienteCodigo(): Promise<string> {
  const { data } = await supabase.from("productos").select("codigo");
  const max = Math.max(0, ...(data || []).map(d => parseInt(String(d.codigo).slice(1)) || 0));
  return "P" + String(max + 1).padStart(2, "0");
}
