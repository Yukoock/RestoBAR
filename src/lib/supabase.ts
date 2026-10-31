import { createClient } from "@supabase/supabase-js";

// La conexión vive SOLO en el archivo .env (ver .env.example). Nunca se escribe la clave en el código.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const faltaConexion = !url || !clave || url.includes("tu-proyecto") || clave.includes("pega-aqui");

// Cuando este equipo guarda algo, avisa a sus pantallas para que se refresquen al instante,
// aunque el tiempo real de Supabase tarde o se corte un momento.
let avisoPendiente: ReturnType<typeof setTimeout> | undefined;
const fetchConAviso: typeof fetch = async (entrada, opciones) => {
  const res = await window.fetch(entrada, opciones);
  const metodo = (opciones?.method || "GET").toUpperCase();
  if (res.ok && metodo !== "GET" && metodo !== "HEAD" && /\/rest\/v1\//.test(String(entrada instanceof Request ? entrada.url : entrada))) {
    clearTimeout(avisoPendiente);
    avisoPendiente = setTimeout(() => window.dispatchEvent(new Event("restobar-cambio")), 150);
  }
  return res;
};

export const supabase = createClient(url || "http://localhost:54321", clave || "falta-la-clave", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "restobar-sesion" },
  global: { fetch: fetchConAviso },
});

// Identificador de este celular para la tienda y el QR de mesa (limita un pedido cada 20 s)
export function idDispositivo(): string {
  const k = "restobar-dispositivo";
  try {
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch {
    return "sin-almacenamiento-" + Math.random().toString(36).slice(2, 12);
  }
}
