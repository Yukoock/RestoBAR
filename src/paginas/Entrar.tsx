// Inicio de sesión. Si todavía no hay Dueño, explica cómo nombrarlo con hacer-administrador.sql.
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, RotateCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, INICIO_ROL } from "@/lib/auth";
import { useConfig, useTitulo } from "@/lib/config";
import { mensajeError } from "@/lib/formato";
import { Button, FormField, Logo, Skeleton, useAvisar } from "@/components/ui";

export function Entrar() {
  const { sesion, perfil, cargando } = useAuth();
  const { config } = useConfig();
  const [params] = useSearchParams();
  const volver = params.get("volver");
  const [hayDueno, setHayDueno] = useState<boolean | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  useTitulo("Iniciar sesión");

  const [intento, setIntento] = useState(0);
  useEffect(() => {
    setErrorCarga("");
    supabase.rpc("hay_dueno").then(({ data, error }) => {
      if (error) setErrorCarga(/function|schema cache/i.test(error.message) ? "La base de datos todavía no está lista. Pega el archivo schema.sql en Supabase › SQL Editor y vuelve a abrir esta página." : mensajeError(error));
      else setHayDueno(!!data);
    });
  }, [intento]);

  if (!cargando && sesion && perfil?.activo) return <Navigate to={volver || INICIO_ROL[perfil.rol]} replace />;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft size={16} /> Volver al inicio</Link>
      <div className="flex flex-col gap-2">
        <Logo tamano={48} />
        {config.lema && <p className="text-ink-3">{config.lema}</p>}
        <div className="trenza w-[72px]" aria-hidden="true" />
      </div>
      <section className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-1">
        {errorCarga ? <><p role="alert" className="font-semibold text-bad">{errorCarga}</p><Button icon={RotateCw} onClick={() => setIntento(i => i + 1)}>Reintentar</Button></>
          : hayDueno === null ? <><Skeleton h={28} w="60%" /><Skeleton h={44} /><Skeleton h={44} /><Skeleton h={48} /></>
          : hayDueno ? <FormEntrar /> : <SinDueno />}
      </section>
    </main>
  );
}

function CampoClave({ id, label, valor, onChange, autoComplete, hint }: { id: string; label: string; valor: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [ver, setVer] = useState(false);
  return (
    <FormField id={id} label={label} hint={hint}>
      <div className="relative">
        <input id={id} type={ver ? "text" : "password"} value={valor} autoComplete={autoComplete} required onChange={e => onChange(e.target.value)} className="!pr-12" />
        <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-ink-3">
          {ver ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </FormField>
  );
}

function FormEntrar() {
  const [correo, setCorreo] = useState(""), [clave, setClave] = useState("");
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const avisar = useAvisar();
  async function entrar(e: FormEvent) {
    e.preventDefault(); setError(""); setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (error) setError(mensajeError(error));
  }
  async function olvide() {
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return setError("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».");
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin + "/entrar" });
    if (error) setError(mensajeError(error)); else avisar("Te enviamos un correo para crear una contraseña nueva", "info");
  }
  return (
    <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-extrabold">Iniciar sesión</h1>
      <FormField id="correo" label="Correo"><input id="correo" type="email" autoComplete="email" required value={correo} onChange={e => setCorreo(e.target.value)} /></FormField>
      <CampoClave id="clave" label="Contraseña" valor={clave} onChange={setClave} autoComplete="current-password" />
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={enviando} disabled={!correo || !clave}>Entrar</Button>
      <Button variant="ghost" icon={KeyRound} onClick={olvide}>Olvidé mi contraseña</Button>
      <p className="text-sm text-ink-3">¿Eres nuevo en el equipo? El Dueño crea tu usuario desde Administración › Usuarios y roles.</p>
    </form>
  );
}

function SinDueno() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-extrabold">Falta nombrar al Dueño</h1>
      <p className="text-sm text-ink-2">La base de datos ya está lista, pero todavía nadie es administrador. Se hace una sola vez:</p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>En Supabase › <strong>Authentication › Users › Add user › Create new user</strong>, escribe tu correo y tu contraseña y marca «Auto Confirm User».</li>
        <li>Abre el archivo <strong>hacer-administrador.sql</strong>, cambia el correo de ejemplo por el tuyo y ejecútalo en <strong>SQL Editor</strong>.</li>
        <li>Vuelve a esta página e inicia sesión.</li>
      </ol>
      <Button icon={RotateCw} onClick={() => window.location.reload()}>Ya lo hice</Button>
    </div>
  );
}
