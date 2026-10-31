// Etiquetas y estados (B3): Badge, Chip, EmptyState, Skeleton, ErrorState, Toast, ConfirmDialog y PinDialog.
import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, Bell, Check, Delete, RotateCw, type LucideIcon } from "lucide-react";
import { cx, mensajeError } from "@/lib/formato";
import { useConfig } from "@/lib/config";
import { Button } from "./controles";
import { Modal } from "./contenedores";

export type Tono = "ok" | "warn" | "bad" | "info" | "neutral";
const TONOS: Record<Tono, string> = { ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", info: "bg-info-soft text-info", neutral: "bg-surface-3 text-ink-2" };

// Nunca solo color: la etiqueta lleva texto y, si se puede, ícono o punto (B2)
export function Badge({ tono = "neutral", icon: Ic, punto, children }: { tono?: Tono; icon?: LucideIcon; punto?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-snug", TONOS[tono])}>
      {punto && <i className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />}
      {Ic && <Ic size={14} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Chip({ activo, onClick, contador, icon: Ic, children }: { activo?: boolean; onClick: () => void; contador?: number; icon?: LucideIcon; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={!!activo} onClick={onClick}
      className={cx("inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold",
        activo ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-ink-3")}>
      {Ic && <Ic size={16} aria-hidden="true" />}{children}
      {contador != null && <span className={cx("num rounded-full px-1.5 text-xs leading-5", activo ? "bg-white/20" : "bg-surface-2 text-ink-2")}>{contador}</span>}
    </button>
  );
}

export function RolTag({ color, icon: Ic, children }: { color: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span style={{ "--c": color } as CSSProperties} className="rol-suave inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm py-0.5 pl-1.5 pr-2.5 text-[13px] font-bold">
      {Ic && <Ic size={14} strokeWidth={2} aria-hidden="true" />}{children}
    </span>
  );
}

export function EmptyState({ icon: Ic, titulo, texto, accion }: { icon: LucideIcon; titulo: string; texto?: string; accion?: { label: string; icon?: LucideIcon; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-ink-2">
      <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-brand-soft text-brand-text"><Ic size={28} aria-hidden="true" /></span>
      <strong>{titulo}</strong>
      {texto && <p className="max-w-[46ch] text-[15px] text-ink-3">{texto}</p>}
      {accion && <Button variant="primary" icon={accion.icon} onClick={accion.onClick}>{accion.label}</Button>}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = "100%", r = 6 }: { h?: number; w?: number | string; r?: number }) =>
  <span className="skel block" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;

export function ErrorState({ titulo = "No se pudo cargar", error, onRetry }: { titulo?: string; error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2.5 px-4 py-9 text-center">
      <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-bad-soft text-bad"><AlertTriangle size={28} aria-hidden="true" /></span>
      <strong>{titulo}</strong>
      <p className="max-w-[46ch] text-[15px] text-ink-3">{mensajeError(error)}</p>
      <Button icon={RotateCw} onClick={onRetry}>Reintentar</Button>
    </div>
  );
}

/* ---------- Avisos (toast) con «Deshacer» opcional ---------- */
interface Aviso { id: number; texto: string; tono: "ok" | "bad" | "info"; accion?: { label: string; onClick: () => void } }
const AvisosCtx = createContext<(texto: string, tono?: Aviso["tono"], accion?: Aviso["accion"]) => void>(() => {});
export const useAvisar = () => useContext(AvisosCtx);
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tono: Aviso["tono"] = "ok", accion?: Aviso["accion"]) => {
    const id = Date.now() + Math.random();
    setLista(l => [...l.slice(-2), { id, texto, tono, accion }]);
    setTimeout(() => setLista(l => l.filter(x => x.id !== id)), accion ? 6000 : 4200);
  }, []);
  const Ic = { ok: Check, bad: AlertTriangle, info: Bell };
  return (
    <AvisosCtx.Provider value={avisar}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-[95] flex w-[min(480px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2">
        {lista.map(a => { const I = Ic[a.tono]; return (
          <div key={a.id} className="anim-sube flex items-center gap-2.5 rounded-md bg-ink px-3.5 py-3 font-medium text-bg shadow-2">
            <I size={18} aria-hidden="true" className={a.tono === "bad" ? "text-[#FF9A85]" : a.tono === "info" ? "text-[#9CC6F2]" : "text-[#7FE0A8]"} />
            <span className="flex-1">{a.texto}</span>
            {a.accion && <button type="button" className="min-h-9 rounded-sm border border-current px-3 font-bold" onClick={() => { a.accion!.onClick(); setLista(l => l.filter(x => x.id !== a.id)); }}>{a.accion.label}</button>}
          </div>
        ); })}
      </div>
    </AvisosCtx.Provider>
  );
}

export function ConfirmDialog({ titulo, texto, confirmar = "Confirmar", peligro, onConfirm, onClose }:
  { titulo: string; texto: ReactNode; confirmar?: string; peligro?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={440}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={peligro ? "danger" : "primary"} data-autofocus loading={enviando} onClick={async () => { setEnviando(true); try { await onConfirm(); onClose(); } finally { setEnviando(false); } }}>{confirmar}</Button></>}>
      <p>{texto}</p>
    </Modal>
  );
}

const CLAVE_FALLOS = "restobar-pin-fallos";
const leerFallos = (): { n: number; hasta: number } => { try { return { n: 0, hasta: 0, ...JSON.parse(localStorage.getItem(CLAVE_FALLOS) || "{}") }; } catch { return { n: 0, hasta: 0 }; } };
const guardarFallos = (v: { n: number; hasta: number }) => { try { localStorage.setItem(CLAVE_FALLOS, JSON.stringify(v)); } catch { /* nada */ } };

// PIN + motivo (B2: anular pide PIN y motivo, y queda en la auditoría). onConfirm recibe (pin, motivo).
export function PinDialog({ titulo = "Anular pedido", pedirMotivo = true, onConfirm, onClose }:
  { titulo?: string; pedirMotivo?: boolean; onConfirm: (pin: string, motivo: string) => Promise<void>; onClose: () => void }) {
  const { config } = useConfig();
  const [pin, setPin] = useState(""), [motivo, setMotivo] = useState(""), [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const [bloqueo, setBloqueo] = useState(() => leerFallos().hasta);
  const bloqueado = bloqueo > Date.now();
  async function ok() {
    if (bloqueado) return;
    if (pedirMotivo && motivo.trim().length < 4) return setError("Escribe el motivo: queda guardado en la auditoría.");
    setEnviando(true);
    try { await onConfirm(pin, motivo.trim()); guardarFallos({ n: 0, hasta: 0 }); onClose(); }
    catch (e) {
      setPin(""); setError(mensajeError(e));
      // Tras varios PIN incorrectos seguidos, este equipo espera 5 minutos (Configuración › Seguridad)
      if (/pin incorrecto/i.test(String((e as Error)?.message))) {
        const f = leerFallos(), n = f.n + 1, hasta = n >= (config.intentos_pin || 3) ? Date.now() + 5 * 60000 : 0;
        guardarFallos({ n: hasta ? 0 : n, hasta }); setBloqueo(hasta);
        if (hasta) setError("Demasiados intentos con PIN incorrecto. Espera 5 minutos o pide el PIN al Dueño.");
      }
    }
    finally { setEnviando(false); }
  }
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={400}
      pie={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" loading={enviando} disabled={pin.length < 4 || bloqueado} onClick={ok}>{titulo}</Button></>}>
      {bloqueado && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">Bloqueado por PIN incorrecto hasta las {new Date(bloqueo).toTimeString().slice(0, 5)}.</p>}
      {pedirMotivo && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pin-motivo" className="text-sm font-semibold">Motivo</label>
          <input id="pin-motivo" data-autofocus value={motivo} placeholder="Ej.: el cliente se fue" onChange={e => { setMotivo(e.target.value); setError(""); }} />
        </div>
      )}
      <div className="flex justify-center gap-3.5 py-1.5" aria-label={`PIN: ${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map(i => <i key={i} className={cx("h-4 w-4 rounded-full border-2", i < pin.length ? "border-brand bg-brand" : "border-ink-3")} />)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"].map((d, i) => d === "" ? <span key={i} /> : (
          <button key={i} type="button" aria-label={d === "borrar" ? "Borrar" : d} onClick={() => { setError(""); setPin(p => d === "borrar" ? p.slice(0, -1) : (p + d).slice(0, 4)); }}
            className="grid min-h-14 place-items-center rounded-md border border-line bg-surface-2 text-[22px] font-bold">
            {d === "borrar" ? <Delete size={22} /> : d}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </Modal>
  );
}
