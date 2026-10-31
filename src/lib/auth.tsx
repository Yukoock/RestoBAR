import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, faltaConexion } from "./supabase";
import type { Perfil, Rol } from "./tipos";

// Pantallas que se pueden dar o quitar a cada rol (tabla permisos_rol). El Dueño siempre tiene todo.
export type PermisoAdmin = "Mesas" | "Cierre de caja" | "Reportes" | "Clientes";
export type Pantalla = "Cajero" | "Cocina" | "Mesero" | "Delivery" | PermisoAdmin | "Usuarios y ajustes" | "Administración";
/** Permisos que abren Administración a un rol (cada uno con sus pantallas) */
export const PERMISOS_ADMIN: PermisoAdmin[] = ["Mesas", "Cierre de caja", "Reportes", "Clientes"];

interface Auth {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  permisos: string[];
  puede: (p: Pantalla) => boolean;
  salir: () => Promise<void>;
  recargar: () => Promise<void>;
}
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(!faltaConexion);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); setPermisos([]); setCargando(false); return; }
    const { data } = await supabase.from("perfiles").select("id, nombre, correo, rol, zona, activo").eq("id", s.user.id).maybeSingle();
    setPerfil((data as Perfil) || null);
    if (data && data.rol !== "dueno") {
      const { data: ps } = await supabase.from("permisos_rol").select("pantalla").eq("rol", data.rol).eq("permitido", true);
      setPermisos((ps || []).map(p => p.pantalla as string));
    } else setPermisos([]);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (faltaConexion) return;
    supabase.auth.getSession().then(({ data }) => { setSesion(data.session); cargarPerfil(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      // No llamar a Supabase dentro del aviso: se agenda para después (recomendación de supabase-js)
      setTimeout(() => cargarPerfil(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarPerfil]);

  const puede = useCallback((p: Pantalla) => {
    if (!perfil || !perfil.activo) return false;
    if (perfil.rol === "dueno") return true;
    if (p === "Usuarios y ajustes") return false; // catálogo, inventario, usuarios y configuración: solo el Dueño
    if (p === "Administración") return PERMISOS_ADMIN.some(x => permisos.includes(x));
    return permisos.includes(p);
  }, [perfil, permisos]);

  const valor: Auth = {
    cargando, sesion, perfil, permisos, puede,
    salir: async () => { await supabase.auth.signOut(); },
    recargar: async () => { const { data } = await supabase.auth.getSession(); await cargarPerfil(data.session); },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return v;
}

export const NOMBRE_ROL: Record<Rol, string> = { dueno: "Dueño", cajero: "Cajero", cocina: "Cocina", mesero: "Mesero", repartidor: "Repartidor" };
export const COLOR_ROL: Record<Rol, string> = { dueno: "var(--r-admin)", cajero: "var(--r-cajero)", cocina: "var(--r-cocina)", mesero: "var(--r-mesero)", repartidor: "var(--r-delivery)" };
// A dónde va cada rol después de iniciar sesión
export const INICIO_ROL: Record<Rol, string> = { dueno: "/admin", cajero: "/cajero", cocina: "/cocina", mesero: "/mesero", repartidor: "/delivery" };
