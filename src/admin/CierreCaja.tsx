// Cierre de caja (B6.2): ventas por método, movimientos de efectivo (fondo + efectivo − retiros y gastos = debe haber),
// arqueo por billetes y monedas, y cierre con confirmación. Solo el Dueño reabre una caja cerrada.
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Info, Lock, LockOpen, Plus, RotateCcw, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { bs, cx, fechaHora, hora, leerMonto, mensajeError } from "@/lib/formato";
import { useConsulta, usePerfiles, pagado, METODOS } from "@/lib/datos";
import type { Pedido } from "@/lib/tipos";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, FormField, Modal, Seg, Skeleton, Stepper, useAvisar } from "@/components/ui";

interface Sesion { id: string; abierta_at: string; abierta_por: string | null; fondo: number; cerrada_at: string | null; cerrada_por: string | null; contado: number | null; diferencia: number | null }
interface Movimiento { id: string; tipo: "ingreso" | "retiro" | "gasto"; monto: number; detalle: string; creado_por: string | null; created_at: string }
const DENOM = [200, 100, 50, 20, 10, 5, 2, 1, 0.5];

export function CierreCaja() {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const { datos: perfiles } = usePerfiles();
  const { datos: sesion, cargando, error, recargar } = useConsulta<Sesion | null>("caja", () =>
    supabase.from("caja_sesiones").select("*").order("abierta_at", { ascending: false }).limit(1).maybeSingle() as never, null, ["caja_sesiones"]);
  const desde = sesion?.abierta_at || new Date().toISOString();
  const hasta = sesion?.cerrada_at || null;
  const { datos: pedidos } = useConsulta<Pedido[]>("caja-ped-" + desde + hasta, () => {
    let q = supabase.from("pedidos").select("*").gte("pagado_at", desde).neq("estado", "anulado");
    if (hasta) q = q.lte("pagado_at", hasta);
    return q as never;
  }, [], ["pedidos"]);
  const { datos: movs } = useConsulta<Movimiento[]>("caja-mov-" + (sesion?.id || ""), () =>
    supabase.from("caja_movimientos").select("*").eq("sesion_id", sesion?.id || "00000000-0000-0000-0000-000000000000").order("created_at") as never, [], ["caja_movimientos"]);
  const [conteo, setConteo] = useState<Record<number, number>>(() => Object.fromEntries(DENOM.map(d => [d, 0])));
  const [cerrar, setCerrar] = useState(false), [reabrir, setReabrir] = useState(false), [nuevoMov, setNuevoMov] = useState(false);
  const nombre = (id: string | null) => perfiles.find(p => p.id === id)?.nombre || "—";

  const c = useMemo(() => {
    const cobrados = pedidos.filter(pagado);
    const por = (m: string) => cobrados.filter(p => p.pago_metodo === m).reduce((a, p) => a + Number(p.total), 0);
    const efectivo = por("efectivo") + cobrados.filter(p => p.pago_metodo === "mixto").reduce((a, p) => a + Number(p.pago_efectivo || 0), 0);
    const suma = (t: string) => movs.filter(m => m.tipo === t).reduce((a, m) => a + Number(m.monto), 0);
    const debe = Number(sesion?.fondo || 0) + efectivo + suma("ingreso") - suma("retiro") - suma("gasto");
    return { cobrados, por, efectivo, debe, total: cobrados.reduce((a, p) => a + Number(p.total), 0) };
  }, [pedidos, movs, sesion]);
  const contado = DENOM.reduce((a, d) => a + d * conteo[d], 0);
  const dif = Math.round((contado - c.debe) * 100) / 100;
  const res = dif === 0 ? { t: "La caja cuadra", cls: "bg-ok-soft text-ok", Ic: Check } : dif > 0 ? { t: `Sobra ${bs(dif)}`, cls: "bg-warn-soft text-warn", Ic: Info } : { t: `Falta ${bs(-dif)}`, cls: "bg-bad-soft text-bad", Ic: AlertTriangle };
  const abierta = sesion && !sesion.cerrada_at;

  async function cerrarCaja() {
    const { error } = await supabase.from("caja_sesiones").update({ cerrada_at: new Date().toISOString(), cerrada_por: perfil?.id, arqueo: conteo, contado, debe_haber: c.debe, diferencia: dif }).eq("id", sesion!.id);
    if (error) throw new Error(mensajeError(error));
    avisar(`Caja cerrada · ${res.t}`);
  }
  async function reabrirCaja() {
    const { error } = await supabase.from("caja_sesiones").update({ cerrada_at: null, cerrada_por: null }).eq("id", sesion!.id);
    if (error) throw new Error(mensajeError(error));
    avisar("Caja reabierta por el Dueño");
  }

  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  if (cargando) return <div className="flex flex-col gap-4"><Skeleton h={160} r={12} /><Skeleton h={260} r={12} /></div>;
  if (!abierta && !sesion) return <AbrirCaja />;

  return (
    <div className="flex flex-col gap-4">
      {!abierta && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-3.5 py-3 text-ink-2">
          <Lock size={20} /><div className="flex-1"><strong>Caja cerrada · {fechaHora(sesion!.cerrada_at!)} por {nombre(sesion!.cerrada_por)}</strong>
            <p className="text-sm">Contado {bs(sesion!.contado)} · diferencia {bs(sesion!.diferencia)}. Solo el Dueño puede reabrirla.</p></div>
          {perfil?.rol === "dueno" && <Button icon={LockOpen} onClick={() => setReabrir(true)}>Reabrir caja</Button>}
          <AbrirCaja compacto />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-bold">Ventas del turno por método</h3>
          <table className="w-full text-[15px]"><tbody>
            {Object.keys(METODOS).map(m => <tr key={m} className="border-b border-line"><td className="py-2">{METODOS[m]}</td><td className="num py-2 text-right text-ink-3">{c.cobrados.filter(p => p.pago_metodo === m).length} pedidos</td><td className="num py-2 text-right">{bs(c.por(m))}</td></tr>)}
            <tr className="font-bold"><td className="py-2">Total vendido</td><td /><td className="num py-2 text-right">{bs(c.total)}</td></tr>
          </tbody></table>
          <p className="text-sm text-ink-3">El QR y la tarjeta suman al total vendido, pero no al cajón.</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Movimientos de efectivo</h3>{abierta && <Button size="sm" icon={Plus} onClick={() => setNuevoMov(true)}>Retiro o gasto</Button>}</div>
          <table className="w-full text-[15px]"><tbody>
            <tr className="border-b border-line"><td className="py-2">Fondo inicial · abrió {nombre(sesion!.abierta_por)} a las {hora(sesion!.abierta_at)}</td><td className="num py-2 text-right">{bs(sesion!.fondo)}</td></tr>
            <tr className="border-b border-line"><td className="py-2">+ Ventas en efectivo</td><td className="num py-2 text-right">{bs(c.efectivo)}</td></tr>
            {movs.map(m => <tr key={m.id} className="border-b border-line text-ink-3"><td className="py-2">{m.tipo === "ingreso" ? "+" : "−"} {m.detalle} <span className="text-xs">({m.tipo === "retiro" ? "retiro" : m.tipo})</span></td><td className="num py-2 text-right">{bs(m.tipo === "ingreso" ? m.monto : -m.monto)}</td></tr>)}
            <tr className="font-bold"><td className="py-2">Debe haber en el cajón</td><td className="num py-2 text-right">{bs(c.debe)}</td></tr>
          </tbody></table>
        </Card>
      </div>
      {abierta && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold">Arqueo: cuenta los billetes y monedas</h3>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setConteo(Object.fromEntries(DENOM.map(d => [d, 0])))}>Empezar de cero</Button>
          </div>
          <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {DENOM.map(d => (
              <div key={d} className="grid grid-cols-[90px_auto_1fr] items-center gap-3">
                <span className={cx("px-2 py-1.5 text-center text-sm font-bold", d >= 10 ? "rounded-md bg-brand-soft text-brand-text" : "rounded-full bg-maiz-soft text-warn")}>{d >= 1 ? `Bs ${d}` : "50 ctvs."}</span>
                <Stepper value={conteo[d]} onChange={v => setConteo(x => ({ ...x, [d]: v }))} label={d >= 1 ? `Bs ${d}` : "50 centavos"} />
                <span className="num text-right">{bs(d * conteo[d])}</span>
              </div>
            ))}
          </div>
          <div role="status" className={cx("flex flex-wrap items-center justify-between gap-3 rounded-md p-4", res.cls)}>
            <span>Contado <strong className="num">{bs(contado)}</strong> · Debe haber <strong className="num">{bs(c.debe)}</strong></span>
            <strong className="flex items-center gap-2 font-display text-xl"><res.Ic size={22} /> {res.t}</strong>
          </div>
          <div className="flex justify-end"><Button variant="primary" size="lg" icon={Lock} onClick={() => setCerrar(true)}>Cerrar caja</Button></div>
        </Card>
      )}
      {cerrar && <ConfirmDialog titulo="¿Cerrar la caja?" peligro confirmar="Cerrar caja" onClose={() => setCerrar(false)} onConfirm={cerrarCaja}
        texto={`Contado ${bs(contado)} · ${res.t}. Después de cerrar, solo el Dueño puede reabrirla.`} />}
      {reabrir && <ConfirmDialog titulo="¿Reabrir la caja?" confirmar="Reabrir" onClose={() => setReabrir(false)} onConfirm={reabrirCaja}
        texto="La caja vuelve a quedar abierta y se puede seguir cobrando. Queda registrado quién la reabrió." />}
      {nuevoMov && <NuevoMovimiento sesionId={sesion!.id} onClose={() => setNuevoMov(false)} />}
    </div>
  );
}

function AbrirCaja({ compacto }: { compacto?: boolean }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [abrir, setAbrir] = useState(false), [fondo, setFondo] = useState("100"), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    const n = leerMonto(fondo);
    if (n < 0) return setError("El fondo no puede ser negativo.");
    setEnviando(true);
    const { error } = await supabase.from("caja_sesiones").insert({ fondo: n, abierta_por: perfil?.id });
    setEnviando(false);
    if (error) return setError(/caja_una_abierta/.test(error.message) ? "Ya hay una caja abierta." : mensajeError(error));
    avisar(`Caja abierta con ${bs(n)}`); setAbrir(false);
  }
  return (
    <>
      {compacto ? <Button variant="primary" icon={Wallet} onClick={() => setAbrir(true)}>Abrir caja nueva</Button>
        : <Card><EmptyState icon={Wallet} titulo="La caja está cerrada" texto="Ábrela con el fondo inicial para empezar a cobrar." accion={{ label: "Abrir caja", icon: Wallet, onClick: () => setAbrir(true) }} /></Card>}
      {abrir && (
        <Modal titulo="Abrir caja" onClose={() => setAbrir(false)} ancho={400} pie={<><Button variant="ghost" onClick={() => setAbrir(false)}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Abrir caja</Button></>}>
          <FormField id="fondo" label="Fondo inicial (Bs)" hint="Lo que hay en el cajón al empezar" error={error}><input id="fondo" data-autofocus inputMode="decimal" value={fondo} onChange={e => { setFondo(e.target.value); setError(""); }} /></FormField>
        </Modal>
      )}
    </>
  );
}

function NuevoMovimiento({ sesionId, onClose }: { sesionId: string; onClose: () => void }) {
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [tipo, setTipo] = useState<"retiro" | "gasto" | "ingreso">("retiro");
  const [detalle, setDetalle] = useState(""), [monto, setMonto] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  async function ok() {
    const n = leerMonto(monto);
    if (detalle.trim().length < 3) return setError("Escribe el detalle, por ejemplo «Retiro del dueño».");
    if (!(n > 0)) return setError("Escribe un monto mayor a cero.");
    setEnviando(true);
    const { error } = await supabase.from("caja_movimientos").insert({ sesion_id: sesionId, tipo, monto: n, detalle: detalle.trim(), creado_por: perfil?.id });
    setEnviando(false);
    if (error) return setError(mensajeError(error));
    avisar(`${tipo === "ingreso" ? "Ingreso" : tipo === "retiro" ? "Retiro" : "Gasto"} registrado: ${bs(n)}`); onClose();
  }
  return (
    <Modal titulo="Retiros o gastos" onClose={onClose} ancho={440} pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={ok}>Registrar</Button></>}>
      <Seg value={tipo} onChange={setTipo} label="Tipo" opciones={[["retiro", "Retiro"], ["gasto", "Gasto"], ["ingreso", "Ingreso"]]} />
      <FormField id="mov-det" label="Detalle" hint="Ej.: Retiro del dueño, hielo, garrafa"><input id="mov-det" data-autofocus value={detalle} onChange={e => { setDetalle(e.target.value); setError(""); }} /></FormField>
      <FormField id="mov-monto" label="Monto (Bs)"><input id="mov-monto" inputMode="decimal" value={monto} onChange={e => { setMonto(e.target.value); setError(""); }} /></FormField>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
