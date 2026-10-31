// Ruta protegida por rol (B5): sin sesión → iniciar sesión; cuenta sin activar o sin permiso → explica qué hacer.
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Clock, LogOut, ShieldOff } from "lucide-react";
import { useAuth, INICIO_ROL, NOMBRE_ROL, type Pantalla } from "@/lib/auth";
import { Button, Logo, Skeleton } from "./ui";

export function RutaProtegida({ pantalla, children }: { pantalla: Pantalla; children: ReactNode }) {
  const { cargando, sesion, perfil, puede, salir } = useAuth();
  const ubicacion = useLocation();
  if (cargando) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6" aria-busy="true" aria-label="Cargando">
        <Skeleton h={40} w="40%" /><Skeleton h={18} w="70%" /><Skeleton h={220} r={12} />
      </div>
    );
  }
  if (!sesion) return <Navigate to={`/entrar?volver=${encodeURIComponent(ubicacion.pathname)}`} replace />;
  if (!perfil || !perfil.activo) {
    return (
      <Aviso icono={<Clock size={30} />} titulo="Tu cuenta espera que el Dueño la active"
        texto="Tu cuenta todavía no está activa. Pídele al Dueño que entre a Administración › Usuarios y roles y te asigne tu rol y tu PIN."
        acciones={<Button icon={LogOut} onClick={salir}>Cerrar sesión</Button>} />
    );
  }
  if (!puede(pantalla)) {
    return (
      <Aviso icono={<ShieldOff size={30} />} titulo={`${NOMBRE_ROL[perfil.rol]}: no tienes acceso a ${pantalla}`}
        texto="Si lo necesitas, pídele al Dueño que te dé este permiso en Usuarios y roles."
        acciones={<><Link to={INICIO_ROL[perfil.rol]} className="inline-flex min-h-11 items-center rounded-sm bg-brand px-4 font-semibold text-on-brand">Ir a mi pantalla</Link><Button variant="ghost" icon={LogOut} onClick={salir}>Cerrar sesión</Button></>} />
    );
  }
  return <>{children}</>;
}

function Aviso({ icono, titulo, texto, acciones }: { icono: ReactNode; titulo: string; texto: string; acciones: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand-text">{icono}</span>
      <h1 className="text-xl font-extrabold">{titulo}</h1>
      <p className="text-ink-2">{texto}</p>
      <div className="flex flex-wrap justify-center gap-2.5">{acciones}</div>
    </main>
  );
}
