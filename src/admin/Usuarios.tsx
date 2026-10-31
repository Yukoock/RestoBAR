// Usuarios y roles (B5 y B6.2): tarjetas por rol, equipo, crear usuarios desde la app y matriz de permisos.
import { useMemo, useState, type CSSProperties } from "react";
import { Bike, ChefHat, KeyRound, LockKeyhole, Pencil, Shield, UserCheck, UserPlus, UserX, Users as UsersIcon, Wallet, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, NOMBRE_ROL, COLOR_ROL } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { cx, iniciales, mensajeError } from "@/lib/formato";
import { useConsulta, usePerfiles, useMesas } from "@/lib/datos";
import { exportarTabla } from "@/lib/exportar";
import type { Perfil, Rol } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, FormField, Modal, Seg, useAvisar } from "@/components/ui";

const ICONO: Record<Rol, LucideIcon> = { dueno: Shield, cajero: Wallet, cocina: ChefHat, mesero: UsersIcon, repartidor: Bike };
const DESC: Record<Rol, string> = {
  dueno: "Todo. Es el único que gestiona usuarios, precios y configuración, y reabre la caja.",
  cajero: "Cajero, Mesas (lectura), Cierre de caja y asignar Delivery.",
  cocina: "Pantalla de cocina.", mesero: "App del mesero en el celular.", repartidor: "App de delivery en el celular.",
};
// Casillas que el Dueño da o quita. Catálogo, inventario, compras, usuarios y configuración son solo del Dueño:
// la base de datos tampoco deja que otro rol los cambie.
const PANTALLAS: [string, string][] = [["Cajero", "Cajero"], ["Mesas", "Mesas (Administración)"], ["Cierre de caja", "Cierre de caja (Administración)"],
  ["Reportes", "Dashboard, pedidos y reportes (Administración)"], ["Cocina", "Cocina"], ["Mesero", "Mesero"], ["Delivery", "Delivery"]];
const ROLES_EDIT: Rol[] = ["cajero", "cocina", "mesero", "repartidor"];

export function Usuarios() {
  const { config } = useConfig();
  const { perfil: yo } = useAuth();
  const avisar = useAvisar();
  const { datos: equipo, cargando, error, recargar } = usePerfiles();
  const { datos: permisos } = useConsulta<{ rol: Rol; pantalla: string; permitido: boolean }[]>("permisos", () => supabase.from("permisos_rol").select("*") as never, [], ["permisos_rol"]);
  const [nuevo, setNuevo] = useState(false), [editar, setEditar] = useState<Perfil | null>(null), [pin, setPin] = useState<Perfil | null>(null), [claveDe, setClaveDe] = useState<Perfil | null>(null);
  const pendientes = equipo.filter(u => !u.activo);

  async function configurar(u: Perfil, c: Partial<Perfil> & { pin?: string | null }, texto: string) {
    const d = { ...u, ...c };
    const { error } = await supabase.rpc("configurar_usuario", { p_id: u.id, p_nombre: d.nombre, p_rol: d.rol, p_zona: d.zona, p_pin: c.pin ?? null, p_activo: d.activo });
    if (error) { avisar(mensajeError(error), "bad"); return false; }
    avisar(texto); return true;
  }
  async function permiso(rol: Rol, pantalla: string, v: boolean) {
    const { error } = await supabase.from("permisos_rol").upsert({ rol, pantalla, permitido: v });
    if (error) avisar(mensajeError(error), "bad"); else avisar(`${NOMBRE_ROL[rol]}: ${v ? "puede abrir" : "ya no abre"} ${pantalla}`);
  }
  const puede = (rol: Rol, p: string) => permisos.find(x => x.rol === rol && x.pantalla === p)?.permitido ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(Object.keys(NOMBRE_ROL) as Rol[]).map(r => { const Ic = ICONO[r]; return (
          <Card key={r} style={{ "--c": COLOR_ROL[r], borderTop: `4px solid ${COLOR_ROL[r]}` } as CSSProperties} className="!gap-1.5">
            <span className="rol-suave grid h-9 w-9 place-items-center rounded-sm"><Ic size={20} aria-hidden="true" /></span>
            <strong>{NOMBRE_ROL[r]}</strong><span className="num text-sm text-ink-3">{equipo.filter(u => u.rol === r && u.activo).length} activos</span>
            <p className="text-sm">{DESC[r]}</p>
          </Card>
        ); })}
      </div>
      {pendientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-info-soft px-3.5 py-3 text-info">
          <UserCheck size={20} /><div className="flex-1"><strong>{pendientes.length} {pendientes.length === 1 ? "cuenta espera" : "cuentas esperan"} activación</strong><p className="text-sm">{pendientes.map(p => p.nombre).join(", ")}. Asígnales rol y PIN con «Editar».</p></div>
        </div>
      )}
      <DataTable<Perfil> id="equipo" titulo="Equipo" filas={equipo} clave={u => u.id} cargando={cargando} error={error} onReintentar={recargar}
        buscar={u => `${u.nombre} ${u.correo || ""}`} arriba={<Button variant="primary" icon={UserPlus} onClick={() => setNuevo(true)}>Crear usuario</Button>}
        filtros={[{ id: "todos", titulo: "Todos", f: () => true }, { id: "activos", titulo: "Activos", f: u => u.activo }, { id: "inactivos", titulo: "Inactivos o por activar", f: u => !u.activo }]}
        columnas={[
          { clave: "nombre", titulo: "Nombre", render: u => <span className="flex items-center gap-2.5"><span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[13px] font-bold text-on-role" style={{ background: COLOR_ROL[u.rol] }}>{iniciales(u.nombre)}</span><span className="flex flex-col"><strong>{u.nombre}{u.id === yo?.id && " (tú)"}</strong><small className="text-ink-3">{u.correo}</small></span></span>, texto: u => u.nombre, orden: u => u.nombre },
          { clave: "rol", titulo: "Rol", render: u => { const Ic = ICONO[u.rol]; return <span style={{ "--c": COLOR_ROL[u.rol] } as CSSProperties} className="rol-suave inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[13px] font-bold"><Ic size={14} />{NOMBRE_ROL[u.rol]}</span>; }, texto: u => NOMBRE_ROL[u.rol], orden: u => u.rol },
          { clave: "zona", titulo: "Zona o turno", texto: u => u.zona || "—" },
          { clave: "estado", titulo: "Estado", render: u => <Badge tono={u.activo ? "ok" : "neutral"} punto>{u.activo ? "Activo" : "Inactivo"}</Badge>, texto: u => u.activo ? "Activo" : "Inactivo", orden: u => String(u.activo) },
        ]}
        accion={{ titulo: "Editar", icon: Pencil, onClick: setEditar }}
        menu={u => [
          { label: "Cambiar PIN", icon: KeyRound, onClick: () => setPin(u) },
          { label: "Cambiar contraseña", icon: LockKeyhole, onClick: () => setClaveDe(u) },
          u.id !== yo?.id && "-",
          u.id !== yo?.id && (u.activo
            ? { label: "Desactivar", icon: UserX, peligro: true, onClick: () => configurar(u, { activo: false }, `${u.nombre} desactivado: ya no puede entrar`) }
            : { label: "Activar", icon: UserCheck, onClick: () => configurar(u, { activo: true }, `${u.nombre} activado`) }),
        ]}
        onExportar={(t, f, c) => exportarTabla(t, "Equipo", f, c, config)} />
      <Card>
        <h3 className="font-bold">Permisos por rol</h3>
        <p className="text-sm text-ink-3">El Dueño siempre tiene todo. Marca qué puede abrir cada rol; el cambio vale desde que la persona vuelve a entrar.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[15px]">
            <thead><tr className="text-[13px] text-ink-3"><th className="py-2 text-left font-semibold">Pantalla</th>{(["dueno", ...ROLES_EDIT] as Rol[]).map(r => <th key={r} className="py-2 font-semibold">{NOMBRE_ROL[r]}</th>)}</tr></thead>
            <tbody>{PANTALLAS.map(([p, t]) => (
              <tr key={p} className="border-t border-line">
                <td className="py-1.5">{t}</td>
                <td className="text-center"><input type="checkbox" checked disabled aria-label={`Dueño puede abrir ${t}`} /></td>
                {ROLES_EDIT.map(r => <td key={r} className="text-center"><input type="checkbox" aria-label={`${NOMBRE_ROL[r]} puede abrir ${t}`} checked={puede(r, p)} onChange={e => permiso(r, p, e.target.checked)} /></td>)}
              </tr>
            ))}
              <tr className="border-t border-line text-ink-3"><td className="py-1.5">Catálogo, inventario, compras, usuarios y configuración</td><td className="text-center"><input type="checkbox" checked disabled aria-label="Dueño puede abrir catálogo, inventario, compras, usuarios y configuración" /></td><td colSpan={4} className="text-center text-sm">Solo el Dueño</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
      {nuevo && <NuevoUsuario onClose={() => setNuevo(false)} />}
      {editar && <EditarUsuario u={editar} esYo={editar.id === yo?.id} onClose={() => setEditar(null)} guardar={configurar} />}
      {claveDe && <CambiarClave u={claveDe} onClose={() => setClaveDe(null)} />}
      {pin && <CambiarPin u={pin} onClose={() => setPin(null)} guardar={configurar} />}
    </div>
  );
}

function useZonas() {
  const { datos: mesas } = useMesas();
  return useMemo(() => [...new Set(mesas.map(m => m.zona))], [mesas]);
}

function NuevoUsuario({ onClose }: { onClose: () => void }) {
  const avisar = useAvisar();
  const zonas = useZonas();
  const [f, setF] = useState({ nombre: "", correo: "", clave: "", rol: "mesero" as Rol, zona: "", pin: "" });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const up = (k: keyof typeof f, v: string) => { setF(x => ({ ...x, [k]: v })); setError(""); };
  async function crear() {
    if (f.nombre.trim().length < 3) return setError("Escribe el nombre completo.");
    if (!/^\S+@\S+\.\S+$/.test(f.correo.trim())) return setError("Escribe un correo válido.");
    if (f.clave.length < 8) return setError("La contraseña inicial debe tener al menos 8 caracteres.");
    if (!/^\d{4}$/.test(f.pin)) return setError("El PIN debe tener 4 números.");
    setEnviando(true);
    try {
      // La cuenta se crea en la base de datos (crear_usuario): el Dueño no pierde su sesión y nadie confirma correo
      const { error } = await supabase.rpc("crear_usuario", { p_correo: f.correo.trim(), p_clave: f.clave, p_nombre: f.nombre.trim(), p_rol: f.rol, p_zona: f.zona || null, p_pin: f.pin });
      if (error) throw error;
      avisar(`${f.nombre.trim()} ya puede entrar como ${NOMBRE_ROL[f.rol]}. Pásale su correo y su contraseña inicial.`); onClose();
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  }
  return (
    <Modal titulo="Crear usuario" onClose={onClose} ancho={500} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={crear}>Crear usuario</Button></>}>
      <FormField id="nu-n" label="Nombre completo"><input id="nu-n" data-autofocus value={f.nombre} onChange={e => up("nombre", e.target.value)} /></FormField>
      <FormField id="nu-c" label="Correo"><input id="nu-c" type="email" autoComplete="off" value={f.correo} onChange={e => up("correo", e.target.value)} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="nu-k" label="Contraseña inicial" hint="La persona puede cambiarla después"><input id="nu-k" type="text" autoComplete="new-password" value={f.clave} onChange={e => up("clave", e.target.value)} /></FormField>
        <FormField id="nu-p" label="PIN de 4 dígitos"><input id="nu-p" inputMode="numeric" maxLength={4} value={f.pin} onChange={e => up("pin", e.target.value.replace(/\D/g, ""))} /></FormField>
      </div>
      <FormField id="nu-r" label="Rol"><Seg value={f.rol} onChange={v => up("rol", v)} label="Rol" opciones={ROLES_EDIT.map(r => [r, NOMBRE_ROL[r]] as [Rol, string])} /></FormField>
      <FormField id="nu-z" label={f.rol === "mesero" ? "Zona que atiende" : "Zona o turno (opcional)"}>
        {f.rol === "mesero" && zonas.length ? <select id="nu-z" value={f.zona} onChange={e => up("zona", e.target.value)}><option value="">Todas</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
          : <input id="nu-z" value={f.zona} placeholder="Ej.: Noche · 18:00–23:30" onChange={e => up("zona", e.target.value)} />}
      </FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

type Guardar = (u: Perfil, c: Partial<Perfil> & { pin?: string | null }, texto: string) => Promise<boolean>;
function EditarUsuario({ u, esYo, onClose, guardar }: { u: Perfil; esYo: boolean; onClose: () => void; guardar: Guardar }) {
  const zonas = useZonas();
  const [f, setF] = useState({ nombre: u.nombre, rol: u.rol, zona: u.zona || "", activo: u.activo, pin: "" });
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    if (f.nombre.trim().length < 3) return setError("Escribe el nombre completo.");
    if (f.pin && !/^\d{4}$/.test(f.pin)) return setError("El PIN debe tener 4 números.");
    if (!u.activo && f.activo && !f.pin) return setError("Para activar la cuenta, asígnale un PIN de 4 dígitos.");
    setEnviando(true);
    const ok = await guardar(u, { nombre: f.nombre.trim(), rol: f.rol, zona: f.zona || null, activo: f.activo, pin: f.pin || null }, `${f.nombre.trim()} actualizado`);
    setEnviando(false); if (ok) onClose();
  }
  return (
    <Modal titulo={`Editar a ${u.nombre}`} onClose={onClose} ancho={500} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Guardar</Button></>}>
      <FormField id="eu-n" label="Nombre"><input id="eu-n" data-autofocus value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></FormField>
      {esYo ? <p className="text-sm text-ink-3">Eres el Dueño: tu rol no se puede cambiar.</p> : (
        <FormField id="eu-r" label="Rol"><Seg value={f.rol} onChange={v => setF({ ...f, rol: v })} label="Rol" opciones={ROLES_EDIT.map(r => [r, NOMBRE_ROL[r]] as [Rol, string])} /></FormField>
      )}
      <FormField id="eu-z" label="Zona o turno">
        {f.rol === "mesero" && zonas.length ? <select id="eu-z" value={f.zona} onChange={e => setF({ ...f, zona: e.target.value })}><option value="">Todas</option>{zonas.map(z => <option key={z}>{z}</option>)}</select>
          : <input id="eu-z" value={f.zona} onChange={e => setF({ ...f, zona: e.target.value })} />}
      </FormField>
      <FormField id="eu-p" label={u.activo ? "PIN nuevo (opcional)" : "PIN de 4 dígitos"}><input id="eu-p" inputMode="numeric" maxLength={4} value={f.pin} onChange={e => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })} /></FormField>
      {!esYo && (
        <label className="flex min-h-11 items-center gap-2.5"><input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} />Cuenta activa (puede entrar)</label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}

function CambiarPin({ u, onClose, guardar }: { u: Perfil; onClose: () => void; guardar: Guardar }) {
  const [p, setP] = useState(""), [enviando, setEnviando] = useState(false);
  return (
    <Modal titulo={`Nuevo PIN de ${u.nombre}`} onClose={onClose} ancho={380}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} disabled={p.length !== 4} onClick={async () => { setEnviando(true); if (await guardar(u, { pin: p }, `PIN de ${u.nombre} actualizado`)) onClose(); setEnviando(false); }}>Guardar</Button></>}>
      <FormField id="cp" label="PIN de 4 dígitos" hint="Lo usa para cambiar de usuario en la caja"><input id="cp" data-autofocus inputMode="numeric" maxLength={4} className={cx("num tracking-[.5em]")} value={p} onChange={e => setP(e.target.value.replace(/\D/g, ""))} /></FormField>
    </Modal>
  );
}

function CambiarClave({ u, onClose }: { u: Perfil; onClose: () => void }) {
  const avisar = useAvisar();
  const [c, setC] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function guardar() {
    if (c.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setEnviando(true);
    const { error } = await supabase.rpc("cambiar_clave_usuario", { p_id: u.id, p_clave: c });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    avisar(`Contraseña de ${u.nombre} cambiada. Pásale la nueva.`); onClose();
  }
  return (
    <Modal titulo={`Nueva contraseña de ${u.nombre}`} onClose={onClose} ancho={400}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={guardar}>Guardar</Button></>}>
      <FormField id="cc" label="Contraseña nueva" hint="Al menos 8 caracteres"><input id="cc" data-autofocus type="text" autoComplete="new-password" value={c} onChange={e => { setC(e.target.value); setError(""); }} /></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
