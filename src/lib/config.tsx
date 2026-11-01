import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, faltaConexion } from "./supabase";
import type { NegocioConfig } from "./tipos";

// Valores de respaldo mientras carga (o si todavía no se pegó el schema.sql)
const RESPALDO: NegocioConfig = {
  nombre: "PrestoBar", lema: "El mejor servicio", logo_url: null, whatsapp: null, direccion: null, ciudad: null, nit: null,
  horario: null, hora_abre: "10:00", hora_cierra: "23:30", moneda: "Bs", color: "#12402F", propina_sugerida: 10,
  demora_min: 20, escalado_min: 3, local_abierto: true, envio: [], facturacion_activa: true, facturacion_pruebas: true, comision_qr: 0, intentos_pin: 3, qr_cobro_url: null,
  crm_bs_por_punto: 10, crm_puntos_premio: 100, crm_premio: "Un plato fuerte gratis", crm_dias_riesgo: 30,
};

const Ctx = createContext<{ config: NegocioConfig; cargada: boolean }>({ config: RESPALDO, cargada: false });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<NegocioConfig>(RESPALDO);
  const [cargada, setCargada] = useState(false);
  useEffect(() => {
    if (faltaConexion) return;
    // «*»: si falta una columna nueva (schema.sql sin volver a ejecutar), la app sigue con el valor de fábrica
    supabase.from("negocio_config").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setConfig({ ...RESPALDO, ...(data as Partial<NegocioConfig>) } as NegocioConfig);
      setCargada(true);
    });
    // Tiempo real: si el Dueño cambia el nombre o el cajero cierra el local, se ve al instante
    const canal = supabase.channel("negocio_config")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "negocio_config" }, p => setConfig(c => ({ ...c, ...(p.new as Partial<NegocioConfig>) })))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);
  // Color de marca elegido en Configuración › Marca y web (el verde del monte es el de fábrica)
  useEffect(() => {
    const r = document.documentElement.style;
    if (!config.color || config.color.toUpperCase() === "#12402F") { ["--brand", "--brand-deep", "--brand-text", "--on-brand", "--lado"].forEach(v => r.removeProperty(v)); return; }
    const [R, G, B] = [1, 3, 5].map(i => parseInt(config.color.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const oscuro = (f: number) => "#" + [R, G, B].map(c => Math.round(c * 255 * f).toString(16).padStart(2, "0")).join("");
    r.setProperty("--brand", config.color); r.setProperty("--brand-deep", oscuro(0.8)); r.setProperty("--lado", oscuro(0.75));
    r.setProperty("--brand-text", lum > 0.45 ? oscuro(0.55) : config.color); r.setProperty("--on-brand", lum > 0.45 ? "#10241B" : "#FFFFFF");
  }, [config.color]);
  return <Ctx.Provider value={{ config, cargada }}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);

// Pestaña del navegador: «Nombre del negocio · Pantalla» (B10)
export function useTitulo(pantalla?: string) {
  const { config } = useConfig();
  useEffect(() => { document.title = pantalla ? `${config.nombre} · ${pantalla}` : config.nombre; }, [config.nombre, pantalla]);
}
