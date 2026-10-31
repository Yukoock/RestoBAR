// Administración (B6.2): menú lateral por grupos (fijo y contraíble), migas de pan, búsqueda global (Ctrl/Cmd + K) y avisos.
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle, BarChart3, Bell, Boxes, CalendarDays, ChefHat, ChevronDown, ChevronLeft, ChevronRight, CookingPot, FileText,
  Image, LayoutDashboard, LayoutGrid, LogOut, Menu as MenuIco, QrCode, Receipt, Search, Settings, ShoppingBag, Tags, Truck, Users, UtensilsCrossed, Wallet, type LucideIcon,
} from "lucide-react";
import { useAuth, NOMBRE_ROL, type PermisoAdmin } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { bs, cx, sinTildes } from "@/lib/formato";
import { useMedia } from "@/lib/hooks";
import { useConsulta, inicioDelDia } from "@/lib/datos";
import { IconButton, LogoIcono, PalabraLogo } from "@/components/ui";
import { Dashboard } from "./Dashboard";
import { Pedidos } from "./Pedidos";
import { Mesas } from "./Mesas";
import { CierreCaja } from "./CierreCaja";
import { Productos } from "./Productos";
import { Categorias, MenuDelDiaPantalla, Banners } from "./Catalogo";
import { Ingredientes, Recetas, Movimientos } from "./Inventario";
import { Compras, Proveedores, Gastos } from "./Compras";
import { CobrosQR, Facturacion } from "./Finanzas";
import { Reportes } from "./Reportes";
import { Usuarios } from "./Usuarios";
import { Configuracion } from "./Configuracion";

// permiso: qué casilla de «Permisos por rol» abre la pantalla a otros roles. Sin permiso, es solo del Dueño.
interface Pantalla { ruta: string; nombre: string; icono: LucideIcon; sub: string; C: ComponentType; permiso?: PermisoAdmin }
export const GRUPOS: [string, Pantalla[]][] = [
  ["Operación", [
    { ruta: "dashboard", nombre: "Dashboard", icono: LayoutDashboard, sub: "Cómo va el negocio", C: Dashboard, permiso: "Reportes" },
    { ruta: "pedidos", nombre: "Pedidos", icono: Receipt, sub: "Todos los pedidos de todos los canales", C: Pedidos, permiso: "Reportes" },
    { ruta: "mesas", nombre: "Mesas", icono: LayoutGrid, sub: "Plano del salón y QR de cada mesa", C: Mesas, permiso: "Mesas" },
    { ruta: "caja", nombre: "Cierre de caja", icono: Wallet, sub: "Apertura, arqueo y cierre del turno", C: CierreCaja, permiso: "Cierre de caja" },
  ]],
  ["Catálogo", [
    { ruta: "productos", nombre: "Productos", icono: UtensilsCrossed, sub: "Precios, fotos, recetas y disponibilidad", C: Productos },
    { ruta: "categorias", nombre: "Categorías", icono: Tags, sub: "Orden y visibilidad del menú", C: Categorias },
    { ruta: "menu-del-dia", nombre: "Menú del día", icono: CalendarDays, sub: "Lo que se preparó hoy y cuánto queda", C: MenuDelDiaPantalla },
    { ruta: "banners", nombre: "Banners", icono: Image, sub: "Promociones de la tienda y la pantalla del cliente", C: Banners },
  ]],
  ["Inventario", [
    { ruta: "ingredientes", nombre: "Ingredientes", icono: Boxes, sub: "Stock, mínimos y costos", C: Ingredientes },
    { ruta: "recetas", nombre: "Recetas y costos", icono: CookingPot, sub: "Cuánto cuesta y cuánto deja cada plato", C: Recetas },
    { ruta: "movimientos", nombre: "Movimientos", icono: ChefHat, sub: "Entradas y salidas de insumos", C: Movimientos },
  ]],
  ["Compras", [
    { ruta: "compras", nombre: "Compras", icono: ShoppingBag, sub: "Facturas de compra y costo promedio", C: Compras },
    { ruta: "proveedores", nombre: "Proveedores", icono: Truck, sub: "A quién le compras", C: Proveedores },
  ]],
  ["Finanzas", [
    { ruta: "gastos", nombre: "Gastos", icono: Wallet, sub: "Gastos y retiros", C: Gastos, permiso: "Reportes" },
    { ruta: "cobros-qr", nombre: "Cobros QR", icono: QrCode, sub: "Pagos por QR y abonos del banco", C: CobrosQR, permiso: "Reportes" },
    { ruta: "facturacion", nombre: "Facturación", icono: FileText, sub: "Facturas emitidas", C: Facturacion, permiso: "Reportes" },
  ]],
  ["Reportes", [{ ruta: "reportes", nombre: "Centro de reportes", icono: BarChart3, sub: "Reportes listos para descargar", C: Reportes, permiso: "Reportes" }]],
  ["Ajustes", [
    { ruta: "usuarios", nombre: "Usuarios y roles", icono: Users, sub: "Equipo, PIN y permisos", C: Usuarios },
    { ruta: "configuracion", nombre: "Configuración", icono: Settings, sub: "Datos del negocio, impresión y seguridad", C: Configuracion },
  ]],
];
const PANTALLAS = GRUPOS.flatMap(([g, ps]) => ps.map(p => ({ ...p, grupo: g })));

export function Admin() {
  const { pathname } = useLocation();
  const { puede } = useAuth();
  // Cada rol ve solo las pantallas que le dio el Dueño en «Permisos por rol»
  const visibles = PANTALLAS.filter(p => p.permiso ? puede(p.permiso) : puede("Usuarios y ajustes"));
  const grupos0 = GRUPOS.map(([g, ps]) => [g, ps.filter(p => visibles.includes(PANTALLAS.find(x => x.ruta === p.ruta)!))] as [string, Pantalla[]]).filter(([, ps]) => ps.length);
  const actual = visibles.find(p => pathname.startsWith("/admin/" + p.ruta)) || visibles[0] || PANTALLAS[0];
  useTitulo(actual.nombre);
  const angosto = useMedia("(max-width: 1023px)");
  const [mini, setMini] = useState(() => { try { return localStorage.getItem("restobar-menu-mini") === "1"; } catch { return false; } });
  const [abierto, setAbierto] = useState(false);
  const [grupos, setGrupos] = useState<string[]>([actual.grupo]);
  const [buscar, setBuscar] = useState(false);
  const contraido = mini && !angosto;
  useEffect(() => { setGrupos(g => g.includes(actual.grupo) ? g : [...g, actual.grupo]); setAbierto(false); }, [actual.grupo, actual.ruta]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscar(true); } };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);
  const cambiarMini = () => { setMini(!mini); try { localStorage.setItem("restobar-menu-mini", mini ? "0" : "1"); } catch { /* nada */ } };

  return (
    <div className={cx("grid min-h-screen", angosto ? "grid-cols-1" : contraido ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[248px_minmax(0,1fr)]")}>
      {angosto && abierto && <div className="fixed inset-0 z-[84] bg-[var(--scrim)]" onClick={() => setAbierto(false)} />}
      <nav aria-label="Administración"
        className={cx("z-[85] flex flex-col bg-[var(--lado)] text-[#DCE9E2]",
          angosto ? cx("fixed inset-y-0 left-0 w-[min(280px,86vw)] transition-transform", abierto ? "translate-x-0 shadow-2" : "-translate-x-full") : "sticky top-0 h-screen")}>
        <Link to="/" className={cx("flex items-center gap-2.5 px-4 pb-3 pt-4", contraido && "justify-center px-0")} aria-label="Ir a la portada">
          <LogoIcono tamano={36} />{!contraido && <PalabraLogo className="!text-[19px] text-white [&_.text-accent]:text-[#F07A45]" />}
        </Link>
        <div className="flex-1 overflow-y-auto px-2.5 pb-2.5">
          {grupos0.map(([g, ps]) => {
            const open = contraido || grupos.includes(g);
            return (
              <div key={g} className={cx("mb-1 flex flex-col", contraido && "border-t border-white/10 pt-1")}>
                {!contraido && (
                  <button type="button" aria-expanded={open} onClick={() => setGrupos(x => x.includes(g) ? x.filter(y => y !== g) : [...x, g])}
                    className="flex items-center justify-between px-2 pb-1 pt-2.5 text-left text-xs font-bold tracking-wide text-[#A3C2B4]">
                    {g}{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                {open && ps.map(p => (
                  <NavLink key={p.ruta} to={"/admin/" + p.ruta} data-tip={contraido ? p.nombre : undefined} aria-label={contraido ? p.nombre : undefined}
                    className={({ isActive }) => cx("flex min-h-[42px] items-center gap-2.5 rounded-sm px-2.5 text-[15px]", contraido && "tip justify-center px-0",
                      isActive ? "bg-white font-bold text-[#12402F]" : "hover:bg-white/10")}>
                    <p.icono size={20} aria-hidden="true" />{!contraido && <span>{p.nombre}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>
        <BarraUsuario contraido={contraido} />
        {!angosto && (
          <button type="button" onClick={cambiarMini} aria-label={mini ? "Mostrar el menú completo" : "Contraer el menú a íconos"} data-tip={mini ? "Mostrar menú" : "Contraer menú"}
            className={cx("tip mx-2.5 mb-3 flex min-h-10 items-center gap-2 rounded-sm bg-white/5 px-2.5 font-semibold", contraido && "justify-center")}>
            {mini ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Contraer</span></>}
          </button>
        )}
      </nav>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-start gap-3 px-4 pb-4 pt-5 sm:px-7">
          {angosto && <IconButton icon={MenuIco} label="Abrir menú" onClick={() => setAbierto(true)} />}
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
              <span>Administración</span><ChevronRight size={12} /><span>{actual.grupo}</span><ChevronRight size={12} /><span aria-current="page" className="font-semibold text-ink-2">{actual.nombre}</span>
            </nav>
            <h1 className="text-xl font-extrabold">{actual.nombre}</h1>
            <p className="text-ink-3">{actual.sub}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setBuscar(true)} className="flex min-h-11 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-ink-3 sm:min-w-[200px]">
              <Search size={18} /><span className="hidden flex-1 text-left sm:inline">Buscar</span><kbd className="hidden rounded border border-b-2 border-line px-1.5 text-xs sm:inline">Ctrl K</kbd>
            </button>
            <Avisos />
          </div>
        </header>
        <main id="contenido" className="min-w-0 px-4 pb-12 sm:px-7">
          <Routes>
            <Route index element={<Navigate to={actual.ruta} replace />} />
            {visibles.map(p => <Route key={p.ruta} path={p.ruta} element={<p.C />} />)}
            <Route path="*" element={<Navigate to={"/admin/" + actual.ruta} replace />} />
          </Routes>
        </main>
      </div>
      {buscar && <Paleta cerrar={() => setBuscar(false)} />}
    </div>
  );
}

function BarraUsuario({ contraido }: { contraido: boolean }) {
  const { perfil, salir } = useAuth();
  if (!perfil) return null;
  return (
    <div className={cx("flex items-center gap-2 border-t border-white/10 px-3 py-2.5", contraido && "flex-col")}>
      {!contraido && <span className="min-w-0 flex-1 truncate text-sm">{perfil.nombre}<br /><span className="text-xs text-[#A3C2B4]">{NOMBRE_ROL[perfil.rol]}</span></span>}
      <button type="button" onClick={salir} aria-label="Cerrar sesión" data-tip="Cerrar sesión" className="tip grid h-10 w-10 place-items-center rounded-sm hover:bg-white/10"><LogOut size={18} /></button>
    </div>
  );
}


/* ---------- Incidencias: campana de avisos ---------- */
export function useIncidencias() {
  const { config } = useConfig();
  const hoy = inicioDelDia().toISOString();
  const { datos } = useConsulta<{ anulados: number; qr: number; llamadas: number }>("incidencias", async () => {
    const limite = new Date(Date.now() - config.escalado_min * 60000).toISOString();
    const [a, q, l] = await Promise.all([
      supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "anulado").gte("created_at", hoy),
      supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("pago_pendiente", true).not("pago_metodo", "is", null).neq("estado", "anulado"),
      supabase.from("llamadas").select("id", { count: "exact", head: true }).is("atendida_at", null).eq("cancelada", false).lt("created_at", limite),
    ]);
    return { data: { anulados: a.count || 0, qr: q.count || 0, llamadas: l.count || 0 }, error: a.error || q.error || l.error };
  }, { anulados: 0, qr: 0, llamadas: 0 }, ["pedidos", "llamadas"]);
  return { ...datos, total: datos.anulados + datos.qr + datos.llamadas };
}

function Avisos() {
  const inc = useIncidencias();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, [abierto]);
  const filas: [number, string, LucideIcon, string][] = [
    [inc.qr, "cobros QR por validar", QrCode, "/admin/pedidos?filtro=qr"],
    [inc.llamadas, "llamadas sin atender", Bell, "/admin/mesas"],
    [inc.anulados, "pedidos anulados hoy", AlertTriangle, "/admin/pedidos?filtro=anulados"],
  ];
  return (
    <div ref={ref} className="relative">
      <IconButton icon={Bell} label="Avisos" badge={inc.total || null} aria-expanded={abierto} onClick={() => setAbierto(!abierto)} />
      {abierto && (
        <div role="dialog" aria-label="Avisos" className="absolute right-0 top-[calc(100%+4px)] z-[70] flex w-[300px] flex-col rounded-md bg-surface p-1.5 shadow-2">
          <strong className="px-3 py-2">Avisos</strong>
          {inc.total === 0 ? <p className="px-3 py-2 text-ink-3">Todo en orden. No hay avisos.</p> : filas.filter(f => f[0]).map(([n, t, Ic, ruta]) => (
            <button key={t} type="button" onClick={() => { setAbierto(false); navegar(ruta); }} className="flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-left hover:bg-surface-2">
              <Ic size={18} /><span className="flex-1"><strong className="num">{n}</strong> {t}</span><ChevronRight size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Búsqueda global (Ctrl/Cmd + K): pantallas, productos y pedidos ---------- */
function Paleta({ cerrar }: { cerrar: () => void }) {
  const navegar = useNavigate();
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  const [productos, setProductos] = useState<{ codigo: string; nombre: string; precio: number }[]>([]);
  const [pedidos, setPedidos] = useState<{ id: string; numero: number; cliente: string | null; fecha: string }[]>([]);
  useEffect(() => {
    supabase.from("productos").select("codigo, nombre, precio").order("nombre").then(({ data }) => setProductos(data || []));
    supabase.from("pedidos").select("id, numero, cliente, fecha").gte("created_at", inicioDelDia(7).toISOString()).order("created_at", { ascending: false }).limit(300).then(({ data }) => setPedidos(data || []));
  }, []);
  const t = sinTildes(q);
  const res = useMemo(() => [
    ...PANTALLAS.filter(p => sinTildes(p.nombre).includes(t)).map(p => ({ tipo: "Pantalla", texto: p.nombre, ir: "/admin/" + p.ruta })),
    ...(t ? productos.filter(p => sinTildes(p.nombre).includes(t) || sinTildes(p.codigo).includes(t)).slice(0, 6).map(p => ({ tipo: "Producto", texto: `${p.codigo} · ${p.nombre} · ${bs(p.precio)}`, ir: "/admin/productos?producto=" + p.codigo })) : []),
    ...(t ? pedidos.filter(p => String(p.numero) === q.replace("#", "").trim() || sinTildes(p.cliente).includes(t)).slice(0, 5).map(p => ({ tipo: "Pedido", texto: `#${p.numero} · ${p.cliente || ""} · ${p.fecha.split("-").reverse().join("/")}`, ir: "/admin/pedidos?pedido=" + p.id })) : []),
  ].slice(0, 12), [t, q, productos, pedidos]);
  const elegir = (ruta: string) => { cerrar(); navegar(ruta); };
  return (
    <div className="anim-aparece fixed inset-0 z-[90] grid justify-items-center bg-[var(--scrim)] p-4" onMouseDown={e => e.target === e.currentTarget && cerrar()}>
      <div role="dialog" aria-modal="true" aria-label="Buscar en todo el sistema" className="mt-[10vh] w-[min(620px,100%)] self-start overflow-hidden rounded-lg bg-surface shadow-2">
        <div className="flex min-h-14 items-center gap-2 border-b border-line px-4 text-ink-3">
          <Search size={20} />
          <input autoFocus value={q} placeholder="Ir a una pantalla, producto o pedido…" aria-label="Buscar en todo el sistema" className="!border-0 !bg-transparent !px-0 text-[17px] outline-none"
            onChange={e => { setQ(e.target.value); setI(0); }}
            onKeyDown={e => {
              if (e.key === "Escape") cerrar();
              if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(i + 1, res.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(i - 1, 0)); }
              if (e.key === "Enter" && res[i]) elegir(res[i].ir);
            }} />
          <kbd className="rounded border border-b-2 border-line px-1.5 text-xs">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-auto p-1.5">
          {res.length === 0 && <li className="p-4 text-ink-3">No encontré nada con «{q}».</li>}
          {res.map((r, k) => (
            <li key={k} role="option" aria-selected={k === i}>
              <button type="button" onMouseEnter={() => setI(k)} onClick={() => elegir(r.ir)} className={cx("flex min-h-12 w-full items-center gap-3 rounded-sm px-3 text-left", k === i && "bg-brand-soft")}>
                <span className="flex-1">{r.texto}</span><small className="text-ink-3">{r.tipo}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
