// Portada (B6.1): selector de módulos en tres grupos, con el color de cada rol.
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Bell, Bike, ChefHat, LayoutDashboard, LogOut, MessageCircle, Monitor, QrCode, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import { useAuth, NOMBRE_ROL } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { useTema, type Tema } from "@/lib/tema";
import { supabase } from "@/lib/supabase";
import { Button, Logo, Seg } from "@/components/ui";

interface Modulo { ruta: string; titulo: string; icono: LucideIcon; color: string; puntos: string[]; publico: boolean }

export function Portada() {
  useTitulo();
  const { config } = useConfig();
  const { perfil, salir } = useAuth();
  const [tema, setTema] = useTema();
  const [token, setToken] = useState<{ numero: number; t: string } | null>(null);
  // El personal ve un enlace de prueba a la Mesa 1 (el público entra con el QR impreso)
  useEffect(() => {
    if (!perfil?.activo) return;
    supabase.from("mesas").select("numero, qr_token").order("numero").limit(1).maybeSingle().then(({ data }) => data && setToken({ numero: data.numero, t: data.qr_token }));
  }, [perfil]);
  const qs = token ? `${token.numero}?t=${token.t}` : "1";

  const grupos: [string, Modulo[]][] = [
    ["Operación", [
      { ruta: "/cajero", titulo: "Cajero", icono: Wallet, color: "var(--r-cajero)", puntos: ["Cobra en efectivo, QR, tarjeta o mixto", "Recibe pedidos de mesas, tienda y delivery", "Atajos N, F y /"], publico: false },
      { ruta: "/cocina", titulo: "Cocina", icono: ChefHat, color: "var(--r-cocina)", puntos: ["Comandas por estación", "Cronómetro verde, ámbar y rojo", "Siempre en modo oscuro"], publico: false },
      { ruta: "/mesero", titulo: "Mesero", icono: Users, color: "var(--r-mesero)", puntos: ["Las mesas que llaman, primero", "Toma pedidos con foto y opciones", "Funciona sin internet"], publico: false },
      { ruta: "/delivery", titulo: "Delivery", icono: Bike, color: "var(--r-delivery)", puntos: ["Entregas asignadas", "Llamar, WhatsApp y mapa", "Cobra al entregar"], publico: false },
    ]],
    ["Cliente", [
      { ruta: "/tienda", titulo: "Tienda online", icono: Store, color: "var(--r-tienda)", puntos: ["Menú con fotos y carrito", "Pide por WhatsApp o paga con QR", "Seguimiento en vivo"], publico: true },
      { ruta: `/mesa/${qs}`, titulo: "Pedido desde la mesa", icono: QrCode, color: "var(--r-cliente)", puntos: ["Se abre con el QR de cada mesa", "Se suma a la cuenta abierta", "Sin crear cuenta"], publico: true },
      { ruta: "/pantalla", titulo: "Pantalla del cliente", icono: Monitor, color: "var(--r-cliente)", puntos: ["Total a pagar en grande", "QR de pago y «¡Gracias!»", "Promociones en espera"], publico: false },
      { ruta: `/llamar/${qs}`, titulo: "Llamar al mesero", icono: Bell, color: "var(--r-mesero)", puntos: ["Un toque desde la mesa", "Motivo: cuenta, agua o ayuda", "Avisa quién va en camino"], publico: true },
    ]],
    ["Gestión", [
      { ruta: "/admin", titulo: "Administración", icono: LayoutDashboard, color: "var(--r-admin)", puntos: ["Ventas, pedidos y caja", "Productos, inventario y compras", "Usuarios, reportes y configuración"], publico: false },
    ]],
  ];
  const soporte = config.whatsapp ? `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(`Hola, necesito ayuda con el sistema de ${config.nombre}`)}` : null;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Logo tamano={56} className="[&>span:last-child]:text-[34px]" />
          <p className="text-ink-3">{[config.lema, config.direccion].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg<Tema> value={tema} onChange={setTema} label="Apariencia" opciones={[["auto", "Automática"], ["light", "Clara"], ["dark", "Oscura"]]} />
          {soporte && <a href={soporte} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line bg-surface px-4 font-semibold hover:bg-surface-2"><MessageCircle size={18} />Soporte por WhatsApp</a>}
        </div>
      </header>
      <div className="trenza w-[72px]" aria-hidden="true" />
      {perfil && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-brand-soft px-4 py-3">
          <span className="flex-1">Sesión de <strong>{perfil.nombre}</strong> · {NOMBRE_ROL[perfil.rol]}{!perfil.activo && " · esperando que el Dueño active la cuenta"}</span>
          <Button variant="ghost" icon={LogOut} onClick={salir}>Cerrar sesión</Button>
        </div>
      )}
      {grupos.map(([g, mods]) => (
        <section key={g} aria-labelledby={"g-" + g} className="flex flex-col gap-2.5">
          <h2 id={"g-" + g} className="font-sans text-[15px] font-bold text-ink-3">{g}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
            {mods.map(m => (
              <article key={m.titulo} style={{ "--c": m.color } as CSSProperties} className="relative flex flex-col gap-3 overflow-hidden rounded-md bg-surface px-[18px] pb-4 pt-5 shadow-1">
                <span className="absolute inset-x-0 top-0 h-[5px] bg-[var(--c)]" aria-hidden="true" />
                <div className="flex items-center gap-2.5">
                  <span className="rol-suave grid h-10 w-10 place-items-center rounded-sm"><m.icono size={22} aria-hidden="true" /></span>
                  <h3 className="text-lg font-bold">{m.titulo}</h3>
                </div>
                <ul className="flex flex-1 flex-col gap-1 text-sm text-ink-2">
                  {m.puntos.map(p => <li key={p} className="before:mr-1.5 before:font-extrabold before:text-[var(--c)] before:content-['·']">{p}</li>)}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={m.publico ? "rounded-full bg-maiz-soft px-2 py-0.5 text-xs font-semibold text-warn" : "rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2"}>{m.publico ? "Vista pública" : "Con usuario"}</span>
                  {m.publico
                    ? <a href={m.ruta} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-sm bg-[var(--c)] px-4 font-semibold text-on-role hover:brightness-110">Abrir vista pública ↗</a>
                    : <Link to={m.ruta} className="inline-flex min-h-11 items-center rounded-sm bg-[var(--c)] px-4 font-semibold text-on-role hover:brightness-110">Ingresar →</Link>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-ink-3">Fotos del menú de Wikimedia Commons con licencia libre · <Link to="/creditos" className="font-semibold text-brand-text underline">Créditos de las fotos</Link></p>
    </main>
  );
}
